/**
 * Ciudades de México (lanzamiento) con alias para búsqueda.
 */
const DEFAULT_COUNTRY = 'MX';

const COUNTRY_LABELS = {
    MX: 'México'
};

const SUPPORTED_CITIES = [
    { name: 'Ciudad de México', country: 'MX', aliases: ['cdmx', 'mexico df', 'méxico df', 'df', 'cd mx'] },
    { name: 'Guadalajara', country: 'MX', aliases: ['gdl'] },
    { name: 'Monterrey', country: 'MX', aliases: ['mty'] },
    { name: 'Puebla', country: 'MX', aliases: ['puebla capital'] },
    { name: 'Tijuana', country: 'MX', aliases: [] },
    { name: 'Cancún', country: 'MX', aliases: ['cancun'] },
    { name: 'León', country: 'MX', aliases: ['leon'] },
    { name: 'Querétaro', country: 'MX', aliases: ['queretaro'] },
    { name: 'Mérida', country: 'MX', aliases: ['merida'] },
    { name: 'Aguascalientes', country: 'MX', aliases: [] },
    { name: 'San Luis Potosí', country: 'MX', aliases: ['san luis potosi', 'slp'] },
    { name: 'Hermosillo', country: 'MX', aliases: [] },
    { name: 'Chihuahua', country: 'MX', aliases: [] },
    { name: 'Veracruz', country: 'MX', aliases: ['veracruz puerto'] },
    { name: 'Acapulco', country: 'MX', aliases: [] },
    { name: 'Toluca', country: 'MX', aliases: ['toluca de lerdo'] },
    { name: 'Morelia', country: 'MX', aliases: [] },
    { name: 'Saltillo', country: 'MX', aliases: [] },
    { name: 'Culiacán', country: 'MX', aliases: ['culiacan'] },
    { name: 'Mazatlán', country: 'MX', aliases: ['mazatlan'] }
];

function stripAccents(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeToken(value) {
    return stripAccents(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function getCityTerms(city) {
    const terms = new Set([normalizeToken(city.name)]);
    (city.aliases || []).forEach((alias) => terms.add(normalizeToken(alias)));
    return [...terms];
}

function resolveCityQuery(rawQuery) {
    const query = normalizeToken(rawQuery);
    if (!query) {
        return { ok: false, error: 'Escribe o selecciona una ciudad' };
    }

    let best = null;
    let bestScore = 0;

    for (const city of SUPPORTED_CITIES) {
        const terms = getCityTerms(city);
        for (const term of terms) {
            if (term === query) {
                return { ok: true, city, terms, matched: term, exact: true };
            }
            if (term.includes(query) || query.includes(term)) {
                const score = Math.min(term.length, query.length);
                if (score > bestScore) {
                    bestScore = score;
                    best = { city, terms, matched: term };
                }
            }
        }
    }

    if (best && bestScore >= 3) {
        return { ok: true, city: best.city, terms: best.terms, matched: best.matched, exact: false };
    }

    return {
        ok: false,
        error: 'Ciudad no disponible. Elige una ciudad de México en la lista.'
    };
}

function getCountryLabel(countryCode) {
    return COUNTRY_LABELS[String(countryCode || DEFAULT_COUNTRY).toUpperCase()] || 'México';
}

function listCountries() {
    return Object.entries(COUNTRY_LABELS).map(([code, label]) => ({ code, label }));
}

function validateCountryCity(country, cityName) {
    const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase() || DEFAULT_COUNTRY;
    if (countryCode !== DEFAULT_COUNTRY) {
        return { ok: false, error: 'Por ahora solo operamos en México' };
    }

    const cityCheck = resolveCityQuery(cityName);
    if (!cityCheck.ok) {
        return cityCheck;
    }

    if (cityCheck.city.country !== DEFAULT_COUNTRY) {
        return { ok: false, error: 'La ciudad debe ser de México' };
    }

    return {
        ok: true,
        country: DEFAULT_COUNTRY,
        city: cityCheck.city.name
    };
}

function formatUserLocation(city, country) {
    const label = getCountryLabel(country || DEFAULT_COUNTRY);
    return city ? `${city}, ${label}` : label;
}

function collectSearchableText(post) {
    return [
        post.city,
        post.country,
        post.location,
        post.user_location,
        post.bio,
        post.description,
        post.title
    ]
        .filter(Boolean)
        .map(normalizeToken)
        .join(' ');
}

function postMatchesCity(post, rawQuery) {
    const resolved = resolveCityQuery(rawQuery);
    if (!resolved.ok) {
        return false;
    }

    if (post.city) {
        const cityMatch = normalizeToken(post.city) === normalizeToken(resolved.city.name);
        const countryMatch = !post.country || post.country === DEFAULT_COUNTRY;
        if (cityMatch && countryMatch) {
            return true;
        }
    }

    const haystack = collectSearchableText(post);
    return resolved.terms.some((term) => haystack.includes(term));
}

function listSupportedCities(countryCode) {
    const code = String(countryCode || DEFAULT_COUNTRY).toUpperCase();
    const list = SUPPORTED_CITIES.filter((c) => c.country === code);
    return list.map((city) => ({
        name: city.name,
        country: city.country,
        aliases: city.aliases || []
    }));
}

module.exports = {
    DEFAULT_COUNTRY,
    SUPPORTED_CITIES,
    COUNTRY_LABELS,
    normalizeToken,
    resolveCityQuery,
    postMatchesCity,
    listSupportedCities,
    listCountries,
    getCityTerms,
    getCountryLabel,
    validateCountryCity,
    formatUserLocation
};
