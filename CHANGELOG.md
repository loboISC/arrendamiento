# CHANGELOG (Octubre 2025)

- Autor: JONATHAN zAMBRANO
- Rango: 2025-10-01 → 2025-10-23
- Commits: 24
- Días con actividad: 23

## Resumen por categorías

- **Venta**
  - Avances: Almacenes completos, resumen de venta, toolbar IVA, botón "Todos", entrega en sucursal, parches de estilos.
  - Commits: 56d1a20, 6eb9c56, 7d1926b, 3ef9ba8, 16592a9, fb28c4d, 25c3ad3, 84edf49, 01f5267, 489d9e4, 65d1eb3, 13e8179, 58cec83, 5748b3e, 967910f, 97eb369.

- **Renta**
  - Avances: Resumen de cotización y financiero, botones/UX, tablas iniciales.
  - Commits: 3caccfc, fb06617, 6f53fe1, 17ddee7, 991cfea.

- **Frontend (UI/UX)**
  - Avances: Componentes de Ubicación (chips de almacenes), resúmenes de cotización/financiero, toolbar IVA, botones “Todos” y “Entrega en sucursal”, mejoras visuales en `cotizacion_venta.css` y flujos en HTML.
  - Commits destacados: 56d1a20, 6eb9c56, 7d1926b, 3ef9ba8, 16592a9, fb28c4d, 25c3ad3, 84edf49, 01f5267, 489d9e4, 65d1eb3, 13e8179, 58cec83, 97eb369, 6f53fe1, 17ddee7, 991cfea, fb06617, 3caccfc.
  - Nota: Categoría transversal a Venta/Renta (no afecta conteos únicos).

- **Backend/API y DB**
  - Avances: Endpoints y tabla de almacenes; wiring en servidor.
  - Commits: c4400c8.

- **Clientes**
  - Avances: Parche en módulo clientes (UI/validaciones).
  - Commits: 3caccfc.

- **Merges**
  - Avances: Sin cambios funcionales; sincronización con `main`.
  - Commits: cf2eed9, 967910f, 070d308, 5748b3e.

## Línea de tiempo (hitos)

- 02–06 Oct: Base de venta (accesorios, menús, estilos).
- 07–10 Oct: Renta (tablas, botones, resúmenes) y parches generales.
- 14 Oct: Venta: bodegas/almacenes activos y resumen; merge.
- 16–18 Oct: Parches “Todos”; entrega en sucursal; backend de almacenes.
- 20–23 Oct: Merges y parches UX/IVA.

## Lista ultra breve de commits (solo Tu Nombre)

- 97eb369 (2025-10-23): Parche toolbar IVA (venta)
- 5748b3e (2025-10-22): Merge desde main
- 58cec83 (2025-10-22): Botón “Todos” y “entrega en sucursal” (venta)
- 13e8179 (2025-10-21): Parche entrega en sucursal (venta)
- 070d308 (2025-10-20): Merge desde main
- c4400c8 (2025-10-18): Backend almacenes + tabla + rutas
- 65d1eb3 (2025-10-16): Parche “Todos” y limpieza select (venta)
- 489d9e4 (2025-10-14): Almacenes venta funcionando
- 01f5267 (2025-10-14): Bodegas venta (UI + lógica)
- 967910f (2025-10-14): Merge desde main
- 84edf49 (2025-10-14): Venta 14/10 (incluye resumen)
- 6f53fe1 (2025-10-10): Botones renta 10/10
- 17ddee7 (2025-10-10): Resumen de cotización (renta)
- 991cfea (2025-10-10): Resumen financiero (renta)
- fb06617 (2025-10-09): Tablas renta 1/2
- cf2eed9 (2025-10-08): Merge desde main
- 3caccfc (2025-10-08): Parche clientes/renta estilos
- 25c3ad3 (2025-10-07): Parche renta/venta; estilos venta
- fb28c4d (2025-10-06): Parche venta (HTML/CSS)
- 16592a9 (2025-10-06): Ajustes `cotizaciones.html` y estilos venta
- 3ef9ba8 (2025-10-04): Menú lateral (venta)
- 7d1926b (2025-10-03): Parche 2 (venta script)
- 6eb9c56 (2025-10-03): Parche 03/10 (venta)
- 56d1a20 (2025-10-02): Accesorios venta

