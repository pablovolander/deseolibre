const fs = require('fs');

fs.readdirSync('.').filter((f) => f.startsWith('feed-') && f.endsWith('.html') && f !== 'feed.html').forEach((file) => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('auth-session.js')) {
        return;
    }
    content = content.replace(
        '<script src="/js/api-config.js"></script>',
        '<script src="/js/api-config.js"></script>\n    <script src="/js/auth-session.js"></script>'
    );
    fs.writeFileSync(file, content);
    console.log('patched', file);
});
