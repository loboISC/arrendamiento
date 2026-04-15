# 📋 GUÍA DE IMPLEMENTACIÓN: Sistema de Seguimiento de Entregas
**Andamios Torres - Sistema SAPT**

---

## 🎯 DESCRIPCIÓN GENERAL

Se ha integrado un sistema automático de seguimiento que registra eventos cada vez que cambia el estado de una asignación logística (CONTRATO o VENTA). El cliente puede ver el progreso en tiempo real mediante una URL única.

---

## 📊 FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CONTRATO CREADO                                              │
│    └─> Se crea asignación automática                            │
│        └─> Registra evento: "en_preparacion"                    │
│            (Equipos verificados en bodega)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLIENTE RECIBE URL DE SEGUIMIENTO                            │
│    └─> /seguimiento_cliente.html?id={asignacionId}             │
│        └─> Ve timeline de eventos en tiempo real                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CHOFER COMPLETA ENTREGA (con foto)                           │
│    └─> registra evento: "completado"                            │
│        └─> Cliente ve: "✓ Entregado Satisfactoriamente"         │
│        └─> Se envía email con evidencia                         │
└─────────────────────────────────────────────────────────────────┘
            O
┌─────────────────────────────────────────────────────────────────┐
│ 3b. CHOFER REPORTA FALLO                                        │
│     └─> registra evento: "fallido"                              │
│         └─> Cliente ve: "✗ Fallo en entrega"                    │
│         └─> Se crea nueva asignación automáticamente            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 CÓMO FUNCIONA TÉCNICAMENTE

### A. Registro Automático de Eventos

Los eventos se registran **automáticamente** en estos puntos:

| Paso | Endpoint | Evento | Estado |
|------|----------|--------|--------|
| 1️⃣ Asignación creada | `POST /api/logistica/asignaciones` | `crearAsignacion()` | `en_preparacion` |
| 2️⃣ Entrega completada | `POST /api/logistica/asignaciones/{id}/completar` | `completarAsignacionEvidencia()` | `completado` |
| 3️⃣ Fallo reportado | `POST /api/logistica/asignaciones/{id}/fallido` | `marcarAsignacionFallida()` | `fallido` |

### B. Cada evento registra:

```javascript
{
  asignacion_id: 123,
  estado: "completado",
  descripcion: "Equipos entregados satisfactoriamente. Recibió: Juan García",
  ubicacion: "Obra Centro Comercial - Calle 5 #123",
  metadata: {
    tipo_operacion: "ENTREGA",           // o RECOLECCION
    recibio_por: "Juan García",
    evidencia_url: "/uploads/evidencias/evidencia-123-xyz.jpg",
    chofer_id: "089"
  },
  created_at: "2026-04-10 15:45:32"
}
```

---

## 📱 CÓMO VER EL SEGUIMIENTO

### Para el Cliente:
```
1. Se envía email con enlace:
   http://localhost:3001/public/templates/pages/seguimiento_cliente.html?id=123

2. El cliente abre el enlace en el navegador

3. Ve:
   ┌─────────────────────────────────┐
   │ 📦 Audífonos Inalámbricos       │
   │    Llega hoy, 12:00 - 18:00     │
   │ TRK-123                         │
   └─────────────────────────────────┘
   
   ┌─ 01 may 09:36 ─────────────────┐
   │ ● Equipos verificados           │
   │                                 │
   ├─ 04 may 14:21 ─────────────────┤
   │ ● Equipos entregados ✓          │
   │   + 3d 4h 45m                   │
   │   Recibió: Juan García          │
   │   📷 Ver Foto                    │
   └─────────────────────────────────┘
```

### Para el Administrador (Logística):
```
GET /api/logistica/asignaciones/123/seguimiento

Respuesta:
{
  "tracking": "TRK-123",
  "producto": {
    "nombre": "Andamio Torre 15m",
    "cantidad": 1,
    "vendedor": "Andamios Torres"
  },
  "eventos": [
    {
      "id": 1,
      "estado": "en_preparacion",
      "descripcion": "Equipos verificados...",
      "fecha": "2026-05-01T09:36:00.000Z"
    },
    {
      "id": 2,
      "estado": "completado",
      "descripcion": "Equipos entregados...",
      "fecha": "2026-05-04T14:21:00.000Z"
    }
  ]
}
```

---

## 🧪 PRUEBA PASO A PASO

### 1️⃣ Crear un Contrato (Disparador)

