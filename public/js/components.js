// ============================================
// DESEO LIBRE - COMPONENTES REUTILIZABLES
// ============================================

// API_URL se detecta automáticamente según el entorno
const API_URL = (function() {
    // Si estamos en producción, usar el mismo origen
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.origin;
    }
    // En desarrollo, usar localhost:3000
    return 'http://localhost:3000';
})();

// ============================================
// POST CARD COMPONENT
// ============================================

function createPostCard(post, options = {}) {
    const {
        showUser = true,
        showActions = true,
        onLike = null,
        onComment = null,
        onShare = null
    } = options;

    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;

    // User header
    let userHeader = '';
    if (showUser && post.username) {
        userHeader = `
            <div class="post-header">
                <div class="post-user-info" onclick="window.location.href='profile.html?userId=${post.user_id}'">
                    <img src="${API_URL}${post.profile_picture || '/uploads/default-avatar.png'}" 
                         alt="${post.username}" 
                         class="post-user-avatar">
                    <div class="post-user-details">
                        <div class="post-username">
                            ${post.username}
                            ${post.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                        </div>
                        <div class="post-time">${formatTimeAgo(post.created_at)}</div>
                    </div>
                </div>
                <button class="post-menu-btn" onclick="showPostMenu(${post.id})">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
            </div>
        `;
    }

    // Media content
    const mediaContent = getPostMedia(post);

    // Post info
    const postInfo = `
        <div class="post-info">
            ${post.title ? `<h3 class="post-title">${escapeHtml(post.title)}</h3>` : ''}
            ${post.description ? `<p class="post-description">${escapeHtml(post.description)}</p>` : ''}
            <div class="post-meta">
                <span class="post-category">
                    <i class="fas fa-tag"></i> ${getCategoryName(post.category)}
                </span>
                ${post.is_premium ? '<span class="post-premium"><i class="fas fa-crown"></i> Premium</span>' : ''}
            </div>
        </div>
    `;

    // Actions
    let actions = '';
    if (showActions) {
        actions = `
            <div class="post-actions">
                <button class="action-btn like-btn" data-post-id="${post.id}" onclick="handleLike(${post.id})">
                    <i class="far fa-heart"></i>
                    <span class="count">${post.likes_count || 0}</span>
                </button>
                <button class="action-btn comment-btn" onclick="showComments(${post.id})">
                    <i class="far fa-comment"></i>
                    <span class="count">${post.comments_count || 0}</span>
                </button>
                <button class="action-btn share-btn" onclick="handleShare(${post.id})">
                    <i class="far fa-share-square"></i>
                    <span class="count">0</span>
                </button>
            </div>
        `;
    }

    card.innerHTML = `
        ${userHeader}
        <div class="post-media">
            ${mediaContent}
        </div>
        ${postInfo}
        ${actions}
        <div class="post-comments" id="comments-${post.id}" style="display: none;"></div>
    `;

    return card;
}

