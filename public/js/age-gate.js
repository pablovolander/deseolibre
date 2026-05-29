/**
 * Verificación de edad: solo en index.html (modal del sitio).
 * Otras páginas redirigen al inicio si aún no confirmaron.
 */
(function (global) {
    const STORAGE_KEY = 'ageVerified';

    function isVerified() {
        return global.localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function markVerified() {
        global.localStorage.setItem(STORAGE_KEY, 'true');
        global.localStorage.setItem('ageVerifiedDate', new Date().toISOString());
    }

    /** En feeds/reels/perfil: si no confirmó edad en el inicio, volver a index. */
    function redirectToHomeIfNeeded() {
        if (isVerified()) {
            return false;
        }
        const page = global.location.pathname.split('/').pop() || 'index.html';
        const qs = global.location.search || '';
        const from = encodeURIComponent(`${page}${qs}`);
        global.location.replace(`index.html?from=${from}`);
        return true;
    }

    function resumeAfterHomeVerification() {
        const params = new URLSearchParams(global.location.search);
        const from = params.get('from');
        if (!from || !isVerified()) {
            return;
        }
        try {
            const target = decodeURIComponent(from);
            if (target && target !== 'index.html' && !target.startsWith('http')) {
                global.location.replace(target);
            }
        } catch (_) {}
    }

    function apiHeaders(extra) {
        return { ...(extra || {}) };
    }

    global.DeseoAgeGate = {
        isVerified,
        markVerified,
        apiHeaders,
        redirectToHomeIfNeeded,
        resumeAfterHomeVerification
    };
})(window);
