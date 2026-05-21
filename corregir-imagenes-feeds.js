// Script para corregir las rutas de imágenes en todos los feeds

const fs = require('fs');

const feeds = [
    'feed-acompañantes-hombres.html',
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

const oldCode = `grid.innerHTML = data.posts.map(post => \`
                    <div class="post-card">
                        <img src="\${post.media_url || post.file_url}" class="post-image" alt="\${post.title}">`;

const newCode = `grid.innerHTML = data.posts.map(post => {
                    const imageUrl = \`\${API_URL}\${post.media_url || post.file_url}\`;
                    return \`
                    <div class="post-card">
                        <img src="\${imageUrl}" class="post-image" alt="\${post.title}" onerror="this.src='https://via.placeholder.com/300x250?text=Imagen+No+Disponible'">`;

feeds.forEach(filename => {
    try {
        let content = fs.readFileSync(filename, 'utf8');
        
        if (content.includes(oldCode)) {
            content = content.replace(oldCode, newCode);
            
            // También necesitamos cerrar correctamente el return
            content = content.replace(
                `<div class="post-user">Por: \${post.username}</div>
                        </div>
                    </div>
                \`).join('');`,
                `<div class="post-user">Por: \${post.username}</div>
                        </div>
                    </div>
                    \`;
                }).join('');`
            );
            
            fs.writeFileSync(filename, content, 'utf8');
            console.log(`✓ Corregido: ${filename}`);
        } else {
            console.log(`⚠ No se encontró el código en: ${filename}`);
        }
    } catch (error) {
        console.log(`✗ Error en ${filename}: ${error.message}`);
    }
});

console.log('\n✅ Corrección completada!');

