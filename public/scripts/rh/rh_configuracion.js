// ─────────────────────────────────────────────
//  DATOS MOCK: CONFIGURACIÓN ERP PRO
// ─────────────────────────────────────────────

let departamentos = [
    { id: 1, nombre: "Operaciones", responsable: "Juan Pérez García", empleados: 15, estatus: "Activo", fechaCreacion: "2024-01-10", kpiAsist: 94, retardos: 4 },
    { id: 2, nombre: "Ventas", responsable: "María Rodríguez Sosa", empleados: 5, estatus: "Activo", fechaCreacion: "2024-02-15", kpiAsist: 98, retardos: 1 },
    { id: 3, nombre: "Administración", responsable: "Roberto Sánchez Díaz", empleados: 3, estatus: "Activo", fechaCreacion: "2024-01-05", kpiAsist: 100, retardos: 0 }
];

let puestos = [
    { id: 1, nombre: "Chofer", departamento: "Operaciones", nivel: "Operativo", sueldoBase: 12000, estatus: "Activo" },
    { id: 2, nombre: "Técnico Especialista", departamento: "Operaciones", nivel: "Senior", sueldoBase: 18000, estatus: "Activo" },
    { id: 3, nombre: "Auxiliar Contable", departamento: "Administración", nivel: "Junior", sueldoBase: 10000, estatus: "Activo" }
];

let turnos = [
    { id: 1, nombre: "Matutino", entrada: "08:00", salida: "18:00", dias: "L-V", estatus: "Activo" },
    { id: 2, nombre: "Vespertino", entrada: "14:00", salida: "22:00", dias: "L-S", estatus: "Activo" },
    { id: 3, nombre: "Nocturno", entrada: "22:00", salida: "06:00", dias: "L-V", estatus: "Inactivo" }
];

let reglasAsistencia = {
    tolerancia: 5,
    umbralRetardo: 15,
    entradaEstandar: "08:00",
    salidaEstandar: "18:00"
};

let politicasVacaciones = {
    diasAño1: 12,
    acumulacion: true,
    maxSeguidos: 10,
    anticipacionDias: 15
};

let historialCambios = [
    { id: 1, fecha: "2026-03-25 10:30", usuario: "Admin", accion: "Cambio de responsable en Ventas", t: "info" },
    { id: 2, fecha: "2026-03-26 09:15", usuario: "Admin", accion: "Creación de depto: Operaciones", t: "success" }
];

// Mock Empleados para Cumpleaños y Cultura
let cumpleanos = [
    { id: 101, nombre: "Juan Pérez García", dia: "27", mes: "03", puesto: "Chofer", img: "https://i.pravatar.cc/150?u=1" },
    { id: 102, nombre: "María Rodríguez Sosa", dia: "28", mes: "03", puesto: "Administrativo", img: "https://i.pravatar.cc/150?u=2" },
    { id: 103, nombre: "Roberto Sánchez Díaz", dia: "15", mes: "04", puesto: "Ventas", img: "https://i.pravatar.cc/150?u=3" },
    { id: 104, nombre: "Ana Guevara", dia: "01", mes: "04", puesto: "Técnico", img: "https://i.pravatar.cc/150?u=4" }
];

let _idGlobal = null;

// ─────────────────────────────────────────────
//  CORE & NAVEGACIÓN
// ─────────────────────────────────────────────

