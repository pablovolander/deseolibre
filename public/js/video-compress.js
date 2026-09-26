/**
 * Compresión automática de video en el navegador (estilo Instagram).
 * Si el archivo ya entra en el límite, se devuelve tal cual.
 * Si no, se reencoda a menor resolución/bitrate hasta caber (o el mejor intento).
 */
(function (global) {
    const DEFAULT_MAX_BYTES = 3.8 * 1024 * 1024;
    const DEFAULT_MAX_DURATION_SEC = 45;

    function formatMb(bytes) {
        return (Number(bytes) / (1024 * 1024)).toFixed(1);
    }

    function pickMimeType() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
            return '';
        }
        return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    }

    function extensionForMime(mime) {
        if (String(mime || '').includes('mp4')) return 'mp4';
        return 'webm';
    }

    function fitSize(width, height, maxEdge) {
        const w = width || maxEdge;
        const h = height || maxEdge;
        const longest = Math.max(w, h);
        if (longest <= maxEdge) {
            return { width: Math.round(w), height: Math.round(h) };
        }
        const scale = maxEdge / longest;
        return {
            width: Math.max(2, Math.round(w * scale / 2) * 2),
            height: Math.max(2, Math.round(h * scale / 2) * 2)
        };
    }

    function loadVideoElement(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.src = url;
            video.onloadedmetadata = () => {
                resolve({ video, url, duration: Number(video.duration) || 0 });
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo leer el video'));
            };
        });
    }

    async function measureDuration(file) {
        const { video, url, duration } = await loadVideoElement(file);
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
        return duration;
    }

    function assignFileToInput(input, file) {
        if (!input || !file) return false;
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            return input.files && input.files[0];
        } catch (_) {
            return false;
        }
    }

    function canCompress() {
        return Boolean(
            typeof MediaRecorder !== 'undefined'
            && typeof HTMLCanvasElement !== 'undefined'
            && pickMimeType()
        );
    }

    function encodeWithRecorder(file, pass, options) {
        const mimeType = pickMimeType();
        if (!mimeType) {
            return Promise.reject(new Error('Tu navegador no soporta compresión automática de video.'));
        }

        return loadVideoElement(file).then(({ video, url, duration }) => new Promise((resolve, reject) => {
            const size = fitSize(video.videoWidth, video.videoHeight, pass.maxEdge);
            const canvas = document.createElement('canvas');
            canvas.width = size.width;
            canvas.height = size.height;
            const ctx = canvas.getContext('2d', { alpha: false });

            const targetBits = options.maxBytes * 8 * pass.budgetFactor;
            const audioBitrate = pass.audioBitrate;
            let videoBitsPerSecond = Math.floor(targetBits / Math.max(duration, 1) - audioBitrate);
            videoBitsPerSecond = Math.max(180000, Math.min(videoBitsPerSecond, pass.maxVideoBitrate));

            let stream;
            try {
                const canvasStream = canvas.captureStream(pass.fps);
                let audioTracks = [];
                if (typeof video.captureStream === 'function') {
                    try {
                        audioTracks = video.captureStream().getAudioTracks();
                    } catch (_) {
                        audioTracks = [];
                    }
                }
                stream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
                return;
            }

            const chunks = [];
            let recorder;
            try {
                recorder = new MediaRecorder(stream, {
                    mimeType,
                    videoBitsPerSecond,
                    audioBitsPerSecond: audioBitrate
                });
            } catch (err) {
                stream.getTracks().forEach((t) => t.stop());
                URL.revokeObjectURL(url);
                reject(err);
                return;
            }

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size) chunks.push(e.data);
            };

            recorder.onerror = () => {
                cleanup();
                reject(new Error('Error al comprimir el video'));
            };

            recorder.onstop = () => {
                cleanup();
                const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                const outName = (file.name || 'video').replace(/\.[^.]+$/, '') + '-compact.' + extensionForMime(mimeType);
                const outFile = new File([blob], outName, {
                    type: blob.type || mimeType.split(';')[0],
                    lastModified: Date.now()
                });
                resolve({ file: outFile, duration, width: size.width, height: size.height });
            };

            function cleanup() {
                try {
                    stream.getTracks().forEach((t) => t.stop());
                } catch (_) {}
                URL.revokeObjectURL(url);
                video.removeAttribute('src');
                video.load();
            }

            function drawFrame() {
                if (video.paused || video.ended) return;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                if (typeof options.onProgress === 'function' && duration > 0) {
                    options.onProgress({
                        phase: 'compress',
                        progress: Math.min(0.99, video.currentTime / duration),
                        pass: pass.label
                    });
                }
                requestAnimationFrame(drawFrame);
            }

            video.onended = () => {
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }
            };

            video.currentTime = 0;
            const playPromise = video.play();
            Promise.resolve(playPromise).then(() => {
                recorder.start(250);
                drawFrame();
            }).catch((err) => {
                cleanup();
                reject(err.message ? err : new Error('No se pudo reproducir el video para comprimir'));
            });
        }));
    }

    /**
     * @param {File} file
     * @param {{ maxBytes?: number, maxDurationSec?: number, onProgress?: Function }} options
     */
    async function compressIfNeeded(file, options = {}) {
        if (!file) {
            throw new Error('No hay video');
        }

        const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
        const maxDurationSec = options.maxDurationSec || DEFAULT_MAX_DURATION_SEC;

        if (typeof options.onProgress === 'function') {
            options.onProgress({ phase: 'inspect', progress: 0 });
        }

        const duration = await measureDuration(file);
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error('No se pudo leer la duración del video');
        }
        if (duration > maxDurationSec + 0.5) {
            throw new Error(`El video dura ${duration.toFixed(1)}s. Máximo ${maxDurationSec}s.`);
        }

        if (file.size <= maxBytes) {
            return {
                file,
                compressed: false,
                duration,
                originalBytes: file.size,
                outputBytes: file.size
            };
        }

        if (!canCompress()) {
            throw new Error(
                `Tu video pesa ${formatMb(file.size)} MB (máx. ~${formatMb(maxBytes)} MB) y este navegador no puede comprimirlo automáticamente. Probá Chrome/Safari recientes.`
            );
        }

        if (typeof options.onProgress === 'function') {
            options.onProgress({ phase: 'compress', progress: 0.02 });
        }

        const passes = [
            { label: '720p', maxEdge: 720, fps: 30, audioBitrate: 64000, budgetFactor: 0.88, maxVideoBitrate: 1800000 },
            { label: '540p', maxEdge: 540, fps: 24, audioBitrate: 48000, budgetFactor: 0.72, maxVideoBitrate: 1000000 },
            { label: '480p', maxEdge: 480, fps: 24, audioBitrate: 32000, budgetFactor: 0.58, maxVideoBitrate: 700000 }
        ];

        let best = null;
        for (let i = 0; i < passes.length; i += 1) {
            const pass = passes[i];
            try {
                const encoded = await encodeWithRecorder(file, pass, {
                    maxBytes,
                    onProgress: options.onProgress
                });
                if (!best || encoded.file.size < best.file.size) {
                    best = encoded;
                }
                if (encoded.file.size <= maxBytes) {
                    return {
                        file: encoded.file,
                        compressed: true,
                        duration: encoded.duration || duration,
                        originalBytes: file.size,
                        outputBytes: encoded.file.size,
                        pass: pass.label
                    };
                }
            } catch (err) {
                if (i === passes.length - 1 && !best) {
                    throw err;
                }
            }
        }

        if (best && best.file.size <= maxBytes * 1.05) {
            return {
                file: best.file,
                compressed: true,
                duration: best.duration || duration,
                originalBytes: file.size,
                outputBytes: best.file.size,
                pass: 'best-effort'
            };
        }

        throw new Error(
            `No pudimos bajar el video a ~${formatMb(maxBytes)} MB (quedó en ${formatMb((best && best.file.size) || file.size)} MB). Probá un clip un poco más corto.`
        );
    }

    global.DeseoVideoCompress = {
        compressIfNeeded,
        measureDuration,
        assignFileToInput,
        canCompress,
        formatMb,
        DEFAULT_MAX_BYTES,
        DEFAULT_MAX_DURATION_SEC
    };
})(window);
