# Instalación de Deseo Libre

## Requisitos Previos

1. **Node.js** (versión 14 o superior)
   - Descarga desde: https://nodejs.org/
   - Verifica la instalación ejecutando: `node --version`

2. **npm** (viene incluido con Node.js)
   - Verifica la instalación ejecutando: `npm --version`

## Pasos de Instalación

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Iniciar el Servidor
```bash
npm start
```

O alternativamente:
```bash
node server.js
```

### 3. Acceder a la Aplicación
- Abre tu navegador web
- Ve a: `http://localhost:3000`

## Funcionalidades Disponibles

### Para Usuarios Registrados:
1. **Registro/Login**: Crea una cuenta o inicia sesión
2. **Verificación de Edad**: Confirma que eres mayor de 18 años
3. **Verificación de Identidad**: Verifica tu identidad para subir contenido
4. **Subir Contenido**: 
   - Fotos (JPG, PNG, GIF)
   - Videos (MP4, AVI, MOV)
   - Audios (MP3, WAV, M4A)
   - Tamaño máximo: 10MB por archivo

### Para Todos los Usuarios:
1. **Explorar Feed**: Ve contenido público de otros usuarios
2. **Contactar Creadores**: Los números de teléfono son visibles
3. **Interactuar**: Dar likes, comentar, compartir
4. **Reportar Contenido**: Sistema de moderación

## Estructura de Archivos

```
Deseo Libre/
├── index.html          # Página principal
├── feed.html          # Feed de contenido
├── profile.html       # Perfil de usuario
├── policies.html      # Políticas y términos
├── server.js          # Servidor backend
├── package.json       # Dependencias del proyecto
├── public/
│   └── uploads/       # Archivos subidos por usuarios
└── database.db        # Base de datos SQLite (se crea automáticamente)
```

## Solución de Problemas

### Error: "npm no se reconoce"
- Instala Node.js desde https://nodejs.org/
- Reinicia la terminal después de la instalación

### Error: "Puerto 3000 en uso"
- Cambia el puerto en `server.js`: `const PORT = process.env.PORT || 3001;`
- O mata el proceso que usa el puerto 3000

### Error de permisos en Windows
- Ejecuta PowerShell como administrador
- O usa el símbolo del sistema (cmd) como administrador

## Desarrollo

### Modificar el Servidor
- Edita `server.js` para cambios en el backend
- Reinicia el servidor después de cambios

### Modificar el Frontend
- Edita los archivos HTML para cambios en la interfaz
- Los cambios se reflejan inmediatamente al recargar la página

### Base de Datos
- La base de datos SQLite se crea automáticamente
- Se encuentra en `database.db` en la raíz del proyecto
- Para resetear: elimina `database.db` y reinicia el servidor