function cambiarSeccion(sec) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[onclick*="'${sec}'"]`);
    if(navItem) navItem.classList.add('active');

    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    const target = document.getElementById(`sec-${sec}`);
    if(target) target.style.display = 'block';

    if(sec === 'deptos') renderizarDeptos();
    if(sec === 'puestos') renderizarPuestos();
    if(sec === 'turnos') renderizarTurnos();
    if(sec === 'cumpleanos') renderizarCumpleanos();
    if(sec === 'asistencia') cargarReglasAsistencia();
    if(sec === 'politicas') cargarPoliticasVacaciones();
    if(sec === 'historial') renderizarHistorial();
    
    actualizarDashboard(sec);
}

function actualizarDashboard(sec) {
    const stats = {
        deptos: { val: departamentos.length, label: 'Departamentos' },
        puestos: { val: puestos.length, label: 'Puestos' },
        turnos: { val: turnos.filter(t => t.estatus === 'Activo').length, label: 'Turnos Activos' }
    };
    document.getElementById('stat-main-val').textContent = stats[sec]?.val || departamentos.length;
    document.getElementById('stat-main-label').textContent = stats[sec]?.label || 'Departamentos';
}

// ─────────────────────────────────────────────
//  EL ORO: DETALLE DASHBOARD
// ─────────────────────────────────────────────

function abrirDetalleDepto(id) {
    const depto = departamentos.find(d => d.id === id);
    if(!depto) return;
    _idGlobal = id;

    document.getElementById('det-nombre').textContent = depto.nombre;
    document.getElementById('det-responsable').textContent = depto.responsable;
    document.getElementById('det-total-emp').textContent = depto.empleados;
    document.getElementById('kpi-asistencia').textContent = depto.kpiAsist + "%";
    document.getElementById('kpi-retardos').textContent = depto.retardos;

    const tbody = document.getElementById('det-emps-list');
    tbody.innerHTML = '';
    const filtered = empsMock.filter(e => e.depto === depto.nombre);
    filtered.forEach(e => {
        tbody.innerHTML += `
            <tr class="hover-row">
                <td><strong>${e.nombre}</strong><br><small>${e.puesto}</small></td>
                <td><span class="badge ${e.estado === 'Asistió' ? 'badge-active' : 'badge-inactive'}">${e.estado}</span></td>
                <td style="text-align:right;">
                    <i class="fa-solid fa-right-from-bracket action-icon danger" onclick="desvincularEmpleado(${e.id})" title="Sacar del área"></i>
                </td>
            </tr>
        `;
    });

    abrirModal('modalDetalleDepto');
}

function desvincularEmpleado(id) {
    const e = empsMock.find(x => x.id === id);
    if(!confirm(`¿Retirar a ${e.nombre} de su área?`)) return;
    const d = departamentos.find(x => x.nombre === e.depto);
    if(d) d.empleados--;
    e.depto = "Sin Asignar";
    registrarCambio(`Baja de área: ${e.nombre}`);
    abrirDetalleDepto(_idGlobal);
    renderizarDeptos();
    mostrarNotificacion("Empleado desvinculado");
}

function abrirVincularEmpleado() {
    const nombre = prompt("Nombre del empleado:");
    if(!nombre) return;
    const depto = departamentos.find(d => d.id === _idGlobal);
    depto.empleados++;
    empsMock.push({ id: Date.now(), nombre, puesto: "Nuevo", depto: depto.nombre, estado: "Asistió" });
    registrarCambio(`Alta en área: ${nombre}`);
    abrirDetalleDepto(_idGlobal);
    renderizarDeptos();
}

function cambiarTabDetalle(tab) {
    document.querySelectorAll('.det-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.det-tab[onclick*="'${tab}'"]`).classList.add('active');
    document.querySelectorAll('.det-panel').forEach(p => p.style.display = 'none');
    document.getElementById(`det-panel-${tab}`).style.display = 'block';
}

// ─────────────────────────────────────────────
//  RENDERS SECCIONES
// ─────────────────────────────────────────────

function renderizarDeptos() {
    const tbody = document.getElementById('deptosTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    departamentos.forEach(d => {
        tbody.innerHTML += `
            <tr class="hover-row">
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="icon-circle"><i class="fa-solid fa-building"></i></div>
                        <div><div style="font-weight:700;">${d.nombre}</div><div style="font-size:11px; color:var(--muted);">ID: #${d.id}</div></div>
                    </div>
                </td>
                <td><div style="font-weight:600;">${d.responsable}</div><div style="font-size:11px; color:var(--muted);">Responsable</div></td>
                <td><span class="badge-count"><i class="fa-solid fa-users"></i> ${d.empleados}</span></td>
                <td><span class="badge ${d.estatus === 'Activo' ? 'badge-active' : 'badge-inactive'}">${d.estatus}</span></td>
                <td style="text-align:right;"><button class="btn-icon" onclick="verMenuContextual(event, ${d.id}, 'depto')"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
            </tr>
        `;
    });
}

function renderizarPuestos() {
    const tbody = document.getElementById('puestosTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    puestos.forEach(p => {
        tbody.innerHTML += `
            <tr class="hover-row">
                <td><strong>${p.nombre}</strong></td>
                <td><span class="depto-tag">${p.departamento}</span></td>
                <td>${p.nivel}</td>
                <td>$${p.sueldoBase.toLocaleString()}</td>
                <td><span class="badge ${p.estatus === 'Activo' ? 'badge-active' : 'badge-inactive'}">${p.estatus}</span></td>
                <td style="text-align:right;"><button class="btn-icon" onclick="verMenuContextual(event, ${p.id}, 'puesto')"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
            </tr>
        `;
    });
}

