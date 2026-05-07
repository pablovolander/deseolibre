# 🔧 Solución: Problema al Crear Publicaciones

## 📋 Problemas Identificados

### 1. **PayloadTooLargeError: request entity too large**
El middleware `express.json()` tenía un límite por defecto de 100kb, demasiado pequeño para manejar datos de formularios con archivos grandes.

### 2. **Content-Type incorrecto para FormData**
La función `apiCall()` en los archivos HTML estaba estableciendo `Content-Type: application/json` para TODAS las peticiones, incluyendo las que envían FormData con archivos. Esto causaba que el servidor no pudiera procesar correctamente los archivos subidos.

---

## ✅ Soluciones Aplicadas

### 1. Aumentar límites de payload en el servidor

**Archivo:** `server.js`

**Antes:**
```javascript
app.use(express.json());
```

**Después:**
```javascript
app.use(express.json({ limit: '50mb' })); // Increased limit for large JSON payloads
app.use(express.urlencoded({ limit: '50mb', extended: true })); // For form data
```

**Beneficio:** Ahora el servidor puede manejar payloads JSON de hasta 50MB, suficiente para datos de formularios complejos.

---

### 2. Corregir función apiCall() para manejar FormData

**Archivos modificados:**
- `feed.html`
- `profile.html`

**Antes:**
```javascript
async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',  // ❌ Problema: siempre JSON
            'Authorization': `Bearer ${authToken}`
        }
    };

    const finalOptions = { ...defaultOptions, ...options };
    // ... resto del código
}
```

**Después:**
```javascript
async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    };

    // Only add Content-Type for JSON, not for FormData
    if (!(options.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }

    // Merge options, but be careful with headers
    const finalOptions = { 
        ...defaultOptions, 
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };
    // ... resto del código
}
```

**Beneficio:** 
- Cuando se envía FormData (archivos), el navegador establece automáticamente el `Content-Type: multipart/form-data` con el boundary correcto
- Para peticiones JSON normales, se sigue usando `Content-Type: application/json`
- Los headers se mezclan correctamente sin sobrescribir valores importantes

---

## 🎯 Resultado

Ahora puedes:
1. ✅ **Subir fotos sin errores** - El servidor acepta archivos grandes
2. ✅ **Crear publicaciones exitosamente** - Los FormData se procesan correctamente
3. ✅ **Ver tus publicaciones** - Las publicaciones se guardan en la base de datos
4. ✅ **Compartir contenido** - Otros usuarios pueden ver tus publicaciones en el feed

---

## 🧪 Cómo Probar

### 1. Verificar que el servidor está corriendo
```powershell
Get-Process node
```

### 2. Probar la API
```powershell
curl http://localhost:3000/api/upload/info
```

### 3. Crear una publicación
1. Ve a: http://localhost:3000/feed.html
2. Haz clic en "Crear Nueva Publicación" (necesitas estar verificado)
3. Rellena el formulario:
   - Título: "Mi primera foto"
   - Descripción: "Esta es una prueba"
   - Tipo: "photo"
   - Selecciona una imagen (máx 10MB)
4. Haz clic en "Publicar"
5. ¡Deberías ver tu publicación en el feed!

---

## 🔍 Verificar en la Base de Datos

```javascript
// Abre la consola del navegador (F12) y ejecuta:
const authToken = localStorage.getItem('authToken');

fetch('/api/content/my', {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
})
.then(res => res.json())
.then(data => {
    console.log('Mis publicaciones:', data.posts);
    console.log('Total de publicaciones:', data.posts.length);
})
.catch(err => console.error('Error:', err));
```

---

## ⚠️ Notas Importantes

### Límites de Archivos
- **Tamaño máximo por archivo:** 10MB (configurado en multer)
- **Límite de payload JSON:** 50MB (configurado en express)
- **Formatos permitidos:** 
  - Imágenes: JPEG, JPG, PNG, GIF
  - Videos: MP4, AVI, MOV
  - Audios: WAV, MP3, M4A

### Requisitos para Subir Contenido
1. ✅ Estar registrado
2. ✅ Haber verificado tu edad (>18 años)
3. ✅ Haber verificado tu identidad (usar http://localhost:3000/verificar-identidad.html)

---

## 🐛 Solución de Problemas

### Problema: "Usuario no verificado"
**Solución:** Ve a http://localhost:3000/verificar-identidad.html y verifica tu identidad

### Problema: "Archivo es requerido"
**Solución:** Asegúrate de seleccionar un archivo antes de publicar

### Problema: "Tipo de archivo no permitido"
**Solución:** Solo puedes subir imágenes, videos y audios en los formatos especificados

### Problema: "El archivo es demasiado grande"
**Solución:** El tamaño máximo es 10MB. Reduce el tamaño del archivo antes de subirlo

### Problema: "PayloadTooLargeError" (todavía)
**Solución:** Reinicia el servidor. Los cambios no se aplicarán hasta que reinicies:
```powershell
Get-Process -Name node | Stop-Process -Force
node server.js
```

---

## 📁 Archivos Modificados

- ✅ `server.js` - Aumentados límites de payload
- ✅ `feed.html` - Corregida función apiCall()
- ✅ `profile.html` - Corregida función apiCall()
- ✅ `SOLUCION-PUBLICACIONES.md` - Este archivo de documentación

---

## 🚀 Próximos Pasos

Si quieres mejorar aún más la funcionalidad de subida de archivos:

1. **Compresión de imágenes en el cliente** - Reducir tamaño antes de enviar
2. **Barra de progreso de subida** - Mostrar progreso durante la carga
3. **Validación de dimensiones** - Verificar tamaño de imagen antes de subir
4. **Generación de thumbnails** - Crear miniaturas para videos
5. **Almacenamiento en la nube** - Usar S3, Cloudinary, etc.

---

**Fecha de actualización:** Octubre 2025  
**Estado:** ✅ RESUELTO

