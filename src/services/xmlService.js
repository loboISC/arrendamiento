// src/services/xmlService.js
const { XmlNodeUtils } = require('@nodecfdi/cfdi-core');
const { Credential } = require('@nodecfdi/credentials');
const fs = require('fs');
const path = require('path');

class XmlService {
    /**
     * Construye un nodo XML utilizando la estructura de cfdi-core
     * @param {string} name Nombre del nodo
     * @param {Object} attributes Atributos del nodo
     * @param {Array} children Nodos hijos
     */
    createNode(name, attributes = {}, children = []) {
        const node = {
            name: name,
            attributes: attributes,
            children: children
        };
        return node;
    }

    /**
     * Genera la estructura básica de un CFDI 4.0
     */
    buildCfdi40(data) {
        const { emisor, receptor, conceptos, totales, serie, folio, formaPago, metodoPago, condicionesPago, lugarExpedicion } = data;

        const comprobante = this.createNode('cfdi:Comprobante', {
            'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
            'Version': '4.0',
            'Serie': serie,
            'Folio': folio,
            'Fecha': new Date().toISOString().split('.')[0], // Formato ISO sin milisegundos
            'SubTotal': totales.subtotal.toFixed(2),
            'Moneda': 'MXN',
            'Total': totales.total.toFixed(2),
            'TipoDeComprobante': 'I',
            'Exportacion': '01',
            'FormaPago': formaPago,
            'MetodoPago': metodoPago,
            'CondicionesDePago': condicionesPago,
            'LugarExpedicion': lugarExpedicion,
        }, [
            this.createNode('cfdi:Emisor', {
                'Rfc': emisor.rfc,
                'Nombre': emisor.razonSocial,
                'RegimenFiscal': emisor.regimenFiscal,
            }),
            this.createNode('cfdi:Receptor', {
                'Rfc': receptor.rfc,
                'Nombre': receptor.nombre,
                'DomicilioFiscalReceptor': receptor.codigoPostal,
                'RegimenFiscalReceptor': receptor.regimenFiscal,
                'UsoCFDI': receptor.usoCfdi,
            }),
            this.createNode('cfdi:Conceptos', {}, conceptos.map(c =>
                this.createNode('cfdi:Concepto', {
                    'ClaveProdServ': c.claveProductoServicio,
                    'NoIdentificacion': c.noIdentificacion,
                    'Cantidad': c.cantidad.toFixed(6).replace(/\.?0+$/, ''),
                    'ClaveUnidad': c.claveUnidad,
                    'Unidad': c.unidad,
                    'Descripcion': c.descripcion,
                    'ValorUnitario': c.valorUnitario.toFixed(2),
                    'Importe': c.importe.toFixed(2),
                    'ObjetoImp': c.objetoImp || '02'
                }, [
                    c.impuestos ? this.createNode('cfdi:Impuestos', {}, [
                        this.createNode('cfdi:Traslados', {}, c.impuestos.Traslados.map(t =>
                            this.createNode('cfdi:Traslado', {
                                'Base': t.Base.toFixed(2),
                                'Impuesto': t.Impuesto,
                                'TipoFactor': t.TipoFactor,
                                'TasaOCuota': t.TasaOCuota.toFixed(6),
                                'Importe': t.Importe.toFixed(2)
                            })
                        ))
                    ]) : null
                ].filter(Boolean))
            )),
            totales.totalTraslados > 0 ? this.createNode('cfdi:Impuestos', {
                'TotalImpuestosTrasladados': totales.totalTraslados.toFixed(2)
            }, [
                this.createNode('cfdi:Traslados', {}, [
                    this.createNode('cfdi:Traslado', {
                        'Base': totales.subtotal.toFixed(2),
                        'Impuesto': '002',
                        'TipoFactor': 'Tasa',
                        'TasaOCuota': '0.160000',
                        'Importe': totales.totalTraslados.toFixed(2)
                    })
                ])
            ]) : null
        ].filter(Boolean));

        return comprobante;
    }

