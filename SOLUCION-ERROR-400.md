# 🔧 Solución al Error 400 al Subir Fotos

## ✅ Servidor Status
El servidor está **CORRIENDO CORRECTAMENTE** en `http://localhost:3000`

---

## 🔴 Causas del Error 400 (Bad Request)

El error 400 al intentar subir una foto puede deberse a:

### 1. **Usuario NO Verificado** ⚠️ (Causa más común)
Para subir contenido, tu usuario **DEBE estar verificado**.

#### Solución:
1. Ve a tu perfil
2. Busca el estado de verificación
3. Si no estás verificado, usa el código: `VERIFY123`

### 2. **No estás logueado correctamente**
El token de autenticación puede haber expirado.

#### Solución:
1. Cierra sesión completamente
2. Cierra todas las pestañas del navegador
3. Abre el navegador de nuevo
4. Ve a `http://localhost:3000`
5. Inicia sesión nuevamente

### 3. **Campos del formulario vacíos o inválidos**
El servidor requiere:
- ✅ Título (obligatorio)
- ✅ Descripción (obligatoria)
- ✅ Tipo de contenido (photo/video/audio)
- ✅ Archivo (obligatorio)
- ✅ Categoría válida

#### Solución:
Asegúrate de completar TODOS los campos del formulario antes de hacer clic en "Publicar".

### 4. **Archivo demasiado grande**
El límite es 50MB por archivo.

#### Solución:
- Comprime la imagen antes de subirla
- Usa herramientas online como TinyPNG o compressor.io

---

## 🎯 Pasos para Verificar tu Cuenta

### Opción A: Desde el Navegador

1. Abre `http://localhost:3000`
2. Inicia sesión con tu usuario
3. En la consola del navegador (F12), ejecuta:
   ```javascript
   localStorage.getItem('authToken')
   ```
4. Si ves `null`, necesitas iniciar sesión nuevamente
5. Si ves un token largo, estás logueado correctamente

### Opción B: Verificar tu Estado

1. Ve a tu perfil: `http://localhost:3000/profile.html`
2. Busca el badge de verificación
3. Si no aparece, necesitas verificarte

---

## 🔍 Debugging Paso a Paso

### Paso 1: Verifica que el servidor esté corriendo
Abre `http://localhost:3000` - deberías ver la página principal.

### Paso 2: Abre la Consola del Navegador
Presiona `F12` en Chrome/Edge/Firefox

### Paso 3: Ve a la pestaña "Console"

### Paso 4: Intenta subir una foto nuevamente

### Paso 5: Lee el error completo en la consola

Los errores comunes son:
- `"Usuario no verificado"` → Usa el código `VERIFY123`
- `"Token inválido"` → Vuelve a iniciar sesión
- `"Título, descripción y tipo de contenido son requeridos"` → Completa todos los campos
- `"Archivo es requerido"` → Selecciona un archivo antes de publicar

---

## ✅ Checklist Pre-Publicación

Antes de subir una foto, verifica:

- [ ] ✅ Estoy logueado (veo mi nombre en el header)
- [ ] ✅ Mi usuario está verificado (código `VERIFY123`)
- [ ] ✅ Completé el campo "Título"
- [ ] ✅ Completé el campo "Descripción"
- [ ] ✅ Seleccioné el "Tipo de contenido" (Foto/Video/Audio)
- [ ] ✅ Seleccioné una categoría
- [ ] ✅ Subí un archivo
- [ ] ✅ El archivo pesa menos de 50MB
- [ ] ✅ El servidor está corriendo (ventana PowerShell abierta)

---

## 🚨 Si el Problema Persiste

### Ver Logs del Servidor

En la ventana de PowerShell donde corre el servidor, busca mensajes de error en tiempo real cuando intentas subir la foto.

### Limpiar Caché del Navegador

1. Presiona `Ctrl + Shift + Delete`
2. Selecciona "Cookies y datos de sitios"
3. Click en "Borrar datos"
4. Recarga la página con `Ctrl + F5`

### Reiniciar Todo

1. Cierra el servidor (Ctrl + C en PowerShell)
2. Cierra todas las pestañas del navegador
3. Inicia el servidor nuevamente:
   ```powershell
   cd "C:\Users\pablo\OneDrive\Desktop\Cursor 3"
   node server.js
   ```
4. Abre el navegador e inicia sesión

---

## 📞 Información de Debug

Si necesitas más ayuda, proporciona esta información:

1. **URL donde intentas subir**: Ejemplo: `feed-acompañantes-hombres.html`
2. **Mensaje de error completo** de la consola del navegador (F12)
3. **Estado de verificación**: ¿Estás verificado? (sí/no)
4. **Campos completados**: ¿Llenaste todos los campos del formulario?
5. **Tamaño del archivo**: ¿Cuánto pesa la foto que intentas subir?

---

## 🎉 Una vez solucionado

Cuando logres subir tu primera foto:
1. ✅ Aparecerá en tu perfil
2. ✅ Aparecerá en la categoría seleccionada
3. ✅ Aparecerá en el feed general
4. ✅ Otros usuarios podrán verla, dar like y comentar

---

**Servidor Status**: ✅ CORRIENDO en `http://localhost:3000`

**Próximo paso recomendado**: Abre `http://localhost:3000` y verifica que estés logueado y verificado.

