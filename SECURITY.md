# 🔒 SECURITY & PRIVACY GUIDELINES
## Deseo Libre - Plataforma para Adultos

### ⚠️ **ADVERTENCIA IMPORTANTE**
Esta plataforma maneja contenido para adultos y datos sensibles. La seguridad y privacidad son **CRÍTICAS** para proteger a los usuarios y cumplir con regulaciones legales.

---

## 🛡️ **MEDIDAS DE SEGURIDAD IMPLEMENTADAS**

### **Autenticación y Autorización**
- ✅ **JWT Tokens** con expiración de 24 horas
- ✅ **Hash de contraseñas** con bcrypt (salt rounds: 10)
- ✅ **Verificación de edad obligatoria** antes del acceso
- ✅ **Middleware de autenticación** en todas las rutas protegidas
- ✅ **Verificación de suspensiones** automática

### **Protección de Datos**
- ✅ **No almacenamiento de fechas de nacimiento** específicas
- ✅ **Solo campos booleanos** para verificación de edad
- ✅ **Encriptación de contraseñas** en base de datos
- ✅ **Validación de entrada** en servidor y cliente
- ✅ **Sanitización de datos** antes de almacenamiento

### **Base de Datos**
- ✅ **SQLite local** (no datos en la nube)
- ✅ **Relaciones de integridad** con foreign keys
- ✅ **Índices únicos** en campos críticos
- ✅ **Logs de verificación** de edad con IP y user agent

---

## 🔐 **RECOMENDACIONES DE SEGURIDAD**

### **1. CONFIGURACIÓN DEL SERVIDOR**

#### **Variables de Entorno**
```bash
# Archivo .env (NUNCA commitear a Git)
JWT_SECRET=tu_clave_secreta_muy_larga_y_compleja_2024
PORT=3000
NODE_ENV=production
DB_PATH=./secure_deseo_libre.db
```

#### **Configuración HTTPS (PRODUCCIÓN)**
```javascript
// Usar certificados SSL válidos
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(443);
```

#### **Headers de Seguridad**
```javascript
// Agregar al servidor
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
});
```

### **2. VALIDACIÓN Y SANITIZACIÓN**

#### **Validación de Entrada**
```javascript
// Ejemplo de validación robusta
const validator = require('validator');

function validateUserInput(data) {
    return {
        username: validator.escape(data.username),
        email: validator.isEmail(data.email),
        phone: validator.isMobilePhone(data.phone),
        description: validator.escape(data.description)
    };
}
```

#### **Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP
    message: 'Demasiadas solicitudes, intenta más tarde'
});

app.use('/api/', limiter);
```

### **3. MONITOREO Y LOGGING**

#### **Sistema de Logs**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// Log de actividades sensibles
function logSensitiveActivity(userId, action, details) {
    logger.info({
        userId,
        action,
        details,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
}
```

#### **Monitoreo de Intrusos**
```javascript
// Detectar intentos de acceso no autorizado
app.use((req, res, next) => {
    if (req.path.includes('admin') || req.path.includes('debug')) {
        logger.warn(`Suspicious access attempt: ${req.ip} - ${req.path}`);
    }
    next();
});
```

---

## 🔒 **PRIVACIDAD Y CUMPLIMIENTO LEGAL**

### **1. GDPR COMPLIANCE**

#### **Derechos del Usuario**
- ✅ **Derecho al olvido** - Eliminación completa de datos
- ✅ **Portabilidad de datos** - Exportar información del usuario
- ✅ **Rectificación** - Corregir datos incorrectos
- ✅ **Acceso** - Ver qué datos se almacenan

#### **Implementación**
```javascript
// Endpoint para eliminar usuario (GDPR)
app.delete('/api/user/data', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    // Eliminar todos los datos relacionados
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.run('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM content_posts WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [userId, userId]);
    
    res.json({ message: 'Datos eliminados completamente' });
});
```

### **2. PROTECCIÓN DE CONTENIDO**

#### **Almacenamiento Seguro**
```javascript
// Usar servicios de almacenamiento seguros
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

// Subir archivos con encriptación
function uploadSecureFile(file, userId) {
    const params = {
        Bucket: 'deseo-libre-secure',
        Key: `users/${userId}/${Date.now()}-${file.originalname}`,
        Body: file.buffer,
        ServerSideEncryption: 'AES256',
        ACL: 'private'
    };
    
    return s3.upload(params).promise();
}
```

#### **URLs Temporales**
```javascript
// Generar URLs firmadas con expiración
function generateSecureUrl(fileKey, expirationMinutes = 60) {
    return s3.getSignedUrl('getObject', {
        Bucket: 'deseo-libre-secure',
        Key: fileKey,
        Expires: expirationMinutes * 60
    });
}
```

---

## 🚨 **RESPONSE A INCIDENTES**

### **1. PLAN DE RESPUESTA**

#### **Niveles de Severidad**
- **CRÍTICO**: Acceso de menores, datos comprometidos
- **ALTO**: Ataques DDoS, intentos de intrusión
- **MEDIO**: Spam masivo, contenido inapropiado
- **BAJO**: Reportes menores, bugs menores

#### **Procedimientos**
```javascript
// Suspensión inmediata por violación crítica
async function emergencySuspend(userId, reason) {
    await db.run(
        'INSERT INTO user_bans (user_id, reason, is_permanent) VALUES (?, ?, 1)',
        [userId, reason]
    );
    
    // Invalidar todos los tokens del usuario
    await invalidateUserTokens(userId);
    
    // Notificar al equipo de seguridad
    await notifySecurityTeam(userId, reason);
}
```

