/**
 * Feed directorio por categoría (estilo Fatal Model)
 */
(function () {
    let CATEGORY = 'acompañantes-mujeres';
    let PAGE_TITLE = 'Acompañantes';
    let FIXED_GENERO = null;
    let authToken = localStorage.getItem('authToken');
    let activeCiudad = '';

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

    function getCiudadFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return (params.get('ciudad') || '').trim();
    }

    function updateUI() {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        const createBtn = document.getElementById('createBtn');
        if (createBtn) {
            createBtn.style.display = authToken ? 'inline-block' : 'none';
        }
    }

    function renderProfileCard(post) {
        const mediaUrl = typeof resolveMediaUrl === 'function'
            ? resolveMediaUrl(post.media_url || post.file_url || '')
            : `${API_URL}${post.media_url || post.file_url || ''}`;
        const location = post.location || post.user_location || 'Ubicación no indicada';
        const price = post.price && Number(post.price) > 0
            ? `$${Number(post.price).toLocaleString('es')}`
            : 'Consultar';
        const name = post.full_name || post.username || 'Profesional';
        const verified = post.is_verified
            ? '<span class="badge-verified"><i class="fas fa-check-circle"></i> Verificado</span>'
            : '';

        let mediaHtml;
        if (post.content_type === 'video') {
            mediaHtml = `<video src="${mediaUrl}" muted preload="metadata"></video>`;
        } else {
            mediaHtml = `<img src="${mediaUrl}" alt="${escapeHtml(post.title)}" onerror="this.src='https://via.placeholder.com/400x300?text=Sin+foto'">`;
        }

        return `
        <article class="profile-card" onclick="window.location.href='profile.html?user=${post.user_id}'">
            <div class="profile-card-media">
                <div class="profile-badges">${verified}</div>
                ${mediaHtml}
            </div>
            <div class="profile-card-body">
                <h3>${escapeHtml(name)}</h3>
                <div class="profile-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</div>
                <p>${escapeHtml(post.description || post.title)}</p>
                <div class="profile-meta-row">
                    <span class="profile-price">${escapeHtml(price)}</span>
                    <span><i class="fas fa-heart"></i> ${post.likes_count || 0}</span>
                </div>
            </div>
        </article>`;
    }

    async function loadDirectory() {
        const grid = document.getElementById('profileGrid');
        const countEl = document.getElementById('resultsCount');
        if (!grid) return;

        grid.innerHTML = '<div class="directory-empty">Cargando anuncios...</div>';

        const params = new URLSearchParams({
            limit: '60',
            _: String(Date.now())
        });
        if (activeCiudad) {
            params.set('ciudad', activeCiudad);
        }

        try {
            const url = `${API_URL}/api/content/category/${encodeURIComponent(CATEGORY)}?${params}`;
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                grid.innerHTML = `<div class="directory-empty">${escapeHtml(data.error || 'Error al cargar')}</div>`;
                return;
            }

            const posts = data.posts || [];
            if (countEl) {
                const ciudadTxt = activeCiudad ? ` en "${activeCiudad}"` : '';
                countEl.textContent = `${posts.length} anuncio${posts.length !== 1 ? 's' : ''}${ciudadTxt}`;
            }

            if (!posts.length) {
                grid.innerHTML = `<div class="directory-empty">
                    <p>No hay anuncios en esta búsqueda.</p>
                    ${authToken
                        ? '<button type="button" class="directory-search button" style="margin-top:1rem;border:none;" onclick="showCreatePost()">Publicar el primero</button>'
                        : '<button type="button" class="directory-search button" style="margin-top:1rem;border:none;" onclick="showRegister()">Registrarse y publicar</button>'}
                </div>`;
                return;
            }

            grid.innerHTML = posts.map(renderProfileCard).join('');
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<div class="directory-empty">Error de conexión</div>';
        }
    }

    window.initDirectoryFeed = function (options) {
        options = options || {};
        CATEGORY = options.category || document.body.dataset.category || 'acompañantes-mujeres';
        PAGE_TITLE = options.title || document.body.dataset.title || 'Acompañantes';
        FIXED_GENERO = options.fixedGenero || null;

        if (options.heroTitle) {
            const h1 = document.querySelector('.directory-hero h1');
            if (h1) h1.textContent = options.heroTitle;
        }
        if (options.heroText) {
            const p = document.querySelector('.directory-hero > p');
            if (p) p.textContent = options.heroText;
        }

        const toolbar = document.querySelector('.directory-toolbar');
        if (toolbar) toolbar.style.display = 'none';

        const cityInput = document.getElementById('searchCity');
        if (cityInput) {
            const fromUrl = getCiudadFromUrl();
            const saved = localStorage.getItem('deseo_search_city') || '';
            activeCiudad = fromUrl || saved;
            if (activeCiudad) cityInput.value = activeCiudad;
        }

        document.getElementById('searchBtn')?.addEventListener('click', () => {
            activeCiudad = (document.getElementById('searchCity')?.value || '').trim();
            localStorage.setItem('deseo_search_city', activeCiudad);
            const url = new URL(window.location.href);
            if (activeCiudad) url.searchParams.set('ciudad', activeCiudad);
            else url.searchParams.delete('ciudad');
            window.history.replaceState({}, '', url);
            loadDirectory();
        });

        document.getElementById('searchCity')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('searchBtn')?.click();
            }
        });

        updateUI();
        loadDirectory();
        if (typeof DeseoAuth !== 'undefined' && authToken) {
            DeseoAuth.verifySession(API_URL).catch(() => {});
        }
    };

    window.showLogin = function () {
        document.getElementById('loginModal')?.classList.add('show');
    };

    window.showRegister = function () {
        document.getElementById('registerModal')?.classList.add('show');
    };

    window.showCreatePost = async function () {
        if (!authToken) {
            showMessage('Inicia sesión para publicar', 'error');
            return;
        }
        if (typeof DeseoVerification !== 'undefined') {
            const ok = await DeseoVerification.requireVerifiedForPublish('Publicar anuncio');
            if (!ok) return;
        }
        document.getElementById('createPostModal')?.classList.add('show');
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
            showMessage('Sesión iniciada', 'success');
            updateUI();
            loadDirectory();
        } catch (error) {
            showMessage(error.message || 'Error', 'error');
        }
    };

    window.register = async function (e) {
        e.preventDefault();
        try {
            const data = await DeseoAuth.authFetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('regUsername').value,
                    email: document.getElementById('regEmail').value,
                    password: document.getElementById('regPassword').value
                })
            });
            authToken = data.token;
            DeseoAuth.setSession(data.token, data.user);
            localStorage.setItem('ageVerified', 'true');
            closeModal('registerModal');
            showMessage('Cuenta creada', 'success');
            updateUI();
        } catch (error) {
            showMessage(error.message || 'Error', 'error');
        }
    };

    window.createPost = async function (e) {
        e.preventDefault();
        authToken = DeseoAuth.getToken();
        if (!authToken) {
            showMessage('Debes iniciar sesión', 'error');
            return;
        }

        const fileInput = document.getElementById('postFile');
        if (!fileInput?.files?.length) {
            showMessage('Selecciona una foto o video', 'error');
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
        formData.append('price', document.getElementById('postPrice')?.value || '0');

        showMessage('Publicando...', 'success');

        try {
            await DeseoAuth.authFetch(`${API_URL}/api/content`, {
                method: 'POST',
                body: formData
            });
            closeModal('createPostModal');
            document.getElementById('createPostForm')?.reset();
            showMessage('Anuncio publicado', 'success');
            await new Promise((r) => setTimeout(r, 1200));
            loadDirectory();
        } catch (error) {
            if (typeof DeseoVerification !== 'undefined' && DeseoVerification.handlePublishError(error)) {
                return;
            }
            showMessage(error.message || 'Error al publicar', 'error');
        }
    };
})();
