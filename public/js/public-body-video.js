/**
 * Video corporal público con código en vivo (OCR en navegador).
 */
window.DeseoPublicBodyVideo = (function () {
    let challenge = null;
    let tesseractPromise = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                if (existing.dataset.loaded === '1') {
                    resolve();
                }
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error('No se pudo cargar el motor de lectura de código'));
            document.head.appendChild(script);
        });
    }

    async function loadTesseract() {
        if (window.Tesseract) {
            return window.Tesseract;
        }
        if (!tesseractPromise) {
            tesseractPromise = loadScript(
                'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
            ).then(() => window.Tesseract);
        }
        return tesseractPromise;
    }

    function normalizeCode(raw) {
        return String(raw || '')
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[^A-Z0-9-]/g, '');
    }

    function measureVideoDuration(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');

            let settled = false;
            const cleanup = () => {
                try {
                    URL.revokeObjectURL(url);
                } catch (_) {}
                try {
                    video.removeAttribute('src');
                    video.load();
                } catch (_) {}
            };

            const finish = (duration) => {
                if (settled) return;
                settled = true;
                cleanup();
                if (!Number.isFinite(duration) || duration <= 0) {
                    reject(new Error('No se pudo leer la duración del video. Probá grabar de nuevo en MP4.'));
                    return;
                }
                resolve(duration);
            };

            video.onloadedmetadata = () => {
                if (Number.isFinite(video.duration) && video.duration > 0 && video.duration !== Infinity) {
                    finish(video.duration);
                    return;
                }

                // En Android a veces duration = Infinity hasta forzar un seek
                const onDurationChange = () => {
                    if (Number.isFinite(video.duration) && video.duration > 0 && video.duration < 1e6) {
                        video.removeEventListener('durationchange', onDurationChange);
                        finish(video.duration);
                    }
                };
                video.addEventListener('durationchange', onDurationChange);

                try {
                    video.currentTime = 1e101;
                } catch (_) {}

                setTimeout(() => {
                    if (settled) return;
                    if (video.seekable && video.seekable.length > 0) {
                        finish(video.seekable.end(video.seekable.length - 1));
                        return;
                    }
                    if (Number.isFinite(video.duration) && video.duration > 0 && video.duration < 1e6) {
                        finish(video.duration);
                        return;
                    }
                    finish(NaN);
                }, 1800);
            };

            video.onerror = () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error('No se pudo leer la duración del video'));
            };

            video.src = url;
        });
    }

    function captureVideoFrame(videoFile, seekRatio) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(videoFile);
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                const duration = video.duration || 0;
                const target = Math.min(
                    Math.max(duration * seekRatio, 0.5),
                    Math.max(0.5, duration - 0.2)
                );
                video.currentTime = target;
            };

            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    resolve(canvas);
                } catch (err) {
                    URL.revokeObjectURL(url);
                    reject(err);
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo analizar el video'));
            };

            video.src = url;
        });
    }

    function preprocessForOcr(sourceCanvas) {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, (sourceCanvas.width || 640) * scale);
        canvas.height = Math.max(2, (sourceCanvas.height || 480) * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const contrast = gray > 140 ? 255 : 0;
            data[i] = contrast;
            data[i + 1] = contrast;
            data[i + 2] = contrast;
        }
        ctx.putImageData(image, 0, 0);
        return canvas;
    }

    function textLooksLikeCode(text, expected, expectedCompact) {
        const normalized = normalizeCode(text);
        const compact = normalized.replace(/-/g, '');
        if (normalized.includes(expected) || compact.includes(expectedCompact)) {
            return true;
        }
        // OCR a menudo confunde caracteres cercanos
        const fuzzy = compact
            .replace(/O/g, '0')
            .replace(/I/g, '1')
            .replace(/Z/g, '2');
        const expectedFuzzy = expectedCompact
            .replace(/O/g, '0')
            .replace(/I/g, '1');
        return fuzzy.includes(expectedFuzzy);
    }

    async function recognizeOnCanvas(worker, canvas, expected, expectedCompact) {
        const variants = [canvas, preprocessForOcr(canvas)];
        for (const variant of variants) {
            const { data } = await worker.recognize(variant);
            if (textLooksLikeCode(data.text || '', expected, expectedCompact)) {
                return true;
            }
        }
        return false;
    }

    async function scanImageForCode(imageFile, expectedCode) {
        const expected = normalizeCode(expectedCode);
        const expectedCompact = expected.replace(/-/g, '');
        if (!expected) {
            return { ok: false, error: 'No hay código de verificación activo' };
        }

        const url = URL.createObjectURL(imageFile);
        const Tesseract = await loadTesseract();
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
        try {
            await worker.setParameters({
                tessedit_char_whitelist: 'DL-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZdl'
            });
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('No se pudo leer la foto del código'));
                el.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 640;
            canvas.height = img.naturalHeight || img.height || 480;
            canvas.getContext('2d').drawImage(img, 0, 0);
            const ok = await recognizeOnCanvas(worker, canvas, expected, expectedCompact);
            if (ok) {
                return { ok: true, detected_code: expected };
            }
            return {
                ok: false,
                error: 'No se leyó el código en la foto. Escribilo más grande o ingresalo abajo.'
            };
        } finally {
            URL.revokeObjectURL(url);
            await worker.terminate();
        }
    }

    async function scanVideoForCode(videoFile, expectedCode) {
        const expected = normalizeCode(expectedCode);
        const expectedCompact = expected.replace(/-/g, '');
        if (!expected) {
            return { ok: false, error: 'No hay código de verificación activo' };
        }

        const Tesseract = await loadTesseract();
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
        try {
            await worker.setParameters({
                tessedit_char_whitelist: 'DL-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZdl'
            });
            const ratios = [0.1, 0.25, 0.4, 0.55, 0.7];
            for (const ratio of ratios) {
                try {
                    const canvas = await captureVideoFrame(videoFile, ratio);
                    const ok = await recognizeOnCanvas(worker, canvas, expected, expectedCompact);
                    if (ok) {
                        return { ok: true, detected_code: expected, frame_ratio: ratio };
                    }
                } catch (_) {
                    // siguiente frame
                }
            }
            return {
                ok: false,
                error: 'No se detectó el código en el video. Usá una foto clara del papel con el código.'
            };
        } finally {
            await worker.terminate();
        }
    }

    async function fetchChallenge(apiUrl, authToken) {
        const res = await fetch(`${apiUrl}/api/user/public-body-video/challenge`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const error = new Error(data.error || data.message || 'No se pudo obtener el código');
            error.status = res.status;
            error.data = data;
            throw error;
        }
        challenge = data;
        return data;
    }

    function getChallenge() {
        return challenge;
    }

    async function uploadPublicVideo({
        apiUrl,
        authToken,
        videoFile,
        codeImageFile,
        typedCode,
        onProgress
    }) {
        if (!challenge?.challenge_id) {
            throw new Error('Solicita un código de verificación antes de subir');
        }

        const file = videoFile;
        const maxDur = challenge.max_video_duration_sec || 45;
        const min = challenge.min_video_duration_sec || 8;
        const expected = normalizeCode(challenge.code);

        if (onProgress) {
            onProgress('Comprobando duración del video...');
        }
        const duration = await measureVideoDuration(file);
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error('No se pudo leer la duración del video. Probá grabar de nuevo en MP4.');
        }
        if (duration < min) {
            throw new Error(`El video debe durar al menos ${min} segundos (ahora: ${duration.toFixed(1)}s)`);
        }
        if (duration > maxDur + 0.75) {
            throw new Error(`El video dura ${duration.toFixed(1)}s. Máximo ${maxDur}s.`);
        }

        let detectedCode = '';
        const typed = normalizeCode(typedCode);
        if (typed) {
            const typedOk =
                typed === expected || typed.replace(/-/g, '') === expected.replace(/-/g, '');
            if (!typedOk) {
                throw new Error(
                    `El código escrito no coincide. Debe ser exactamente ${expected}.`
                );
            }
            detectedCode = expected;
        } else if (codeImageFile) {
            if (onProgress) onProgress('Leyendo el código en la foto...');
            const photoScan = await scanImageForCode(codeImageFile, challenge.code);
            if (photoScan.ok) {
                detectedCode = photoScan.detected_code;
            }
        }

        if (!detectedCode) {
            if (onProgress) onProgress('Buscando el código en el video...');
            const scan = await scanVideoForCode(file, challenge.code);
            if (scan.ok) {
                detectedCode = scan.detected_code;
            }
        }

        if (!detectedCode) {
            throw new Error(
                'No pudimos validar el código. Tomá una foto nítida del papel con el código, o escribilo en el campo de confirmación.'
            );
        }

        let bodyVideoUrl = '';
        if (typeof DeseoBlobUpload !== 'undefined' && DeseoBlobUpload.uploadFile) {
            if (onProgress) onProgress('Subiendo video a la nube...');
            const uploaded = await DeseoBlobUpload.uploadFile(file, {
                authToken,
                folder: 'uploads/public-body',
                onProgress: ({ progress }) => {
                    if (onProgress) {
                        onProgress(`Subiendo video… ${Math.round((progress || 0) * 100)}%`);
                    }
                }
            });
            bodyVideoUrl = uploaded.url;
        }

        if (onProgress) {
            onProgress(bodyVideoUrl ? 'Confirmando verificación...' : 'Subiendo video verificado...');
        }

        const formData = new FormData();
        if (bodyVideoUrl) {
            formData.append('body_video_url', bodyVideoUrl);
        } else {
            formData.append('body_video', file);
        }
        formData.append('challenge_id', challenge.challenge_id);
        formData.append('detected_code', detectedCode);
        formData.append('video_duration_sec', String(duration));
        formData.append('face_obscured', 'false');

        const res = await fetch(`${apiUrl}/api/user/public-body-video`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.message || 'Error al subir el video');
        }

        challenge = null;
        return data;
    }

    return {
        fetchChallenge,
        getChallenge,
        measureVideoDuration,
        scanVideoForCode,
        scanImageForCode,
        uploadPublicVideo,
        normalizeCode
    };
})();
