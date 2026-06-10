/**
 * Pinta nombre y botones del perfil propio antes de que termine la carga completa.
 */
(function (global) {
    function decodeTokenUser(token) {
        if (!token) {
            return null;
        }
        try {
            const part = token.split('.')[1];
            if (!part) {
                return null;
            }
            const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json);
            const id = payload.userId ?? payload.id;
            if (id == null) {
                return null;
            }
            return {
                id,
                username: payload.username || '',
                email: payload.email || ''
            };
        } catch (_) {
            return null;
        }
    }

    function readCachedUser() {
        try {
            const raw = global.localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function resolveViewingUserId() {
        const params = new URLSearchParams(global.location.search);
        return params.get('user') || params.get('userId') || null;
    }

    function ownProfileActionsHtml() {
        return `
            <button type="button" class="btn-action btn-primary create-post-btn" onclick="openCreatePostModal()">
                <i class="fas fa-plus"></i> Crear Publicación
            </button>
            <button type="button" class="btn-action btn-secondary edit-profile-btn" onclick="openEditProfileModal()">
                <i class="fas fa-edit"></i> Editar Perfil
            </button>
            <button type="button" class="btn-action btn-secondary" onclick="shareProfile()">
                <i class="fas fa-share"></i>
            </button>`;
    }

    function paintOwnProfileActions() {
        const actions = global.document.getElementById('profileActions');
        if (!actions) {
            return;
        }
        actions.style.display = 'flex';
        if (!actions.querySelector('.edit-profile-btn')) {
            actions.innerHTML = ownProfileActionsHtml();
        }
    }

    function paintProfileHeader() {
        const token = global.localStorage.getItem('authToken');
        const viewId = resolveViewingUserId();
        let user = readCachedUser();

        if (!user && token && !viewId) {
            user = decodeTokenUser(token);
        }

        if (viewId && user && String(viewId) !== String(user.id)) {
            return;
        }

        if (!user && !viewId) {
            if (!token) {
                return;
            }
            user = decodeTokenUser(token);
        }

        if (!user) {
            return;
        }

        const nameEl = global.document.getElementById('profileName');
        const userEl = global.document.getElementById('profileUsername');
        if (nameEl) {
            nameEl.textContent = user.full_name || user.username || 'Mi perfil';
        }
        if (userEl && user.username) {
            userEl.textContent = `@${user.username}`;
        }

        if (!viewId || (user.id != null && String(viewId) === String(user.id))) {
            paintOwnProfileActions();
            global.document.body.classList.add('deseo-own-profile');
            const dangerZone = global.document.getElementById('profileDangerZone');
            if (dangerZone) {
                dangerZone.style.display = 'block';
            }
            const navDelete = global.document.getElementById('navDeleteAccountItem');
            if (navDelete) {
                navDelete.style.display = 'list-item';
            }
        }
    }

    function boot() {
        paintProfileHeader();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    global.DeseoProfileBootstrap = {
        decodeTokenUser,
        readCachedUser,
        paintProfileHeader,
        paintOwnProfileActions,
        ownProfileActionsHtml
    };
})(window);
