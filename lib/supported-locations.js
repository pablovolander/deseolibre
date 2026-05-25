/**
 * México: 3 ciudades + zonas curadas + detalle libre en perfil.
 */
const DEFAULT_COUNTRY = 'MX';

const COUNTRY_LABELS = { MX: 'México' };

const CITY_SHORT = {
    'Ciudad de México': 'CDMX',
    Guadalajara: 'GDL',
    Monterrey: 'MTY'
};

const SUPPORTED_CITIES = [
    { name: 'Ciudad de México', country: 'MX', aliases: ['cdmx', 'mexico df', 'méxico df', 'df', 'cd mx', 'ciudad de mexico'] },
    { name: 'Guadalajara', country: 'MX', aliases: ['gdl', 'guadalajara metro'] },
    { name: 'Monterrey', country: 'MX', aliases: ['mty', 'monterrey metro'] }
];

/** @type {Record<string, Array<{ name: string, group?: string, aliases?: string[], isOther?: boolean }>>} */
const ZONES_BY_CITY = {
    'Ciudad de México': [
        { group: 'Miguel Hidalgo', name: 'Polanco', aliases: ['polanco iv'] },
        { group: 'Miguel Hidalgo', name: 'Anzures' },
        { group: 'Miguel Hidalgo', name: 'Lomas de Chapultepec', aliases: ['lomas'] },
        { group: 'Miguel Hidalgo', name: 'Granada' },
        { group: 'Miguel Hidalgo', name: 'Reforma / Juárez', aliases: ['reforma', 'juarez'] },
        { group: 'Cuauhtémoc', name: 'Roma Norte', aliases: ['roma'] },
        { group: 'Cuauhtémoc', name: 'Roma Sur' },
        { group: 'Cuauhtémoc', name: 'Condesa' },
        { group: 'Cuauhtémoc', name: 'Hipódromo' },
        { group: 'Cuauhtémoc', name: 'Zona Rosa' },
        { group: 'Cuauhtémoc', name: 'Centro Histórico', aliases: ['centro'] },
        { group: 'Benito Juárez', name: 'Del Valle', aliases: ['del valle'] },
        { group: 'Benito Juárez', name: 'Nápoles', aliases: ['napoles'] },
        { group: 'Benito Juárez', name: 'Narvarte' },
        { group: 'Benito Juárez', name: 'Insurgentes Sur' },
        { group: 'Benito Juárez', name: 'San José Insurgentes' },
        { group: 'Álvaro Obregón', name: 'Santa Fe', aliases: ['santa fe'] },
        { group: 'Álvaro Obregón', name: 'Pedregal' },
        { group: 'Coyoacán', name: 'San Ángel', aliases: ['san angel'] },
        { group: 'Coyoacán', name: 'Coyoacán' },
        { group: 'Álvaro Obregón', name: 'Florida' },
        { group: 'Gustavo A. Madero', name: 'Lindavista' },
        { group: 'Tlalpan', name: 'Coapa' },
        { group: 'Tlalpan', name: 'Tlalpan' },
        { group: 'Álvaro Obregón', name: 'Interlomas', aliases: ['interlomas'] },
        { group: 'General', name: 'Otra zona (CDMX)', isOther: true, aliases: ['otra'] }
    ],
    Guadalajara: [
        { group: 'Guadalajara', name: 'Centro · Guadalajara', aliases: ['centro gdl'] },
        { group: 'Guadalajara', name: 'Chapultepec · Guadalajara', aliases: ['chapultepec'] },
        { group: 'Guadalajara', name: 'Americana' },
        { group: 'Guadalajara', name: 'Lafayette' },
        { group: 'Guadalajara', name: 'Providencia', aliases: ['providencia gdl'] },
        { group: 'Guadalajara', name: 'Moderna' },
        { group: 'Guadalajara', name: 'Santa Teresita' },
        { group: 'Zapopan', name: 'Andares · Zapopan', aliases: ['andares'] },
        { group: 'Zapopan', name: 'Puerta de Hierro · Zapopan', aliases: ['puerta de hierro'] },
        { group: 'Zapopan', name: 'Chapalita · Zapopan' },
        { group: 'Zapopan', name: 'Av. Patria · Zapopan', aliases: ['patria'] },
        { group: 'Zapopan', name: 'Centro Zapopan' },
        { group: 'Zapopan', name: 'Ciudad del Sol · Zapopan' },
        { group: 'Tlaquepaque', name: 'Centro Tlaquepaque' },
        { group: 'Tlaquepaque', name: 'San Pedro Tlaquepaque' },
        { group: 'General', name: 'Otra zona (Guadalajara)', isOther: true }
    ],
    Monterrey: [
        { group: 'Monterrey', name: 'Centro · Monterrey', aliases: ['centro mty'] },
        { group: 'Monterrey', name: 'Obispado' },
        { group: 'Monterrey', name: 'Cumbres' },
        { group: 'Monterrey', name: 'Contry' },
        { group: 'Monterrey', name: 'Las Brisas' },
        { group: 'Monterrey', name: 'San Jerónimo', aliases: ['san jeronomo'] },
        { group: 'Monterrey', name: 'Tec / Mitras', aliases: ['tec', 'mitras'] },
        { group: 'San Pedro', name: 'Valle Oriente · San Pedro', aliases: ['valle oriente', 'san pedro'] },
        { group: 'San Pedro', name: 'Valle Poniente · San Pedro' },
        { group: 'San Pedro', name: 'Centrito · San Pedro', aliases: ['centrito'] },
        { group: 'San Pedro', name: 'Del Valle · San Pedro' },
        { group: 'San Nicolás', name: 'Anáhuac · San Nicolás', aliases: ['anahuac'] },
        { group: 'San Nicolás', name: 'Centro San Nicolás' },
        { group: 'Apodaca', name: 'Apodaca' },
        { group: 'Guadalupe', name: 'Guadalupe' },
        { group: 'General', name: 'Otra zona (Monterrey)', isOther: true }
    ]
};

