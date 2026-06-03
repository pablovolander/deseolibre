const test = require('node:test');
const assert = require('node:assert/strict');

test('category slug variants include legacy acompañantes alias', () => {
    const CATEGORY_ALIASES = {
        'acompanhantes-mujeres': 'acompañantes-mujeres',
        'acompanantes-mujeres': 'acompañantes-mujeres'
    };

    function getCategorySearchVariants(canonical) {
        const variants = new Set([canonical]);
        if (canonical === 'acompañantes-mujeres' || canonical === 'acompañantes-hombres') {
            variants.add('acompañantes');
        }
        Object.entries(CATEGORY_ALIASES).forEach(([alias, target]) => {
            if (target === canonical || target.startsWith(canonical)) {
                variants.add(alias);
                variants.add(target);
            }
        });
        return [...variants];
    }

    const variants = getCategorySearchVariants('acompañantes-mujeres');
    assert.ok(variants.includes('acompañantes'));
    assert.ok(variants.includes('acompanantes-mujeres'));
});

test('dedupe posts by id keeps newest first', () => {
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

    const merged = dedupeAndSort([
        { id: 1, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 2, created_at: '2026-02-01T00:00:00.000Z' },
        { id: 1, created_at: '2026-03-01T00:00:00.000Z', title: 'updated' }
    ]);

    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 1);
    assert.equal(merged[0].title, 'updated');
});

test('dedupe posts by user keeps one profile per user', () => {
    const { dedupePostsByUser } = require('../lib/category-feed-index');

    const merged = dedupePostsByUser([
        { id: 1, user_id: 10, created_at: '2026-01-01T00:00:00.000Z', title: 'old' },
        { id: 2, user_id: 20, created_at: '2026-02-01T00:00:00.000Z' },
        { id: 3, user_id: 10, created_at: '2026-03-01T00:00:00.000Z', title: 'newest' }
    ]);

    assert.equal(merged.length, 2);
    assert.equal(merged.find((p) => p.user_id === 10).title, 'newest');
});
