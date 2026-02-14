const { FacturamaSDK } = require('@marlon07021/facturama-nodejs-sdk');
const fs = require('fs');
const axios = require('axios');

const FACTURAMA_USER = process.env.FACTURAMA_USER;
const FACTURAMA_PASSWORD = process.env.FACTURAMA_PASSWORD;
const FACTURAMA_BASE_URL = process.env.FACTURAMA_BASE_URL || 'https://apisandbox.facturama.mx';

// Inicializar SDK
const facturama = new FacturamaSDK(FACTURAMA_USER, FACTURAMA_PASSWORD, {
  isSandbox: FACTURAMA_BASE_URL.includes('sandbox')
});

function getFacturamaToken() {
  return Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`).toString('base64');
}

/**
 * Carga los certificados CSD a Facturama para un RFC específico (Modalidad Multi-emisor / API-Lite)
 * @param {string} rfc RFC del emisor
 * @param {string} cerPath Ruta al archivo .cer
 * @param {string} keyPath Ruta al archivo .key
 * @param {string} password Contraseña del CSD
 */
async function uploadCsdToFacturama(rfc, cerPath, keyPath, password) {
  try {
    const cerBase64 = fs.readFileSync(cerPath, 'base64');
    const keyBase64 = fs.readFileSync(keyPath, 'base64');

    const csdData = {
      Certificate: cerBase64,
      PrivateKey: keyBase64,
      Password: password
    };

    const token = getFacturamaToken();
    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-lite/csds/${rfc}`,
      csdData,
      {
        headers: {
          'Authorization': `Basic ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Facturama] CSD cargado exitosamente para ${rfc}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Facturama] Error al cargar CSD para ${rfc}:`, errorMsg);
    throw new Error(`Error al cargar CSD en Facturama: ${errorMsg}`);
  }
}

/**
 * Timbra un XML que ya ha sido sellado localmente (Modalidad Multi-emisor / API-Lite)
 * @param {string} xmlString Contenido del XML ya sellado
 */
async function timbrarXmlSellado(xmlString) {
  try {
    const token = getFacturamaToken();
    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-lite/3/cfdis`,
      {
        XmlContent: Buffer.from(xmlString).toString('base64')
      },
      {
        headers: {
          'Authorization': `Basic ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[Facturama] Error al timbrar XML sellado:', errorMsg);
    throw new Error(`Error de timbrado en Facturama (API-Lite): ${errorMsg}`);
  }
}

// Construye el JSON CFDI 4.0 para arrendamiento (Mantenido por compatibilidad y fallback)
function buildCfdiJson({ emisorConfig, receptor, conceptos, formaPago, metodoPago, usoCfdi, subtotal = 0, total = 0, totalImpuestosTrasladados = 0, ...otros }) {
  if (!conceptos || !Array.isArray(conceptos)) {
    throw new Error('Conceptos debe ser un array válido');
  }

  const expeditionPlace = emisorConfig.codigo_postal || '01000';

  if (receptor.rfc === 'XAXX010101000') {
    return {
      CfdiType: "I",
      PaymentForm: formaPago,
      PaymentMethod: "PUE",
      ExpeditionPlace: expeditionPlace,
      Folio: otros.folio || "1",
      GlobalInformation: {
        Periodicity: "01",
        Months: String(new Date().getMonth() + 1).padStart(2, '0'),
        Year: new Date().getFullYear()
      },
      Receiver: {
        Rfc: "XAXX010101000",
        CfdiUse: "S01",
        Name: "PUBLICO EN GENERAL",
        FiscalRegime: "616",
        TaxZipCode: expeditionPlace
      },
      Items: conceptos.map(item => ({
        ProductCode: item.ClaveProductoServicio || item.ClaveProdServ,
        Description: item.Descripcion,
        UnitCode: item.ClaveUnidad,
        Quantity: item.Cantidad,
        UnitPrice: item.ValorUnitario,
        Subtotal: item.Importe,
        TaxObject: item.ObjetoImp || "02",
        Total: item.Importe + (item.Importe * 0.16),
        Taxes: [{ Total: (item.Importe * 0.16), Name: "IVA", Base: item.Importe, Rate: 0.16, IsRetention: false }]
      }))
    };
  }

  const cfdiJson = {
    Serie: "A",
    Folio: otros.folio || "1",
    Fecha: new Date().toISOString(),
    FormaPago: formaPago,
    MetodoPago: metodoPago,
    Moneda: "MXN",
    TipoDeComprobante: "I",
    CfdiType: "I",
    ExpeditionPlace: expeditionPlace,
    SubTotal: subtotal,
    Total: total,
    Receiver: {
      Rfc: receptor.rfc,
      Name: receptor.nombre,
      FiscalRegime: receptor.regimenFiscal || '601',
      TaxZipCode: receptor.codigoPostal,
      CfdiUse: usoCfdi
    },
    Items: conceptos.map(item => ({
      ClaveProdServ: item.ClaveProductoServicio || item.ClaveProdServ,
      Cantidad: item.Cantidad,
      ClaveUnidad: item.ClaveUnidad,
      Unidad: item.Unidad,
      Descripcion: item.Descripcion,
      ValorUnitario: item.ValorUnitario,
      Importe: item.Importe,
      ObjetoImp: item.ObjetoImp || '02',
      ...(item.Impuestos && { Impuestos: item.Impuestos })
    }))
  };

  if (totalImpuestosTrasladados > 0) {
    cfdiJson.Impuestos = {
      TotalImpuestosTrasladados: totalImpuestosTrasladados,
      Traslados: [{ Impuesto: "002", TipoFactor: "Tasa", TasaOCuota: 0.16, Importe: totalImpuestosTrasladados }]
    };
  }

  return cfdiJson;
}

module.exports = {
  getFacturamaToken,
  buildCfdiJson,
  FACTURAMA_BASE_URL,
  uploadCsdToFacturama,
  timbrarXmlSellado
};


