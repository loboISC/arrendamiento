// ─────────────────────────────────────────────
//  GESTIÓN DE CONFIGURACIÓN RH - INTEGRACIÓN API
// ─────────────────────────────────────────────

let departamentos = [];
let puestos = [];
let turnos = [];
let rulesGlobal = {};
let _idGlobal = null;

const API_BASE = '/api/rh/config';

async function cargarDatosIniciales() {
    try {
        const [resDeptos, resPuestos, resTurnos, resConfig] = await Promise.all([
            fetch(`${API_BASE}/deptos`).then(r => r.json()),
            fetch(`${API_BASE}/puestos`).then(r => r.json()),
            fetch(`${API_BASE}/turnos`).then(r => r.json()),
            fetch(`${API_BASE}/global`).then(r => r.json())
        ]);

        departamentos = resDeptos;
        puestos = resPuestos;
        turnos = resTurnos;
        rulesGlobal = resConfig;

        cambiarSeccion('deptos'); // Iniciar en la sección por defecto
        renderizarHistorial(); // Cargar auditoría al inicio
    } catch (err) {
        console.error('Error al cargar datos:', err);
        showToast("Error al conectar con la base de datos", "error");
    }
}

// ─────────────────────────────────────────────
//  NAVEGACIÓN Y DASHBOARD
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
                <td><div style="font-weight:600;">${d.responsable || 'Sin asignar'}</div><div style="font-size:11px; color:var(--muted);">Responsable</div></td>
                <td><span class="badge-count"><i class="fa-solid fa-users"></i> ${d.empleados || 0}</span></td>
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
                <td><span class="depto-tag">${p.departamento || 'Sin asignar'}</span></td>
                <td>${p.nivel || '-'}</td>
                <td>$${parseFloat(p.sueldo_base_sugerido || 0).toLocaleString()}</td>
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
                <td><span class="badge ${t.estatus === 'Activo' ? 'badge-active' : 'badge-inactive'}">${t.estatus || 'Activo'}</span></td>
                <td style="text-align:right;"><button class="btn-icon" onclick="verMenuContextual(event, ${t.id}, 'turno')"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
            </tr>
        `;
    });
}

// ─────────────────────────────────────────────
//  FORMULARIOS Y PERSISTENCIA
// ─────────────────────────────────────────────

async function guardarDepto() {
    const body = {
        id: _idGlobal,
        nombre: document.getElementById('d_nombre').value,
        responsable: document.getElementById('d_responsable').value,
        estatus: document.getElementById('d_estatus').value
    };

    if(!body.nombre) return showToast("El nombre es requerido", "warning");

    try {
        const res = await fetch(`${API_BASE}/deptos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if(res.ok) {
            showToast("Departamento guardado correctamente");
            cerrarModal('modalDepto');
            const data = await fetch(`${API_BASE}/deptos`).then(r => r.json());
            departamentos = data;
            renderizarDeptos();
            _idGlobal = null;
        }
    } catch (err) {
        showToast("Error al guardar departamento", "error");
    }
}

async function guardarPuesto() {
    const deptoNombre = document.getElementById('p_depto').value;
    const depto = departamentos.find(d => d.nombre === deptoNombre);

    const body = {
        id: _idGlobal,
        nombre: document.getElementById('p_nombre').value,
        departamento_id: depto ? depto.id : null,
        nivel: document.getElementById('p_nivel').value,
        sueldo_base_sugerido: parseFloat(document.getElementById('p_sueldo').value) || 0,
        estatus: 'Activo'
    };

    try {
        const res = await fetch(`${API_BASE}/puestos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if(res.ok) {
            showToast("Puesto guardado");
            cerrarModal('modalPuesto');
            puestos = await fetch(`${API_BASE}/puestos`).then(r => r.json());
            renderizarPuestos();
            _idGlobal = null;
        }
    } catch (err) {
        showToast("Error al guardar puesto", "error");
    }
}

async function guardarTurno() {
    const body = {
        id: _idGlobal,
        nombre: document.getElementById('t_nombre').value,
        entrada: document.getElementById('t_entrada').value,
        salida: document.getElementById('t_salida').value,
        dias: document.getElementById('t_dias').value,
        tolerancia_minutos: 10
    };

    try {
        await fetch(`${API_BASE}/turnos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        showToast("Turno guardado");
        cerrarModal('modalTurno');
        turnos = await fetch(`${API_BASE}/turnos`).then(r => r.json());
        renderizarTurnos();
        _idGlobal = null;
    } catch (err) {
        showToast("Error al guardar turno", "error");
    }
}

// ─────────────────────────────────────────────
//  REGLAS GLOBALES
// ─────────────────────────────────────────────

function cargarReglasAsistencia() {
    document.getElementById('as_tolerancia').value = rulesGlobal.asistencia_tolerancia_min || 10;
    document.getElementById('as_umbral').value = rulesGlobal.asistencia_umbral_retardo_min || 15;
    document.getElementById('as_entrada').value = rulesGlobal.asistencia_entrada_std || '08:00';
    document.getElementById('as_salida').value = rulesGlobal.asistencia_salida_std || '18:00';
}

function cargarPoliticasVacaciones() {
    document.getElementById('vac_dias').value = rulesGlobal.vacaciones_dias_base || 12;
    document.getElementById('vac_acum').checked = rulesGlobal.vacaciones_permitir_acumular ?? true;
    document.getElementById('vac_max').value = rulesGlobal.vacaciones_max_seguidos || 10;
    document.getElementById('vac_anticipacion').value = rulesGlobal.vacaciones_anticipacion_dias || 15;
}

async function guardarReglasAsistencia() {
    const newRules = { ...rulesGlobal };
    newRules.asistencia_tolerancia_min = parseInt(document.getElementById('as_tolerancia').value);
    newRules.asistencia_umbral_retardo_min = parseInt(document.getElementById('as_umbral').value);
    newRules.asistencia_entrada_std = document.getElementById('as_entrada').value;
    newRules.asistencia_salida_std = document.getElementById('as_salida').value;

    await actualizarReglasAPI(newRules);
}

async function guardarPoliticasVacaciones() {
    const newRules = { ...rulesGlobal };
    newRules.vacaciones_dias_base = parseInt(document.getElementById('vac_dias').value);
    newRules.vacaciones_permitir_acumular = document.getElementById('vac_acum').checked;
    newRules.vacaciones_max_seguidos = parseInt(document.getElementById('vac_max').value);
    newRules.vacaciones_anticipacion_dias = parseInt(document.getElementById('vac_anticipacion').value);

    await actualizarReglasAPI(newRules);
}

async function actualizarReglasAPI(rules) {
    try {
        const res = await fetch(`${API_BASE}/global`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rules)
        });
        if(res.ok) {
            rulesGlobal = rules;
            showToast("Configuración global actualizada");
        }
    } catch (err) {
        showToast("Error al actualizar configuración", "error");
    }
}