## Métricas por categoría (tus commits)

- **Venta**: 16
- **Renta**: 5
- **Backend/API y DB**: 1
- **Clientes**: 1
- **Merges**: 4
- **Frontend**: transversal a Venta/Renta (principalmente UI/UX)

## Archivos más impactados

- **`public/scripts/cotizacion_venta.js`**: lógica central de Venta (filtros, eventos, integración de almacenes).
- **`public/scripts/venta_warehouses.js`**: carga/selección de almacenes y filtrado de productos.
- **`public/cotizacion_venta.html`**: estructura UI (Ubicación, resúmenes, botones “Todos” y “Entrega en sucursal”).
- **`public/styles/cotizacion_venta.css`**: ajustes visuales, chips de almacenes, toolbar/UX.
- **`public/scripts/cotizacion_renta.js`**: resúmenes y mejoras de UX en Renta.

## Detalle ampliado por hitos

- **02–06 Oct (Base Venta)**
  - Accesorios, menús laterales, primeros estilos.
  - Archivos: `public/cotizacion_venta.html`, `public/styles/cotizacion_venta.css`.

- **07–10 Oct (Renta consolidación)**
  - Resumen de cotización y financiero, botones y tablas.
  - Archivos: `public/scripts/cotizacion_renta.js`, `public/cotizacion_renta.html`.

- **14 Oct (Venta: almacenes y resumen)**
  - Activación de bodegas/almacenes y resumen de Venta.
  - Archivos: `public/scripts/venta_warehouses.js`, `public/scripts/cotizacion_venta.js`, `public/cotizacion_venta.html`.

- **16–18 Oct (UX Venta + Backend almacenes)**
  - Botón “Todos”, “Entrega en sucursal”, y endpoints/tabla de almacenes.
  - Archivos: `public/scripts/cotizacion_venta.js`, `src/controllers/almacenesController.js`, `src/routes/almacenes.js`, `scripts/create_almacenes_table.sql`.

- **20–23 Oct (Merges + IVA)**
  - Sincronizaciones con `main` y parche de toolbar IVA.
  - Archivos: `public/scripts/cotizacion_venta_summary.js`, `public/cotizacion_venta.html`.



## Actividad por día (conteo de commits)

- 2025-10-23: 1
- 2025-10-22: 2
- 2025-10-21: 1
- 2025-10-20: 1
- 2025-10-18: 1
- 2025-10-16: 1
- 2025-10-14: 4
- 2025-10-10: 3
- 2025-10-09: 1
- 2025-10-08: 2
- 2025-10-07: 1
- 2025-10-06: 2
- 2025-10-04: 1
- 2025-10-03: 2
- 2025-10-02: 1

## Highlights técnicos

- **Almacenes (Venta)**: sistema completo de ubicación/selección con chips y filtrado en `public/scripts/venta_warehouses.js` integrado a `public/scripts/cotizacion_venta.js`.
- **Resúmenes**: lógica separada para Venta en `public/scripts/cotizacion_venta_summary.js` y consolidación de Renta en `public/scripts/cotizacion_renta.js`.
- **UX Venta**: botón “Todos”, “Entrega en sucursal”, toolbar IVA y ajustes de estilos en `public/styles/cotizacion_venta.css`.
- **Backend almacenes**: endpoints y tabla dedicada (`src/controllers/almacenesController.js`, `src/routes/almacenes.js`, `scripts/create_almacenes_table.sql`).

## Riesgos/pendientes detectados

- **Sin seguimiento de métricas de líneas**: falta un resumen de inserciones/borrados por commit (se puede extraer con `git log --numstat`).
- **Merges frecuentes**: validar conflictos silenciosos en archivos de Venta tras cada merge.
- **Consistencia de autor**: normalizar firma/usuario en Git para el filtrado futuro.