### **2. BACKUP Y RECUPERACIÓN**

#### **Backup Automático**
```bash
#!/bin/bash
# backup.sh - Ejecutar diariamente
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/secure/backups"
DB_PATH="./deseo_libre.db"

# Crear backup de la base de datos
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/deseo_libre_$DATE.db'"

# Comprimir y encriptar
gzip "$BACKUP_DIR/deseo_libre_$DATE.db"
openssl enc -aes-256-cbc -in "$BACKUP_DIR/deseo_libre_$DATE.db.gz" -out "$BACKUP_DIR/deseo_libre_$DATE.db.gz.enc" -k $BACKUP_PASSWORD

# Eliminar archivos sin encriptar
rm "$BACKUP_DIR/deseo_libre_$DATE.db.gz"

# Mantener solo los últimos 30 días
find $BACKUP_DIR -name "*.enc" -mtime +30 -delete
```

---

## 🔍 **AUDITORÍA Y MONITOREO**

### **1. LOGS DE AUDITORÍA**

#### **Eventos Críticos a Registrar**
- ✅ **Registros de usuarios** con IP y timestamp
- ✅ **Verificaciones de edad** con detalles
- ✅ **Accesos a contenido** sensible
- ✅ **Reportes enviados** con contexto
- ✅ **Suspensiones y bans** con razones
- ✅ **Intentos de acceso** no autorizado

#### **Implementación**
```javascript
const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/audit.log',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

function auditLog(action, userId, details, req) {
    auditLogger.info({
        action,
        userId,
        details,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
}
```

### **2. MONITOREO EN TIEMPO REAL**

#### **Métricas de Seguridad**
```javascript
const prometheus = require('prom-client');

// Métricas personalizadas
const loginAttempts = new prometheus.Counter({
    name: 'login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['status']
});

const ageVerifications = new prometheus.Counter({
    name: 'age_verifications_total',
    help: 'Total number of age verifications',
    labelNames: ['verified']
});

const reportsSubmitted = new prometheus.Counter({
    name: 'reports_submitted_total',
    help: 'Total number of reports submitted',
    labelNames: ['type']
});
```

---

## 🛠️ **HERRAMIENTAS RECOMENDADAS**

### **1. DEPENDENCIAS DE SEGURIDAD**
```json
{
  "dependencies": {
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0",
    "express-validator": "^6.15.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "winston": "^3.8.2",
    "prom-client": "^14.2.0"
  },
  "devDependencies": {
    "eslint-plugin-security": "^1.7.1",
    "husky": "^8.0.3",
    "lint-staged": "^13.2.0"
  }
}
```

### **2. CONFIGURACIÓN DE ESLINT**
```javascript
// .eslintrc.js
module.exports = {
    extends: [
        'plugin:security/recommended'
    ],
    rules: {
        'security/detect-object-injection': 'error',
        'security/detect-non-literal-regexp': 'error',
        'security/detect-unsafe-regex': 'error'
    }
};
```

### **3. GIT HOOKS**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run security-check"
    }
  },
  "lint-staged": {
    "*.js": ["eslint --fix", "git add"]
  }
}
```

---

## 📋 **CHECKLIST DE SEGURIDAD**

### **Desarrollo**
- [ ] Variables de entorno configuradas
- [ ] Validación de entrada implementada
- [ ] Rate limiting configurado
- [ ] Headers de seguridad agregados
- [ ] Logs de auditoría implementados
- [ ] Tests de seguridad ejecutados

### **Despliegue**
- [ ] HTTPS configurado
- [ ] Certificados SSL válidos
- [ ] Firewall configurado
- [ ] Backup automático activado
- [ ] Monitoreo configurado
- [ ] Plan de respuesta a incidentes listo

### **Operaciones**
- [ ] Logs revisados regularmente
- [ ] Actualizaciones de seguridad aplicadas
- [ ] Backup verificado
- [ ] Métricas monitoreadas
- [ ] Incidentes documentados
- [ ] Equipo entrenado en procedimientos

---

## 🚨 **CONTACTOS DE EMERGENCIA**

### **Equipo de Seguridad**
- **Email**: security@deseolibre.com
- **Teléfono**: +34 900 123 456 (24/7)
- **Slack**: #security-alerts

### **Procedimientos de Emergencia**
1. **Evaluar severidad** del incidente
2. **Contener** la amenaza inmediatamente
3. **Notificar** al equipo de seguridad
4. **Documentar** todos los pasos tomados
5. **Comunicar** con usuarios afectados si es necesario
6. **Post-mortem** y mejoras preventivas

---

## 📚 **RECURSOS ADICIONALES**

### **Documentación Legal**
- [GDPR Compliance Guide](https://gdpr.eu/)
- [COPPA Compliance](https://www.ftc.gov/tips-advice/business-center/guidance/complying-coppa-frequently-asked-questions)
- [Adult Content Platform Guidelines](https://example.com/adult-platform-guidelines)

### **Herramientas de Seguridad**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)

---

**⚠️ RECORDATORIO IMPORTANTE**: La seguridad es responsabilidad de todo el equipo. Cualquier vulnerabilidad debe reportarse inmediatamente al equipo de seguridad.

**Última actualización**: Diciembre 2024
**Próxima revisión**: Enero 2025
