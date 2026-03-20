/* cotizacion_renta_extraido.js
 * Scripts extraídos de cotizacion_renta.html para cumplir principios de
 * separación de responsabilidades (clean code).
 * Todos los bloques se ejecutan después de que cotizacion_renta.js ya cargó.
 */

// =========================================================
// Helpers de modal genérico
// =========================================================
function crOpenModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function crCloseModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Registra listeners para cerrar un modal con clic en atributo
 * y con tecla Escape.
 * @param {HTMLElement} modal
 * @param {string} closeAttr - atributo data-* que marca el elemento disparador
 */
function crBindModalClose(modal, closeAttr) {
  if (!modal) return;
  modal.addEventListener('click', (ev) => {
    if (ev.target.closest(`[${closeAttr}]`)) crCloseModal(modal);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !modal.hidden) crCloseModal(modal);
  });
}

// =========================================================
// Cierre de modales (extraídos de scripts inline del HTML)
// =========================================================
(function bindModalCloseHandlers() {
  // Modal: Clonar cotización
  const cloneModal = document.getElementById('cr-clone-modal');
  crBindModalClose(cloneModal, 'data-clone-close');
  cloneModal?.querySelector('[data-clone-confirm]')?.addEventListener('click', () => {
    crCloseModal(cloneModal);
  });

  // Modal: Guardar cliente nuevo
  crBindModalClose(
    document.getElementById('cr-save-client-modal'),
    'data-client-save-close'
  );

  // Modal: Confirmar guardado de borrador
  crBindModalClose(
    document.getElementById('cr-save-modal'),
    'data-save-close'
  );

  // Modal: Historial de cotización
  crBindModalClose(
    document.getElementById('cr-history-modal'),
    'data-history-close'
  );

  // Modal: Confirmación de guardado general
  const confirmSaveModal = document.getElementById('cr-confirm-save-modal');
  if (confirmSaveModal) {
    confirmSaveModal.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-confirm-close]') || ev.target === confirmSaveModal) {
        crCloseModal(confirmSaveModal);
      }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !confirmSaveModal.hidden) crCloseModal(confirmSaveModal);
    });
  }
})();

// =========================================================
// Inicialización del encabezado de cotización
// =========================================================
(function initQuoteHeader() {
  try {
    const dateEl = document.getElementById('v-quote-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().split('T')[0];
    }
  } catch { }

  try {
    const numEl = document.getElementById('v-quote-number');
    if (numEl) {
      const params = new URLSearchParams(location.search);
      const forceNew = params.get('new') === '1';
      if (forceNew || !numEl.value) {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        numEl.value = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      }
    }
  } catch { }
})();

// =========================================================
// Modal de clientes: forzar tab "Clientes" al abrir iframe
// =========================================================
(function initClientModalIframe() {
  const modal = document.getElementById('v-client-modal');
  const iframe = document.getElementById('v-client-iframe');
  if (!modal || !iframe) return;

  const activateClientesTab = () => {
    try {
      const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
      doc?.querySelector('button.tab[data-section="clientes"]')?.click?.();
      iframe?.contentWindow?.postMessage(
        { type: 'activate-tab', section: 'clientes' },
        window.origin || '*'
      );
    } catch { }
  };

  document.getElementById('v-pick-client')?.addEventListener('click', () => {
    try { iframe.removeEventListener('load', activateClientesTab); } catch { }
    iframe.src = 'clientes.html?pick=1#clientes';
    iframe.addEventListener('load', () => {
      activateClientesTab();
      setTimeout(activateClientesTab, 200);
    }, { once: true });
  });
})();

