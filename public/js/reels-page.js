/**
 * Reels por categoría (Mujeres / Hombres / Trans)
 */
(function () {
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
    let loadReelsRetried = false;

    function setStatus(el, message, type) {
        if (!el) return;
        el.textContent = message || '';
        el.className = 'reels-status' + (type ? ` ${type}` : '');
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

    async function handleReelsApiError(res, data) {
        if (res.status === 401) {
            handleInvalidSession();
            setStatus(feedStatus, 'Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
            return true;
        }

        if (res.status === 403 && data.requires_age_verification) {
            if (!loadReelsRetried) {
                const synced = await syncAgeOnServer();
                if (synced) {
                    loadReelsRetried = true;
                    await loadReels();
                    return true;
                }
            }
            setStatus(
                feedStatus,
                'Debes confirmar que eres mayor de edad. Ve al inicio, inicia sesión y acepta el aviso de edad.',
                'warning'
            );
            return true;
        }

        if (res.status === 403 && data.ban_reason) {
            setStatus(feedStatus, data.error || 'Tu cuenta está suspendida.', 'error');
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

        if (!isLoggedIn()) {
            reelsFeed.innerHTML = '';
            setStatus(feedStatus, 'Inicia sesión para ver los reels de esta categoría.', 'warning');
            return;
        }

        setStatus(feedStatus, 'Cargando reels...');
        reelsFeed.innerHTML = '';

        try {
            const res = await fetch(
                `${API_URL}/api/reels/category/${encodeURIComponent(categoryId)}?limit=20`,
                { headers: { Authorization: `Bearer ${authToken}` } }
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
        } catch (err) {
            console.error(err);
            setStatus(feedStatus, err.message || 'Error al cargar reels. Intenta de nuevo.', 'error');
        }
    }

    function createReelCard(reel) {
        const card = document.createElement('article');
        card.className = 'reel-card';
        card.dataset.reelId = reel.id;

        const videoUrl = mediaUrl(reel.video_url);
        const avatar = mediaUrl(reel.profile_picture) || mediaUrl('/uploads/default-avatar.png');
        const username = escapeHtml(reel.username || 'Usuario');
        const isOwner = currentUser && reel.user_id === currentUser.id;
        const liked = !!reel.is_liked_by_me;

        card.innerHTML = `
            <div class="reel-video-wrap">
                <video controls playsinline preload="metadata" poster="${reel.thumbnail_url ? mediaUrl(reel.thumbnail_url) : ''}">
                    <source src="${videoUrl}" type="video/mp4">
                </video>
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
                <div class="reel-stats">
                    <span><i class="far fa-eye"></i> ${reel.views_count || 0}</span>
                    <span><i class="far fa-heart"></i> ${reel.likes_count || 0}</span>
                    <span><i class="far fa-comment"></i> ${reel.comments_count || 0}</span>
                </div>
                <div class="reel-actions">
                    <button type="button" class="like-btn ${liked ? 'liked' : ''}" data-liked="${liked}" data-count="${reel.likes_count || 0}">
                        <i class="fas fa-heart"></i> ${liked ? 'Te gusta' : 'Me gusta'}
                    </button>
                    <button type="button" class="comment-toggle-btn"><i class="fas fa-comment"></i> Comentar</button>
                    ${isOwner ? '<button type="button" class="delete-reel-btn"><i class="fas fa-trash"></i> Eliminar</button>' : ''}
                </div>
                <div class="reel-comments" hidden>
                    <div class="comment-list"></div>
                    <form class="reel-comment-form">
                        <input type="text" name="comment" placeholder="Escribe un comentario" maxlength="240" required>
                        <button type="submit">Enviar</button>
                    </form>
                </div>
            </div>`;

        const video = card.querySelector('video');
        video?.addEventListener('play', () => registerView(reel.id), { once: true });

        card.querySelector('.like-btn')?.addEventListener('click', (e) => {
            toggleLike(reel.id, e.currentTarget);
        });

        card.querySelector('.comment-toggle-btn')?.addEventListener('click', () => {
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

        card.querySelector('.delete-reel-btn')?.addEventListener('click', () => {
            deleteReel(reel.id);
        });

        return card;
    }

    async function registerView(reelId) {
        if (!isLoggedIn()) return;
        try {
            await fetch(`${API_URL}/api/reels/${reelId}/view`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });
        } catch (_) {}
    }

    async function toggleLike(reelId, button) {
        if (!isLoggedIn()) return;
        const liked = button.dataset.liked === 'true';
        const count = parseInt(button.dataset.count, 10) || 0;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/like`, {
                method: liked ? 'DELETE' : 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (!res.ok) throw new Error();
            const newLiked = !liked;
            const newCount = newLiked ? count + 1 : Math.max(0, count - 1);
            button.dataset.liked = newLiked ? 'true' : 'false';
            button.dataset.count = newCount;
            button.classList.toggle('liked', newLiked);
            button.innerHTML = `<i class="fas fa-heart"></i> ${newLiked ? 'Te gusta' : 'Me gusta'}`;
        } catch {
            alert('No se pudo actualizar el like');
        }
    }

    async function loadComments(reelId, container) {
        if (!container || container.dataset.loaded === 'true') return;
        container.innerHTML = '<p class="reels-status">Cargando...</p>';
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/comments`, {
                headers: { Authorization: `Bearer ${authToken}` }
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
        if (!isLoggedIn()) return;
        const input = event.currentTarget.querySelector('input[name="comment"]');
        const text = input.value.trim();
        if (!text) return;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}/comment`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment: text })
            });
            if (!res.ok) throw new Error();
            input.value = '';
            const list = card.querySelector('.comment-list');
            list.dataset.loaded = 'false';
            loadComments(reelId, list);
            loadReels();
        } catch {
            alert('No se pudo enviar el comentario');
        }
    }

    async function deleteReel(reelId) {
        if (!confirm('¿Eliminar este reel?')) return;
        try {
            const res = await fetch(`${API_URL}/api/reels/${reelId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Error');
            setStatus(feedStatus, 'Reel eliminado', 'success');
            loadReels();
        } catch (err) {
            alert(err.message || 'No se pudo eliminar');
        }
    }

    if (uploadForm) {
        const categoryInput = document.getElementById('reel-category-fixed');
        if (categoryInput) categoryInput.value = categoryId;

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isLoggedIn()) {
                window.location.href = 'index.html';
                return;
            }

            const formData = new FormData(uploadForm);
            formData.set('category', categoryId);
            if (!formData.get('is_public')) formData.set('is_public', 'false');

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
                if (!res.ok) throw new Error(data.error || 'No se pudo subir el reel');
                setStatus(uploadStatus, 'Reel publicado correctamente', 'success');
                uploadForm.reset();
                const pub = document.getElementById('reel-public');
                if (pub) pub.checked = true;
                loadReelsRetried = false;
                loadReels();
            } catch (err) {
                setStatus(uploadStatus, err.message || 'Error al subir', 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    async function init() {
        renderCategoryNav();
        updateAuthUi();
        if (isLoggedIn()) {
            await ensureSessionUser();
        }
        updateAuthUi();
        await loadReels();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
