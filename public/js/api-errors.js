/**
 * Mensajes de error claros para la UI (verificación, sesión, servidor).
 */
window.DeseoErrors = (function () {
    function formatApiError(error) {
        const status = error?.status;
        const data = error?.data || {};
        const serverMsg = data.message || data.error || error?.message || '';

        if (data.requiresVerification || (status === 403 && /verif/i.test(serverMsg))) {
            return {
                type: 'verification',
                title: 'Verificación requerida',
                message: serverMsg || 'Debes verificar tu identidad antes de publicar en el directorio.',
                action: 'verify'
            };
        }

        if (status === 401 || /token|sesión|sesion/i.test(serverMsg)) {
            return {
                type: 'auth',
                title: 'Sesión expirada',
                message: 'Tu sesión ya no es válida. Cierra sesión y vuelve a entrar.',
                action: 'login'
            };
        }

        if (status === 404 && /usuario no encontrado/i.test(serverMsg)) {
            return {
                type: 'auth',
                title: 'Cuenta no sincronizada',
                message: serverMsg || 'Tu sesión no coincide con la base de datos. Vuelve a iniciar sesión.',
                action: 'login'
            };
        }

        if (status === 400) {
            return {
                type: 'validation',
                title: 'Revisa los datos',
                message: serverMsg || 'Algunos datos no son válidos.',
                action: null
            };
        }

        if (status === 500 || status === 503) {
            return {
                type: 'server',
                title: 'Error del servidor',
                message: 'Hubo un problema en el servidor. Espera un momento e intenta de nuevo.',
                action: 'retry'
            };
        }

        if (/error al cargar contenido/i.test(serverMsg)) {
            return {
                type: 'server',
                title: 'No se pudo cargar',
                message: 'No pudimos cargar el contenido. Recarga la página o intenta en unos segundos.',
                action: 'retry'
            };
        }

        return {
            type: 'unknown',
            title: 'Error',
            message: serverMsg || 'Ocurrió un error inesperado.',
            action: null
        };
    }

    function formatMessage(error) {
        return formatApiError(error).message;
    }

    function showMessage(targetEl, error) {
        if (!targetEl) {
            return formatMessage(error);
        }
        const info = formatApiError(error);
        targetEl.className = info.type === 'verification' ? 'error verification-hint' : 'error';
        targetEl.textContent = info.message;
        return info;
    }

    return {
        formatApiError,
        formatMessage,
        showMessage
    };
})();
