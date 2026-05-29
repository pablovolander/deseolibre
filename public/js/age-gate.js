/**
 * Verificación de edad para visitantes (sin registro), estilo Fatal Model.
 * Usa localStorage + cookie + header X-Age-Verified para la API.
 */
(function (global) {
    const STORAGE_KEY = 'ageVerified';
    const COOKIE_NAME = 'deseo_age_verified';
    const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

    function parseCookie(name) {
        const match = global.document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : '';
    }

    function isVerified() {
        return global.localStorage.getItem(STORAGE_KEY) === 'true' || parseCookie(COOKIE_NAME) === '1';
    }

    function markVerified() {
        global.localStorage.setItem(STORAGE_KEY, 'true');
        global.localStorage.setItem('ageVerifiedDate', new Date().toISOString());
        global.document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }

    function apiHeaders(extra) {
        const headers = { ...(extra || {}) };
        if (isVerified()) {
            headers['X-Age-Verified'] = 'true';
        }
        return headers;
    }

    function ensureModalDom() {
        if (global.document.getElementById('deseoAgeGateModal')) {
            return;
        }

        const modal = global.document.createElement('div');
        modal.id = 'deseoAgeGateModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content dl-modal-content">
                <h2>Contenido para adultos</h2>
                <p>Deseo Libre es una plataforma exclusiva para mayores de 18 años. Debes confirmar tu edad para continuar.</p>
                <div class="age-checkbox" style="display:flex;align-items:center;gap:0.75rem;margin:1rem 0;">
                    <input type="checkbox" id="deseoAgeConfirm">
                    <label for="deseoAgeConfirm">Confirmo que soy mayor de 18 años</label>
                </div>
                <div class="modal-buttons" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="button" class="modal-btn modal-btn-primary" id="deseoAgeAccept">Entrar</button>
                    <button type="button" class="modal-btn modal-btn-secondary" id="deseoAgeDecline">Salir</button>
                </div>
            </div>`;
        global.document.body.appendChild(modal);
    }

    function ensure(onReady) {
        if (typeof onReady !== 'function') {
            return Promise.resolve(isVerified());
        }

        if (isVerified()) {
            onReady();
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            ensureModalDom();
            const modal = global.document.getElementById('deseoAgeGateModal');
            const checkbox = global.document.getElementById('deseoAgeConfirm');
            const acceptBtn = global.document.getElementById('deseoAgeAccept');
            const declineBtn = global.document.getElementById('deseoAgeDecline');

            modal.classList.add('show');
            global.document.body.classList.add('modal-open');

            acceptBtn.onclick = async () => {
                if (!checkbox.checked) {
                    global.alert('Debes confirmar que eres mayor de 18 años.');
                    return;
                }
                markVerified();
                if (typeof DeseoAuth !== 'undefined' && DeseoAuth.getToken()) {
                    try {
                        await DeseoAuth.syncAgeVerificationFromLocal(
                            typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : global.location.origin
                        );
                    } catch (_) {}
                }
                modal.classList.remove('show');
                global.document.body.classList.remove('modal-open');
                onReady();
                resolve(true);
            };

            declineBtn.onclick = () => {
                global.location.href = 'https://www.google.com';
                resolve(false);
            };
        });
    }

    global.DeseoAgeGate = {
        isVerified,
        markVerified,
        apiHeaders,
        ensure
    };
})(window);
