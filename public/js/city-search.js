/**
 * Buscador de ciudades con lista curada (MX, CO, AR).
 */
window.DeseoCitySearch = (function () {
    let citiesCache = null;

    async function fetchCities(country) {
        const params = country ? `?country=${encodeURIComponent(country)}` : '';
        const res = await fetch(`${API_URL}/api/cities${params}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'No se pudieron cargar las ciudades');
        }
        return data.cities || [];
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
        const query = String(raw || '').trim();
        if (!query || !citiesCache) {
            return { ok: false, error: 'Selecciona una ciudad de la lista' };
        }
        const normalized = query
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        for (const city of citiesCache) {
            const names = [city.name, ...(city.aliases || [])].map((n) =>
                String(n)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim()
            );
            if (names.includes(normalized)) {
                return { ok: true, city: city.name, country: city.country };
            }
            if (names.some((n) => n.includes(normalized) || normalized.includes(n)) && normalized.length >= 3) {
                return { ok: true, city: city.name, country: city.country };
            }
        }
        return {
            ok: false,
            error: 'Ciudad no disponible. Elige una de la lista desplegable.'
        };
    }

    function renderPopular(container, onPick) {
        if (!container || !citiesCache) {
            return;
        }
        const picks = [
            'Ciudad de México',
            'Guadalajara',
            'Buenos Aires',
            'Bogotá',
            'Medellín',
            'Monterrey'
        ];
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

    async function bindInput(options) {
        const input = document.getElementById(options.inputId || 'searchCity');
        const datalist = document.getElementById(options.datalistId || 'citiesDatalist');
        const countrySelect = options.countrySelectId
            ? document.getElementById(options.countrySelectId)
            : null;

        await getCities();

        function fillDatalist(country) {
            if (!datalist) {
                return;
            }
            const list = country
                ? citiesCache.filter((c) => c.country === country)
                : citiesCache;
            datalist.innerHTML = list.map((c) => `<option value="${c.name}"></option>`).join('');
        }

        fillDatalist(countrySelect?.value || '');
        countrySelect?.addEventListener('change', () => fillDatalist(countrySelect.value));

        if (options.popularContainerId) {
            renderPopular(document.getElementById(options.popularContainerId), (city) => {
                if (input) {
                    input.value = city;
                }
                options.onSearch?.(city);
            });
        }

        return {
            resolve: () => resolveLocal(input?.value || ''),
            getValue: () => input?.value?.trim() || ''
        };
    }

    return {
        fetchCities,
        getCities,
        resolveLocal,
        bindInput,
        renderPopular
    };
})();
