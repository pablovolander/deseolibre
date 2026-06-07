const CATALOGS = {
    'acompañantes-mujeres': {
        groups: [
            {
                id: 'modality',
                title: 'Modalidad de atención',
                minSelect: 1,
                items: [
                    { id: 'presencial', label: 'Atención presencial' },
                    { id: 'hotel', label: 'Cita en hotel' },
                    { id: 'domicilio', label: 'Domicilio' },
                    { id: 'cita_social', label: 'Cita social (cena, evento)' },
                    { id: 'viaje', label: 'Viajes / fines de semana' },
                    { id: 'virtual', label: 'Atención virtual' },
                    { id: 'mensajes', label: 'Contenido / mensajes' }
                ]
            },
            {
                id: 'experience',
                title: 'Tipo de experiencia',
                minSelect: 1,
                items: [
                    { id: 'compania', label: 'Compañía' },
                    { id: 'novia_experiencia', label: 'Experiencia tipo novia (GFE)' },
                    { id: 'masaje_relajante', label: 'Masaje relajante' },
                    { id: 'masaje_sensual', label: 'Masaje sensual' },
                    { id: 'dominacion', label: 'Dominación (pro)' },
                    { id: 'sumision', label: 'Sumisión (pro)' },
                    { id: 'fetiches', label: 'Fetiches (consultar)' },
                    { id: 'roleplay', label: 'Role play' },
                    { id: 'bdsm_suave', label: 'BDSM suave' }
                ]
            },
            {
                id: 'audience',
                title: 'Con quién atiende',
                items: [
                    { id: 'hombres', label: 'Hombres' },
                    { id: 'mujeres', label: 'Mujeres' },
                    { id: 'parejas', label: 'Parejas' },
                    { id: 'grupos_pequenos', label: 'Grupos pequeños (consultar)' }
                ]
            },
            {
                id: 'languages',
                title: 'Idiomas',
                items: [
                    { id: 'espanol', label: 'Español' },
                    { id: 'ingles', label: 'Inglés' },
                    { id: 'portugues', label: 'Portugués' },
                    { id: 'frances', label: 'Francés' }
                ]
            },
            {
                id: 'payment',
                title: 'Formas de pago',
                items: [
                    { id: 'efectivo', label: 'Efectivo' },
                    { id: 'transferencia', label: 'Transferencia SPEI' },
                    { id: 'tarjeta', label: 'Tarjeta (si aplica)' }
                ]
            }
        ]
    },
    'acompañantes-hombres': {
        groups: [
            {
                id: 'modality',
                title: 'Modalidad de atención',
                minSelect: 1,
                items: [
                    { id: 'presencial', label: 'Atención presencial' },
                    { id: 'hotel', label: 'Cita en hotel' },
                    { id: 'domicilio', label: 'Domicilio' },
                    { id: 'cita_social', label: 'Cita social (cena, evento)' },
                    { id: 'viaje', label: 'Viajes / escapadas' },
                    { id: 'virtual', label: 'Atención virtual' },
                    { id: 'mensajes', label: 'Contenido / mensajes' }
                ]
            },
            {
                id: 'experience',
                title: 'Tipo de experiencia',
                minSelect: 1,
                items: [
                    { id: 'compania', label: 'Compañía' },
                    { id: 'novio_experiencia', label: 'Experiencia tipo novio' },
                    { id: 'masaje_relajante', label: 'Masaje relajante' },
                    { id: 'masaje_sensual', label: 'Masaje sensual' },
                    { id: 'fitness_compania', label: 'Compañía fitness / gym' },
                    { id: 'eventos', label: 'Eventos y salidas' },
                    { id: 'dominacion', label: 'Dominación (pro)' },
                    { id: 'fetiches', label: 'Fetiches (consultar)' }
                ]
            },
            {
                id: 'audience',
                title: 'Con quién atiende',
                items: [
                    { id: 'mujeres', label: 'Mujeres' },
                    { id: 'hombres', label: 'Hombres' },
                    { id: 'parejas', label: 'Parejas' },
                    { id: 'lgbtq', label: 'Comunidad LGBTQ+' }
                ]
            },
            {
                id: 'languages',
                title: 'Idiomas',
                items: [
                    { id: 'espanol', label: 'Español' },
                    { id: 'ingles', label: 'Inglés' },
                    { id: 'portugues', label: 'Portugués' }
                ]
            },
            {
                id: 'payment',
                title: 'Formas de pago',
                items: [
                    { id: 'efectivo', label: 'Efectivo' },
                    { id: 'transferencia', label: 'Transferencia SPEI' }
                ]
            }
        ]
    },
    'acompañantes-trans': {
        groups: [
            {
                id: 'modality',
                title: 'Modalidad de atención',
                minSelect: 1,
                items: [
                    { id: 'presencial', label: 'Atención presencial' },
                    { id: 'hotel', label: 'Cita en hotel' },
                    { id: 'domicilio', label: 'Domicilio' },
                    { id: 'cita_social', label: 'Cita social' },
                    { id: 'viaje', label: 'Viajes' },
                    { id: 'virtual', label: 'Atención virtual' },
                    { id: 'mensajes', label: 'Contenido / mensajes' }
                ]
            },
            {
                id: 'experience',
                title: 'Tipo de experiencia',
                minSelect: 1,
                items: [
                    { id: 'compania', label: 'Compañía' },
                    { id: 'novia_experiencia', label: 'Experiencia tipo novia (GFE)' },
                    { id: 'novio_experiencia', label: 'Experiencia tipo novio' },
                    { id: 'masaje_relajante', label: 'Masaje relajante' },
                    { id: 'masaje_sensual', label: 'Masaje sensual' },
                    { id: 'dominacion', label: 'Dominación (pro)' },
                    { id: 'sumision', label: 'Sumisión (pro)' },
                    { id: 'fetiches', label: 'Fetiches (consultar)' },
                    { id: 'roleplay', label: 'Role play' },
                    { id: 'bdsm_suave', label: 'BDSM suave' },
                    { id: 'primera_vez', label: 'Primera experiencia (ambiente respetuoso)' }
                ]
            },
            {
                id: 'audience',
                title: 'Con quién atiende',
                items: [
                    { id: 'hombres', label: 'Hombres' },
                    { id: 'mujeres', label: 'Mujeres' },
                    { id: 'parejas', label: 'Parejas' },
                    { id: 'lgbtq', label: 'Comunidad LGBTQ+' },
                    { id: 'curiosos_respetuosos', label: 'Personas curiosas (trato respetuoso)' }
                ]
            },
            {
                id: 'identity',
                title: 'Información de perfil',
                items: [
                    { id: 'trans_femenina', label: 'Mujer trans' },
                    { id: 'trans_masculina', label: 'Hombre trans' },
                    { id: 'no_binaria', label: 'Persona no binaria' },
                    { id: 'pre_op', label: 'Pre-operatoria' },
                    { id: 'post_op', label: 'Post-operatoria' },
                    { id: 'no_op', label: 'Sin cirugía genital' }
                ]
            },
            {
                id: 'languages',
                title: 'Idiomas',
                items: [
                    { id: 'espanol', label: 'Español' },
                    { id: 'ingles', label: 'Inglés' },
                    { id: 'portugues', label: 'Portugués' }
                ]
            },
            {
                id: 'payment',
                title: 'Formas de pago',
                items: [
                    { id: 'efectivo', label: 'Efectivo' },
                    { id: 'transferencia', label: 'Transferencia SPEI' }
                ]
            }
        ]
    }
};

