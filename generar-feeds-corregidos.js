// Generar feeds de categorías (masajes, sugar). Acompañantes usa feed-acompañantes.html.

const fs = require('fs');

const categories = [
    { id: 'masajes', name: 'Masajes', icon: '💆' },
    { id: 'sugar-daddy', name: 'Sugar Daddy', icon: '💎' },
    { id: 'sugar-mommy', name: 'Sugar Mommy', icon: '👑' }
];

const templatePath = 'feed-masajes.html';
if (!fs.existsSync(templatePath)) {
    console.error('No se encontró plantilla:', templatePath);
    process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');

categories.forEach(category => {
    let content = template;
    content = content.replace(/<title>.*?<\/title>/, `<title>Feed ${category.name} - Deseo Libre</title>`);
    content = content.replace(/<h1>.*?<\/h1>/, `<h1>${category.icon} Feed ${category.name}</h1>`);
    content = content.replace(/const CATEGORY = '.*?';/, `const CATEGORY = '${category.id}';`);
    const filename = `feed-${category.id}.html`;
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`✓ Generado: ${filename}`);
});

console.log('\n✅ Feeds regenerados. Acompañantes: feed-acompañantes.html (directorio unificado).');
