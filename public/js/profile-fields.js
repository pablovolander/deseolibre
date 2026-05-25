/**
 * Ciudad, zona y detalle de ubicación (registro / edición de perfil).
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
                <label for="${p}City">Ciudad *</label>
                <select id="${p}City" required>
                    <option value="">Ciudad de México, Guadalajara o Monterrey</option>
                </select>
            </div>
            <div class="form-group">
                <label for="${p}Zone">Zona *</label>
                <select id="${p}Zone" required disabled>
                    <option value="">Primero elige ciudad</option>
                </select>
            </div>
            <div class="form-group">
                <label for="${p}ZoneDetail">Detalle de ubicación</label>
                <input type="text" id="${p}ZoneDetail" maxlength="120" placeholder="Opcional: colonia, referencia o punto de encuentro">
                <small>Obligatorio si eliges &quot;Otra zona&quot;. Se muestra en tu perfil.</small>
            </div>
            <div class="form-group">
                <label for="${p}Phone">Teléfono * (WhatsApp)</label>
                <input type="tel" id="${p}Phone" required placeholder="10 dígitos, ej: 55 1234 5678">
            </div>
            <div class="form-group">
                <label for="${p}Telegram">Usuario de Telegram *</label>
                <input type="text" id="${p}Telegram" required placeholder="ej: mi_usuario" autocomplete="off" minlength="5" maxlength="32">
                <small>Sin @ — se abrirá t.me/tu_usuario</small>
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
        const zoneEl = document.getElementById(`${prefix}Zone`);
        if (!cityEl) {
            return;
        }
        if (countryEl) {
            countryEl.value = DEFAULT_COUNTRY;
        }

        const locApi = typeof DeseoLocationSearch !== 'undefined' ? DeseoLocationSearch : null;
        if (!locApi) {
            return;
        }

        const cities = await locApi.getCities(DEFAULT_COUNTRY);
        cityEl.innerHTML =
            '<option value="">Selecciona tu ciudad</option>' +
            cities.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');

        const onCityChange = async () => {
            const city = cityEl.value;
            await locApi.fillZoneSelect(zoneEl, city, '');
            if (zoneEl) {
                zoneEl.required = Boolean(city);
            }
        };

        cityEl.addEventListener('change', onCityChange);

        if (initial.city) {
            cityEl.value = initial.city;
            await locApi.fillZoneSelect(zoneEl, initial.city, initial.zone || '');
        }
        if (initial.zone && zoneEl) {
            zoneEl.value = initial.zone;
        }
        const detailEl = document.getElementById(`${prefix}ZoneDetail`);
        if (detailEl && initial.zone_detail) {
            detailEl.value = initial.zone_detail;
        }
    }

    function readProfilePayload(prefix) {
        prefix = prefix || 'reg';
        const payload = {
            full_name: document.getElementById(`${prefix}FullName`)?.value?.trim() || '',
            country: document.getElementById(`${prefix}Country`)?.value || DEFAULT_COUNTRY,
            city: document.getElementById(`${prefix}City`)?.value || '',
            zone: document.getElementById(`${prefix}Zone`)?.value || '',
            zone_detail: document.getElementById(`${prefix}ZoneDetail`)?.value?.trim() || '',
            phone: document.getElementById(`${prefix}Phone`)?.value?.trim() || '',
            telegram_username: document.getElementById(`${prefix}Telegram`)?.value?.trim() || '',
            service_price: document.getElementById(`${prefix}Price`)?.value || '',
            service_price_unit: document.getElementById(`${prefix}PriceUnit`)?.value || ''
        };

        if (typeof DeseoPricing !== 'undefined') {
            const phoneCheck = DeseoPricing.validatePhone(payload.phone);
            if (!phoneCheck.ok) {
                return phoneCheck;
            }
            payload.phone = phoneCheck.phone;

            if (typeof DeseoContact !== 'undefined') {
                const tgCheck = DeseoContact.normalizeTelegramUsername(payload.telegram_username);
                if (!tgCheck.ok) {
                    return tgCheck;
                }
                payload.telegram_username = tgCheck.telegram_username;
            }

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
            return { ok: false, error: 'Selecciona tu ciudad' };
        }
        if (!payload.zone) {
            return { ok: false, error: 'Selecciona tu zona' };
        }

        const isOther =
            payload.zone.toLowerCase().includes('otra zona');
        if (isOther && (!payload.zone_detail || payload.zone_detail.length < 4)) {
            return {
                ok: false,
                error: 'Si eliges "Otra zona", completa el detalle de ubicación (mín. 4 caracteres)'
            };
        }

        if (payload.zone_detail && payload.zone_detail.length > 120) {
            return { ok: false, error: 'El detalle de ubicación no puede superar 120 caracteres' };
        }

        if (!payload.telegram_username && typeof DeseoContact === 'undefined') {
            return { ok: false, error: 'Indica tu usuario de Telegram' };
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
        set(`${prefix}Telegram`, user.telegram_username);
        set(`${prefix}Price`, user.service_price);
        set(`${prefix}PriceUnit`, user.service_price_unit);
        set(`${prefix}ZoneDetail`, user.zone_detail);
        initLocationPicker(prefix, { city: user.city, zone: user.zone, zone_detail: user.zone_detail });
    }

    return {
        DEFAULT_COUNTRY,
        profileFieldHtml,
        initLocationPicker,
        readProfilePayload,
        fillFromUser
    };
})();
