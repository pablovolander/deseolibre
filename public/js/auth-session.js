/**
 * Sesión compartida entre páginas (localStorage)
 */
(function (global) {
    const TOKEN_KEY = 'authToken';
    const USER_KEY = 'currentUser';

    function getToken() {
        return global.localStorage.getItem(TOKEN_KEY);
    }

    function setSession(token, user) {
        if (token) {
            global.localStorage.setItem(TOKEN_KEY, token);
        }
        if (user) {
            global.localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
    }

    function getCachedUser() {
        try {
            const raw = global.localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function clearSession() {
        global.localStorage.removeItem(TOKEN_KEY);
        global.localStorage.removeItem(USER_KEY);
    }

    function authHeaders(extra) {
        const token = getToken();
        const headers = { ...(extra || {}) };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async function authFetch(url, options = {}) {
        const token = getToken();
        const headers = { ...(options.headers || {}) };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });
        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }

        if (!response.ok) {
            const error = new Error(data.error || data.message || 'Error en la solicitud');
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    async function verifySession(apiBase) {
        const token = getToken();
        if (!token) {
            return null;
        }

        const base = apiBase || (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : global.location.origin);
        const data = await authFetch(`${base}/api/auth/verify`);
        if (data.user) {
            setSession(token, data.user);
        }
        return data.user || null;
    }

    function isAuthError(error) {
        return error && (error.status === 401 || error.status === 403);
    }

    global.DeseoAuth = {
        getToken,
        setSession,
        getCachedUser,
        clearSession,
        authHeaders,
        authFetch,
        verifySession,
        isAuthError
    };
})(window);
