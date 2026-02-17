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
        return {
            name: name,
            attributes: attributes,
            children: children.filter(Boolean)
        };
    }

    /**
     * Genera la estructura básica de un CFDI 4.0
     */
    buildCfdi40(data) {
        const { emisor, receptor, conceptos, totales, serie, folio, formaPago, metodoPago, condicionesPago, lugarExpedicion, informacionGlobal } = data;

        const comprobante = this.createNode('cfdi:Comprobante', {
            'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
            'Version': '4.0',
            'Serie': serie,
            'Folio': folio,
            'Fecha': new Date().toISOString().split('.')[0],
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
            informacionGlobal ? this.createNode('cfdi:InformacionGlobal', {
                'Periodicidad': informacionGlobal.periodicidad,
                'Meses': informacionGlobal.meses,
                'Año': informacionGlobal.año
            }) : null,
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
                                'Base': Number(t.Base).toFixed(2),
                                'Impuesto': t.Impuesto,
                                'TipoFactor': t.TipoFactor,
                                'TasaOCuota': Number(t.TasaOCuota).toFixed(6),
                                'Importe': Number(t.Importe).toFixed(2)
                            })
                        ))
                    ]) : null
                ])
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
        ]);

        return comprobante;
    }

    /**
     * Genera la cadena original del CFDI 4.0 siguiendo estrictamente el Anexo 20
     */
    generarCadenaOriginal(node) {
        let cadena = '||';
        const a = node.attributes;

        // 1. Datos del Comprobante (Orden Anexo 20)
        const campos = [
            'Version', 'Serie', 'Folio', 'Fecha', 'FormaPago',
            'CondicionesDePago', 'SubTotal', 'Descuento', 'Moneda',
            'TipoCambio', 'Total', 'TipoDeComprobante', 'Exportacion',
            'MetodoPago', 'LugarExpedicion', 'Confirmacion'
        ];
        campos.forEach(f => {
            if (a[f] !== undefined) cadena += a[f] + '|';
        });

        // 2. Información Global
        const infoNode = node.children.find(n => n.name === 'cfdi:InformacionGlobal');
        if (infoNode) {
            const ia = infoNode.attributes;
            ['Periodicidad', 'Meses', 'Año'].forEach(f => {
                if (ia[f] !== undefined) cadena += ia[f] + '|';
            });
        }

        // 3. Emisor
        const emisorNode = node.children.find(n => n.name === 'cfdi:Emisor');
        if (emisorNode) {
            const ea = emisorNode.attributes;
            cadena += ea.Rfc + '|';
            cadena += ea.Nombre + '|';
            cadena += ea.RegimenFiscal + '|';
        }

        // 4. Receptor
        const receptorNode = node.children.find(n => n.name === 'cfdi:Receptor');
        if (receptorNode) {
            const ra = receptorNode.attributes;
            cadena += ra.Rfc + '|';
            cadena += ra.Nombre + '|';
            cadena += ra.DomicilioFiscalReceptor + '|';
            cadena += ra.RegimenFiscalReceptor + '|';
            cadena += ra.UsoCFDI + '|';
        }

        // 5. Conceptos
        const conceptosNode = node.children.find(n => n.name === 'cfdi:Conceptos');
        if (conceptosNode) {
            conceptosNode.children.forEach(concepto => {
                const ca = concepto.attributes;
                ['ClaveProdServ', 'NoIdentificacion', 'Cantidad', 'ClaveUnidad', 'Unidad', 'Descripcion', 'ValorUnitario', 'Importe', 'Descuento', 'ObjetoImp'].forEach(f => {
                    if (ca[f] !== undefined) cadena += ca[f] + '|';
                });

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

        // 6. Impuestos Globales
        const impGlobalNode = node.children.find(n => n.name === 'cfdi:Impuestos' && n.attributes.TotalImpuestosTrasladados);
        if (impGlobalNode) {
            const ig = impGlobalNode.attributes;
            if (ig.TotalImpuestosRetenidos) cadena += ig.TotalImpuestosRetenidos + '|';
            if (ig.TotalImpuestosTrasladados) cadena += ig.TotalImpuestosTrasladados + '|';

            const trasladosNode = impGlobalNode.children.find(n => n.name === 'cfdi:Traslados');
            if (trasladosNode) {
                trasladosNode.children.forEach(t => {
                    const ta = t.attributes;
                    ['Base', 'Impuesto', 'TipoFactor', 'TasaOCuota', 'Importe'].forEach(f => {
                        if (ta[f] !== undefined) cadena += ta[f] + '|';
                    });
                });
            }
        }

        cadena += '|';
        return cadena;
    }

    async sellarXml(xmlNode, cerPath, keyPath, password) {
        try {
            const credential = Credential.openFiles(cerPath, keyPath, password);
            const certificadoBase64 = credential.certificate().pem().replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
            const noCertificado = credential.certificate().serialNumber().bytes();
            const cadenaOriginal = this.generarCadenaOriginal(xmlNode);
            const sello = credential.sign(cadenaOriginal, 'sha256');

            xmlNode.attributes.Sello = sello;
            xmlNode.attributes.NoCertificado = noCertificado;
            xmlNode.attributes.Certificado = certificadoBase64;

            return xmlNode;
        } catch (err) {
            console.error('Error al sellar XML:', err);
            throw new Error('No se pudo sellar el XML: ' + err.message);
        }
    }

    nodeToString(node, includeHeader = true) {
        const attrs = Object.entries(node.attributes)
            .map(([k, v]) => `${k}="${this.escapeXml(v)}"`)
            .join(' ');

        let xml = includeHeader ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
        xml += `<${node.name} ${attrs}`;

        if (node.children && node.children.length > 0) {
            xml += '>';
            node.children.forEach(child => {
                xml += this.nodeToString(child, false);
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
