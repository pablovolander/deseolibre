const fs = require('fs');

const files = fs.readdirSync('.').filter(
    (f) => f.startsWith('feed-') && f.endsWith('.html') && f !== 'feed.html'
);

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const match = content.match(/const CATEGORY = '([^']+)'/);
    if (!match) {
        console.log('skip', file);
        continue;
    }

    const category = match[1];
    const start = content.indexOf('<script src="/js/api-config.js"></script>');
    const end = content.lastIndexOf('</script>');
    if (start === -1 || end === -1) {
        console.log('no script block', file);
        continue;
    }

    const before = content.slice(0, start);
    const after = content.slice(end + '</script>'.length);
    const replacement = [
        '    <script src="/js/api-config.js"></script>',
        '    <script src="/js/category-feed.js"></script>',
        `    <script>initCategoryFeedPage('${category}');</script>`
    ].join('\n');

    fs.writeFileSync(file, before + replacement + after);
    console.log('patched', file, category);
}
