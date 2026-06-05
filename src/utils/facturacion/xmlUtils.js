// helpers para normalizar y extraer datos de XML de CFDI

const fs = require('fs');
const path = require('path');

function normalizarXmlString(raw) {
    let xml = String(raw || '');
    if (!xml) return '';
    const trimmed = xml.trim();

    // decodificar base64 si parece sólo contener caracteres válidos y no empieza con '<'
    if (!trimmed.startsWith('<') && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
        try {
            xml = Buffer.from(trimmed, 'base64').toString('utf8');
        } catch (e) {
            // si falla la decodificación, dejar el valor original
            console.warn('[XMLUTIL] No se pudo decodificar base64, devolviendo texto sin cambios');
        }
    }

    // des-escapar entidades XML comunes que puede devolver Facturama
    xml = xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return xml;
}

function extraerDatosSatDesdeXml(rawXml) {
    const xml = normalizarXmlString(rawXml);
    if (!xml) return {};

    // función auxiliar mejorada para buscar atributos con múltiples variaciones
    const getAttr = (names) => {
        const nameList = Array.isArray(names) ? names : [names];
        for (const name of nameList) {
            // buscar atributos con espacios opcionales alrededor del signo =
            // intentar dobles comillas primero
            let match = xml.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`, 'i'));
            if (match?.[1]) return match[1];
            // intentar comillas simples
            match = xml.match(new RegExp(`${name}\\s*=\\s*'([^']+)'`, 'i'));
            if (match?.[1]) return match[1];
        }
        return '';
    };

    // extraer UUID (búsqueda exhaustiva de todas las variaciones)
    let uuid = getAttr(['UUID', 'Uuid', 'uuid']);
    if (!uuid) {
        // si no está en atributo raíz, buscar dentro de nodo TaxStamp
        const taxStampMatch = xml.match(/(?:TaxStamp|taxstamp)[^>]*UUID\s*=\s*"([^"]+)"/i) ||
                              xml.match(/(?:TaxStamp|taxstamp)[^>]*Uuid\s*=\s*"([^"]+)"/i);
        uuid = taxStampMatch?.[1] || '';
    }

    const fechaTimbrado = getAttr(['FechaTimbrado', 'FechaTimbrado', 'Date']);
    
    // extraer Sello Digital (del Comprobante, no del TaxStamp)
    // Incluir CfdiSign (API-Lite de Facturama)
    let selloDigital = getAttr(['Sello', 'SelloCFD', 'SelloCfdi', 'CfdiSign']);
    if (!selloDigital) {
        // buscar en atributos del nodo raíz más flexible
        const match = xml.match(/Sello\s*=\s*"([^"]{50,})/i) ||
                      xml.match(/CfdiSign\s*=\s*"([^"]{50,})/i);
        selloDigital = match?.[1] || '';
    }
    
    // extraer No. Certificado del Emisor
    let noCertificadoEmisor = getAttr(['NoCertificado', 'CertificateNumber']);
    if (!noCertificadoEmisor && selloDigital) {
        // si tenemos sello pero no noCertificado, buscar en el Comprobante
        const match = xml.match(/NoCertificado\s*=\s*"([^"]+)"/i);
        noCertificadoEmisor = match?.[1] || '';
    }

    // extraer Sello del SAT (del TaxStamp o Complemento)
    let selloSAT = getAttr(['SelloSAT', 'SatSign', 'Sign']);
    if (!selloSAT) {
        // búsqueda más flexible dentro de TaxStamp
        const match = xml.match(/(?:SelloSAT|SatSign|(?:taxstamp.*?Sign))\s*=\s*"([^"]{50,})/i);
        selloSAT = match?.[1] || '';
    }

    // extraer No. Certificado del SAT
    const noCertificadoSAT = getAttr(['NoCertificadoSAT', 'SatCertNumber', 'CertNumber']);

    // extraer Cadena Original
    const cadenaOriginalAttr = getAttr(['CadenaOriginal', 'OriginalString', 'originalString']);
    const cadenaOriginal = cadenaOriginalAttr ||
        (selloSAT && fechaTimbrado && uuid
            ? `||1.1|${uuid}|${fechaTimbrado}|${selloSAT}|${noCertificadoSAT}||`
            : '');

    // registrar datos extraídos para debug (truncar valores largos)
    const debugData = {
        uuid: uuid || '(vacío)',
        fechaTimbrado: fechaTimbrado || '(vacío)',
        selloDigital: selloDigital ? `<${selloDigital.length} chars>` : '(vacío)',
        noCertificadoEmisor: noCertificadoEmisor || '(vacío)',
        selloSAT: selloSAT ? `<${selloSAT.length} chars>` : '(vacío)',
        noCertificadoSAT: noCertificadoSAT || '(vacío)',
        xmlLength: xml.length
    };
    console.log('[XMLUTIL extraerDatosSatDesdeXml] Datos extraídos:', debugData);

    return {
        uuid,
        fechaTimbrado,
        selloDigital,
        noCertificadoEmisor,
        selloSAT,
        noCertificadoSAT,
        cadenaOriginal
    };
}