const ZONE_DETAIL_MAX = 120;
const ZONE_DETAIL_MIN_OTHER = 4;

function stripAccents(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeToken(value) {
    return stripAccents(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function getCityByName(name) {
    const token = normalizeToken(name);
    return SUPPORTED_CITIES.find((c) => normalizeToken(c.name) === token) || null;
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
        error: 'Ciudad no disponible. Operamos en Ciudad de México, Guadalajara y Monterrey.'
    };
}

function getZonesForCity(cityName) {
    return ZONES_BY_CITY[cityName] || [];
}

function isOtherZone(zoneName) {
    const zones = Object.values(ZONES_BY_CITY).flat();
    const z = zones.find((item) => normalizeToken(item.name) === normalizeToken(zoneName));
    return Boolean(z?.isOther);
}

function resolveZoneQuery(cityName, rawZone) {
    const city = getCityByName(cityName);
    if (!city) {
        return { ok: false, error: 'Ciudad no válida' };
    }

    const query = normalizeToken(rawZone);
    if (!query) {
        return { ok: false, error: 'Selecciona una zona' };
    }

    const zones = getZonesForCity(city.name);
    for (const zone of zones) {
        const terms = new Set([normalizeToken(zone.name)]);
        (zone.aliases || []).forEach((a) => terms.add(normalizeToken(a)));
        for (const term of terms) {
            if (term === query || term.includes(query) || query.includes(term)) {
                return { ok: true, zone: zone.name, group: zone.group || null, isOther: Boolean(zone.isOther) };
            }
        }
    }

    return { ok: false, error: 'Zona no disponible. Elige una de la lista.' };
}

function validateZoneDetail(zoneName, zoneDetail) {
    const detail = String(zoneDetail || '').trim();
    if (!detail) {
        if (isOtherZone(zoneName)) {
            return {
                ok: false,
                error: 'Si eliges "Otra zona", indica colonia, referencia o punto de encuentro en el campo de detalle'
            };
        }
        return { ok: true, zone_detail: null };
    }

    if (detail.length < ZONE_DETAIL_MIN_OTHER) {
        return { ok: false, error: 'El detalle de ubicación debe tener al menos 4 caracteres' };
    }
    if (detail.length > ZONE_DETAIL_MAX) {
        return { ok: false, error: `El detalle de ubicación no puede superar ${ZONE_DETAIL_MAX} caracteres` };
    }

    return { ok: true, zone_detail: detail };
}

function validateCountryCityZone(country, cityName, zoneName, zoneDetail) {
    const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase() || DEFAULT_COUNTRY;
    if (countryCode !== DEFAULT_COUNTRY) {
        return { ok: false, error: 'Por ahora solo operamos en México' };
    }

    const cityCheck = resolveCityQuery(cityName);
    if (!cityCheck.ok) {
        return cityCheck;
    }

    const zoneCheck = resolveZoneQuery(cityCheck.city.name, zoneName);
    if (!zoneCheck.ok) {
        return zoneCheck;
    }

    const detailCheck = validateZoneDetail(zoneCheck.zone, zoneDetail);
    if (!detailCheck.ok) {
        return detailCheck;
    }

    return {
        ok: true,
        country: DEFAULT_COUNTRY,
        city: cityCheck.city.name,
        zone: zoneCheck.zone,
        zone_detail: detailCheck.zone_detail,
        location: formatUserLocation(cityCheck.city.name, DEFAULT_COUNTRY, zoneCheck.zone, detailCheck.zone_detail)
    };
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
    return { ok: true, country: DEFAULT_COUNTRY, city: cityCheck.city.name };
}

function getCountryLabel(countryCode) {
    return COUNTRY_LABELS[String(countryCode || DEFAULT_COUNTRY).toUpperCase()] || 'México';
}

function getCityShort(cityName) {
    return CITY_SHORT[cityName] || cityName;
}

function formatUserLocation(city, country, zone, zoneDetail) {
    const label = getCountryLabel(country || DEFAULT_COUNTRY);
    const short = getCityShort(city);
    let base = zone ? `${zone} · ${short}` : city;
    if (zoneDetail) {
        base = `${base} — ${zoneDetail}`;
    }
    return city ? `${base}, ${label}` : label;
}

function formatDisplayLocation(city, zone, zoneDetail) {
    const short = getCityShort(city);
    let line = zone ? `${zone} · ${short}` : (city || short);
    if (zoneDetail) {
        line = `${line} — ${zoneDetail}`;
    }
    return line;
}

function listCountries() {
    return Object.entries(COUNTRY_LABELS).map(([code, label]) => ({ code, label }));
}

function listSupportedCities(countryCode) {
    const code = String(countryCode || DEFAULT_COUNTRY).toUpperCase();
    return SUPPORTED_CITIES.filter((c) => c.country === code).map((city) => ({
        name: city.name,
        country: city.country,
        aliases: city.aliases || [],
        short: getCityShort(city.name)
    }));
}

function listZonesForCity(cityName) {
    const city = getCityByName(cityName);
    if (!city) {
        return [];
    }
    return getZonesForCity(city.name).map((z) => ({
        name: z.name,
        group: z.group || 'Zonas',
        isOther: Boolean(z.isOther),
        aliases: z.aliases || []
    }));
}

function collectSearchableText(post) {
    return [
        post.zone,
        post.zone_detail,
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
    return postMatchesLocation(post, rawQuery, '');
}

function postMatchesLocation(post, rawCity, rawZone) {
    const cityResolved = rawCity ? resolveCityQuery(rawCity) : null;
    if (rawCity && !cityResolved?.ok) {
        return false;
    }

    const targetCity = cityResolved?.ok ? cityResolved.city.name : '';
    const zoneQuery = String(rawZone || '').trim();

    if (post.city && targetCity) {
        const cityMatch = normalizeToken(post.city) === normalizeToken(targetCity);
        if (!cityMatch) {
            return false;
        }
        if (!zoneQuery) {
            return true;
        }
        if (post.zone && normalizeToken(post.zone) === normalizeToken(zoneQuery)) {
            return true;
        }
        const zoneResolved = resolveZoneQuery(targetCity, zoneQuery);
        if (zoneResolved.ok && post.zone && normalizeToken(post.zone) === normalizeToken(zoneResolved.zone)) {
            return true;
        }
        const haystack = collectSearchableText(post);
        const zoneTerms = zoneResolved.ok
            ? [normalizeToken(zoneResolved.zone), ...((getZonesForCity(targetCity).find((z) => z.name === zoneResolved.zone)?.aliases) || []).map(normalizeToken)]
            : [normalizeToken(zoneQuery)];
        return zoneTerms.some((term) => term && haystack.includes(term));
    }

    if (!targetCity && zoneQuery) {
        return false;
    }

    const haystack = collectSearchableText(post);
    if (targetCity && cityResolved.terms.some((term) => haystack.includes(term))) {
        if (!zoneQuery) {
            return true;
        }
    }

    return false;
}

module.exports = {
    DEFAULT_COUNTRY,
    COUNTRY_LABELS,
    CITY_SHORT,
    SUPPORTED_CITIES,
    ZONES_BY_CITY,
    ZONE_DETAIL_MAX,
    normalizeToken,
    resolveCityQuery,
    resolveZoneQuery,
    validateCountryCity,
    validateCountryCityZone,
    validateZoneDetail,
    isOtherZone,
    listSupportedCities,
    listZonesForCity,
    listCountries,
    getCountryLabel,
    getCityShort,
    formatUserLocation,
    formatDisplayLocation,
    postMatchesCity,
    postMatchesLocation,
    getCityTerms,
    getZonesForCity
};
