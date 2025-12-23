# 🚀 Inicio Rápido - Subir Encuestas a Hostinger

## ⏱️ 5 Minutos de Configuración

### PASO 1️⃣: Copiar Archivos
En tu terminal PowerShell, dentro de `surveys-hostinger/`:
```powershell
.\copiar_archivos.bat
```

Esto copia automáticamente:
- ✅ `sastifaccion_clienteSG.html`
- ✅ `sastifacion_clienteSG.js` (con soporte multi-dominio)
- ✅ Carpeta `styles/`
- ✅ Carpeta `img/`

### PASO 2️⃣: Elegir Opción de Backend

**OPCIÓN A: Usar ngrok (5 minutos - Para pruebas)**

```powershell
# 1. Descargar ngrok: https://ngrok.com/download
# 2. Abrir terminal NUEVA y ejecutar:
C:\ngrok\ngrok.exe http 3001

# 3. Copiar URL generada (ej: https://abc123.ngrok.io)
# 4. Actualizar archivo .env.surveys:
SURVEY_API_BASE_URL=https://abc123.ngrok.io
```

**OPCIÓN B: Publicar en Hostinger (Permanente)**

```powershell
# 1. Crear subdominio en Hostinger:
#    Panel → Dominios → api.andamiositorres.com
#
# 2. Subir backend (src/, package.json, .env)
#
# 3. Instalar y ejecutar:
npm install
npm run server
#
# 4. El archivo JS detecta automáticamente:
#    encuesta.andamiositorres.com → conecta a api.andamiositorres.com
```

### PASO 3️⃣: Subir a Hostinger

1. **Opción fácil (File Manager):**
   - Hostinger Panel → File Manager
   - Navegar a `/public_html/` (o `/encuesta/`)
   - Drag & drop de archivos

2. **Opción profesional (FTP):**
   ```
   Host: srv575-files.hstgr.io
   Usuario: tu_usuario
   Contraseña: tu_contraseña
   Carpeta: /public_html/
   ```

### PASO 4️⃣: Permitir CORS (Importante!)

En tu backend (`src/app.js`), agregar:

```javascript
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:3001', 'https://encuesta.andamiositorres.com'],
  credentials: true
}));
```

### PASO 5️⃣: Prueba

```
URL: https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html?id_encuesta=1

✅ Si ves la encuesta → ¡Funciona!
❌ Si ves errores → Ver DevTools (F12) → Console
```

## 🎯 URLs Finales

| Recurso | URL |
|---------|-----|
| **Encuesta** | `https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html?id_encuesta=1` |
| **API Backend** | `https://api.andamiositorres.com/api/encuestas/...` |

## 📋 Checklist

- [ ] Ejecuté `copiar_archivos.bat`
- [ ] Configuré backend (ngrok u Hostinger)
- [ ] Agregué CORS en backend
- [ ] Subí archivos a Hostinger
- [ ] Probé URL en browser
- [ ] Ví encuesta funcionar ✅

## ⚠️ Problemas Comunes

**Error: "Cannot connect to API"**
→ Backend no está activo o URL incorrecta en `getApiBaseUrl()`

**Error: "CORS blocked"**
→ Agrega middleware CORS en backend (ver PASO 4)

**Error: 404 en archivos HTML/CSS**
→ Verifica que carpeta `styles/` y `img/` se subieron

---

📖 Para más detalles: Lee `INSTRUCCIONES_DEPLOYMENT.md`
