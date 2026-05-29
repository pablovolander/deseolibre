/**
 * Registro + verificación de identidad en un solo flujo (wizard).
 */
(function (global) {
    let currentStep = 1;
    const TOTAL_STEPS = 4;
    let limits = { min_video_duration_sec: 8, max_video_duration_sec: 60, max_video_bytes: 4194304 };
    let measuredVideoDuration = 0;
    let faceMatchResult = null;
    let faceLibsPromise = null;

    function $(id) {
        return global.document.getElementById(id);
    }

    function setStatus(message, type) {
        const el = $('regWizardStatus');
        if (!el) return;
        el.textContent = message || '';
        el.className = 'reg-wizard-status' + (type ? ` ${type}` : '');
    }

    function showStep(step) {
        currentStep = step;
        global.document.querySelectorAll('.reg-wizard-step-panel').forEach((panel) => {
            panel.classList.toggle('active', Number(panel.dataset.step) === step);
        });
        global.document.querySelectorAll('.reg-wizard-progress-item').forEach((item) => {
            const n = Number(item.dataset.step);
            item.classList.toggle('active', n === step);
            item.classList.toggle('done', n < step);
        });
        const prevBtn = $('regWizardPrev');
        const nextBtn = $('regWizardNext');
        const submitBtn = $('regWizardSubmit');
        if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        if (nextBtn) nextBtn.style.display = step < TOTAL_STEPS ? 'inline-flex' : 'none';
        if (submitBtn) submitBtn.style.display = step === TOTAL_STEPS ? 'inline-flex' : 'none';
        setStatus('');
        if (step === 4) {
            loadFaceLibs().catch(() => {});
        }
    }

    function loadFaceLibs() {
        if (faceLibsPromise) return faceLibsPromise;
        faceLibsPromise = new Promise((resolve, reject) => {
            if (typeof faceapi !== 'undefined' && typeof DeseoFaceMatch !== 'undefined') {
                resolve();
                return;
            }
            const scripts = [
                'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
                'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js'
            ];
            let i = 0;
            function loadNext() {
                if (i >= scripts.length) {
                    if (typeof DeseoFaceMatch !== 'undefined') resolve();
                    else reject(new Error('Face match no cargado'));
                    return;
                }
                const s = global.document.createElement('script');
                s.src = scripts[i++];
                s.onload = loadNext;
                s.onerror = () => reject(new Error('No se pudo cargar el motor facial'));
                global.document.head.appendChild(s);
            }
            loadNext();
        });
        return faceLibsPromise;
    }

    async function loadLimits() {
        try {
            const res = await fetch(`${API_URL}/api/verification/limits`);
            if (res.ok) {
                limits = await res.json();
                const minEl = $('regMinDurLabel');
                const maxEl = $('regMaxDurLabel');
                const hint = $('regVideoSizeHint');
                if (minEl) minEl.textContent = limits.min_video_duration_sec;
                if (maxEl) maxEl.textContent = limits.max_video_duration_sec;
                if (hint) {
                    const mb = (limits.max_video_bytes / (1024 * 1024)).toFixed(1);
                    hint.textContent = `Tamaño máximo del video: ~${mb} MB.`;
                }
            }
        } catch (_) {}
    }

    function validateStep(step) {
        if (step === 1) {
            const username = ($('registerUsername')?.value || '').trim();
            const email = ($('registerEmail')?.value || '').trim();
            const password = $('registerPassword')?.value || '';
            if (username.length < 3) return 'Usuario: mínimo 3 caracteres.';
            if (!email.includes('@')) return 'Email inválido.';
            if (password.length < 6) return 'Contraseña: mínimo 6 caracteres.';
            return null;
        }
        if (step === 2) {
            if (typeof DeseoProfileFields === 'undefined') return 'Campos de perfil no disponibles.';
            const payload = DeseoProfileFields.readProfilePayload('reg');
            return payload.ok ? null : payload.error;
        }
        if (step === 3) {
            const vType = $('regVerificationType')?.value;
            const idFront = $('regIdFront')?.files?.[0];
            const selfie = $('regSelfie')?.files?.[0];
            const country = $('regVerifyCountry')?.value;
            if (!country) return 'Selecciona tu país.';
            if (!vType) return 'Selecciona el tipo de documento.';
            if (!idFront) return 'Sube el frente del documento.';
            if (!selfie) return 'Sube la selfie con el documento.';
            if (vType !== 'passport' && !($('regIdBack')?.files?.[0])) {
                return 'Sube el reverso del documento.';
            }
            return null;
        }
        if (step === 4) {
            const video = $('regBodyVideo')?.files?.[0];
            if (!video) return 'El video corporal es obligatorio.';
            if (video.size > limits.max_video_bytes) {
                return 'El video supera el tamaño máximo. Comprime el archivo.';
            }
            if (measuredVideoDuration < limits.min_video_duration_sec) {
                return `El video debe durar al menos ${limits.min_video_duration_sec} segundos.`;
            }
            if (measuredVideoDuration > limits.max_video_duration_sec) {
                return `El video no puede superar ${limits.max_video_duration_sec} segundos.`;
            }
            if (!faceMatchResult?.match) return 'Completa la comparación facial (selfie vs video).';
            return null;
        }
        return null;
    }

    function onVerificationTypeChange() {
        const isPassport = $('regVerificationType')?.value === 'passport';
        const row = $('regIdBackRow');
        const back = $('regIdBack');
        if (row) row.style.display = isPassport ? 'none' : 'block';
        if (back) back.required = !isPassport;
    }

    function measureVideoFile(file) {
        measuredVideoDuration = 0;
        faceMatchResult = null;
        const label = $('regVideoDurationLabel');
        const matchLabel = $('regFaceMatchLabel');
        if (matchLabel) matchLabel.textContent = '';
        if (!file || !label) return;
        if (file.size > limits.max_video_bytes) {
            label.textContent = 'El video supera el tamaño máximo.';
            label.style.color = '#ff8a9b';
            return;
        }
        const url = URL.createObjectURL(file);
        const video = global.document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            measuredVideoDuration = video.duration || 0;
            const min = limits.min_video_duration_sec;
            const max = limits.max_video_duration_sec;
            if (measuredVideoDuration < min) {
                label.textContent = `Duración: ${measuredVideoDuration.toFixed(1)}s — mínimo ${min}s`;
                label.style.color = '#ff8a9b';
            } else if (measuredVideoDuration > max) {
                label.textContent = `Duración: ${measuredVideoDuration.toFixed(1)}s — máximo ${max}s`;
                label.style.color = '#ff8a9b';
            } else {
                label.textContent = `Duración OK: ${measuredVideoDuration.toFixed(1)}s`;
                label.style.color = '#7dffa8';
            }
        };
        video.onerror = () => {
            label.textContent = 'No se pudo leer el video. Usa MP4.';
            label.style.color = '#ff8a9b';
        };
        video.src = url;
    }

    async function runFaceMatch() {
        const selfieFile = $('regSelfie')?.files?.[0];
        const videoFile = $('regBodyVideo')?.files?.[0];
        const label = $('regFaceMatchLabel');
        const btn = $('regFaceMatchBtn');
        if (!selfieFile || !videoFile) {
            if (label) {
                label.style.color = '#ff8a9b';
                label.textContent = 'Completa la selfie (paso 3) y el video antes de comparar.';
            }
            return null;
        }
        try {
            await loadFaceLibs();
        } catch (err) {
            if (label) label.textContent = err.message;
            return null;
        }
        if (btn) btn.disabled = true;
        if (label) {
            label.style.color = 'rgba(255,255,255,0.75)';
            label.textContent = 'Analizando rostros...';
        }
        try {
            const result = await DeseoFaceMatch.compareSelfieWithVideo(selfieFile, videoFile);
            faceMatchResult = result;
            if (label) {
                if (result.match) {
                    label.style.color = '#7dffa8';
                    label.textContent = `Coincidencia OK (${Math.round(result.score * 100)}%).`;
                } else {
                    label.style.color = '#ff8a9b';
                    label.textContent = `Rostro no coincide (${Math.round(result.score * 100)}%). Graba de nuevo.`;
                }
            }
            return result;
        } catch (err) {
            faceMatchResult = null;
            if (label) {
                label.style.color = '#ff8a9b';
                label.textContent = err.message || 'Error en comparación facial';
            }
            return null;
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function submitComplete(onSuccess, onError) {
        const err = validateStep(4) || validateStep(3) || validateStep(2) || validateStep(1);
        if (err) {
            onError(err);
            return;
        }
        let match = faceMatchResult;
        if (!match?.match) {
            match = await runFaceMatch();
            if (!match?.match) {
                onError('Debes completar la comparación facial antes de registrarte.');
                return;
            }
        }

        const profilePayload = DeseoProfileFields.readProfilePayload('reg');
        const submitBtn = $('regWizardSubmit');
        if (submitBtn) submitBtn.disabled = true;
        setStatus('Creando cuenta y verificando identidad...', 'info');

        try {
            const regRes = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: $('registerUsername').value.trim(),
                    email: $('registerEmail').value.trim(),
                    password: $('registerPassword').value,
                    full_name: profilePayload.full_name,
                    country: profilePayload.country,
                    city: profilePayload.city,
                    zone: profilePayload.zone,
                    zone_detail: profilePayload.zone_detail,
                    phone: profilePayload.phone,
                    telegram_username: profilePayload.telegram_username,
                    service_price: profilePayload.service_price,
                    service_price_unit: profilePayload.service_price_unit
                })
            });
            const regData = await regRes.json().catch(() => ({}));
            if (!regRes.ok) {
                throw new Error(regData.error || 'Error al registrar');
            }

            const token = regData.token;
            const fd = new FormData();
            fd.append('verification_type', $('regVerificationType').value);
            fd.append('country', $('regVerifyCountry').value);
            fd.append('additional_info', ($('regVerifyNotes')?.value || '').trim());
            fd.append('body_video_duration_sec', String(measuredVideoDuration));
            fd.append('face_match_score', String(match.score));
            fd.append('id_front', $('regIdFront').files[0]);
            if ($('regIdBack')?.files?.[0]) fd.append('id_back', $('regIdBack').files[0]);
            fd.append('selfie', $('regSelfie').files[0]);
            fd.append('body_video', $('regBodyVideo').files[0]);

            const verifyRes = await fetch(`${API_URL}/api/verification/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });
            const verifyData = await verifyRes.json().catch(() => ({}));

            if (typeof DeseoAuth !== 'undefined') {
                DeseoAuth.setSession(token, {
                    ...regData.user,
                    is_verified: verifyRes.ok ? 1 : regData.user?.is_verified
                });
            }
            if (typeof DeseoAgeGate !== 'undefined') {
                DeseoAgeGate.markVerified();
            } else {
                global.localStorage.setItem('ageVerified', 'true');
            }

            if (!verifyRes.ok) {
                onError(
                    verifyData.error ||
                        'Cuenta creada, pero falló la verificación. Inicia sesión y completa en Verificar identidad.'
                );
                if (onSuccess) {
                    onSuccess({ ...regData, verificationFailed: true, token });
                }
                return;
            }

            if (onSuccess) {
                onSuccess({
                    ...regData,
                    user: { ...regData.user, is_verified: 1 },
                    verificationFailed: false
                });
            }
        } catch (e) {
            onError(e.message || 'Error en el registro');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            setStatus('');
        }
    }

    function reset() {
        currentStep = 1;
        measuredVideoDuration = 0;
        faceMatchResult = null;
        $('registerForm')?.reset();
        onVerificationTypeChange();
        showStep(1);
    }

    function bindEvents() {
        $('regWizardNext')?.addEventListener('click', () => {
            const err = validateStep(currentStep);
            if (err) {
                setStatus(err, 'error');
                return;
            }
            showStep(currentStep + 1);
        });
        $('regWizardPrev')?.addEventListener('click', () => {
            if (currentStep > 1) showStep(currentStep - 1);
        });
        $('regVerificationType')?.addEventListener('change', onVerificationTypeChange);
        $('regSelfie')?.addEventListener('change', () => {
            faceMatchResult = null;
        });
        $('regBodyVideo')?.addEventListener('change', function () {
            measureVideoFile(this.files?.[0]);
        });
        $('regFaceMatchBtn')?.addEventListener('click', runFaceMatch);
        $('registerForm')?.addEventListener('submit', (e) => e.preventDefault());
    }

    function open() {
        reset();
        loadLimits();
    }

    global.DeseoRegisterWizard = {
        open,
        reset,
        showStep,
        submitComplete,
        TOTAL_STEPS
    };

    global.document.addEventListener('DOMContentLoaded', () => {
        bindEvents();
        onVerificationTypeChange();
    });
})(window);