async function renderizarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if(!tbody) return;
    try {
        const data = await fetch(`${API_BASE}/auditoria`).then(r => r.json());
        tbody.innerHTML = '';
        data.forEach(h => {
            const fechaTxt = new Date(h.fecha).toLocaleString();
            tbody.innerHTML += `<tr><td>${fechaTxt}</td><td><strong>${h.usuario}</strong></td><td>${h.accion}</td><td><i class="fa-solid fa-circle" style="font-size:8px; color:var(--primary); margin-right:8px;"></i>Auditado</td></tr>`;
        });
    } catch (err) {}
}

// ─────────────────────────────────────────────
//  MODALES Y MENÚS
// ─────────────────────────────────────────────

function abrirModal(id) { 
    if(!_idGlobal) {
        // Limpiar formularios si es nuevo
        if(id === 'modalDepto') { document.getElementById('d_nombre').value = ''; document.getElementById('d_responsable').value = ''; }
        if(id === 'modalPuesto') { document.getElementById('p_nombre').value = ''; document.getElementById('p_sueldo').value = ''; }
        if(id === 'modalTurno') { document.getElementById('t_nombre').value = ''; }
    }
    document.getElementById(id).style.display = 'flex'; 
}

function cerrarModal(id) { document.getElementById(id).style.display = 'none'; _idGlobal = null; }

function verMenuContextual(event, id, type) {
    event.stopPropagation();
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block'; menu.style.left = (event.pageX - 120) + 'px'; menu.style.top = (event.pageY) + 'px';
    menu.dataset.id = id; menu.dataset.type = type;
    document.querySelectorAll('.only-depto').forEach(a => a.style.display = (type === 'depto' ? 'flex' : 'none'));
}

async function ejecutarAccionContextual(accion) {
    const { id, type } = document.getElementById('contextMenu').dataset;
    const nId = parseInt(id);

    if(accion === 'editar') {
        _idGlobal = nId;
        if(type === 'depto') {
            const d = departamentos.find(x => x.id === nId);
            document.getElementById('d_nombre').value = d.nombre;
            document.getElementById('d_responsable').value = d.responsable;
            document.getElementById('d_estatus').value = d.estatus;
            abrirModal('modalDepto');
        }
        // TODO: Implementar edición para puestos y turnos
    }

    if(accion === 'eliminar') {
        if(!confirm(`¿Seguro que deseas eliminar este ${type}?`)) return;
        try {
            const res = await fetch(`${API_BASE}/${type}s/${nId}`, { method: 'DELETE' });
            if(res.ok) {
                showToast(`${type} eliminado`);
                if(type === 'depto') { departamentos = await fetch(`${API_BASE}/deptos`).then(r => r.json()); renderizarDeptos(); }
                if(type === 'puesto') { puestos = await fetch(`${API_BASE}/puestos`).then(r => r.json()); renderizarPuestos(); }
                if(type === 'turno') { turnos = await fetch(`${API_BASE}/turnos`).then(r => r.json()); renderizarTurnos(); }
            } else {
                const data = await res.json();
                showToast(data.error, "error");
            }
        } catch (err) {
             showToast("Error al eliminar", "error");
        }
    }
}

document.addEventListener('click', () => { 
    const menu = document.getElementById('contextMenu');
    if(menu) menu.style.display = 'none'; 
});

document.addEventListener('DOMContentLoaded', () => { 
    cargarDatosIniciales(); 
});
