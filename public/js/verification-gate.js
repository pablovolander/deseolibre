/**
 * Verificación obligatoria de identidad (estilo Fatal Model)
 */
window.DeseoVerification = (function () {
    const VERIFY_PAGE = 'verificar-identidad.html';

    function getToken() {
        return typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
    }

    async function fetchStatus() {
        const token = getToken();
        if (!token) {
            return { is_verified: false, pending: false, status: 'not_logged_in' };
        }
        const res = await fetch(`${API_URL}/api/verification/status`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'No se pudo cargar el estado de verificación');
        }
        return data;
    }

    async function canPublish() {
        try {
            const s = await fetchStatus();
            return Boolean(s.is_verified);
        } catch {
            return false;
        }
    }

    function redirectToVerify(message) {
        if (message) {
            sessionStorage.setItem('deseo_verify_message', message);
        }
        window.location.href = VERIFY_PAGE;
    }

    async function requireVerifiedForPublish(actionLabel) {
        const token = getToken();
        if (!token) {
            if (typeof showLogin === 'function') showLogin();
            else window.location.href = 'index.html';
            return false;
        }
        try {
            const s = await fetchStatus();
            if (s.is_verified) return true;
            if (s.pending) {
                alert('Tu verificación está en revisión (24-48 h). Te avisaremos cuando puedas publicar.');
                redirectToVerify();
                return false;
            }
            const msg = actionLabel
                ? `${actionLabel}: debes verificar tu identidad primero (como en Fatal Model).`
                : 'Verificación de identidad obligatoria para publicar anuncios.';
            redirectToVerify(msg);
            return false;
        } catch (e) {
            alert(e.message || 'Error al comprobar verificación');
            return false;
        }
    }

    function handlePublishError(error) {
        const data = error?.data || {};
        if (data.requiresVerification || error?.status === 403) {
            redirectToVerify(data.message || error.message || 'Verifica tu identidad para continuar.');
            return true;
        }
        const msg = String(error?.message || error || '');
        if (msg.includes('verif') || msg.includes('Verificación')) {
            redirectToVerify(msg);
            return true;
        }
        return false;
    }

    return {
        VERIFY_PAGE,
        fetchStatus,
        canPublish,
        redirectToVerify,
        requireVerifiedForPublish,
        handlePublishError
    };
})();
