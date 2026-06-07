const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUserPublishCategory, getCategoryLabel } = require('../lib/content-category');

test('validateUserPublishCategory blocks cross-category publish', () => {
    const user = { category: 'acompañantes-hombres' };
    const bad = validateUserPublishCategory(user, 'acompañantes-mujeres');
    assert.equal(bad.ok, false);
    assert.match(bad.error, /Solo puedes publicar/);

    const ok = validateUserPublishCategory(user, 'acompañantes-hombres');
    assert.equal(ok.ok, true);
    assert.equal(ok.category, 'acompañantes-hombres');
});

test('validateUserPublishCategory allows first publish without profile category', () => {
    const result = validateUserPublishCategory({ category: null }, 'acompañantes-trans');
    assert.equal(result.ok, true);
    assert.equal(result.setUserCategory, true);
});

test('getCategoryLabel returns readable name', () => {
    assert.equal(getCategoryLabel('acompañantes-mujeres'), 'Acompañantes Mujeres');
});
