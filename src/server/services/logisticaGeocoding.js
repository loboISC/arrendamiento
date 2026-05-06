/**
 * SERVICIO DE GEOCODING PARA LOGISTICA
 * Convierte domicilios en coordenadas usando Nominatim de OpenStreetMap.
 */
class LogisticaGeocodingService {
    /**
     * Limpia un valor de texto para armar consultas mas estables.
     */
    static limpiarTexto(valor) {
        return String(valor || '').trim().replace(/\s+/g, ' ');
    }

    /**
     * Quita acentos para crear variantes que Nominatim suele resolver mejor.
     */
    static quitarAcentos(texto) {
        return this.limpiarTexto(texto)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Crea una variante mas amigable para OSM quitando datos de lote/manzana y abreviaturas.
     */
    static prepararTextoParaGeocoding(texto) {
        return this.limpiarTexto(texto)
            .replace(/\bCarr\.\s*/gi, 'Carretera ')
            .replace(/\bMéx\.\b/gi, 'Estado de Mexico')
            .replace(/\bEdo\.\s*Mex\.?\b/gi, 'Estado de Mexico')
            .replace(/\bMéxico\b/gi, 'Mexico')
            .replace(/\bSta\.?\s+/gi, 'Santa ')
            .replace(/\bMza\.?\s*\d+\b/gi, '')
            .replace(/\bMz\.?\s*\d+\b/gi, '')
            .replace(/\bManzana\s+\d+\b/gi, '')
            .replace(/\bLote\s+\d+\b/gi, '')
            .replace(/\s*,\s*,/g, ',')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static normalizarValor(texto) {
        return this.prepararTextoParaGeocoding(String(texto || '')).toLowerCase();
    }

    static extraerDireccionLibre(direccionEntrega) {
        const texto = this.prepararTextoParaGeocoding(direccionEntrega || '');
        if (!texto) return {};

        const partes = texto.split(',').map(p => p.trim()).filter(Boolean);
        const resultado = {
            calle: '',
            numeroExterno: '',
            colonia: '',
            municipio: '',
            codigoPostal: '',
            estado: ''
        };

        const estadoIndex = partes.findIndex(p => /\b(estado de mexico|edomex|edo mexico|edo\. mex\.?|méx|mex|mexico)\b/i.test(p));
        if (estadoIndex !== -1) {
            resultado.estado = this.prepararTextoParaGeocoding(partes[estadoIndex]);
            partes.splice(estadoIndex, 1);
        }

        const ultima = partes[partes.length - 1] || '';
        const cpMunicipio1 = ultima.match(/^(\d{5})\s+(.+)$/);
        const cpMunicipio2 = ultima.match(/^(.+?)\s+(\d{5})$/);

        if (cpMunicipio1) {
            resultado.codigoPostal = cpMunicipio1[1];
            resultado.municipio = this.prepararTextoParaGeocoding(cpMunicipio1[2]);
            partes.pop();
        } else if (cpMunicipio2) {
            resultado.codigoPostal = cpMunicipio2[2];
            resultado.municipio = this.prepararTextoParaGeocoding(cpMunicipio2[1]);
            partes.pop();
        } else if (partes.length >= 2 && /\d{5}/.test(partes[partes.length - 1])) {
            resultado.codigoPostal = (partes[partes.length - 1].match(/(\d{5})/) || [''])[0];
            partes.pop();
        }

        if (!resultado.municipio && partes.length > 1) {
            const posibleMunicipio = partes[partes.length - 1];
            if (!/\b(estado de mexico|edomex|edo mexico|edo\. mex\.?|méx|mex|mexico)\b/i.test(posibleMunicipio)) {
                resultado.municipio = this.prepararTextoParaGeocoding(posibleMunicipio);
                partes.pop();
            }
        }

        if (partes.length > 2) {
            resultado.colonia = this.prepararTextoParaGeocoding(partes[1]);
        }

        if (partes.length > 0) {
            const primera = partes[0];
            const matchCalle = primera.match(/^(.+?)\s+(\d+\w*)$/);
            if (matchCalle) {
                resultado.calle = this.prepararTextoParaGeocoding(matchCalle[1]);
                resultado.numeroExterno = matchCalle[2];
            } else {
                resultado.calle = this.prepararTextoParaGeocoding(primera);
            }
        }

        return resultado;
    }

    static contieneTexto(texto, termino) {
        const normal = this.normalizarValor(texto);
        const objetivo = this.normalizarValor(termino);
        return normal && objetivo && normal.includes(objetivo);
    }

    static evaluarResultadoNominatim(resultado, direccion) {
        if (!resultado || !resultado.address) return 0;

        const addr = resultado.address;
        const datos = {
            calle: this.normalizarValor(direccion.calle),
            numeroExterno: this.normalizarValor(direccion.numeroExterno),
            colonia: this.normalizarValor(direccion.colonia),
            municipio: this.normalizarValor(direccion.municipio),
            codigoPostal: String(direccion.codigoPostal || '').replace(/\D/g, ''),
            estado: this.normalizarValor(direccion.estado || '')
        };

        const calleResultado = this.normalizarValor([addr.road, addr.street, addr.pedestrian, addr.residential, addr.footway, addr.cycleway].filter(Boolean).join(' '));
        const municipioResultado = this.normalizarValor([addr.city, addr.town, addr.village, addr.municipality, addr.county, addr.city_district].filter(Boolean).join(' '));
        const coloniaResultado = this.normalizarValor([addr.suburb, addr.neighbourhood, addr.village, addr.hamlet, addr.locality].filter(Boolean).join(' '));
        const estadoResultado = this.normalizarValor([addr.state, addr.region].filter(Boolean).join(' '));
        const codigoPostalResultado = String(addr.postcode || '').replace(/\D/g, '');

        let score = 0;

        if (datos.calle && calleResultado) {
            if (datos.calle === calleResultado) score += 30;
            else if (calleResultado.includes(datos.calle)) score += 15;
        }

        if (datos.numeroExterno && this.normalizarValor(addr.house_number) === datos.numeroExterno) {
            score += 25;
        }

        if (datos.colonia && coloniaResultado.includes(datos.colonia)) {
            score += 20;
        }

        if (datos.municipio && municipioResultado.includes(datos.municipio)) {
            score += 30;
        }

        if (datos.codigoPostal && codigoPostalResultado && datos.codigoPostal === codigoPostalResultado) {
            score += 40;
        }

        if (datos.estado && estadoResultado.includes(datos.estado)) {
            score += 15;
        }

        if (datos.municipio && resultado.display_name && this.contieneTexto(resultado.display_name, datos.municipio)) {
            score += 5;
        }

        return score;
    }

    static seleccionarMejorResultado(resultados, direccion) {
        if (!Array.isArray(resultados) || resultados.length === 0) return null;

        let mejorResultado = null;
        let mejorScore = -1;

        for (const resultado of resultados) {
            const score = this.evaluarResultadoNominatim(resultado, direccion);
            if (score > mejorScore) {
                mejorScore = score;
                mejorResultado = resultado;
            }
        }

        return mejorScore >= 20 ? mejorResultado : null;
    }

    /**
     * Sugiere los estados del área metropolitana ampliada para búsquedas más precisas.
     */
    static obtenerEstadosPosibles(municipio = '', codigoPostal = '') {
        const texto = this.prepararTextoParaGeocoding(municipio).toLowerCase();
        const cp = String(codigoPostal || '').replace(/\D/g, '');
        const estados = new Set();

        if (/\b(ciudad de mexico|cdmx|distrito federal|df)\b/.test(texto) || /\b(alcaldia|alcald[ií]a|delegacion|delegaci[oó]n)\b/.test(texto)) {
            estados.add('Ciudad de Mexico');
        }

        if (/\bpuebla\b/.test(texto) || /^(72|73|74)/.test(cp)) {
            estados.add('Puebla');
        }

        if (/\bhidalgo\b/.test(texto) || /^(42|43)/.test(cp)) {
            estados.add('Hidalgo');
        }

        if (/\b(estado de mexico|edomex|edo mexico|edo\. mex\.?|mex)\b/.test(texto) || /^(50|51|52|53|54|55|56|57)/.test(cp)) {
            estados.add('Estado de Mexico');
        }

        if (estados.size === 0) {
            estados.add('Estado de Mexico');
            estados.add('Ciudad de Mexico');
            estados.add('Puebla');
            estados.add('Hidalgo');
        }

        return [...estados];
    }

    static async obtenerColoniasPorCodigoPostal(codigoPostal, estado = '') {
        if (!codigoPostal || !/^\d{5}$/.test(codigoPostal)) return [];

        try {
            const parametros = this.agregarParametrosBase(new URLSearchParams());
            parametros.set('postalcode', codigoPostal);
            if (estado) parametros.set('state', estado);
            const resultados = await this.consultarNominatim(parametros);
            if (!Array.isArray(resultados)) return [];

            const colonias = new Set();
            for (const item of resultados) {
                const addr = item?.address || {};
                const colonia = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || addr.locality || addr.county || '';
                if (colonia) colonias.add(this.prepararTextoParaGeocoding(colonia));
            }

            return [...colonias].slice(0, 8);
        } catch (_) {
            return [];
        }
    }

    /**
     * Agrega una consulta libre evitando duplicados.
     */
    static agregarIntentoTextoLibre(intentos, consulta) {
        const consultaLimpia = this.prepararTextoParaGeocoding(consulta);
        if (!consultaLimpia) return;

        const yaExiste = intentos.some(parametros => parametros.get('q') === consultaLimpia);
        if (yaExiste) return;

        const parametros = this.agregarParametrosBase(new URLSearchParams());
        parametros.set('q', consultaLimpia);
        intentos.push(parametros);
    }

    /**
     * Valida que la latitud y longitud sean numeros dentro del rango geografico.
     */
    static validarCoordenadas(latitud, longitud) {
        const latitudNumero = Number(latitud);
        const longitudNumero = Number(longitud);

        return !(latitudNumero === 0 && longitudNumero === 0) &&
            Number.isFinite(latitudNumero) &&
            Number.isFinite(longitudNumero) &&
            latitudNumero >= -90 &&
            latitudNumero <= 90 &&
            longitudNumero >= -180 &&
            longitudNumero <= 180;
    }

    /**
     * Normaliza los datos recibidos desde contratos o cotizaciones.
     */
    static normalizarDireccion(datos = {}) {
        const tipo = this.limpiarTexto(datos.tipo).toUpperCase();
        const calle = this.limpiarTexto(datos.calle);
        const numeroExterno = this.limpiarTexto(datos.numero_externo);
        const colonia = this.limpiarTexto(datos.colonia);
        const municipio = this.limpiarTexto(datos.municipio);
        const codigoPostal = this.limpiarTexto(datos.codigo_postal);
        const direccionEntrega = this.limpiarTexto(datos.direccion_entrega);

        let direccionEstructurada = {
            calle,
            numeroExterno,
            colonia,
            municipio,
            codigoPostal
        };

        if (direccionEntrega && (!direccionEstructurada.calle || !direccionEstructurada.municipio || !direccionEstructurada.codigoPostal)) {
            direccionEstructurada = {
                ...this.extraerDireccionLibre(direccionEntrega),
                ...direccionEstructurada
            };
        }

        const direccionTexto = tipo === 'CONTRATO'
            ? [direccionEstructurada.calle, direccionEstructurada.numeroExterno, direccionEstructurada.colonia, direccionEstructurada.municipio, direccionEstructurada.codigoPostal].filter(Boolean).join(', ')
            : direccionEntrega;

        return {
            tipo,
            direccionTexto,
            direccionEstructurada,
            tieneDatosEstructurados: Boolean(direccionEstructurada.calle || direccionEstructurada.municipio || direccionEstructurada.codigoPostal)
        };
    }

    /**
     * Agrega parametros comunes de Nominatim y datos de contacto del servidor.
     */
    static agregarParametrosBase(parametros) {
        parametros.set('format', 'json');
        parametros.set('addressdetails', '1');
        // countrycodes filtra resultados sin mezclar busqueda libre con parametros estructurados.
        parametros.set('countrycodes', 'mx');
        parametros.set('limit', '5');

        const correoContacto = process.env.NOMINATIM_EMAIL || process.env.LOGISTICA_GEOCODING_EMAIL;
        if (correoContacto) parametros.set('email', correoContacto);

        return parametros;
    }

    /**
     * Ejecuta una consulta contra Nominatim con identificacion del backend.
     */
    static async consultarNominatim(parametros) {
        const url = `https://nominatim.openstreetmap.org/search?${parametros.toString()}`;
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), 10000);
        const agenteUsuario = process.env.NOMINATIM_USER_AGENT ||
            process.env.LOGISTICA_GEOCODING_USER_AGENT ||
            'andamios-torres-logistica/1.0';

        try {
            const respuesta = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': agenteUsuario
                },
                signal: controlador.signal
            });

            if (!respuesta.ok) {
                throw new Error(`Nominatim respondio con estado ${respuesta.status}`);
            }

            return await respuesta.json();
        } finally {
            clearTimeout(temporizador);
        }
    }

    /**
     * Busca coordenadas por direccion. Primero intenta busqueda estructurada y luego texto libre.
     */
    static async obtenerCoordenadasPorDireccion(datos = {}) {
        const direccion = this.normalizarDireccion(datos);

        if (!direccion.direccionTexto && !direccion.tieneDatosEstructurados) {
            const error = new Error('Escriba una direccion o codigo postal para buscar coordenadas.');
            error.codigoHttp = 400;
            throw error;
        }

        const intentos = [];
        const municipioSinPrefijo = this.prepararTextoParaGeocoding(direccion.direccionEstructurada.municipio)
            .replace(/^Villa\s+/i, '')
            .trim();
        const municipioNormalizado = this.prepararTextoParaGeocoding(direccion.direccionEstructurada.municipio);
        const coloniaNormalizada = this.prepararTextoParaGeocoding(direccion.direccionEstructurada.colonia);
        const codigoPostal = direccion.direccionEstructurada.codigoPostal;
        const estadosPosibles = this.obtenerEstadosPosibles(municipioNormalizado, codigoPostal);

        let coloniasDesdeCP = [];
        if (codigoPostal) {
            for (const estado of estadosPosibles) {
                const parametrosCP = this.agregarParametrosBase(new URLSearchParams());
                parametrosCP.set('postalcode', codigoPostal);
                parametrosCP.set('state', estado);
                intentos.push(parametrosCP);
            }
            coloniasDesdeCP = await this.obtenerColoniasPorCodigoPostal(codigoPostal, estadosPosibles[0] || '');
        }

        if (direccion.tieneDatosEstructurados) {
            const calleNormalizada = this.prepararTextoParaGeocoding(direccion.direccionEstructurada.calle);
            const calleCompleta = [calleNormalizada, direccion.direccionEstructurada.numeroExterno]
                .filter(Boolean)
                .join(' ');

            for (const estado of estadosPosibles) {
                const parametrosEstructurados = this.agregarParametrosBase(new URLSearchParams());
                if (calleCompleta) parametrosEstructurados.set('street', calleCompleta);
                if (municipioNormalizado) {
                    parametrosEstructurados.set('city', municipioNormalizado);
                    parametrosEstructurados.set('county', municipioNormalizado);
                }
                if (codigoPostal) parametrosEstructurados.set('postalcode', codigoPostal);
                parametrosEstructurados.set('state', estado);
                intentos.push(parametrosEstructurados);
            }

            if (coloniasDesdeCP.length) {
                const coloniasParaBusqueda = coloniasDesdeCP.slice(0, 4);
                for (const estado of estadosPosibles) {
                    for (const colonia of coloniasParaBusqueda) {
                        this.agregarIntentoTextoLibre(
                            intentos,
                            [calleNormalizada, colonia, municipioNormalizado, codigoPostal, estado]
                                .filter(Boolean)
                                .join(', ')
                        );
                        this.agregarIntentoTextoLibre(
                            intentos,
                            [colonia, municipioNormalizado, codigoPostal, estado]
                                .filter(Boolean)
                                .join(', ')
                        );
                    }
                }
            }
        }

        this.agregarIntentoTextoLibre(intentos, direccion.direccionTexto);
        this.agregarIntentoTextoLibre(intentos, this.quitarAcentos(direccion.direccionTexto));
        this.agregarIntentoTextoLibre(
            intentos,
            [
                direccion.direccionEstructurada.calle,
                direccion.direccionEstructurada.colonia,
                direccion.direccionEstructurada.municipio,
                direccion.direccionEstructurada.codigoPostal
            ].filter(Boolean).join(', ')
        );
        this.agregarIntentoTextoLibre(
            intentos,
            [
                direccion.direccionEstructurada.colonia,
                direccion.direccionEstructurada.municipio,
                direccion.direccionEstructurada.codigoPostal
            ].filter(Boolean).join(', ')
        );

        estadosPosibles.forEach((estado) => {
            this.agregarIntentoTextoLibre(
                intentos,
                [
                    direccion.direccionEstructurada.calle,
                    direccion.direccionEstructurada.colonia,
                    direccion.direccionEstructurada.municipio,
                    direccion.direccionEstructurada.codigoPostal,
                    estado
                ].filter(Boolean).join(', ')
            );
            this.agregarIntentoTextoLibre(
                intentos,
                [
                    direccion.direccionEstructurada.colonia,
                    direccion.direccionEstructurada.municipio,
                    direccion.direccionEstructurada.codigoPostal,
                    estado
                ].filter(Boolean).join(', ')
            );
            if (municipioSinPrefijo) {
                this.agregarIntentoTextoLibre(
                    intentos,
                    [
                        municipioSinPrefijo,
                        codigoPostal,
                        estado
                    ].filter(Boolean).join(', ')
                );
                this.agregarIntentoTextoLibre(
                    intentos,
                    [
                        coloniaNormalizada,
                        municipioSinPrefijo,
                        estado
                    ].filter(Boolean).join(', ')
                );
                this.agregarIntentoTextoLibre(
                    intentos,
                    [
                        this.prepararTextoParaGeocoding(direccion.direccionEstructurada.calle),
                        municipioSinPrefijo,
                        estado
                    ].filter(Boolean).join(', ')
                );
            }
        });

        let ultimoError = null;
        for (const parametros of intentos) {
            let resultados = [];
            try {
                resultados = await this.consultarNominatim(parametros);
            } catch (error) {
                ultimoError = error;
                console.warn('[Geocoding] Intento descartado:', error.message);
                continue;
            }

            const mejorResultado = this.seleccionarMejorResultado(resultados, {
                calle: direccion.direccionEstructurada.calle,
                numeroExterno: direccion.direccionEstructurada.numeroExterno,
                colonia: direccion.direccionEstructurada.colonia,
                municipio: direccion.direccionEstructurada.municipio,
                codigoPostal: direccion.direccionEstructurada.codigoPostal,
                estado: parametros.get('state') || ''
            });

            if (!mejorResultado) continue;

            const latitud = Number(mejorResultado.lat);
            const longitud = Number(mejorResultado.lon);

            if (!this.validarCoordenadas(latitud, longitud)) continue;

            return {
                latitud,
                longitud,
                direccion_formateada: mejorResultado.display_name || direccion.direccionTexto,
                proveedor: 'nominatim_osm',
                detalles: mejorResultado.address || {}
            };
        }

        const error = new Error(ultimoError?.message || 'No se pudo encontrar la ubicacion exacta. Intente simplificando la direccion o usando el codigo postal.');
        error.codigoHttp = 404;
        throw error;
    }
}

module.exports = LogisticaGeocodingService;
