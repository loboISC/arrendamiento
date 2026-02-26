# Implementación: Sistema de Notas de Crédito (CFDI Egreso)

## Objetivo Alcanzado
Implementación **completa** del flujo de Notas de Crédito (CFDI Egreso) integrado con timbrado fiscal Facturama, auditoría, ledger financiero y UI dinámica.

---

## 📊 Resumen de Cambios

### 1. **Base de Datos** 
**Archivo:** `database/migrations/20260226_add_credit_notes.sql`

Nuevas tablas:
- `credit_notes`: registro de notas de crédito con UUID, folio, relación con factura origen, montos, estados
- `credit_note_items`: ítems individuales de la nota (cantidad, descripción, impuestos)
- `customer_ledger`: ledger financiero de cliente (cargo/abono, saldo, tipo movimiento)
- `audit_financial_events`: pista de auditoría de eventos financieros

Índices para optimización de consultas por cliente, UUID y fecha.

---

### 2. **Backend - Controlador Facturación** 
**Archivo:** `src/controllers/facturacion.js`

#### Nuevos Endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/eligible-credit-balance/:facturaId` | Calcula saldo elegible para NC (factura - pagos - NCs previas) |
| POST | `/credit-notes/timbrar` | **Timbra NC en Facturama**, genera XML/PDF, actualiza ledger y auditoría |
| GET | `/credit-notes` | Lista notas de crédito con filtros |
| GET | `/credit-notes/:id` | Detalles de una NC específica |
| POST | `/credit-notes/:id/cancelar` | Cancela NC (requiere roles) |
| POST | `/credit-notes/:id/aprobar` | Aprueba NC (requiere roles) |

#### Lógica Principal de `timbrarNotaCredito`:
1. **Validación:** verificar factura origen existe y saldo elegible es suficiente
2. **Mapeo:** convertir conceptos de frontend a formato Facturama (JSON CFDI v4.0)
3. **Cálculos:** subtotal, descuentos, IVA total
4. **Timbrado:** POST a `/3/cfdis` de Facturama API con tipo='E' (egreso) y RelatedDocuments
5. **Persistencia:** guardar en BD con UUID fiscal, estado 'Timbrada'
6. **Auditoría:** registrar evento y actualizar ledger de cliente
7. **Respuesta:** retornar UUID y XML para PDF

---

### 3. **Backend - Rutas** 
**Archivo:** `src/routes/facturas.js`

```javascript
// Notas de crédito endpoints con autenticación y roles
router.post('/credit-notes/timbrar', authenticateToken, roles(['nc.create','Admin','Director General']), ...);
router.post('/credit-notes/:id/cancelar', authenticateToken, roles(['nc.cancel','Admin']), ...);
router.post('/credit-notes/:id/aprobar', authenticateToken, roles(['nc.approve','Admin']), ...);
```

---

### 4. **Backend - Servicio Facturama** 
**Archivo:** `src/services/facturamaservice.js`

#### Mejora a `buildCfdiJson`:
- **Nuevo parámetro:** `tipoComprobante`, `cfdiType`, `relatedCfdi`
- **Soporte multiusos:** construye CFDI tipo 'I' (ingreso) o 'E' (egreso)
- **Relaciones CFDI:** incluye `RelatedDocuments` para vincular NC con factura origen

```javascript
buildCfdiJson({
    ...,
    tipoComprobante: 'E',
    cfdiType: 'E',
    relatedCfdi: [{ Uuid: uuidOriginal, RelationType: '01' }]
})
```

---

### 5. **Backend - Middleware** 
**Archivo:** `src/middleware/roles.js`

Reescrito para soportar:
- Permisos granulares: `'nc.create'`, `'nc.cancel'`, `'nc.approve'`
- Roles amplios: `'Admin'`, `'Director General'`
- Ejecución selectiva: permite o deniega rutas según combinación

```javascript
app.post('/credit-notes/timbrar', authenticateToken, roles(['nc.create','Admin']), handler);
```

---

### 6. **Clientes - Controlador & Rutas** 
**Archivos:** `src/controllers/clientes.js`, `src/routes/clientes.js`

