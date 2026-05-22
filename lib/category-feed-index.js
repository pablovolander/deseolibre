const { getBlobAccess, getBlobToken, readableStreamToBuffer } = require('./media-storage');

const INDEX_BLOB_PATH = 'deseo-category-feed-index.json';
const MAX_POSTS_PER_CATEGORY = 150;

async function readFeedIndex() {
    if (!getBlobToken()) {
        return { byCategory: {} };
    }

    try {
        const { get } = require('@vercel/blob');
        const result = await get(INDEX_BLOB_PATH, {
            access: getBlobAccess(),
            token: getBlobToken()
        });

        if (!result || result.statusCode !== 200 || !result.stream) {
            return { byCategory: {} };
        }

        const buffer = await readableStreamToBuffer(result.stream);
        const parsed = JSON.parse(buffer.toString('utf8'));
        return parsed && typeof parsed === 'object' ? parsed : { byCategory: {} };
    } catch (error) {
        if (!String(error.message || '').includes('does not exist')) {
            console.warn('No se pudo leer índice de feeds:', error.message);
        }
        return { byCategory: {} };
    }
}

async function writeFeedIndex(index) {
    if (!getBlobToken()) {
        return;
    }

    const { put } = require('@vercel/blob');
    await put(INDEX_BLOB_PATH, JSON.stringify(index), {
        access: getBlobAccess(),
        token: getBlobToken(),
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true
    });
}

function dedupeAndSort(posts) {
    const map = new Map();
    posts.forEach((post) => {
        if (post && post.id != null) {
            map.set(post.id, post);
        }
    });
    return [...map.values()].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
    });
}

async function addPostToFeedIndex(post, categoryVariants) {
    if (!getBlobToken() || !post || !post.category) {
        return;
    }

    const index = await readFeedIndex();
    const categoriesToUpdate = new Set([post.category, ...(categoryVariants || [])]);

    categoriesToUpdate.forEach((cat) => {
        if (!cat) {
            return;
        }
        const list = index.byCategory[cat] || [];
        const without = list.filter((item) => item.id !== post.id);
        without.unshift(post);
        index.byCategory[cat] = without.slice(0, MAX_POSTS_PER_CATEGORY);
    });

    await writeFeedIndex(index);
}

async function getPostsFromFeedIndex(categoryVariants) {
    if (!getBlobToken()) {
        return [];
    }

    const index = await readFeedIndex();
    let merged = [];

    (categoryVariants || []).forEach((cat) => {
        if (index.byCategory[cat]) {
            merged = merged.concat(index.byCategory[cat]);
        }
    });

    return dedupeAndSort(merged);
}

async function syncPostsToFeedIndex(posts, categoryVariants) {
    if (!getBlobToken() || !posts || !posts.length) {
        return;
    }

    for (const post of posts) {
        await addPostToFeedIndex(post, categoryVariants);
    }
}

module.exports = {
    addPostToFeedIndex,
    getPostsFromFeedIndex,
    syncPostsToFeedIndex
};
