# 📋 Guía de Deployment - Encuestas en Hostinger

## 🎯 Objetivo
Alojar la encuesta pública en `encuesta.andamiositorres.com` mientras el backend sigue en localhost.

## 📁 Estructura de Carpetas

```
surveys-hostinger/
├── sastifaccion_clienteSG.html
├── sastifacion_clienteSG.js
├── styles/
│   └── style.css (copiar de public/styles/)
├── img/
│   └── image.png (copiar de public/img/)
└── INSTRUCCIONES_DEPLOYMENT.md (este archivo)
```

## 🚀 Paso 1: Preparar los Archivos

### 1.1 Copiar archivos a esta carpeta
```bash
# Desde C:\Users\siste\arrendamiento\surveys-hostinger

# Copiar HTML
copy ..\public\sastifaccion_clienteSG.html .

# Copiar JS
copy ..\public\scripts\sastifacion_clienteSG.js .

# Copiar CSS
mkdir styles
copy ..\public\styles\style.css .\styles\

# Copiar imágenes
mkdir img
copy ..\public\img\image.png .\img\
copy ..\public\img\* .\img\
```

### 1.2 Verificar archivos
```
✅ sastifaccion_clienteSG.html (referencia: /styles/style.css)
✅ sastifacion_clienteSG.js (contiene getApiBaseUrl() dinámico)
✅ styles/style.css
✅ img/image.png
```

## 🌐 Paso 2: Configurar Conexión Backend

### Opción A: Usar ngrok (Temporal - Para Pruebas)

**Ventajas:**
- Fácil de configurar
- Funciona en 5 minutos
- Perfecto para pruebas

**Desventajas:**
- La URL cambia cada vez que reinicies
- Límite de conexiones simultáneas
- Requiere ngrok activo

**Pasos:**

1. Descargar ngrok: https://ngrok.com/download
2. Extraer y guardar en `C:\ngrok\`
3. En terminal de PowerShell:
```powershell
cd C:\ngrok
.\ngrok.exe http 3001
```
4. Copiar la URL pública generada (ej: `https://abc123.ngrok.io`)
5. **Esta es tu URL temporal** - úsala en archivos HTML/JS

### Opción B: Publicar Backend en Hostinger (Recomendado - Permanente)

**Ventajas:**
- URL permanente
- Mejor rendimiento
- Escalable

**Desventajas:**
- Requiere servidor en Hostinger
- Necesita dominio/subdominio

**Pasos:**

1. **Crear subdominio `api.andamiositorres.com`** en Hostinger:
   - Panel de Control → Dominios → Gestionar
   - Crear subdominio: `api.andamiositorres.com` → apunta a `/public_html/api`

2. **Publicar código Node.js** en Hostinger:
   - Acceso SSH o File Manager
   - Subir carpetas: `src/`, `package.json`, `.env`
   - Instalar dependencias: `npm install`
   - Configurar permanencia: 
     - Usar Node.js Forever, PM2, o el gestor de Hostinger

3. **Actualizar .env** en servidor:
```
DATABASE_URL=postgres://...
ENCRYPTION_KEY=tu_clave_64_caracteres
SURVEY_API_BASE_URL=https://api.andamiositorres.com
```

4. **Actualizar JS** para usar el subdominio:
   - El archivo `sastifacion_clienteSG.js` ya detecta automáticamente:
     - Si es `localhost` → usa `http://localhost:3001`
     - Si es `encuesta.andamiositorres.com` → usa `https://api.andamiositorres.com`

## 📤 Paso 3: Subir a Hostinger

### Acceso vía File Manager (Fácil)
1. Hostinger Panel → File Manager
2. Navegar a `/public_html/` (o `/encuesta/` si lo creaste así)
3. Subir archivos:
   - `sastifaccion_clienteSG.html`
   - `sastifacion_clienteSG.js`
   - Carpeta `styles/`
   - Carpeta `img/`

### Acceso vía FTP (Alternativa)
```
Host: srv575-files.hstgr.io (cambiar según Hostinger)
Usuario: tu_usuario_hostinger
Contraseña: contraseña_ftp
Carpeta: /public_html/
```

### Acceso vía SSH (Avanzado)
```bash
ssh usuario@srv575.hstgr.io
cd /home/usuario/public_html/
# Subir con SCP o git clone
```

## 🔒 Paso 4: Configurar CORS en Backend

Como tu encuesta estará en `encuesta.andamiositorres.com` y el backend en `localhost:3001` (o `api.andamiositorres.com`), necesitas permitir CORS.

### Editar: `src/app.js` o `src/server.js`

Agregar después de crear la app Express:

```javascript
const cors = require('cors');

// Configurar CORS
const corsOptions = {
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://encuesta.andamiositorres.com',
    'https://encuesta.andamiositorres.com',
    'http://api.andamiositorres.com',
    'https://api.andamiositorres.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### Instalar CORS si no está instalado:
```bash
npm install cors
```

## ✅ Paso 5: Pruebas

### Test Local (antes de subir)
```
URL: http://localhost:3001/sastifaccion_clienteSG.html?id_encuesta=1
```

### Test en Hostinger (después de subir)
```
URL: https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html?id_encuesta=1
```

### Verificar CORS
En browser DevTools → Console, debería NO haber errores de CORS:
```
❌ NO DEBE HABER: "Access to XMLHttpRequest at 'http://localhost:3001/api/encuestas/publico/1' 
                   from origin 'https://encuesta.andamiositorres.com' has been blocked by CORS policy"
```

## 🐛 Troubleshooting

### "Cannot POST /api/encuestas/publico/1/responder"
- ✅ Backend no está corriendo
- ✅ Solicitud usa URL incorrecta (ej: sin dominio/puerto)
- **Solución:** Revisar console DevTools → Network tab → ver URL exacta

### "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Solución:** Agregar middleware CORS en backend (ver Paso 4)

### "Conexión rechazada a localhost:3001 desde Hostinger"
- **Problema:** Hostinger no puede acceder a tu máquina local
- **Solución:** Usar ngrok (Opción A) o publicar backend en Hostinger (Opción B)

### Archivos no cargan (404)
- **Verificar:** Ruta en Hostinger correcta
- **Verificar:** Nombres de archivo coinciden exactamente (mayúsculas/minúsculas)
- **Verificar:** Referencias en HTML: `<link href="styles/style.css">` (sin `../`)

## 📝 Resumen de URLs

| Recurso | Local | Hostinger |
|---------|-------|-----------|
| **Encuesta HTML** | `http://localhost:3001/sastifaccion_clienteSG.html` | `https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html` |
| **Backend API** | `http://localhost:3001/api/encuestas/...` | `https://api.andamiositorres.com/api/encuestas/...` |
| **Estilos** | `http://localhost:3001/styles/style.css` | `https://encuesta.andamiositorres.com/styles/style.css` |

## 🎉 ¡Listo!
Una vez que subes los archivos a Hostinger, la encuesta funciona automáticamente:
- Detecta que está en `encuesta.andamiositorres.com`
- Conecta al backend automáticamente (cuando esté publicado en `api.andamiositorres.com`)
- Sin cambios de código necesarios

---

**Preguntas frecuentes:**
- **¿Y si cambio la URL del backend?** Edita `getApiBaseUrl()` en `sastifacion_clienteSG.js`
- **¿Y si necesito versión en desarrollo?** Crea rama `dev` y pon en `dev.encuesta.andamiositorres.com`
- **¿Y si hay errores?** Abre DevTools (F12) → Console/Network para ver solicitudes reales
