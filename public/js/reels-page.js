/**
 * Reels por categoría (Mujeres / Hombres / Trans)
 */
(function () {
    const MAX_REEL_BYTES = 4.5 * 1024 * 1024;
    const MAX_REEL_DURATION_SEC = 60;

    const CATEGORIES = [
        {
            id: 'acompañantes-mujeres',
            label: 'Mujeres',
            page: 'reels-mujeres.html',
            feed: 'feed-mujeres.html'
        },
        {
            id: 'acompañantes-hombres',
            label: 'Hombres',
            page: 'reels-hombres.html',
            feed: 'feed-hombres.html'
        },
        {
            id: 'acompañantes-trans',
            label: 'Trans',
            page: 'reels-trans.html',
            feed: 'feed-trans.html'
        }
    ];

    const body = document.body;
    const categoryId = body.dataset.reelsCategory || CATEGORIES[0].id;
    const categoryMeta = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];

    const reelsFeed = document.getElementById('reels-feed');
    const feedStatus = document.getElementById('reels-feed-status');
    const uploadForm = document.getElementById('reel-upload-form');
    const uploadStatus = document.getElementById('reel-upload-status');
    const loginGate = document.getElementById('reels-login-gate');
    const uploadPanel = document.getElementById('reels-upload-panel');

    let authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
    let currentUser = null;

    function setStatus(el, message, type) {
        if (!el) return;
        el.textContent = message || '';
        el.className = 'reels-status' + (type ? ` ${type}` : '');
    }

    function formatMb(bytes) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function mediaUrl(path) {
        if (!path) return '';
        if (typeof resolveMediaUrl === 'function') {
            return resolveMediaUrl(path);
        }
        if (path.startsWith('http')) return path;
        return `${API_URL}${path}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function guessVideoMime(url) {
        const lower = String(url || '').toLowerCase();
        if (lower.includes('.webm')) return 'video/webm';
        if (lower.includes('.mov') || lower.includes('.qt')) return 'video/quicktime';
        if (lower.includes('.m4v')) return 'video/mp4';
        return '';
    }

    function getToken() {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        return authToken;
    }

    function isLoggedIn() {
        return Boolean(getToken());
    }

    function updateAuthUi() {
        const loggedIn = isLoggedIn();
        if (loginGate) loginGate.style.display = loggedIn ? 'none' : 'block';
        if (uploadPanel) uploadPanel.style.display = loggedIn ? 'block' : 'none';
    }

    function apiFetchHeaders(extra) {
        if (typeof DeseoAuth !== 'undefined') {
            return DeseoAuth.authHeaders(extra);
        }
        if (typeof DeseoAgeGate !== 'undefined') {
            return DeseoAgeGate.apiHeaders(extra);
        }
        const headers = { ...(extra || {}) };
        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }
        return headers;
    }

    function requireLoginForAction(message) {
        if (isLoggedIn()) {
            return true;
        }
        window.alert(message || 'Inicia sesión para usar esta función.');
        window.location.href = 'index.html';
        return false;
    }

    async function parseJsonResponse(res) {
        try {
            return await res.json();
        } catch {
            return {};
        }
    }

    function handleInvalidSession() {
        if (typeof DeseoAuth !== 'undefined') {
            DeseoAuth.clearSession();
        } else {
            localStorage.removeItem('authToken');
        }
        authToken = null;
        currentUser = null;
        updateAuthUi();
    }

    async function ensureSessionUser() {
        if (!getToken()) {
            return null;
        }

        if (typeof DeseoAuth !== 'undefined') {
            try {
                currentUser = await DeseoAuth.verifySession(API_URL);
                return currentUser;
            } catch {
                updateAuthUi();
                return null;
            }
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/verify`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const data = await parseJsonResponse(res);
            if (!res.ok) {
                if (
                    res.status === 401 ||
                    (typeof DeseoAuth !== 'undefined' &&
                        DeseoAuth.isInvalidTokenResponse(res.status, data))
                ) {
                    handleInvalidSession();
                }
                return null;
            }
            currentUser = data.user || null;
            if (currentUser && !currentUser.age_verified && localStorage.getItem('ageVerified') === 'true') {
                await syncAgeOnServer();
            }
            return currentUser;
        } catch {
            return null;
        }
    }

    async function syncAgeOnServer() {
        if (typeof DeseoAuth !== 'undefined') {
            return DeseoAuth.syncAgeVerificationFromLocal(API_URL);
        }
        if (!getToken() || localStorage.getItem('ageVerified') !== 'true') {
            return false;
        }
        try {
            const res = await fetch(`${API_URL}/api/auth/verify-age`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirmed: true })
            });
            if (res.ok && currentUser) {
                currentUser.age_verified = true;
            }
            return res.ok;
        } catch {
            return false;
        }
    }

    async function ensureVerifiedForReelUpload() {
        if (!authToken) return false;
        try {
            const res = await fetch(`${API_URL}/api/verification/status`, {
                headers: { Authorization: `Bearer ${authToken}` },
                cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.is_verified) return true;
            sessionStorage.setItem(
                'deseo_verify_message',
                'Subir reel: debes verificar tu identidad primero (documento, selfie y video).'
            );
            window.location.href = 'verificar-identidad.html';
            return false;
        } catch {
            setStatus(uploadStatus, 'No se pudo comprobar la verificación. Intenta de nuevo.', 'error');
            return false;
        }
    }

    function probeVideoFile(file) {
        return new Promise((resolve) => {
            if (!file) {
                resolve({ duration: null, error: 'Selecciona un video' });
                return;
            }
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            const cleanup = () => {
                URL.revokeObjectURL(url);
                video.removeAttribute('src');
                video.load();
            };
            video.onloadedmetadata = () => {
                const duration = Number.isFinite(video.duration) ? video.duration : null;
                cleanup();
                resolve({ duration, error: null });
            };
            video.onerror = () => {
                cleanup();
                resolve({ duration: null, error: null });
            };
            video.src = url;
        });
    }

    async function validateReelVideoFile(file) {
        if (!file) {
            return { ok: false, error: 'Selecciona un video' };
        }
        if (file.size > MAX_REEL_BYTES) {
            return {
                ok: false,
                error: `El video pesa ${formatMb(file.size)}. Máximo ${formatMb(MAX_REEL_BYTES)}. Usa un clip más corto o comprímelo.`
            };
        }
        const meta = await probeVideoFile(file);
        if (meta.duration != null && meta.duration > MAX_REEL_DURATION_SEC + 0.5) {
            return {
                ok: false,
                error: `El video dura ${Math.round(meta.duration)} s. Máximo ${MAX_REEL_DURATION_SEC} s.`
            };
        }
        return {
            ok: true,
            durationSeconds: meta.duration != null ? Math.max(1, Math.round(meta.duration)) : null
        };
    }

    async function handleReelsApiError(res, data) {
        if (res.status === 401) {
            handleInvalidSession();
            setStatus(feedStatus, 'Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
            return true;
        }

        if (res.status === 403 && data.ban_reason) {
            setStatus(feedStatus, data.error || 'Tu cuenta está suspendida.', 'error');
            return true;
        }

        if (res.status === 403 && data.requiresVerification) {
            sessionStorage.setItem(
                'deseo_verify_message',
                data.message || 'Verifica tu identidad para subir reels.'
            );
            window.location.href = 'verificar-identidad.html';
            return true;
        }

        if (
            res.status === 403 &&
            typeof DeseoAuth !== 'undefined' &&
            DeseoAuth.isInvalidTokenResponse(res.status, data)
        ) {
            handleInvalidSession();
            setStatus(feedStatus, 'Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
            return true;
        }

        if (res.status === 403) {
            setStatus(feedStatus, data.error || 'No tienes permiso para ver estos reels.', 'error');
            return true;
        }

        return false;
    }

    function renderCategoryNav() {
        const nav = document.getElementById('reels-category-nav');
        if (!nav) return;
        nav.innerHTML = CATEGORIES.map(
            (c) =>
                `<a href="${c.page}" class="${c.id === categoryId ? 'active' : ''}">${c.label}</a>`
        ).join('');
    }

    async function loadReels() {
        if (!reelsFeed) return;

        setStatus(feedStatus, 'Cargando reels...');
        reelsFeed.innerHTML = '';

        try {
            const res = await fetch(
                `${API_URL}/api/reels/category/${encodeURIComponent(categoryId)}?limit=20`,
                { headers: apiFetchHeaders() }
            );

            const data = await parseJsonResponse(res);

            if (!res.ok) {
                if (await handleReelsApiError(res, data)) {
                    return;
                }
                throw new Error(data.error || 'No se pudieron cargar los reels');
            }

            const reels = data.reels || [];

            if (!reels.length) {
                reelsFeed.innerHTML = `
                    <div class="reels-empty">
                        <div class="icon">🎬</div>
                        <strong>Aún no hay reels aquí</strong>
                        <p>Sé la primera persona en subir un video corto en ${categoryMeta.label}.</p>
                    </div>`;
                setStatus(feedStatus, '', null);
                return;
            }

            reels.forEach((reel) => reelsFeed.appendChild(createReelCard(reel)));
            setStatus(feedStatus, `${reels.length} reel${reels.length === 1 ? '' : 's'}`, null);
            setupVerticalFeedObserver();
            playActiveReel();
        } catch (err) {
            console.error(err);
            setStatus(feedStatus, err.message || 'Error al cargar reels. Intenta de nuevo.', 'error');
        }
    }

    let feedObserver = null;
    let globalMuted = true;

    function pauseAllVideos(exceptCard) {
        reelsFeed?.querySelectorAll('video.reel-video').forEach((video) => {
            const card = video.closest('.reel-card');
            if (exceptCard && card === exceptCard) return;
            video.pause();
        });
    }

    function playCardVideo(card) {
        if (!card) return;
        const video = card.querySelector('video.reel-video');
        if (!video) return;
        pauseAllVideos(card);
        video.muted = globalMuted;
        video.playsInline = true;
        const muteBtn = card.querySelector('.reel-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = globalMuted
                ? '<i class="fas fa-volume-mute"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
        registerView(reelIdFromCard(card), card);
    }

    function reelIdFromCard(card) {
        return Number(card?.dataset?.reelId) || null;
    }

    function playActiveReel() {
        if (!reelsFeed) return;
        const cards = [...reelsFeed.querySelectorAll('.reel-card')];
        if (!cards.length) return;
        const feedRect = reelsFeed.getBoundingClientRect();
        const mid = feedRect.top + feedRect.height / 2;
        let best = cards[0];
        let bestDist = Infinity;
        cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const dist = Math.abs(center - mid);
            if (dist < bestDist) {
                bestDist = dist;
                best = card;
            }
        });
        playCardVideo(best);
    }

    function setupVerticalFeedObserver() {
        if (!reelsFeed || typeof IntersectionObserver === 'undefined') {
            return;
        }
        if (feedObserver) {
            feedObserver.disconnect();
        }
        feedObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
                        playCardVideo(entry.target);
                    }
                });
            },
            { root: reelsFeed, threshold: [0.65, 0.85] }
        );
        reelsFeed.querySelectorAll('.reel-card').forEach((card) => feedObserver.observe(card));
    }

    function updateCardLikeStats(card, count) {
        const likeBtn = card?.querySelector('.like-btn');
        if (likeBtn) {
            const label = likeBtn.querySelector('[data-like-count]');
            if (label) label.textContent = String(count);
            likeBtn.dataset.count = String(count);
        }
    }

    function createReelCard(reel) {
        const card = document.createElement('article');
        card.className = 'reel-card';
        card.dataset.reelId = reel.id;

        const videoUrl = mediaUrl(reel.video_url);
        const mime = guessVideoMime(videoUrl);
        const avatar = mediaUrl(reel.profile_picture) || mediaUrl('/uploads/default-avatar.png');
        const username = escapeHtml(reel.username || 'Usuario');
        const isOwner = currentUser && reel.user_id === currentUser.id;
        const liked = !!reel.is_liked_by_me;
        const sourceAttrs = mime ? `src="${videoUrl}" type="${mime}"` : `src="${videoUrl}"`;
        const likes = reel.likes_count || 0;
        const comments = reel.comments_count || 0;

        card.innerHTML = `
            <div class="reel-stage">
                <video class="reel-video" playsinline muted loop preload="metadata" poster="${reel.thumbnail_url ? mediaUrl(reel.thumbnail_url) : ''}">
                    <source ${sourceAttrs}>
                </video>
                <button type="button" class="reel-tap-zone" aria-label="Reproducir o pausar"></button>
                <button type="button" class="reel-mute-btn" aria-label="Silencio"><i class="fas fa-volume-mute"></i></button>
                <div class="reel-overlay">
                    <div class="reel-overlay-gradient" aria-hidden="true"></div>
                    <div class="reel-side-actions">
                        <button type="button" class="like-btn ${liked ? 'liked' : ''}" data-liked="${liked}" data-count="${likes}" aria-label="Me gusta">
                            <i class="fas fa-heart"></i>
                            <span data-like-count>${likes}</span>
                        </button>
                        <button type="button" class="comment-toggle-btn" aria-label="Comentar">
                            <i class="fas fa-comment"></i>
                            <span data-comment-count>${comments}</span>
                        </button>
                        ${isOwner ? '<button type="button" class="delete-reel-btn" aria-label="Eliminar"><i class="fas fa-trash"></i></button>' : ''}
                    </div>
                    <div class="reel-body">
                        <div class="reel-author">
                            <img src="${avatar}" alt="">
                            <div>
                                <strong>${username}${reel.is_verified ? ' <span class="verified">✓</span>' : ''}</strong>
                            </div>
                        </div>
                        ${reel.title ? `<h3 class="reel-title">${escapeHtml(reel.title)}</h3>` : ''}
                        ${reel.description ? `<p class="reel-desc">${escapeHtml(reel.description)}</p>` : ''}
                    </div>
                    <div class="reel-comments" hidden>
                        <div class="comment-list"></div>
                        <form class="reel-comment-form">
                            <input type="text" name="comment" placeholder="Escribe un comentario" maxlength="240" required>
                            <button type="submit">Enviar</button>
                        </form>
                    </div>
                </div>
            </div>`;

        const video = card.querySelector('video');
        video?.addEventListener(
            'play',
            () => {
                registerView(reel.id, card);
            },
            { once: true }
        );

        card.querySelector('.reel-tap-zone')?.addEventListener('click', () => {
            if (!video) return;
            if (video.paused) {
                playCardVideo(card);
            } else {
                video.pause();
            }
        });

        card.querySelector('.reel-mute-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            globalMuted = !globalMuted;
            reelsFeed?.querySelectorAll('video.reel-video').forEach((v) => {
                v.muted = globalMuted;
            });
            reelsFeed?.querySelectorAll('.reel-mute-btn').forEach((btn) => {
                btn.innerHTML = globalMuted
                    ? '<i class="fas fa-volume-mute"></i>'
                    : '<i class="fas fa-volume-up"></i>';
            });
        });

        card.querySelector('.like-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(reel.id, e.currentTarget, card);
        });

        card.querySelector('.comment-toggle-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = card.querySelector('.reel-comments');
            const hidden = section.hasAttribute('hidden');
            if (hidden) {
                section.removeAttribute('hidden');
                loadComments(reel.id, card.querySelector('.comment-list'));
            } else {
                section.setAttribute('hidden', '');
            }
        });

        card.querySelector('.reel-comment-form')?.addEventListener('submit', (e) => {
            submitComment(e, reel.id, card);
        });

        card.querySelector('.delete-reel-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteReel(reel.id);
        });

        return card;
    }

    async function registerView(reelId, card) {
        if (!reelId || card?.dataset?.viewSent === '1') return;
        card.dataset.viewSent = '1';
        try {
            await fetch(`${API_URL}/api/reels/${reelId}/view`, {
                method: 'POST',
                headers: apiFetchHeaders()
            });
        } catch (_) {}
    }

    async function toggleLike(reelId, button, card) {
        if (!requireLoginForAction('Inicia sesión para dar me gusta.')) return;
        const liked = button.dataset.liked === 'true';
        const count = parseInt(button.dataset.count, 10) || 0;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/like`, {
                method: liked ? 'DELETE' : 'POST',
                headers: apiFetchHeaders()
            });
            if (!res.ok) throw new Error();
            const newLiked = !liked;
            const newCount = newLiked ? count + 1 : Math.max(0, count - 1);
            button.dataset.liked = newLiked ? 'true' : 'false';
            button.dataset.count = String(newCount);
            button.classList.toggle('liked', newLiked);
            const label = button.querySelector('[data-like-count]');
            if (label) label.textContent = String(newCount);
            updateCardLikeStats(card, newCount);
        } catch {
            alert('No se pudo actualizar el like');
        }
    }

    async function loadComments(reelId, container) {
        if (!container || container.dataset.loaded === 'true') return;
        container.innerHTML = '<p class="reels-status">Cargando...</p>';
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/comments`, {
                headers: apiFetchHeaders()
            });
            const data = await res.json();
            const comments = data.comments || [];
            if (!comments.length) {
                container.innerHTML = '<p class="reels-status">Sin comentarios aún.</p>';
            } else {
                container.innerHTML = comments
                    .map(
                        (c) => `
                    <div class="comment-item">
                        <img src="${mediaUrl(c.profile_picture) || mediaUrl('/uploads/default-avatar.png')}" alt="">
                        <div><strong>${escapeHtml(c.username)}</strong><br>${escapeHtml(c.comment)}</div>
                    </div>`
                    )
                    .join('');
            }
            container.dataset.loaded = 'true';
        } catch {
            container.innerHTML = '<p class="reels-status error">Error al cargar comentarios</p>';
        }
    }

    async function submitComment(event, reelId, card) {
        event.preventDefault();
        if (!requireLoginForAction('Inicia sesión para comentar.')) return;
        const input = event.currentTarget.querySelector('input[name="comment"]');
        const text = input.value.trim();
        if (!text) return;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/comment`, {
                method: 'POST',
                headers: apiFetchHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ comment: text })
            });
            if (!res.ok) throw new Error();
            input.value = '';
            const list = card.querySelector('.comment-list');
            list.dataset.loaded = 'false';
            loadComments(reelId, list);
            const commentsEl = card.querySelector('[data-comment-count]');
            if (commentsEl) {
                const current = parseInt(commentsEl.textContent, 10) || 0;
                commentsEl.textContent = String(current + 1);
            }
        } catch {
            alert('No se pudo enviar el comentario');
        }
    }

    async function deleteReel(reelId) {
        if (!confirm('¿Eliminar este reel?')) return;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}`, {
                method: 'DELETE',
                headers: apiFetchHeaders()
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Error');
            setStatus(feedStatus, 'Reel eliminado', 'success');
            loadReels();
        } catch (err) {
            alert(err.message || 'No se pudo eliminar');
        }
    }

    function wireVideoInputValidation() {
        const videoInput = uploadForm?.querySelector('input[name="video"]');
        const durationInput = uploadForm?.querySelector('input[name="duration_seconds"]');
        if (!videoInput) return;

        videoInput.addEventListener('change', async () => {
            const file = videoInput.files && videoInput.files[0];
            if (!file) {
                setStatus(uploadStatus, '', null);
                return;
            }
            setStatus(uploadStatus, 'Revisando video...', null);
            const check = await validateReelVideoFile(file);
            if (!check.ok) {
                setStatus(uploadStatus, check.error, 'error');
                videoInput.value = '';
                return;
            }
            if (check.durationSeconds != null && durationInput) {
                durationInput.value = String(check.durationSeconds);
            }
            setStatus(
                uploadStatus,
                `Listo · ${formatMb(file.size)}${check.durationSeconds ? ` · ${check.durationSeconds}s` : ''}`,
                'success'
            );
        });
    }

    if (uploadForm) {
        const categoryInput = document.getElementById('reel-category-fixed');
        if (categoryInput) categoryInput.value = categoryId;
        wireVideoInputValidation();

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isLoggedIn()) {
                window.location.href = 'index.html?register=1';
                return;
            }
            if (!(await ensureVerifiedForReelUpload())) {
                return;
            }

            const videoInput = uploadForm.querySelector('input[name="video"]');
            const file = videoInput?.files && videoInput.files[0];
            const check = await validateReelVideoFile(file);
            if (!check.ok) {
                setStatus(uploadStatus, check.error, 'error');
                return;
            }

            const formData = new FormData(uploadForm);
            formData.set('category', categoryId);
            if (!formData.get('is_public')) formData.set('is_public', 'false');
            if (check.durationSeconds != null) {
                formData.set('duration_seconds', String(check.durationSeconds));
            }

            const btn = uploadForm.querySelector('.btn-publish-reel');
            if (btn) btn.disabled = true;
            setStatus(uploadStatus, 'Subiendo video...');

            try {
                const res = await fetch(`${API_URL}/api/reels`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: formData
                });
                const data = await parseJsonResponse(res);
                if (res.status === 401 || (res.status === 403 && typeof DeseoAuth !== 'undefined' && DeseoAuth.isInvalidTokenResponse(res.status, data))) {
                    handleInvalidSession();
                    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
                }
                if (res.status === 403 && data.requiresVerification) {
                    sessionStorage.setItem(
                        'deseo_verify_message',
                        data.message || 'Verifica tu identidad para subir reels.'
                    );
                    window.location.href = 'verificar-identidad.html';
                    return;
                }
                if (res.status === 403 && (data.message || data.error === 'Categoría no permitida')) {
                    setStatus(uploadStatus, data.message || data.error, 'error');
                    return;
                }
                if (!res.ok) throw new Error(data.error || 'No se pudo subir el reel');
                setStatus(uploadStatus, 'Reel publicado correctamente', 'success');
                uploadForm.reset();
                const pub = document.getElementById('reel-public');
                if (pub) pub.checked = true;
                loadReels();
            } catch (err) {
                setStatus(uploadStatus, err.message || 'Error al subir', 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    function setupMobileUploadFab() {
        const panel = uploadPanel;
        if (!panel) return;
        panel.addEventListener('toggle', () => {
            document.body.classList.toggle('reels-upload-open', panel.open);
        });
    }

    async function runReelsPage() {
        setupMobileUploadFab();
        renderCategoryNav();
        updateAuthUi();
        if (isLoggedIn()) {
            await ensureSessionUser();
        }
        updateAuthUi();
        await loadReels();
    }

    async function init() {
        if (typeof DeseoAgeGate !== 'undefined' && DeseoAgeGate.mountBlockingGate(function () {
            runReelsPage();
        })) {
            return;
        }

        await runReelsPage();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
