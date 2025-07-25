const FACTURAMA_USER = process.env.FACTURAMA_USER;
const FACTURAMA_PASSWORD = process.env.FACTURAMA_PASSWORD;
const FACTURAMA_BASE_URL = process.env.FACTURAMA_BASE_URL || 'https://apisandbox.facturama.mx';

function getFacturamaToken() {
  return Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`).toString('base64');
}

// Construye el JSON CFDI 4.0 para arrendamiento
function buildCfdiJson({ emisorConfig, receptor, conceptos, formaPago, metodoPago, usoCfdi, ...otros }) {
  // Aquí puedes ajustar según tus necesidades y catálogos
  return {
    Serie: "A",
    Folio: otros.folio || "1",
    Fecha: new Date().toISOString(),
    FormaPago: formaPago,
    MetodoPago: metodoPago,
    Moneda: "MXN",
    TipoDeComprobante: "I",
    LugarExpedicion: emisorConfig.codigo_postal,
    Emisor: {
      Rfc: emisorConfig.rfc,
      Nombre: emisorConfig.razon_social,
      RegimenFiscal: emisorConfig.regimen_fiscal
    },
    Receptor: {
      Rfc: receptor.rfc,
      Nombre: receptor.nombre,
      UsoCFDI: usoCfdi,
      DomicilioFiscalReceptor: receptor.codigo_postal,
      RegimenFiscalReceptor: receptor.regimen_fiscal
    },
    Conceptos: conceptos.map(c => ({
      ClaveProdServ: c.claveProdServ,
      Cantidad: c.cantidad,
      ClaveUnidad: c.claveUnidad,
      Unidad: c.unidad,
      Descripcion: c.descripcion,
      ValorUnitario: c.valorUnitario,
      Importe: c.cantidad * c.valorUnitario,
      ObjetoImp: "02", // Sí objeto de impuesto
      Impuestos: {
        Traslados: [
          {
            Base: c.cantidad * c.valorUnitario,
            Impuesto: "002",
            TipoFactor: "Tasa",
            TasaOCuota: 0.16,
            Importe: c.cantidad * c.valorUnitario * 0.16
          }
        ]
      }
    })),
    Impuestos: {
      TotalImpuestosTrasladados: conceptos.reduce((sum, c) => sum + (c.cantidad * c.valorUnitario * 0.16), 0),
      Traslados: [
        {
          Impuesto: "002",
          TipoFactor: "Tasa",
          TasaOCuota: 0.16,
          Importe: conceptos.reduce((sum, c) => sum + (c.cantidad * c.valorUnitario * 0.16), 0)
        }
      ]
    }
  };
}

module.exports = { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL };


