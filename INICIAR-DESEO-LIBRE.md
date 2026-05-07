# 🚀 Cómo Iniciar Deseo Libre

## Inicio Rápido

### 1️⃣ Iniciar el Servidor

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
node server.js
```

O simplemente haz doble clic en:
```
iniciar-servidor.bat
```

Verás este mensaje cuando esté listo:
```
Servidor Deseo Libre ejecutándose en puerto 3000
Accede a: http://localhost:3000
```

### 2️⃣ Acceder a la Plataforma

Abre tu navegador y ve a:
```
http://localhost:3000
```

---

## 🎯 Flujo Completo de Usuario

### Primera Vez en la Plataforma

1. **Verificación de Edad** ✅
   - Al entrar, verás un modal
   - Marca "Confirmo que soy mayor de 18 años"
   - Click en "Confirmar"
   - ⚠️ Solo se muestra una vez por sesión

2. **Registrarse** 📝
   - Click en "Registrarse"
   - Ingresa:
     - Username (ejemplo: `usuario123`)
     - Email (ejemplo: `usuario@email.com`)
     - Contraseña (mínimo 6 caracteres)
   - Click en "Registrarse"

3. **Verificar Identidad** 🆔
   - Para subir contenido debes verificar tu identidad
   - Usa el código de prueba: `VERIFY123`
   - En producción, aquí se subiría documento de identidad

4. **Completar Perfil** 👤
   - Click en "Mi Perfil"
   - Click en "Editar Perfil"
   - Completa:
     - Nombre completo
     - Biografía
     - Ubicación
     - Teléfono
     - **Edad** (nuevo campo obligatorio)
     - Categoría principal
   - Click en "Guardar"

5. **Subir Fotos de Perfil** 📸
   - Click en el ícono de cámara sobre el avatar
   - Selecciona tu foto de perfil
   - Click en el botón "Cambiar Foto de Portada"
   - Selecciona tu foto de portada (1500x500 px recomendado)

6. **Crear Primera Publicación** 📝
   - Click en "Crear Publicación"
   - Completa:
     - Título
     - Descripción
     - Tipo (Foto/Video/Audio)
     - **Categoría** (importante para aparecer en feeds)
     - Sube tu archivo
   - Click en "Publicar"

---

## 🌟 Funcionalidades Principales

### Feed Principal (home.html)
- **Recomendados**: Contenido personalizado basado en tus intereses
- **Siguiendo**: Solo contenido de usuarios que sigues
- **Tendencias**: Lo más popular de las últimas 24 horas
- **Scroll Infinito**: Carga automática al hacer scroll
- **Sugerencias**: Usuarios recomendados para seguir

### Sistema de Seguimiento
- Visita cualquier perfil
- Click en "Seguir" para seguir a un usuario
- Click en "Siguiendo" para dejar de seguir
- Ve tus seguidores y seguidos desde tu perfil

### Interacciones
- ❤️ **Like**: Click en el corazón de cualquier publicación
- 💬 **Comentar**: Click en el ícono de comentario, escribe y envía
- 🔄 **Compartir**: Click en el ícono de compartir
- 🔔 **Notificaciones**: Todas las interacciones generan notificaciones

### Notificaciones
- Badge en el header con número de notificaciones no leídas
- Click para ver dropdown con todas las notificaciones
- Click en "Marcar todo como leído" para limpiar
- Click en una notificación para ir al contenido relacionado

### Búsqueda y Exploración
- Explora categorías específicas desde la página principal
- Navega libremente sin login (solo visualización)
- Regístrate para interactuar

---

## 📍 Páginas Importantes

| Página | URL | Descripción |
|--------|-----|-------------|
| Inicio | `http://localhost:3000` | Landing page |
| Feed | `http://localhost:3000/home.html` | Feed personalizado |
| Mi Perfil | `http://localhost:3000/profile.html` | Tu perfil |
| Perfil Público | `http://localhost:3000/profile.html?user=ID` | Ver otro perfil |

---

## 🔑 Códigos de Prueba

Para desarrollo, usa estos códigos:

- **Verificación de Identidad**: `VERIFY123`

---

## ⚠️ Notas Importantes

### Para Desarrollo
- El servidor debe estar corriendo para usar la plataforma
- Usa `Ctrl + C` en la terminal para detener el servidor
- Los archivos se guardan en `public/uploads/`
- La base de datos es `deseo_libre.db`

### Navegadores Recomendados
- ✅ Chrome / Edge (Chromium)
- ✅ Firefox
- ✅ Safari

### Tamaños Recomendados
- **Avatar**: 500x500 px (cuadrado)
- **Portada**: 1500x500 px (panorámico)
- **Fotos**: Máximo 10MB
- **Videos**: Máximo 10MB
- **Audios**: Máximo 10MB

---

## 🐛 Solución de Problemas

### El servidor no inicia
```powershell
# Verifica que Node.js esté instalado
node --version

# Instala las dependencias
npm install

# Inicia nuevamente
node server.js
```

### No aparece nada en la página
1. Verifica que el servidor esté corriendo
2. Revisa la consola del navegador (F12)
3. Asegúrate de estar en `http://localhost:3000` y no `file:///`

### "Token inválido"
- Cierra todas las pestañas
- Borra localStorage:
  ```javascript
  // En consola del navegador (F12):
  localStorage.clear()
  ```
- Vuelve a iniciar sesión

### No puedo subir contenido
1. Verifica que estés verificado (código `VERIFY123`)
2. Asegúrate de estar logueado
3. Verifica el tamaño del archivo (máx 10MB)

---

## 📞 Categorías Disponibles

### Servicios
- Acompañantes Mujeres
- Acompañantes Hombres
- Acompañantes Trans
- Sugar Daddy
- Sugar Mommy
- Masajes

### Comunidades
- Gay
- Hetero
- Lésbica
- Swinger

### Contenido
- Contenido Exclusivo
- Audios Eróticos
- Artículos Eróticos

---

## ✨ Consejos para Mejores Resultados

1. **Completa tu perfil al 100%**
   - Foto de perfil y portada
   - Biografía atractiva
   - Ubicación y contacto

2. **Crea contenido de calidad**
   - Fotos bien iluminadas
   - Descripciones atractivas
   - Elige la categoría correcta

3. **Interactúa con la comunidad**
   - Sigue usuarios de tu interés
   - Comenta en publicaciones
   - Da likes al contenido que te guste

4. **Revisa notificaciones regularmente**
   - Ve quién te sigue
   - Responde comentarios
   - Interactúa con tus seguidores

---

## 🎉 ¡Listo!

Tu plataforma **Deseo Libre** está completamente funcional.

Para más información técnica, consulta:
- `FUNCIONALIDADES-IMPLEMENTADAS.md` - Lista completa de features
- `README.md` - Documentación técnica
- `server.js` - Código del backend

**¡Disfruta de Deseo Libre!** ❤️‍🔥

