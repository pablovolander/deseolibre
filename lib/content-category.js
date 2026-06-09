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

function isCategoryLocked(user, publicationsCount) {
    const count = Number(publicationsCount) || 0;
    return count > 0 && Boolean(resolveUserPublishCategory(user?.category));
}

function validateUserCategoryChange(user, requestedCategory, publicationsCount) {
    const hasPublications = (Number(publicationsCount) || 0) > 0;
    const current = resolveUserPublishCategory(user?.category);

    if (requestedCategory === undefined) {
        return {
            ok: true,
            category: user?.category || null,
            locked: isCategoryLocked(user, publicationsCount)
        };
    }

    const trimmed = String(requestedCategory || '').trim();
    const requested = trimmed ? resolveUserPublishCategory(trimmed) : null;

    if (!hasPublications) {
        return { ok: true, category: requested, locked: false };
    }

    if (!current) {
        return {
            ok: true,
            category: requested,
            locked: Boolean(requested)
        };
    }

    if (!requested || requested !== current) {
        return {
            ok: false,
            error: `No puedes cambiar de categoría: ya tienes publicaciones en ${getCategoryLabel(current)}.`,
            locked: true,
            category: current
        };
    }

    return { ok: true, category: current, locked: true };
}

module.exports = {
    CATEGORY_LABELS,
    resolveUserPublishCategory,
    getCategoryLabel,
    validateUserPublishCategory,
    isCategoryLocked,
    validateUserCategoryChange
};