```
Panel de Logística → Nueva Asignación
- Seleccionar cliente
- Seleccionar contrato
- Seleccionar vehículo
- Seleccionar chofer
- Guardar
```

**Resultado esperado:**
- ✅ Se crea asignación
- ✅ Se registra evento "en_preparacion" automáticamente
- ✅ Se envía notificación al chofer por email

---

### 2️⃣ Ver Seguimiento en la URL

```
URL: http://localhost:3001/public/templates/pages/seguimiento_cliente.html?id=1

Debe mostrar:
- TRK-1
- 1 evento: "Equipos verificados y listos para entrega en obra"
- Fecha: 10 abr 14:20
```

---

### 3️⃣ Completar Entrega (con foto)

```
Desde entrega_detalle.html:
1. Subir foto de evidencia
2. Ingresar nombre del que recibe
3. Hacer clic "Marcar como Entregado"
```

**Resultado esperado:**
- ✅ Se registra evento "completado" automáticamente
- ✅ Se calcula duración: "3d 4h 45m"
- ✅ Se envía email al cliente con evidencia
- ✅ Cliente ve actualización en tiempo real

---

### 4️⃣ Recargar URL de Seguimiento

```
http://localhost:3001/public/templates/pages/seguimiento_cliente.html?id=1

Debe mostrar AHORA:
- Evento 1: "Equipos verificados..." (10 abr 09:36)
- Evento 2: "Equipos entregados..." (10 abr 14:21) ← NUEVO
  └─ + 3d 4h 45m (tiempo entre estados)
  └─ Recibió: [nombre]
  └─ 📷 Ver Foto
```

---

## 🔐 SEGURIDAD

- ✅ Requiere `token` de autenticación en localStorage
- ✅ Solo se muestra info del cliente correspondiente
- ✅ URL es única por asignación
- ✅ Se puede compartir con cliente sin riesgo

---

## 🛠️ FUNCIONES MODIFICADAS

### `src/server/controllers/logistica.js`

#### 1. Nueva función auxiliar:
```javascript
async function registrarEventoSeguimiento(
  asignacionId, 
  estado, 
  descripcion, 
  ubicacion = null, 
  metadata = null
)
```

#### 2. Modificaciones:
- **crearAsignacion()** → Registra "en_preparacion"
- **completarAsignacionEvidencia()** → Registra "completado"
- **marcarAsignacionFallida()** → Registra "fallido"

---

## 📊 DATOS REGISTRADOS

### Tabla: `seguimiento_eventos`

```sql
id                | asignacion_id | estado          | descripcion                    | created_at       | metadata
------------------+---------------+-----------------+--------------------------------+------------------+---------
1                 | 1             | en_preparacion  | Equipos verificados...         | 2026-04-10 09:36 | {...}
2                 | 1             | completado      | Equipos entregados satisf...   | 2026-04-10 14:21 | {...}
```

---

## 🚀 PRÓXIMAS MEJORAS (FASE 2)

- [ ] **WebSocket**: Actualización en tiempo real (sin recargar)
- [ ] **Geolocalización**: Mostrar ubicación GPS del chofer
- [ ] **QR Público**: Código QR para compartir seguimiento sin login
- [ ] **Push Notifications**: Notificaciones al cliente en cambios
- [ ] **SMS**: Notificaciones por SMS además de email
- [ ] **Timeline Interactivo**: Ver detalles de cada evento

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Qué pasa si la asignación falla?**
A: Se registra evento "fallido" y se crea automáticamente una nueva asignación en "en_espera" para reintentar.

**P: ¿El cliente ve el seguimiento en tiempo real?**
A: Actualmente necesita recargar la página. En la Fase 2 agregaremos WebSocket para actualización instantánea.

**P: ¿Cómo envío la URL al cliente?**
A: Se puede agregar al email que ya se envía. URL: 
```
http://[tu-dominio]/public/templates/pages/seguimiento_cliente.html?id={asignacionId}
```

**P: ¿Se puede compartir públicamente?**
A: No por ahora (requiere token). En Fase 2 haremos QR público sin autenticación.

---

## 📞 CONTACTO TÉCNICO

- Archivo principal: `src/server/controllers/logistica.js`
- BD: Tabla `seguimiento_eventos`
- Frontend: `public/templates/pages/seguimiento_cliente.html`
- Servicio: `public/scripts/logistica/logistica.servicio.js`

---

**Última actualización:** 10 de abril de 2026
**Versión:** 1.0 - Sistema Base
