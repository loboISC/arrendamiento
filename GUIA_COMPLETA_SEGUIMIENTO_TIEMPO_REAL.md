# 🚚 Sistema de Seguimiento en Tiempo Real - Guía Completa

## Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Setup Base de Datos](#setup-base-de-datos)
4. [Variables de Entorno](#variables-de-entorno)
5. [API Endpoints](#api-endpoints)
6. [Flujo de Cliente](#flujo-de-cliente)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Descripción General

Este sistema permite que los clientes de **Andamios Torres** vean en tiempo real el estado de su entrega/recolección mediante:

✅ **WebSocket en tiempo real** - Sin recargar la página  
✅ **GPS del chofer** - Ubicación en vivo (si aplica)  
✅ **QR público** - Compartir por WhatsApp sin login  
✅ **Notificaciones** - SMS, Email y push cuando cambia estado  

### Estados de Seguimiento
```
en_preparacion → en_camino → completado
                    ↓
                  fallido → (nueva asignación en_espera)
```

---

## Arquitectura

### Base de Datos
```
logistica_asignaciones
├── estado: en_preparacion | en_camino | completado | fallido
├── chofer_id → rh_empleados
├── vehiculo_id → vehiculos
└── cliente_id → clientes

seguimiento_eventos (NEW)
├── asignacion_id → logistica_asignaciones
├── estado: en_preparacion | en_camino | completado | fallido
├── descripcion, ubicacion, metadata (JSON)
└── created_at (con duración vs evento anterior)

seguimiento_tokens_publicos (NEW)
├── asignacion_id → logistica_asignaciones
├── token_uuid (para QR)
├── expires_at (30 días)
└── auditoría (ip, user_agent, acceso_count)

cliente_notificaciones (NEW)
├── cliente_id → clientes
├── email, telefono
└── preferencias (sms, email, push)

cliente_push_subscriptions (NEW)
├── cliente_id → clientes
├── endpoint, p256dh, auth (keys WebPush)
└── activa
```

### Flujo de Eventos
```
1. Chofer presiona "Iniciar Ruta"
   ↓ POST /asignaciones/{id}/iniciar-ruta
   ↓
2. Backend:
   - Actualiza estado → en_camino
   - Registra evento en seguimiento_eventos
   - Broadcast WebSocket tipo 'ruta_iniciada'
   - Envía notificaciones (SMS/Email/Push)
   ↓
3. Cliente recibe:
   - WebSocket: actualización instantánea (sin recargar)
   - Notificaciones: SMS/Email con link QR
   - QR: Link público para compartir /seguimiento-publico?token=...
```

---

## Setup Base de Datos

### 1. Ejecutar Scripts SQL

```bash
# Terminal PostgreSQL o DBeaver

# Script 1: Tabla de eventos de seguimiento
\i database/seguimiento_eventos_schema.sql

# Script 2: Tabla de tokens QR públicos
\i database/seguimiento_qr_tokens.sql

# Script 3: Tabla de notificaciones
\i database/seguimiento_notificaciones.sql
```

### 2. Verificar Tablas Creadas

```sql
-- Verificar tablas
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'seguimiento%' OR table_name LIKE 'cliente_%';

-- Verificar vista
SELECT * FROM vw_tokens_publicos_validos;
```

---

## Variables de Entorno

### Crear `.env` en raíz del proyecto

```bash
# Base de Datos (ya existente)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=andamios_torres
DB_USER=postgres
DB_PASSWORD=xxxxx

# WebSocket (ya existente)
WS_PORT=3000

# JWT (ya existente)
JWT_SECRET=tu_secret_aqui

# ============ NUEVAS VARIABLES ============

# Twilio (para SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Número de Twilio

# Web Push (para notificaciones en navegador)
VAPID_SUBJECT=mailto:info@andamiostorres.com
VAPID_PUBLIC_KEY=BCxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Email (para notificaciones por email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password

# Dominio público (para generar URLs)
PUBLIC_DOMAIN=https://andamiostorres.com  # O localhost:3000 en dev
```

### Generar VAPID Keys (para Web Push)

```bash
npm install -g web-push
web-push generate-vapid-keys

# Copiar output a .env
```

---

## API Endpoints

### 1. Iniciar Ruta (Chofer)
```
POST /api/logistica/asignaciones/{id}/iniciar-ruta
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "mensaje": "Ruta iniciada exitosamente...",
  "asignacion": { ... },
  "evento_registrado": true
}
```

### 2. Generar QR Público (Admin/Sistema)
```
POST /api/logistica/asignaciones/{id}/generar-qr
Headers: Authorization: Bearer {token}
Body: {
  "cliente_email": "cliente@email.com",
  "cliente_telefono": "+5214161234567"
}

Response:
{
  "success": true,
  "token_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "url_publica": "https://domain.com/seguimiento-publico?token=550e8400...",
  "qr_image_url": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=...",
  "token_expires_at": "2026-05-10T15:30:00Z"
}
```

### 3. Obtener Seguimiento Público (Cliente)
```
GET /api/logistica/seguimiento-publico?token={uuid}
(SIN autenticación)

Response:
{
  "estado": "en_camino",
  "numero_contrato": "CT-2026-04-0001",
  "vehiculo": {
    "economico": "AND-001",
    "placa": "ABC1234"
  },
  "chofer": "Juan García",
  "eventos": [
    {
      "id": 1,
      "estado": "en_preparacion",
      "descripcion": "Equipos verificados...",
      "fecha": "2026-04-10T08:00:00Z",
      "ubicacion": "Bodega Andamios Torres"
    },
    {
      "id": 2,
      "estado": "en_camino",
      "descripcion": "Ruta iniciada...",
      "fecha": "2026-04-10T09:15:00Z"
    }
  ]
}
```

### 4. WebSocket Events (Tiempo Real)
```
// Cliente se conecta a ws://domain:3000/ws/logistica

// Servidor envia:
{
  "tipo": "ruta_iniciada",
  "asignacion_id": 123,
  "estado": "en_camino",
  "numero_contrato": "CT-2026-04-0001",
  "chofer": {
    "id": "089",
    "nombre": "Juan García",
    "celular": "+5214161234567"
  },
  "vehiculo": {
    "economico": "AND-001",
    "placa": "ABC1234"
  }
}

// Cliente reacciona:
// - Recargar datos del seguimiento
// - Mostrar notificación visual
// - Vibrar (móvil)
```

---

## Flujo de Cliente

### Para Chofer (entrega_detalle.html)
```javascript
// 1. Presiona botón "Iniciar Ruta"
→ Llama a LogisticaServicio.iniciarRuta(asignacionId)

// 2. Backend registra evento EN_CAMINO
→ Broadcast WebSocket a todos (clientes + dashboard)

// 3. Frontend activa GPS
→ navigator.geolocation.watchPosition()
→ Envía coordenadas cada 4 segundos a /api/logistica/tracking
→ WebSocket tipo 'ubicacion' al servidor
```

### Para Cliente (seguimiento_cliente.html o seguimiento-publico.html)
```javascript
// 1. Página carga
→ Obtiene asignacionId de URL (?id=123)
→ Fetch /api/logistica/asignaciones/123/seguimiento

// 2. Renderiza timeline con eventos
→ Calcula duración entre estados
→ Muestra último estado con animación

// 3. Conecta a WebSocket
→ Escucha evento 'ruta_iniciada'
→ Auto-recargar datos sin recargar página
→ Mostrar notificación visual + vibración

// 4. (Opcional) Comparte QR por WhatsApp
→ /seguimiento-publico?token=uuid
→ Ver en tiempo real sin login
```

---

## Testing

### Test 1: Flujo Completo (5 min)

```bash
# 1. Crear contrato/asignación (si no existe)
POST /api/contratos con método_entrega=domicilio
→ Disparador crea logistica_asignacion en estado 'en_preparacion'

# 2. Obtener ID de asignación
curl "http://localhost:3000/api/logistica/dashboard" \
  -H "Authorization: Bearer $TOKEN"

# 3. Generar QR público
curl -X POST "http://localhost:3000/api/logistica/asignaciones/123/generar-qr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cliente_email":"test@email.com", "cliente_telefono":"+5214161234567"}'

# 4. Copiar token_uuid y probar URL pública
# Abre en navegador: http://localhost:3000/seguimiento-publico?token=550e8400...

# 5. Iniciar ruta (como chofer)
curl -X POST "http://localhost:3000/api/logistica/asignaciones/123/iniciar-ruta" \
  -H "Authorization: Bearer $CHOFER_TOKEN"

# 6. Observar:
# - Cliente ve "en_camino" sin recargar (WebSocket)
# - Recibe SMS/Email si Twilio está configurado
# - Dashboard muestra vehículo con GPS
```

### Test 2: WebSocket Tiempo Real

```html
<!-- Abrir en consola de navegador -->
<script src="/scripts/logistica/websocket.servicio.js"></script>

<script>
// Conectar
LogisticaWebSocket.connect();

// Escuchar mensajes
LogisticaWebSocket.onMessage((data) => {
  console.log('Evento WebSocket:', data);
});

// Simular envío (desde otro cliente)
LogisticaWebSocket.send({
  tipo: 'ruta_iniciada',
  asignacion_id: 123
});
</script>
```

### Test 3: QR Público (sin login)

```javascript
// Abrir en incógnito / navegador diferente
const token = 'el_token_generado';
const response = await fetch(
  `/api/logistica/seguimiento-publico?token=${token}`
);
const datos = await response.json();
console.log('Sin autenticación:', datos);
```

---

## Troubleshooting

### Error: "Tabla seguimiento_eventos no existe"
```sql
-- Ejecutar el script nuevamente
\i database/seguimiento_eventos_schema.sql
```

### WebSocket no conecta
```javascript
// Verificar en navegador:
// 1. DevTools → Network → type "websocket"
// 2. Debe mostrar wss:// o ws://
// 3. Estado: "connected"

// El servidor debe estar en:
// /ws/logistica (sin /api/logistica)
```

### SMS no se envía
```javascript
// Verificar en .env:
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID || 'NO CONFIGURADO');

// Si no está, SMS silentemente no se envía (log warning)
// Revisar logs: grep -i twilio logs.txt
```

### QR no carga seguimiento público
```javascript
// 1. Verificar token en BD:
SELECT * FROM seguimiento_tokens_publicos 
WHERE token_uuid = 'el_token';

// 2. Verificar que expires_at > CURRENT_TIMESTAMP
// 3. Si token es NULL: checkear que asignacion_id existe
```

### Cliente no ve actualización en tiempo real
```javascript
// Opción 1: Verificar conexión WebSocket
// → Abrir DevTools → Console
// → Ver mensaje "[WS] Conectado a servidor de logistica"

// Opción 2: Verificar filtro de asignacionId
// → El evento debe tener mismo asignacion_id que en URL

// Opción 3: Fallback a polling
// → Página se recarga cada 30 segundos si WebSocket falla
```

---

## Próximas Mejoras (Fase 2)

- [ ] **Geolocalización en Mapa** - Mostrar ubicación viva del vehículo
- [ ] **Notificación GPS automática** - Enviar: "Estamos a X km de tu ubicación"
- [ ] **Rate Limiting** - Limitar acceso público por IP
- [ ] **Expiración automática** - Limpiar tokens expirados cada día
- [ ] **Firma digital** - Validar identidad del receptor (foto con face recognition)
- [ ] **Integración con Apple Maps** - Deep link desde notificación SMS
- [ ] **Analytics** - Dashboard de entregas completadas vs fallidas
- [ ] **WhatsApp Business API** - Integración nativa en lugar de SMS

---

## Contacto & Soporte

Para preguntas sobre implementación:
- 📧 Email: tech@andamiostorres.com
- 💬 WhatsApp: +1234567890 (modo asistencia)

**Versión:** 1.0  
**Última actualización:** 2026-04-10  
**Mantenedor:** Equipo Técnico Andamios Torres
