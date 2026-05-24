/**
 * Comparación facial gratuita en el navegador (selfie vs frame del video).
 * Usa @vladmandic/face-api + TensorFlow.js desde CDN.
 */
window.DeseoFaceMatch = (function () {
    const MODEL_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    const MIN_SCORE = 0.45;
    const MAX_DISTANCE = 0.55;

    let modelsLoaded = false;
    let modelsLoading = null;

    function ensureFaceApi() {
        if (typeof faceapi === 'undefined') {
            throw new Error('Motor de reconocimiento facial no cargado. Recarga la página.');
        }
    }

    async function loadModels() {
        ensureFaceApi();
        if (modelsLoaded) {
            return;
        }
        if (modelsLoading) {
            await modelsLoading;
            return;
        }
        modelsLoading = (async () => {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);
            modelsLoaded = true;
        })();
        await modelsLoading;
    }

    function fileToImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo leer la imagen'));
            };
            img.src = url;
        });
    }

    async function descriptorFromImageFile(file) {
        const img = await fileToImage(file);
        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        if (!detection) {
            throw new Error('No se detectó un rostro claro en la selfie. Usa buena luz y mira a la cámara.');
        }
        return detection.descriptor;
    }

    async function descriptorFromVideoFile(file, seekSec) {
        const url = URL.createObjectURL(file);
        try {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';

            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject(new Error('No se pudo leer el video'));
                video.src = url;
            });

            const targetTime = Math.min(
                Math.max(seekSec, 0.5),
                Math.max(0.5, (video.duration || seekSec) - 0.3)
            );
            video.currentTime = targetTime;
            await new Promise((resolve, reject) => {
                video.onseeked = () => resolve();
                video.onerror = () => reject(new Error('No se pudo analizar un frame del video'));
            });

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const detection = await faceapi
                .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) {
                throw new Error('No se detectó rostro en el video. Muestra tu cara al inicio del video.');
            }
            return detection.descriptor;
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    function compareDescriptors(a, b) {
        const distance = faceapi.euclideanDistance(a, b);
        const score = Math.max(0, Math.min(1, 1 - distance / 0.65));
        return {
            distance,
            score: Number(score.toFixed(3)),
            match: distance <= MAX_DISTANCE && score >= MIN_SCORE
        };
    }

    async function compareSelfieWithVideo(selfieFile, videoFile) {
        await loadModels();
        const [selfieDesc, videoDesc] = await Promise.all([
            descriptorFromImageFile(selfieFile),
            descriptorFromVideoFile(videoFile, 2)
        ]);
        return compareDescriptors(selfieDesc, videoDesc);
    }

    return {
        MIN_SCORE,
        MAX_DISTANCE,
        loadModels,
        compareSelfieWithVideo
    };
})();