function getPostMedia(post) {
    const mediaUrl = post.media_url || post.file_url;
    
    if (!mediaUrl) {
        return `<div class="no-media"><i class="fas fa-image"></i></div>`;
    }

    const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${API_URL}${mediaUrl}`;

    switch (post.content_type) {
        case 'photo':
            return `<img src="${fullUrl}" alt="${post.title || 'Foto'}" class="post-image" loading="lazy">`;
        case 'video':
            return `
                <video controls class="post-video" preload="metadata">
                    <source src="${fullUrl}" type="video/mp4">
                    Tu navegador no soporta el tag de video.
                </video>
            `;
        case 'audio':
            return `
                <div class="audio-player">
                    <i class="fas fa-music audio-icon"></i>
                    <audio controls class="post-audio">
                        <source src="${fullUrl}" type="audio/mpeg">
                        Tu navegador no soporta el tag de audio.
                    </audio>
                </div>
            `;
        default:
            return `<div class="no-media"><i class="fas fa-file"></i></div>`;
    }
}

// ============================================
// USER CARD COMPONENT
// ============================================

function createUserCard(user, options = {}) {
    const {
        showFollowButton = true,
        showStats = true,
        onFollow = null
    } = options;

    const card = document.createElement('div');
    card.className = 'user-card';
    card.dataset.userId = user.id;

    const stats = showStats ? `
        <div class="user-stats">
            <div class="stat">
                <span class="stat-value">${user.posts_count || 0}</span>
                <span class="stat-label">Posts</span>
            </div>
            <div class="stat">
                <span class="stat-value">${user.followers_count || 0}</span>
                <span class="stat-label">Seguidores</span>
            </div>
        </div>
    ` : '';

    const followButton = showFollowButton ? `
        <button class="follow-btn" data-user-id="${user.id}" onclick="handleFollow(${user.id})">
            <i class="fas fa-user-plus"></i> Seguir
        </button>
    ` : '';

    card.innerHTML = `
        <div class="user-card-header" onclick="window.location.href='profile.html?userId=${user.id}'">
            <img src="${API_URL}${user.profile_picture || '/uploads/default-avatar.png'}" 
                 alt="${user.username}" 
                 class="user-avatar">
            <div class="user-info">
                <div class="user-name">
                    ${user.full_name || user.username}
                    ${user.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                </div>
                <div class="user-username">@${user.username}</div>
                ${user.bio ? `<p class="user-bio">${escapeHtml(user.bio).substring(0, 60)}${user.bio.length > 60 ? '...' : ''}</p>` : ''}
            </div>
        </div>
        ${stats}
        ${followButton}
    `;

    return card;
}

// ============================================
// NOTIFICATION ITEM COMPONENT
// ============================================

function createNotificationItem(notification) {
    const item = document.createElement('div');
    item.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
    item.dataset.notificationId = notification.id;

    const icon = getNotificationIcon(notification.type);
    const avatar = notification.related_user_picture 
        ? `${API_URL}${notification.related_user_picture}` 
        : `${API_URL}/uploads/default-avatar.png`;

    item.innerHTML = `
        <img src="${avatar}" alt="${notification.related_username}" class="notification-avatar">
        <div class="notification-content">
            <div class="notification-icon ${notification.type}">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="notification-text">
                ${escapeHtml(notification.content)}
            </div>
            <div class="notification-time">${formatTimeAgo(notification.created_at)}</div>
        </div>
    `;

    item.onclick = () => handleNotificationClick(notification);

    return item;
}

function getNotificationIcon(type) {
    const icons = {
        'follow': 'user-plus',
        'like': 'heart',
        'comment': 'comment',
        'share': 'share-square',
        'mention': 'at'
    };
    return icons[type] || 'bell';
}

// ============================================
// COMMENT COMPONENT
// ============================================

function createCommentElement(comment) {
    const elem = document.createElement('div');
    elem.className = 'comment';
    elem.dataset.commentId = comment.id;

    elem.innerHTML = `
        <img src="${API_URL}${comment.profile_picture || '/uploads/default-avatar.png'}" 
             alt="${comment.username}" 
             class="comment-avatar">
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-username" onclick="window.location.href='profile.html?userId=${comment.user_id}'">
                    ${comment.username}
                    ${comment.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                </span>
                <span class="comment-time">${formatTimeAgo(comment.created_at)}</span>
            </div>
            <p class="comment-text">${escapeHtml(comment.comment)}</p>
        </div>
    `;

    return elem;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Ahora';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)}d`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryName(category) {
    const categories = {
        'acompañantes-mujeres': 'Acompañantes Mujeres',
        'acompañantes-hombres': 'Acompañantes Hombres',
        'acompañantes-trans': 'Acompañantes Trans',
        'sugar-daddy': 'Sugar Daddy',
        'sugar-mommy': 'Sugar Mommy',
        'contenido-exclusivo': 'Contenido Exclusivo',
        'audios-eroticos': 'Audios Eróticos',
        'articulos-eroticos': 'Artículos Eróticos',
        'swinger': 'Swinger',
        'masajes': 'Masajes',
        'lesbiana': 'Comunidad Lésbica',
        'hetero': 'Comunidad Hetero',
        'gay': 'Comunidad Gay'
    };
    return categories[category] || category;
}

// ============================================
// INTERACTION HANDLERS
// ============================================

async function handleLike(postId) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Debes iniciar sesión para dar like');
        return;
    }

    const btn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
    const isLiked = btn.classList.contains('liked');

    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/${isLiked ? 'unlike' : 'like'}`, {
            method: isLiked ? 'DELETE' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            btn.classList.toggle('liked');
            const icon = btn.querySelector('i');
            icon.className = isLiked ? 'far fa-heart' : 'fas fa-heart';
            
            const countSpan = btn.querySelector('.count');
            let count = parseInt(countSpan.textContent);
            countSpan.textContent = isLiked ? count - 1 : count + 1;
        }
    } catch (error) {
        console.error('Error al dar like:', error);
    }
}

async function handleFollow(userId) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Debes iniciar sesión para seguir usuarios');
        return;
    }

    const btn = document.querySelector(`.follow-btn[data-user-id="${userId}"]`);
    const isFollowing = btn.classList.contains('following');

    try {
        const response = await fetch(`${API_URL}/api/users/${userId}/${isFollowing ? 'unfollow' : 'follow'}`, {
            method: isFollowing ? 'DELETE' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            btn.classList.toggle('following');
            btn.innerHTML = isFollowing 
                ? '<i class="fas fa-user-plus"></i> Seguir'
                : '<i class="fas fa-user-check"></i> Siguiendo';
        }
    } catch (error) {
        console.error('Error al seguir usuario:', error);
    }
}

async function handleShare(postId) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Debes iniciar sesión para compartir');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/share`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('¡Publicación compartida exitosamente!');
            const btn = document.querySelector(`.share-btn[data-post-id="${postId}"] .count`);
            if (btn) {
                btn.textContent = parseInt(btn.textContent) + 1;
            }
        }
    } catch (error) {
        console.error('Error al compartir:', error);
    }
}

