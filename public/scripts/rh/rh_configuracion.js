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
        const [resDeptos, resPuestos, resTurnos, resConfig, resEmpleados] = await Promise.all([
            fetch(`${API_BASE}/deptos`).then(r => r.json()),
            fetch(`${API_BASE}/puestos`).then(r => r.json()),
            fetch(`${API_BASE}/turnos`).then(r => r.json()),
            fetch(`${API_BASE}/global`).then(r => r.json()),
            fetch('/api/rh/empleados').then(r => r.json())
        ]);

        departamentos = Array.isArray(resDeptos) ? resDeptos : [];
        puestos = Array.isArray(resPuestos) ? resPuestos : [];
        turnos = Array.isArray(resTurnos) ? resTurnos : [];
        rulesGlobal = resConfig || {};

        // Actualizar conteo real de personal activo
        const activos = Array.isArray(resEmpleados) ? resEmpleados.filter(e => e.estado === 'Activo').length : 0;
        const elPersonal = document.getElementById('stat-personal-activo');
        if(elPersonal) elPersonal.textContent = activos;

        cambiarSeccion('deptos');
        renderizarHistorial();
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
    if(sec === 'cumpleanos') renderizarCumpleanos();
    if(sec === 'asistencia') cargarReglasAsistencia();
    if(sec === 'politicas') cargarPoliticasVacaciones();
    if(sec === 'biometrico') cargarConfigBiometrico();
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
    const deptoId = document.getElementById('p_depto').value;
    if(!deptoId) return showToast('Selecciona un departamento', 'warning');

    const body = {
        id: _idGlobal,
        nombre: document.getElementById('p_nombre').value,
        departamento_id: parseInt(deptoId),
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

// ─────────────────────────────────────────────
//  CONFIGURACIÓN BIOMÉTRICA (ZKTeco)
// ─────────────────────────────────────────────

function cargarConfigBiometrico() {
    document.getElementById('bio_ip').value = rulesGlobal.bio_ip || '192.168.100.24';
    document.getElementById('bio_port').value = rulesGlobal.bio_port || 4370;
    document.getElementById('bio_key').value = rulesGlobal.bio_key || '0';
    document.getElementById('bio_device_id').value = rulesGlobal.bio_device_id || 1;
}

async function guardarConfigBiometrico() {
    const newRules = { ...rulesGlobal };
    newRules.bio_ip = document.getElementById('bio_ip').value;
    newRules.bio_port = parseInt(document.getElementById('bio_port').value);
    newRules.bio_key = document.getElementById('bio_key').value;
    newRules.bio_device_id = parseInt(document.getElementById('bio_device_id').value);

    try {
        const res = await fetch(`${API_BASE}/global`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRules)
        });
        if (res.ok) {
            rulesGlobal = newRules;
            showToast("Configuración biométrica guardada");
        }
    } catch (err) {
        showToast("Error al guardar configuración biométrica", "error");
    }
}

