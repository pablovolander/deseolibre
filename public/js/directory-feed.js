/**
 * Feed directorio por categoría (estilo Fatal Model)
 */
(function () {
    let CATEGORY = 'acompañantes-mujeres';
    let PAGE_TITLE = 'Acompañantes';
    let FIXED_GENERO = null;
    let authToken = localStorage.getItem('authToken');
    let activeCiudad = '';
    let activeZona = '';
    let activeServicio = '';
    let citySearchApi = null;

    const CATEGORY_PAGES = {
        'acompañantes-mujeres': 'feed-mujeres.html',
        'acompañantes-hombres': 'feed-hombres.html',
        'acompañantes-trans': 'feed-trans.html'
    };

    const LEGACY_CATEGORY = {
        acompañantes: 'acompañantes-mujeres'
    };

    function resolveUserCategory(category) {
        const raw = String(category || '').trim();
        if (!raw) {
            return '';
        }
        return LEGACY_CATEGORY[raw] || raw;
    }

    function setActiveServicio(serviceId) {
        activeServicio = serviceId || '';
        const select = document.getElementById('searchService');
        if (select) {
            select.value = activeServicio;
        }
        document.querySelectorAll('#popularServices .service-filter-chip').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.serviceId === activeServicio);
        });
        const url = new URL(window.location.href);
        if (activeServicio) {
            url.searchParams.set('servicio', activeServicio);
        } else {
            url.searchParams.delete('servicio');
            url.searchParams.delete('service');
        }
        window.history.replaceState({}, '', url);
    }

    async function mountServiceFilter() {
        const select = document.getElementById('searchService');
        const chips = document.getElementById('popularServices');
        if (!select || typeof DeseoServiceCatalog === 'undefined') {
            return;
        }

        try {
            const catalog = await DeseoServiceCatalog.fetchCatalog(CATEGORY);
            select.innerHTML = DeseoServiceCatalog.renderFilterSelectHtml(catalog, activeServicio);
            if (chips) {
                chips.innerHTML = DeseoServiceCatalog.renderPopularFilterChips(
                    catalog,
                    'modality',
                    activeServicio,
                    6
                );
                chips.querySelectorAll('.service-filter-chip').forEach((chip) => {
                    chip.addEventListener('click', () => {
                        setActiveServicio(chip.dataset.serviceId || '');
                        loadDirectory();
                    });
                });
            }
        } catch (error) {
            console.warn('No se pudo cargar filtro de servicios:', error.message);
        }
    }

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

    async function ensureCanPublishInCategory() {
        let user = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getCachedUser() : null;
        if (!user && typeof DeseoAuth !== 'undefined' && authToken) {
            try {
                // verifySession ya devuelve el objeto user (o null)
                user = await DeseoAuth.verifySession(API_URL);
            } catch {
                user = null;
            }
        }

        const userCat = resolveUserCategory(user?.category);
        if (userCat && userCat !== CATEGORY) {
            const target = CATEGORY_PAGES[userCat] || 'profile.html';
            showMessage('Tu perfil pertenece a otra categoría. Usa el directorio correcto para publicar.', 'error');
            if (target.endsWith('.html')) {
                setTimeout(() => {
                    window.location.href = target;
                }, 1800);
            }
            return false;
        }
        return true;
    }

    function setActiveCity(cityName) {
        activeCiudad = cityName || '';
        const cityInput = document.getElementById('searchCity');
        if (cityInput) {
            cityInput.value = activeCiudad;
        }
        localStorage.setItem('deseo_search_city', activeCiudad);
        const url = new URL(window.location.href);
        if (activeCiudad) {
            url.searchParams.set('ciudad', activeCiudad);
        } else {
            url.searchParams.delete('ciudad');
            url.searchParams.delete('zona');
        }
        if (!activeCiudad) {
            setActiveZone('');
        }
        window.history.replaceState({}, '', url);
    }

    function setActiveZone(zoneName) {
        activeZona = zoneName || '';
        const zoneSelect = document.getElementById('searchZone');
        if (zoneSelect) {
            zoneSelect.value = activeZona;
        }
        localStorage.setItem('deseo_search_zone', activeZona);
        const url = new URL(window.location.href);
        if (activeZona) {
            url.searchParams.set('zona', activeZona);
        } else {
            url.searchParams.delete('zona');
        }
        window.history.replaceState({}, '', url);
    }

    async function refreshZoneUiForCity(cityName, selectedZone) {
        const zoneSelect = document.getElementById('searchZone');
        const chips = document.getElementById('popularZones');
        if (typeof DeseoLocationSearch === 'undefined') {
            return;
        }
        await DeseoLocationSearch.fillZoneSelect(zoneSelect, cityName, selectedZone || '');
        if (chips && cityName) {
            await DeseoLocationSearch.fetchZones(cityName);
            DeseoLocationSearch.renderZoneChips(chips, cityName, (zone) => {
                setActiveZone(zone);
                loadDirectory();
            });
        } else if (chips) {
            chips.innerHTML = '';
        }
    }

    async function performCitySearch() {
        const raw = (document.getElementById('searchCity')?.value || '').trim();
        if (!raw) {
            setActiveCity('');
            setActiveZone('');
            await refreshZoneUiForCity('', '');
            loadDirectory();
            return;
        }
        if (typeof DeseoLocationSearch !== 'undefined') {
            await DeseoLocationSearch.getCities('MX');
        }
        if (typeof DeseoCitySearch !== 'undefined') {
            if (DeseoCitySearch.ensureLoaded) {
                await DeseoCitySearch.ensureLoaded('MX');
            } else {
                await DeseoCitySearch.getCities('MX');
            }
            const resolved = DeseoCitySearch.resolveLocal(raw);
            if (!resolved.ok) {
                showMessage(resolved.error, 'error');
                return;
            }
            setActiveCity(resolved.city);
            await refreshZoneUiForCity(resolved.city, '');
            setActiveZone('');
        } else {
            setActiveCity(raw);
            await refreshZoneUiForCity(raw, '');
            setActiveZone('');
        }
        loadDirectory();
    }

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

    function getZonaFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return (params.get('zona') || '').trim();
    }

    function getServicioFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return (params.get('servicio') || params.get('service') || '').trim();
    }

    function updateUI() {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        const createBtn = document.getElementById('createBtn');
        if (createBtn) {
            createBtn.style.display = authToken ? 'inline-block' : 'none';
        }
    }

    function dedupePostsByUser(posts) {
        const map = new Map();
        (posts || []).forEach((post) => {
            if (!post || post.user_id == null) return;
            const uid = String(post.user_id);
            const existing = map.get(uid);
            if (!existing) {
                map.set(uid, post);
                return;
            }
            const ta = new Date(existing.created_at || 0).getTime();
            const tb = new Date(post.created_at || 0).getTime();
            if (tb >= ta) map.set(uid, post);
        });
        return [...map.values()].sort((a, b) => {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }

    function renderProfileCard(post) {
        const listing = typeof DeseoListing !== 'undefined' ? DeseoListing : null;
        const name = listing ? listing.getName(post) : (post.full_name || post.username || 'Profesional');
        const cardImagePath = listing
            ? listing.getDirectoryCardImage(post)
            : (post.profile_picture || post.media_url || post.file_url || '');
        const imageUrl = cardImagePath
            ? (typeof resolveMediaUrl === 'function'
                ? resolveMediaUrl(cardImagePath)
                : (cardImagePath.startsWith('http') ? cardImagePath : `${API_URL}${cardImagePath}`))
            : 'https://via.placeholder.com/400x300?text=Sin+foto';
        const location = listing ? listing.getLocation(post) : (post.location || 'Ubicación no indicada');
        const price = listing ? listing.getPrice(post) : 'Consultar';
        const contactHtml = listing
            ? listing.getMessagingLinksHtml(post, { stopPropagation: true })
            : '';
        const servicesHtml = listing ? listing.getServiceChipsHtml(post, { max: 3 }) : '';
        const verified = post.is_verified
            ? '<span class="badge-verified"><i class="fas fa-check-circle"></i> Verificado</span>'
            : '';

        const mediaHtml = `<img src="${imageUrl}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Sin+foto'">`;

        return `
        <article class="profile-card" onclick="window.location.href='profile.html?user=${post.user_id}'">
            <div class="profile-card-media">
                <div class="profile-badges">${verified}</div>
                ${mediaHtml}
            </div>
            <div class="profile-card-body">
                <h3>${escapeHtml(name)}</h3>
                <div class="profile-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</div>
                ${servicesHtml}
                <div class="profile-price-block">
                    <span class="profile-price">${escapeHtml(price)}</span>
                </div>
                <div class="profile-contact-row">${contactHtml}</div>
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
        if (activeZona) {
            params.set('zona', activeZona);
        }
        if (activeServicio) {
            params.set('servicio', activeServicio);
        }

        try {
            const url = `${API_URL}/api/content/category/${encodeURIComponent(CATEGORY)}?${params}`;
            const headers = typeof DeseoAuth !== 'undefined' ? DeseoAuth.authHeaders() : {};
            const response = await fetch(url, { cache: 'no-store', headers });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errInfo = typeof DeseoErrors !== 'undefined'
                    ? DeseoErrors.formatApiError({ status: response.status, message: data.error, data })
                    : { message: data.error || 'Error al cargar' };
                if (response.status === 400) {
                    showMessage(errInfo.message, 'error');
                }
                grid.innerHTML = `<div class="directory-empty">${escapeHtml(errInfo.message)}</div>`;
                return;
            }

            const posts = dedupePostsByUser(data.posts || []);
            if (countEl) {
                let placeTxt = '';
                if (activeZona) {
                    placeTxt = ` en ${activeZona}`;
                } else if (activeCiudad) {
                    placeTxt = ` en ${activeCiudad}`;
                }
                countEl.textContent = `${posts.length} perfil${posts.length !== 1 ? 'es' : ''}${placeTxt}`;
            }

            if (!posts.length) {
                grid.innerHTML = `<div class="directory-empty">
                    <p>No hay perfiles en esta búsqueda.</p>
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
        const zoneSelect = document.getElementById('searchZone');
        if (cityInput) {
            const fromUrl = getCiudadFromUrl();
            const saved = localStorage.getItem('deseo_search_city') || '';
            activeCiudad = fromUrl || saved;
            if (activeCiudad) {
                cityInput.value = activeCiudad;
            }
        }
        activeZona = getZonaFromUrl() || localStorage.getItem('deseo_search_zone') || '';
        activeServicio = getServicioFromUrl() || '';

        if (typeof DeseoLocationSearch !== 'undefined') {
            DeseoLocationSearch.getCities('MX').then(() => {
                if (typeof DeseoCitySearch !== 'undefined') {
                    return DeseoCitySearch.bindInput({
                        inputId: 'searchCity',
                        datalistId: 'citiesDatalist',
                        countrySelectId: 'searchCountry',
                        popularContainerId: 'popularCities',
                        onSearch: async (city) => {
                            setActiveCity(city);
                            setActiveZone('');
                            await refreshZoneUiForCity(city, '');
                            loadDirectory();
                        }
                    });
                }
            }).then((api) => {
                citySearchApi = api;
                if (activeCiudad) {
                    refreshZoneUiForCity(activeCiudad, activeZona).then(() => loadDirectory());
                }
            }).catch(() => { });
        } else if (typeof DeseoCitySearch !== 'undefined') {
            DeseoCitySearch.bindInput({
                inputId: 'searchCity',
                datalistId: 'citiesDatalist',
                countrySelectId: 'searchCountry',
                popularContainerId: 'popularCities',
                onSearch: (city) => {
                    setActiveCity(city);
                    loadDirectory();
                }
            }).then((api) => {
                citySearchApi = api;
            }).catch(() => { });
        }

        zoneSelect?.addEventListener('change', () => {
            setActiveZone(zoneSelect.value);
            loadDirectory();
        });

        document.getElementById('searchService')?.addEventListener('change', (event) => {
            setActiveServicio(event.target.value);
            loadDirectory();
        });

        mountServiceFilter().then(() => {
            if (activeServicio) {
                setActiveServicio(activeServicio);
            }
        }).catch(() => { });

        document.getElementById('searchBtn')?.addEventListener('click', () => {
            performCitySearch();
        });

        document.getElementById('searchCity')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performCitySearch();
            }
        });

        if (typeof DeseoAgeGate !== 'undefined' && DeseoAgeGate.mountBlockingGate(function () {
            updateUI();
            loadDirectory();
            if (typeof DeseoAuth !== 'undefined' && authToken) {
                DeseoAuth.verifySession(API_URL).catch(function () { });
            }
        })) {
            return;
        }

        updateUI();
        loadDirectory();
        if (typeof DeseoAuth !== 'undefined' && authToken) {
            DeseoAuth.verifySession(API_URL).catch(function () { });
        }
    };

    window.showLogin = function () {
        document.getElementById('loginModal')?.classList.add('show');
    };

    window.showRegister = function () {
        sessionStorage.setItem('deseo_open_register', '1');
        sessionStorage.setItem('deseo_register_category', CATEGORY);
        const params = new URLSearchParams({ register: '1', category: CATEGORY });
        window.location.href = `index.html?${params}`;
    };

    window.showCreatePost = async function () {
        authToken = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        if (!authToken) {
            showMessage('Inicia sesión para publicar', 'error');
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
        if (!(await ensureCanPublishInCategory())) {
            return;
        }
        document.getElementById('createPostModal')?.classList.add('show');
        if (typeof DeseoPricing !== 'undefined') {
            DeseoPricing.prefillPublishPhone();
        }
        if (typeof DeseoUploadMobile !== 'undefined') {
            DeseoUploadMobile.initAll(document.getElementById('createPostModal'));
        }
    };

    window.publishFromCategory = async function (event) {
        if (event) event.preventDefault();
        await showCreatePost();
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
            if (typeof DeseoAgeGate !== 'undefined') {
                DeseoAgeGate.markVerified();
            } else {
                localStorage.setItem('ageVerified', 'true');
            }
            closeModal('loginModal');
            showMessage('Sesión iniciada', 'success');
            updateUI();
            loadDirectory();
        } catch (error) {
            showMessage(error.message || 'Error', 'error');
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
            if (error.status === 403 && (error.data?.message || error.data?.error)) {
                showMessage(error.data.message || error.data.error, 'error');
                return;
            }
            if (error.data?.requiresProfile) {
                showMessage(error.data.message || 'Completa tu perfil primero', 'error');
                window.location.href = 'profile.html';
                return;
            }
            showMessage(typeof DeseoErrors !== 'undefined' ? DeseoErrors.formatMessage(error) : (error.message || 'Error al publicar'), 'error');
        }
    };
})();
