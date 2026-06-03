const {
    validateUploadedFile,
    MIN_VIDEO_DURATION_SEC,
    MAX_VIDEO_DURATION_SEC
} = require('./auto-verification');
const { codesMatch, normalizeChallengeCode } = require('./public-video-challenge');

function validatePublicBodyVideoUpload({ file, durationSec, detectedCode, expectedCode, isVercel }) {
    const fileCheck = validateUploadedFile(file, { kind: 'video', isVercel });
    if (!fileCheck.ok) {
        return fileCheck;
    }

    const duration = Number(durationSec);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION_SEC) {
        return {
            ok: false,
            error: `El video debe durar al menos ${MIN_VIDEO_DURATION_SEC} segundos`
        };
    }
    if (duration > MAX_VIDEO_DURATION_SEC) {
        return {
            ok: false,
            error: `El video no puede superar ${MAX_VIDEO_DURATION_SEC} segundos`
        };
    }

    const expected = normalizeChallengeCode(expectedCode);
    const detected = normalizeChallengeCode(detectedCode);
    if (!expected) {
        return { ok: false, error: 'Código de verificación inválido o expirado' };
    }
    if (!detected) {
        return {
            ok: false,
            error: 'No se detectó el código en el video. Escríbelo en papel o muéstralo en pantalla.'
        };
    }
    if (!codesMatch(expected, detected)) {
        return {
            ok: false,
            error: 'El código del video no coincide. Graba de nuevo mostrando el código actual.'
        };
    }

    return { ok: true, duration };
}

/** URL del video corporal visible en perfil (nuevo campo o legado). */
function resolvePublicBodyVideoUrl(profile) {
    if (!profile) {
        return null;
    }
    const url = profile.public_body_video_url || profile.body_verification_video_url || '';
    return String(url).trim() || null;
}

function userHasPublicBodyVideo(user) {
    if (!user) {
        return false;
    }
    const url = user.public_body_video_url != null
        ? user.public_body_video_url
        : resolvePublicBodyVideoUrl(user);
    return Boolean(String(url || '').trim());
}

module.exports = {
    validatePublicBodyVideoUpload,
    resolvePublicBodyVideoUrl,
    userHasPublicBodyVideo,
    MIN_VIDEO_DURATION_SEC,
    MAX_VIDEO_DURATION_SEC
};