async function showComments(postId) {
    const commentsDiv = document.getElementById(`comments-${postId}`);
    
    if (commentsDiv.style.display === 'none') {
        commentsDiv.style.display = 'block';
        await loadComments(postId);
    } else {
        commentsDiv.style.display = 'none';
    }
}

async function loadComments(postId) {
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/comments`);
        const data = await response.json();

        const commentsDiv = document.getElementById(`comments-${postId}`);
        commentsDiv.innerHTML = `
            <div class="comments-header">
                <h4>Comentarios (${data.comments.length})</h4>
            </div>
            <div class="comments-list">
                ${data.comments.map(comment => createCommentElement(comment).outerHTML).join('')}
            </div>
            <div class="comment-form">
                <input type="text" 
                       placeholder="Escribe un comentario..." 
                       id="comment-input-${postId}"
                       maxlength="500">
                <button onclick="submitComment(${postId})">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
    } catch (error) {
        console.error('Error al cargar comentarios:', error);
    }
}

async function submitComment(postId) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Debes iniciar sesión para comentar');
        return;
    }

    const input = document.getElementById(`comment-input-${postId}`);
    const comment = input.value.trim();

    if (!comment) return;

    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comment })
        });

        if (response.ok) {
            input.value = '';
            await loadComments(postId);
            
            // Update comment count
            const btn = document.querySelector(`.comment-btn[onclick="showComments(${postId})"] .count`);
            if (btn) {
                btn.textContent = parseInt(btn.textContent) + 1;
            }
        }
    } catch (error) {
        console.error('Error al enviar comentario:', error);
    }
}

function handleNotificationClick(notification) {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Mark as read
    fetch(`${API_URL}/api/notifications/${notification.id}/read`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    // Navigate to related content
    if (notification.related_post_id) {
        window.location.href = `post.html?id=${notification.related_post_id}`;
    } else if (notification.related_user_id) {
        window.location.href = `profile.html?userId=${notification.related_user_id}`;
    }
}

function showPostMenu(postId) {
    // TODO: Implement post menu (report, share link, etc.)
    alert('Menú de publicación - Próximamente');
}

// ============================================
// LOADING STATES
// ============================================

function showLoadingSpinner(container) {
    container.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-circle-notch fa-spin"></i>
            <p>Cargando...</p>
        </div>
    `;
}

function showEmptyState(container, message, icon = 'inbox') {
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-${icon}"></i>
            <h3>${message}</h3>
        </div>
    `;
}

function showErrorState(container, message) {
    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="retry-btn">Reintentar</button>
        </div>
    `;
}


