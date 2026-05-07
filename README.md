# Deseo Libre - Plataforma para Adultos

Una plataforma social para adultos con autenticación JWT y verificación de edad.

## Características

- 🔐 **Autenticación JWT**: Sistema seguro de login y registro
- ✅ **Verificación de Edad**: Confirmación obligatoria de mayoría de edad
- 🎨 **Diseño Elegante**: Interfaz moderna y responsive
- 💼 **Servicios para Adultos**: Acompañantes, masajes, contenido exclusivo, etc.
- 👥 **Comunidades**: Swinger, Lésbica, Hetero, Gay
- 🗄️ **Base de Datos SQLite**: Almacenamiento local de usuarios
- 📹 **Sistema de Reels**: Videos cortos verticales por categoría, solo para miembros registrados

## Instalación

### Prerrequisitos
- Node.js (versión 14 o superior)
- npm

### Pasos

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno** (opcional):
```bash
# Crear archivo .env
echo "JWT_SECRET=tu_clave_secreta_muy_segura" > .env
echo "PORT=3000" >> .env
```

3. **Ejecutar el servidor**:
```bash
# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

4. **Acceder a la aplicación**:
   - Abrir navegador en: `http://localhost:3000`

## Estructura del Proyecto

```
deseo-libre/
├── index.html          # Frontend principal
├── server.js           # Servidor Express con API
├── package.json        # Dependencias del proyecto
├── deseo_libre.db      # Base de datos SQLite (se crea automáticamente)
└── README.md           # Este archivo
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/verify` - Verificar token JWT
- `POST /api/auth/verify-age` - Verificar edad del usuario

### Usuario
- `GET /api/user/profile` - Obtener perfil del usuario

### Reels
- `POST /api/reels` - Publicar un nuevo reel (requiere usuario verificado)
- `GET /api/reels/category/:category` - Listar reels recientes por categoría
- `GET /api/reels/:reelId` - Obtener detalles de un reel específico
- `POST /api/reels/:reelId/like` - Dar like a un reel
- `DELETE /api/reels/:reelId/like` - Quitar like de un reel
- `POST /api/reels/:reelId/comment` - Comentar un reel
- `GET /api/reels/:reelId/comments` - Listar comentarios del reel
- `POST /api/reels/:reelId/view` - Registrar una vista del reel

## Base de Datos

### Tabla `users`
- `id` - ID único del usuario
- `username` - Nombre de usuario único
- `email` - Email único
- `password_hash` - Contraseña hasheada con bcrypt
- `age_verified` - Boolean: si la edad fue verificada
- `age_verification_date` - Fecha de verificación de edad
- `created_at` - Fecha de creación
- `updated_at` - Fecha de última actualización

### Tabla `age_verifications`
- `id` - ID único del registro
- `user_id` - ID del usuario
- `verified_at` - Fecha de verificación
- `ip_address` - IP del usuario
- `user_agent` - Navegador del usuario

## Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Tokens JWT con expiración (24 horas)
- ✅ Verificación de edad obligatoria
- ✅ Validación de entrada en el servidor
- ✅ Headers de seguridad CORS
- ✅ No almacenamiento de datos personales sensibles

## Uso

1. **Registro**: Los usuarios pueden registrarse con username, email y contraseña
2. **Login**: Acceso con email y contraseña
3. **Verificación de Edad**: Modal obligatorio para confirmar mayoría de edad
4. **Navegación**: Acceso a servicios y comunidades según la verificación

## Desarrollo

### Modo Desarrollo
```bash
npm run dev
```
Usa nodemon para reinicio automático del servidor.

### Estructura de Respuestas API

**Registro/Login exitoso**:
```json
{
  "message": "Usuario registrado exitosamente",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "username": "usuario",
    "email": "usuario@email.com",
    "age_verified": false
  }
}
```

**Verificación de edad exitosa**:
```json
{
  "message": "Edad verificada exitosamente",
  "age_verified": true,
  "verification_date": "2024-01-01T00:00:00.000Z"
}
```

## Notas Importantes

- ⚠️ Solo para mayores de 18 años
- 🔒 Todos los datos sensibles están protegidos
- 📱 Diseño responsive para móviles y desktop
- 🌐 Interfaz completamente en español

## Licencia

MIT License - Ver archivo LICENSE para más detalles.
