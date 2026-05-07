# 🔐 Guía del Panel de Administración - Verificaciones

## 📋 Descripción

Este panel te permite revisar y gestionar manualmente todas las verificaciones de identidad de los usuarios que quieren convertirse en creadores de contenido o ofrecer servicios.

---

## 🚀 Configuración Inicial

### 1. Marcar tu cuenta como Administrador

Para acceder al panel, primero necesitas marcar tu cuenta como administrador:

**Opción 1: Usando el script (Recomendado)**
```bash
node marcar-admin.js tu_username
```

**Opción 2: Directamente en la base de datos**
```bash
# Abre la base de datos con SQLite
sqlite3 deseo_libre.db

# Actualiza tu usuario
UPDATE users SET is_admin = 1 WHERE username = 'tu_username';

# Verifica que funcionó
SELECT username, is_admin FROM users WHERE username = 'tu_username';

# Salir
.exit
```

---

## 🎯 Acceso al Panel

1. **Inicia sesión** en la plataforma con tu cuenta de administrador
2. **Accede al panel** en: `http://localhost:3000/admin-verificaciones.html`

---

## 📊 Funcionalidades del Panel

### Estadísticas en Tiempo Real
- **Pendientes**: Verificaciones que esperan tu revisión
- **Aprobadas**: Verificaciones ya procesadas y aprobadas
- **Rechazadas**: Verificaciones que fueron rechazadas
- **Total**: Número total de verificaciones

### Filtros
- **Todas**: Ver todas las verificaciones
- **Pendientes**: Solo verificaciones pendientes
- **Aprobadas**: Solo verificaciones aprobadas
- **Rechazadas**: Solo verificaciones rechazadas

### Revisión de Documentos
- **Frente del documento**: Cédula, pasaporte o licencia (frente)
- **Reverso del documento**: Cédula, pasaporte o licencia (reverso)
- **Selfie con documento**: Foto del usuario sosteniendo el documento junto a su cara

**Nota**: Haz clic en cualquier imagen para verla en tamaño completo

---

## ✅ Proceso de Aprobación

### Aprobar una Verificación

1. **Revisa los documentos**:
   - Verifica que el documento de identidad sea válido y legible
   - Compara la foto del documento con el selfie
   - Verifica que la persona en el selfie sea la misma del documento

2. **Haz clic en "Aprobar"**
3. **Confirma la acción**
4. El usuario recibirá acceso inmediato para subir contenido

### Rechazar una Verificación

1. **Revisa los documentos** para identificar el problema
2. **Haz clic en "Rechazar"**
3. **Ingresa una razón clara** del rechazo (obligatorio):
   - Ejemplo: "La foto del documento no es legible"
   - Ejemplo: "El selfie no coincide con la foto del documento"
   - Ejemplo: "El documento está vencido"
4. **Confirma el rechazo**
5. El usuario recibirá un mensaje con la razón del rechazo

---

## 📋 Qué Verificar en los Documentos

### ✅ Documento de Identidad
- [ ] Es un documento válido (cédula, pasaporte o licencia)
- [ ] No está vencido
- [ ] Toda la información es legible
- [ ] La foto en el documento es clara

### ✅ Selfie con Documento
- [ ] El rostro de la persona es claramente visible
- [ ] El documento está visible en la foto
- [ ] La persona en el selfie coincide con la foto del documento
- [ ] No hay filtros o efectos que alteren la apariencia
- [ ] La iluminación es adecuada

### ✅ Información General
- [ ] El usuario tiene al menos 18 años
- [ ] Los datos del documento coinciden con la información del perfil (si aplica)

---

## ⚠️ Casos Comunes de Rechazo

### Documentos No Legibles
- **Razón**: "Las fotos del documento no son lo suficientemente claras. Por favor, sube nuevas fotos con mejor iluminación."

### Selfie No Coincide
- **Razón**: "El selfie no coincide con la foto del documento. Por favor, asegúrate de que seas la misma persona."

### Documento Vencido
- **Razón**: "El documento de identidad está vencido. Por favor, sube un documento vigente."

### Documento Incompleto
- **Razón**: "Faltan documentos requeridos. Por favor, sube todas las fotos necesarias (frente, reverso y selfie)."

### Filtros o Efectos
- **Razón**: "Las fotos tienen filtros o efectos que no permiten verificar tu identidad. Por favor, sube fotos sin filtros."

---

## 🔄 Actualización de Datos

- **Botón "Actualizar"**: Recarga todas las estadísticas y verificaciones
- **Auto-refresh**: Los datos se actualizan automáticamente después de aprobar/rechazar

---

## 🔒 Seguridad

- Solo usuarios con `is_admin = 1` pueden acceder al panel
- Todas las peticiones requieren autenticación (JWT token)
- Si no eres admin, serás redirigido automáticamente

---

## 📱 Responsive

El panel funciona en:
- ✅ Desktop
- ✅ Tablet
- ✅ Móvil

---

## 🐛 Solución de Problemas

### "No tienes permisos de administrador"
**Solución**: Asegúrate de haber marcado tu cuenta como admin usando el script o SQL

### "Error al cargar los datos"
**Solución**: 
1. Verifica que el servidor esté ejecutándose
2. Verifica que estés logueado
3. Recarga la página

### Las imágenes no se muestran
**Solución**: 
1. Verifica que los archivos existan en `public/uploads/`
2. Verifica que el servidor esté configurado para servir archivos estáticos

### No aparecen verificaciones
**Solución**: 
- Verifica que haya usuarios que hayan subido documentos de verificación
- Usa el filtro "Todas" para ver todas las verificaciones

---

## 📞 Siguiente Paso

Cuando tengas muchos clientes y quieras automatizar el proceso, puedes integrar una API de verificación automática como:
- **Veriff** (Recomendado)
- **Sumsub**
- **Onfido**

El código del panel ya está preparado para trabajar con verificación automática en el futuro.

---

**Última actualización**: Diciembre 2024

