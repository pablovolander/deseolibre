const { validatePhoneRequired, validateServicePrice } = require('./service-pricing');
const { normalizeTelegramUsername } = require('./messaging-links');
const {
    validateCountryCityZone,
    formatUserLocation,
    getCountryLabel
} = require('./supported-locations');

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

    const locCheck = validateCountryCityZone(
        body.country,
        body.city,
        body.zone,
        body.zone_detail
    );
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
        zone: locCheck.zone,
        zone_detail: locCheck.zone_detail,
        location: locCheck.location,
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
    const locOk = Boolean(user.country && user.city && user.zone);
    const phoneOk = validatePhoneRequired(user.phone).ok;
    const telegramOk = normalizeTelegramUsername(user.telegram_username).ok;
    const priceOk = validateServicePrice(user.service_price, user.service_price_unit).ok;
    if (!locOk) {
        return false;
    }
    const { isOtherZone, validateZoneDetail } = require('./supported-locations');
    if (isOtherZone(user.zone)) {
        const detailCheck = validateZoneDetail(user.zone, user.zone_detail);
        if (!detailCheck.ok) {
            return false;
        }
    }
    return nameOk && phoneOk && telegramOk && priceOk;
}

function getProfileIncompleteMessage() {
    return 'Completa tu perfil: nombre, ciudad, zona, teléfono, Telegram y tarifa antes de publicar.';
}

module.exports = {
    validateProfessionalName,
    validateUserProfileFields,
    userHasCompleteProfile,
    getProfileIncompleteMessage,
    getCountryLabel
};
