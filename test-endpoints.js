// Test para verificar si los endpoints funcionan
const http = require('http');

async function testEndpoint(path, description) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };

        console.log(`\n🔍 Probando: ${description}`);
        console.log(`   URL: http://localhost:3000${path}`);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`   ✅ Status: ${res.statusCode} OK`);
                    try {
                        const json = JSON.parse(data);
                        console.log(`   ✅ Respuesta JSON válida`);
                    } catch (e) {
                        console.log(`   ⚠️  Respuesta no es JSON`);
                    }
                } else {
                    console.log(`   ❌ Status: ${res.statusCode}`);
                    console.log(`   Respuesta:`, data.substring(0, 100));
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Error: ${error.message}`);
            resolve();
        });

        req.end();
    });
}

async function runTests() {
    console.log('═══════════════════════════════════════');
    console.log('   TEST DE ENDPOINTS');
    console.log('═══════════════════════════════════════');

    await testEndpoint('/api/user/public/1', 'Perfil público usuario 1');
    await testEndpoint('/api/user/public/4', 'Perfil público usuario 4');
    await testEndpoint('/api/user/1/posts', 'Posts de usuario 1');
    await testEndpoint('/api/user/4/posts', 'Posts de usuario 4');

    console.log('\n═══════════════════════════════════════');
    console.log('   FIN DE TESTS');
    console.log('═══════════════════════════════════════\n');
}

// Esperar 1 segundo antes de ejecutar
setTimeout(runTests, 1000);

