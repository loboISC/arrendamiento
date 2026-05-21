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
    configuracionInicial: false
  };

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

  window.CatalogosSATNotasCredito = {
    tiposRelacion: [
      { clave: '01', descripcion: 'Nota de credito de los documentos relacionados' },
      { clave: '02', descripcion: 'Nota de debito de los documentos relacionados' },
      { clave: '03', descripcion: 'Devolucion de mercancia sobre facturas o traslados previos' },
      { clave: '04', descripcion: 'Sustitucion de los CFDI previos' }
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
    ]
  };

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

  function calcularTotales() {
    let subtotal = 0, iva = 0, retenciones = 0;
    estado.conceptos = estado.conceptos.map((c) => {
      const cantidad = Number(c.cantidad || 0);
      const precioUnitario = Number(c.precio_unitario || 0);
      const descuentoPct = Number(c.descuento_porcentaje || 0);
      const importe = cantidad * precioUnitario;
      const descuento = ui.numero(Number(c.descuento || 0) + importe * (descuentoPct / 100));
      const base = ui.numero(Math.max(importe - descuento, 0));
      const impuesto = ui.numero(base * 0.16);
      const retencion = ui.numero(c.retencion || 0);
      const total = ui.numero(base + impuesto - retencion);
      subtotal += base; iva += impuesto; retenciones += retencion;
      return { ...c, cantidad, precio_unitario: precioUnitario, descuento, iva: impuesto, retencion, total };
    });
    estado.totales = {
      subtotal: ui.numero(subtotal),
      iva: ui.numero(iva),
      retenciones: ui.numero(retenciones),
      total: ui.numero(subtotal + iva - retenciones)
    };
  }

  function obtener(id) { return document.getElementById(id); }

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
    estado.descripcionConcepto = '';
    estado.conceptos = [];
    estado.configuracionInicial = true;
    
    calcularTotales();
    importarConceptosOriginales();
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

  function importarConceptosOriginales() {
    const factura = estado.facturaSeleccionada;
    if (!factura) return;

    const subtotal = ui.numero(Number(factura.subtotal || factura.total / 1.16 || 0));
    const descripcion = estado.descripcionConcepto
      || descripcionesPorMotivo[estado.motivo]
      || `Acreditación de factura ${factura.folio}`;

    const satProductKey = estado.usarClaveServicios ? '84111506' : '01010101';

    estado.conceptos = [{
      product_id: null,
      descripcion,
      cantidad: 1,
      precio_unitario: subtotal,
      descuento: 0,
      descuento_porcentaje: 0,
      sat_product_key: satProductKey,
      sat_unit_key: 'ACT'
    }];
    renderizar();
  }

  function validarAntesDeGuardar() {
    if (!estado.facturaSeleccionada)          return 'Selecciona una factura relacionada.';
    if (!estado.facturaSeleccionada.uuid)     return 'La factura relacionada no tiene UUID.';
    if (!estado.motivo)                       return 'Selecciona el tipo de corrección.';
    if (estado.conceptos.length === 0)        return 'Importa o agrega conceptos.';
    if (estado.totales.total <= 0)            return 'El total debe ser mayor a cero.';
    if (estado.totales.total > Number(estado.facturaSeleccionada.saldo_disponible || 0) + 0.01) {
      return `⚠ El monto excede el saldo disponible del CFDI (${ui.moneda(estado.facturaSeleccionada.saldo_disponible)}).`;
    }
    return null;
  }

  async function guardarBorrador() {
    const error = validarAntesDeGuardar();
    if (error) return ui.aviso('Validación SAT', error, 'warning');

    const payload = {
      invoice_id:    estado.facturaSeleccionada.invoice_id,
      reason:        estado.motivo,
      relation_type: estado.tipoRelacion || '01',
      provider:      'facturama',
      items: estado.conceptos.map((c) => ({
        product_id:      c.product_id,
        cantidad:        c.cantidad,
        precio_unitario: c.precio_unitario,
        descuento:       c.descuento,
        retencion:       c.retencion || 0,
        descripcion:     c.descripcion,
        sat_product_key: c.sat_product_key || '01010101',
        sat_unit_key:    c.sat_unit_key    || 'ACT'
      }))
    };

    estado.notaGuardada = await api('/api/credit-notes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderizar();
    return ui.aviso('Borrador guardado', 'La nota de crédito quedó lista para vista previa y timbrado.', 'success');
  }

  function abrirVistaPrevia() {
    const error = validarAntesDeGuardar();
    if (error) return ui.aviso('Validación SAT', error, 'warning');
    obtener('nc-modal-preview')?.classList.add('activo');
  }

  async function timbrarNotaCredito() {
    if (!estado.notaGuardada?.id) await guardarBorrador();
    if (!estado.notaGuardada?.id) return;
    estado.notaGuardada = await api(`/api/credit-notes/${estado.notaGuardada.id}/stamp`, { method: 'POST' });
    renderizar();
    obtener('nc-modal-preview')?.classList.remove('activo');

    const contenedor = obtener('nc-modal-aplicacion-cobranza-container');
    if (contenedor && window.ComponenteAplicacionCobranzaNC) {
      window.ComponenteAplicacionCobranzaNC.render(contenedor, estado);
    }
    const modalCobranza = obtener('nc-modal-aplicacion-cobranza');
    if (modalCobranza) {
      modalCobranza.classList.add('activo');
    } else {
      await ui.aviso('Nota timbrada', 'CFDI de egreso timbrado. UUID: ' + (estado.notaGuardada?.uuid || ''), 'success');
    }
  }

  async function verPdfNotaCredito() {
    if (!estado.notaGuardada?.id) await guardarBorrador();
    if (!estado.notaGuardada?.id) return;
    const token = encodeURIComponent(ui.token());
    window.open(`/api/credit-notes/${estado.notaGuardada.id}/pdf?token=${token}`, '_blank');
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

      /* Paso 2 — Cambio de Motivo inline */
      if (obj.dataset.ncMotivo) {
        estado.motivo = obj.dataset.ncMotivo;
        estado.tipoRelacion = obj.dataset.ncTipoRelacion || '01';
        importarConceptosOriginales();
        renderizar();
      }

      /* Paso 3 — Conceptos y acciones */
      if (obj.id === 'nc-importar-conceptos') importarConceptosOriginales();
      if (obj.dataset.ncEliminar !== undefined) {
        estado.conceptos.splice(Number(obj.dataset.ncEliminar), 1);
        renderizar();
      }

      /* Borrador / preview / timbrado */
      if (obj.id === 'nc-btn-guardar-borrador') await guardarBorrador().catch((e) => ui.aviso('Guardar borrador', e.message, 'error'));
      if (obj.id === 'nc-btn-vista-previa')     abrirVistaPrevia();
      if (obj.id === 'nc-ver-pdf')              await verPdfNotaCredito().catch((e) => ui.aviso('PDF', e.message, 'error'));
      if (obj.dataset.ncCerrarPreview !== undefined)  obtener('nc-modal-preview')?.classList.remove('activo');
      if (obj.id === 'nc-confirmar-timbrado')   await timbrarNotaCredito().catch((e) => ui.aviso('Timbrado', e.message, 'error'));

      /* Modal de aplicación a cobranza */
      if (obj.dataset.ncCerrarAplicacion !== undefined) {
        obtener('nc-modal-aplicacion-cobranza')?.classList.remove('activo');
      }
      if (obj.id === 'nc-descargar-cfdi') await verPdfNotaCredito().catch((e) => ui.aviso('PDF', e.message, 'error'));
      if (obj.id === 'nc-confirmar-aplicacion') {
        const tipo = document.querySelector('input[name="nc-tipo-aplicacion"]:checked')?.value || 'APLICAR';
        const chk  = obtener('nc-confirmar-entiendo');
        if (!chk?.checked) return ui.aviso('Confirmación requerida', 'Marca la casilla para continuar.', 'warning');
        if (!estado.notaGuardada?.id) return;
        await api(`/api/credit-notes/${estado.notaGuardada.id}/apply-type`, {
          method: 'POST',
          body: JSON.stringify({ tipo_aplicacion: tipo })
        }).then((r) => {
          obtener('nc-modal-aplicacion-cobranza')?.classList.remove('activo');
          ui.aviso('Cobranza actualizada', r?.mensaje || 'Nota de crédito aplicada correctamente.', 'success');
        }).catch((e) => ui.aviso('Aplicación a cobranza', e.message, 'error'));
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
      if (ev.target.dataset.ncCampo)            actualizarConcepto(ev.target);
      if (ev.target.id === 'nc-descripcion-concepto') {
        estado.descripcionConcepto = ev.target.value.trim();
        // Actualizar la descripción del concepto actual
        if (estado.conceptos[0]) {
          estado.conceptos[0].descripcion = estado.descripcionConcepto || descripcionesPorMotivo[estado.motivo];
          renderizar();
        }
      }
    });

    document.addEventListener('change', (ev) => {
      if (ev.target.dataset.ncCampo) actualizarConcepto(ev.target);
      
      if (ev.target.id === 'nc-tipo-relacion') {
        estado.tipoRelacion = ev.target.value;
        renderizar();
      }

      if (ev.target.id === 'nc-modo-avanzado') {
        estado.modoAvanzado = ev.target.checked;
        if (!estado.modoAvanzado) {
          estado.tipoRelacion = '01';
        }
        renderizar();
      }

      if (ev.target.id === 'nc-confirmar-entiendo') {
        const btn = obtener('nc-confirmar-aplicacion');
        if (btn) btn.disabled = !ev.target.checked;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!obtener('notas-credito-app')) return;
    registrarEventos();
    renderizar();
  });
})();