function renderizarTurnos() {
    const tbody = document.getElementById('turnosTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    turnos.forEach(t => {
        tbody.innerHTML += `
            <tr class="hover-row">
                <td><div style="font-weight:700;">${t.nombre}</div><div style="font-size:11px; color:var(--muted);">${t.dias}</div></td>
                <td><div style="font-size:14px; font-weight:600;"><i class="fa-regular fa-clock"></i> ${t.entrada} - ${t.salida}</div></td>
                <td><span class="badge ${t.estatus === 'Activo' ? 'badge-active' : 'badge-inactive'}">${t.estatus}</span></td>
                <td style="text-align:right;"><button class="btn-icon" onclick="verMenuContextual(event, ${t.id}, 'turno')"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
            </tr>
        `;
    });
}

// ─────────────────────────────────────────────
//  AUDITORÍA / REGLAS
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  CULTURA Y CUMPLEAÑOS
// ─────────────────────────────────────────────

function renderizarCumpleanos() {
    const today = new Date();
    const currentDay = today.getDate().toString().padStart(2, '0');
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');

    const tbody = document.getElementById('proximosCumplesTable');
    tbody.innerHTML = '';

    // Ordenar por día
    const mesActual = cumpleanos.filter(c => c.mes === currentMonth)
        .sort((a, b) => parseInt(a.dia) - parseInt(b.dia));

    if(mesActual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No hay cumpleaños registrados para este mes.</td></tr>';
        return;
    }

    mesActual.forEach(c => {
        const esHoy = c.dia === currentDay;
        tbody.innerHTML += `
            <tr class="${esHoy ? 'bg-highlight' : 'hover-row'}">
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--primary);">
                            ${c.nombre.charAt(0)}
                        </div>
                        <strong>${c.nombre}</strong>
                    </div>
                </td>
                <td><span class="badge-count">${c.dia} de Marzo</span></td>
                <td>${c.puesto}</td>
                <td>
                    ${esHoy 
                        ? '<span class="badge" style="background:rgba(27,60,94,0.1); color:var(--primary);"><i class="fa-solid fa-cake-candles"></i> ¡ES HOY!</span>' 
                        : '<span style="color:var(--muted); font-size:12px;">Próximamente</span>'}
                </td>
            </tr>
        `;
    });
}

function renderizarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    historialCambios.slice().reverse().forEach(h => {
        tbody.innerHTML += `<tr><td>${h.fecha}</td><td><strong>${h.usuario}</strong></td><td>${h.accion}</td><td><i class="fa-solid fa-circle" style="font-size:8px; color:var(--primary); margin-right:8px;"></i>Auditado</td></tr>`;
    });
}

function cargarReglasAsistencia() {
    document.getElementById('as_tolerancia').value = reglasAsistencia.tolerancia;
    document.getElementById('as_umbral').value = reglasAsistencia.umbralRetardo;
    document.getElementById('as_entrada').value = reglasAsistencia.entradaEstandar;
    document.getElementById('as_salida').value = reglasAsistencia.salidaEstandar;
}

function guardarReglasAsistencia() {
    reglasAsistencia.tolerancia = parseInt(document.getElementById('as_tolerancia').value);
    reglasAsistencia.umbralRetardo = parseInt(document.getElementById('as_umbral').value);
    reglasAsistencia.entradaEstandar = document.getElementById('as_entrada').value;
    reglasAsistencia.salidaEstandar = document.getElementById('as_salida').value;
    registrarCambio(`Actualización de reglas de asistencia globales`);
    mostrarNotificacion("Reglas actualizadas correctamente");
}

function cargarPoliticasVacaciones() {
    document.getElementById('vac_dias').value = politicasVacaciones.diasAño1;
    document.getElementById('vac_acum').checked = politicasVacaciones.acumulacion;
    document.getElementById('vac_max').value = politicasVacaciones.maxSeguidos;
    document.getElementById('vac_anticipacion').value = politicasVacaciones.anticipacionDias;
}

