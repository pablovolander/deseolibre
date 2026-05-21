(function (global) {
    function getApiBaseUrl() {
        const forced = global.__DESEO_API_URL;
        if (forced) {
            return String(forced).replace(/\/$/, '');
        }

        const hostname = global.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }

        return global.location.origin;
    }

    function getApiUrl(path) {
        const base = getApiBaseUrl();
        if (!path) {
            return base;
        }
        return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    function resolveMediaUrl(path) {
        if (!path) {
            return '';
        }
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const base = getApiBaseUrl();
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    global.getApiBaseUrl = getApiBaseUrl;
    global.getApiUrl = getApiUrl;
    global.resolveMediaUrl = resolveMediaUrl;
    global.API_URL = getApiBaseUrl();
})(window);
