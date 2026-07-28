/**
 * Shell móvil compartido: barra inferior + menú del directorio.
 */
(function (global) {
    const SKIP_PATHS = ['admin-', 'test-server', 'reset-password'];

    function shouldSkip() {
        const path = (global.location.pathname || '').toLowerCase();
        return SKIP_PATHS.some((part) => path.includes(part));
    }

    function currentFile() {
        const path = global.location.pathname || '';
        const file = path.split('/').pop();
        return file || 'index.html';
    }

    function isActiveTab(tab, file) {
        if (tab.match instanceof RegExp) {
            return tab.match.test(file);
        }
        return tab.match.includes(file);
    }

    const TABS = [
        {
            href: 'index.html',
            icon: 'fa-home',
            label: 'Inicio',
            match: ['index.html', 'home.html']
        },
        {
            href: 'feed-mujeres.html',
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
            href: 'reels-mujeres.html',
            icon: 'fa-film',
            label: 'Reels',
            match: /^reels-.*\.html$/
        }
    ];

    function mountBottomNav() {
        if (shouldSkip() || document.querySelector('.dl-bottom-nav')) {
            return;
        }

        const file = currentFile();
        const nav = document.createElement('nav');
        nav.className = 'dl-bottom-nav';
        nav.setAttribute('aria-label', 'Navegación principal');

        TABS.forEach((tab) => {
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
