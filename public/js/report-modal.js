/**
 * Modal compartido para reportar usuarios o publicaciones.
 */
window.DeseoReport = (function () {
    const REPORT_TYPES = [
        { value: 'inappropriate_content', label: 'Contenido inapropiado' },
        { value: 'harassment', label: 'Acoso' },
        { value: 'spam', label: 'Spam' },
        { value: 'fake_profile', label: 'Perfil falso' },
        { value: 'underage', label: 'Menor de edad' },
        { value: 'other', label: 'Otro' }
    ];

    let modalEl = null;
    let pending = { reported_user_id: null, reported_post_id: null };

    function apiBase() {
        if (typeof getApiBaseUrl === 'function') {
            return getApiBaseUrl();
        }
        return window.location.origin;
    }

    function ensureModal() {
        if (modalEl) {
            return modalEl;
        }

        modalEl = document.createElement('div');
        modalEl.id = 'deseoReportModal';
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('aria-labelledby', 'deseoReportTitle');
        modalEl.style.cssText =
            'display:none;position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.72);align-items:center;justify-content:center;padding:1rem;';

        const options = REPORT_TYPES.map(
            (t) => `<option value="${t.value}">${t.label}</option>`
        ).join('');

        modalEl.innerHTML = `
            <div style="width:100%;max-width:440px;background:#1b202e;color:#fff;border-radius:16px;padding:1.25rem 1.35rem;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px rgba(0,0,0,.45);">
                <h2 id="deseoReportTitle" style="margin:0 0 .35rem;font-size:1.2rem;">Reportar</h2>
                <p id="deseoReportHint" style="margin:0 0 1rem;color:rgba(255,255,255,.65);font-size:.9rem;">Ayúdanos a mantener la comunidad segura.</p>
                <label style="display:block;font-size:.85rem;margin-bottom:.35rem;">Motivo</label>
                <select id="deseoReportType" style="width:100%;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#121622;color:#fff;padding:.55rem .7rem;margin-bottom:.85rem;">
                    ${options}
                </select>
                <label style="display:block;font-size:.85rem;margin-bottom:.35rem;">Descripción</label>
                <textarea id="deseoReportDesc" rows="4" maxlength="800" placeholder="Contanos qué ocurrió..." style="width:100%;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#121622;color:#fff;padding:.7rem;resize:vertical;margin-bottom:.5rem;font:inherit;"></textarea>
                <p id="deseoReportError" style="display:none;color:#ff8fa3;font-size:.85rem;margin:0 0 .75rem;"></p>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
                    <button type="button" id="deseoReportSubmit" style="flex:1;min-height:44px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff6b9d,#6c5ce7);color:#fff;font-weight:700;cursor:pointer;">Enviar reporte</button>
                    <button type="button" id="deseoReportCancel" style="min-height:44px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:transparent;color:#fff;padding:0 1rem;cursor:pointer;">Cancelar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalEl);

        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                close();
            }
        });
        modalEl.querySelector('#deseoReportCancel').addEventListener('click', close);
        modalEl.querySelector('#deseoReportSubmit').addEventListener('click', submit);

        return modalEl;
    }

    function open({ reportedUserId = null, reportedPostId = null, label = '' } = {}) {
        const token = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getToken() : localStorage.getItem('authToken');
        if (!token) {
            window.alert('Inicia sesión para reportar.');
            window.location.href = 'index.html?login=1';
            return;
        }

        pending = {
            reported_user_id: reportedUserId ? Number(reportedUserId) : null,
            reported_post_id: reportedPostId ? Number(reportedPostId) : null
        };

        const el = ensureModal();
        const hint = el.querySelector('#deseoReportHint');
        hint.textContent = label
            ? `Estás reportando: ${label}`
            : 'Ayúdanos a mantener la comunidad segura.';
        el.querySelector('#deseoReportDesc').value = '';
        el.querySelector('#deseoReportError').style.display = 'none';
        el.querySelector('#deseoReportType').selectedIndex = 0;
        el.style.display = 'flex';
    }

    function close() {
        if (modalEl) {
            modalEl.style.display = 'none';
        }
    }

    async function submit() {
        const el = ensureModal();
        const errorEl = el.querySelector('#deseoReportError');
        const type = el.querySelector('#deseoReportType').value;
        const description = el.querySelector('#deseoReportDesc').value.trim();
        const submitBtn = el.querySelector('#deseoReportSubmit');

        errorEl.style.display = 'none';
        if (!description || description.length < 8) {
            errorEl.textContent = 'Escribe una descripción (mínimo 8 caracteres).';
            errorEl.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            const body = {
                report_type: type,
                description,
                reported_user_id: pending.reported_user_id,
                reported_post_id: pending.reported_post_id
            };

            if (typeof DeseoAuth !== 'undefined' && DeseoAuth.authFetch) {
                await DeseoAuth.authFetch(`${apiBase()}/api/reports`, {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
            } else {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${apiBase()}/api/reports`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || data.message || 'No se pudo enviar el reporte');
                }
            }

            close();
            window.alert('Gracias. Tu reporte fue enviado y lo revisará el equipo.');
        } catch (error) {
            errorEl.textContent = error.message || 'No se pudo enviar el reporte';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar reporte';
        }
    }

    return {
        open,
        close,
        REPORT_TYPES
    };
})();
