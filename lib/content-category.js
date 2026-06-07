const { normalizeCategory } = require('./service-catalog');

const CATEGORY_LABELS = {
    'acompañantes-mujeres': 'Acompañantes Mujeres',
    'acompañantes-hombres': 'Acompañantes Hombres',
    'acompañantes-trans': 'Acompañantes Trans'
};

const LEGACY_CATEGORY_MAP = {
    acompañantes: 'acompañantes-mujeres'
};

function resolveUserPublishCategory(rawCategory) {
    const trimmed = String(rawCategory || '').trim();
    if (!trimmed) {
        return null;
    }
    if (LEGACY_CATEGORY_MAP[trimmed]) {
        return LEGACY_CATEGORY_MAP[trimmed];
    }
    return normalizeCategory(trimmed);
}

function getCategoryLabel(category) {
    const resolved = resolveUserPublishCategory(category);
    return CATEGORY_LABELS[resolved] || resolved || 'tu categoría';
}

function validateUserPublishCategory(user, requestedCategory) {
    const requested = resolveUserPublishCategory(requestedCategory);
    if (!requested || !CATEGORY_LABELS[requested]) {
        return { ok: false, error: 'Categoría inválida' };
    }

    const userCategory = resolveUserPublishCategory(user?.category);
    if (!userCategory) {
        return { ok: true, category: requested, setUserCategory: true };
    }

    if (userCategory !== requested) {
        return {
            ok: false,
            error: `Solo puedes publicar en ${getCategoryLabel(userCategory)}. Tu perfil está registrado en esa categoría.`
        };
    }

    return { ok: true, category: requested, setUserCategory: false };
}

module.exports = {
    CATEGORY_LABELS,
    resolveUserPublishCategory,
    getCategoryLabel,
    validateUserPublishCategory
};
