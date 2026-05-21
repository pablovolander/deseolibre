const fs = require('fs');
const path = require('path');

const categoryFiles = [
    'feed-acompañantes-mujeres.html',
    'feed-acompañantes-trans.html',
    'feed-sugar-daddy.html',
    'feed-sugar-mommy.html',
    'feed-contenido-exclusivo.html',
    'feed-swinger.html',
    'feed-masajes.html',
    'feed-lesbiana.html',
    'feed-hetero.html',
    'feed-gay.html'
];

const oldCode = `            if (authToken) {
                defaultOptions.headers['Authorization'] = \`Bearer \${authToken}\`;
            }`;

const newCode = `            // Only send token if it exists AND we're making a POST/PUT/DELETE request
            // GET requests for public content don't need authentication
            if (authToken && options.method && options.method !== 'GET') {
                defaultOptions.headers['Authorization'] = \`Bearer \${authToken}\`;
            }`;

let updated = 0;
let errors = 0;

categoryFiles.forEach(file => {
    try {
        const filePath = path.join(__dirname, file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Archivo no encontrado: ${file}`);
            return;
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes(oldCode)) {
            content = content.replace(oldCode, newCode);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Actualizado: ${file}`);
            updated++;
        } else if (content.includes(newCode)) {
            console.log(`ℹ️  Ya actualizado: ${file}`);
        } else {
            console.log(`⚠️  No se encontró el código en: ${file}`);
        }
    } catch (error) {
        console.error(`❌ Error en ${file}:`, error.message);
        errors++;
    }
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ Archivos actualizados: ${updated}`);
console.log(`❌ Errores: ${errors}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

