/**
 * Ciudades (3) y zonas — API + selects en cascada.
 */
window.DeseoLocationSearch = (function () {
    let citiesCache = null;
    const zonesCache = {};

    async function fetchCities(country) {
        const params = country ? `?country=${encodeURIComponent(country)}` : '';
        const res = await fetch(`${API_URL}/api/cities${params}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'No se pudieron cargar las ciudades');
        }
        return data.cities || [];
    }

    async function fetchZones(cityName) {
        const key = cityName || '';
        if (zonesCache[key]) {
            return zonesCache[key];
        }
        const res = await fetch(
            `${API_URL}/api/zones?ciudad=${encodeURIComponent(cityName)}`,
            { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'No se pudieron cargar las zonas');
        }
        zonesCache[key] = data.zones || [];
        return zonesCache[key];
    }

    async function getCities(country) {
        if (!citiesCache) {
            citiesCache = await fetchCities();
        }
        if (!country) {
            return citiesCache;
        }
        return citiesCache.filter((c) => c.country === country);
    }

    function resolveLocal(raw) {
        if (typeof DeseoCitySearch !== 'undefined') {
            return DeseoCitySearch.resolveLocal(raw);
        }
        const query = String(raw || '').trim();
        if (!query || !citiesCache) {
            return { ok: false, error: 'Selecciona una ciudad' };
        }
        for (const city of citiesCache) {
            if (city.name === query) {
                return { ok: true, city: city.name, country: city.country };
            }
        }
        return { ok: false, error: 'Ciudad no disponible' };
    }

    function resolveZoneLocal(cityName, rawZone) {
        const zone = String(rawZone || '').trim();
        if (!zone) {
            return { ok: true, zone: '', allCity: true };
        }
        const list = zonesCache[cityName] || [];
        const found = list.find((z) => z.name === zone);
        if (found) {
            return { ok: true, zone: found.name, isOther: Boolean(found.isOther) };
        }
        return { ok: false, error: 'Selecciona una zona de la lista' };
    }

    function renderPopular(container, onPick) {
        if (!container || !citiesCache) {
            return;
        }
        const picks = ['Ciudad de México', 'Guadalajara', 'Monterrey'];
        container.innerHTML = picks
            .map(
                (name) =>
                    `<button type="button" class="city-chip" data-city="${name}">${name}</button>`
            )
            .join('');
        container.querySelectorAll('.city-chip').forEach((btn) => {
            btn.addEventListener('click', () => onPick(btn.dataset.city));
        });
    }

    function renderZoneChips(container, cityName, onPick) {
        if (!container || !cityName || !zonesCache[cityName]) {
            if (container) {
                container.innerHTML = '';
            }
            return;
        }
        const top = zonesCache[cityName].filter((z) => !z.isOther).slice(0, 10);
        container.innerHTML =
            `<button type="button" class="city-chip" data-zone="">Toda la ciudad</button>` +
            top
                .map(
                    (z) =>
                        `<button type="button" class="city-chip" data-zone="${z.name.replace(/"/g, '&quot;')}">${z.name}</button>`
                )
                .join('');
        container.querySelectorAll('.city-chip').forEach((btn) => {
            btn.addEventListener('click', () => onPick(btn.dataset.zone || ''));
        });
    }

    async function fillZoneSelect(selectEl, cityName, selectedZone) {
        if (!selectEl) {
            return;
        }
        if (!cityName) {
            selectEl.innerHTML = '<option value="">Primero elige ciudad</option>';
            selectEl.disabled = true;
            return;
        }
        selectEl.disabled = false;
        selectEl.innerHTML = '<option value="">Cargando zonas...</option>';
        try {
            const zones = await fetchZones(cityName);
            let html = '<option value="">Toda la ciudad</option>';
            let currentGroup = '';
            zones.forEach((z) => {
                const g = z.group || 'Zonas';
                if (g !== currentGroup) {
                    if (currentGroup) {
                        html += '</optgroup>';
                    }
                    html += `<optgroup label="${g}">`;
                    currentGroup = g;
                }
                html += `<option value="${z.name.replace(/"/g, '&quot;')}">${z.name}</option>`;
            });
            if (currentGroup) {
                html += '</optgroup>';
            }
            selectEl.innerHTML = html;
            if (selectedZone) {
                selectEl.value = selectedZone;
            }
        } catch {
            selectEl.innerHTML = '<option value="">Error al cargar zonas</option>';
        }
    }

    return {
        fetchCities,
        fetchZones,
        getCities,
        resolveLocal,
        resolveZoneLocal,
        renderPopular,
        renderZoneChips,
        fillZoneSelect,
        get zonesCache() {
            return zonesCache;
        }
    };
})();