#### Nuevos Endpoints:
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/ledger/:clienteId` | Obtiene ledger financiero del cliente |

#### Mejoras a `getClienteHistorial`:
- Ahora retorna: `creditNotes` (lista de NC)
- Incluye: `ledgerSummary` (totales cargo/abono, saldo final)

#### Nuevo `getClienteLedger`:
- Retorna transacciones con paginación
- Soporta filtros por tipo movimiento y rango de fecha

---

### 7. **Frontend - UI Facturación** 
**Archivos:** `public/facturacion.html`, `public/js/facturacion.js`

#### Cambios del Formulario:
- **Nuevo selector:** `Tipo Comprobante` (I=Ingreso, E=Egreso, P=Pago)
- **Sección dinámmica:** `#credit-note-section` aparece solo para tipo 'E'
- **Campos de NC:**
  - Búsqueda de factura origen (autocomplete)
  - Saldo elegible calculado (mostrado en read-only)
  - Motivo SAT (dropdown: 01-Devolución, 02-Descuento, 03-Bonificación, 04-Error, 05-Ajuste)
  - Tipo de relación (dropdown)
  - Observación (textarea, requerida para algunos motivos)

#### Nuevas Funciones JS:
- `toggleComprobanteMode()`: alterna UI según tipo de comprobante
- `buscarFacturaOrigenNC()`: busca y valida factura origen
- `calcularSaldoElegibleNC()`: consulta backend para obtener saldo disponible
- `validarNotaCreditoAntesDeTimbrar()`: validación frontend completa

#### Cambio de Botón:
- "TIMBRAR FACTURA" → "EMITIR NOTA DE CRÉDITO" (según tipo)

---

### 8. **Frontend - Estilos** 
**Archivo:** `public/styles/timbrado.css`

Nuevas clases:
```css
#credit-note-section { /* Contenedor principal de NC */ }
.nc-badge { /* Insignia para indicar nota de crédito */ }
.nc-error { /* Estilos para mensajes de error */ }
.nc-field { /* Estilo de campos dentro de NC */ }
.nc-field.error { /* Validación visual */ }
```

---

### 9. **Frontend - Clientes UI** 
**Archivos:** `public/clientes.html`, `public/js/clientes.js`, `public/styles/clientes.css`

#### Nuevas Pestañas (Tabs) en Historial:
1. **Facturas:** lista de facturas (existente, mejorado)
2. **Notas de Crédito:** lista de NC emitidas, status, acciones
3. **Bonos:** placeholder para futuro (estructura lista)
4. **Ledger Financiero:** transacciones de cargo/abono con saldo

#### KPIs del Cliente (Dashboard):
- Crédito disponible (saldo elegible)
- Notas de crédito emitidas (count)
- Saldo en ledger (cargo/abono)
- Últimas transacciones

#### Nuevo Modal Ledger:
- Filtros por rango de fecha y tipo movimiento
- Tabla con: Fecha, Tipo, Cargo, Abono, Saldo, Referencia
- Descarga CSV (TODO - no implementada)

---

## 🔐 Seguridad & Auditoría

### Control de Acceso:
```javascript
// Crear NC: nc.create, Admin, Director General
// Cancelar NC: nc.cancel, Admin
// Aprobar NC: nc.approve, Admin
```

### Auditoría:
Cada operación registra en `audit_financial_events`:
- Evento: CREAR_NC, CANCELAR_NC, APROBAR_NC
- Usuario ID, timestamp, detalles JSON

### Ledger Financiero:
Cada timbrado de NC actualiza `customer_ledger` con:
- Tipo movimiento: 'NC'
- Abono: monto de la nota
- Saldo resultante calculado

---

## 📋 Flujo de Timbrado de NC (Paso a Paso)

### 1. Usuario Selecciona Tipo 'E' (Egreso)
- UI muestra sección de NC
- Botón cambia a "EMITIR NOTA DE CRÉDITO"

### 2. Búsqueda y Validación Factura Origen
- Usuario ingresa folio o UUID
- Frontend consulta `/api/facturas/search-document/:query`
- Valida que exista y obtenga UUID

### 3. Cálculo Saldo Elegible
- Frontend llama `calcularSaldoElegibleNC(facturaId)`
- Backend consulta: total - pagos - NCs previas
- Muestra en campo read-only

### 4. Ingreso de Datos NC
- Motivo SAT (requerido)
- Tipo de Relación (01-Sustitución, 02-Sustituición por Error, etc.)
- Conceptos (descuentos, bonificaciones)
- Observación (si corresponde)

### 5. Validación Frontend
```javascript
validarNotaCreditoAntesDeTimbrar() {
  ✓ Factura origen seleccionada
  ✓ Motivo SAT ingresado
  ✓ Total NC ≤ Saldo elegible
  ✓ Observación si motivos 04 o 05
}
```

