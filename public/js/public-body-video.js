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
            video.onloadedmetadata = () => {
                const duration = video.duration || 0;
                URL.revokeObjectURL(url);
                resolve(duration);
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
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

    async function scanVideoForCode(videoFile, expectedCode) {
        const expected = normalizeCode(expectedCode);
        const expectedCompact = expected.replace(/-/g, '');
        if (!expected) {
            return { ok: false, error: 'No hay código de verificación activo' };
        }

        const Tesseract = await loadTesseract();
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: () => {}
        });

        try {
            await worker.setParameters({
                tessedit_char_whitelist: 'DL-23456789ABCDEFGHJKLMNPQRSTUVWXYZdl'
            });

            const ratios = [0.12, 0.28, 0.45, 0.62, 0.78];
            for (const ratio of ratios) {
                const canvas = await captureVideoFrame(videoFile, ratio);
                const { data } = await worker.recognize(canvas);
                const text = normalizeCode(data.text || '');
                const compact = text.replace(/-/g, '');
                if (text.includes(expected) || compact.includes(expectedCompact)) {
                    return { ok: true, detected_code: expected, frame_ratio: ratio };
                }
            }

            return {
                ok: false,
                error:
                    'No se detectó el código en el video. Escríbelo grande en papel o muéstralo en pantalla, con buena luz.'
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
            throw new Error(data.error || data.message || 'No se pudo obtener el código');
        }
        challenge = data;
        return data;
    }

    function getChallenge() {
        return challenge;
    }

    async function uploadPublicVideo({ apiUrl, authToken, videoFile, faceObscured, onProgress }) {
        if (!challenge?.challenge_id) {
            throw new Error('Solicita un código de verificación antes de subir');
        }

        if (onProgress) {
            onProgress('Comprobando duración del video...');
        }
        const duration = await measureVideoDuration(videoFile);
        const min = challenge.min_video_duration_sec || 8;
        const max = challenge.max_video_duration_sec || 60;
        if (duration < min) {
            throw new Error(`El video debe durar al menos ${min} segundos`);
        }
        if (duration > max) {
            throw new Error(`El video no puede superar ${max} segundos`);
        }
        if (videoFile.size > (challenge.max_video_bytes || 4 * 1024 * 1024)) {
            throw new Error('El video supera el tamaño máximo. Comprime el archivo.');
        }

        if (onProgress) {
            onProgress('Buscando el código en el video...');
        }
        const scan = await scanVideoForCode(videoFile, challenge.code);
        if (!scan.ok) {
            throw new Error(scan.error);
        }

        if (onProgress) {
            onProgress('Subiendo video verificado...');
        }

        const formData = new FormData();
        formData.append('body_video', videoFile);
        formData.append('challenge_id', challenge.challenge_id);
        formData.append('detected_code', scan.detected_code);
        formData.append('video_duration_sec', String(duration));
        formData.append('face_obscured', faceObscured ? 'true' : 'false');

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
        uploadPublicVideo,
        normalizeCode
    };
})();
