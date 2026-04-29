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

        const direccionEstructurada = {
            calle,
            numeroExterno,
            colonia,
            municipio,
            codigoPostal
        };

        const direccionTexto = tipo === 'CONTRATO'
            ? [calle, numeroExterno, colonia, municipio, codigoPostal].filter(Boolean).join(', ')
            : direccionEntrega;

        return {
            tipo,
            direccionTexto,
            direccionEstructurada,
            tieneDatosEstructurados: Boolean(calle || municipio || codigoPostal)
        };
    }

    /**
     * Agrega parametros comunes de Nominatim y datos de contacto del servidor.
     */
    static agregarParametrosBase(parametros) {
        parametros.set('format', 'json');
        parametros.set('addressdetails', '1');
        parametros.set('country', 'Mexico');
        parametros.set('limit', '1');

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

        if (direccion.tipo === 'CONTRATO' && direccion.tieneDatosEstructurados) {
            const parametrosEstructurados = this.agregarParametrosBase(new URLSearchParams());
            const calleCompleta = [direccion.direccionEstructurada.calle, direccion.direccionEstructurada.numeroExterno]
                .filter(Boolean)
                .join(' ');

            if (calleCompleta) parametrosEstructurados.set('street', calleCompleta);
            if (direccion.direccionEstructurada.municipio) parametrosEstructurados.set('city', direccion.direccionEstructurada.municipio);
            if (direccion.direccionEstructurada.codigoPostal) parametrosEstructurados.set('postalcode', direccion.direccionEstructurada.codigoPostal);
            intentos.push(parametrosEstructurados);
        }

        const parametrosTextoLibre = this.agregarParametrosBase(new URLSearchParams());
        parametrosTextoLibre.set('q', direccion.direccionTexto);
        intentos.push(parametrosTextoLibre);

        for (const parametros of intentos) {
            const resultados = await this.consultarNominatim(parametros);
            if (Array.isArray(resultados) && resultados.length > 0) {
                const primerResultado = resultados[0];
                const latitud = Number(primerResultado.lat);
                const longitud = Number(primerResultado.lon);

                if (!this.validarCoordenadas(latitud, longitud)) continue;

                return {
                    latitud,
                    longitud,
                    direccion_formateada: primerResultado.display_name || direccion.direccionTexto,
                    proveedor: 'nominatim_osm',
                    detalles: primerResultado.address || {}
                };
            }
        }

        const error = new Error('No se pudo encontrar la ubicacion exacta. Intente simplificando la direccion o usando el codigo postal.');
        error.codigoHttp = 404;
        throw error;
    }
}

module.exports = LogisticaGeocodingService;