async function probarConexionBiometrico() {
    const ip = document.getElementById('bio_ip').value;
    const port = parseInt(document.getElementById('bio_port').value);
    const statusEl = document.getElementById('bio_status');
    
    if(!ip) return showToast("Escribe una IP válida", "warning");

    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--primary)';
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Probando conexión...';

    try {
        const res = await fetch('/api/rh/asistencia/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port })
        });
        const data = await res.json();

        if (data.success) {
            statusEl.style.color = 'var(--success)';
            const fechaHora = data.currentTime ? new Date(data.currentTime).toLocaleString() : 'No disponible';
            const logs = (data.stats && data.stats.logCounts !== undefined) ? data.stats.logCounts : 'N/D';
            
            statusEl.innerHTML = `
                <div style="background:rgba(22,163,74,0.1); padding:15px; border-radius:12px; margin-top:10px; border:1px solid rgba(22,163,74,0.3);">
                    <div style="font-size:16px;"><i class="fa-solid fa-check-circle"></i> ¡CONEXIÓN EXITOSA!</div>
                    <div style="margin-top:8px; font-weight:normal; color:var(--text); text-align:left;">
                        <strong>📡 Dispositivo:</strong> ${data.device || 'Generico'}<br>
                        <strong>⏰ Hora Reloj:</strong> ${fechaHora}<br>
                        <strong>📝 Total Logs:</strong> ${logs} registros
                    </div>
                </div>
            `;
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
    } catch (err) {
        statusEl.style.color = 'var(--danger)';
        statusEl.innerHTML = `<i class="fa-solid fa-xmark-circle"></i> Error: ${err.message}`;
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
    // Poblar select de departamentos dinámicamente al abrir modal de puestos
    if(id === 'modalPuesto') {
        const sel = document.getElementById('p_depto');
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        departamentos.forEach(d => {
            sel.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
        });
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
            if(!d) return;
            document.getElementById('d_nombre').value = d.nombre || '';
            document.getElementById('d_responsable').value = d.responsable || '';
            document.getElementById('d_estatus').value = d.estatus || 'Activo';
            abrirModal('modalDepto');
        }
        if(type === 'puesto') {
            const p = puestos.find(x => x.id === nId);
            if(!p) return;
            document.getElementById('p_nombre').value = p.nombre || '';
            document.getElementById('p_sueldo').value = p.sueldo_base_sugerido || 0;
            document.getElementById('p_nivel').value = p.nivel || 'Operativo';
            // Abrir modal (esto poblará el select de deptos)
            abrirModal('modalPuesto');
            // Seleccionar el departamento correcto después de poblar
            document.getElementById('p_depto').value = p.departamento_id || '';
        }
        if(type === 'turno') {
            const t = turnos.find(x => x.id === nId);
            if(!t) return;
            document.getElementById('t_nombre').value = t.nombre || '';
            document.getElementById('t_entrada').value = t.entrada || '';
            document.getElementById('t_salida').value = t.salida || '';
            document.getElementById('t_dias').value = t.dias || '';
            abrirModal('modalTurno');
        }
    }

    if(accion === 'detalle') {
        if(type === 'depto') {
            const d = departamentos.find(x => x.id === nId);
            if(!d) return;
            document.getElementById('det-nombre').textContent = d.nombre;
            document.getElementById('det-responsable').textContent = d.responsable || 'Sin asignar';
            document.getElementById('det-total-emp').textContent = d.empleados || 0;
            // Cargar empleados del departamento
            try {
                const emps = await fetch('/api/rh/empleados').then(r => r.json());
                const deptoPuestos = puestos.filter(p => p.departamento_id === nId).map(p => p.id);
                const filtered = emps.filter(e => deptoPuestos.includes(e.puesto_id));
                const tbody = document.getElementById('det-emps-list');
                tbody.innerHTML = '';
                filtered.forEach(e => {
                    const puesto = puestos.find(p => p.id === e.puesto_id);
                    tbody.innerHTML += `
                        <tr class="hover-row">
                            <td><strong>${e.nombre} ${e.apellidos || ''}</strong><br><small>${puesto ? puesto.nombre : '-'}</small></td>
                            <td><span class="badge badge-active">${e.estado || 'Activo'}</span></td>
                            <td></td>
                        </tr>
                    `;
                });
                if(filtered.length === 0) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--muted);">Sin empleados asignados</td></tr>';
            } catch(err) { console.error(err); }
            abrirModal('modalDetalleDepto');
        }
    }

    if(accion === 'eliminar') {
        const typeLabel = type === 'depto' ? 'departamento' : type;
        if(!confirm(`¿Seguro que deseas eliminar este ${typeLabel}?`)) return;
        try {
            const res = await fetch(`${API_BASE}/${type}s/${nId}`, { method: 'DELETE' });
            if(res.ok) {
                showToast(`${typeLabel} eliminado`);
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

// ─────────────────────────────────────────────
//  CUMPLEAÑOS (DATOS REALES)
// ─────────────────────────────────────────────

async function renderizarCumpleanos() {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const today = new Date();
    const currentDay = today.getDate();

    // Leer mes del filtro (o usar el actual si es primera vez)
    const filtro = document.getElementById('cumple-mes-filtro');
    if(!filtro) return;
    
    // Pre-seleccionar mes actual solo la primera vez
    if(!filtro.dataset.initialized) {
        filtro.value = today.getMonth();
        filtro.dataset.initialized = 'true';
    }
    
    const selectedMonth = parseInt(filtro.value); // 0-indexed

    const tbody = document.getElementById('proximosCumplesTable');
    if(!tbody) return;

    try {
        const empleados = await fetch('/api/rh/empleados').then(r => r.json());
        if(!Array.isArray(empleados)) return;

        // Filtrar empleados que cumplen años en el mes seleccionado
        // Usamos getUTC* porque PostgreSQL envía fechas en UTC y JS puede desfasar el día
        const cumpleaneros = empleados.filter(e => {
            if(!e.fecha_nac) return false;
            const nac = new Date(e.fecha_nac);
            return nac.getUTCMonth() === selectedMonth;
        }).sort((a, b) => {
            return new Date(a.fecha_nac).getUTCDate() - new Date(b.fecha_nac).getUTCDate();
        });

        tbody.innerHTML = '';

        if(cumpleaneros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted);">No hay cumpleaños en ${meses[selectedMonth]}.</td></tr>`;
            return;
        }

        cumpleaneros.forEach(e => {
            const nac = new Date(e.fecha_nac);
            const dia = nac.getUTCDate();
            const mesActual = today.getMonth();
            const esHoy = dia === currentDay && selectedMonth === mesActual;
            // Ya pasó si: el mes seleccionado es anterior al actual, O es el mes actual pero el día ya pasó
            const yaPaso = selectedMonth < mesActual || (selectedMonth === mesActual && dia < currentDay);
            const puesto = puestos.find(p => p.id === e.puesto_id);

            tbody.innerHTML += `
                <tr class="${esHoy ? 'bg-highlight' : 'hover-row'}">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:32px; height:32px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--primary);">
                                ${(e.nombre || '').charAt(0)}
                            </div>
                            <strong>${e.nombre} ${e.apellidos || ''}</strong>
                        </div>
                    </td>
                    <td><span class="badge-count">${dia} de ${meses[selectedMonth]}</span></td>
                    <td>${puesto ? puesto.nombre : '-'}</td>
                    <td>
                        ${esHoy 
                            ? '<span class="badge" style="background:rgba(27,60,94,0.1); color:var(--primary);"><i class="fa-solid fa-cake-candles"></i> ¡ES HOY!</span>' 
                            : yaPaso 
                                ? '<span style="color:var(--muted); font-size:12px;">Ya pasó</span>'
                                : '<span style="color:var(--success); font-size:12px;">Próximamente</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(err) {
        console.error('Error al cargar cumpleaños:', err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Error al cargar datos</td></tr>';
    }
}

document.addEventListener('click', () => { 
    const menu = document.getElementById('contextMenu');
    if(menu) menu.style.display = 'none'; 
});

document.addEventListener('DOMContentLoaded', () => { 
    cargarDatosIniciales(); 
});