// =========================================================
// Delegación de acciones del menú lateral
// =========================================================
(function bindSideMenuActions() {
  const CLIENT_KEY = 'cr_selected_client';
  const nav = document.querySelector('#cr-sidemenu .cr-sidemenu__nav');
  if (!nav) return;

  nav.addEventListener('click', (ev) => {
    const link = ev.target.closest('a.cr-menu-item[data-action]');
    if (!link) return;
    ev.preventDefault();

    const action = link.getAttribute('data-action');

    switch (action) {
      case 'nuevo': {
        window.open('cotizacion_renta.html?new=1', '_blank', 'noopener');
        break;
      }

      case 'guardar': {
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');
        const labelText = clientLabel?.textContent?.trim() ?? '';
        const hasClient =
          (labelText && labelText !== 'Seleccionar cliente') ||
          !!clientHidden?.value?.trim();

        if (hasClient) {
          const modal = document.getElementById('cr-save-modal');
          if (!modal) break;

          const clientName = labelText || clientHidden?.value?.trim() || 'Cliente seleccionado';
          const clientNameEl = modal.querySelector('#cr-confirm-client-name');
          const clientCompanyEl = modal.querySelector('#cr-confirm-client-company');

          try {
            const clientData = JSON.parse(localStorage.getItem(CLIENT_KEY) || 'null');
            if (clientNameEl)   clientNameEl.textContent   = clientData?.nombre     || clientName  || 'No especificado';
            if (clientCompanyEl) clientCompanyEl.textContent = clientData?.empresa || clientData?.razon_social || 'No especificado';
          } catch {
            if (clientNameEl)    clientNameEl.textContent    = clientName || 'No especificado';
            if (clientCompanyEl) clientCompanyEl.textContent = 'No especificado';
          }

          crOpenModal(modal);
          setTimeout(() => modal.querySelector('#cr-save-confirm')?.focus?.(), 100);
        } else {
          const modal = document.getElementById('cr-save-client-modal');
          if (!modal) break;
          crOpenModal(modal);
          setTimeout(() => modal.querySelector('#cr-cliente-nombre')?.focus?.(), 100);
        }
        break;
      }

      case 'historial': {
        const modal = document.getElementById('cr-history-modal');
        if (!modal) break;
        crOpenModal(modal);
        setTimeout(() => window.loadQuotationHistory?.(), 100);
        break;
      }

      case 'clonar': {
        if (!window.cotizacionEditandoId) {
          alert('Debe abrir una cotización existente para poder clonarla.');
          break;
        }
        if (typeof window.fillCloneModalWithCurrentQuotation === 'function') {
          window.fillCloneModalWithCurrentQuotation();
        } else {
          console.error('Función de clonación no disponible');
          alert('Error: Funcionalidad de clonación no disponible');
        }
        break;
      }

      default:
        break;
    }
  });
})();

