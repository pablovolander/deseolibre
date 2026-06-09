const test = require('node:test');
const assert = require('node:assert/strict');
const {
    collectMediaUrlsFromRecords,
    mediaUrlToBlobPathname
} = require('../lib/delete-user-account');

test('collectMediaUrlsFromRecords gathers user and post media', () => {
    const urls = collectMediaUrlsFromRecords({
        user: { profile_picture: '/uploads/avatar.jpg', cover_photo: '/api/media/uploads%2Fcover.jpg' },
        profile: { public_body_video_url: '/api/media/uploads/video.mp4' },
        posts: [{ file_url: '/uploads/post1.jpg', thumbnail_url: null }],
        reels: [{ video_url: 'https://abc.public.blob.vercel-storage.com/uploads/reel.mp4' }],
        verifications: [{
            verification_data: JSON.stringify({
                id_front_url: '/uploads/id.jpg',
                selfie_url: '/uploads/selfie.jpg'
            })
        }]
    });

    assert.ok(urls.includes('/uploads/avatar.jpg'));
    assert.ok(urls.includes('/uploads/post1.jpg'));
    assert.ok(urls.includes('/uploads/id.jpg'));
    assert.ok(urls.length >= 6);
});

test('mediaUrlToBlobPathname resolves proxy and blob urls', () => {
    assert.equal(
        mediaUrlToBlobPathname('/api/media/uploads%2Ftest.jpg'),
        'uploads/test.jpg'
    );
    assert.equal(
        mediaUrlToBlobPathname('https://x.public.blob.vercel-storage.com/uploads/a.mp4'),
        'uploads/a.mp4'
    );
});
