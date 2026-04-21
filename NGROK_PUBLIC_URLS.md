# 🌐 URLs Públicas con NGROK - Andamios Torres

**Fecha de Generación:** 16 de Abril de 2026  
**Estado:** ✅ Túnel Activo  
**Puerto Local:** 3001  

---

## 📡 URL Base Pública (Activa en este momento)

```
https://nonegoistically-tranquil-burma.ngrok-free.dev
```

**⚠️ NOTA:** Esta URL es **temporal**. Cada vez que reinicies ngrok, obtendrás una nueva URL. Para una URL permanente, necesitas plan Pro de ngrok.

---

## 🔗 Enlaces Públicos Listos para Usar

### 1️⃣ **Para EL CHOFER** - Detalle de Pedido/Entrega

**Acceso después de login de chofer:**
```
https://nonegoistically-tranquil-burma.ngrok-free.dev/templates/pages/entrega_detalle.html?id=31
```

**Pasos para chofer:**
1. Login en: `https://nonegoistically-tranquil-burma.ngrok-free.dev/login.html`
2. Usuario: chofer (o su usuario)
3. Acceder a Asignaciones
4. O usar link directo arriba con ID de asignación

**Funcionalidades:**
✅ Activar GPS  
✅ Capturar foto de evidencia  
✅ Registrar a quién le entrega  
✅ Completar pedido o reportar incidencia  

---

### 2️⃣ **Para EL CLIENTE** - Seguimiento Público (Sin Login)

**Link para compartir por WhatsApp/Email:**
```
https://nonegoistically-tranquil-burma.ngrok-free.dev/pages/seguimiento-publico.html?token=<TOKEN_AQUI>
```

**Para obtener un token válido:**
1. En el backend, cuando se asigna un pedido, se genera un token QR
2. Endpoint: `POST /api/logistica/asignaciones/{id}/generar-qr`
3. Respuesta contiene `token` y `url_publica`

**Ejemplo con token real:**
```
https://nonegoistically-tranquil-burma.ngrok-free.dev/pages/seguimiento-publico.html?token=dfcf29d2-8a53-410c-9330-3497cafd7022
```

**Funcionalidades:**
✅ Ver estado de pedido (En preparación → En camino → Entregado)  
✅ Ver nombre y vehículo del chofer  
✅ Ver historial de eventos  
✅ Autorizar notificaciones Web Push (opcional)  
✅ Recibir notificaciones en tiempo real  

---

## 🧪 Cómo Probar Todo

### Test 1: Verificar Seguimiento Público (Cliente)

```bash
# 1. Copiar URL y abrir en navegador
https://nonegoistically-tranquil-burma.ngrok-free.dev/pages/seguimiento-publico.html?token=dfcf29d2-8a53-410c-9330-3497cafd7022

# 2. Deberías ver:
   - Número de pedido (CT-2026-04-0067)
   - Estado actual (En camino / Entregado)
   - Timeline de eventos
   - Info del chofer (nombre, vehículo, placa)
   - Banner de notificaciones

# 3. Click en "Permitir Notificaciones"
   - Autorizar en navegador
   - Se registrará subscription push
```

### Test 2: Verificar Detalle de Entrega (Chofer)

```bash
# 1. Login como chofer
https://nonegoistically-tranquil-burma.ngrok-free.dev/login.html

# 2. Ir a sección Logística
https://nonegoistically-tranquil-burma.ngrok-free.dev/principal.html

# 3. Abrir asignación o URL directa:
https://nonegoistically-tranquil-burma.ngrok-free.dev/templates/pages/entrega_detalle.html?id=31

# 4. Deberías poder:
   ✅ Ver datos del pedido
   ✅ Click en "INICIAR RUTA (ACTIVAR GPS)"
   ✅ El estado debería cambiar a "En Ruta"
   ✅ Capturar foto con evidencia
   ✅ Completar entrega
```

### Test 3: Verificar Notificaciones Web Push

```bash
# 1. Abrir seguimiento-publico.html en navegador
# 2. Esperar 2 segundos, debería aparecer banner "¡Activa Notificaciones!"
# 3. Click en "Permitir Notificaciones"
# 4. En DevTools (F12):
   - Console tab
   - Deberías ver logs como:
     [Banner] Inicializando... Notification: Soportado
     [Banner] Estado: {cerradoAntes: null, permisoActual: 'default'}
     [Banner] Banner mostrado
     [Banner] Click en autorizar
     [Push] Suscripcion registrada correctamente
```

