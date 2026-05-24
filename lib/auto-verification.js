const MIN_IMAGE_BYTES = 12 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIN_VIDEO_BYTES = 150 * 1024;
const MAX_VIDEO_BYTES_DEFAULT = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES_VERCEL = 4 * 1024 * 1024;
const MIN_VIDEO_DURATION_SEC = 8;
const MAX_VIDEO_DURATION_SEC = 60;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);

const VALID_DOC_TYPES = new Set(['id_card', 'passport', 'driver_license']);
const VALID_COUNTRIES = new Set(['MX', 'CO', 'AR']);

function getMaxVideoBytes(isVercel) {
    return isVercel ? MAX_VIDEO_BYTES_VERCEL : MAX_VIDEO_BYTES_DEFAULT;
}

function validateUploadedFile(file, { kind, isVercel }) {
    if (!file) {
        return { ok: false, error: kind === 'video' ? 'Video corporal requerido' : 'Archivo requerido' };
    }
    const mimes = kind === 'video' ? VIDEO_MIMES : IMAGE_MIMES;
    if (!mimes.has(String(file.mimetype || '').toLowerCase())) {
        return { ok: false, error: `Formato inválido (${file.originalname || kind})` };
    }
    const size = file.size || (file.buffer && file.buffer.length) || 0;
    const minB = kind === 'video' ? MIN_VIDEO_BYTES : MIN_IMAGE_BYTES;
    const maxB = kind === 'video' ? getMaxVideoBytes(isVercel) : MAX_IMAGE_BYTES;
    if (size < minB) {
        return { ok: false, error: kind === 'video' ? 'El video es demasiado corto o está vacío' : 'La imagen es demasiado pequeña' };
    }
    if (size > maxB) {
        const mb = Math.round(maxB / (1024 * 1024));
        return { ok: false, error: `Archivo muy grande (máx. ~${mb} MB)` };
    }
    return { ok: true };
}

const MIN_FACE_MATCH_SCORE = 0.35;

function validateFaceMatchScore(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) {
        return {
            ok: false,
            error: 'Completa la comparación facial (selfie vs video) antes de enviar.'
        };
    }
    if (value < MIN_FACE_MATCH_SCORE) {
        return {
            ok: false,
            error: 'El rostro del video no coincide con la selfie. Graba de nuevo con tu rostro visible al inicio.'
        };
    }
    return { ok: true, score: value };
}

function evaluateAutoVerification(payload) {
    const {
        verification_type,
        country,
        id_front,
        id_back,
        selfie,
        body_video,
        body_video_duration_sec,
        face_match_score,
        isVercel
    } = payload;

    if (!VALID_DOC_TYPES.has(verification_type)) {
        return { approved: false, reason: 'Tipo de documento inválido' };
    }
    if (!VALID_COUNTRIES.has(country)) {
        return { approved: false, reason: 'Selecciona México, Colombia o Argentina' };
    }

    const checks = [
        validateUploadedFile(id_front, { kind: 'image', isVercel }),
        validateUploadedFile(selfie, { kind: 'image', isVercel }),
        validateUploadedFile(body_video, { kind: 'video', isVercel })
    ];
    if (verification_type !== 'passport') {
        checks.push(validateUploadedFile(id_back, { kind: 'image', isVercel }));
    }

    for (const c of checks) {
        if (!c.ok) {
            return { approved: false, reason: c.error };
        }
    }

    const duration = Number(body_video_duration_sec);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION_SEC) {
        return {
            approved: false,
            reason: `El video corporal debe durar al menos ${MIN_VIDEO_DURATION_SEC} segundos`
        };
    }
    if (duration > MAX_VIDEO_DURATION_SEC) {
        return {
            approved: false,
            reason: `El video corporal no puede superar ${MAX_VIDEO_DURATION_SEC} segundos`
        };
    }

    const faceCheck = validateFaceMatchScore(face_match_score);
    if (!faceCheck.ok) {
        return { approved: false, reason: faceCheck.error };
    }

    return {
        approved: true,
        method: 'auto_rules_v1',
        checks_passed: [
            'country',
            'document_type',
            'id_front',
            verification_type !== 'passport' ? 'id_back' : 'passport_single_side',
            'selfie_with_id',
            'body_video_present',
            'body_video_duration',
            'file_sizes_and_mimes',
            'face_match_browser',
            `face_match_score_${faceCheck.score}`
        ]
    };
}

module.exports = {
    evaluateAutoVerification,
    validateUploadedFile,
    validateFaceMatchScore,
    MIN_FACE_MATCH_SCORE,
    MIN_VIDEO_DURATION_SEC,
    MAX_VIDEO_DURATION_SEC,
    getMaxVideoBytes
};