    /**
     * Genera la cadena original del CFDI 4.0 (Aproximación por concatenación)
     * Siguiendo el orden del Anexo 20: Comprobante, Emisor, Receptor, Conceptos, Impuestos.
     */
    generarCadenaOriginal(node) {
        let cadena = '||';

        // 1. Datos del Comprobante
        const c = node.attributes;
        const camposComprobante = [
            'Version', 'Exportacion', 'Fecha', 'Folio', 'Serie', 'FormaPago',
            'CondicionesDePago', 'SubTotal', 'Descuento', 'Moneda', 'Total',
            'TipoDeComprobante', 'MetodoPago', 'LugarExpedicion', 'Confirmacion'
        ];
        camposComprobante.forEach(f => {
            if (c[f] !== undefined) cadena += c[f] + '|';
        });

        // 2. Emisor
        const emisorNode = node.children.find(n => n.name === 'cfdi:Emisor');
        if (emisorNode) {
            cadena += emisorNode.attributes.Rfc + '|';
            cadena += emisorNode.attributes.Nombre + '|';
            if (emisorNode.attributes.RegimenFiscal) cadena += emisorNode.attributes.RegimenFiscal + '|';
            if (emisorNode.attributes.FacAtrAdquirente) cadena += emisorNode.attributes.FacAtrAdquirente + '|';
        }

        // 3. Receptor
        const receptorNode = node.children.find(n => n.name === 'cfdi:Receptor');
        if (receptorNode) {
            cadena += receptorNode.attributes.Rfc + '|';
            cadena += receptorNode.attributes.Nombre + '|';
            cadena += receptorNode.attributes.DomicilioFiscalReceptor + '|';
            if (receptorNode.attributes.ResidenciaFiscal) cadena += receptorNode.attributes.ResidenciaFiscal + '|';
            if (receptorNode.attributes.NumRegIdTrib) cadena += receptorNode.attributes.NumRegIdTrib + '|';
            cadena += receptorNode.attributes.RegimenFiscalReceptor + '|';
            cadena += receptorNode.attributes.UsoCFDI + '|';
        }

        // 4. Conceptos
        const conceptosNode = node.children.find(n => n.name === 'cfdi:Conceptos');
        if (conceptosNode) {
            conceptosNode.children.forEach(concepto => {
                const inner = concepto.attributes;
                ['ClaveProdServ', 'NoIdentificacion', 'Cantidad', 'ClaveUnidad', 'Unidad', 'Descripcion', 'ValorUnitario', 'Importe', 'Descuento', 'ObjetoImp'].forEach(f => {
                    if (inner[f] !== undefined) cadena += inner[f] + '|';
                });

                // Impuestos del concepto
                const impNode = concepto.children.find(n => n.name === 'cfdi:Impuestos');
                if (impNode) {
                    const trasladosNode = impNode.children.find(n => n.name === 'cfdi:Traslados');
                    if (trasladosNode) {
                        trasladosNode.children.forEach(t => {
                            const ta = t.attributes;
                            ['Base', 'Impuesto', 'TipoFactor', 'TasaOCuota', 'Importe'].forEach(f => {
                                if (ta[f] !== undefined) cadena += ta[f] + '|';
                            });
                        });
                    }
                }
            });
        }

        // 5. Impuestos Globales
        const impGlobalNode = node.children.find(n => n.name === 'cfdi:Impuestos' && n.attributes.TotalImpuestosTrasladados);
        if (impGlobalNode) {
            const trasladosNode = impGlobalNode.children.find(n => n.name === 'cfdi:Traslados');
            if (trasladosNode) {
                trasladosNode.children.forEach(t => {
                    const ta = t.attributes;
                    ['Impuesto', 'TipoFactor', 'TasaOCuota', 'Importe'].forEach(f => {
                        if (ta[f] !== undefined) cadena += ta[f] + '|';
                    });
                });
            }
            if (impGlobalNode.attributes.TotalImpuestosTrasladados) cadena += impGlobalNode.attributes.TotalImpuestosTrasladados + '|';
        }

        cadena += '|';
        return cadena;
    }

    /**
     * Sella el XML con la llave privada
     */
    async sellarXml(xmlNode, cerPath, keyPath, password) {
        try {
            const credential = Credential.openFiles(cerPath, keyPath, password);

            // 1. Obtener el certificado en Base64
            const certificadoBase64 = credential.certificate().pem().replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
            const noCertificado = credential.certificate().serialNumber().bytes();

            // 2. Generar Cadena Original
            // En una implementación real, convertiríamos xmlNode a XML string y aplicaríamos XSLT.
            const cadenaOriginal = this.generarCadenaOriginal(xmlNode);

            // 3. Firmar con la llave privada (RSA-SHA256)
            const sello = credential.sign(cadenaOriginal, 'sha256');

            // 4. Inyectar datos en el nodo raíz
            xmlNode.attributes.Sello = sello;
            xmlNode.attributes.NoCertificado = noCertificado;
            xmlNode.attributes.Certificado = certificadoBase64;

            return xmlNode;
        } catch (err) {
            console.error('Error al sellar XML:', err);
            throw new Error('No se pudo sellar el XML: ' + err.message);
        }
    }

    /**
     * Convierte el nodo a string XML
     */
    nodeToString(node) {
        // En cfdi-core se usaría XmlNodeUtils o similar si estuviera disponible en esta versión.
        // Aquí implementamos una versión recursiva simple.
        const attrs = Object.entries(node.attributes)
            .map(([k, v]) => `${k}="${this.escapeXml(v)}"`)
            .join(' ');

        let xml = `<${node.name} ${attrs}`;

        if (node.children && node.children.length > 0) {
            xml += '>';
            node.children.forEach(child => {
                xml += this.nodeToString(child);
            });
            xml += `</${node.name}>`;
        } else {
            xml += ' />';
        }

        return xml;
    }

    escapeXml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/[<>&"']/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
            }
        });
    }
}

module.exports = new XmlService();