// =========================================================
// Snapshot de cotización activa y apertura de reporte PDF
// =========================================================
(function initQuoteSnapshotAndPDF() {
  // ----- helpers internos -----
  function parseMoney(val) {
    try {
      if (val == null) return 0;
      if (typeof val === 'number' && isFinite(val)) return val;
      const n = String(val).trim().replace(/[^0-9.,-]/g, '').replace(/,/g, '');
      const num = parseFloat(n);
      return isFinite(num) ? num : 0;
    } catch { return 0; }
  }

  function readById(id) {
    try {
      const el = document.getElementById(id);
      return el ? parseMoney(el.textContent || el.value || '') : null;
    } catch { return null; }
  }

  function readByLabel(labelStarts) {
    try {
      const needle = String(labelStarts || '').trim().toUpperCase();
      for (const td of document.querySelectorAll('td')) {
        if ((td.textContent || '').trim().toUpperCase().startsWith(needle)) {
          const valTd = td.nextElementSibling;
          if (valTd) return parseMoney(valTd.textContent || '');
        }
      }
    } catch { }
    return null;
  }

  function getApplyIva() {
    try {
      const sel = document.getElementById('cr-summary-apply-iva') ||
                  document.getElementById('apply-iva') ||
                  document.getElementById('cr-apply-iva');
      if (sel?.tagName === 'SELECT') {
        const v = (sel.value || 'si').toLowerCase();
        return v === 'si' || v === 'true' || v === '1';
      }
      const chk = document.getElementById('apply-iva-chk') ||
                  document.getElementById('renta-apply-iva-chk');
      if (chk && 'checked' in chk) return !!chk.checked;
    } catch { }
    return true;
  }

  function getDiscount() {
    try {
      const sel = document.getElementById('cr-summary-apply-discount');
      const inp = document.getElementById('cr-summary-discount-percent-input');
      const apply = (sel?.value || 'no') === 'si';
      const pct = Math.max(0, Math.min(100, Number(inp?.value || 0)));
      return { apply, pct };
    } catch { return { apply: false, pct: 0 }; }
  }

  // ----- función principal de snapshot -----
  function buildActiveQuoteSnapshot() {
    try {
      const s = window.state || {};
      const days = Number(s.days || 1);
      const cart = Array.isArray(s.cart) ? s.cart : [];
      const products = Array.isArray(s.products) ? s.products : [];
      const findProduct = (id) => products.find(p => String(p.id) === String(id)) || {};

      const items = cart.map(ci => {
        const p = findProduct(ci.id) || {};
        const qty = Number(ci.qty || ci.quantity || 1);
        const unit = p.unit || p.unidad || ci.unit || ci.unidad || 'PZA';
        const priceDay = Number(
          (p.price && p.price.diario) ?? p.tarifa_renta ?? p.precio ??
          (ci.price && ci.price.diario) ?? ci.tarifa_renta ?? ci.precio ?? 0
        );
        return {
          id: p.id || ci.id,
          sku: p.sku || p.clave || p.codigo || ci.sku || ci.clave || ci.codigo || p.id || '',
          nombre: p.name || p.nombre || ci.name || ci.nombre || '',
          descripcion: p.desc || p.descripcion || ci.desc || ci.descripcion || '',
          imagen: p.image || p.imagen || ci.image || ci.imagen || '',
          unidad: unit,
          cantidad: qty,
          peso: Number(p.peso ?? p.weight ?? p.peso_kg ?? 0),
          precio_venta: Number(p.sale ?? p.precio_venta ?? (p.price && p.price.venta) ?? p.pventa ?? 0),
          precio_unitario_renta: priceDay,
          dias: Number(ci.dias || days || 1),
          importe: priceDay * qty * Number(ci.dias || days || 1)
        };
      });

      // Accesorios seleccionados
      let accessories = [];
      try {
        if (window.state && s.accSelected && s.accSelected.size > 0) {
          const accessoriesCatalog = Array.isArray(s.accessories) ? s.accessories : [];
          const productsCatalog = Array.isArray(s.products) ? s.products : [];

          accessories = Array.from(s.accSelected).map(id => {
            const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
            const qty = Math.max(1, parseInt((s.accQty && s.accQty[id]) || '1', 10));
            const price = parseFloat(node?.getAttribute('data-price') || node?.getAttribute('data-renta') || '0') || 0;
            const sale = parseFloat(node?.getAttribute('data-sale') || node?.getAttribute('data-venta') || '0') || 0;
            const sku = node?.getAttribute('data-sku') || id;
            const imagen = node?.getAttribute('data-image') || node?.querySelector('img')?.src || '';
            const peso = parseFloat(node?.getAttribute('data-peso') || node?.getAttribute('data-weight') || '0') || 0;
            const domId = node?.getAttribute('data-id');
            const descAttr = node?.getAttribute('data-desc') || node?.querySelector('.cr-desc')?.textContent || '';

            const norm = (val) => String(val || '').trim().toLowerCase();
            const findInCatalog = (col) => col.find(a =>
              norm(a.name) === norm(id) ||
              (domId && norm(a.id) === norm(domId)) ||
              (a.sku && norm(a.sku) === norm(sku))
            ) || {};

            const accData = findInCatalog(accessoriesCatalog);
            const prodData = findInCatalog(productsCatalog);

            return {
              id, sku,
              nombre: accData.name || prodData.name || id,
              descripcion: accData.desc || accData.descripcion || prodData.desc || prodData.descripcion || descAttr || '',
              cantidad: qty,
              precio_unitario_renta: price,
              precio_venta: sale,
              salePrice: sale,
              dias: Number(days || 1),
              imagen, peso
            };
          });
        }
      } catch { }

      // Cliente: priorizar DOM, luego estado, luego localStorage
      let cliente = {
        id: s.client?.id || s.cliente?.id || localStorage.getItem('cr_selected_client_id'),
        nombre: (document.getElementById('cr-contact-name')?.value || '').trim() || 'Público en General',
        email: (document.getElementById('cr-contact-email')?.value || '').trim(),
        rfc: (document.getElementById('cr-contact-rfc')?.value || '').trim(),
        telefono: (document.getElementById('cr-contact-phone')?.value || '').trim(),
        cp: (document.getElementById('cr-contact-zip')?.value || '').trim(),
        ciudad: (document.getElementById('cr-contact-municipio')?.value || '').trim(),
        domicilio: (document.getElementById('cr-contact-address')?.value || '').trim()
      };

      if (!cliente.nombre || cliente.nombre === 'Público en General') {
        let fallback = s.client || s.cliente || window.selectedClient || null;
        if (!fallback) {
          try { const raw = localStorage.getItem('cr_selected_client'); if (raw) fallback = JSON.parse(raw); } catch { }
        }
        if (fallback) {
          cliente.nombre   = fallback.nombre   || fallback.name        || fallback.razon_social || cliente.nombre;
          cliente.email    = cliente.email    || fallback.email    || fallback.correo    || '';
          cliente.rfc      = cliente.rfc      || fallback.rfc      || fallback.fact_rfc  || '';
          cliente.telefono = cliente.telefono || fallback.telefono || fallback.celular   || '';
        }
      }

      // Condiciones
      const condicionesInput = (document.getElementById('cr-summary-conditions')?.value || '').trim();
      const condiciones = condicionesInput ||
        (s.conditions || s.condiciones || '').toString().trim() ||
        'Pago anticipado. Entrega sujeta a disponibilidad. Vigencia de 7 días. Precios en MXN más IVA.';

      // Folio
      let folio = (document.getElementById('v-quote-number')?.value || '').trim() || null;
      if (!folio) folio = s.folio || s.quoteNumber || null;
      try { if (folio) { s.folio = folio; s.quoteNumber = folio; } } catch { }

      // Totales financieros
      const aplicaIVA = getApplyIva();
      const discount  = getDiscount();
      const subtotal      = (readById('cr-fin-subtotal')    ?? readById('cr-total-subtotal')  ?? readByLabel('SUB-TOTAL'))  || 0;
      const garantia      = (readById('cr-fin-deposit')     ?? readById('cr-total-garantia')  ?? readByLabel('GARANTÍA'))   || 0;
      const rentaDiaria   = (readById('cr-fin-day')         ?? readById('cr-renta-diaria')    ?? readByLabel('RENTA DIARIA')) || 0;
      const xDias         = (readById('cr-fin-total-days')  ?? readById('cr-x-dias')          ?? readByLabel('X '))         || 0;
      const iva           = (readById('cr-fin-iva')         ?? readById('cr-total-iva')       ?? readByLabel('IVA'))        || 0;
      const total         = (readById('cr-fin-total')       ?? readById('cr-total-total')     ?? readByLabel('TOTAL'))      || 0;
      const descuentoMonto = (readById('cr-fin-discount')   ?? readById('cr-total-descuento') ?? readByLabel('DESCUENTO'))  || 0;
      const envioCosto    = (readById('cr-fin-shipping')    ?? Number(s?.deliveryExtra || s?.envio?.costo || s?.shipping || 0)) || 0;

      // Observaciones
      const observaciones = (
        document.getElementById('cr-observations') ||
        document.getElementById('cr-contact-notes')
      )?.value?.trim() || '';

      const payload = {
        tipo: 'RENTA',
        fecha: new Date().toISOString(),
        moneda: 'MXN',
        folio,
        almacen: s.selectedWarehouse || null,
        cliente,
        dias: days,
        items,
        accessories,
        condiciones,
        notas: observaciones,
        aplicaIVA,
        discount,
        itemDiscounts: window.state?.itemDiscounts || {},
        envio: { costo: envioCosto },
        totals: { subtotal, descuento: descuentoMonto, envio: envioCosto, garantia, iva, total, rentaDiaria, xDias }
      };

      try { sessionStorage.setItem('active_quote', JSON.stringify(payload)); } catch { }
      try { localStorage.setItem('active_quote', JSON.stringify(payload)); } catch { }
      try { sessionStorage.setItem('renta_accessories_snapshot', JSON.stringify(accessories)); } catch { }
      try { localStorage.setItem('renta_accessories_snapshot', JSON.stringify(accessories)); } catch { }
      try { window.last_active_quote = payload; } catch { }

      return payload;
    } catch (e) {
      console.warn('No se pudo preparar snapshot de cotización:', e);
    }
  }

  // ----- Abrir reporte / vista previa PDF -----
  function openReportAutoPDF() {
    const payload = buildActiveQuoteSnapshot() || window.last_active_quote;
    try { sessionStorage.setItem('active_quote', JSON.stringify(payload)); } catch { }
    try { localStorage.setItem('active_quote', JSON.stringify(payload)); } catch { }

    let url = 'reporte_venta_renta.html';
    try {
      const folio = payload?.folio || payload?.numero_cotizacion || payload?.quoteNumber || '';
      if (folio) url += `?folio=${encodeURIComponent(String(folio).trim())}`;
    } catch { }

    try {
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      url += (url.includes('?') ? '&' : '?') + (
        b64.length <= 60000
          ? `payload=${encodeURIComponent(b64)}`
          : `big=1&ts=${Date.now()}`
      );
    } catch { url += (url.includes('?') ? '&' : '?') + `ts=${Date.now()}`; }

    if (typeof window.openPreviewModal === 'function') {
      window.openPreviewModal(url);
      const iframe = document.getElementById('cr-preview-iframe');
      if (iframe) {
        if (window.__reportPostTimer) clearInterval(window.__reportPostTimer);
        let attempts = 0;
        window.__reportPostTimer = setInterval(() => {
          attempts++;
          try { iframe.contentWindow?.postMessage({ type: 'active_quote', data: payload }, '*'); } catch { }
          if (attempts >= 30) { clearInterval(window.__reportPostTimer); window.__reportPostTimer = null; }
        }, 300);
      }
      return;
    }

    if (!window.__reportWin || window.__reportWin.closed) {
      try {
        const w = window.open(url, '_blank');
        window.__reportWin = w;
        if (!w) window.location.assign(url);
      } catch { try { window.location.assign(url); } catch { } }
    } else {
      try { window.__reportWin.location.assign(url); window.__reportWin.focus(); } catch { }
    }
  }

  // Bind botón PDF
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('cr-export-pdf');
    if (btn && !btn.__bound) { btn.addEventListener('click', openReportAutoPDF); btn.__bound = true; }
  });

  // Exponer globalmente
  try {
    window.openReportAutoPDF = openReportAutoPDF;
    window.buildActiveQuoteSnapshot = buildActiveQuoteSnapshot;
  } catch { }

  // Responder solicitudes del reporte
  try {
    window.addEventListener('message', (ev) => {
      try {
        const msg = ev?.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'request_active_quote') {
          const payload = buildActiveQuoteSnapshot() || window.last_active_quote;
          ev.source?.postMessage({ type: 'active_quote', data: payload }, '*');
        }
      } catch { }
    });
  } catch { }
})();

// =========================================================
// Funciones de modal de vista previa PDF
// =========================================================
window.openPreviewModal = function (url) {
  const modal = document.getElementById('cr-preview-modal');
  const iframe = document.getElementById('cr-preview-iframe');
  if (!modal || !iframe) return;
  iframe.src = url;
  crOpenModal(modal);
  document.body.style.overflow = 'hidden';
};

window.closePreviewModal = function () {
  const modal = document.getElementById('cr-preview-modal');
  const iframe = document.getElementById('cr-preview-iframe');
  if (!modal) return;
  crCloseModal(modal);
  if (iframe) iframe.src = 'about:blank';
  document.body.style.overflow = '';
};
