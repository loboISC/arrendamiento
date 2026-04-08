// ─────────────────────────────────────────────
//  VACACIONES Y PERMISOS - INTEGRACIÓN API
// ─────────────────────────────────────────────

const API = '/api/rh';
const API_AUTH = '/api/auth';
let solicitudes = [];
let saldos = [];
let empleados = [];

let _tabActual = 'solicitudes';
let _idSolicitudEditando = null;
let _idAprobando = null;
let _idEmpleadoAjuste = null;
let _anioCal = new Date().getFullYear();
let _mesCal = new Date().getMonth();

// ─────────────────────────────────────────────
//  CARGA INICIAL
// ─────────────────────────────────────────────

async function cargarDatosIniciales() {
    try {
        const [resSol, resEmp] = await Promise.all([
            fetch(`${API}/vacaciones`).then(r => r.json()),
            fetch(`${API}/empleados`).then(r => r.json())
        ]);
        solicitudes = Array.isArray(resSol) ? resSol : [];
        empleados = Array.isArray(resEmp) ? resEmp : [];
        renderizarSolicitudes();
    } catch (err) {
        console.error('Error al cargar datos:', err);
    }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function calcularDiasDiferencia(start, end) {
    const s = new Date(start), e = new Date(end);
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function formatearFecha(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
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

    if (solicitudes.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay solicitudes registradas.</td></tr>';
        return;
    }

    solicitudes.forEach(req => {
        const badgeClass = {
            'Pendiente': 'badge-pendiente',
            'Aprobado': 'badge-aprobado',
            'Rechazado': 'badge-rechazado',
            'Cancelado': 'badge-cancelado'
        }[req.status] || 'badge-pendiente';

        const esPendiente = req.status === 'Pendiente';
        const nombreCompleto = `${req.nombre} ${req.apellidos || ''}`.trim();

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${nombreCompleto}</strong></td>
            <td>${req.tipo}</td>
            <td style="white-space:nowrap">${formatearFecha(req.fecha_inicio)} — ${formatearFecha(req.fecha_fin)}</td>
            <td style="text-align:center">${req.dias_solicitados}</td>
            <td style="color:var(--muted); font-size:12px;">${req.motivo || '—'}</td>
            <td><span class="badge ${badgeClass}">${req.status}</span></td>
            <td>
                ${esPendiente ? `<i class="fa-solid fa-circle-check action-icon" onclick="abrirAprobacion(${req.id})" title="Gestionar"></i>` : ''}
                ${esPendiente ? `<i class="fa-solid fa-ban action-icon danger" onclick="cancelarSolicitud(${req.id})" title="Cancelar"></i>` : ''}
                ${!esPendiente && req.status !== 'Cancelado' ? `<span style="color:var(--muted); font-size:11px;">—</span>` : ''}
            </td>`;
        tbody.appendChild(row);
    });
}

// ─────────────────────────────────────────────
//  RENDER SALDOS
// ─────────────────────────────────────────────

async function renderizarSaldos() {
    const grid = document.getElementById('saldoGrid');
    grid.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">Calculando saldos...</div>';
    
    try {
        saldos = await fetch(`${API}/vacaciones/saldos`).then(r => r.json());
        if (!Array.isArray(saldos)) { grid.innerHTML = '<p>Error al cargar saldos</p>'; return; }
        
        grid.innerHTML = '';
        saldos.forEach(s => {
            const card = document.createElement('div');
            card.className = 'saldo-card';
            card.innerHTML = `
                <div class="saldo-info">
                    <div class="saldo-name">${s.nombre}</div>
                    <div class="saldo-meta">
                        <i class="fa-solid fa-calendar-day"></i> ${s.antiguedad} · 
                        <i class="fa-solid fa-scale-balanced"></i> ${s.dias_ley} días de ley
                        ${s.dias_ajuste !== 0 ? ` · <span style="color:var(--primary)">(${s.dias_ajuste > 0 ? '+' : ''}${s.dias_ajuste} ajuste)</span>` : ''}
                    </div>
                </div>
                <div class="saldo-pills">
                    <div class="pill green"><span>${s.dias_disponibles}</span><label>Disponibles</label></div>
                    <div class="pill amber"><span>${s.dias_usados}</span><label>Usados</label></div>
                    <div class="pill blue"><span>${s.dias_pendientes}</span><label>Pendientes</label></div>
                </div>
                <div class="saldo-actions">
                    <i class="fa-solid fa-pencil action-icon" title="Ajuste Manual" onclick="solicitarAccesoAjuste('${s.empleado_id}', '${s.nombre}')"></i>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch(err) {
        console.error('Error renderizarSaldos:', err);
        grid.innerHTML = '<p style="text-align:center; color:var(--muted);">Error al cargar saldos</p>';
    }
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

    DAYS_ES.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-day-name';
        el.textContent = d;
        grid.appendChild(el);
    });

    const primerDia = new Date(_anioCal, _mesCal, 1).getDay();
    const diasEnMes = new Date(_anioCal, _mesCal + 1, 0).getDate();
    const hoy = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < primerDia; i++) {
        const el = document.createElement('div');
        el.className = 'cal-cell empty';
        grid.appendChild(el);
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fullDate = new Date(_anioCal, _mesCal, dia);
        const dateStr = fullDate.toISOString().split('T')[0];
        const celda = document.createElement('div');
        celda.className = 'cal-cell' + (dateStr === hoy ? ' today' : '');
        celda.onclick = () => abrirNuevaSolicitud(dateStr);

        let html = `<div class="cal-num">${dia}</div>`;

        solicitudes.forEach(req => {
            if (req.status === 'Cancelado' || req.status === 'Rechazado') return;
            
            // Normalizar fechas de la solicitud a YYYY-MM-DD
            const inicio = new Date(req.fecha_inicio).toISOString().split('T')[0];
            const fin = new Date(req.fecha_fin).toISOString().split('T')[0];
            
            if (dateStr >= inicio && dateStr <= fin) {
                const statusClass = req.status === 'Aprobado' ? 'aprobado' : 'pendiente';
                const nombre = `${req.nombre || ''} ${req.apellidos || ''}`.trim().split(' ')[0];
                html += `<div class="cal-event ${statusClass}" title="${nombre} - ${req.tipo}">${nombre} · ${req.tipo.charAt(0)}</div>`;
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
//  MODAL: Nueva Solicitud
// ─────────────────────────────────────────────

function abrirNuevaSolicitud(fechaPrevia = null) {
    _idSolicitudEditando = null;
    document.getElementById('reqModalTitle').textContent = 'Nueva Solicitud';
    
    const sel = document.getElementById('req_emp');
    sel.innerHTML = '<option value="">Seleccionar empleado...</option>';
    empleados.forEach(e => {
        sel.innerHTML += `<option value="${e.id}">${e.nombre} ${e.apellidos || ''}</option>`;
    });

    document.getElementById('req_type').value = 'Vacaciones';
    document.getElementById('req_start').value = fechaPrevia || '';
    document.getElementById('req_end').value = fechaPrevia || '';
    document.getElementById('req_motivo').value = '';
    mostrarError('');
    abrirModal('requestModal');
}

async function guardarSolicitud() {
    const empleado_id = document.getElementById('req_emp').value;
    const tipo = document.getElementById('req_type').value;
    const fecha_inicio = document.getElementById('req_start').value;
    const fecha_fin = document.getElementById('req_end').value;
    const motivo = document.getElementById('req_motivo').value.trim();

    if (!empleado_id || !fecha_inicio || !fecha_fin) {
        mostrarError('⚠ Todos los campos obligatorios deben estar completos.');
        return;
    }
    if (fecha_fin < fecha_inicio) {
        mostrarError('⚠ La fecha fin no puede ser anterior a la fecha inicio.');
        return;
    }

    const dias_solicitados = calcularDiasDiferencia(fecha_inicio, fecha_fin);

    try {
        const res = await fetch(`${API}/vacaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: _idSolicitudEditando,
                empleado_id, tipo, fecha_inicio, fecha_fin, dias_solicitados, motivo
            })
        });

        if (res.ok) {
            showToast('✔ Solicitud creada — estado: Pendiente.');
            cerrarModal('requestModal');
            // Recargar solicitudes
            solicitudes = await fetch(`${API}/vacaciones`).then(r => r.json());
            renderizarSolicitudes();
        } else {
            const data = await res.json();
            mostrarError(data.error || 'Error al guardar');
        }
    } catch(err) {
        mostrarError('Error de conexión');
    }
}

// ─────────────────────────────────────────────
//  APROBAR / RECHAZAR / CANCELAR
// ─────────────────────────────────────────────

function abrirAprobacion(id) {
    const req = solicitudes.find(r => r.id === id);
    if (!req) return;
    _idAprobando = id;
    const nombre = `${req.nombre} ${req.apellidos || ''}`.trim();
    document.getElementById('approveTitle').textContent = 'Gestionar solicitud';
    document.getElementById('approveSub').textContent =
        `${nombre} · ${req.tipo} · ${formatearFecha(req.fecha_inicio)} — ${formatearFecha(req.fecha_fin)} (${req.dias_solicitados} días)`;
    document.getElementById('motivoRechazoWrap').style.display = 'none';
    document.getElementById('motivoRechazo').value = '';
    document.getElementById('btnAprobar').style.display = 'inline-flex';
    document.getElementById('btnRechazar').style.display = 'inline-flex';
    document.getElementById('btnRechazar').innerHTML = '<i class="fa-solid fa-xmark"></i> Rechazar';
    document.getElementById('btnRechazar').onclick = mostrarInputRechazo;
    abrirModal('approveModal');
}

function mostrarInputRechazo() {
    document.getElementById('motivoRechazoWrap').style.display = 'block';
    document.getElementById('btnAprobar').style.display = 'none';
    document.getElementById('btnRechazar').textContent = 'Confirmar rechazo';
    document.getElementById('btnRechazar').onclick = confirmarRechazo;
}

async function confirmarAprobacion() {
    try {
        await fetch(`${API}/vacaciones/${_idAprobando}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Aprobado' })
        });
        cerrarModal('approveModal');
        solicitudes = await fetch(`${API}/vacaciones`).then(r => r.json());
        renderizarSolicitudes();
        showToast('✔ Solicitud aprobada.');
    } catch(err) {
        showToast('Error al aprobar', 'error');
    }
}

async function confirmarRechazo() {
    const motivo = document.getElementById('motivoRechazo').value.trim();
    if (!motivo) { document.getElementById('motivoRechazo').focus(); return; }
    try {
        await fetch(`${API}/vacaciones/${_idAprobando}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Rechazado', motivo_rechazo: motivo })
        });
        cerrarModal('approveModal');
        solicitudes = await fetch(`${API}/vacaciones`).then(r => r.json());
        renderizarSolicitudes();
        showToast('Solicitud rechazada.', 'error');
    } catch(err) {
        showToast('Error al rechazar', 'error');
    }
}

async function cancelarSolicitud(id) {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try {
        await fetch(`${API}/vacaciones/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Cancelado' })
        });
        solicitudes = await fetch(`${API}/vacaciones`).then(r => r.json());
        renderizarSolicitudes();
        showToast('Solicitud cancelada.', 'info');
    } catch(err) {
        showToast('Error al cancelar', 'error');
    }
}

// ─────────────────────────────────────────────
//  AJUSTES MANUALES Y SEGURIDAD
// ─────────────────────────────────────────────

function solicitarAccesoAjuste(id, nombre) {
    _idEmpleadoAjuste = id;
    document.getElementById('adjustSaldoTitle').textContent = `Ajustar Saldo: ${nombre}`;
    document.getElementById('adjustSaldoSub').textContent = 'Se requiere autorización de administrador.';
    document.getElementById('admin_password').value = '';
    document.getElementById('pass_error').style.display = 'none';
    
    // Configurar el botón de confirmar en el modal de password
    document.getElementById('btnConfirmarPass').onclick = verificarPassAdmin;
    
    abrirModal('passwordModal');
}

async function verificarPassAdmin() {
    const password = document.getElementById('admin_password').value;
    const btn = document.getElementById('btnConfirmarPass');
    const errDiv = document.getElementById('pass_error');

    if (!password) return;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';
        
        const resp = await fetch(`${API_AUTH}/verify-admin-password`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password })
        });
        
        const data = await resp.json();
        
        if (data.valid) {
            cerrarModal('passwordModal');
            cargarHistorialYAbrirAjuste();
        } else {
            errDiv.textContent = 'Contraseña incorrecta o permisos insuficientes.';
            errDiv.style.display = 'block';
            document.getElementById('admin_password').value = '';
        }
    } catch (err) {
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Confirmar';
    }
}

