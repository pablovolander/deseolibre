// Ver las rutas de las imágenes en la base de datos
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./deseo_libre.db');

console.log('\n=== RUTAS DE IMÁGENES ===\n');

db.all('SELECT id, title, file_url, thumbnail_url, category FROM content_posts ORDER BY id DESC LIMIT 10', [], (err, posts) => {
    if (err) {
        console.error('Error:', err);
        return;
    }

    console.log('Últimas 10 publicaciones:\n');
    
    posts.forEach(post => {
        console.log(`ID ${post.id}: "${post.title}"`);
        console.log(`  Categoría: ${post.category}`);
        console.log(`  file_url: ${post.file_url}`);
        console.log(`  thumbnail_url: ${post.thumbnail_url}`);
        console.log('');
    });

    db.close();
});

