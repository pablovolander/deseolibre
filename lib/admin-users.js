/**
 * Heurísticas para detectar cuentas de prueba en desarrollo/staging.
 * Solo marca candidatos; el admin confirma antes de borrar.
 */
function isLikelyTestAccount(user) {
    if (!user || user.is_admin) {
        return false;
    }

    const email = String(user.email || '').trim().toLowerCase();
    const username = String(user.username || '').trim().toLowerCase();

    if (!email && !username) {
        return false;
    }

    const testEmailDomains = /@(test\.com|example\.com|mailinator\.com|yopmail\.com)$/;
    if (testEmailDomains.test(email)) {
        return true;
    }

    if (/test\d*@/.test(email) || email.includes('+test@')) {
        return true;
    }

    if (/^(test|demo|prueba|fake|dummy)/.test(username)) {
        return true;
    }

    if (/_test\d*$/.test(username) || /^test\d+$/.test(username)) {
        return true;
    }

    const knownTestUsernames = new Set([
        'usuario_nuevo',
        'ab',
        'testuser99',
        'pablo_test1'
    ]);
    if (knownTestUsernames.has(username)) {
        return true;
    }

    return false;
}

function formatUserForAdminList(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name || null,
        is_verified: Boolean(user.is_verified),
        is_admin: Boolean(user.is_admin),
        created_at: user.created_at,
        posts_count: user.posts_count || 0,
        likely_test: isLikelyTestAccount(user)
    };
}

function filterDeletableUserIds(users, options = {}) {
    const adminId = options.adminId != null ? Number(options.adminId) : null;
    const onlyLikelyTest = Boolean(options.onlyLikelyTest);
    const requestedIds = options.userIds ? new Set(options.userIds.map(Number)) : null;

    return users
        .filter((user) => {
            if (!user || user.is_admin) {
                return false;
            }
            if (adminId != null && Number(user.id) === adminId) {
                return false;
            }
            if (requestedIds && !requestedIds.has(Number(user.id))) {
                return false;
            }
            if (onlyLikelyTest && !isLikelyTestAccount(user)) {
                return false;
            }
            return true;
        })
        .map((user) => Number(user.id));
}

module.exports = {
    isLikelyTestAccount,
    formatUserForAdminList,
    filterDeletableUserIds
};
