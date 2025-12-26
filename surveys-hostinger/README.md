# 🌐 Encuestas Públicas - Deployment Guide

## 📂 Contenido de esta carpeta

```
surveys-hostinger/
├── README.md                              ← Este archivo
├── INICIO_RAPIDO.md                       ← ⭐ Lee primero (5 min)
├── INSTRUCCIONES_DEPLOYMENT.md            ← Guía completa con todos los detalles
├── copiar_archivos.bat                    ← Windows: copia archivos automáticamente
├── copiar_archivos.sh                     ← Linux/Mac: versión bash
│
├── (Archivos generados al ejecutar script)
├── sastifaccion_clienteSG.html
├── sastifacion_clienteSG.js
├── styles/
│   └── style.css
└── img/
    └── image.png (+ otras imágenes)
```

## ⚡ Inicio Rápido

### Windows
```powershell
.\copiar_archivos.bat
```

### Linux / Mac
```bash
chmod +x copiar_archivos.sh
./copiar_archivos.sh
```

Luego abre `INICIO_RAPIDO.md` para los siguientes pasos.

## 🎯 ¿Qué hace cada archivo?

| Archivo | Descripción |
|---------|-------------|
| **INICIO_RAPIDO.md** | Resumen de 5 minutos para poner en producción rápido |
| **INSTRUCCIONES_DEPLOYMENT.md** | Guía completa con screenshots y troubleshooting |
| **copiar_archivos.bat** | Copia automáticamente HTML/JS/CSS/IMG desde proyecto |
| **copiar_archivos.sh** | Versión bash del script (para Mac/Linux) |

## 🚀 Paso 1: Copiar Archivos

Ejecuta el script correspondiente a tu SO:
```
Windows: .\copiar_archivos.bat
Mac/Linux: ./copiar_archivos.sh
```

## 🔗 Paso 2: Configurar Backend

**Opción A - ngrok (rápido, temporal):**
```
1. Descargar: https://ngrok.com/download
2. Ejecutar: ngrok http 3001
3. Copiar URL generada
```

**Opción B - Hostinger (permanente):**
```
1. Crear subdominio: api.andamiositorres.com
2. Subir código Node.js
3. npm install && npm run server
```

## 📤 Paso 3: Subir a Hostinger

**File Manager (fácil):**
- Hostinger → File Manager
- Arrastrar archivos a `/public_html/` o `/encuesta/`

**FTP (profesional):**
```
Host: srv575-files.hstgr.io
Usuario: tu_usuario
Contraseña: tu_contraseña
```

## ✅ Paso 4: Probar

```
https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html?id_encuesta=1
```

Si ves la encuesta → ✅ ¡Funciona!
Si ves error → Abre DevTools (F12) → Console → Network para debuggear

## 📖 Documentación Completa

Para detalles, troubleshooting y arquitectura avanzada, lee:
- 📄 [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) - 5 minutos
- 📄 [INSTRUCCIONES_DEPLOYMENT.md](./INSTRUCCIONES_DEPLOYMENT.md) - Completo

## 🤔 Preguntas Frecuentes

**P: ¿Dónde van los archivos?**
R: A `/surveys-hostinger/` → se copian desde `../public/`

**P: ¿Necesito cambiar código?**
R: No, `sastifacion_clienteSG.js` detecta automáticamente localhost vs dominios públicos

**P: ¿Y si el backend está en otra URL?**
R: Edita `getApiBaseUrl()` en `sastifacion_clienteSG.js` (ver INSTRUCCIONES_DEPLOYMENT.md)

**P: ¿Y si cambio de backend?**
R: Simplemente cambia la URL en la función `getApiBaseUrl()`

---

**¿Listo para empezar?** → Ejecuta `copiar_archivos.bat` (o `.sh`)
