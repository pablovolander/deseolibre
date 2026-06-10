/**
 * Lógica compartida para páginas feed-*.html por categoría
 */
(function () {
    let CATEGORY = '';
    let authToken = localStorage.getItem('authToken');

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showMessage(msg, type) {
        const box = document.getElementById('messageBox');
        if (!box) return;
        box.className = type;
        box.textContent = msg;
        setTimeout(() => {
            box.textContent = '';
            box.className = '';
        }, 5000);
    }

    function updateUI() {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        const createBtn = document.getElementById('createBtn');
        if (createBtn) {
            createBtn.style.display = authToken ? 'inline-block' : 'none';
        }
    }

    function renderPostMedia(post, mediaUrl) {
        const type = post.content_type || 'photo';
        const safeTitle = escapeHtml(post.title);

        if (type === 'video') {
            return `<video class="post-image" controls preload="metadata" src="${mediaUrl}" title="${safeTitle}"></video>`;
        }
        if (type === 'audio') {
            return `<div class="post-audio"><i class="fas fa-music"></i><audio controls src="${mediaUrl}"></audio></div>`;
        }
        return `<img src="${mediaUrl}" class="post-image" alt="${safeTitle}" onerror="this.src='https://via.placeholder.com/300x250?text=Imagen+No+Disponible'">`;
    }

    async function loadFeed() {
        const grid = document.getElementById('feedGrid');
        if (!grid) return;

        grid.innerHTML = '<div class="no-posts">Cargando publicaciones...</div>';

        try {
            const url = `${API_URL}/api/content/category/${encodeURIComponent(CATEGORY)}?limit=50&_=${Date.now()}`;
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errInfo = typeof DeseoErrors !== 'undefined'
                    ? DeseoErrors.formatApiError({ status: response.status, message: data.error, data })
                    : { message: data.error || 'Error al cargar publicaciones' };
                grid.innerHTML = `<div class="no-posts">${escapeHtml(errInfo.message)}</div>`;
                return;
            }

            if (!data.posts || data.posts.length === 0) {
                const cta = authToken
                    ? '<button type="button" class="btn" style="margin-top:16px;" onclick="showCreatePost()">Crear la primera publicación</button>'
                    : '<button type="button" class="btn" style="margin-top:16px;" onclick="showLogin()">Iniciar sesión para publicar</button>';
                grid.innerHTML = `<div class="no-posts">
                    <p>No hay publicaciones aún en esta categoría.</p>
                    ${cta}
                </div>`;
                return;
            }

            grid.innerHTML = data.posts.map((post) => {
                const mediaUrl = typeof resolveMediaUrl === 'function'
                    ? resolveMediaUrl(post.media_url || post.file_url || '')
                    : `${API_URL}${post.media_url || post.file_url || ''}`;
                const isPremium = post.is_premium || post.is_premium_user;
                const premiumClass = isPremium ? 'premium' : '';
                const premiumBadge = isPremium
                    ? '<div class="premium-badge"><i class="fas fa-crown"></i> PREMIUM</div>'
                    : '';

                const listing = typeof DeseoListing !== 'undefined' ? DeseoListing : null;
                const proName = listing ? listing.getName(post) : (post.full_name || post.username);
                const proLocation = listing ? listing.getLocation(post) : '';
                const proPrice = listing ? listing.getPrice(post) : 'Consultar';
                const contactHtml = listing
                    ? listing.getMessagingLinksHtml(post, { stopPropagation: true })
                    : '';

                return `
                <div class="post-card ${premiumClass}" onclick="window.location.href='profile.html?user=${post.user_id}'" style="cursor: pointer;">
                    ${premiumBadge}
                    ${renderPostMedia(post, mediaUrl)}
                    <div class="post-content">
                        <div class="post-professional">
                            <strong>${escapeHtml(proName)}</strong>
                            ${post.is_verified ? '<i class="fas fa-check-circle" style="color: #1da1f2;" title="Verificado"></i>' : ''}
                        </div>
                        <div class="post-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(proLocation)}</div>
                        <div class="post-price-row"><span class="post-price">${escapeHtml(proPrice)}</span></div>
                        ${contactHtml}
                        <div class="post-title">${escapeHtml(post.title)}</div>
                        <div class="post-description">${escapeHtml(post.description)}</div>
                        <div class="post-meta">
                            <span><i class="fas fa-heart"></i> ${post.likes_count || 0}</span>
                            <span><i class="fas fa-comment"></i> ${post.comments_count || 0}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading feed:', error);
            grid.innerHTML = '<div class="no-posts">Error de conexión al cargar publicaciones</div>';
        }
    }

    window.initCategoryFeedPage = function (category) {
        CATEGORY = category;
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        updateUI();
        loadFeed();
        if (typeof DeseoAuth !== 'undefined' && authToken) {
            DeseoAuth.verifySession(API_URL).catch(() => {});
        }
    };

    window.showLogin = function () {
        document.getElementById('loginModal')?.classList.add('show');
    };

    window.showRegister = function () {
        sessionStorage.setItem('deseo_open_register', '1');
        window.location.href = 'index.html?register=1';
    };

    async function ensureProfileCompleteForPublish() {
        let user = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getCachedUser() : null;
        if (authToken && (!user || user.profile_complete === undefined)) {
            try {
                user = await DeseoAuth.verifySession(API_URL);
            } catch {
                user = null;
            }
        }
        if (user && user.profile_complete === false) {
            showMessage('Completa tu perfil (servicios, video corporal y datos) en Mi perfil antes de publicar.', 'error');
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1800);
            return false;
        }
        return true;
    }

    window.showCreatePost = async function () {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        if (!authToken) {
            showMessage('Debes iniciar sesión primero', 'error');
            showRegister();
            return;
        }
        if (!(await ensureProfileCompleteForPublish())) {
            return;
        }
        if (typeof DeseoVerification !== 'undefined') {
            const ok = await DeseoVerification.requireVerifiedForPublish('Publicar anuncio');
            if (!ok) return;
        }
        document.getElementById('createPostModal')?.classList.add('show');
        if (typeof DeseoPricing !== 'undefined') {
            DeseoPricing.prefillPublishPhone();
        }
    };

    window.closeModal = function (id) {
        document.getElementById(id)?.classList.remove('show');
    };

    window.login = async function (e) {
        e.preventDefault();
        try {
            const data = await DeseoAuth.authFetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify({
                    email: document.getElementById('loginEmail').value,
                    password: document.getElementById('loginPassword').value
                })
            });
            authToken = data.token;
            DeseoAuth.setSession(data.token, data.user);
            localStorage.setItem('ageVerified', 'true');
            closeModal('loginModal');
            showMessage('Login exitoso', 'success');
            updateUI();
            loadFeed();
        } catch (error) {
            showMessage(error.message || 'Error de conexión', 'error');
        }
    };

    window.register = function (e) {
        e.preventDefault();
        sessionStorage.setItem('deseo_open_register', '1');
        window.location.href = 'index.html?register=1';
    };

    window.createPost = async function (e) {
        e.preventDefault();
        authToken = DeseoAuth.getToken();

        if (!authToken) {
            showMessage('Debes iniciar sesión primero', 'error');
            return;
        }

        const fileInput = document.getElementById('postFile');
        if (!fileInput?.files?.length) {
            showMessage('Selecciona un archivo', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', document.getElementById('postTitle').value.trim());
        formData.append('description', document.getElementById('postDesc').value.trim());
        formData.append('content_type', document.getElementById('postType').value);
        formData.append('category', CATEGORY);
        formData.append('file', fileInput.files[0]);
        formData.append('is_public', 'true');
        formData.append('is_premium', 'false');

        showMessage('Subiendo publicación...', 'success');

        try {
            const data = await DeseoAuth.authFetch(`${API_URL}/api/content`, {
                method: 'POST',
                body: formData
            });

            closeModal('createPostModal');
            document.getElementById('createPostForm')?.reset();
            showMessage('Publicación creada. Aparecerá en este feed en unos segundos.', 'success');
            await new Promise((r) => setTimeout(r, 1500));
            await loadFeed();
        } catch (error) {
            if (typeof DeseoVerification !== 'undefined' && DeseoVerification.handlePublishError(error)) {
                return;
            }
            if (error.data?.requiresProfile) {
                showMessage(error.data.message || 'Completa tu perfil primero', 'error');
                window.location.href = 'profile.html';
                return;
            }
            showMessage(typeof DeseoErrors !== 'undefined' ? DeseoErrors.formatMessage(error) : ('Error: ' + error.message), 'error');
        }
    };
})();
