// Script para generar todos los feeds funcionales

const fs = require('fs');

const categories = [
    { id: 'acompañantes', name: 'Acompañantes', icon: '💋', template: 'feed-acompañantes.html', skipGenerate: true },
    { id: 'masajes', name: 'Masajes', icon: '💆' },
    { id: 'sugar-daddy', name: 'Sugar Daddy', icon: '💎' },
    { id: 'sugar-mommy', name: 'Sugar Mommy', icon: '👑' }
];

const template = fs.readFileSync('feed-test-funcional.html', 'utf8');

categories.forEach(category => {
    if (category.skipGenerate) {
        console.log(`⊘ Omitido (página dedicada): feed-${category.id}.html`);
        return;
    }
    let content = template;
    
    // Reemplazar título
    content = content.replace(/<title>.*?<\/title>/, `<title>Feed ${category.name} - Deseo Libre</title>`);
    
    // Reemplazar h1
    content = content.replace(/<h1>.*?<\/h1>/, `<h1>${category.icon} Feed ${category.name}</h1>`);
    
    // Reemplazar CATEGORY constante
    content = content.replace(/const CATEGORY = '.*?';/, `const CATEGORY = '${category.id}';`);
    
    // Guardar archivo
    const filename = `feed-${category.id}.html`;
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`✓ Creado: ${filename}`);
});

console.log('\n✅ Todos los feeds han sido generados correctamente!');

