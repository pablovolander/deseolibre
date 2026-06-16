const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isLikelyTestAccount,
    filterDeletableUserIds
} = require('../lib/admin-users');

test('isLikelyTestAccount detects test.com emails', () => {
    assert.equal(isLikelyTestAccount({ email: 'nuevo@test.com', username: 'realname' }), true);
    assert.equal(isLikelyTestAccount({ email: 'user@example.com', username: 'x' }), true);
});

test('isLikelyTestAccount ignores admin accounts', () => {
    assert.equal(isLikelyTestAccount({ email: 'nuevo@test.com', username: 'admin', is_admin: 1 }), false);
});

test('isLikelyTestAccount ignores normal accounts', () => {
    assert.equal(isLikelyTestAccount({ email: 'maria@gmail.com', username: 'maria_gdl' }), false);
});

test('filterDeletableUserIds respects admin and test filters', () => {
    const users = [
        { id: 1, email: 'admin@site.com', username: 'admin', is_admin: 1 },
        { id: 2, email: 'a@test.com', username: 'test1' },
        { id: 3, email: 'real@gmail.com', username: 'maria' }
    ];
    const ids = filterDeletableUserIds(users, { onlyLikelyTest: true, adminId: 1 });
    assert.deepEqual(ids, [2]);
});
