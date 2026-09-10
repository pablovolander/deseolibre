/**
 * Shell móvil compartido: barra inferior + menú del directorio.
 * La barra conserva la categoría actual (mujeres / hombres / trans).
 */
(function (global) {
    const SKIP_PATHS = ['admin-', 'test-server', 'reset-password'];
    const CATEGORY_STORAGE_KEY = 'deseo_last_category';
    const DEFAULT_CATEGORY = 'mujeres';
    const CATEGORY_SLUGS = ['mujeres', 'hombres', 'trans'];

    function shouldSkip() {
        const path = (global.location.pathname || '').toLowerCase();
        return SKIP_PATHS.some((part) => path.includes(part));
    }

    function currentFile() {
        const path = global.location.pathname || '';
        const file = path.split('/').pop();
        return file || 'index.html';
    }

    function normalizeCategory(raw) {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) {
            return null;
        }
        if (CATEGORY_SLUGS.includes(value)) {
            return value;
        }
        if (value.includes('hombre')) {
            return 'hombres';
        }
        if (value.includes('trans')) {
            return 'trans';
        }
        if (value.includes('mujer')) {
            return 'mujeres';
        }
        return null;
    }

    function categoryFromFile(file) {
        const match = String(file || '').match(/^(?:feed|reels)-(?:acompañantes-|acompanantes-)?(mujeres|hombres|trans)\.html$/i);
        return match ? normalizeCategory(match[1]) : null;
    }

    function resolveCategory() {
        const body = document.body;
        const fromDataset = normalizeCategory(
            body?.dataset?.category || body?.dataset?.reelsCategory || body?.getAttribute('data-category')
        );
        if (fromDataset) {
            return fromDataset;
        }

        const fromFile = categoryFromFile(currentFile());
        if (fromFile) {
            return fromFile;
        }

        try {
            const stored = normalizeCategory(global.sessionStorage.getItem(CATEGORY_STORAGE_KEY));
            if (stored) {
                return stored;
            }
        } catch (_) {
            // ignore storage errors
        }

        return DEFAULT_CATEGORY;
    }

    function rememberCategory(category) {
        const slug = normalizeCategory(category);
        if (!slug) {
            return;
        }
        try {
            global.sessionStorage.setItem(CATEGORY_STORAGE_KEY, slug);
        } catch (_) {
            // ignore storage errors
        }
    }

    function isActiveTab(tab, file) {
        if (tab.match instanceof RegExp) {
            return tab.match.test(file);
        }
        return tab.match.includes(file);
    }

    function buildTabs(category) {
        const slug = normalizeCategory(category) || DEFAULT_CATEGORY;
        return [
            {
                href: 'index.html',
                icon: 'fa-home',
                label: 'Inicio',
                match: ['index.html', 'home.html']
            },
            {
                href: `feed-${slug}.html`,
                icon: 'fa-th-large',
                label: 'Directorio',
                match: /^feed-.*\.html$/
            },
            {
                href: 'profile.html',
                icon: 'fa-user',
                label: 'Perfil',
                match: ['profile.html']
            },
            {
                href: `reels-${slug}.html`,
                icon: 'fa-film',
                label: 'Reels',
                match: /^reels-.*\.html$/
            }
        ];
    }

    function mountBottomNav() {
        if (shouldSkip() || document.querySelector('.dl-bottom-nav')) {
            return;
        }

        const file = currentFile();
        const category = resolveCategory();
        rememberCategory(category);

        const nav = document.createElement('nav');
        nav.className = 'dl-bottom-nav';
        nav.setAttribute('aria-label', 'Navegación principal');

        buildTabs(category).forEach((tab) => {
            const link = document.createElement('a');
            link.href = tab.href;
            link.innerHTML = `<i class="fas ${tab.icon}" aria-hidden="true"></i><span>${tab.label}</span>`;
            if (isActiveTab(tab, file)) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            }
            nav.appendChild(link);
        });

        document.body.classList.add('dl-mobile-nav');
        document.body.appendChild(nav);
        syncBottomNavWithModals();
    }

    function isAnyModalOpen() {
        if (document.body.classList.contains('modal-open')) {
            return true;
        }
        if (document.body.classList.contains('reels-upload-open')) {
            return true;
        }
        const modals = document.querySelectorAll('.modal, .age-gate-modal, [role="dialog"]');
        for (const modal of modals) {
            if (modal.classList.contains('show') || modal.classList.contains('active')) {
                return true;
            }
            const style = global.getComputedStyle ? global.getComputedStyle(modal) : null;
            if (style && style.display !== 'none' && style.visibility !== 'hidden' && modal.style.display === 'block') {
                return true;
            }
        }
        return false;
    }

    function syncBottomNavWithModals() {
        const nav = document.querySelector('.dl-bottom-nav');
        if (!nav) {
            return;
        }
        const open = isAnyModalOpen();
        nav.classList.toggle('dl-bottom-nav-hidden', open);
        document.body.classList.toggle('dl-modal-hides-nav', open);
    }

    function observeModalsForBottomNav() {
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        const observer = new MutationObserver(() => {
            syncBottomNavWithModals();
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'style'],
            subtree: true,
            childList: true
        });
        document.addEventListener('click', () => {
            global.setTimeout(syncBottomNavWithModals, 0);
        });
    }

    function mountDirectoryMenu() {
        const header = document.querySelector('.directory-page .directory-header-inner');
        const actions = header && header.querySelector('.header-actions');
        if (!header || !actions || header.querySelector('.directory-menu-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'directory-menu-btn';
        btn.setAttribute('aria-label', 'Menú');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="fas fa-bars"></i>';

        const headerEl = header.closest('.directory-header');
        btn.addEventListener('click', () => {
            const open = headerEl.classList.toggle('menu-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.innerHTML = open ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });

        document.addEventListener('click', (event) => {
            if (!headerEl.classList.contains('menu-open')) {
                return;
            }
            if (!headerEl.contains(event.target)) {
                headerEl.classList.remove('menu-open');
                btn.setAttribute('aria-expanded', 'false');
                btn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });

        header.insertBefore(btn, actions);
    }

    function init() {
        mountBottomNav();
        mountDirectoryMenu();
        observeModalsForBottomNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
