const { validatePhoneRequired, validateServicePrice } = require('./service-pricing');
const { normalizeTelegramUsername } = require('./messaging-links');
const {
    validateCountryCity,
    formatUserLocation,
    getCountryLabel
} = require('./supported-cities');

function validateProfessionalName(fullName) {
    const name = String(fullName || '').trim();
    if (name.length < 2) {
        return { ok: false, error: 'Indica tu nombre profesional (mínimo 2 caracteres)' };
    }
    return { ok: true, full_name: name };
}

function validateUserProfileFields(body) {
    const nameCheck = validateProfessionalName(body.full_name);
    if (!nameCheck.ok) {
        return nameCheck;
    }

    const locCheck = validateCountryCity(body.country, body.city);
    if (!locCheck.ok) {
        return locCheck;
    }

    const phoneCheck = validatePhoneRequired(body.phone);
    if (!phoneCheck.ok) {
        return phoneCheck;
    }

    const telegramCheck = normalizeTelegramUsername(body.telegram_username);
    if (!telegramCheck.ok) {
        return telegramCheck;
    }

    const priceCheck = validateServicePrice(body.service_price, body.service_price_unit);
    if (!priceCheck.ok) {
        return priceCheck;
    }

    return {
        ok: true,
        full_name: nameCheck.full_name,
        country: locCheck.country,
        city: locCheck.city,
        location: formatUserLocation(locCheck.city, locCheck.country),
        phone: phoneCheck.phone,
        telegram_username: telegramCheck.telegram_username,
        service_price: priceCheck.price,
        service_price_unit: priceCheck.price_unit
    };
}

function userHasCompleteProfile(user) {
    if (!user) {
        return false;
    }
    const nameOk = String(user.full_name || '').trim().length >= 2;
    const locOk = Boolean(user.country && user.city);
    const phoneOk = validatePhoneRequired(user.phone).ok;
    const telegramOk = normalizeTelegramUsername(user.telegram_username).ok;
    const priceOk = validateServicePrice(user.service_price, user.service_price_unit).ok;
    return nameOk && locOk && phoneOk && telegramOk && priceOk;
}

function getProfileIncompleteMessage() {
    return 'Completa tu perfil: nombre, ciudad, teléfono, usuario de Telegram y tarifa antes de publicar.';
}

module.exports = {
    validateProfessionalName,
    validateUserProfileFields,
    userHasCompleteProfile,
    getProfileIncompleteMessage,
    getCountryLabel
};
