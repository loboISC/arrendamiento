# API de Notas de Credito

Base: `/api`

## Facturas

`GET /invoices/search`

Busca facturas timbradas para generar una nota de credito. Parametros:
- `search`: folio, UUID, RFC o cliente.
- `fecha`: fecha exacta de emision.

Respuesta: folio, cliente, total, saldo disponible, estado SAT y UUID.

## Notas de Credito

`GET /credit-notes`

Lista notas de credito.

`GET /credit-notes/:id`

Obtiene detalle, conceptos y relaciones.

`POST /credit-notes`

Guarda borrador. No timbra.

Campos principales:
- `invoice_id`: factura origen.
- `reason`: motivo fiscal.
- `provider`: `facturama` o `apifiscal`.
- `items`: conceptos acreditables.

`POST /credit-notes/:id/stamp`

Timbra el CFDI de egreso con el proveedor configurado.

`POST /credit-notes/:id/cancel`

Cancela la nota de credito. Requiere `motivo`.

`POST /credit-notes/:id/apply`

Aplica el saldo contra cuentas por cobrar.

`GET /credit-notes/:id/pdf`

Reservado para descarga PDF desde almacenamiento/proveedor.

`GET /credit-notes/:id/xml`

Reservado para descarga XML desde almacenamiento/proveedor.