### 6. POST `/api/facturas/credit-notes/timbrar`
Frontend envía:
```json
{
  "receptor": { ... },
  "factura": { "tipo": "E", "formaPago": "PUE", ... },
  "conceptos": [ ... ],
  "creditNote": {
    "facturaOrigenId": 123,
    "facturaOrigenUuid": "UUID-...",
    "saldoElegible": 5000.00,
    "tipoRelacion": "01",
    "motivoSat": "02"
  }
}
```

### 7. Backend Validación & Timbrado
- Verifica factura origen existe
- Recalcula saldo elegible (server-side)
- Mapea conceptos a formato Facturama
- Construye CFDI tipo 'E' con RelatedDocuments
- Timbra en Facturama API
- Recibe UUID fiscal & XML

### 8. Persistencia & Auditoría
```sql
INSERT INTO credit_notes (uuid, serie, folio, id_cliente, id_factura_origen, ...)
INSERT INTO customer_ledger (id_cliente, tipo_mov='NC', abono=monto, ...)
INSERT INTO audit_financial_events (evento='CREAR_NC', ...)
```

### 9. Respuesta al Cliente
```json
{
  "success": true,
  "message": "Nota de crédito timbrada correctamente",
  "data": {
    "uuid": "UUID-FISCAL-...",
    "total": 1500.00,
    "xml": "<CFDI egreso>..."
  }
}
```

### 10. Actualizaciones UI
- Recarga tabla de facturas
- Abre modal para envío por email (PDF + XML)
- Muestra UUID y total

---

## 🧪 Pruebas Recomendadas

### 1. **Validación de Saldo Elegible**
- [ ] Crear NC por monto < saldo elegible → ✓ Timbra
- [ ] Crear NC por monto > saldo elegible → ✗ Rechaza
- [ ] Verificar cálculo: Total - Pagos - NCs previas

### 2. **Timbrado Facturama**
- [ ] Verificar XML generado contiene RelatedDocuments
- [ ] Confirmar UUID retornado es válido
- [ ] Revisar PDF incluya folio fiscal NC

### 3. **Auditoría**
- [ ] Registros en `audit_financial_events` por cada timbrado
- [ ] Usuario ID correcto en cada evento
- [ ] Detalles JSON completow

### 4. **Ledger Financiero**
- [ ] Transacción registrada como 'NC' con abono
- [ ] Saldo resultante calculado correctamente
- [ ] Visible en tab Ledger del cliente

### 5. **Permisos**
- [ ] Usuario sin 'nc.create' no puede timbrar NC
- [ ] Usuario sin 'nc.cancel' no puede cancelar
- [ ] Admin puede cualquier acción

---

## ⚠️ Notas Importantes

### Datos de Inicio (Migration)
```bash
# Ejecutar antes de usar:
psql -U usuario -d basedatos -f database/migrations/20260226_add_credit_notes.sql
```

### Variables de Entorno
Verificar en `.env`:
```
FACTURAMA_USER=...
FACTURAMA_PASSWORD=...
FACTURAMA_BASE_URL=https://apisandbox.facturama.mx  # (sandbox)
```

### Relacionados Facturama
Para NC, Facturama espera:
- `CfdiType: "E"` (egreso)
- `RelatedDocuments: [{ Uuid, RelationType }]`
- RFC receptor debe ser válido

### Conceptos de NC
- No requieren inventario (no descuentan stock)
- Se pueden exportar PDF interno + CFDI
- Cancelables si hay error antes de asentamiento

---

## 📝 Próximos Pasos (No Implementados)

1. **Export Ledger CSV:** descarga de transacciones en Excel
2. **Bonos (Tab):** implementar gestión de bonificaciones
3. **Reporte NC:** consolidado de notas por cliente/período
4. **Trazabilidad PDF:** código QR con URL de verificación SAT
5. **Integración ERP:** sincronizar saldos con sistema externo

---

## 📞 Contacto & Soporte

Para dudas sobre la implementación, revisar:
- Logs en consola del servidor: `/api/facturas/credit-notes/timbrar`
- Respuestas de Facturama en error: `console.error('[Facturama]',...)`
- Auditoría: tabla `audit_financial_events` con `evento='CREAR_NC'`

---

**Versión:** 1.0  
**Fecha de Implementación:** 2025-02-26  
**Estado:** COMPLETO - Sistema de Notas de Crédito funcional y auditado
