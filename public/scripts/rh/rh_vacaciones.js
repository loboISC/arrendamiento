// ─────────────────────────────────────────────
//  DATOS MOCK
// ─────────────────────────────────────────────
let solicitudesVacaciones = [
    { id: 1, name: "Juan Pérez García", type: "Vacaciones", start: "2026-04-10", end: "2026-04-14", days: 5, motivo: "", status: "aprobado" },
    { id: 2, name: "María Rodríguez Sosa", type: "Permiso con goce", start: "2026-03-28", end: "2026-03-28", days: 1, motivo: "Cita médica", status: "pendiente" },
    { id: 3, name: "Roberto Sánchez Díaz", type: "Personal", start: "2026-03-20", end: "2026-03-21", days: 2, motivo: "Trámite banco", status: "rechazado" }
];

let saldosEmpleados = [
    { name: "Juan Pérez García", seniority: "2 años", daysLey: 14, taken: 5, pending: 0 },
    { name: "María Rodríguez Sosa", seniority: "1 año", daysLey: 12, taken: 0, pending: 1 },
    { name: "Roberto Sánchez Díaz", seniority: "5 años", daysLey: 20, taken: 10, pending: 0 },
    { name: "Pedro Gómez Luna", seniority: "3 años", daysLey: 16, taken: 3, pending: 0 }
];