async function cargarHistorialYAbrirAjuste() {
    try {
        const resp = await fetch(`${API}/vacaciones/${_idEmpleadoAjuste}/ajustes`);
        const ajustes = await resp.json();
        
        const tbody = document.getElementById('ajustesHistoryBody');
        tbody.innerHTML = '';
        
        if (ajustes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin historial de ajustes.</td></tr>';
        } else {
            ajustes.forEach(a => {
                const fecha = new Date(a.fecha).toLocaleDateString();
                const clase = a.cantidad > 0 ? 'color:green' : 'color:red';
                tbody.innerHTML += `
                    <tr>
                        <td>${fecha}</td>
                        <td style="font-weight:bold; ${clase}">${a.cantidad > 0 ? '+' : ''}${a.cantidad}</td>
                        <td>${a.motivo}</td>
                        <td>${a.usuario || 'Admin'}</td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('adj_cantidad').value = '';
        document.getElementById('adj_motivo').value = '';
        abrirModal('adjustSaldoModal');
    } catch (err) {
        showToast('Error al cargar historial', 'error');
    }
}

async function guardarAjusteSaldo() {
    const cantidad = parseInt(document.getElementById('adj_cantidad').value);
    const motivo = document.getElementById('adj_motivo').value.trim();

    if (isNaN(cantidad) || !motivo) {
        showToast('Completa los campos obligatorios', 'warning');
        return;
    }

    try {
        const resp = await fetch(`${API}/vacaciones/ajuste`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                empleado_id: _idEmpleadoAjuste,
                cantidad,
                motivo
            })
        });

        if (resp.ok) {
            showToast('✔ Ajuste aplicado correctamente');
            cerrarModal('adjustSaldoModal');
            renderizarSaldos(); // Recargar la lista
        } else {
            showToast('Error al guardar ajuste', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

['requestModal', 'approveModal', 'adjustSaldoModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) cerrarModal(id); });
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
});
