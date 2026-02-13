// ===== SECTION NAVIGATION =====
document.addEventListener('DOMContentLoaded', function () {
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.content-section');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetSection = this.dataset.section;

      // Update active tab
      tabButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Update active section
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(targetSection + '-section').classList.add('active');
    });
  });

  // Initialize charts if Chart.js is loaded
  if (typeof Chart !== 'undefined') {
    initializeCharts();
  }
});

// ===== CHART INITIALIZATION =====
function initializeCharts() {
  // Evolution Chart (Bar Chart)
  const evolutionCtx = document.getElementById('evolutionChart');
  if (evolutionCtx) {
    new Chart(evolutionCtx, {
      type: 'bar',
      data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
        datasets: [
          {
            label: 'Facturado',
            data: [65, 85, 95, 120, 135, 145, 130],
            backgroundColor: '#2979ff',
            borderRadius: 6
          },
          {
            label: 'Timbrado',
            data: [60, 80, 90, 115, 130, 140, 125],
            backgroundColor: '#00bcd4',
            borderRadius: 6
          },
          {
            label: 'Cancelado',
            data: [5, 8, 6, 10, 7, 9, 8],
            backgroundColor: '#f44336',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Distribution Chart (Doughnut Chart)
  const distributionCtx = document.getElementById('distributionChart');
  if (distributionCtx) {
    new Chart(distributionCtx, {
      type: 'doughnut',
      data: {
        labels: ['Timbrado', 'Pendiente PPD', 'Cancelado', 'Borrador'],
        datasets: [{
          data: [85, 23, 8, 36],
          backgroundColor: ['#2979ff', '#ff9800', '#f44336', '#00bcd4'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function normalizarRol(rol) {
  if (!rol) return '';
  const map = {
    'ventas': 'Ventas',
    'rentas': 'Rentas',
    'recepcion': 'Recepción',
    'director general': 'Director General',
    'ingeniero en sistemas': 'Ingeniero en Sistemas',
    'ingeniera de proyectos': 'Ingeniero en Proyectos',
    'sistema de gestion de calidad': 'Ingeniero en Calidad',
    'auxiliar contable': 'Contabilidad'
  };
  return map[rol.trim().toLowerCase()] || rol;
}

function getUserRole() {
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return normalizarRol(JSON.parse(user).rol);
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const role = getUserRole();
  if (!role) return;
  const permisos = {
    'Director General': [
      'dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html',
      'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html',
      'notificaciones.html', 'configuracion.html', 'ventas.html'
    ],
    'Ingeniero en Sistemas': [
      'dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html',
      'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html',
      'notificaciones.html', 'configuracion.html', 'ventas.html'
    ],
    'Ingeniero en Calidad': [
      'calidad.html', 'analisis.html', 'dashboard.html'
    ],
    'Ingeniero en Proyectos': [
      'proyectos.html', 'analisis.html', 'notificaciones.html', 'logistica.html'
    ],
    'Ventas': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Rentas': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Recepción': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Contabilidad': [
      'dashboard.html', 'analisis.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ]
  };
  if (!permisos[role]) return;
  document.querySelectorAll('.sidebar a').forEach(link => {
    const href = link.getAttribute('href');
    if (!permisos[role].includes(href)) {
      link.style.display = 'none';
    }
  });
});
// Notificaciones demo
const previewNotifs = [
  { icon: 'fa-clock', color: '#ffc107', text: 'Factura pendiente de pago', time: 'Hace 2h' },
  { icon: 'fa-exclamation-triangle', color: '#f44336', text: 'Factura vencida', time: 'Hace 4h' },
  { icon: 'fa-dollar-sign', color: '#1abc9c', text: 'Pago recibido', time: 'Hace 6h' }
];
const notifBell = document.querySelector('.topbar-right > span');
const notifDropdown = document.getElementById('notif-dropdown');
const notifList = document.getElementById('notif-list');
notifList.innerHTML = previewNotifs.map(n => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 18px;">
      <span style="background:${n.color}22;color:${n.color};border-radius:8px;padding:7px 9px 7px 9px;font-size:1.1rem;"><i class="fa ${n.icon}"></i></span>
      <div style="flex:1;">
        <div style="font-size:0.99rem;font-weight:600;">${n.text}</div>
        <div style="color:#888;font-size:0.93rem;">${n.time}</div>
      </div>
    </div>
  `).join('');
notifBell.onclick = (e) => {
  e.stopPropagation();
  const rect = notifBell.getBoundingClientRect();
  notifDropdown.style.top = rect.bottom + 'px';
  notifDropdown.style.right = (window.innerWidth - rect.right) + 'px';
  notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
};
document.body.addEventListener('click', () => notifDropdown.style.display = 'none');
notifDropdown.onclick = e => e.stopPropagation();
// Dropdown usuario
const userAvatar = document.querySelector('.avatar');
const userDropdown = document.getElementById('user-dropdown');
userAvatar.onclick = (e) => {
  e.stopPropagation();
  userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
  userDropdown.style.right = '0';
};
document.body.addEventListener('click', () => userDropdown.style.display = 'none');
userDropdown.onclick = e => e.stopPropagation();
document.getElementById('logout-btn').onclick = (e) => { e.preventDefault(); window.location.href = 'login.html'; };
document.getElementById('config-btn').onclick = () => { window.location.href = 'configuracion.html'; };
// Modal nueva factura
const nuevaFacturaModal = document.getElementById('nueva-factura-modal');
const addBtn = document.querySelector('.add-btn');
const closeNuevaFacturaModal = document.getElementById('close-nueva-factura-modal');
addBtn.onclick = () => { nuevaFacturaModal.style.display = 'flex'; };
closeNuevaFacturaModal.onclick = () => { nuevaFacturaModal.style.display = 'none'; };
// --- FACTURAS DEMO ---
let facturas = [
  {
    numero: 'FAC-2024-001', serie: 'A', folio: '156', cliente: 'Constructora ABC S.A.', rfc: 'ABC123456789', estado: 'Pagada', emision: '2024-01-15', vencimiento: '2024-02-14', monto: 7875, pagado: 7875, metodo: 'Transferencia', cfdi: 'G03', nota: '', contrato: 'CONT-2024-156', pagadoFecha: '2024-01-20'
  },
  {
    numero: 'FAC-2024-002', serie: 'A', folio: '157', cliente: 'Obras del Norte Ltda.', rfc: 'OBN123456789', estado: 'Pendiente', emision: '2024-01-20', vencimiento: '2024-02-04', monto: 12000, pagado: 0, metodo: 'Transferencia', cfdi: 'G03', nota: '', contrato: 'CONT-2024-157', pagadoFecha: ''
  },
  {
    numero: 'FAC-2024-003', serie: 'A', folio: '158', cliente: 'Edificaciones Sur', rfc: 'EDS123456789', estado: 'Pagada', emision: '2024-01-22', vencimiento: '2024-01-22', monto: 8500, pagado: 8500, metodo: 'Efectivo', cfdi: 'G03', nota: '', contrato: 'CONT-2024-158', pagadoFecha: '2024-01-22'
  },
  {
    numero: 'FAC-2024-004', serie: 'A', folio: '159', cliente: 'Constructora XYZ', rfc: 'XYZ123456789', estado: 'Vencida', emision: '2024-01-18', vencimiento: '2024-01-28', monto: 6150, pagado: 3075, metodo: 'Transferencia', cfdi: 'G03', nota: '', contrato: 'CONT-2024-159', pagadoFecha: '2024-01-25'
  }
];
function renderFacturas() {
  const search = document.querySelector('.filters-row input[type="text"]').value.toLowerCase();
  const estado = document.querySelector('.filters-row select').value;
  const tbody = document.querySelector('.facturas-table tbody');
  tbody.innerHTML = '';
  facturas.filter(f => {
    const matchEstado = estado === 'Todos los Estados' || f.estado === estado;
    const matchSearch =
      f.numero.toLowerCase().includes(search) ||
      f.cliente.toLowerCase().includes(search) ||
      f.rfc.toLowerCase().includes(search) ||
      f.contrato.toLowerCase().includes(search);
    return matchEstado && matchSearch;
  }).forEach((f, i) => {
    const badge = f.estado === 'Pagada' ? 'paid' : f.estado === 'Pendiente' ? 'pending' : 'expired';
    const icon = f.estado === 'Pagada' ? 'fa-check-circle' : f.estado === 'Pendiente' ? 'fa-clock' : 'fa-exclamation-triangle';
    const color = f.estado === 'Pagada' ? '#43a047' : f.estado === 'Pendiente' ? '#ffc107' : '#f44336';
    const metodo = f.metodo || '-';
    const pagadoPct = Math.round((f.pagado / f.monto) * 100);
    tbody.innerHTML += `
    <tr>
      <td><i class="fa fa-file-invoice" style="color:#2979ff"></i> ${f.numero}<br><span style="color:#888;font-size:0.95em;">${f.contrato}</span></td>
      <td><b>${f.cliente}</b><br><span style="color:#888;font-size:0.95em;">Método: ${metodo}</span></td>
      <td><span class="badge ${badge}"><i class="fa ${icon}"></i> ${f.estado}</span></td>
      <td><i class="fa fa-calendar"></i> Emisión: ${f.emision}<br><i class="fa fa-clock"></i> Vence: ${f.vencimiento}</td>
      <td>$${f.monto.toLocaleString()}</td>
      <td>$${f.pagado.toLocaleString()} <span class="progress-bar"><span class="progress" style="width:${pagadoPct}%"></span></span>${f.pagadoFecha ? `<br><span style='color:#888;font-size:0.95em;'>Pagado: ${f.pagadoFecha}</span>` : ''}</td>
      <td class="actions"><a href="#" class="descargar-factura" data-i="${i}"><i class="fa fa-download"></i></a><a href="#" class="ver-factura" data-i="${i}" style="color:${color}"><i class="fa fa-paper-plane"></i> Ver</a></td>
    </tr>
  `;
  });
  // Eventos ver y descargar
  document.querySelectorAll('.ver-factura').forEach(a => a.onclick = function (e) {
    e.preventDefault();
    const f = facturas[this.dataset.i];
    document.getElementById('ver-factura-detalle').innerHTML = `
    <b>Número:</b> ${f.numero}<br>
    <b>Serie:</b> ${f.serie}<br>
    <b>Folio:</b> ${f.folio}<br>
    <b>Cliente:</b> ${f.cliente}<br>
    <b>RFC:</b> ${f.rfc}<br>
    <b>Estado:</b> ${f.estado}<br>
    <b>Emisión:</b> ${f.emision}<br>
    <b>Vencimiento:</b> ${f.vencimiento}<br>
    <b>Monto:</b> $${f.monto.toLocaleString()}<br>
    <b>Pagado:</b> $${f.pagado.toLocaleString()}<br>
    <b>Método:</b> ${f.metodo}<br>
    <b>Uso CFDI:</b> ${f.cfdi}<br>
    <b>Contrato:</b> ${f.contrato}<br>
    <b>Nota:</b> ${f.nota || '-'}<br>
    <b>Pagado Fecha:</b> ${f.pagadoFecha || '-'}<br>
  `;
    document.getElementById('ver-factura-modal').style.display = 'flex';
  });
  document.getElementById('close-ver-factura-modal').onclick = () => document.getElementById('ver-factura-modal').style.display = 'none';
  document.querySelectorAll('.descargar-factura').forEach(a => a.onclick = function (e) {
    e.preventDefault();
    const f = facturas[this.dataset.i];
    alert('Descargar PDF para: ' + f.numero + ' (aquí se integrará la descarga)');
    // Aquí puedes integrar la lógica de generación/descarga de PDF
  });
}
document.querySelector('.filters-row input[type="text"]').addEventListener('input', renderFacturas);
document.querySelector('.filters-row select').addEventListener('change', renderFacturas);
renderFacturas();
// Al guardar nueva factura, agregar a la lista y renderizar
document.getElementById('nueva-factura-form').onsubmit = function (e) {
  e.preventDefault();
  const f = {
    numero: document.getElementById('nf-numero').value.trim(),
    serie: document.getElementById('nf-serie').value.trim(),
    folio: document.getElementById('nf-folio').value.trim(),
    cliente: document.getElementById('nf-cliente').value.trim(),
    rfc: document.getElementById('nf-rfc').value.trim(),
    estado: document.getElementById('nf-estado').value,
    emision: document.getElementById('nf-emision').value,
    vencimiento: document.getElementById('nf-vencimiento').value,
    monto: parseFloat(document.getElementById('nf-monto').value),
    pagado: parseFloat(document.getElementById('nf-pagado').value),
    metodo: document.getElementById('nf-metodo').value,
    cfdi: document.getElementById('nf-cfdi').value.trim(),
    nota: document.getElementById('nf-nota').value.trim(),
    contrato: '-',
    pagadoFecha: ''
  };
  facturas.push(f);
  renderFacturas();
  nuevaFacturaModal.style.display = 'none';
};


(function () {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const avatarImg = document.getElementById('avatar-img');
  const avatarDropdown = document.getElementById('avatar-img-dropdown');
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
  const userEmail = document.getElementById('user-email');
  const dropdown = document.getElementById('user-dropdown');
  if (user && avatarImg) {
    avatarImg.src = user.foto || 'img/default-user.png';
    avatarImg.onerror = () => { avatarImg.src = 'img/default-user.png'; };
  }
  if (user && avatarDropdown) {
    avatarDropdown.src = user.foto || 'img/default-user.png';
    avatarDropdown.onerror = () => { avatarDropdown.src = 'img/default-user.png'; };
  }
  if (userName) userName.textContent = user.nombre || '';
  if (userRole) userRole.textContent = user.rol || '';
  if (userEmail) userEmail.textContent = user.correo || '';
  if (avatarImg && dropdown) {
    avatarImg.onclick = function (e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.body.addEventListener('click', function (e) {
      if (!e.target.closest('#user-menu')) dropdown.style.display = 'none';
    });
  }
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = function (e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    };
  }
})();

document.getElementById('agregarConcepto').onclick = function () {
  const container = document.getElementById('conceptosContainer');
  const idx = container.children.length;
  container.innerHTML += `
      <div class="concepto">
        <input type="text" name="descripcion" placeholder="Descripción" required>
        <input type="number" name="cantidad" value="1" min="1" required>
        <input type="number" name="valorUnitario" step="0.01" required>
        <input type="text" name="claveProdServ" value="80141600" required>
        <input type="text" name="claveUnidad" value="E48" required>
        <input type="text" name="unidad" value="Servicio" required>
      </div>
    `;
};

document.getElementById('formEmitirFactura').onsubmit = async function (e) {
  e.preventDefault();
  const conceptos = Array.from(document.querySelectorAll('#conceptosContainer .concepto')).map(div => ({
    descripcion: div.querySelector('[name=descripcion]').value,
    cantidad: parseFloat(div.querySelector('[name=cantidad]').value),
    valorUnitario: parseFloat(div.querySelector('[name=valorUnitario]').value),
    claveProdServ: div.querySelector('[name=claveProdServ]').value,
    claveUnidad: div.querySelector('[name=claveUnidad]').value,
    unidad: div.querySelector('[name=unidad]').value
  }));
  const data = {
    receptor: {
      rfc: document.getElementById('receptorRfc').value,
      nombre: document.getElementById('receptorNombre').value,
      codigo_postal: document.getElementById('receptorCp').value,
      regimen_fiscal: document.getElementById('receptorRegimenFiscal').value
    },
    conceptos,
    formaPago: document.getElementById('formaPago').value,
    metodoPago: document.getElementById('metodoPago').value,
    usoCfdi: document.getElementById('usoCfdi').value
  };
  const mensaje = document.getElementById('mensajeFacturacion');
  mensaje.textContent = 'Timbrando...';
  try {
    const res = await fetch('/api/facturas/timbrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      mensaje.textContent = 'Factura timbrada con UUID: ' + result.uuid;
    } else {
      mensaje.textContent = 'Error: ' + (result.error || 'Error desconocido');
    }
  } catch (err) {
    mensaje.textContent = 'Error de red o servidor';
  }
};

// ===== TIMBRADO MODULE LOGIC =====

// Global state for items being billed
let conceptosFactura = [];

/**
 * Main search function triggered by the search button in Timbrado section
 */
async function buscarDocumento() {
  const query = document.getElementById('search-documento').value.trim();
  if (!query) {
    Swal.fire('Atención', 'Ingresa un folio de cotización o contrato', 'warning');
    return;
  }

  // Show loading state
  const btnSearch = document.querySelector('.btn-search');
  const originalText = btnSearch.innerHTML;
  btnSearch.disabled = true;
  btnSearch.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Buscando...';

  try {
    const token = localStorage.getItem('token');

    // Try to find as Sales Quotation first
    let response = await fetch(`/api/cotizaciones/buscar?q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      // Assuming the API returns enough info to know if it's sale or rental
      if (data.tipo === 'venta') {
        await cargarCotizacionVenta(data.id);
        btnSearch.disabled = false;
        btnSearch.innerHTML = originalText;
        return;
      }
    }

    // If not found or not sale, try as Contract (Rental/Services)
    response = await fetch(`/api/contratos/buscar?q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      await cargarContratoRenta(data.id);
    } else {
      Swal.fire('No encontrado', 'No se encontró la cotización o contrato con ese folio', 'error');
    }
  } catch (error) {
    console.error('Error buscando documento:', error);
    Swal.fire('Error', 'Hubo un problema al realizar la búsqueda', 'error');
  } finally {
    btnSearch.disabled = false;
    btnSearch.innerHTML = originalText;
  }
}

async function cargarCotizacionVenta(cotizacionId) {
  try {
    const token = localStorage.getItem('token');

    // Get products breakdown
    const response = await fetch(`/api/cotizaciones/${cotizacionId}/desglose`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al cargar cotización');

    const data = await response.json();

    // Load client info
    await cargarDatosCliente(data.cliente_id);

    // Convert quote products to billable concepts
    conceptosFactura = data.productos.map(p => ({
      clave_prodserv: p.clave_sat_productos || p.clave_prodserv || '01010101',
      cantidad: p.cantidad,
      clave_unidad: p.clave_unidad || 'H87',
      descripcion: p.descripcion || p.nombre,
      precio_unitario: p.precio_unitario,
      importe: p.cantidad * p.precio_unitario
    }));

    renderTablaConceptos();
    mostrarSeccionesResultados();

  } catch (error) {
    console.error('Error cargando cotización:', error);
    Swal.fire('Error', 'No se pudo cargar el desglose de la cotización', 'error');
  }
}

async function cargarContratoRenta(contratoId) {
  try {
    const token = localStorage.getItem('token');

    // Get contract billing summary
    const response = await fetch(`/api/contratos/${contratoId}/servicios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al cargar contrato');

    const data = await response.json();

    // Load client info
    await cargarDatosCliente(data.cliente_id);

    // For rentals, we bill a single service concept
    conceptosFactura = [{
      clave_prodserv: '72141700', // Servicios de arrendamiento
      cantidad: 1,
      clave_unidad: 'E48', // Unidad de servicio
      descripcion: data.descripcion_servicio || 'Servicio de Arrendamiento por periodo',
      precio_unitario: data.monto_total,
      importe: data.monto_total
    }];

    renderTablaConceptos();
    mostrarSeccionesResultados();

  } catch (error) {
    console.error('Error cargando contrato:', error);
    Swal.fire('Error', 'No se pudo cargar la información del contrato', 'error');
  }
}

async function cargarDatosCliente(clienteId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/clientes/${clienteId}/validar-timbrado`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al validar cliente');

    const data = await response.json();

    // Update UI
    document.getElementById('client-name').textContent = data.nombre;
    document.getElementById('client-tipo').textContent = data.tipo || 'Público en General';

    const df = data.datos_fiscales || {};
    document.getElementById('client-rfc').textContent = df.rfc || 'SIN RFC';
    document.getElementById('client-razon-social').textContent = df.nombre || 'SIN NOMBRE FISCAL';
    document.getElementById('client-cp').textContent = df.codigo_postal || '00000';
    document.getElementById('client-regimen').textContent = df.regimen_fiscal || 'SIN REGIMEN';
    document.getElementById('client-uso-cfdi').textContent = df.uso_cfdi || 'SIN USO';
    document.getElementById('client-forma-pago').textContent = df.forma_pago || 'POR DEFINIR';

    // Validate completeness
    const camposRequeridos = ['rfc', 'nombre', 'codigo_postal', 'regimen_fiscal', 'uso_cfdi'];
    const faltantes = [];

    if (!df.rfc) faltantes.push('RFC');
    if (!df.nombre) faltantes.push('Razón Social');
    if (!df.codigo_postal) faltantes.push('Código Postal');
    if (!df.regimen_fiscal) faltantes.push('Régimen Fiscal');
    if (!df.uso_cfdi) faltantes.push('Uso CFDI');

    const statusDiv = document.getElementById('validation-status');
    const btnTimbrar = document.getElementById('btn-timbrar');

    if (faltantes.length === 0) {
      statusDiv.className = 'validation-status valid';
      statusDiv.innerHTML = '<i class="fa fa-check-circle"></i> Datos fiscales completos. Listo para timbrar.';
      btnTimbrar.disabled = false;
    } else {
      statusDiv.className = 'validation-status invalid';
      statusDiv.innerHTML = `<i class="fa fa-exclamation-triangle"></i> Datos faltantes: ${faltantes.join(', ')}`;
      btnTimbrar.disabled = true;
    }

  } catch (error) {
    console.error('Error cargando datos del cliente:', error);
    mostrarError('Error al cargar datos del cliente');
  }
}

function renderTablaConceptos() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '';

  conceptosFactura.forEach((c, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
            <td><input type="text" value="${c.clave_prodserv}" onchange="updateConcepto(${index}, 'clave_prodserv', this.value)"></td>
            <td><input type="number" value="${c.cantidad}" step="0.1" onchange="updateConcepto(${index}, 'cantidad', this.value)"></td>
            <td>
                <select onchange="updateConcepto(${index}, 'clave_unidad', this.value)">
                    <option value="E48" ${c.clave_unidad === 'E48' ? 'selected' : ''}>E48 - Servicio</option>
                    <option value="H87" ${c.clave_unidad === 'H87' ? 'selected' : ''}>H87 - Pieza</option>
                    <option value="XNE" ${c.clave_unidad === 'XNE' ? 'selected' : ''}>XNE - Renta</option>
                </select>
            </td>
            <td><input type="text" value="${c.descripcion}" onchange="updateConcepto(${index}, 'descripcion', this.value)"></td>
            <td><input type="number" value="${c.precio_unitario}" step="0.01" onchange="updateConcepto(${index}, 'precio_unitario', this.value)"></td>
            <td class="amount">$${c.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td><button class="btn-delete" onclick="eliminarConcepto(${index})"><i class="fa fa-trash"></i></button></td>
        `;
    tbody.appendChild(row);
  });

  calcularTotalesFactura();
}

function updateConcepto(index, field, value) {
  let val = value;
  if (field === 'cantidad' || field === 'precio_unitario') {
    val = parseFloat(value) || 0;
  }

  conceptosFactura[index][field] = val;
  conceptosFactura[index].importe = conceptosFactura[index].cantidad * conceptosFactura[index].precio_unitario;

  renderTablaConceptos();
}

function eliminarConcepto(index) {
  conceptosFactura.splice(index, 1);
  renderTablaConceptos();
}

function agregarConceptoManual() {
  conceptosFactura.push({
    clave_prodserv: '01010101',
    cantidad: 1,
    clave_unidad: 'H87',
    descripcion: '',
    precio_unitario: 0,
    importe: 0
  });
  renderTablaConceptos();
}

function calcularTotalesFactura() {
  const subtotal = conceptosFactura.reduce((sum, c) => sum + c.importe, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  document.getElementById('subtotal-amount').textContent = `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  document.getElementById('iva-amount').textContent = `$${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  document.getElementById('total-amount').textContent = `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function mostrarSeccionesResultados() {
  document.getElementById('client-info-card').style.display = 'block';
  document.getElementById('products-table-container').style.display = 'block';
  document.getElementById('billing-summary').style.display = 'block';
}

function procesarTimbrado() {
  if (conceptosFactura.length === 0) {
    Swal.fire('Atención', 'No hay conceptos para facturar', 'warning');
    return;
  }

  Swal.fire({
    title: '¿Confirmar Timbrado?',
    text: "Se generará la factura electrónica oficial",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2979ff',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, timbrar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      ejecutarTimbrado();
    }
  });
}

async function ejecutarTimbrado() {
  // Implement logic to send data to stamping API
  Swal.fire('Procesando', 'Comunidando con el SAT...', 'info');
  // Simulated delay
  setTimeout(() => {
    Swal.fire('Éxito', 'Factura timbrada correctamente', 'success').then(() => {
      // Reset form or redirect
      location.reload();
    });
  }, 2000);
}