let _tabActual = 'solicitudes';
let _idSolicitudEditando = null;
let _idAprobando = null;
let _anioCal = new Date().getFullYear();
let _mesCal = new Date().getMonth();  // 0-based

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function calcularDiasDiferencia(start, end) {
    const s = new Date(start), e = new Date(end);
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function formatearFecha(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function obtenerSaldo(name) {
    return saldosEmpleados.find(s => s.name === name);
}

function mostrarToast(msg, color = '#15803d') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = color;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function mostrarError(msg) {
    const el = document.getElementById('req_error');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

// ─────────────────────────────────────────────
//  RENDER SOLICITUDES
// ─────────────────────────────────────────────
function renderizarSolicitudes() {
    const tbody = document.getElementById('vacationTableBody');
    tbody.innerHTML = '';

    if (solicitudesVacaciones.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay solicitudes registradas.</td></tr>';
        return;
    }

    const ordenadas = [...solicitudesVacaciones].sort((a, b) => b.id - a.id);
    ordenadas.forEach(req => {
        const badgeClass = {
            pendiente: 'badge-pendiente',
            aprobado: 'badge-aprobado',
            rechazado: 'badge-rechazado',
            cancelado: 'badge-cancelado'
        }[req.status] || 'badge-pendiente';

        const label = req.status.charAt(0).toUpperCase() + req.status.slice(1);
        const esPendiente = req.status === 'pendiente';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${req.name}</strong></td>
            <td>${req.type}</td>
            <td style="white-space:nowrap">${formatearFecha(req.start)} — ${formatearFecha(req.end)}</td>
            <td style="text-align:center">${req.days}</td>
            <td style="color:var(--muted); font-size:12px;">${req.motivo || '—'}</td>
            <td><span class="badge ${badgeClass}">${label}</span></td>
            <td>
                ${esPendiente ? `<i class="fa-solid fa-circle-check action-icon" onclick="abrirAprobacion(${req.id})" title="Gestionar"></i>` : ''}
                ${esPendiente ? `<i class="fa-solid fa-ban action-icon danger" onclick="cancelarSolicitud(${req.id})" title="Cancelar"></i>` : ''}
                ${esPendiente ? `<i class="fa-solid fa-pen-to-square action-icon" onclick="abrirEditarSolicitud(${req.id})" title="Editar"></i>` : ''}
                ${!esPendiente && req.status !== 'cancelado' ? `<span style="color:var(--muted); font-size:11px;">—</span>` : ''}
            </td>`;
        tbody.appendChild(row);
    });
}

// ─────────────────────────────────────────────
//  RENDER SALDOS
// ─────────────────────────────────────────────
function renderizarSaldos() {
    const grid = document.getElementById('saldoGrid');
    grid.innerHTML = '';
    saldosEmpleados.forEach(s => {
        const balance = s.daysLey - s.taken - s.pending;
        grid.innerHTML += `
        <div class="saldo-card">
            <div class="saldo-info">
                <div class="saldo-name">${s.name}</div>
                <div class="saldo-meta">
                    <i class="fa-solid fa-calendar-check"></i> ${s.seniority} Antigüedad · 
                    <i class="fa-solid fa-scale-balanced"></i> ${s.daysLey} días de ley
                </div>
            </div>
            <div class="saldo-pills">
                <div class="pill green"><span>${balance}</span><label>Disponibles</label></div>
                <div class="pill amber"><span>${s.taken}</span><label>Usados</label></div>
                <div class="pill blue"><span>${s.pending}</span><label>Pendientes</label></div>
            </div>
            <div class="saldo-actions">
                <i class="fa-solid fa-pen-to-square action-icon" 
                   onclick="abrirAjusteSaldo('${s.name}')" 
                   title="Ajustar Saldo Manualmente" 
                   style="font-size: 18px;"></i>
            </div>
        </div>`;
    });
}

// ─────────────────────────────────────────────
//  RENDER CALENDARIO
// ─────────────────────────────────────────────
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function renderizarCalendario() {
    document.getElementById('calTitle').textContent = `${MONTHS_ES[_mesCal]} ${_anioCal}`;
    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    // Day names header
    DAYS_ES.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-day-name';
        el.textContent = d;
        grid.appendChild(el);
    });

    const primerDia = new Date(_anioCal, _mesCal, 1).getDay();
    const diasEnMes = new Date(_anioCal, _mesCal + 1, 0).getDate();
    const hoy = new Date().toISOString().slice(0, 10);

    // Empty cells
    for (let i = 0; i < primerDia; i++) {
        const el = document.createElement('div');
        el.className = 'cal-cell empty';
        grid.appendChild(el);
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const dateStr = `${_anioCal}-${String(_mesCal + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const celda = document.createElement('div');
        celda.className = 'cal-cell' + (dateStr === hoy ? ' today' : '');

        let html = `<div class="cal-num">${dia}</div>`;

        // Add events that overlap this day
        solicitudesVacaciones.forEach(req => {
            if (req.status === 'cancelado') return;
            if (dateStr >= req.start && dateStr <= req.end) {
                html += `<div class="cal-event ${req.status}" title="${req.name}">${req.name.split(' ')[0]} · ${req.type.split(' ')[0]}</div>`;
            }
        });

        celda.innerHTML = html;
        grid.appendChild(celda);
    }
}

function navegarCalendario(dir) {
    _mesCal += dir;
    if (_mesCal > 11) { _mesCal = 0; _anioCal++; }
    if (_mesCal < 0) { _mesCal = 11; _anioCal--; }
    renderizarCalendario();
}

// ─────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────
function cambiarTab(tabId) {
    _tabActual = tabId;
    ['solicitudes', 'saldos', 'calendario'].forEach(t => {
        const tab = document.getElementById(`tab-${t}`);
        const cont = document.getElementById(`content${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (tab) tab.classList.toggle('active', t === tabId);
        if (cont) cont.style.display = t === tabId ? 'block' : 'none';
    });

    if (tabId === 'saldos') renderizarSaldos();
    if (tabId === 'solicitudes') renderizarSolicitudes();
    if (tabId === 'calendario') renderizarCalendario();
}

// ─────────────────────────────────────────────
//  MODAL: Nueva / Editar Solicitud
// ─────────────────────────────────────────────
function abrirNuevaSolicitud() {
    _idSolicitudEditando = null;
    document.getElementById('reqModalTitle').textContent = 'Nueva Solicitud';
    document.getElementById('req_emp').value = '';
    document.getElementById('req_type').value = 'Vacaciones';
    document.getElementById('req_start').value = '';
    document.getElementById('req_end').value = '';
    document.getElementById('req_motivo').value = '';
    mostrarError('');
    abrirModal('requestModal');
}

function abrirEditarSolicitud(id) {
    const req = solicitudesVacaciones.find(r => r.id === id);
    if (!req) return;
    _idSolicitudEditando = id;
    document.getElementById('reqModalTitle').textContent = 'Editar Solicitud';
    document.getElementById('req_emp').value = req.name;
    document.getElementById('req_type').value = req.type;
    document.getElementById('req_start').value = req.start;
    document.getElementById('req_end').value = req.end;
    document.getElementById('req_motivo').value = req.motivo || '';
    mostrarError('');
    abrirModal('requestModal');
}

function guardarSolicitud() {
    const name = document.getElementById('req_emp').value;
    const type = document.getElementById('req_type').value;
    const start = document.getElementById('req_start').value;
    const end = document.getElementById('req_end').value;
    const motivo = document.getElementById('req_motivo').value.trim();

    // Validaciones
    if (!name || !start || !end) { mostrarError('⚠ Todos los campos obligatorios deben estar completos.'); return; }
    if (end < start) { mostrarError('⚠ La fecha fin no puede ser anterior a la fecha inicio.'); return; }

    const days = calcularDiasDiferencia(start, end);

    // Validar saldo si son vacaciones
    if (type === 'Vacaciones') {
        const saldo = obtenerSaldo(name);
        if (saldo) {
            const available = saldo.daysLey - saldo.taken - saldo.pending;
            if (days > available) {
                mostrarError(`❌ Días insuficientes. ${name} solo tiene ${available} días disponibles.`);
                return;
            }
        }
    }

    // Cruce de fechas
    const overlap = solicitudesVacaciones.find(r =>
        r.id !== _idSolicitudEditando &&
        r.name === name &&
        r.status !== 'rechazado' && r.status !== 'cancelado' &&
        !(end < r.start || start > r.end)
    );
    if (overlap) {
        mostrarError(`❌ Ya existe una solicitud para ${name} en esas fechas.`);
        return;
    }

    if (_idSolicitudEditando) {
        const req = solicitudesVacaciones.find(r => r.id === _idSolicitudEditando);
        Object.assign(req, { name, type, start, end, days, motivo });
        mostrarToast('✔ Solicitud actualizada.');
    } else {
        solicitudesVacaciones.unshift({
            id: Date.now(), name, type, start, end, days, motivo, status: 'pendiente'
        });
        // Actualizar pendientes en saldo
        const saldo = obtenerSaldo(name);
        if (saldo) saldo.pending += days;
        mostrarToast('✔ Solicitud creada — estado: Pendiente.');
    }

    cerrarModal('requestModal');
    renderizarSolicitudes();
}

// ─────────────────────────────────────────────
//  MODAL: Aprobar / Rechazar
// ─────────────────────────────────────────────
let _accionPendiente = null; // 'approve' | 'reject'

function abrirAprobacion(id) {
    const req = solicitudesVacaciones.find(r => r.id === id);
    if (!req) return;
    _idAprobando = id;
    _accionPendiente = null;
    document.getElementById('approveTitle').textContent = 'Gestionar solicitud';
    document.getElementById('approveSub').textContent =
        `${req.name} · ${req.type} · ${formatearFecha(req.start)} — ${formatearFecha(req.end)} (${req.days} días)`;
    document.getElementById('motivoRechazoWrap').style.display = 'none';
    document.getElementById('motivoRechazo').value = '';
    document.getElementById('btnAprobar').style.display = 'inline-flex';
    document.getElementById('btnRechazar').style.display = 'inline-flex';
    abrirModal('approveModal');
}

function mostrarInputRechazo() {
    _accionPendiente = 'reject';
    document.getElementById('motivoRechazoWrap').style.display = 'block';
    document.getElementById('btnAprobar').style.display = 'none';
    document.getElementById('btnRechazar').textContent = 'Confirmar rechazo';
    document.getElementById('btnRechazar').onclick = confirmarRechazo;
}

function confirmarAprobacion() {
    const req = solicitudesVacaciones.find(r => r.id === _idAprobando);
    if (!req) return;
    req.status = 'aprobado';

    const saldo = obtenerSaldo(req.name);
    if (saldo) {
        saldo.pending = Math.max(0, saldo.pending - req.days);
        if (req.type === 'Vacaciones' || req.type === 'Permiso con goce') {
            saldo.taken += req.days;
        }
    }

    cerrarModal('approveModal');
    renderizarSolicitudes();
    mostrarToast(`✔ Solicitud de ${req.name} aprobada.`);
}

function confirmarRechazo() {
    const motivo = document.getElementById('motivoRechazo').value.trim();
    if (!motivo) { document.getElementById('motivoRechazo').focus(); return; }
    const req = solicitudesVacaciones.find(r => r.id === _idAprobando);
    if (!req) return;
    req.status = 'rechazado';
    req.motivoRechazo = motivo;

    const saldo = obtenerSaldo(req.name);
    if (saldo) saldo.pending = Math.max(0, saldo.pending - req.days);

    cerrarModal('approveModal');
    renderizarSolicitudes();
    mostrarToast(`Solicitud rechazada. Motivo guardado.`, '#dc2626');
}

// ─────────────────────────────────────────────
//  CANCELAR (por empleado / RH)
// ─────────────────────────────────────────────
function cancelarSolicitud(id) {
    const req = solicitudesVacaciones.find(r => r.id === id);
    if (!req) return;
    req.status = 'cancelado';
    const saldo = obtenerSaldo(req.name);
    if (saldo) saldo.pending = Math.max(0, saldo.pending - req.days);
    renderizarSolicitudes();
    mostrarToast('Solicitud cancelada.', '#64748b');
}

// ─────────────────────────────────────────────
//  UTILS: abrir / cerrar modales
// ─────────────────────────────────────────────
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

// ─────────────────────────────────────────────
//  AJUSTE DE SALDO (RH)
// ─────────────────────────────────────────────
let _empleadoAjustando = null;

function abrirAjusteSaldo(name) {
    const saldo = obtenerSaldo(name);
    if (!saldo) return;
    _empleadoAjustando = name;

    document.getElementById('adjustSaldoSub').textContent = name;
    document.getElementById('adj_ley').value = saldo.daysLey;
    document.getElementById('adj_taken').value = saldo.taken;
    document.getElementById('adj_pending').value = saldo.pending;

    abrirModal('adjustSaldoModal');
}

function guardarAjusteSaldo() {
    const saldo = obtenerSaldo(_empleadoAjustando);
    if (!saldo) return;

    saldo.daysLey = parseInt(document.getElementById('adj_ley').value) || 0;
    saldo.taken = parseInt(document.getElementById('adj_taken').value) || 0;
    // pending no se edita manualmente normalmente porque depende de solicitudes reales, 
    // pero si RH quiere forzarlo podría habilitarse. De momento solo lectura.

    cerrarModal('adjustSaldoModal');
    renderizarSaldos();
    mostrarToast(`✔ Saldo actualizado para ${_empleadoAjustando}`);
}

// Cerrar al hacer clic en overlay
['requestModal', 'approveModal', 'adjustSaldoModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) cerrarModal(id); });
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
renderizarSolicitudes();
