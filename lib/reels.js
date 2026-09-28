const { VERCEL_MAX_UPLOAD_BYTES } = require('./media-storage');

const MAX_REEL_DURATION_SEC = 45;
const MAX_REEL_UPLOAD_BYTES = VERCEL_MAX_UPLOAD_BYTES;
const LOCAL_REEL_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_REEL_TITLE_LENGTH = 120;
const REEL_VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv', 'wmv', 'm4v'];
const REEL_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const RECENT_REEL_WINDOW_MS = 24 * 60 * 60 * 1000;

function getFileExtension(filename) {
    const match = /\.([a-z0-9]+)$/i.exec(String(filename || ''));
    return match ? match[1].toLowerCase() : '';
}

function isAllowedReelFile(fieldname, filename) {
    const ext = getFileExtension(filename);
    if (fieldname === 'video') return REEL_VIDEO_EXTENSIONS.includes(ext);
    if (fieldname === 'image' || fieldname === 'thumbnail') return REEL_IMAGE_EXTENSIONS.includes(ext);
    return false;
}

/**
 * Picks the uploaded media for a reel: a video wins over an image when both are sent.
 */
function pickReelMedia(files) {
    const first = (field) => (files && Array.isArray(files[field]) ? files[field][0] : null) || null;
    const video = first('video');
    if (video) return { file: video, mediaType: 'video' };
    const image = first('image');
    if (image) return { file: image, mediaType: 'image' };
    return null;
}

function normalizeReelTitle(raw) {
    return String(raw || '').trim().slice(0, MAX_REEL_TITLE_LENGTH);
}

function isRecentReel(createdAt, now = Date.now()) {
    if (!createdAt) return false;
    const raw = String(createdAt);
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
    const time = Date.parse(iso);
    if (Number.isNaN(time)) return false;
    return now - time <= RECENT_REEL_WINDOW_MS;
}

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
    return `El archivo supera ${formatBytesMb(limitBytes)} (límite del servidor). Usa un clip más corto o una foto más liviana.`;
}

module.exports = {
    MAX_REEL_DURATION_SEC,
    MAX_REEL_UPLOAD_BYTES,
    LOCAL_REEL_UPLOAD_BYTES,
    MAX_REEL_TITLE_LENGTH,
    REEL_VIDEO_EXTENSIONS,
    REEL_IMAGE_EXTENSIONS,
    isAllowedReelFile,
    pickReelMedia,
    normalizeReelTitle,
    isRecentReel,
    getReelUploadLimitBytes,
    formatBytesMb,
    parseReelDurationSeconds,
    buildReelTooLargeError
};
