# Reglas SAT para Notas de Credito

## Reglas obligatorias

- La nota de credito siempre debe originarse desde una factura existente.
- El UUID relacionado se toma automaticamente de la factura.
- `TipoRelacion` por defecto: `01 - Nota de credito de los documentos relacionados`.
- Tipo de comprobante: `E`.
- No se permite exceder saldo acreditable.
- No se debe usar una nota de credito para simular cancelacion.
- Guardar borrador y timbrar son acciones separadas.

## Saldo acreditable

Formula inicial:

`factura_total - notas_credito_no_canceladas`

Estados considerados como consumo de saldo:
- `BORRADOR`
- `TIMBRANDO`
- `TIMBRADA`
- `APLICADA`
- `PARCIAL`

## Impuestos

El calculo local aplica:
- IVA trasladado del 16%.
- Retenciones opcionales por concepto.
- Redondeo a dos decimales para totales.

## Trazabilidad

Cada solicitud y respuesta fiscal se registra en `credit_note_logs`:
- `request_sat`
- `response_sat`
- `error`
- `user_id`
- `created_at`

## Errores comunes

- Factura origen sin UUID.
- Motivo fiscal vacio.
- Total de nota mayor al saldo disponible.
- Conceptos sin importe positivo.
- Credenciales del proveedor CFDI incompletas.
