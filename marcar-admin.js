// Script para marcar un usuario como administrador
// Uso: node marcar-admin.js <username>

const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const db = new sqlite3.Database('./deseo_libre.db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function marcarAdmin(username) {
    db.run(
        'UPDATE users SET is_admin = 1 WHERE username = ?',
        [username],
        function(err) {
            if (err) {
                console.error('❌ Error:', err.message);
                db.close();
                process.exit(1);
            }

            if (this.changes === 0) {
                console.error(`❌ No se encontró el usuario: ${username}`);
                db.close();
                process.exit(1);
            }

            console.log(`✅ Usuario "${username}" marcado como administrador exitosamente`);
            db.close();
            process.exit(0);
        }
    );
}

// Si se pasa el username como argumento
const username = process.argv[2];

if (username) {
    marcarAdmin(username);
} else {
    // Si no, pedir interactivamente
    rl.question('Ingresa el username del usuario a marcar como admin: ', (answer) => {
        if (answer.trim()) {
            marcarAdmin(answer.trim());
        } else {
            console.error('❌ Debes proporcionar un username');
            db.close();
            process.exit(1);
        }
        rl.close();
    });
}

