/* Modulo de notas de credito CFDI 4.0 — flujo en 4 tarjetas/secciones sin modales intermedios. */
(function iniciarModuloNotasCredito() {
  const estado = {
    filtros: { search: '', fecha: '' },
    facturas: [],
    facturaSeleccionada: null,
    motivo: '',
    modoAvanzado: false,
    tipoRelacion: '01',
    conceptos: [],
    totales: { subtotal: 0, iva: 0, retenciones: 0, total: 0 },
    notaGuardada: null,
    tipoComprobante: 'E',
    usoCFDI: 'G02',
    usarClaveServicios: true,
    descripcionConcepto: '',
    formaPago: '03',
    metodoPago: 'PUE',
    configuracionInicial: false,
    conceptoFormulario: null
  };

  function crearConceptoFormularioVacio(overrides = {}) {
    return {
      product_id: null,
      sat_product_key: '84111506',
      sat_unit_key: 'ACT',
      unidad: 'Actividad',
      cantidad: 1,
      numero_identificacion: '',
      descripcion: '',
      precio_unitario: 0,
      descuento: 0,
      descuento_porcentaje: 0,
      ...overrides
    };
  }

  estado.conceptoFormulario = crearConceptoFormularioVacio();

  const ui = {
    moneda(valor) {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(valor || 0));
    },
    numero(valor) {
      return Number(Number(valor || 0).toFixed(2));
    },
    token() {
      return localStorage.getItem('token') || '';
    },
    aviso(titulo, texto, icono = 'info') {
      if (window.Swal) return window.Swal.fire(titulo, texto, icono);
      alert(`${titulo}: ${texto}`);
      return Promise.resolve();
    }
  };

  window.NotasCreditoUI = ui;
  window.NotasCreditoDesglose = null;

  const estadoHistorial = {
    paginaActual: 1,
    tamanoPagina: 15,
    totalRegistros: 0,
    totalPaginas: 1
  };

  function activarTabFacturacion(seccion) {
    document.querySelectorAll('.section-tabs .tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === seccion);
    });
    document.querySelectorAll('.content-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `${seccion}-section`);
    });
  }

  function calcularRangoPaginasHistorial({ paginaActual, totalPaginas, maxBotones = 7 }) {
    const max = Math.max(3, maxBotones);
    const mitad = Math.floor(max / 2);
    let inicio = Math.max(1, paginaActual - mitad);
    let fin = Math.min(totalPaginas, inicio + max - 1);
    inicio = Math.max(1, fin - max + 1);
    return { inicio, fin };
  }

  function crearBotonPaginacionHistorial({ tipo, etiqueta, activo, deshabilitado, onClick }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-btn';

    if (tipo === 'prev') {
      btn.innerHTML = '<i class="fa fa-chevron-left"></i>';
    } else if (tipo === 'next') {
      btn.innerHTML = '<i class="fa fa-chevron-right"></i>';
    } else if (tipo === 'puntos') {
      btn.textContent = '...';
      btn.disabled = true;
    } else {
      btn.textContent = etiqueta || '';
    }

    if (activo) btn.classList.add('active');
    if (deshabilitado) btn.disabled = true;

    if (typeof onClick === 'function' && !btn.disabled) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  function renderizarPaginacionHistorial(contenedor) {
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const totalPaginas = estadoHistorial.totalPaginas;
    const paginaActual = estadoHistorial.paginaActual;

    contenedor.appendChild(crearBotonPaginacionHistorial({
      tipo: 'prev',
      deshabilitado: paginaActual <= 1,
      onClick: () => irAPaginaHistorial(paginaActual - 1)
    }));

    const rango = calcularRangoPaginasHistorial({ paginaActual, totalPaginas });

    if (rango.inicio > 1) {
      contenedor.appendChild(crearBotonPaginacionHistorial({
        tipo: 'numero',
        etiqueta: '1',
        activo: paginaActual === 1,
        onClick: () => irAPaginaHistorial(1)
      }));
      if (rango.inicio > 2) {
        contenedor.appendChild(crearBotonPaginacionHistorial({ tipo: 'puntos' }));
      }
    }

    for (let p = rango.inicio; p <= rango.fin; p++) {
      contenedor.appendChild(crearBotonPaginacionHistorial({
        tipo: 'numero',
        etiqueta: String(p),
        activo: p === paginaActual,
        onClick: () => irAPaginaHistorial(p)
      }));
    }

    if (rango.fin < totalPaginas) {
      if (rango.fin < totalPaginas - 1) {
        contenedor.appendChild(crearBotonPaginacionHistorial({ tipo: 'puntos' }));
      }
      contenedor.appendChild(crearBotonPaginacionHistorial({
        tipo: 'numero',
        etiqueta: String(totalPaginas),
        activo: paginaActual === totalPaginas,
        onClick: () => irAPaginaHistorial(totalPaginas)
      }));
    }

    contenedor.appendChild(crearBotonPaginacionHistorial({
      tipo: 'next',
      deshabilitado: paginaActual >= totalPaginas,
      onClick: () => irAPaginaHistorial(paginaActual + 1)
    }));
  }

  function actualizarPieHistorial(pie) {
    if (!pie) return;
    const span = pie.querySelector('[data-nc-historial-rango]');
    if (!span) return;

    const total = estadoHistorial.totalRegistros;
    if (total === 0) {
      span.textContent = 'Mostrando 0-0 de 0 notas de crédito';
      return;
    }

    const inicio = (estadoHistorial.paginaActual - 1) * estadoHistorial.tamanoPagina + 1;
    const fin = Math.min(
      estadoHistorial.paginaActual * estadoHistorial.tamanoPagina,
      total
    );
    span.textContent = `Mostrando ${inicio}-${fin} de ${total} notas de crédito`;
  }

  function irAPaginaHistorial(pagina) {
    const paginaNormalizada = Math.min(
      Math.max(1, Number(pagina) || 1),
      estadoHistorial.totalPaginas
    );
    cargarHistorialNotas(paginaNormalizada);
  }

  function renderizarFilasHistorial(items) {
    return (items || []).map((nc) => {
      const status = String(nc.status || '').toUpperCase();
      const esBorrador = status === 'BORRADOR';
      const esTimbrada = ['TIMBRADA', 'APLICADA', 'PARCIAL', 'CANCELADA'].includes(status);
      const tienePdf = Boolean(nc.pdf_path && String(nc.pdf_path).trim().length > 0);

      const badge = esBorrador
        ? '<span class="nc-badge-estado nc-estado-borrador">Borrador</span>'
        : status === 'CANCELADA'
          ? '<span class="nc-badge-estado nc-estado-cancelada">Cancelada</span>'
          : esTimbrada
            ? '<span class="nc-badge-estado nc-estado-vigente">Timbrada</span>'
            : `<span class="nc-badge-estado">${status}</span>`;

      const acciones = [];
      if (esBorrador) {
        if (nc.stamped_sibling) {
          acciones.push(`<button type="button" class="nc-btn nc-btn-secundario" data-nc-descargar="${nc.stamped_sibling.id}">
            <i class="fa fa-file-pdf"></i> PDF
          </button>`);
        } else {
          acciones.push(`<button type="button" class="nc-btn nc-btn-secundario" data-nc-editar="${nc.id}">
            <i class="fa fa-pencil-alt"></i> Editar
          </button>`);
        }
      }
      if (esTimbrada) {
        if (tienePdf) {
          acciones.push(`<button type="button" class="nc-btn nc-btn-secundario" data-nc-descargar="${nc.id}">
            <i class="fa fa-file-pdf"></i> PDF
          </button>`);
        } else {
          acciones.push(`<button type="button" class="nc-btn nc-btn-secundario" data-nc-descargar="${nc.id}">
            <i class="fa fa-download"></i> Generar PDF
          </button>`);
        }

        if (status !== 'CANCELADA') {
          acciones.push(`<button type="button" class="nc-btn nc-btn-peligro" data-nc-cancelar="${nc.id}">
            <i class="fa fa-ban"></i> Cancelar
          </button>`);
        }
      }

      const total = window.NotasCreditoUI.moneda(nc.total || 0);
      const folio = esBorrador
        ? `Borrador (${nc.invoice_folio_origen || 'S/F'})`
        : nc.folio || (nc.uuid || '').substring(0, 8) || nc.id;
      const cliente = nc.customer_name || nc.razon_social || 'Cliente';

      return `
        <tr>
          <td>${badge}</td>
          <td>${folio}</td>
          <td>${cliente}</td>
          <td>${total}</td>
          <td class="nc-historial-acciones">
            ${acciones.join(' ')}
          </td>
        </tr>
      `;
    }).join('');
  }

  const TIPO_CFDI_SUGERIDO_POR_RELACION = {
    '01': 'E',
    '02': 'I',
    '03': 'E',
    '04': 'E',
    '05': 'E',
    '06': 'I',
    '07': 'E'
  };

  window.CatalogosSATNotasCredito = {
    tiposRelacion: [
      {
        clave: '01',
        descripcion: 'Nota de crédito de los documentos relacionados',
        tipoCfdiComun: 'Egreso',
        detalle: 'Bonificaciones, descuentos o devoluciones de dinero.'
      },
      {
        clave: '02',
        descripcion: 'Nota de débito de los documentos relacionados',
        tipoCfdiComun: 'Ingreso',
        detalle: 'Aumentar el valor de una factura previa, intereses u otros cargos.'
      },
      {
        clave: '03',
        descripcion: 'Devolución de mercancía sobre facturas o traslados previos',
        tipoCfdiComun: 'Egreso o Traslado',
        detalle: 'Reembolso de dinero (egreso) o solo movimiento físico de mercancía (traslado).'
      },
      {
        clave: '04',
        descripcion: 'Sustitución de los CFDI previos',
        tipoCfdiComun: 'Ingreso, Egreso, Traslado o Pago',
        detalle: 'Cancelas el CFDI anterior y emites el correcto vinculado con este código.'
      },
      {
        clave: '05',
        descripcion: 'Traslados de mercancías facturados previamente',
        tipoCfdiComun: 'Traslado',
        detalle: 'Ya facturaste el bien (ingreso) y ahora emites traslado o carta porte.'
      },
      {
        clave: '06',
        descripcion: 'Factura generada por los traslados previos',
        tipoCfdiComun: 'Ingreso',
        detalle: 'Primero moviste la mercancía (traslado) y ahora emites la factura de venta.'
      },
      {
        clave: '07',
        descripcion: 'CFDI por aplicación de anticipo',
        tipoCfdiComun: 'Egreso',
        detalle: 'Amortizar o restar el anticipo del total de la factura global.'
      }
    ],
    tiposComprobante: [
      { clave: 'E', descripcion: 'Egreso' },
      { clave: 'I', descripcion: 'Ingreso' }
    ],
    conceptosFrecuentes: [
      { clave: '84111506', descripcion: 'Servicios de facturacion' },
      { clave: '80141600', descripcion: 'Actividades de ventas y promocion' },
      { clave: '72141700', descripcion: 'Servicios de alquiler o arrendamiento de equipo' },
      { clave: '01010101', descripcion: 'No existe en el catalogo' }
    ],
    unidadesFrecuentes: [
      { clave: 'ACT', descripcion: 'Actividad' },
      { clave: 'E48', descripcion: 'Unidad de servicio' },
      { clave: 'H87', descripcion: 'Pieza' }
    ],
    formasPago: [
      { clave: '01', descripcion: 'Efectivo' },
      { clave: '03', descripcion: 'Transferencia electrónica de fondos' },
      { clave: '04', descripcion: 'Tarjeta de crédito' },
      { clave: '28', descripcion: 'Tarjeta de débito' },
      { clave: '29', descripcion: 'Tarjeta de servicios' },
      { clave: '30', descripcion: 'Aplicación de anticipos' },
      { clave: '99', descripcion: 'Por definir' }
    ],
    metodosPago: [
      { clave: 'PUE', descripcion: 'Pago en una sola exhibición' },
      { clave: 'PPD', descripcion: 'Pago en parcialidades o diferido' }
    ]
  };

  function normalizarClaveFormaPago(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '99';
    const clave = texto.includes(' - ') ? texto.split(' - ')[0].trim() : texto;
    return /^\d+$/.test(clave) ? clave.padStart(2, '0') : '99';
  }

  function sugerirTipoComprobantePorRelacion(tipoRelacion) {
    return TIPO_CFDI_SUGERIDO_POR_RELACION[String(tipoRelacion || '01')] || 'E';
  }

  function obtenerDetalleRelacion(clave) {
    return window.CatalogosSATNotasCredito.tiposRelacion.find((t) => t.clave === clave) || null;
  }

  function aplicarPagoDesdeFactura(factura) {
    const metodo = String(factura?.metodo_pago || 'PUE').toUpperCase();
    estado.metodoPago = metodo === 'PPD' ? 'PPD' : 'PUE';
    estado.formaPago = estado.metodoPago === 'PPD'
      ? '99'
      : normalizarClaveFormaPago(factura?.forma_pago || '03');
  }

  async function api(ruta, opciones = {}) {
    const respuesta = await fetch(ruta, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token()}`,
        ...(opciones.headers || {})
      }
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || json.success === false) {
      throw new Error(json.error || 'No fue posible completar la operacion.');
    }
    return json.data;
  }

  /** Desglose fiscal de la factura origen (subtotal + IVA timbrados, sin forzar 16%). */
  function obtenerDesgloseFiscalFactura(factura) {
    const totalTimbrado = ui.numero(Number(factura?.total || 0));
    let subtotal = Number(factura?.subtotal);
    let iva = Number(factura?.tax ?? factura?.total_iva);

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      if (Number.isFinite(iva) && iva > 0 && totalTimbrado > iva) {
        subtotal = ui.numero(totalTimbrado - iva);
      } else {
        subtotal = ui.numero(totalTimbrado / 1.16);
        iva = ui.numero(totalTimbrado - subtotal);
      }
    } else {
      subtotal = ui.numero(subtotal);
      if (Number.isFinite(iva) && iva > 0) {
        iva = ui.numero(iva);
      } else {
        iva = ui.numero(Math.max(totalTimbrado - subtotal, 0));
      }
    }

    const totalCalculado = ui.numero(subtotal + iva);
    if (Math.abs(totalCalculado - totalTimbrado) > 0.02 && totalTimbrado > 0) {
      iva = ui.numero(Math.max(totalTimbrado - subtotal, 0));
    }

    const tasaIva = subtotal > 0 ? ui.numero(iva / subtotal) : 0.16;
    return {
      subtotal,
      iva,
      total: ui.numero(subtotal + iva),
      totalTimbrado,
      tasaIva,
      etiquetaTasa: `${(tasaIva * 100).toFixed(2)}%`
    };
  }

  function calcularImpuestoConcepto(c, base) {
    if (c.iva_manual != null && c.iva_manual !== '' && Number.isFinite(Number(c.iva_manual))) {
      return ui.numero(Number(c.iva_manual));
    }
    const tasa = Number(c.tasa_iva ?? estado.tasaIvaFactura ?? 0.16);
    return ui.numero(base * tasa);
  }

  function calcularTotales() {
    let subtotal = 0;
    let iva = 0;
    let retenciones = 0;

    estado.conceptos = estado.conceptos.map((c) => {
      const cantidad = Number(c.cantidad || 0);
      const precioUnitario = Number(c.precio_unitario || 0);
      const descuentoPct = Number(c.descuento_porcentaje || 0);
      const importe = cantidad * precioUnitario;
      const descuento = ui.numero(Number(c.descuento || 0) + importe * (descuentoPct / 100));
      const base = ui.numero(Math.max(importe - descuento, 0));
      const impuesto = calcularImpuestoConcepto(c, base);
      const retencion = ui.numero(c.retencion || 0);
      const totalLinea = ui.numero(base + impuesto - retencion);

      subtotal += base;
      iva += impuesto;
      retenciones += retencion;

      return {
        ...c,
        cantidad,
        precio_unitario: precioUnitario,
        descuento,
        subtotal: base,
        iva: impuesto,
        retencion,
        total: totalLinea
      };
    });

    estado.totales = {
      subtotal: ui.numero(subtotal),
      iva: ui.numero(iva),
      retenciones: ui.numero(retenciones),
      total: ui.numero(subtotal + iva - retenciones)
    };
  }

  function obtener(id) { return document.getElementById(id); }

  function cerrarModalPreview() {
    const modal = obtener('nc-modal-preview');
    if (!modal) return;
    modal.classList.remove('activo');
    modal.setAttribute('aria-hidden', 'true');
  }

  function abrirModalPreview() {
    const modal = obtener('nc-modal-preview');
    if (!modal) return;
    modal.classList.add('activo');
    modal.setAttribute('aria-hidden', 'false');
  }

  function cerrarModalAplicacionCobranza() {
    const modal = obtener('nc-modal-aplicacion-cobranza');
    if (!modal) return;
    modal.classList.remove('activo');
    modal.setAttribute('aria-hidden', 'true');
  }

  function abrirModalAplicacionCobranza() {
    const modal = obtener('nc-modal-aplicacion-cobranza');
    if (!modal) return;
    modal.classList.add('activo');
    modal.setAttribute('aria-hidden', 'false');
  }

  /* =========================================================
     RENDERIZADO PRINCIPAL
  ========================================================= */
  function renderizar() {
    calcularTotales();
    const buscador = obtener('nc-buscador-facturas');
    if (!buscador) return;

    window.ComponenteBuscadorFacturasNC.render(buscador, estado);
    window.ComponenteAlertasSATNC.render(obtener('nc-alertas-sat'), estado);
    
    // Tarjeta 1: Factura Relacionada
    window.ComponenteDocumentosRelacionadosNC.render(obtener('nc-documentos-relacionados'), estado);
    
    // Tarjeta 2: Datos Fiscales
    window.ComponenteDatosFiscalesNC.render(obtener('nc-datos-fiscales'), estado);
    
    // Tarjeta 3: Conceptos
    window.ComponenteTablaConceptosNC.render(obtener('nc-tabla-conceptos'), estado);

    // Tarjeta 4: Impuestos y Totales (comparativa + desglose fiscal)
    window.ComponenteResumenNotaCreditoNC.render(obtener('nc-impuestos-totales'), estado);
    
    // Totales flotantes en la barra lateral
    window.ComponenteTotalesNC.render(obtener('nc-totales-flotantes'), estado);
    
    // Vista previa modal
    window.ComponenteVistaPreviaNC.render(obtener('nc-modal-vista-previa'), estado);

    const estadoDoc = obtener('nc-estado-documento');
    if (estadoDoc) estadoDoc.textContent = estado.notaGuardada?.status || 'BORRADOR';

    const btnConfig = obtener('nc-btn-configurar');
    if (btnConfig) btnConfig.style.display = 'none';
  }

  /* =========================================================
     HISTORIAL DE NOTAS DE CRÉDITO
     (Listado paginado en pestaña dedicada)
  ========================================================= */
  async function cargarHistorialNotas(pagina = estadoHistorial.paginaActual) {
    const contenedor = document.getElementById('nc-historial');
    if (!contenedor) return;

    try {
      const paginaSolicitada = Math.max(1, Number(pagina) || 1);
      const params = new URLSearchParams({
        page: String(paginaSolicitada),
        limit: String(estadoHistorial.tamanoPagina)
      });
      const respuesta = await api(`/api/credit-notes?${params.toString()}`);
      const items = Array.isArray(respuesta?.items)
        ? respuesta.items
        : (Array.isArray(respuesta) ? respuesta : []);

      estadoHistorial.paginaActual = respuesta?.page || paginaSolicitada;
      estadoHistorial.totalRegistros = respuesta?.total ?? items.length;
      estadoHistorial.totalPaginas = respuesta?.totalPages
        || Math.max(1, Math.ceil(estadoHistorial.totalRegistros / estadoHistorial.tamanoPagina));

      if (
        estadoHistorial.paginaActual > estadoHistorial.totalPaginas
        && estadoHistorial.totalRegistros > 0
      ) {
        return cargarHistorialNotas(estadoHistorial.totalPaginas);
      }

      const filas = renderizarFilasHistorial(items);

      contenedor.innerHTML = `
        <section class="nc-card nc-historial-card">
          <div class="nc-card-header">
            <div>
              <h3><i class="fa fa-clock-rotate-left"></i> Historial de Notas de Crédito</h3>
              <p class="nc-subtitulo">Consulta borradores y CFDI timbrados. Desde aquí puedes editar, descargar PDF o cancelar.</p>
            </div>
          </div>
          <div class="nc-card-cuerpo">
            <div class="nc-tabla-wrap">
              <table class="nc-tabla nc-tabla-historial">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${filas || `
                    <tr>
                      <td colspan="5" class="nc-tabla-vacia">
                        <span>No hay notas de crédito registradas todavía.</span>
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
            <div class="table-footer nc-historial-footer">
              <span data-nc-historial-rango>Mostrando 0-0 de 0 notas de crédito</span>
              <div class="pagination" data-nc-historial-paginacion></div>
            </div>
          </div>
        </section>
      `;

      actualizarPieHistorial(contenedor.querySelector('.nc-historial-footer'));
      renderizarPaginacionHistorial(contenedor.querySelector('[data-nc-historial-paginacion]'));
    } catch (error) {
      console.error('[NotasCredito] Error cargando historial:', error.message);
      contenedor.innerHTML = `
        <section class="nc-card nc-historial-card">
          <div class="nc-card-cuerpo">
            <div class="nc-alerta error">
              <i class="fa fa-circle-exclamation"></i>
              <span>No fue posible cargar el historial: ${error.message}</span>
            </div>
          </div>
        </section>
      `;
    }
  }

  function refrescarHistorialSiVisible() {
    const seccion = document.getElementById('historial-nc-section');
    if (seccion?.classList.contains('active')) {
      cargarHistorialNotas(estadoHistorial.paginaActual);
    }
  }

  /* =========================================================
     PASO 1 — BÚSQUEDA
  ========================================================= */
  async function buscarFacturas() {
    const parametros = new URLSearchParams();
    if (estado.filtros.search) parametros.set('search', estado.filtros.search);
    if (estado.filtros.fecha)  parametros.set('fecha',  estado.filtros.fecha);
    estado.facturas = await api(`/api/invoices/search?${parametros.toString()}`);
    renderizar();
  }

  /* =========================================================
     SELECCIÓN DE FACTURA
  ========================================================= */
  function seleccionarFactura(invoiceId) {
    estado.facturaSeleccionada = estado.facturas.find(
      (f) => String(f.invoice_id) === String(invoiceId)
    );
    
    // Configuración inicial por defecto (Descuento con clave 01 y G02 preconfigurado)
    estado.motivo = 'DESCUENTO';
    estado.tipoRelacion = '01';
    estado.tipoComprobante = sugerirTipoComprobantePorRelacion('01');
    estado.descripcionConcepto = '';
    aplicarPagoDesdeFactura(estado.facturaSeleccionada);
    estado.conceptos = [];
    estado.configuracionInicial = true;
    const desglose = obtenerDesgloseFiscalFactura(estado.facturaSeleccionada);
    estado.tasaIvaFactura = desglose.tasaIva;
    rellenarFormularioConceptoDesdeFactura();
    calcularTotales();
    renderizar();
    
    ui.aviso('Factura seleccionada', 'Se ha cargado la información. Revisa y personaliza la nota en las tarjetas inferiores.', 'success');
  }

  /* =========================================================
     PASO 3 — CONCEPTOS / BORRADOR
  ========================================================= */
  const descripcionesPorMotivo = {
    DEVOLUCION:            'Devolución de mercancía conforme a factura origen',
    DESCUENTO:             'Descuento conforme acuerdo con el cliente',
    BONIFICACION:          'Bonificación sobre servicio o producto',
    AJUSTE_ADMINISTRATIVO: 'Ajuste administrativo',
    CORRECCION_PARCIAL:    'Corrección parcial de factura'
  };

  function nombreUnidadPorClave(clave) {
    const item = (window.CatalogosSATNotasCredito?.unidadesFrecuentes || [])
      .find((u) => u.clave === clave);
    return item?.descripcion || 'Actividad';
  }

  function rellenarFormularioConceptoDesdeFactura() {
    const factura = estado.facturaSeleccionada;
    if (!factura) return;

    const desglose = obtenerDesgloseFiscalFactura(factura);
    estado.tasaIvaFactura = desglose.tasaIva;
    const descripcion = estado.descripcionConcepto
      || descripcionesPorMotivo[estado.motivo]
      || `Acreditación de factura ${factura.folio}`;
    const satProductKey = estado.usarClaveServicios ? '84111506' : '01010101';
    const satUnitKey = 'ACT';

    estado.conceptoFormulario = crearConceptoFormularioVacio({
      descripcion,
      cantidad: 1,
      precio_unitario: desglose.subtotal,
      tasa_iva: desglose.tasaIva,
      iva_manual: desglose.iva,
      sat_product_key: satProductKey,
      sat_unit_key: satUnitKey,
      unidad: nombreUnidadPorClave(satUnitKey)
    });
  }

  function importarConceptosOriginales() {
    rellenarFormularioConceptoDesdeFactura();
    renderizar();
    const d = obtenerDesgloseFiscalFactura(estado.facturaSeleccionada);
    ui.aviso(
      'Montos de la factura origen',
      `Subtotal ${ui.moneda(d.subtotal)} + IVA (${d.etiquetaTasa}) ${ui.moneda(d.iva)} = Total ${ui.moneda(d.total)}. Pulsa Agregar o "Acreditar total exacto".`,
      'info'
    );
  }

  function agregarMontosExactosFactura() {
    const factura = estado.facturaSeleccionada;
    if (!factura) return;

    const desglose = obtenerDesgloseFiscalFactura(factura);
    estado.tasaIvaFactura = desglose.tasaIva;
    const descripcion = estado.descripcionConcepto
      || descripcionesPorMotivo[estado.motivo]
      || `Acreditación conforme factura ${factura.folio}`;

    estado.conceptos = [{
      product_id: null,
      descripcion,
      cantidad: 1,
      precio_unitario: desglose.subtotal,
      descuento: 0,
      descuento_porcentaje: 0,
      tasa_iva: desglose.tasaIva,
      iva_manual: desglose.iva,
      sat_product_key: estado.usarClaveServicios ? '84111506' : '01010101',
      sat_unit_key: 'ACT',
      unidad: nombreUnidadPorClave('ACT')
    }];
    renderizar();
    ui.aviso(
      'Montos exactos aplicados',
      `Total a acreditar: ${ui.moneda(desglose.total)} (Subtotal ${ui.moneda(desglose.subtotal)} + IVA ${ui.moneda(desglose.iva)}).`,
      'success'
    );
  }

  function resetearFormularioConcepto() {
    estado.conceptoFormulario = crearConceptoFormularioVacio({
      sat_product_key: estado.usarClaveServicios ? '84111506' : '01010101',
      sat_unit_key: 'ACT',
      unidad: nombreUnidadPorClave('ACT')
    });
  }

  function agregarConceptoDesdeFormulario() {
    const f = estado.conceptoFormulario;
    if (!f) return;

    const descripcion = String(f.descripcion || '').trim();
    if (!descripcion) return ui.aviso('Concepto', 'La descripción es obligatoria.', 'warning');
    if (Number(f.cantidad || 0) <= 0) return ui.aviso('Concepto', 'La cantidad debe ser mayor a cero.', 'warning');
    if (Number(f.precio_unitario || 0) < 0) return ui.aviso('Concepto', 'El valor unitario no puede ser negativo.', 'warning');

    const conceptoNuevo = {
      product_id: f.product_id || null,
      descripcion,
      cantidad: Number(f.cantidad || 1),
      precio_unitario: Number(f.precio_unitario || 0),
      descuento: Number(f.descuento || 0),
      descuento_porcentaje: Number(f.descuento_porcentaje || 0),
      numero_identificacion: String(f.numero_identificacion || '').trim(),
      sat_product_key: f.sat_product_key || '01010101',
      sat_unit_key: f.sat_unit_key || 'ACT',
      unidad: f.unidad || nombreUnidadPorClave(f.sat_unit_key),
      tasa_iva: f.tasa_iva ?? estado.tasaIvaFactura
    };
    if (f.iva_manual != null && f.iva_manual !== '') {
      conceptoNuevo.iva_manual = Number(f.iva_manual);
    }
    estado.conceptos.push(conceptoNuevo);
    resetearFormularioConcepto();
    renderizar();
  }

  function actualizarCampoFormularioConcepto(input) {
    const campo = input.dataset.ncFormCampo;
    if (!campo || !estado.conceptoFormulario) return;

    let valor = input.type === 'number' ? Number(input.value || 0) : input.value;
    if (campo === 'sat_unit_key') {
      estado.conceptoFormulario.sat_unit_key = valor;
      estado.conceptoFormulario.unidad = nombreUnidadPorClave(valor);
    } else if (campo === 'sat_product_key') {
      estado.conceptoFormulario.sat_product_key = valor;
    } else {
      estado.conceptoFormulario[campo] = valor;
    }
    renderizar();
  }

  function validarAntesDeGuardar() {
    if (!estado.facturaSeleccionada)          return 'Selecciona una factura relacionada.';
    if (!estado.facturaSeleccionada.uuid)     return 'La factura relacionada no tiene UUID.';
    if (!estado.motivo)                       return 'Selecciona el tipo de corrección.';
    if (estado.conceptos.length === 0)        return 'Agrega al menos un concepto con el botón Agregar.';
    if (estado.totales.total <= 0)            return 'El total debe ser mayor a cero.';

    const sumaFiscal = ui.numero(
      estado.totales.subtotal + estado.totales.iva - estado.totales.retenciones
    );
    if (Math.abs(sumaFiscal - estado.totales.total) > 0.02) {
      return `El total (${ui.moneda(estado.totales.total)}) no coincide con subtotal + IVA (${ui.moneda(sumaFiscal)}). Revisa los conceptos.`;
    }

    const saldo = Number(estado.facturaSeleccionada.saldo_disponible || 0);
    if (estado.totales.total > saldo + 0.01) {
      const origen = obtenerDesgloseFiscalFactura(estado.facturaSeleccionada);
      return [
        `El total a acreditar (${ui.moneda(estado.totales.total)}) excede el saldo del CFDI (${ui.moneda(saldo)}).`,
        `Tu NC: Subtotal ${ui.moneda(estado.totales.subtotal)} + IVA ${ui.moneda(estado.totales.iva)}.`,
        origen.total > 0
          ? `Factura origen timbrada: Subtotal ${ui.moneda(origen.subtotal)} + IVA ${ui.moneda(origen.iva)} = ${ui.moneda(origen.total)}. Usa "Acreditar total exacto" para bonificación/devolución total.`
          : ''
      ].filter(Boolean).join(' ');
    }
    return null;
  }

  async function guardarBorrador(opciones = {}) {
    const error = validarAntesDeGuardar();
    if (error) {
      await ui.aviso('Validación SAT', error, 'warning');
      throw new Error(error);
    }

    const payload = {
      invoice_id:    estado.facturaSeleccionada.invoice_id,
      reason:        estado.motivo,
      relation_type: estado.tipoRelacion || '01',
      tipo_comprobante: estado.tipoComprobante || 'E',
      forma_pago: estado.metodoPago === 'PPD' ? '99' : estado.formaPago,
      metodo_pago: estado.metodoPago || 'PUE',
      provider:      'facturama',
      items: estado.conceptos.map((c) => ({
        product_id:      c.product_id,
        cantidad:        c.cantidad,
        precio_unitario: c.precio_unitario,
        descuento:       c.descuento,
        descuento_porcentaje: c.descuento_porcentaje || 0,
        retencion:       c.retencion || 0,
        descripcion:     c.descripcion,
        sat_product_key: c.sat_product_key || '01010101',
        sat_unit_key:    c.sat_unit_key    || 'ACT',
        tasa_iva:        c.tasa_iva ?? estado.tasaIvaFactura,
        iva_manual:      c.iva_manual
      })),
      totales_ui: {
        subtotal: estado.totales.subtotal,
        iva: estado.totales.iva,
        total: estado.totales.total
      }
    };

    if (estado.notaGuardada?.id) {
      payload.id = estado.notaGuardada.id;
    }

    estado.notaGuardada = await api('/api/credit-notes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderizar();
    refrescarHistorialSiVisible();
    if (!opciones.silencioso) {
      return ui.aviso('Borrador guardado', 'La nota de crédito quedó lista para vista previa y timbrado.', 'success');
    }
  }

  async function abrirVistaPrevia() {
    await guardarBorrador({ silencioso: true });
    abrirModalPreview();
  }

  async function timbrarNotaCredito() {
    cerrarModalPreview();

    if (!estado.notaGuardada?.id) await guardarBorrador();
    if (!estado.notaGuardada?.id) return;

    if (window.Swal) {
      window.Swal.fire({
        title: 'Timbrando CFDI...',
        text: 'Conectando con el PAC, espera un momento.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => { window.Swal.showLoading(); }
      });
    }

    try {
      const respuesta = await api(`/api/credit-notes/${estado.notaGuardada.id}/stamp`, { method: 'POST' });
      estado.notaGuardada = respuesta;
      renderizar();
      refrescarHistorialSiVisible();
      cerrarModalPreview();

      const contenedor = obtener('nc-modal-aplicacion-cobranza-container');
      if (contenedor && window.ComponenteAplicacionCobranzaNC) {
        window.ComponenteAplicacionCobranzaNC.render(contenedor, estado);
        abrirModalAplicacionCobranza();
      }
    } catch (error) {
      cerrarModalPreview();
      throw error;
    } finally {
      if (window.Swal) window.Swal.close();
    }
  }

  async function verPdfNotaCredito(opciones = {}) {
    if (!estado.notaGuardada?.id) await guardarBorrador({ silencioso: true });
    if (!estado.notaGuardada?.id) return;

    const token = ui.token();
    if (!token) throw new Error('Sesion expirada. Vuelve a iniciar sesion.');

    const status = String(estado.notaGuardada?.status || '').toUpperCase();
    const uuid = String(estado.notaGuardada?.uuid || '');
    const esTimbrada = ['TIMBRADA', 'APLICADA', 'PARCIAL', 'CANCELADA'].includes(status)
      && uuid.length > 0
      && !uuid.startsWith('BORRADOR');

    const params = new URLSearchParams({ _: String(Date.now()) });
    if (opciones.preview === true || !esTimbrada) params.set('preview', 'true');
    if (opciones.download) params.set('download', 'true');

    const url = `/api/credit-notes/${estado.notaGuardada.id}/pdf?${params}`;
    const respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!respuesta.ok) {
      const json = await respuesta.json().catch(() => ({}));
      throw new Error(json.error || 'No se pudo obtener el PDF de la nota de credito.');
    }

    const contentType = respuesta.headers.get('content-type') || '';
    if (!contentType.includes('application/pdf')) {
      throw new Error('La respuesta del servidor no es un PDF valido.');
    }

    const blob = await respuesta.blob();
    if (!blob.size) throw new Error('El PDF recibido esta vacio.');

    const uuidArchivo = uuid.replace(/[^a-zA-Z0-9-]/g, '') || estado.notaGuardada.id;
    const nombreArchivo = opciones.preview === true || !esTimbrada
      ? `nota-credito-previa-${estado.notaGuardada.id}.pdf`
      : `nota-credito-${uuidArchivo}.pdf`;

    const objectUrl = URL.createObjectURL(blob);

    if (opciones.download) {
      const enlace = document.createElement('a');
      enlace.href = objectUrl;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return;
    }

    window.open(objectUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }

  function actualizarConcepto(input) {
    const indice = Number(input.dataset.ncIndice);
    const campo  = input.dataset.ncCampo;
    if (!estado.conceptos[indice]) return;
    estado.conceptos[indice][campo] = input.type === 'number' ? Number(input.value || 0) : input.value;
    renderizar();
  }

  /* =========================================================
     EVENTOS
  ========================================================= */
  function registrarEventos() {
    document.addEventListener('click', async (ev) => {
      const obj = ev.target.closest('button, input[type="radio"]');
      if (!obj) return;

      /* Paso 1 — Buscar y seleccionar factura */
      if (obj.id === 'nc-btn-buscar-factura') {
        estado.filtros.search = obtener('nc-busqueda-factura')?.value || '';
        estado.filtros.fecha  = obtener('nc-fecha-factura')?.value   || '';
        await buscarFacturas().catch((e) => ui.aviso('Búsqueda', e.message, 'error'));
      }

      if (obj.dataset.ncGenerar) seleccionarFactura(obj.dataset.ncGenerar);

      // Historial: editar borrador existente
      if (obj.dataset.ncEditar) {
        try {
          const borradorId = obj.dataset.ncEditar;
          const data = await api(`/api/credit-notes/${borradorId}`);
          if (!data) return;

          // Validar que no tenga ya una NC timbrada asociada a la factura o no tenga saldo disponible
          if (data.stamped_sibling || (data.invoice_saldo_disponible_origen !== undefined && Number(data.invoice_saldo_disponible_origen) <= 0)) {
            ui.aviso(
              'No se puede editar',
              'Esta factura relacionada ya tiene una nota de crédito timbrada o no tiene saldo disponible.',
              'warning'
            );
            return;
          }

          // 1) Marcar la nota cargada como activa
          estado.notaGuardada = data;

          // 2) Recrear la factura seleccionada mínima necesaria para validaciones y textos
          //    (usa los campos expuestos por el backend en obtenerPorId)
          const facturaDummy = {
            invoice_id: data.id_factura_origen || data.invoice_id || null,
            customer_id: data.customer_id || null,
            folio: data.invoice_folio_origen || data.folio_origen || data.folio || '',
            uuid: data.invoice_uuid_origen || '',
            customer_name: data.customer_name || data.razon_social || '',
            customer_rfc: data.customer_rfc || '',
            subtotal: Number(data.invoice_subtotal_origen || 0),
            tax: Number(data.invoice_tax_origen || 0),
            total: Number(data.invoice_total_origen || 0),
            saldo_disponible: Number(data.invoice_saldo_disponible_origen || data.invoice_total_origen || 0)
          };
          estado.facturaSeleccionada = facturaDummy;

          // 3) Reconstruir conceptos desde los items almacenados en la nota
          const items = Array.isArray(data.items) ? data.items : [];
          estado.conceptos = items.map((item) => ({
            product_id: item.product_id || null,
            cantidad: Number(item.cantidad ?? item.quantity ?? 0),
            precio_unitario: Number(item.precio_unitario ?? item.unit_price ?? 0),
            descuento: Number(item.descuento ?? item.discount ?? 0),
            descuento_porcentaje: 0,
            retencion: Number(item.retencion || 0),
            descripcion: item.descripcion || item.description || '',
            sat_product_key: item.sat_product_key || '01010101',
            sat_unit_key: item.sat_unit_key || 'H87',
            tasa_iva: item.tasa_iva,
            iva_manual: item.iva ?? item.tax
          }));

          // 4) Recalcular totales con la misma lógica del flujo normal
          calcularTotales();
          renderizar();
          activarTabFacturacion('notas-credito');

          await ui.aviso(
            'Borrador cargado',
            'Se cargó el borrador en el formulario. Revisa los conceptos y vuelve a guardar/timbrar.',
            'success'
          );
        } catch (e) {
          ui.aviso('Editar borrador', e.message, 'error');
        }
      }

      // Historial: descarga/generación de PDF timbrado
      if (obj.dataset.ncDescargar) {
        try {
          const idNota = obj.dataset.ncDescargar;
          const token = ui.token();
          if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
          const url = `/api/credit-notes/${idNota}/pdf?download=true`;
          const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            throw new Error(json.error || 'No se pudo descargar el PDF.');
          }
          const blob = await resp.blob();
          if (!blob.size) throw new Error('El PDF recibido está vacío.');
          const enlace = document.createElement('a');
          const objectUrl = URL.createObjectURL(blob);
          enlace.href = objectUrl;
          enlace.download = `nota-credito-${idNota}.pdf`;
          document.body.appendChild(enlace);
          enlace.click();
          document.body.removeChild(enlace);
          setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
        } catch (e) {
          ui.aviso('Descargar PDF', e.message, 'error');
        }
      }

      // Historial: cancelar nota de crédito timbrada ante el SAT
      if (obj.dataset.ncCancelar) {
        const idNota = obj.dataset.ncCancelar;
        if (!window.Swal) {
          const confirmo = confirm('¿Estás seguro de que deseas cancelar esta Nota de Crédito?');
          if (!confirmo) return;
          const motivo = prompt('Ingresa el motivo de cancelación del SAT (01, 02, 03 o 04):', '02');
          if (!motivo) return;
          try {
            await api(`/api/credit-notes/${idNota}/cancel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ motivo })
            });
            ui.aviso('Nota Cancelada', 'La nota de crédito se ha cancelado correctamente.', 'success');
            await cargarHistorialNotas();
          } catch (e) {
            ui.aviso('Error de Cancelación', e.message, 'error');
          }
        } else {
          const { value: motivo } = await window.Swal.fire({
            title: 'Cancelar Nota de Crédito',
            text: 'Selecciona el motivo de cancelación ante el SAT:',
            input: 'select',
            inputOptions: {
              '02': '02 - Comprobante emitido con errores sin relación',
              '03': '03 - No se llevó a cabo la operación',
              '01': '01 - Comprobante emitido con errores con relación',
              '04': '04 - Operación nominativa relacionada en la factura global'
            },
            inputPlaceholder: 'Selecciona un motivo',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No, conservar',
            inputValidator: (value) => {
              if (!value) {
                return 'Debes seleccionar un motivo de cancelación';
              }
            }
          });

          if (motivo) {
            window.Swal.fire({
              title: 'Cancelando Nota...',
              text: 'Enviando solicitud al SAT, espera un momento.',
              allowOutsideClick: false,
              allowEscapeKey: false,
              didOpen: () => { window.Swal.showLoading(); }
            });

            try {
              await api(`/api/credit-notes/${idNota}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo })
              });
              window.Swal.close();
              await window.Swal.fire(
                'Nota Cancelada',
                'La nota de crédito se ha cancelado correctamente ante el SAT.',
                'success'
              );
              await cargarHistorialNotas();
            } catch (e) {
              window.Swal.close();
              window.Swal.fire('Error', e.message || 'No se pudo cancelar la nota de crédito.', 'error');
            }
          }
        }
      }

      /* Paso 2 — Cambio de Motivo inline */
      if (obj.dataset.ncMotivo) {
        estado.motivo = obj.dataset.ncMotivo;
        estado.tipoRelacion = obj.dataset.ncTipoRelacion || '01';
        if (obj.dataset.ncTipoComprobante) {
          estado.tipoComprobante = obj.dataset.ncTipoComprobante;
        } else {
          estado.tipoComprobante = sugerirTipoComprobantePorRelacion(estado.tipoRelacion);
        }
        rellenarFormularioConceptoDesdeFactura();
        renderizar();
      }

      /* Paso 3 — Conceptos y acciones */
      if (obj.id === 'nc-importar-conceptos') importarConceptosOriginales();
      if (obj.id === 'nc-btn-agregar-concepto') agregarConceptoDesdeFormulario();
      if (obj.id === 'nc-btn-acreditar-total-exacto') agregarMontosExactosFactura();
      if (obj.id === 'nc-btn-cancelar-concepto') {
        resetearFormularioConcepto();
        renderizar();
      }
      if (obj.dataset.ncEliminar !== undefined) {
        estado.conceptos.splice(Number(obj.dataset.ncEliminar), 1);
        renderizar();
      }

      /* Borrador / preview / timbrado */
      if (obj.id === 'nc-btn-guardar-borrador') await guardarBorrador().catch((e) => ui.aviso('Guardar borrador', e.message, 'error'));
      if (obj.id === 'nc-btn-vista-previa')     await abrirVistaPrevia().catch((e) => ui.aviso('Vista previa', e.message, 'error'));
      if (obj.id === 'nc-ver-pdf')              await verPdfNotaCredito().catch((e) => ui.aviso('PDF', e.message, 'error'));
      if (obj.dataset.ncCerrarPreview !== undefined) cerrarModalPreview();
      if (obj.id === 'nc-confirmar-timbrado') {
        cerrarModalPreview();
        await timbrarNotaCredito().catch((e) => ui.aviso('Timbrado', e.message, 'error'));
      }

      /* Modal de aplicación a cobranza */
      if (obj.dataset.ncCerrarAplicacion !== undefined) cerrarModalAplicacionCobranza();
      if (obj.id === 'nc-descargar-cfdi') await verPdfNotaCredito({ download: true }).catch((e) => ui.aviso('PDF', e.message, 'error'));
      if (obj.id === 'nc-enviar-email') {
        const destinatario = obtener('nc-email-destinatario')?.value?.trim() || '';
        if (!destinatario) return ui.aviso('Correo requerido', 'Indica el correo del destinatario.', 'warning');
        if (!estado.notaGuardada?.id) return;
        await api(`/api/credit-notes/${estado.notaGuardada.id}/enviar-email`, {
          method: 'POST',
          body: JSON.stringify({ destinatario })
        }).then(() => ui.aviso('Correo enviado', 'El CFDI fue enviado correctamente.', 'success'))
          .catch((e) => ui.aviso('Envío de correo', e.message, 'error'));
      }
      if (obj.id === 'nc-confirmar-aplicacion') {
        const tipo = document.querySelector('input[name="nc-tipo-aplicacion"]:checked')?.value || 'APLICAR';
        const chk = obtener('nc-confirmar-entiendo');
        const emailDestinatario = obtener('nc-email-destinatario')?.value?.trim() || '';
        if (!chk?.checked) return ui.aviso('Confirmación requerida', 'Marca la casilla para continuar.', 'warning');
        if (!estado.notaGuardada?.id) return;
        if (tipo === 'DEVOLUCION' && !emailDestinatario) {
          return ui.aviso('Correo requerido', 'Indica el correo para enviar el comprobante de devolución.', 'warning');
        }
        try {
          const respuesta = await api(`/api/credit-notes/${estado.notaGuardada.id}/apply-type`, {
            method: 'POST',
            body: JSON.stringify({ tipo_aplicacion: tipo, email_destinatario: emailDestinatario || undefined })
          });
          const data = respuesta;
          cerrarModalAplicacionCobranza();
          estado.notaGuardada = { ...estado.notaGuardada, status: tipo === 'SALDO_FAVOR' ? 'PARCIAL' : 'APLICADA' };

          if (tipo === 'SALDO_FAVOR' && window.Swal) {
            await window.Swal.fire({
              icon: 'success',
              title: 'Saldo a favor registrado',
              html: `<p>${data?.mensaje || 'El monto se agregó al límite de crédito del cliente.'}</p>
                     <p><strong>Nuevo límite de crédito:</strong> ${ui.moneda(data?.nuevo_limite_credito ?? 0)}</p>`,
              confirmButtonText: 'Entendido'
            });
          } else if (tipo === 'DEVOLUCION' && window.Swal) {
            const fechaEst = data?.fecha_estimada
              ? new Date(data.fecha_estimada).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
              : '—';
            await window.Swal.fire({
              icon: 'success',
              title: 'Devolución generada',
              html: `<p>${data?.mensaje || 'La devolución quedó registrada.'}</p>
                     <p><strong>Fecha estimada de pago:</strong> ${fechaEst}</p>
                     <p><strong>Plazo:</strong> ${data?.dias_habiles || '—'} días hábiles</p>
                     ${data?.email_enviado ? '<p><i>Comprobante enviado por correo.</i></p>' : '<p><i>No se pudo enviar el correo; el comprobante quedó registrado en el sistema.</i></p>'}`,
              confirmButtonText: 'Entendido'
            });
          } else {
            ui.aviso('Cobranza actualizada', data?.mensaje || 'Nota de crédito aplicada correctamente.', 'success');
          }
          refrescarHistorialSiVisible();
        } catch (e) {
          ui.aviso('Aplicación a cobranza', e.message, 'error');
        }
      }
    });

    /* Enter en el buscador */
    document.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter' && ev.target.id === 'nc-busqueda-factura') {
        estado.filtros.search = ev.target.value || '';
        await buscarFacturas().catch((e) => ui.aviso('Búsqueda', e.message, 'error'));
      }
    });

    document.addEventListener('input', (ev) => {
      if (ev.target.dataset.ncFormCampo) actualizarCampoFormularioConcepto(ev.target);
      if (ev.target.dataset.ncCampo)            actualizarConcepto(ev.target);
      if (ev.target.id === 'nc-descripcion-concepto') {
        estado.descripcionConcepto = ev.target.value.trim();
        if (estado.conceptoFormulario) {
          estado.conceptoFormulario.descripcion = estado.descripcionConcepto
            || descripcionesPorMotivo[estado.motivo]
            || '';
        }
        renderizar();
      }
    });

    document.addEventListener('change', (ev) => {
      if (ev.target.dataset.ncFormCampo) actualizarCampoFormularioConcepto(ev.target);
      if (ev.target.dataset.ncCampo) actualizarConcepto(ev.target);
      
      if (ev.target.id === 'nc-tipo-relacion') {
        estado.tipoRelacion = ev.target.value;
        estado.tipoComprobante = sugerirTipoComprobantePorRelacion(estado.tipoRelacion);
        renderizar();
      }

      if (ev.target.id === 'nc-tipo-comprobante') {
        estado.tipoComprobante = ev.target.value;
        renderizar();
      }

      if (ev.target.id === 'nc-metodo-pago') {
        estado.metodoPago = ev.target.value;
        if (estado.metodoPago === 'PPD') estado.formaPago = '99';
        renderizar();
      }

      if (ev.target.id === 'nc-forma-pago') {
        estado.formaPago = ev.target.value;
        renderizar();
      }

      if (ev.target.id === 'nc-modo-avanzado') {
        estado.modoAvanzado = ev.target.checked;
        if (!estado.modoAvanzado && estado.motivo) {
          const motivosMap = {
            DEVOLUCION: '03',
            DESCUENTO: '01',
            BONIFICACION: '01',
            CORRECCION_PARCIAL: '04',
            AJUSTE_ADMINISTRATIVO: '01'
          };
          estado.tipoRelacion = motivosMap[estado.motivo] || '01';
          estado.tipoComprobante = sugerirTipoComprobantePorRelacion(estado.tipoRelacion);
        }
        renderizar();
      }

      if (ev.target.id === 'nc-confirmar-entiendo') {
        const btn = obtener('nc-confirmar-aplicacion');
        if (btn) btn.disabled = !ev.target.checked;
      }

      if (ev.target.name === 'nc-tipo-aplicacion' && window.ComponenteAplicacionCobranzaNC) {
        window.ComponenteAplicacionCobranzaNC.actualizarUiOpciones();
      }
    });

    document.querySelectorAll('.section-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.section === 'historial-nc') {
          cargarHistorialNotas(1);
        }
      });
    });
  }

  window.NotasCreditoDesglose = obtenerDesgloseFiscalFactura;

  document.addEventListener('DOMContentLoaded', () => {
    if (!obtener('notas-credito-app')) return;
    registrarEventos();
    renderizar();
  });
})();
