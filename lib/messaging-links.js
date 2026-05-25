const DEFAULT_COUNTRY_CODE = '52';

function normalizePhoneDigits(phone, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) {
        return '';
    }
    if (digits.length === 10) {
        digits = `${defaultCountryCode}${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
        if (digits.length === 10) {
            digits = `${defaultCountryCode}${digits}`;
        }
    }
    return digits;
}

function normalizeTelegramUsername(raw) {
    const username = String(raw || '').trim().replace(/^@+/, '');
    if (!username) {
        return { ok: false, error: 'Indica tu usuario de Telegram (sin @)' };
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) {
        return {
            ok: false,
            error: 'Usuario de Telegram inválido: 5-32 caracteres, letras, números y _ (sin @)'
        };
    }
    return { ok: true, telegram_username: username };
}

function getWhatsAppUrl(phone) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) {
        return null;
    }
    return `https://wa.me/${digits}`;
}

function getTelegramUrl(phone, telegramUsername) {
    const userCheck = telegramUsername
        ? normalizeTelegramUsername(telegramUsername)
        : { ok: false };
    if (userCheck.ok) {
        return `https://t.me/${userCheck.telegram_username}`;
    }
    const digits = normalizePhoneDigits(phone);
    if (!digits) {
        return null;
    }
    return `https://t.me/+${digits}`;
}

module.exports = {
    DEFAULT_COUNTRY_CODE,
    normalizePhoneDigits,
    normalizeTelegramUsername,
    getWhatsAppUrl,
    getTelegramUrl
};
