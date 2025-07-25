const axios = require('axios');
const { Factura, ConfiguracionFacturacion } = require('../models'); // Ajusta a tu ORM
const { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL } = require('../services/facturamaservice');

// TIMBRAR FACTURA
exports.timbrarFactura = async (req, res) => {
  try {
    // 1. Extraer datos del receptor y conceptos del req.body
    const { receptor, conceptos, formaPago, metodoPago, usoCfdi, ...otros } = req.body;

    // 2. Obtener configuración del emisor y CSD
    const emisorConfig = await ConfiguracionFacturacion.findOne({ order: [['id', 'DESC']] });
    if (!emisorConfig) throw new Error('Configuración de emisor no encontrada');

    // 3. Construir JSON CFDI 4.0
    const cfdiJson = buildCfdiJson({ emisorConfig, receptor, conceptos, formaPago, metodoPago, usoCfdi, ...otros });

    // 4. Timbrar con Facturama
    const facturamaToken = getFacturamaToken();
    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-facturacion/Cfdis`,
      cfdiJson,
      { headers: { Authorization: `Basic ${facturamaToken}` } }
    );

    // 5. Guardar en BD
    const uuid = response.data.Complemento.TimbreFiscalDigital.UUID;
    const xml = Buffer.from(response.data.Content, 'base64').toString('utf8');
    const pdf = response.data.Pdf ? Buffer.from(response.data.Pdf, 'base64') : null;

    await Factura.create({
      uuid,
      fecha_emision: response.data.Fecha,
      total: response.data.Total,
      rfc_emisor: emisorConfig.rfc,
      rfc_receptor: receptor.rfc,
      xml,
      pdf,
      estado: 'timbrada'
    });

    res.status(200).json({ message: 'Factura timbrada exitosamente', uuid });
  } catch (error) {
    res.status(400).json({
      error: 'Error al timbrar factura',
      details: error.response?.data || error.message
    });
  }
};

// CANCELAR FACTURA
exports.cancelarFactura = async (req, res) => {
  try {
    const { uuid, motivo } = req.body;
    const emisorConfig = await ConfiguracionFacturacion.findOne({ order: [['id', 'DESC']] });
    if (!emisorConfig) throw new Error('Configuración de emisor no encontrada');

    const facturamaToken = getFacturamaToken();
    const response = await axios.post(
      `${FACTURAMA_BASE_URL}/api-facturacion/Cancelation`,
      {
        Rfc: emisorConfig.rfc,
        UUID: uuid,
        Motivo: motivo,
        FolioSustitucion: ""
      },
      { headers: { Authorization: `Basic ${facturamaToken}` } }
    );

    // Actualiza estado en BD
    await Factura.update({ estado: 'cancelada' }, { where: { uuid } });

    res.status(200).json({ message: 'Factura cancelada', acuse: response.data });
  } catch (error) {
    res.status(400).json({
      error: 'Error al cancelar factura',
      details: error.response?.data || error.message
    });
  }
};

// OBTENER FACTURA POR UUID
exports.getFacturaByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;
    const factura = await Factura.findOne({ where: { uuid } });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({
      uuid: factura.uuid,
      fecha_emision: factura.fecha_emision,
      total: factura.total,
      rfc_emisor: factura.rfc_emisor,
      rfc_receptor: factura.rfc_receptor,
      xml: factura.xml,
      pdf: factura.pdf ? factura.pdf.toString('base64') : null,
      estado: factura.estado
    });
  } catch (error) {
    res.status(400).json({ error: 'Error al obtener factura', details: error.message });
  }
}; 