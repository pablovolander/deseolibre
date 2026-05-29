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
        if (global.DeseoAgeGate && global.DeseoAgeGate.isVerified()) {
            headers['X-Age-Verified'] = 'true';
        }
        return headers;
    }

    async function authFetch(url, options = {}) {
        const token = getToken();
        const headers = { ...(options.headers || {}) };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        if (global.DeseoAgeGate && global.DeseoAgeGate.isVerified()) {
            headers['X-Age-Verified'] = 'true';
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

    async function syncAgeVerificationFromLocal(apiBase) {
        const token = getToken();
        if (!token || global.localStorage.getItem('ageVerified') !== 'true') {
            return false;
        }

        const base = apiBase || (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : global.location.origin);
        try {
            await authFetch(`${base}/api/auth/verify-age`, {
                method: 'POST',
                body: JSON.stringify({ confirmed: true })
            });
            const user = getCachedUser();
            if (user) {
                user.age_verified = true;
                setSession(token, user);
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    async function verifySession(apiBase) {
        const token = getToken();
        if (!token) {
            return null;
        }

        const base = apiBase || (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : global.location.origin);
        try {
            const data = await authFetch(`${base}/api/auth/verify`);
            if (data.user) {
                setSession(token, data.user);
                if (!data.user.age_verified) {
                    await syncAgeVerificationFromLocal(base);
                    if (getCachedUser()?.age_verified) {
                        return getCachedUser();
                    }
                }
            }
            return data.user || null;
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                clearSession();
            }
            throw error;
        }
    }

    function isAuthError(error) {
        return error && (error.status === 401 || error.status === 403);
    }

    function isInvalidTokenResponse(status, data) {
        if (status === 401) {
            return true;
        }
        if (status !== 403 || !data) {
            return false;
        }
        if (data.requires_age_verification || data.ban_reason) {
            return false;
        }
        const msg = String(data.error || '').toLowerCase();
        return msg.includes('token') || msg.includes('acceso requerido');
    }

    global.DeseoAuth = {
        getToken,
        setSession,
        getCachedUser,
        clearSession,
        authHeaders,
        authFetch,
        verifySession,
        syncAgeVerificationFromLocal,
        isAuthError,
        isInvalidTokenResponse
    };
})(window);
