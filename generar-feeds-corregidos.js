// Generar todos los feeds con imágenes corregidas

const fs = require('fs');

const categories = [
    { id: 'acompañantes-hombres', name: 'Acompañantes Hombres', icon: '👨' },
    { id: 'acompañantes-mujeres', name: 'Acompañantes Mujeres', icon: '👩' },
    { id: 'acompañantes-trans', name: 'Acompañantes Trans', icon: '🏳️‍⚧️' },
    { id: 'masajes', name: 'Masajes', icon: '💆' },
    { id: 'sugar-daddy', name: 'Sugar Daddy', icon: '💎' },
    { id: 'sugar-mommy', name: 'Sugar Mommy', icon: '👑' }
];

// Leer el template base (que ya está corregido)
const template = fs.readFileSync('feed-acompañantes-hombres.html', 'utf8');

categories.forEach(category => {
    let content = template;
    
    // Reemplazar título
    content = content.replace(
        /<title>Feed Acompañantes Hombres - Deseo Libre<\/title>/,
        `<title>Feed ${category.name} - Deseo Libre</title>`
    );
    
    // Reemplazar h1
    content = content.replace(
        /<h1>👨 Feed Acompañantes Hombres<\/h1>/,
        `<h1>${category.icon} Feed ${category.name}</h1>`
    );
    
    // Reemplazar CATEGORY constante
    content = content.replace(
        /const CATEGORY = 'acompañantes-hombres';/,
        `const CATEGORY = '${category.id}';`
    );
    
    // Guardar archivo
    const filename = `feed-${category.id}.html`;
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`✓ Generado: ${filename}`);
});

console.log('\n✅ Todos los feeds han sido regenerados con imágenes corregidas!');
console.log('\n📸 Las imágenes ahora se cargarán correctamente desde:');
console.log('   http://localhost:3000/uploads/...\n');

