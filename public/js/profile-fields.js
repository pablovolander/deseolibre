/**
 * País → ciudad y campos de perfil profesional (registro / edición).
 */
window.DeseoProfileFields = (function () {
    const COUNTRIES = [
        { code: 'MX', label: 'México' },
        { code: 'CO', label: 'Colombia' },
        { code: 'AR', label: 'Argentina' }
    ];

    function profileFieldHtml(prefix) {
        const p = prefix || 'reg';
        return `
            <div class="form-group">
                <label for="${p}FullName">Nombre profesional *</label>
                <input type="text" id="${p}FullName" required placeholder="Tu nombre artístico o real" minlength="2">
            </div>
            <div class="form-group">
                <label for="${p}Country">País *</label>
                <select id="${p}Country" required>
                    <option value="">Selecciona país</option>
                    ${COUNTRIES.map((c) => `<option value="${c.code}">${c.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="${p}City">Ciudad *</label>
                <select id="${p}City" required disabled>
                    <option value="">Primero elige el país</option>
                </select>
            </div>
            <div class="form-group">
                <label for="${p}Phone">Teléfono *</label>
                <input type="tel" id="${p}Phone" required placeholder="+52 555 123 4567">
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
        if (!countryEl || !cityEl) {
            return;
        }

        if (typeof DeseoCitySearch === 'undefined') {
            return;
        }

        await DeseoCitySearch.getCities();

        function fillCities() {
            const code = countryEl.value;
            if (!code) {
                cityEl.innerHTML = '<option value="">Primero elige el país</option>';
                cityEl.disabled = true;
                return;
            }
            DeseoCitySearch.getCities(code).then((cities) => {
                cityEl.disabled = false;
                cityEl.innerHTML =
                    '<option value="">Selecciona ciudad</option>' +
                    cities.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
                if (initial.city) {
                    cityEl.value = initial.city;
                }
            });
        }

        countryEl.addEventListener('change', fillCities);

        if (initial.country) {
            countryEl.value = initial.country;
            fillCities();
        }
    }

    function readProfilePayload(prefix) {
        prefix = prefix || 'reg';
        const payload = {
            full_name: document.getElementById(`${prefix}FullName`)?.value?.trim() || '',
            country: document.getElementById(`${prefix}Country`)?.value || '',
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
        if (!payload.country) {
            return { ok: false, error: 'Selecciona un país' };
        }
        if (!payload.city) {
            return { ok: false, error: 'Selecciona una ciudad' };
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
        initLocationPicker(prefix, { country: user.country, city: user.city });
    }

    return {
        COUNTRIES,
        profileFieldHtml,
        initLocationPicker,
        readProfilePayload,
        fillFromUser
    };
})();
