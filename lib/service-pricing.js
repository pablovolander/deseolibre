const VALID_PRICE_UNITS = new Set(['hour', 'half_hour']);

const PRICE_UNIT_LABELS = {
    hour: 'hora',
    half_hour: '30 min'
};

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function validatePhoneRequired(phone) {
    const trimmed = String(phone || '').trim();
    const digits = normalizePhone(trimmed);
    if (digits.length < 8) {
        return { ok: false, error: 'El teléfono es obligatorio (mínimo 8 dígitos)' };
    }
    return { ok: true, phone: trimmed };
}

function validateServicePrice(price, priceUnit) {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'Indica el precio de tus servicios (debe ser mayor a 0)' };
    }
    const unit = String(priceUnit || '').trim();
    if (!VALID_PRICE_UNITS.has(unit)) {
        return { ok: false, error: 'Selecciona si el precio es por hora o por media hora' };
    }
    return { ok: true, price: amount, price_unit: unit };
}

function formatServicePrice(price, priceUnit, locale = 'es') {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
        return 'Consultar';
    }
    const formatted = `$${amount.toLocaleString(locale)}`;
    if (priceUnit === 'half_hour') {
        return `${formatted} / 30 min`;
    }
    if (priceUnit === 'hour') {
        return `${formatted} / hora`;
    }
    return formatted;
}

module.exports = {
    VALID_PRICE_UNITS,
    PRICE_UNIT_LABELS,
    normalizePhone,
    validatePhoneRequired,
    validateServicePrice,
    formatServicePrice
};
