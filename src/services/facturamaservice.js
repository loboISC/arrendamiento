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

// Diagnóstico de carga de variables (solo longitud para seguridad)
console.log(`[Facturama] Configuración cargada: User: ${FACTURAMA_USER ? 'Definido (' + FACTURAMA_USER.length + ' chars)' : 'No definido'}, Pass: ${FACTURAMA_PASSWORD ? 'Definido (' + FACTURAMA_PASSWORD.length + ' chars)' : 'No definido'}, URL: ${FACTURAMA_BASE_URL}`);

function getFacturamaToken() {
  if (!FACTURAMA_USER || !FACTURAMA_PASSWORD) {
    console.warn('[Facturama] Advertencia: Intentando generar token con credenciales incompletas.');
  }
  return Buffer.from(`${FACTURAMA_USER || ''}:${FACTURAMA_PASSWORD || ''}`).toString('base64');
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
      Rfc: rfc,
      Certificate: cerBase64,
      PrivateKey: keyBase64,
      PrivateKeyPassword: password
    };

    const token = getFacturamaToken();
    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-lite/csds`,
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
    let errorDetail = '';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      errorDetail = `Status: ${status} - Data: ${JSON.stringify(data) || 'Sin cuerpo'}`;
    } else {
      errorDetail = error.message;
    }
    console.error(`[Facturama] Error al cargar CSD para ${rfc}:`, errorDetail);
    throw new Error(`Error al cargar CSD en Facturama: ${errorDetail}`);
  }
}

/**
 * Timbra un XML que ya ha sido sellado localmente (Modalidad Multi-emisor / API-Lite)
 * @param {string} xmlString Contenido del XML ya sellado
 * @param {Object} fullData Objeto con los datos completos para el "shadow JSON"
 */
async function timbrarXmlSellado(xmlString, fullData) {
  try {
    const token = getFacturamaToken();

    // Log para depuración (solo en desarrollo/sandbox)
    if (FACTURAMA_BASE_URL.includes('sandbox')) {
      console.log('[Facturama-Debug] XML a timbrar (primeros 200 caracteres):', xmlString.substring(0, 200));
    }

    // Debido a un bug en el validador de Facturama para RFC genérico, 
    // se debe enviar un JSON que contenga los campos básicos del CFDI 
    // además del XmlContent, de lo contrario falla con NullReferenceException.
    const requestData = {
      XmlContent: Buffer.from(xmlString).toString('base64'),
      CfdiType: "I",
      Serie: fullData.serie || "A",
      Folio: fullData.folio || "1",
      ExpeditionPlace: fullData.lugarExpedicion,
      PaymentMethod: fullData.metodoPago || "PUE",
      PaymentForm: fullData.formaPago || "01",
      Currency: "MXN",
      Subtotal: fullData.totales.subtotal,
      Total: fullData.totales.total,
      Issuer: {
        Rfc: fullData.emisor.rfc,
        Name: fullData.emisor.razonSocial,
        FiscalRegime: fullData.emisor.regimenFiscal
      },
      Receiver: {
        Rfc: fullData.receptor.rfc,
        Name: fullData.receptor.nombre,
        TaxZipCode: fullData.receptor.codigoPostal,
        FiscalRegime: fullData.receptor.regimenFiscal,
        CfdiUse: fullData.receptor.usoCfdi
      },
      Items: fullData.conceptos.map(c => {
        const itemTaxes = [];
        let totalImpuestosItem = 0;

        if (c.impuestos && c.impuestos.Traslados) {
          c.impuestos.Traslados.forEach(t => {
            const taxName = t.Impuesto === "002" ? "IVA" : (t.Impuesto === "001" ? "ISR" : "IEPS");
            itemTaxes.push({
              Total: t.Importe,
              Name: taxName,
              Base: t.Base,
              Rate: t.TasaOCuota,
              IsRetention: false
            });
            totalImpuestosItem += t.Importe;
          });
        }

        if (c.impuestos && c.impuestos.Retenciones) {
          c.impuestos.Retenciones.forEach(r => {
            const taxName = r.Impuesto === "002" ? "IVA" : (r.Impuesto === "001" ? "ISR" : "IEPS");
            itemTaxes.push({
              Total: r.Importe,
              Name: taxName,
              Base: r.Base,
              Rate: r.TasaOCuota,
              IsRetention: true
            });
            totalImpuestosItem -= r.Importe;
          });
        }

        return {
          ProductCode: c.claveProductoServicio,
          Quantity: c.cantidad,
          UnitCode: c.claveUnidad,
          Description: c.descripcion,
          UnitPrice: c.valorUnitario,
          Subtotal: c.importe,
          Discount: c.descuento || 0,
          TaxObject: c.objetoImp || "02",
          Taxes: itemTaxes.length > 0 ? itemTaxes : undefined,
          Total: c.importe - (c.descuento || 0) + totalImpuestosItem
        };
      })
    };

    // Si hay información global (necesario para RFC genérico)
    if (fullData.informacionGlobal) {
      requestData.GlobalInformation = {
        Periodicity: fullData.informacionGlobal.periodicidad,
        Months: fullData.informacionGlobal.meses,
        Year: fullData.informacionGlobal.año
      };
      console.log('[Facturama] Agregando GlobalInformation al JSON envelope:', JSON.stringify(requestData.GlobalInformation));
    }

    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-lite/3/cfdis`,
      requestData,
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
        Discount: item.Descuento || item.descuento || 0,
        TaxObject: item.ObjetoImp || "02",
        Total: item.Importe - (item.Descuento || item.descuento || 0) + ((item.Importe - (item.Descuento || item.descuento || 0)) * 0.16),
        Taxes: [{ Total: ((item.Importe - (item.Descuento || item.descuento || 0)) * 0.16), Name: "IVA", Base: (item.Importe - (item.Descuento || item.descuento || 0)), Rate: 0.16, IsRetention: false }]
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
      Discount: item.Descuento || item.descuento || 0,
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

/**
 * Cancela una factura en Facturama (Modalidad Multi-emisor / API-Lite v3)
 * @param {string} id ID interno de Facturama o UUID
 * @param {string} motivo Motivo de cancelación (01, 02, 03, 04)
 */
async function cancelarFacturaFacturama(id, motivo) {
  try {
    const token = getFacturamaToken();
    // Según imagen: /cfdi/{id}?type=issuedLite&motive={motivo}
    const response = await axios.delete(
      `${FACTURAMA_BASE_URL}/api-lite/cfdi/${id}?type=issuedLite&motive=${motivo}`,
      {
        headers: {
          'Authorization': `Basic ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    const errorDetail = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Facturama] Error al cancelar factura ${id}:`, errorDetail);
    throw new Error(`Error al cancelar en Facturama: ${errorDetail}`);
  }
}

module.exports = {
  getFacturamaToken,
  buildCfdiJson,
  FACTURAMA_BASE_URL,
  uploadCsdToFacturama,
  timbrarXmlSellado,
  cancelarFacturaFacturama
};


