// Probar codificación de URLs con ñ
const http = require('http');

async function testCategory(categoryRaw, categoryEncoded) {
    console.log(`\n🔍 Probando: "${categoryRaw}"`);
    console.log(`   URL sin codificar: /api/content/category/${categoryRaw}`);
    console.log(`   URL codificada: /api/content/category/${categoryEncoded}`);
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api/content/category/${categoryEncoded}`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`   ✓ Respuesta exitosa: ${response.posts?.length || 0} posts`);
                    resolve(true);
                } catch (e) {
                    console.log(`   ✗ Error de parsing: ${e.message}`);
                    console.log(`   Respuesta raw (primeros 200 chars):`, data.substring(0, 200));
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`   ✗ Error de conexión: ${error.message}`);
            resolve(false);
        });

        req.end();
    });
}

async function main() {
    console.log('\n=== PRUEBA DE CODIFICACIÓN DE URL ===');
    
    await testCategory('acompañantes-hombres', encodeURIComponent('acompañantes-hombres'));
    await testCategory('acompañantes-mujeres', encodeURIComponent('acompañantes-mujeres'));
    await testCategory('sugar-daddy', 'sugar-daddy');
    
    console.log('\n=== FIN DE PRUEBA ===\n');
    process.exit(0);
}

setTimeout(main, 1000);