---

## 📋 Rutas Públicas Disponibles

| Ruta | Descripción | Autenticación |
|------|-------------|-------------|
| `/login.html` | Login de usuario (chofer/admin) | ❌ No |
| `/principal.html` | Dashboard principal | ✅ Sí |
| `/pages/seguimiento-publico.html?token=...` | Seguimiento cliente público | ❌ No |
| `/templates/pages/entrega_detalle.html?id=...` | Detalle de entrega (chofer) | ✅ Sí |
| `/api/logistica/seguimiento-publico?token=...` | API de seguimiento público | ❌ No |
| `/api/logistica/push/vapid-public-key` | VAPID key para Web Push | ❌ No |
| `/sw.js` | Service Worker | ❌ No |
| `/templates/pages/seguimiento_cliente.html` | Seguimiento autenticado | ✅ Sí |

---

## 🔐 Verificación de Seguridad

✅ **Rutas públicas seguras:**
- Seguimiento público requiere **token válido y no expirado**
- VAPID key es pública (por diseño, necesaria para Web Push)
- Service Worker es script estático público

✅ **Rutas protegidas:**
- Detalle de asignación requiere **Bearer token** en headers
- Dashboard requiere **autenticación**
- API de tracking requiere **autenticación**

---

## 🔄 Cómo Mantener NGROK Activo

**Opción 1: Terminal abierta** (como está ahora)
```powershell
# El túnel seguirá activo mientras la terminal esté abierta
# Presionar Ctrl+C para detener
```

**Opción 2: NGROK Pro (Permanente)**
```bash
# Autenticarse con cuenta ngrok
ngrok config add-authtoken <TU_TOKEN_AQUI>

# Usar subdomain fijo
ngrok http 3001 --subdomain andamios-torres-dev
# URL: https://andamios-torres-dev.ngrok-free.dev
```

**Opción 3: Script de auto-reinicio**
```powershell
# Crear archivo: ngrok-auto.ps1
while ($true) {
    ngrok http 3001 --log=stdout
    Start-Sleep -Seconds 5
}

# Ejecutar: powershell -ExecutionPolicy Bypass -File ngrok-auto.ps1
```

---

## 📱 URLs para Compartir

**Copiar y enviar por WhatsApp a cliente:**
```
Hola, te compartimos el link para seguir tu pedido en tiempo real:

https://nonegoistically-tranquil-burma.ngrok-free.dev/pages/seguimiento-publico.html?token=dfcf29d2-8a53-410c-9330-3497cafd7022

Podrás ver dónde está tu chofer y recibirás notificaciones cuando esté cerca. 📍
```

**Copiar para dashboard de admin:**
```
Detalle de asignación:
https://nonegoistically-tranquil-burma.ngrok-free.dev/templates/pages/entrega_detalle.html?id=31
```

---

## ⚠️ Limitaciones y Notas

1. **URL temporal:** Cada reinicio de ngrok genera nueva URL
2. **Limite de usuarios:** Plan free de ngrok limita a ~3 conexiones concurrentes
3. **Ancho de banda:** ~1GB/mes en plan free
4. **Tiempo de conexión:** Primer request puede tardar 2-3 segundos

---

## 🛠️ Troubleshooting

**Problema:** "ERR_NGROK_221 Invalid request to ngrok"
```bash
# Solución: Verificar que localhost:3001 está corriendo
netstat -ano | findstr :3001
```

**Problema:** "Failed to load resource" en navegador
```bash
# Solución: Ngrok necesita reiniciar, hacer Ctrl+C e iniciar de nuevo
```

**Problema:** Notificaciones no funcionan
```bash
# Verificar en DevTools:
# 1. Service Worker registrado? Application → Service Workers
# 2. Notifications habilitadas en navegador?
# 3. VAPID keys configuradas en .env?
```

---

## 📞 Contacto y Soporte

Para regenerar URLs o cambiar dominio ngrok, ejecutar:
```bash
# Terminar ngrok actual: Ctrl+C
# Reiniciar con nuevo dominio
ngrok http 3001
```

**Última actualización:** 2026-04-16 16:59  
**Generado por:** Copilot Agent (Logística Sistema)
