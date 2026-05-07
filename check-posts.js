const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./deseo_libre.db');

console.log('\n🔍 Verificando publicaciones...\n');

db.all('SELECT id, title, category, content_type, file_url FROM content_posts ORDER BY id DESC LIMIT 10', (err, posts) => {
    if (err) {
        console.error('❌ Error:', err);
        return;
    }
    
    console.log(`📊 Últimas ${posts.length} publicaciones:\n`);
    
    if (posts.length === 0) {
        console.log('⚠️  No hay publicaciones en la base de datos.\n');
    } else {
        posts.forEach((p, i) => {
            console.log(`${i+1}. ID: ${p.id}`);
            console.log(`   Título: ${p.title}`);
            console.log(`   Categoría: ${p.category || 'SIN CATEGORÍA'}`);
            console.log(`   Tipo: ${p.content_type}`);
            console.log(`   Archivo: ${p.file_url}\n`);
        });
    }
    
    // Contar por categoría
    db.all('SELECT category, COUNT(*) as count FROM content_posts GROUP BY category', (err, counts) => {
        if (err) {
            console.error('Error contando:', err);
            db.close();
            return;
        }
        
        console.log('📈 Publicaciones por categoría:\n');
        counts.forEach(c => {
            console.log(`   ${c.category || 'SIN CATEGORÍA'}: ${c.count} publicaciones`);
        });
        console.log('\n');
        
        db.close();
    });
});

