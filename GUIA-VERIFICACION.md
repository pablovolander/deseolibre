# 🔐 Guía de Verificación de Identidad - Deseo Libre

## 📋 Descripción

Para poder **subir contenido** (fotos, videos, audios) a la plataforma Deseo Libre, necesitas verificar tu identidad. Este proceso asegura que todos los creadores de contenido son personas reales mayores de 18 años.

---

## 🚀 Métodos de Verificación

### 1. ⚡ Verificación Instantánea (Desarrollo)

**El método más rápido para desarrollo y pruebas.**

#### Pasos:
1. Inicia sesión en tu cuenta
2. Ve a la página de verificación: **http://localhost:3000/verificar-identidad.html**
3. Haz clic en **"Verificar Ahora (Desarrollo)"**
4. ¡Listo! Tu identidad estará verificada instantáneamente

#### Usando la consola del navegador (Alternativa):
```javascript
// Abre la consola del navegador (F12)
// Pega este código:

const authToken = localStorage.getItem('authToken');

fetch('/api/auth/quick-verify', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    }
})
.then(res => res.json())
.then(data => {
    console.log('✅ Verificación exitosa:', data);
    alert('¡Identidad verificada! Recarga la página.');
    location.reload();
})
.catch(err => console.error('Error:', err));
```

---

### 2. 🔑 Verificación Manual (Con Código)

**Método que simula el proceso de verificación real.**

#### Pasos:
1. Inicia sesión en tu cuenta
2. Ve a **http://localhost:3000/verificar-identidad.html**
3. Haz clic en **"Iniciar Verificación Manual"**
4. Cuando te pida el código, ingresa: **`VERIFY123`**
5. ¡Listo! Tu identidad estará verificada

#### Desde Mi Perfil:
1. Ve a **http://localhost:3000/profile.html**
2. Busca la sección de verificación
3. Haz clic en **"Verificar Identidad"**
4. Usa el código: **`VERIFY123`**

---

### 3. 📤 Verificación con Documentos (Futuro)

**Este método estará disponible en producción.**

Podrás subir:
- ✅ Cédula de identidad (frente y reverso)
- ✅ Pasaporte
- ✅ Licencia de conducir
- ✅ Selfie sosteniendo el documento

**Endpoint:** `/api/verification/upload`

---

## 🔍 Verificar Estado de Verificación

### Método 1: Página dedicada
Ve a: **http://localhost:3000/verificar-identidad.html**

### Método 2: Mi Perfil
Ve a: **http://localhost:3000/profile.html**

### Método 3: API
```javascript
const authToken = localStorage.getItem('authToken');

fetch('/api/auth/verification-status', {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
})
.then(res => res.json())
.then(data => console.log('Estado:', data))
.catch(err => console.error('Error:', err));
```

---

## 📝 Proceso Completo (Nuevo Usuario)

1. **Registrarse**: http://localhost:3000
2. **Verificar edad**: Confirmar que eres mayor de 18 años
3. **Verificar identidad**: 
   - Opción rápida: http://localhost:3000/verificar-identidad.html
   - Usar código: `VERIFY123`
4. **Subir contenido**: Ve al feed y crea tu primera publicación

---

## 🎯 Endpoints de la API

### Verificación Rápida (Desarrollo)
```
POST /api/auth/quick-verify
Headers: Authorization: Bearer {token}
```

### Iniciar Verificación Manual
```
POST /api/auth/start-verification
Headers: Authorization: Bearer {token}
Body: {
    "verificationType": "manual",
    "verificationData": { "method": "code" }
}
```

### Completar Verificación
```
POST /api/auth/complete-verification
Headers: Authorization: Bearer {token}
Body: {
    "verificationId": 123,
    "verificationCode": "VERIFY123"
}
```

### Consultar Estado
```
GET /api/auth/verification-status
Headers: Authorization: Bearer {token}
```

---

## ⚠️ Notas Importantes

1. **Verificación de Edad vs Verificación de Identidad:**
   - **Verificación de Edad**: Confirmar que eres mayor de 18 años (requerido para VER contenido)
   - **Verificación de Identidad**: Confirmar tu identidad real (requerido para SUBIR contenido)

2. **Solo para Desarrollo:**
   - El endpoint `/api/auth/quick-verify` debe ser **REMOVIDO** en producción
   - El código `VERIFY123` es solo para pruebas

3. **Permisos:**
   - ✅ Sin verificación: Solo puedes ver contenido público
   - ✅ Con verificación de edad: Puedes ver todo el contenido
   - ✅ Con verificación de identidad: Puedes subir contenido

---

## 🐛 Solución de Problemas

### Problema: "Usuario no verificado"
**Solución**: Ve a http://localhost:3000/verificar-identidad.html y verifica tu identidad

### Problema: "Token de acceso requerido"
**Solución**: Inicia sesión nuevamente

### Problema: El botón "Crear Publicación" está bloqueado
**Solución**: Necesitas verificar tu identidad primero

### Problema: No puedo acceder a verificar-identidad.html
**Solución**: Asegúrate de que el servidor esté ejecutándose y de que hayas iniciado sesión

---

## 📞 Contacto

Si tienes problemas con la verificación, contacta al administrador del sistema.

---

**Última actualización**: Octubre 2025

