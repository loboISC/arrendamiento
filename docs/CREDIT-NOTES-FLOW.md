# Flujo de Notas de Credito CFDI 4.0

1. El usuario busca una factura timbrada.
2. El sistema muestra saldo disponible, estado SAT y UUID.
3. El usuario elige el motivo de egreso: devolucion, descuento, bonificacion, ajuste administrativo o correccion parcial.
4. Se importan conceptos de la factura origen.
5. El usuario ajusta cantidades, descuento fijo o descuento porcentual.
6. El sistema recalcula subtotal, IVA, retenciones, total y saldo restante.
7. Se guarda un borrador con estado `BORRADOR`.
8. La vista previa permite validar CFDI, PDF/XML y confirmar timbrado.
9. Al timbrar, el estado cambia a `TIMBRANDO` y despues a `TIMBRADA` o `ERROR`.
10. Al aplicar, el estado cambia a `APLICADA` y se registra movimiento en cuentas por cobrar.

## Estados

- `BORRADOR`: nota guardada sin timbrar.
- `TIMBRANDO`: solicitud enviada al proveedor.
- `TIMBRADA`: CFDI de egreso vigente.
- `ERROR`: fallo del proveedor o validacion.
- `CANCELADA`: CFDI cancelado.
- `APLICADA`: saldo aplicado.
- `PARCIAL`: aplicacion parcial futura.

## Arquitectura

El modulo usa controller/service/repository:
- Controller: HTTP y respuestas.
- Service: reglas fiscales y proveedor CFDI.
- Repository: consultas SQL.
- Provider: Facturama o APIFiscal sin acoplar la logica fiscal.

La capa `ProveedorCFDI` permite cambiar Facturama por APIFiscal sin reescribir el servicio de notas.
