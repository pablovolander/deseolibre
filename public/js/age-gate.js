/**
 * Verificación de edad obligatoria (+18) en cualquier página de entrada.
 */
(function (global) {
    const STORAGE_KEY = 'ageVerified';
    let gateVisible = false;
    let onVerifiedCallback = null;

    function isVerified() {
        return global.localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function markVerified() {
        global.localStorage.setItem(STORAGE_KEY, 'true');
        global.localStorage.setItem('ageVerifiedDate', new Date().toISOString());
    }

    function lockPage() {
        global.document.documentElement.classList.add('deseo-age-locked');
    }

    function unlockPage() {
        global.document.documentElement.classList.remove('deseo-age-locked');
    }

    function setGateError(message) {
        const el = global.document.getElementById('deseoAgeGateError');
        if (el) el.textContent = message || '';
    }

    function hideGate() {
        const modal = global.document.getElementById('ageVerificationModal');
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
        }
        gateVisible = false;
        unlockPage();
    }

    function showGate() {
        const modal = ensureGateElement();
        lockPage();
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        gateVisible = true;
        setGateError('');
        const checkbox = global.document.getElementById('ageConfirmation');
        if (checkbox) checkbox.checked = false;
        setTimeout(() => checkbox?.focus(), 100);
    }

    function ensureGateElement() {
        let modal = global.document.getElementById('ageVerificationModal');
        if (modal) {
            modal.classList.add('deseo-age-gate');
            if (!modal.querySelector('#ageConfirmation')) {
                modal.innerHTML = buildPanelHtml();
                bindGateEvents(modal);
            }
            return modal;
        }

        modal = global.document.createElement('div');
        modal.id = 'ageVerificationModal';
        modal.className = 'deseo-age-gate';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'deseoAgeGateTitle');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = buildPanelHtml();
        global.document.body.appendChild(modal);
        bindGateEvents(modal);
        return modal;
    }

    function buildPanelHtml() {
        return `
            <div class="deseo-age-gate-panel">
                <h2 id="deseoAgeGateTitle">Contenido solo para mayores de 18 años</h2>
                <p>Deseo Libre es un directorio para adultos. Debes confirmar tu edad para continuar.</p>
                <p class="deseo-age-gate-error" id="deseoAgeGateError" role="alert"></p>
                <label class="deseo-age-gate-checkbox">
                    <input type="checkbox" id="ageConfirmation">
                    <span>Confirmo que tengo 18 años o más y acepto ver contenido para adultos.</span>
                </label>
                <div class="deseo-age-gate-actions">
                    <button type="button" class="deseo-age-gate-btn deseo-age-gate-btn-primary" id="deseoAgeConfirmBtn">
                        Entrar al sitio
                    </button>
                    <button type="button" class="deseo-age-gate-btn deseo-age-gate-btn-secondary" id="deseoAgeLeaveBtn">
                        No soy mayor de 18 — Salir
                    </button>
                </div>
            </div>`;
    }

    function bindGateEvents(modal) {
        if (modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';

        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        global.document.getElementById('deseoAgeConfirmBtn')?.addEventListener('click', () => {
            confirmAge();
        });

        global.document.getElementById('deseoAgeLeaveBtn')?.addEventListener('click', () => {
            global.location.href = 'https://www.google.com';
        });
    }

    function confirmAge() {
        const checkbox = global.document.getElementById('ageConfirmation');
        if (!checkbox?.checked) {
            setGateError('Debes marcar la casilla para confirmar que eres mayor de 18 años.');
            return { ok: false, error: 'Debes confirmar tu mayoría de edad para continuar' };
        }

        markVerified();
        hideGate();
        resumeAfterHomeVerification();

        const cb = onVerifiedCallback;
        onVerifiedCallback = null;
        if (typeof cb === 'function') {
            cb();
        }

        global.dispatchEvent(new CustomEvent('deseo:age-verified'));
        return { ok: true };
    }

    /**
     * Muestra el gate bloqueante si hace falta. Devuelve true si la página queda bloqueada.
     * @param {Function} [onVerified] se ejecuta tras confirmar (solo si antes no estaba verificado)
     */
    function mountBlockingGate(onVerified) {
        if (isVerified()) {
            if (typeof onVerified === 'function') onVerified();
            resumeAfterHomeVerification();
            return false;
        }
        onVerifiedCallback = typeof onVerified === 'function' ? onVerified : null;
        showGate();
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

    function redirectToHomeIfNeeded() {
        if (isVerified()) {
            return false;
        }
        return mountBlockingGate();
    }

    function apiHeaders(extra) {
        return { ...(extra || {}) };
    }

    function isGateActive() {
        return gateVisible && !isVerified();
    }

    global.document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isGateActive()) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    global.DeseoAgeGate = {
        isVerified,
        markVerified,
        confirmAge,
        mountBlockingGate,
        redirectToHomeIfNeeded,
        resumeAfterHomeVerification,
        apiHeaders,
        isGateActive
    };
})(window);
