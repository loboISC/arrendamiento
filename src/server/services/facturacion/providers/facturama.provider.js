const axios = require('axios');
const ProveedorCFDI = require('./cfdi-provider.interface');
const {
  obtenerTokenFacturama,
  FACTURAMA_BASE_URL
} = require('../facturamaservice');

/**
 * Adaptador de Facturama.
 * Aqui se encapsulan nombres de endpoints, autenticacion y formato de errores del proveedor.
 */
class ProveedorFacturama extends ProveedorCFDI {
  constructor() {
    super();
    this.baseUrl = FACTURAMA_BASE_URL;
  }

  obtenerCabeceras() {
    return {
      Authorization: `Basic ${obtenerTokenFacturama()}`,
      'Content-Type': 'application/json'
    };
  }

  normalizarError(error) {
    const detalle = error.response?.data || error.message || error;
    return {
      proveedor: 'facturama',
      mensaje: typeof detalle === 'string' ? detalle : JSON.stringify(detalle),
      detalle
    };
  }

  async crearFactura(payload) {
    try {
      const respuesta = await axios.post(`${this.baseUrl}/api-lite/3/cfdis`, payload, {
        headers: this.obtenerCabeceras()
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async crearNotaCredito(payload) {
    try {
      const respuesta = await axios.post(`${this.baseUrl}/api-lite/3/cfdis`, payload, {
        headers: this.obtenerCabeceras()
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async cancelarFactura(idProveedor, motivo = '02') {
    try {
      const respuesta = await axios.delete(
        `${this.baseUrl}/api-lite/cfdi/${idProveedor}?type=issuedLite&motive=${motivo}`,
        { headers: this.obtenerCabeceras() }
      );
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  esBufferPdfValido(buffer) {
    return Buffer.isBuffer(buffer)
      && buffer.length >= 4
      && buffer.subarray(0, 4).toString() === '%PDF';
  }

  decodificarPdfFacturama(data) {
    if (!data) return null;

    if (typeof data === 'object' && data.Content) {
      const contenido = data.Content;
      const encoding = String(data.ContentEncoding || 'base64').toLowerCase();
      const buffer = encoding === 'base64'
        ? Buffer.from(contenido, 'base64')
        : Buffer.from(contenido);
      return this.esBufferPdfValido(buffer) ? buffer : null;
    }

    if (Buffer.isBuffer(data)) {
      return this.esBufferPdfValido(data) ? data : null;
    }

    if (data instanceof ArrayBuffer) {
      const buffer = Buffer.from(data);
      return this.esBufferPdfValido(buffer) ? buffer : null;
    }

    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed.startsWith('%PDF')) {
        const buffer = Buffer.from(trimmed, 'latin1');
        return this.esBufferPdfValido(buffer) ? buffer : null;
      }
      try {
        const buffer = Buffer.from(trimmed, 'base64');
        return this.esBufferPdfValido(buffer) ? buffer : null;
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  async obtenerPDF(idProveedor) {
    try {
      const respuesta = await axios.get(`${this.baseUrl}/cfdi/pdf/issuedLite/${idProveedor}`, {
        headers: this.obtenerCabeceras(),
        responseType: 'json',
        validateStatus: (status) => status < 500
      });

      if (respuesta.status >= 400) {
        throw new Error(`Facturama PDF ${respuesta.status}: ${JSON.stringify(respuesta.data)}`);
      }

      const buffer = this.decodificarPdfFacturama(respuesta.data);
      if (!buffer) {
        throw new Error('Facturama devolvio una respuesta sin PDF valido.');
      }
      return buffer;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async obtenerXML(idProveedor) {
    try {
      const respuesta = await axios.get(`${this.baseUrl}/cfdi/xml/issuedLite/${idProveedor}`, {
        headers: this.obtenerCabeceras(),
        responseType: 'json'
      });

      const data = respuesta.data;
      if (data && typeof data === 'object' && data.Content) {
        const encoding = String(data.ContentEncoding || 'base64').toLowerCase();
        if (encoding === 'base64') {
          return Buffer.from(data.Content, 'base64').toString('utf8');
        }
        return String(data.Content);
      }

      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.Content) {
              const encoding = String(parsed.ContentEncoding || 'base64').toLowerCase();
              if (encoding === 'base64') {
                return Buffer.from(parsed.Content, 'base64').toString('utf8');
              }
              return String(parsed.Content);
            }
          } catch (_) {}
        }
        return data;
      }

      throw new Error('Formato de respuesta XML desconocido.');
    } catch (error) {
      throw this.normalizarError(error);
    }
  }
}

module.exports = ProveedorFacturama;
