/**
 * Historias: visor a pantalla completa (fotos y videos) y hoja para subir.
 * El contenido es permanente; el aro de color solo marca lo publicado en las últimas 24 h.
 */
window.DeseoStories = (function () {
    const IMAGE_DURATION_MS = 5000;
    const MAX_VIDEO_DURATION_SEC = 45;
    const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
    const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;
    const SEEN_STORAGE_KEY = 'deseo_seen_stories';
    const SWIPE_CLOSE_PX = 90;
    const HOLD_MS = 220;

    function apiBase() {
        return typeof API_URL !== 'undefined' ? API_URL : window.location.origin;
    }

    function mediaUrl(path) {
        if (!path) return '';
        if (typeof resolveMediaUrl === 'function') return resolveMediaUrl(path);
        return path.startsWith('http') ? path : `${apiBase()}${path}`;
    }

    function getToken() {
        if (typeof DeseoAuth !== 'undefined') return DeseoAuth.getToken();
        return localStorage.getItem('authToken');
    }

    function getCurrentUserId() {
        if (typeof DeseoAuth === 'undefined' || typeof DeseoAuth.getCachedUser !== 'function') return null;
        const user = DeseoAuth.getCachedUser();
        return user && user.id != null ? Number(user.id) : null;
    }

    function authHeaders(extra) {
        if (typeof DeseoAuth !== 'undefined' && typeof DeseoAuth.authHeaders === 'function') {
            return DeseoAuth.authHeaders(extra);
        }
        const headers = { ...(extra || {}) };
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function formatMb(bytes) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function parseDate(raw) {
        if (!raw) return null;
        const text = String(raw);
        const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`;
        const time = Date.parse(iso);
        return Number.isNaN(time) ? null : time;
    }

    function timeAgo(raw) {
        const time = parseDate(raw);
        if (time == null) return '';
        const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
        if (minutes < 1) return 'ahora';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours} h`;
        const days = Math.round(hours / 24);
        if (days < 7) return `${days} d`;
        return new Date(time).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    }

    function readSeen() {
        try {
            const list = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
            return new Set(Array.isArray(list) ? list.map(Number) : []);
        } catch {
            return new Set();
        }
    }

    function markSeen(id) {
        const seen = readSeen();
        if (seen.has(Number(id))) return;
        seen.add(Number(id));
        const list = [...seen].slice(-500);
        try {
            localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(list));
        } catch (_) {}
    }

    function hasUnseenRecent(reels) {
        const seen = readSeen();
        return (reels || []).some((reel) => reel.is_recent && !seen.has(Number(reel.id)));
    }

    async function fetchUserStories(userId) {
        const res = await fetch(`${apiBase()}/api/reels/user/${encodeURIComponent(userId)}`, {
            headers: authHeaders(),
            cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las historias');
        return data.reels || [];
    }

    /**
     * Marks a circular avatar wrapper: `is-new` (colored ring) when there is unseen
     * content from the last 24 h, `has-stories` (soft ring) otherwise.
     */
    function applyRing(el, reels) {
        if (!el) return;
        const list = reels || [];
        el.classList.toggle('story-ring', list.length > 0);
        el.classList.toggle('has-stories', list.length > 0);
        el.classList.toggle('is-new', hasUnseenRecent(list));
    }

    // ---------- Visor ----------

    let viewer = null;

    function buildViewerDom() {
        const root = document.createElement('div');
        root.className = 'story-viewer';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Historias');
        root.innerHTML = `
            <div class="story-frame">
                <div class="story-progress" aria-hidden="true"></div>
                <div class="story-header">
                    <a class="story-author" href="#">
                        <img class="story-author-avatar" alt="">
                        <span class="story-author-name"></span>
                        <span class="story-author-time"></span>
                    </a>
                    <div class="story-header-actions">
                        <button type="button" class="story-btn story-mute" aria-label="Activar sonido" hidden><i class="fas fa-volume-mute"></i></button>
                        <button type="button" class="story-btn story-delete" aria-label="Eliminar" hidden><i class="fas fa-trash"></i></button>
                        <button type="button" class="story-btn story-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="story-media"></div>
                <div class="story-tap-layer" aria-hidden="true"></div>
                <div class="story-footer">
                    <div class="story-caption"></div>
                    <button type="button" class="story-like" aria-label="Me gusta">
                        <i class="fas fa-heart"></i><span class="story-like-count">0</span>
                    </button>
                </div>
                <button type="button" class="story-nav story-nav-prev" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>
                <button type="button" class="story-nav story-nav-next" aria-label="Siguiente"><i class="fas fa-chevron-right"></i></button>
            </div>`;
        return root;
    }

    function stopTimer() {
        if (viewer && viewer.raf) {
            cancelAnimationFrame(viewer.raf);
            viewer.raf = null;
        }
    }

    function setSegmentProgress(index, fraction) {
        const fills = viewer.root.querySelectorAll('.story-progress-fill');
        fills.forEach((fill, i) => {
            const value = i < index ? 1 : i > index ? 0 : Math.max(0, Math.min(1, fraction));
            fill.style.transform = `scaleX(${value})`;
        });
    }

    function tick() {
        if (!viewer) return;
        const reel = viewer.reels[viewer.index];
        const video = viewer.root.querySelector('.story-media video');
        let fraction = 0;
        if (reel.media_type === 'image') {
            if (!viewer.paused) {
                viewer.elapsed += performance.now() - viewer.lastTick;
            }
            viewer.lastTick = performance.now();
            fraction = viewer.elapsed / IMAGE_DURATION_MS;
        } else if (video && video.duration && Number.isFinite(video.duration)) {
            fraction = video.currentTime / video.duration;
        }
        setSegmentProgress(viewer.index, fraction);
        if (reel.media_type === 'image' && fraction >= 1) {
            next();
            return;
        }
        viewer.raf = requestAnimationFrame(tick);
    }

    function setPaused(paused) {
        if (!viewer) return;
        viewer.paused = paused;
        viewer.root.classList.toggle('is-paused', paused);
        const video = viewer.root.querySelector('.story-media video');
        if (!video) return;
        if (paused) {
            video.pause();
        } else {
            playVideo(video);
        }
    }

    function playVideo(video) {
        video.muted = viewer.muted;
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
                if (!video.muted) {
                    viewer.muted = true;
                    video.muted = true;
                    updateMuteButton();
                    video.play().catch(() => {});
                }
            });
        }
    }

    function updateMuteButton() {
        const btn = viewer.root.querySelector('.story-mute');
        if (!btn) return;
        btn.innerHTML = viewer.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        btn.setAttribute('aria-label', viewer.muted ? 'Activar sonido' : 'Silenciar');
    }

    function registerView(reel) {
        if (!reel || viewer.viewed.has(reel.id)) return;
        viewer.viewed.add(reel.id);
        markSeen(reel.id);
        fetch(`${apiBase()}/api/reels/${reel.id}/view`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    }

    function renderLike(reel) {
        const btn = viewer.root.querySelector('.story-like');
        btn.classList.toggle('liked', Boolean(reel.is_liked_by_me));
        btn.querySelector('.story-like-count').textContent = String(reel.likes_count || 0);
    }

    function show(index) {
        stopTimer();
        viewer.index = index;
        viewer.elapsed = 0;
        viewer.lastTick = performance.now();
        const reel = viewer.reels[index];
        const root = viewer.root;

        const author = root.querySelector('.story-author');
        author.href = `profile.html?user=${encodeURIComponent(reel.user_id)}`;
        const avatar = root.querySelector('.story-author-avatar');
        const fallbackAvatar = typeof DEFAULT_AVATAR_SRC !== 'undefined'
            ? DEFAULT_AVATAR_SRC
            : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#3a3d4d"/><circle cx="20" cy="15" r="7" fill="#8a8fa3"/><path d="M6 36c2-8 8-12 14-12s12 4 14 12" fill="#8a8fa3"/></svg>');
        avatar.onerror = () => {
            avatar.onerror = null;
            avatar.src = fallbackAvatar;
        };
        avatar.src = mediaUrl(reel.profile_picture) || fallbackAvatar;
        root.querySelector('.story-author-name').innerHTML =
            `${escapeHtml(reel.username || 'Usuario')}${reel.is_verified ? ' <span class="story-verified">✓</span>' : ''}`;
        root.querySelector('.story-author-time').textContent = timeAgo(reel.created_at);

        const isOwner = viewer.currentUserId != null && Number(reel.user_id) === viewer.currentUserId;
        root.querySelector('.story-delete').hidden = !isOwner;
        root.querySelector('.story-mute').hidden = reel.media_type === 'image';

        const caption = [reel.title, reel.description].filter(Boolean).map(escapeHtml).join('<br>');
        const captionEl = root.querySelector('.story-caption');
        captionEl.innerHTML = caption;
        captionEl.hidden = !caption;
        renderLike(reel);

        const stage = root.querySelector('.story-media');
        stage.querySelectorAll('video').forEach((v) => {
            v.pause();
            v.removeAttribute('src');
            v.load();
        });
        stage.innerHTML = '';
        const src = mediaUrl(reel.video_url);
        if (reel.media_type === 'image') {
            const img = document.createElement('img');
            img.alt = '';
            img.src = src;
            stage.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.src = src;
            video.addEventListener('ended', () => next());
            stage.appendChild(video);
            updateMuteButton();
            if (!viewer.paused) playVideo(video);
        }

        root.querySelector('.story-nav-prev').disabled = index === 0;
        setSegmentProgress(index, 0);
        registerView(reel);
        viewer.raf = requestAnimationFrame(tick);
    }

    function next() {
        if (!viewer) return;
        if (viewer.index < viewer.reels.length - 1) {
            show(viewer.index + 1);
        } else {
            close();
        }
    }

    function prev() {
        if (!viewer) return;
        show(Math.max(0, viewer.index - 1));
    }

    function renderProgress() {
        const bar = viewer.root.querySelector('.story-progress');
        bar.innerHTML = viewer.reels
            .map(() => '<span class="story-progress-seg"><span class="story-progress-fill"></span></span>')
            .join('');
    }

    async function toggleLike() {
        const reel = viewer.reels[viewer.index];
        if (!getToken()) {
            window.alert('Inicia sesión para dar me gusta.');
            return;
        }
        const liked = Boolean(reel.is_liked_by_me);
        try {
            const res = await fetch(`${apiBase()}/api/reels/${reel.id}/like`, {
                method: liked ? 'DELETE' : 'POST',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            reel.is_liked_by_me = liked ? 0 : 1;
            reel.likes_count = Math.max(0, (reel.likes_count || 0) + (liked ? -1 : 1));
            if (viewer && viewer.reels[viewer.index] === reel) renderLike(reel);
        } catch {
            window.alert('No se pudo actualizar el me gusta');
        }
    }

    async function deleteCurrent() {
        const reel = viewer.reels[viewer.index];
        setPaused(true);
        if (!window.confirm('¿Eliminar esta historia?')) {
            setPaused(false);
            return;
        }
        try {
            const res = await fetch(`${apiBase()}/api/reels/${reel.id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
            const onDeleted = viewer.onDeleted;
            viewer.reels.splice(viewer.index, 1);
            if (typeof onDeleted === 'function') onDeleted(reel);
            if (!viewer.reels.length) {
                close();
                return;
            }
            renderProgress();
            setPaused(false);
            show(Math.min(viewer.index, viewer.reels.length - 1));
        } catch (err) {
            window.alert(err.message || 'No se pudo eliminar');
            setPaused(false);
        }
    }

    function wireGestures(root) {
        const layer = root.querySelector('.story-tap-layer');
        let start = null;
        let holdTimer = null;
        let held = false;

        layer.addEventListener('pointerdown', (e) => {
            start = { x: e.clientX, y: e.clientY };
            held = false;
            holdTimer = setTimeout(() => {
                held = true;
                setPaused(true);
            }, HOLD_MS);
        });

        const finish = (e, cancelled) => {
            clearTimeout(holdTimer);
            if (!start) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const wasHeld = held;
            start = null;
            root.querySelector('.story-frame').style.transform = '';
            if (wasHeld) setPaused(false);
            if (cancelled) return;
            if (dy > SWIPE_CLOSE_PX && Math.abs(dy) > Math.abs(dx)) {
                close();
                return;
            }
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) next();
                else prev();
                return;
            }
            if (wasHeld || Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
            const rect = layer.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width / 3) prev();
            else next();
        };

        layer.addEventListener('pointermove', (e) => {
            if (!start) return;
            const dy = e.clientY - start.y;
            if (dy > 0) {
                root.querySelector('.story-frame').style.transform = `translateY(${dy * 0.6}px)`;
            }
        });
        layer.addEventListener('pointerup', (e) => finish(e, false));
        layer.addEventListener('pointercancel', (e) => finish(e, true));
    }

    function onKeyDown(e) {
        if (!viewer) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === ' ') {
            e.preventDefault();
            setPaused(!viewer.paused);
        }
    }

    function onPopState() {
        if (viewer) close({ fromHistory: true });
    }

    function open(reels, options) {
        const list = (reels || []).filter((reel) => reel && reel.video_url);
        if (!list.length) return;
        if (viewer) close();
        const opts = options || {};

        const root = buildViewerDom();
        document.body.appendChild(root);
        document.body.classList.add('story-viewer-open');

        viewer = {
            root,
            reels: list.slice(),
            index: 0,
            elapsed: 0,
            lastTick: 0,
            paused: false,
            muted: false,
            raf: null,
            viewed: new Set(),
            currentUserId: opts.currentUserId != null ? Number(opts.currentUserId) : getCurrentUserId(),
            onDeleted: opts.onDeleted,
            onClose: opts.onClose
        };

        renderProgress();
        root.querySelector('.story-close').addEventListener('click', () => close());
        root.querySelector('.story-nav-prev').addEventListener('click', prev);
        root.querySelector('.story-nav-next').addEventListener('click', next);
        root.querySelector('.story-like').addEventListener('click', toggleLike);
        root.querySelector('.story-delete').addEventListener('click', deleteCurrent);
        root.querySelector('.story-mute').addEventListener('click', () => {
            viewer.muted = !viewer.muted;
            const video = root.querySelector('.story-media video');
            if (video) video.muted = viewer.muted;
            updateMuteButton();
        });
        wireGestures(root);
        document.addEventListener('keydown', onKeyDown);

        try {
            history.pushState({ deseoStory: true }, '');
            viewer.pushedHistory = true;
            window.addEventListener('popstate', onPopState);
        } catch (_) {}

        const start = Math.max(0, Math.min(Number(opts.startIndex) || 0, list.length - 1));
        show(start);
    }

    function close(closeOptions) {
        if (!viewer) return;
        const current = viewer;
        viewer = null;
        if (current.raf) cancelAnimationFrame(current.raf);
        current.root.querySelectorAll('video').forEach((v) => {
            v.pause();
            v.removeAttribute('src');
            v.load();
        });
        current.root.remove();
        document.body.classList.remove('story-viewer-open');
        document.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('popstate', onPopState);
        if (current.pushedHistory && !(closeOptions && closeOptions.fromHistory)) {
            try {
                history.back();
            } catch (_) {}
        }
        if (typeof current.onClose === 'function') current.onClose();
    }

    // ---------- Subir historia ----------

    function probeVideoDuration(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            const done = (value) => {
                URL.revokeObjectURL(url);
                resolve(value);
            };
            video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
            video.onerror = () => done(null);
            video.src = url;
        });
    }

    function canUploadDirect(userId) {
        return Boolean(userId) && typeof DeseoBlobUpload !== 'undefined' && typeof DeseoBlobUpload.uploadFile === 'function';
    }

    async function prepareFile(file, setStatus, maxBytes) {
        const isVideo = String(file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name || '');
        if (!isVideo) {
            let finalFile = file;
            if (typeof DeseoUploadMobile !== 'undefined' && typeof DeseoUploadMobile.compressImageFile === 'function') {
                setStatus('Preparando foto...');
                finalFile = await DeseoUploadMobile.compressImageFile(file, 3.5 * 1024 * 1024, 1920);
            }
            if (finalFile.size > maxBytes) {
                throw new Error(`La foto pesa ${formatMb(finalFile.size)} (máx. ${formatMb(maxBytes)}).`);
            }
            return { file: finalFile, mediaType: 'image', duration: null };
        }

        let finalFile = file;
        if (typeof DeseoVideoCompress !== 'undefined' && file.size > maxBytes) {
            setStatus(`Comprimiendo video (${formatMb(file.size)})...`);
            const result = await DeseoVideoCompress.compressIfNeeded(file, {
                maxBytes,
                maxDurationSec: MAX_VIDEO_DURATION_SEC,
                onProgress: ({ phase, progress }) => {
                    if (phase === 'compress') setStatus(`Comprimiendo video… ${Math.round((progress || 0) * 100)}%`);
                }
            });
            finalFile = result.file;
        }
        if (finalFile.size > maxBytes) {
            throw new Error(`El video pesa ${formatMb(finalFile.size)} (máx. ${formatMb(maxBytes)}). Probá un clip más corto.`);
        }
        const duration = await probeVideoDuration(finalFile);
        if (duration != null && duration > MAX_VIDEO_DURATION_SEC + 0.5) {
            throw new Error(`El video dura ${Math.round(duration)} s. Máximo ${MAX_VIDEO_DURATION_SEC} s.`);
        }
        return { file: finalFile, mediaType: 'video', duration: duration != null ? Math.max(1, Math.round(duration)) : null };
    }

    /**
     * Opens a bottom sheet to publish a photo or video.
     * options.category: category to publish in; options.onUploaded(result) after success.
     */
    function openUploadSheet(options) {
        const opts = options || {};
        const existing = document.querySelector('.story-upload-sheet');
        if (existing) existing.remove();

        const sheet = document.createElement('div');
        sheet.className = 'story-upload-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.innerHTML = `
            <div class="story-upload-card">
                <div class="story-upload-head">
                    <strong>Nueva historia</strong>
                    <button type="button" class="story-upload-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <p class="story-upload-hint">Foto o video de hasta ${MAX_VIDEO_DURATION_SEC} segundos. Queda en tu perfil hasta que la borres.</p>
                <label class="story-upload-pick">
                    <input type="file" accept="image/*,video/*" hidden>
                    <span class="story-upload-preview"><i class="fas fa-images"></i><span>Elegir foto o video</span></span>
                </label>
                <label class="story-upload-text">Texto (opcional)
                    <input type="text" maxlength="120" placeholder="Ej: Disponible hoy">
                </label>
                <button type="button" class="story-upload-submit" disabled><i class="fas fa-paper-plane"></i> Publicar historia</button>
                <p class="story-upload-status" role="status"></p>
            </div>`;
        document.body.appendChild(sheet);
        document.body.classList.add('story-viewer-open');

        const input = sheet.querySelector('input[type="file"]');
        const preview = sheet.querySelector('.story-upload-preview');
        const status = sheet.querySelector('.story-upload-status');
        const submit = sheet.querySelector('.story-upload-submit');
        const textInput = sheet.querySelector('.story-upload-text input');
        let prepared = null;
        let previewUrl = null;
        const uploaderId = opts.userId != null ? opts.userId : getCurrentUserId();
        const direct = canUploadDirect(uploaderId);
        const maxBytes = direct ? MAX_DIRECT_UPLOAD_BYTES : MAX_UPLOAD_BYTES;

        const setStatus = (message, type) => {
            status.textContent = message || '';
            status.className = 'story-upload-status' + (type ? ` ${type}` : '');
        };

        const closeSheet = () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            sheet.remove();
            if (!viewer) document.body.classList.remove('story-viewer-open');
        };

        sheet.querySelector('.story-upload-close').addEventListener('click', closeSheet);
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) closeSheet();
        });

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            prepared = null;
            submit.disabled = true;
            if (!file) return;
            try {
                prepared = await prepareFile(file, (msg) => setStatus(msg), maxBytes);
            } catch (err) {
                setStatus(err.message || 'No se pudo preparar el archivo', 'error');
                input.value = '';
                return;
            }
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(prepared.file);
            preview.innerHTML = prepared.mediaType === 'image'
                ? `<img src="${previewUrl}" alt="">`
                : `<video src="${previewUrl}" muted playsinline autoplay loop></video>`;
            preview.classList.add('has-media');
            setStatus(`Listo · ${formatMb(prepared.file.size)}${prepared.duration ? ` · ${prepared.duration}s` : ''}`, 'success');
            submit.disabled = false;
        });

        submit.addEventListener('click', async () => {
            if (!prepared) return;
            const token = getToken();
            if (!token) {
                window.location.href = 'index.html?login=1';
                return;
            }
            if (!opts.category) {
                setStatus('Elegí tu categoría en "Editar perfil" antes de publicar.', 'error');
                return;
            }
            const formData = new FormData();
            formData.set('category', opts.category);
            formData.set('title', textInput.value.trim());
            formData.set('is_public', 'true');
            if (prepared.duration != null) formData.set('duration_seconds', String(prepared.duration));

            submit.disabled = true;
            setStatus('Subiendo...');
            try {
                let mediaUrl = null;
                if (direct) {
                    try {
                        const uploaded = await DeseoBlobUpload.uploadFile(prepared.file, {
                            authToken: token,
                            folder: `uploads/reels/${uploaderId}`,
                            onProgress: ({ progress }) => setStatus(`Subiendo… ${Math.round((progress || 0) * 100)}%`)
                        });
                        mediaUrl = uploaded.url;
                    } catch (uploadErr) {
                        if (prepared.file.size > MAX_UPLOAD_BYTES) throw uploadErr;
                    }
                }
                if (mediaUrl) {
                    formData.set('media_url', mediaUrl);
                    formData.set('media_type', prepared.mediaType);
                } else {
                    formData.set(prepared.mediaType === 'image' ? 'image' : 'video', prepared.file);
                }
                setStatus('Publicando...');
                const res = await fetch(`${apiBase()}/api/reels`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 403 && data.requiresVerification) {
                    sessionStorage.setItem('deseo_verify_message', data.message || 'Verifica tu identidad para subir historias.');
                    window.location.href = 'verificar-identidad.html';
                    return;
                }
                if (!res.ok) throw new Error(data.message || data.error || 'No se pudo publicar');
                closeSheet();
                if (typeof opts.onUploaded === 'function') opts.onUploaded(data);
            } catch (err) {
                setStatus(err.message || 'Error al subir', 'error');
                submit.disabled = false;
            }
        });

        input.click();
    }

    return {
        open,
        close,
        applyRing,
        fetchUserStories,
        hasUnseenRecent,
        openUploadSheet
    };
})();
