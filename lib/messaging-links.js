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

function getWhatsAppUrl(phone) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) {
        return null;
    }
    return `https://wa.me/${digits}`;
}

function getTelegramUrl(phone) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) {
        return null;
    }
    return `https://t.me/+${digits}`;
}

module.exports = {
    DEFAULT_COUNTRY_CODE,
    normalizePhoneDigits,
    getWhatsAppUrl,
    getTelegramUrl
};