function extraerAtributosComprobante(xml) {
    const tagMatch = xml.match(/<(?:[\w-]+:)?Comprobante\b([^>]*?)(\/?)>/i);
    if (!tagMatch?.[1]) return {};

    const attrs = {};
    const attrRe = /([\w:]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = attrRe.exec(tagMatch[1])) !== null) {
        attrs[match[1]] = match[2];
    }
    return attrs;
}

function extraerTotalesDesdeXml(rawXml) {
    const xml = normalizarXmlString(rawXml);
    if (!xml) return {};

    const comprobanteAttrs = extraerAtributosComprobante(xml);
    const pickAttr = (names) => {
        const nameList = Array.isArray(names) ? names : [names];
        for (const name of nameList) {
            if (comprobanteAttrs[name] !== undefined && comprobanteAttrs[name] !== '') {
                return comprobanteAttrs[name];
            }
        }
        return '';
    };

    const subtotal = Number(pickAttr(['SubTotal', 'Subtotal']) || 0);
    const descuento = Number(pickAttr(['Descuento']) || 0);
    const total = Number(pickAttr(['Total']) || 0);
    let iva = Number(pickAttr(['TotalImpuestosTrasladados']) || 0);

    if (!iva) {
        const traslados = [...xml.matchAll(/<[^:>]*:?Traslado[^>]*\s+[^>]*Importe\s*=\s*"([^"]+)"[^>]*>/gi)];
        iva = traslados.reduce((sum, match) => sum + Number(match[1] || 0), 0);
    }
    if (!iva && total > 0 && subtotal > 0) {
        iva = Number((total - subtotal + descuento).toFixed(2));
    }

    return {
        subtotal: Number(subtotal.toFixed(2)),
        descuento: Number(descuento.toFixed(2)),
        iva: Number(iva.toFixed(2)),
        total: Number(total.toFixed(2))
    };
}

/**
 * Obtiene el XML timbrado desde la respuesta de Facturama (varios nombres de campo).
 * @returns {string} XML normalizado o cadena vacía
 */
function extraerXmlDesdeRespuestaFacturama(respuesta = {}) {
    const candidates = [
        respuesta.Cfdi,
        respuesta.Xml,
        respuesta.xml,
        respuesta.cfdi,
        respuesta.Content,
        respuesta.content
    ];
    for (const raw of candidates) {
        const xml = normalizarXmlString(raw);
        if (xml && xml.trim().startsWith('<')) {
            return xml;
        }
    }
    return '';
}

/**
 * Resuelve totales para PDF/BD priorizando el XML timbrado, luego JSON de Facturama.
 */
function resolverTotalesDesdeTimbrado({ respuestaFacturama = {}, xmlTimbrado = '', totalesLocales = {} }) {
    const xml = normalizarXmlString(xmlTimbrado);
    const totalesXml = extraerTotalesDesdeXml(xml);
    const xmlValido = xml.trim().startsWith('<') && totalesXml.total > 0;

    if (xmlValido) {
        return { ...totalesXml, fuente: 'xml' };
    }

    const subtotal = Number(
        respuestaFacturama.Subtotal || respuestaFacturama.SubTotal || totalesLocales.subtotal || 0
    );
    const descuento = Number(
        respuestaFacturama.Discount || respuestaFacturama.Descuento || totalesLocales.descuento || 0
    );
    let iva = 0;
    if (respuestaFacturama.Impuestos?.TotalImpuestosTrasladados !== undefined) {
        iva = Number(respuestaFacturama.Impuestos.TotalImpuestosTrasladados);
    } else if (respuestaFacturama.TotalImpuestosTrasladados !== undefined) {
        iva = Number(respuestaFacturama.TotalImpuestosTrasladados);
    } else {
        iva = Number(totalesLocales.iva || 0);
    }
    const total = Number(respuestaFacturama.Total || totalesLocales.total || 0);

    return {
        subtotal: Number(subtotal.toFixed(2)),
        descuento: Number(descuento.toFixed(2)),
        iva: Number(iva.toFixed(2)),
        total: Number(total.toFixed(2)),
        fuente: 'facturama'
    };
}

/**
 * Persiste XML en disco con validación mínima (UTF-8).
 */
function guardarXmlEnDisco(xmlContent, rutaArchivo) {
    const xml = normalizarXmlString(xmlContent);
    if (!xml || !xml.trim().startsWith('<')) {
        throw new Error('Contenido XML vacío o inválido para guardar en disco.');
    }
    const dir = path.dirname(rutaArchivo);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(rutaArchivo, xml, 'utf8');
    return rutaArchivo;
}

module.exports = {
    normalizarXmlString,
    extraerDatosSatDesdeXml,
    extraerTotalesDesdeXml,
    extraerXmlDesdeRespuestaFacturama,
    resolverTotalesDesdeTimbrado,
    guardarXmlEnDisco
};
