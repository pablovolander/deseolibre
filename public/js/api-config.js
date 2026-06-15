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

    function shouldProxyUploadsToBlob() {
        const hostname = global.location.hostname;
        return hostname !== 'localhost' && hostname !== '127.0.0.1';
    }

    function blobUrlToMediaProxy(path) {
        try {
            const url = new URL(path);
            const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
            if (pathname.startsWith('uploads/')) {
                const encoded = pathname.split('/').map((part) => encodeURIComponent(part)).join('/');
                return getApiUrl(`/api/media/${encoded}`);
            }
        } catch {
            return path;
        }
        return path;
    }

    function resolveMediaUrl(path) {
        if (!path) {
            return '';
        }
        if (path.startsWith('http://') || path.startsWith('https://')) {
            if (path.includes('.private.blob.vercel-storage.com/') || path.includes('.public.blob.vercel-storage.com/')) {
                return blobUrlToMediaProxy(path);
            }
            return path;
        }
        if (path.startsWith('/api/media/')) {
            return getApiUrl(path);
        }
        if (shouldProxyUploadsToBlob()) {
            const normalized = path.replace(/\\/g, '/');
            if (normalized.startsWith('/uploads/')) {
                const encoded = normalized.slice(1).split('/').map((part) => encodeURIComponent(part)).join('/');
                return getApiUrl(`/api/media/${encoded}`);
            }
            if (normalized.startsWith('uploads/')) {
                const encoded = normalized.split('/').map((part) => encodeURIComponent(part)).join('/');
                return getApiUrl(`/api/media/${encoded}`);
            }
        }
        const base = getApiBaseUrl();
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    global.getApiBaseUrl = getApiBaseUrl;
    global.getApiUrl = getApiUrl;
    global.resolveMediaUrl = resolveMediaUrl;
    global.API_URL = getApiBaseUrl();
})(window);
