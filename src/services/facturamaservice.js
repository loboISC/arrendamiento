const FACTURAMA_USER = process.env.FACTURAMA_USER;
const FACTURAMA_PASSWORD = process.env.FACTURAMA_PASSWORD;
const FACTURAMA_BASE_URL = process.env.FACTURAMA_BASE_URL || 'https://apisandbox.facturama.mx';

function getFacturamaToken() {
  return Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`).toString('base64');
}

// Construye el JSON CFDI 4.0 para arrendamiento
function buildCfdiJson({ emisorConfig, receptor, conceptos, formaPago, metodoPago, usoCfdi, subtotal = 0, total = 0, totalImpuestosTrasladados = 0, ...otros }) {
  // Validar que conceptos no sea null o undefined
  if (!conceptos || !Array.isArray(conceptos)) {
    throw new Error('Conceptos debe ser un array válido');
  }

  // Validar cada concepto
  conceptos.forEach((concepto, index) => {
    if (!concepto.ClaveProductoServicio || concepto.ClaveProductoServicio.trim() === '') {
      throw new Error(`Concepto ${index + 1}: ClaveProductoServicio es requerida`);
    }
    if (!concepto.Cantidad || concepto.Cantidad <= 0) {
      throw new Error(`Concepto ${index + 1}: Cantidad debe ser mayor a 0`);
    }
    if (!concepto.ClaveUnidad || concepto.ClaveUnidad.trim() === '') {
      throw new Error(`Concepto ${index + 1}: ClaveUnidad es requerida`);
    }
    if (!concepto.Descripcion || concepto.Descripcion.trim() === '') {
      throw new Error(`Concepto ${index + 1}: Descripcion es requerida`);
    }
    if (!concepto.ValorUnitario || concepto.ValorUnitario <= 0) {
      throw new Error(`Concepto ${index + 1}: ValorUnitario debe ser mayor a 0`);
    }
  });

  // CORRECCIÓN: Para CFDI Global, usar el código postal registrado
  // en el perfil fiscal de Facturama (56410)
  const expeditionPlace = '56410'; // Código postal registrado en el perfil fiscal

  // Si es CFDI Global (RFC XAXX010101000), usar estructura específica
  if (receptor.rfc === 'XAXX010101000') {
    const cfdiGlobalJson = {
      CfdiType: "I",
      PaymentForm: formaPago,
      PaymentMethod: "PUE",
      ExpeditionPlace: expeditionPlace,
      Folio: otros.folio || "1",
      GlobalInformation: {
        Periodicity: "01", // Diario por defecto
        Months: String(new Date().getMonth() + 1).padStart(2, '0'), // Mes actual como string con 2 dígitos
        Year: new Date().getFullYear()
      },
      Receiver: {
        Rfc: "XAXX010101000",
        CfdiUse: "S01",
        Name: "PUBLICO EN GENERAL",
        FiscalRegime: "616",
        TaxZipCode: expeditionPlace
      },
      Items: conceptos.map(item => {
        const itemSubtotal = item.Importe;
        const itemTaxes = [{
          Total: (itemSubtotal * 0.16), // IVA 16%
          Name: "IVA",
          Base: itemSubtotal,
          Rate: 0.16,
          IsRetention: false
        }];
        
        return {
          ProductCode: item.ClaveProductoServicio || item.ClaveProdServ,
          Description: item.Descripcion,
          UnitCode: item.ClaveUnidad,
          Quantity: item.Cantidad,
          UnitPrice: item.ValorUnitario,
          Subtotal: itemSubtotal,
          TaxObject: item.ObjetoImp || "02",
          Total: itemSubtotal + (itemSubtotal * 0.16), // Subtotal + IVA
          Taxes: itemTaxes
        };
      })
    };

    // Log para debugging
    console.log('JSON CFDI Global construido para Facturama:', JSON.stringify(cfdiGlobalJson, null, 2));

    return cfdiGlobalJson;
  }

  // CFDI Normal (estructura original)
  const cfdiJson = {
    Serie: "A",
    Folio: otros.folio || "1",
    Fecha: new Date().toISOString(),
    FormaPago: formaPago,
    MetodoPago: metodoPago,
    Moneda: "MXN",
    TipoDeComprobante: "I",
    CfdiType: "I",
    LugarExpedicion: expeditionPlace, // Debe ser "01000"
    ExpeditionPlace: expeditionPlace, // Debe ser "01000"
    SubTotal: subtotal,
    Total: total,
    PaymentForm: formaPago,
    PaymentMethod: metodoPago,
    Emisor: {
      Rfc: emisorConfig.rfc,
      Nombre: emisorConfig.razon_social,
      RegimenFiscal: emisorConfig.regimen_fiscal
    },
    Receiver: {
      Rfc: receptor.rfc,
      Name: receptor.nombre,
      FiscalRegime: receptor.regimenFiscal,
      TaxZipCode: receptor.codigoPostal,
      UsoCFDI: usoCfdi,
      DomicilioFiscalReceptor: receptor.codigoPostal,
      RegimenFiscalReceptor: receptor.regimenFiscal
    },
    Items: conceptos.map(item => ({
      ClaveProdServ: item.ClaveProductoServicio || item.ClaveProdServ, // Usar el valor correcto
      Cantidad: item.Cantidad,
      ClaveUnidad: item.ClaveUnidad,
      Unidad: item.Unidad,
      Descripcion: item.Descripcion,
      ValorUnitario: item.ValorUnitario,
      Importe: item.Importe,
      ObjetoImp: item.ObjetoImp,
      ...(item.NoIdentificacion && { NoIdentificacion: item.NoIdentificacion }),
      ...(item.Impuestos && { Impuestos: item.Impuestos })
    }))
  };

  // SOLO agregar impuestos SI hay impuestos trasladados > 0
  if (totalImpuestosTrasladados > 0) {
    cfdiJson.Impuestos = {
      TotalImpuestosTrasladados: totalImpuestosTrasladados,
      Traslados: [
        {
          Impuesto: "002",
          TipoFactor: "Tasa",
          TasaOCuota: 0.16,
          Importe: totalImpuestosTrasladados
        }
      ]
    };
  }

  // Log para debugging
  console.log('JSON CFDI Normal construido para Facturama:', JSON.stringify(cfdiJson, null, 2));

  return cfdiJson;
}

module.exports = { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL };


