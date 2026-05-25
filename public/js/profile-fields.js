/**
 * Ciudad en México y campos de perfil profesional (registro / edición).
 */
window.DeseoProfileFields = (function () {
    const DEFAULT_COUNTRY = 'MX';

    function profileFieldHtml(prefix) {
        const p = prefix || 'reg';
        return `
            <input type="hidden" id="${p}Country" value="MX">
            <div class="form-group">
                <label for="${p}FullName">Nombre profesional *</label>
                <input type="text" id="${p}FullName" required placeholder="Tu nombre artístico o real" minlength="2">
            </div>
            <div class="form-group">
                <label for="${p}City">Ciudad en México *</label>
                <select id="${p}City" required>
                    <option value="">Selecciona tu ciudad</option>
                </select>
            </div>
            <div class="form-group">
                <label for="${p}Phone">Teléfono * (WhatsApp / Telegram)</label>
                <input type="tel" id="${p}Phone" required placeholder="10 dígitos, ej: 55 1234 5678">
                <small>Se usará para abrir WhatsApp y Telegram</small>
            </div>
            <div class="form-group">
                <label for="${p}Price">Tarifa *</label>
                <input type="number" id="${p}Price" step="0.01" min="0.01" required placeholder="Ej: 1500">
            </div>
            <div class="form-group">
                <label for="${p}PriceUnit">Cobro por *</label>
                <select id="${p}PriceUnit" required>
                    <option value="">Selecciona</option>
                    <option value="hour">Por hora</option>
                    <option value="half_hour">Por media hora (30 min)</option>
                </select>
            </div>`;
    }

    async function initLocationPicker(prefix, initial) {
        initial = initial || {};
        const countryEl = document.getElementById(`${prefix}Country`);
        const cityEl = document.getElementById(`${prefix}City`);
        if (!cityEl) {
            return;
        }
        if (countryEl) {
            countryEl.value = DEFAULT_COUNTRY;
        }

        if (typeof DeseoCitySearch === 'undefined') {
            return;
        }

        await DeseoCitySearch.getCities(DEFAULT_COUNTRY);
        const cities = await DeseoCitySearch.getCities(DEFAULT_COUNTRY);
        cityEl.innerHTML =
            '<option value="">Selecciona tu ciudad</option>' +
            cities.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
        if (initial.city) {
            cityEl.value = initial.city;
        }
    }

    function readProfilePayload(prefix) {
        prefix = prefix || 'reg';
        const payload = {
            full_name: document.getElementById(`${prefix}FullName`)?.value?.trim() || '',
            country: document.getElementById(`${prefix}Country`)?.value || DEFAULT_COUNTRY,
            city: document.getElementById(`${prefix}City`)?.value || '',
            phone: document.getElementById(`${prefix}Phone`)?.value?.trim() || '',
            service_price: document.getElementById(`${prefix}Price`)?.value || '',
            service_price_unit: document.getElementById(`${prefix}PriceUnit`)?.value || ''
        };

        if (typeof DeseoPricing !== 'undefined') {
            const phoneCheck = DeseoPricing.validatePhone(payload.phone);
            if (!phoneCheck.ok) {
                return phoneCheck;
            }
            payload.phone = phoneCheck.phone;

            const priceCheck = DeseoPricing.validatePricing(payload.service_price, payload.service_price_unit);
            if (!priceCheck.ok) {
                return priceCheck;
            }
            payload.service_price = priceCheck.price;
            payload.service_price_unit = priceCheck.price_unit;
        }

        if (!payload.full_name || payload.full_name.length < 2) {
            return { ok: false, error: 'Indica tu nombre profesional' };
        }
        if (!payload.city) {
            return { ok: false, error: 'Selecciona una ciudad de México' };
        }

        return { ok: true, ...payload };
    }

    function fillFromUser(prefix, user) {
        if (!user) {
            return;
        }
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null && val !== '') {
                el.value = val;
            }
        };
        set(`${prefix}FullName`, user.full_name);
        set(`${prefix}Phone`, user.phone);
        set(`${prefix}Price`, user.service_price);
        set(`${prefix}PriceUnit`, user.service_price_unit);
        initLocationPicker(prefix, { city: user.city });
    }

    return {
        DEFAULT_COUNTRY,
        profileFieldHtml,
        initLocationPicker,
        readProfilePayload,
        fillFromUser
    };
})();