const DEFAULT_CATEGORY = 'acompañantes-mujeres';

function normalizeCategory(category) {
    const raw = String(category || '').trim();
    if (CATALOGS[raw]) {
        return raw;
    }
    if (raw === 'acompañantes' || raw === 'acompanantes-mujeres') {
        return 'acompañantes-mujeres';
    }
    return DEFAULT_CATEGORY;
}

function getCatalogForCategory(category) {
    const cat = normalizeCategory(category);
    return CATALOGS[cat] || CATALOGS[DEFAULT_CATEGORY];
}

function buildIdMap(category) {
    const map = new Map();
    getCatalogForCategory(category).groups.forEach((group) => {
        group.items.forEach((item) => {
            map.set(item.id, { ...item, group: group.id, groupTitle: group.title });
        });
    });
    return map;
}

function parseOfferedServices(raw) {
    if (Array.isArray(raw)) {
        return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
    }
    if (raw == null || raw === '') {
        return [];
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parseOfferedServices(parsed);
            }
        } catch {
            return [...new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean))];
        }
    }
    return [];
}

function serializeOfferedServices(ids) {
    return JSON.stringify(parseOfferedServices(ids));
}

function validateOfferedServices(category, rawIds) {
    const cat = normalizeCategory(category);
    const catalog = getCatalogForCategory(cat);
    const idMap = buildIdMap(cat);
    const ids = parseOfferedServices(rawIds);
    const invalid = ids.filter((id) => !idMap.has(id));
    if (invalid.length) {
        return { ok: false, error: `Servicios no válidos: ${invalid.join(', ')}` };
    }

    for (const group of catalog.groups) {
        const min = group.minSelect || 0;
        if (min <= 0) {
            continue;
        }
        const selectedInGroup = ids.filter((id) => idMap.get(id)?.group === group.id);
        if (selectedInGroup.length < min) {
            return {
                ok: false,
                error: `Selecciona al menos ${min} opción en «${group.title}»`
            };
        }
    }

    return { ok: true, offered_services: ids, offered_services_json: serializeOfferedServices(ids) };
}

function resolveServiceLabels(category, rawIds) {
    const idMap = buildIdMap(category);
    return parseOfferedServices(rawIds)
        .filter((id) => idMap.has(id))
        .map((id) => ({
            id,
            label: idMap.get(id).label,
            group: idMap.get(id).group,
            groupTitle: idMap.get(id).groupTitle
        }));
}

function userHasRequiredServices(user) {
    if (!user) {
        return false;
    }
    const ids = parseOfferedServices(user.offered_services);
    if (!ids.length) {
        return false;
    }
    const check = validateOfferedServices(user.category, ids);
    return check.ok;
}

function postOffersService(post, serviceId) {
    if (!serviceId) {
        return true;
    }
    const ids = parseOfferedServices(post?.offered_services);
    return ids.includes(String(serviceId));
}

module.exports = {
    CATALOGS,
    DEFAULT_CATEGORY,
    normalizeCategory,
    getCatalogForCategory,
    parseOfferedServices,
    serializeOfferedServices,
    validateOfferedServices,
    resolveServiceLabels,
    userHasRequiredServices,
    postOffersService
};
