const { VERCEL_MAX_UPLOAD_BYTES } = require('./media-storage');

const MAX_REEL_DURATION_SEC = 60;
const MAX_REEL_UPLOAD_BYTES = VERCEL_MAX_UPLOAD_BYTES;
const LOCAL_REEL_UPLOAD_BYTES = 50 * 1024 * 1024;

function getReelUploadLimitBytes(isServerless) {
    return isServerless ? MAX_REEL_UPLOAD_BYTES : LOCAL_REEL_UPLOAD_BYTES;
}

function formatBytesMb(bytes) {
    return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

function parseReelDurationSeconds(raw) {
    if (raw === undefined || raw === null || raw === '') {
        return { ok: true, value: null };
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return { ok: false, error: 'Duración inválida' };
    }
    if (parsed > MAX_REEL_DURATION_SEC) {
        return {
            ok: false,
            error: `El reel no puede durar más de ${MAX_REEL_DURATION_SEC} segundos`
        };
    }
    return { ok: true, value: parsed };
}

function buildReelTooLargeError(limitBytes = MAX_REEL_UPLOAD_BYTES) {
    return `El video supera ${formatBytesMb(limitBytes)} (límite del servidor). Usa un clip más corto o comprímelo antes de subir.`;
}

module.exports = {
    MAX_REEL_DURATION_SEC,
    MAX_REEL_UPLOAD_BYTES,
    LOCAL_REEL_UPLOAD_BYTES,
    getReelUploadLimitBytes,
    formatBytesMb,
    parseReelDurationSeconds,
    buildReelTooLargeError
};
