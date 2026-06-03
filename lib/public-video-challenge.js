const crypto = require('crypto');

const CHALLENGE_TTL_MS = 20 * 60 * 1000;
const CODE_PREFIX = 'DL-';
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateChallengeCode() {
    let suffix = '';
    for (let i = 0; i < 4; i += 1) {
        const idx = crypto.randomInt(0, CODE_CHARS.length);
        suffix += CODE_CHARS[idx];
    }
    return `${CODE_PREFIX}${suffix}`;
}

function generateChallengeId() {
    return crypto.randomBytes(16).toString('hex');
}

function normalizeChallengeCode(raw) {
    return String(raw || '')
        .toUpperCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9-]/g, '');
}

/** Compara código esperado vs detectado (tolera espacios y guiones). */
function codesMatch(expected, detected) {
    const e = normalizeChallengeCode(expected);
    const d = normalizeChallengeCode(detected);
    if (!e || !d) {
        return false;
    }
    return e === d || e.replace(/-/g, '') === d.replace(/-/g, '');
}

function isChallengeExpired(expiresAt) {
    const ts = new Date(expiresAt || 0).getTime();
    return !Number.isFinite(ts) || ts <= Date.now();
}

module.exports = {
    CHALLENGE_TTL_MS,
    CODE_PREFIX,
    CODE_CHARS,
    generateChallengeCode,
    generateChallengeId,
    normalizeChallengeCode,
    codesMatch,
    isChallengeExpired
};
