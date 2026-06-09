const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUserPublishCategory, getCategoryLabel, validateUserCategoryChange, isCategoryLocked } = require('../lib/content-category');

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

test('validateUserCategoryChange blocks category switch after publications', () => {
    const user = { category: 'acompañantes-hombres' };
    assert.equal(isCategoryLocked(user, 2), true);

    const blocked = validateUserCategoryChange(user, 'acompañantes-mujeres', 2);
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /No puedes cambiar de categoría/);

    const same = validateUserCategoryChange(user, 'acompañantes-hombres', 2);
    assert.equal(same.ok, true);
    assert.equal(same.category, 'acompañantes-hombres');
});

test('validateUserCategoryChange allows category edit without publications', () => {
    const user = { category: 'acompañantes-hombres' };
    const result = validateUserCategoryChange(user, 'acompañantes-trans', 0);
    assert.equal(result.ok, true);
    assert.equal(result.category, 'acompañantes-trans');
    assert.equal(result.locked, false);
});