function guardarPoliticasVacaciones() {
    politicasVacaciones.diasAño1 = parseInt(document.getElementById('vac_dias').value);
    politicasVacaciones.maxSeguidos = parseInt(document.getElementById('vac_max').value);
    politicasVacaciones.anticipacionDias = parseInt(document.getElementById('vac_anticipacion').value);
    politicasVacaciones.acumulacion = document.getElementById('vac_acum').checked;
    registrarCambio(`Actualización de políticas de vacaciones`);
    mostrarNotificacion("Políticas actualizadas correctamente");
}

// ─────────────────────────────────────────────
//  ACCIONES & MODALES
// ─────────────────────────────────────────────

function registrarCambio(accion) {
    historialCambios.push({ id: Date.now(), fecha: new Date().toLocaleString(), usuario: "Admin", accion });
}

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }
function mostrarNotificacion(m) { if(window.parent?.mostrarToast) window.parent.mostrarToast(m); else alert(m); }

function guardarDepto() {
    const deptoOriginal = departamentos.find(d => d.id === _idGlobal);
    const nuevoNombre = document.getElementById('d_nombre').value;
    const nuevoResp = document.getElementById('d_responsable').value;
    const nuevoEst = document.getElementById('d_estatus').value;

    if(_idGlobal) {
        const d = departamentos.find(x => x.id === _idGlobal);
        d.nombre = nuevoNombre;
        d.responsable = nuevoResp;
        d.estatus = nuevoEst;
        registrarCambio(`Edición de depto: ${nuevoNombre}`);
    } else {
        departamentos.push({ id: Date.now(), nombre: nuevoNombre, responsable: nuevoResp, empleados: 0, estatus: "Activo", kpiAsist: 100, retardos: 0 });
        registrarCambio(`Nuevo depto: ${nuevoNombre}`);
    }
    cerrarModal('modalDepto'); renderizarDeptos(); mostrarNotificacion("Guardado"); _idGlobal = null;
}

function guardarPuesto() {
    puestos.push({ id: Date.now(), nombre: document.getElementById('p_nombre').value, departamento: document.getElementById('p_depto').value, nivel: document.getElementById('p_nivel').value, sueldoBase: parseInt(document.getElementById('p_sueldo').value), estatus: "Activo" });
    registrarCambio(`Nuevo puesto: ${document.getElementById('p_nombre').value}`);
    cerrarModal('modalPuesto'); renderizarPuestos(); mostrarNotificacion("Puesto creado");
}

function guardarTurno() {
    turnos.push({ id: Date.now(), nombre: document.getElementById('t_nombre').value, entrada: document.getElementById('t_entrada').value, salida: document.getElementById('t_salida').value, dias: document.getElementById('t_dias').value, estatus: "Activo" });
    registrarCambio(`Nuevo turno: ${document.getElementById('t_nombre').value}`);
    cerrarModal('modalTurno'); renderizarTurnos(); mostrarNotificacion("Turno creado");
}

function verMenuContextual(event, id, type) {
    event.stopPropagation();
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block'; menu.style.left = (event.pageX - 120) + 'px'; menu.style.top = (event.pageY) + 'px';
    menu.dataset.id = id; menu.dataset.type = type;
    document.querySelectorAll('.only-depto').forEach(a => a.style.display = (type === 'depto' ? 'flex' : 'none'));
}

function ejecutarAccionContextual(accion) {
    const { id, type } = document.getElementById('contextMenu').dataset;
    const nId = parseInt(id);
    if(accion === 'editar' && type === 'depto') { _idGlobal = nId; const d = departamentos.find(x => x.id === nId); document.getElementById('d_nombre').value = d.nombre; document.getElementById('d_responsable').value = d.responsable; document.getElementById('d_estatus').value = d.estatus; abrirModal('modalDepto'); }
    if(accion === 'detalle') abrirDetalleDepto(nId);
    if(accion === 'eliminar' && type === 'depto') { 
        const d = departamentos.find(x => x.id === nId);
        if(d.empleados > 0) return alert("No puedes borrar un depto con gente activa.");
        if(confirm(`¿Borrar ${d.nombre}?`)) { departamentos = departamentos.filter(x => x.id !== nId); registrarCambio(`Borrado de depto: ${d.nombre}`); renderizarDeptos(); }
    }
}

document.addEventListener('click', () => { document.getElementById('contextMenu').style.display = 'none'; });
document.addEventListener('DOMContentLoaded', () => { cambiarSeccion('deptos'); });
