const fs = require('fs');
const path = require('path');
const {
    getBlobToken,
    normalizeStoredMediaUrl
} = require('./media-storage');

function collectUrl(value, set) {
    if (value && typeof value === 'string' && value.trim()) {
        set.add(value.trim());
    }
}

function collectFromVerificationJson(raw, set) {
    if (!raw) {
        return;
    }
    try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') {
            return;
        }
        [
            'id_front_url',
            'id_back_url',
            'selfie_url',
            'body_video_url',
            'public_body_video_url'
        ].forEach((key) => collectUrl(data[key], set));
    } catch {
        // ignore malformed verification payloads
    }
}

function collectMediaUrlsFromRecords(records) {
    const urls = new Set();
    const user = records.user || {};
    const profile = records.profile || {};

    collectUrl(user.profile_picture, urls);
    collectUrl(user.cover_photo, urls);
    collectUrl(profile.profile_image_url, urls);
    collectUrl(profile.body_verification_video_url, urls);
    collectUrl(profile.public_body_video_url, urls);

    (records.posts || []).forEach((post) => {
        collectUrl(post.file_url, urls);
        collectUrl(post.thumbnail_url, urls);
    });

    (records.reels || []).forEach((reel) => {
        collectUrl(reel.video_url, urls);
        collectUrl(reel.thumbnail_url, urls);
    });

    (records.verifications || []).forEach((row) => {
        collectFromVerificationJson(row.verification_data, urls);
    });

    return [...urls];
}

function mediaUrlToBlobPathname(storedUrl) {
    if (!storedUrl) {
        return null;
    }

    const normalized = normalizeStoredMediaUrl(storedUrl);
    if (normalized.startsWith('/api/media/')) {
        return decodeURIComponent(normalized.replace(/^\/api\/media\//, ''));
    }

    if (storedUrl.includes('.blob.vercel-storage.com/')) {
        try {
            const url = new URL(storedUrl);
            return decodeURIComponent(url.pathname.replace(/^\//, ''));
        } catch {
            return null;
        }
    }

    if (normalized.startsWith('/uploads/')) {
        return normalized.slice(1);
    }
    if (normalized.startsWith('uploads/')) {
        return normalized;
    }

    return null;
}

function mediaUrlToLocalPath(storedUrl, localPublicDir) {
    const normalized = normalizeStoredMediaUrl(storedUrl);
    if (!normalized || !normalized.startsWith('/uploads/')) {
        return null;
    }
    return path.join(localPublicDir, normalized);
}

async function deleteStoredMediaUrl(storedUrl, options = {}) {
    const localPublicDir = options.localPublicDir || path.join(process.cwd(), 'public');
    const localPath = mediaUrlToLocalPath(storedUrl, localPublicDir);
    if (localPath && fs.existsSync(localPath)) {
        try {
            fs.unlinkSync(localPath);
        } catch (err) {
            console.warn('No se pudo borrar archivo local:', localPath, err.message);
        }
    }

    const pathname = mediaUrlToBlobPathname(storedUrl);
    if (!pathname || !getBlobToken()) {
        return;
    }

    try {
        const { del } = require('@vercel/blob');
        await del(pathname, { token: getBlobToken() });
    } catch (err) {
        console.warn('No se pudo borrar blob:', pathname, err.message);
    }
}

async function deleteStoredMediaUrls(urls, options = {}) {
    const unique = [...new Set((urls || []).filter(Boolean))];
    for (const url of unique) {
        await deleteStoredMediaUrl(url, options);
    }
}

async function deleteUserAccountData(dbOps, userId, options = {}) {
    const uid = Number(userId);
    if (!Number.isFinite(uid)) {
        throw new Error('ID de usuario inválido');
    }

    const { run, all, get } = dbOps;

    const user = await get('SELECT * FROM users WHERE id = ?', [uid]);
    if (!user) {
        return { ok: false, error: 'Usuario no encontrado' };
    }

    if (user.is_admin && !options.allowAdminDelete) {
        return { ok: false, error: 'Las cuentas de administrador no pueden eliminarse desde la app' };
    }

    const profile = await get('SELECT * FROM user_profiles WHERE user_id = ?', [uid]);
    const posts = await all('SELECT id, file_url, thumbnail_url FROM content_posts WHERE user_id = ?', [uid]);
    const reels = await all('SELECT id, video_url, thumbnail_url FROM reels WHERE user_id = ?', [uid]);
    const verifications = await all(
        'SELECT verification_data FROM user_verifications WHERE user_id = ?',
        [uid]
    );

    const mediaUrls = collectMediaUrlsFromRecords({
        user,
        profile,
        posts,
        reels,
        verifications
    });

    const postIds = posts.map((p) => p.id);
    const reelIds = reels.map((r) => r.id);

    if (postIds.length) {
        const placeholders = postIds.map(() => '?').join(', ');
        await run(`DELETE FROM post_likes WHERE post_id IN (${placeholders})`, postIds);
        await run(`DELETE FROM post_comments WHERE post_id IN (${placeholders})`, postIds);
        await run(`DELETE FROM post_shares WHERE post_id IN (${placeholders})`, postIds);
        await run(`DELETE FROM reports WHERE reported_post_id IN (${placeholders})`, postIds);
    }

    if (reelIds.length) {
        const placeholders = reelIds.map(() => '?').join(', ');
        await run(`DELETE FROM reel_likes WHERE reel_id IN (${placeholders})`, reelIds);
        await run(`DELETE FROM reel_comments WHERE reel_id IN (${placeholders})`, reelIds);
    }

    await run('DELETE FROM post_likes WHERE user_id = ?', [uid]);
    await run('DELETE FROM post_comments WHERE user_id = ?', [uid]);
    await run('DELETE FROM post_shares WHERE user_id = ?', [uid]);
    await run('DELETE FROM reel_likes WHERE user_id = ?', [uid]);
    await run('DELETE FROM reel_comments WHERE user_id = ?', [uid]);
    await run('DELETE FROM notifications WHERE user_id = ? OR related_user_id = ?', [uid, uid]);
    await run('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [uid, uid]);
    await run('DELETE FROM user_follows WHERE follower_id = ? OR following_id = ?', [uid, uid]);
    await run('DELETE FROM user_interests WHERE user_id = ?', [uid]);
    await run('DELETE FROM user_bans WHERE user_id = ?', [uid]);
    await run('UPDATE user_bans SET banned_by = NULL WHERE banned_by = ?', [uid]);
    await run('DELETE FROM public_video_challenges WHERE user_id = ?', [uid]);
    await run('DELETE FROM content_posts WHERE user_id = ?', [uid]);
    await run('DELETE FROM reels WHERE user_id = ?', [uid]);
    await run('DELETE FROM user_verifications WHERE user_id = ?', [uid]);
    await run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);
    await run('DELETE FROM users WHERE id = ?', [uid]);

    await deleteStoredMediaUrls(mediaUrls, options);

    return {
        ok: true,
        deleted_user_id: uid,
        media_files_attempted: mediaUrls.length
    };
}

module.exports = {
    collectMediaUrlsFromRecords,
    mediaUrlToBlobPathname,
    deleteStoredMediaUrls,
    deleteUserAccountData
};
