// Diagnóstico para verificar las publicaciones y sus categorías

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./deseo_libre.db');

console.log('\n=== DIAGNÓSTICO DE CATEGORÍAS ===\n');

// Verificar todas las publicaciones
db.all('SELECT id, title, category, user_id, is_public, created_at FROM content_posts ORDER BY created_at DESC', [], (err, posts) => {
    if (err) {
        console.error('Error al cargar publicaciones:', err);
        return;
    }

    console.log(`📊 Total de publicaciones: ${posts.length}\n`);

    if (posts.length === 0) {
        console.log('⚠️  No hay publicaciones en la base de datos\n');
        db.close();
        return;
    }

    // Agrupar por categoría
    const byCategory = {};
    posts.forEach(post => {
        const cat = post.category || 'sin-categoria';
        if (!byCategory[cat]) {
            byCategory[cat] = [];
        }
        byCategory[cat].push(post);
    });

    console.log('📋 Publicaciones por categoría:\n');
    Object.keys(byCategory).forEach(cat => {
        console.log(`   ${cat}: ${byCategory[cat].length} publicaciones`);
        byCategory[cat].forEach(post => {
            const publicStatus = post.is_public ? '✓ Público' : '✗ Privado';
            console.log(`      - ID ${post.id}: "${post.title}" (${publicStatus})`);
        });
        console.log('');
    });

    // Verificar usuarios
    db.all('SELECT id, username, is_verified FROM users', [], (err, users) => {
        if (err) {
            console.error('Error al cargar usuarios:', err);
            db.close();
            return;
        }

        console.log(`👥 Total de usuarios: ${users.length}\n`);

        users.forEach(user => {
            const verifiedStatus = user.is_verified ? '✓' : '✗';
            const userPosts = posts.filter(p => p.user_id === user.id);
            console.log(`   ${verifiedStatus} ${user.username} (ID ${user.id}): ${userPosts.length} publicaciones`);
        });

        console.log('\n');
        console.log('=== FIN DEL DIAGNÓSTICO ===\n');

        db.close();
    });
});

