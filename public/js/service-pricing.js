/**
 * Validación y formato de teléfono + tarifas (hora / media hora).
 */
window.DeseoPricing = (function () {
    const UNITS = {
        hour: 'Por hora',
        half_hour: 'Por media hora (30 min)'
    };

    function normalizePhone(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function validatePhone(phone) {
        const trimmed = String(phone || '').trim();
        if (normalizePhone(trimmed).length < 8) {
            return { ok: false, error: 'El teléfono es obligatorio (mínimo 8 dígitos)' };
        }
        return { ok: true, phone: trimmed };
    }

    function validatePricing(price, priceUnit) {
        const amount = Number(price);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { ok: false, error: 'Indica el precio de tus servicios (debe ser mayor a 0)' };
        }
        if (!Object.prototype.hasOwnProperty.call(UNITS, priceUnit)) {
            return { ok: false, error: 'Selecciona tarifa por hora o por media hora' };
        }
        return { ok: true, price: amount, price_unit: priceUnit };
    }

    function formatPrice(price, priceUnit) {
        const amount = Number(price);
        if (!Number.isFinite(amount) || amount <= 0) {
            return 'Consultar';
        }
        const formatted = `$${amount.toLocaleString('es')}`;
        if (priceUnit === 'half_hour') {
            return `${formatted} / 30 min`;
        }
        if (priceUnit === 'hour') {
            return `${formatted} / hora`;
        }
        return formatted;
    }

    function readPublishFields(options) {
        options = options || {};
        const phoneEl = document.getElementById(options.phoneId || 'postPhone');
        const priceEl = document.getElementById(options.priceId || 'postPrice');
        const unitEl = document.getElementById(options.unitId || 'postPriceUnit');

        const phoneCheck = validatePhone(phoneEl?.value || '');
        if (!phoneCheck.ok) {
            return phoneCheck;
        }

        const priceCheck = validatePricing(priceEl?.value, unitEl?.value);
        if (!priceCheck.ok) {
            return priceCheck;
        }

        return {
            ok: true,
            phone: phoneCheck.phone,
            price: priceCheck.price,
            price_unit: priceCheck.price_unit
        };
    }

    function prefillPublishPhone(phoneId) {
        const el = document.getElementById(phoneId || 'postPhone');
        if (!el || el.value.trim()) {
            return;
        }
        const user = typeof DeseoAuth !== 'undefined' ? DeseoAuth.getCachedUser() : null;
        if (user?.phone) {
            el.value = user.phone;
        }
    }

    function appendPublishToFormData(formData, options) {
        const fields = readPublishFields(options);
        if (!fields.ok) {
            return fields;
        }
        formData.append('phone', fields.phone);
        formData.append('price', String(fields.price));
        formData.append('price_unit', fields.price_unit);
        return { ok: true };
    }

    return {
        UNITS,
        normalizePhone,
        validatePhone,
        validatePricing,
        formatPrice,
        readPublishFields,
        prefillPublishPhone,
        appendPublishToFormData
    };
})();
