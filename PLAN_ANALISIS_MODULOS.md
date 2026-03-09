# Plan De Analisis Operativo (Ventas, Contratos, Clientes, Facturacion)

## 1) Alcance
- Modulos analizados: `ventas.html`, `contratos.html`, `clientes.html`, `facturacion.html`.
- Objetivo: consolidar KPIs y series por periodos para alimentar `analisis.html`.
- Restriccion actual: facturacion timbrada existe, pagos aun mayormente fuera del sistema.

## 2) Diagnostico Actual

### Ventas (`public/js/venta.js`)
- KPIs actuales:
  - Total clientes
  - Clientes activos (actividad 30 dias)
  - Ingresos del mes (sobre cotizaciones en estados de cierre)
  - Ticket promedio
  - Cotizaciones activas
  - Cotizaciones aprobadas hoy/semana
  - Margen bruto (estimado con subtotal/total)
- Fortalezas:
  - Filtros por fecha y atributos comerciales.
  - Graficas y recalculo completo en frontend.
- Brechas:
  - Calculo distribuido en frontend (riesgo de discrepancias).
  - KPI de margen depende de calidad de subtotal/costos.
  - No existe serie canonica para analisis multi-modulo.

### Contratos (`public/js/contratos.js`)
- KPIs actuales:
  - Activos
  - Concluidos
  - Por vencer 7 dias
  - Monto activo
- Fortalezas:
  - Logica de estado dinamico y graficas 12 meses.
- Brechas:
  - Clasificacion de estado no estandarizada backend/frontend.
  - Sin endpoint analitico dedicado por periodo.

### Clientes (`public/js/clientes-ui.js`, `src/controllers/clientes.js`)
- KPIs actuales:
  - Total clientes / activos / calificacion promedio / ingresos totales
  - Top clientes
  - Satisfaccion por encuesta
  - Historial detallado por cliente (cotizaciones, contratos, facturas, pagos, NC, ledger)
- Fortalezas:
  - Backend ya expone `/api/clientes/stats` y `/api/clientes/:id/historial`.
- Brechas:
  - Mezcla datos globales y sin recorte de periodo en `stats`.
  - Integracion a analisis transversal inexistente.

### Facturacion (`public/js/facturacion.js`, `src/controllers/facturacion.js`)
- KPIs actuales:
  - Total facturas, ingresos, pendientes/por cobrar, canceladas/monto cancelado
  - Selectores de periodo (historico/mes/anio)
  - Evolucion mensual + distribucion por estado
- Fortalezas:
  - Backend con estadisticas robustas y filtros consistentes.
- Brechas:
  - Diferencia entre estado fiscal y estado de cobranza.
  - Falta de cobranzas integrales al no registrar todos los pagos.

## 3) Implementacion Hecha En Esta Fase
- Nuevo endpoint unificado:
  - `GET /api/analisis/operativo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&periodo=dia|semana|mes`
- Archivo:
  - `src/routes/analisis.js`
- Entrega:
  - `resumenGlobal` con ratios de conversion.
  - Bloques por modulo:
    - `ventas.kpis`, `ventas.embudo`, `ventas.serie`
    - `contratos.kpis`, `contratos.serie`
    - `facturacion.kpis`, `facturacion.estados`, `facturacion.serie`
    - `clientes.kpis`, `clientes.serieNuevos`, `clientes.topClientesValor`

## 4) KPIs Recomendados (Siguiente Fase)
- Ventas:
  - Tasa de conversion cotizacion->contrato.
  - Aging de cotizaciones (0-7, 8-15, 16-30, 30+ dias).
  - Tiempo promedio de cierre.
- Contratos:
  - Tasa de renovacion/prorroga.
  - Valor promedio por contrato.
  - Riesgo de vencimiento por cartera.
- Facturacion:
  - DSO (dias de cobro) real cuando pagos esten capturados.
  - Cobranza neta = facturado timbrado - NC - cancelaciones.
  - Semaforo de cartera vencida por antiguedad.
- Clientes:
  - LTV estimado (contratos + facturas - NC).
  - Cohortes de clientes nuevos por periodo.
  - Retencion por recompra.

## 5) Roadmap Corto
1. Conectar `analisis.html` al endpoint `/api/analisis/operativo`.
2. Definir catalogo fijo de KPIs/formatos para evitar duplicados por modulo.
3. Estandarizar estados (`timbrada/timbrado`, `activo/ACTIVO`, etc.).
4. Cuando me compartas los ajustes de graficas, acoplar visualizacion con estas series.

