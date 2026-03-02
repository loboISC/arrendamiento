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

    const getAttr = (name) => {
        const match = xml.match(new RegExp(`${name}="([^"]+)"`, 'i'));
        return match?.[1] || '';
    };

    const uuid = getAttr('UUID') || getAttr('Uuid') || '';
    const fechaTimbrado = getAttr('FechaTimbrado');
    const selloDigital = getAttr('Sello') || getAttr('SelloCFD');
    const noCertificadoEmisor = getAttr('NoCertificado');
    const selloSAT = getAttr('SelloSAT');
    const noCertificadoSAT = getAttr('NoCertificadoSAT');
    const cadenaOriginalAttr = getAttr('CadenaOriginal');
    const cadenaOriginal = cadenaOriginalAttr ||
        (selloSAT && fechaTimbrado && uuid
            ? `||1.1|${uuid}|${fechaTimbrado}|${selloSAT}|${noCertificadoSAT}||`
            : '');

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
