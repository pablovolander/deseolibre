const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🔍 DIAGNÓSTICO DEL SERVIDOR DESEO LIBRE');
console.log('=====================================\n');

// 1. Verificar archivos necesarios
console.log('1. Verificando archivos necesarios...');
const requiredFiles = [
    'server.js',
    'index.html',
    'package.json',
    'deseo_libre.db'
];

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} - OK`);
    } else {
        console.log(`   ❌ ${file} - FALTANTE`);
    }
});

// 2. Verificar dependencias
console.log('\n2. Verificando dependencias...');
const requiredModules = [
    'express',
    'sqlite3',
    'jwt',
    'bcryptjs',
    'cors',
    'multer',
    'fs',
    'path'
];

requiredModules.forEach(module => {
    try {
        require(module);
        console.log(`   ✅ ${module} - OK`);
    } catch (error) {
        console.log(`   ❌ ${module} - ERROR: ${error.message}`);
    }
});

// 3. Verificar base de datos
console.log('\n3. Verificando base de datos...');
try {
    const db = new sqlite3.Database('deseo_libre.db');
    
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
            console.log(`   ❌ Error accediendo a la base de datos: ${err.message}`);
        } else if (row) {
            console.log('   ✅ Tabla users - OK');
        } else {
            console.log('   ❌ Tabla users - NO EXISTE');
        }
        
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='content_posts'", (err, row) => {
            if (err) {
                console.log(`   ❌ Error accediendo a la tabla content_posts: ${err.message}`);
            } else if (row) {
                console.log('   ✅ Tabla content_posts - OK');
            } else {
                console.log('   ❌ Tabla content_posts - NO EXISTE');
            }
            
            db.close();
        });
    });
} catch (error) {
    console.log(`   ❌ Error conectando a la base de datos: ${error.message}`);
}

// 4. Verificar puerto
console.log('\n4. Verificando puerto 3000...');
const net = require('net');
const server = net.createServer();

server.listen(3000, () => {
    console.log('   ✅ Puerto 3000 - DISPONIBLE');
    server.close();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('   ⚠️  Puerto 3000 - EN USO (servidor ya ejecutándose)');
    } else {
        console.log(`   ❌ Error en puerto 3000: ${err.message}`);
    }
});

// 5. Verificar directorio de uploads
console.log('\n5. Verificando directorio de uploads...');
const uploadDir = 'public/uploads';
if (fs.existsSync(uploadDir)) {
    console.log('   ✅ Directorio public/uploads - OK');
} else {
    console.log('   ⚠️  Directorio public/uploads - NO EXISTE (se creará automáticamente)');
}

console.log('\n=====================================');
console.log('🎯 DIAGNÓSTICO COMPLETADO');
console.log('\nPara probar el servidor:');
console.log('1. Ejecuta: node server.js');
console.log('2. Ve a: http://localhost:3000');
console.log('3. O prueba con: http://localhost:3000/test-server.html');
