// helpers para normalizar y extraer datos de XML de CFDI

function normalizeXmlString(raw) {
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

function extractSatDataFromXml(rawXml) {
    const xml = normalizeXmlString(rawXml);
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
    let selloDigital = getAttr(['Sello', 'SelloCFD', 'SelloCfdi']);
    if (!selloDigital) {
        // buscar en atributos del nodo raíz más flexible
        const match = xml.match(/Sello\s*=\s*"([^"]{50,})/i);
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
    console.log('[XMLUTIL extractSatDataFromXml] Datos extraídos:', debugData);

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

module.exports = {
    normalizeXmlString,
    extractSatDataFromXml
};
