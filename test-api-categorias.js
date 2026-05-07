// Script para probar la API de categorías
const http = require('http');

function testAPI(category) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api/content/category/${category}?page=1&limit=20`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Error al parsear respuesta: ' + e.message));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function runTests() {
    console.log('\n=== PROBANDO API DE CATEGORÍAS ===\n');

    const categories = [
        'acompañantes-hombres',
        'acompañantes-mujeres',
        'sugar-daddy',
        'masajes'
    ];

    for (const category of categories) {
        try {
            console.log(`\n📁 Categoría: ${category}`);
            const response = await testAPI(category);
            
            if (response.posts) {
                console.log(`   ✓ Respuesta exitosa`);
                console.log(`   📊 Posts encontrados: ${response.posts.length}`);
                
                if (response.posts.length > 0) {
                    console.log(`   📝 Primeros posts:`);
                    response.posts.slice(0, 3).forEach(post => {
                        console.log(`      - "${post.title}" (Usuario: ${post.username || 'N/A'})`);
                    });
                }
            } else {
                console.log(`   ⚠️  No se encontró array de posts en la respuesta`);
                console.log(`   Respuesta:`, JSON.stringify(response, null, 2));
            }
        } catch (error) {
            console.log(`   ✗ Error: ${error.message}`);
        }
    }

    console.log('\n=== FIN DE PRUEBAS ===\n');
    process.exit(0);
}

// Esperar 2 segundos antes de ejecutar (para que el servidor inicie)
setTimeout(runTests, 2000);

