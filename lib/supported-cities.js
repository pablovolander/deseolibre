/**
 * Ciudades soportadas al lanzamiento (MX, CO, AR) con alias para búsqueda.
 */
const SUPPORTED_CITIES = [
    { name: 'Ciudad de México', country: 'MX', aliases: ['cdmx', 'mexico df', 'méxico df', 'df', 'cd mx'] },
    { name: 'Guadalajara', country: 'MX', aliases: ['gdl'] },
    { name: 'Monterrey', country: 'MX', aliases: ['mty'] },
    { name: 'Puebla', country: 'MX', aliases: [] },
    { name: 'Tijuana', country: 'MX', aliases: [] },
    { name: 'Cancún', country: 'MX', aliases: ['cancun'] },
    { name: 'León', country: 'MX', aliases: ['leon'] },
    { name: 'Querétaro', country: 'MX', aliases: ['queretaro'] },
    { name: 'Mérida', country: 'MX', aliases: ['merida'] },
    { name: 'Buenos Aires', country: 'AR', aliases: ['caba', 'capital federal', 'bs as', 'bsas'] },
    { name: 'Córdoba', country: 'AR', aliases: ['cordoba'] },
    { name: 'Rosario', country: 'AR', aliases: [] },
    { name: 'Mendoza', country: 'AR', aliases: [] },
    { name: 'La Plata', country: 'AR', aliases: [] },
    { name: 'Mar del Plata', country: 'AR', aliases: ['mdp'] },
    { name: 'Bogotá', country: 'CO', aliases: ['bogota', 'bogotá dc', 'bogota dc'] },
    { name: 'Medellín', country: 'CO', aliases: ['medellin'] },
    { name: 'Cali', country: 'CO', aliases: [] },
    { name: 'Barranquilla', country: 'CO', aliases: [] },
    { name: 'Cartagena', country: 'CO', aliases: ['cartagena de indias'] },
    { name: 'Bucaramanga', country: 'CO', aliases: [] }
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
        error: 'Ciudad no disponible. Elige una de la lista (México, Colombia o Argentina).'
    };
}

function collectSearchableText(post) {
    return [
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
    const haystack = collectSearchableText(post);
    return resolved.terms.some((term) => haystack.includes(term));
}

function listSupportedCities(countryCode) {
    const list = countryCode
        ? SUPPORTED_CITIES.filter((c) => c.country === String(countryCode).toUpperCase())
        : SUPPORTED_CITIES;
    return list.map((city) => ({
        name: city.name,
        country: city.country,
        aliases: city.aliases || []
    }));
}

module.exports = {
    SUPPORTED_CITIES,
    normalizeToken,
    resolveCityQuery,
    postMatchesCity,
    listSupportedCities,
    getCityTerms
};
