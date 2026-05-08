// Variables globales para el estado local
let empleados = [];
let catalogos = { departamentos: [], puestos: [] };
let _idEditando = null;

// Elementos del DOM
const tableBody = document.getElementById('employeeTableBody');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('employeeModal');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
});

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            obtenerEmpleados(),
            cargarCatalogos()
        ]);
    } catch (err) {
        console.error(err);
    }
}

async function obtenerEmpleados() {
    try {
        const res = await fetch('/api/rh/empleados');
        empleados = await res.json();
        renderizarEmpleados(empleados);
    } catch (err) {
        console.error(err);
    }
}

async function cargarCatalogos() {
    try {
        const [resPuestos, resDeptos] = await Promise.all([
            fetch('/api/rh/config/puestos').then(r => r.json()),
            fetch('/api/rh/config/deptos').then(r => r.json())
        ]);
        catalogos.puestos = resPuestos;

        const sPuesto = document.getElementById('m_puesto');
        const sDepto = document.getElementById('m_depto');

        if (sPuesto) {
            sPuesto.innerHTML = '<option value="">Seleccionar Puesto...</option>';
            catalogos.puestos.forEach(p => {
                sPuesto.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            });
        }
        if (sDepto) {
            sDepto.innerHTML = '<option value="">Seleccionar Departamento...</option>';
            resDeptos.forEach(d => {
                sDepto.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// --- RENDERIZADO ORIGINAL ---
function renderizarEmpleados(data = empleados) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(emp => {
        const row = document.createElement('tr');
        const tipoBadgeColor = {
            'PLANTA': '#2563eb',
            'OPERATIVO': '#7c3aed',
            'TEMPORAL': '#d97706',
            'RESIDENTE': '#059669',
            'SS': '#0891b2',
            'EXTERNO': '#dc2626'
        };
        const tipo = (emp.tipo_empleado || 'PLANTA').toUpperCase();
        const tipoColor = tipoBadgeColor[tipo] || '#6b7280';

        row.innerHTML = `
            <td><img src="/assets/images/LOGO_ANDAMIOS_02.png" class="emp-avatar"></td>
            <td>
                <strong>${emp.nombre} ${emp.apellidos || ''}</strong><br>
                <small style="color:var(--muted);">${emp.id} | ${emp.curp || 'S/C'}</small>
                <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:10px;background:${tipoColor};color:#fff;">${tipo}</span>
            </td>
            <td>${emp.puesto || 'Sin asignar'}</td>
            <td>${emp.reg_patronal || 'N/A'}</td>
            <td>${emp.bio_id || '-'}</td>
            <td><span class="badge ${emp.estado === 'Activo' ? 'badge-active' : 'badge-inactive'}">${emp.estado}</span></td>
            <td class="actions-cell">
                <i class="fa-solid fa-address-card action-icon" onclick="editarEmpleado('${emp.id}')" title="Ver Expediente"></i>
                <i class="fa-solid fa-trash action-icon" onclick="eliminarEmpleado('${emp.id}')" title="Baja de Empleado"></i>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- BÚSQUEDA ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = empleados.filter(emp => 
            (emp.nombre + ' ' + (emp.apellidos || '')).toLowerCase().includes(term) ||
            emp.id.toLowerCase().includes(term) ||
            (emp.curp || '').toLowerCase().includes(term)
        );
        renderizarEmpleados(filtered);
    });
}

// --- ACCIONES API ---
async function editarEmpleado(id) {
    try {
        const res = await fetch(`/api/rh/empleados/${id}`);
        const emp = await res.json();
        
        _idEditando = id;
        document.getElementById('m_id').value = emp.id;
        document.getElementById('m_id').disabled = true;
        document.getElementById('m_nombre').value = emp.nombre || '';
        document.getElementById('m_apellidos').value = emp.apellidos || '';
        document.getElementById('m_fecha_nac').value = emp.fecha_nac ? emp.fecha_nac.substring(0, 10) : '';
        document.getElementById('m_curp').value = emp.curp || '';
        document.getElementById('m_rfc').value = emp.rfc || '';
        document.getElementById('m_nss').value = emp.nss || '';
        document.getElementById('m_tel').value = emp.telefono || '';
        document.getElementById('m_sangre').value = emp.tipo_sangre || '';
        document.getElementById('m_dir').value = emp.direccion || '';
        document.getElementById('m_emergencia').value = emp.contacto_emergencia || '';
        
        document.getElementById('m_puesto').value = emp.puesto_id || '';
        document.getElementById('m_depto').value = emp.departamento_id || '';
        document.getElementById('m_tipo').value = emp.tipo_empleado || 'PLANTA';
        document.getElementById('m_bio_id').value = emp.bio_id || '';
        document.getElementById('m_num_nomina').value = emp.num_nomina || '';
        document.getElementById('m_ingreso').value = emp.fecha_ingreso ? emp.fecha_ingreso.substring(0, 10) : '';
        document.getElementById('m_estado').value = emp.estado || 'Activo';
        
        document.getElementById('m_correo_empresa').value = emp.correo_empresa || '';
        document.getElementById('m_celular_empresa').value = emp.celular_empresa || '';
        
        document.getElementById('m_reg_patronal').value = emp.reg_patronal || '';
        document.getElementById('m_prestaciones').value = emp.tipo_prestaciones || 'DE LEY';
        document.getElementById('m_salario_diario').value = emp.salario_diario || 0;
        document.getElementById('m_sdi').value = emp.sdi || 0;
        document.getElementById('m_nomina').value = emp.nomina_asignada || 'NOMINA QUINCENAL';
        document.getElementById('m_contrato').value = emp.tipo_contrato || 'INDETERMINADO';

        modal.style.display = 'flex';
        cambiarTabModal('general');
    } catch (err) {
        console.error(err);
        alert('Error al cargar datos del empleado');
    }
}

async function guardarEmpleado() {
    const data = {
        id: document.getElementById('m_id').value,
        nombre: document.getElementById('m_nombre').value,
        apellidos: document.getElementById('m_apellidos').value,
        fecha_nac: document.getElementById('m_fecha_nac').value,
        curp: document.getElementById('m_curp').value,
        rfc: document.getElementById('m_rfc').value,
        nss: document.getElementById('m_nss').value,
        telefono: document.getElementById('m_tel').value,
        tipo_sangre: document.getElementById('m_sangre').value,
        direccion: document.getElementById('m_dir').value,
        contacto_emergencia: document.getElementById('m_emergencia').value,
        puesto_id: document.getElementById('m_puesto').value,
        departamento_id: document.getElementById('m_depto').value,
        tipo_empleado: document.getElementById('m_tipo').value,
        bio_id: document.getElementById('m_bio_id').value,
        num_nomina: document.getElementById('m_num_nomina').value,
        fecha_ingreso: document.getElementById('m_ingreso').value,
        estado: document.getElementById('m_estado').value,
        correo_empresa: document.getElementById('m_correo_empresa').value,
        celular_empresa: document.getElementById('m_celular_empresa').value,
        reg_patronal: document.getElementById('m_reg_patronal').value,
        tipo_prestaciones: document.getElementById('m_prestaciones').value,
        salario_diario: document.getElementById('m_salario_diario').value,
        sdi: document.getElementById('m_sdi').value,
        nomina_asignada: document.getElementById('m_nomina').value,
        tipo_contrato: document.getElementById('m_contrato').value
    };

    try {
        const res = await fetch('/api/rh/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            cerrarModal();
            obtenerEmpleados();
            if(typeof showToast === 'function') showToast("Empleado guardado con éxito");
        } else {
            const errData = await res.json();
            alert("Error al guardar: " + (errData.error || "Error desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión con el servidor");
    }
}

async function eliminarEmpleado(id) {
    if (!confirm('¿Seguro que deseas dar de baja a este empleado?')) return;
    try {
        const res = await fetch(`/api/rh/empleados/${id}`, { method: 'DELETE' });
        if (res.ok) obtenerEmpleados();
    } catch (err) {
        console.error(err);
    }
}

// --- UI / MODAL ---
async function abrirModal() {
    _idEditando = null;
    document.querySelectorAll('.form-control').forEach(el => el.value = '');
    document.getElementById('m_id').disabled = false;

    // Auto-generar siguiente ID disponible
    try {
        const res = await fetch('/api/rh/empleados/siguiente-id');
        const data = await res.json();
        if (data.siguiente_id) {
            document.getElementById('m_id').value = data.siguiente_id;
        }
    } catch (err) {
        console.error("Error al obtener siguiente ID:", err);
    }

    modal.style.display = 'flex';
    cambiarTabModal('general');
}

function cerrarModal() {
    modal.style.display = 'none';
}

function cambiarTabModal(tabName) {
    document.querySelectorAll('.modal-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const tabs = document.querySelectorAll('.modal-tab');
    if (tabName === 'general') {
        tabs[0].classList.add('active');
        document.getElementById('tab-general').style.display = 'grid';
    } else if (tabName === 'laboral') {
        tabs[1].classList.add('active');
        document.getElementById('tab-laboral').style.display = 'grid';
    } else if (tabName === 'documentos') {
        tabs[2].classList.add('active');
        document.getElementById('tab-documentos').style.display = 'block';
        cargarDocumentos();
    }
}

// --- DOCUMENTOS ---
async function cargarDocumentos() {
    if (!_idEditando) return;
    const container = document.getElementById('lista-documentos');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-sync fa-spin"></i> Buscando archivos...</div>';

    try {
        const res = await fetch(`/api/rh/empleados/${_idEditando}/documentos`);
        const docs = await res.json();
        if (docs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">Sin documentos PDF.</p>';
            return;
        }
        container.innerHTML = '';
        docs.forEach(doc => {
            const div = document.createElement('div');
            div.style = 'display:flex; justify-content:space-between; padding:10px; background:#f4f4f4; border-radius:5px; margin-bottom:5px; cursor:pointer;';
            div.onclick = () => window.open(`/api/rh/documentos/ver/${doc.id}`, '_blank');
            div.innerHTML = `<span><i class="fa-solid fa-file-pdf" style="color:red; margin-right:8px;"></i> ${doc.nombre_archivo}</span><i class="fa-solid fa-eye"></i>`;
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    }
}

// --- EXPORTACIÓN ---
function abrirExportModal() {
    const exModal = document.getElementById('exportModal');
    if (exModal) exModal.style.display = 'flex';
}

function cerrarExportModal() {
    const exModal = document.getElementById('exportModal');
    if (exModal) exModal.style.display = 'none';
}

async function confirmarExportacion() {
    const tipoFiltro = document.getElementById('exp_tipo').value;
    const estadoFiltro = document.getElementById('exp_estado').value;
    const selectedCols = Array.from(document.querySelectorAll('#export-columns-selector input:checked')).map(cb => cb.value);

    try {
        const res = await fetch('/api/rh/empleados');
        let lista = await res.json();

        if (tipoFiltro !== 'TODOS') lista = lista.filter(e => (e.tipo_empleado || '').toUpperCase() === tipoFiltro);
        if (estadoFiltro !== 'TODOS') lista = lista.filter(e => estadoFiltro === 'Activo' ? e.estado === 'Activo' : e.estado !== 'Activo');

        const colMap = {
            id: { label: 'ID', key: 'id' },
            nombre: { label: 'NOMBRE', key: (e) => `${e.nombre} ${e.apellidos || ''}`.toUpperCase() },
            fecha_nac: { label: 'FECHA NAC.', key: (e) => e.fecha_nac ? e.fecha_nac.substring(0,10) : '' },
            curp: { label: 'CURP', key: 'curp' },
            rfc: { label: 'RFC', key: 'rfc' },
            nss: { label: 'NSS', key: 'nss' },
            reg_patronal: { label: 'REGISTRO PATRONAL', key: 'reg_patronal' },
            prestaciones: { label: 'PRESTACIONES', key: 'tipo_prestaciones' },
            ingreso: { label: 'INGRESO', key: (e) => e.fecha_ingreso ? e.fecha_ingreso.substring(0,10) : '' },
            salario: { label: 'SALARIO', key: 'salario_diario' },
            sdi: { label: 'SDI', key: 'sdi' },
            puesto: { label: 'PUESTO', key: 'puesto' },
            depto: { label: 'DEPTO', key: 'departamento' },
            nomina: { label: 'NOMINA', key: 'nomina_asignada' },
            contrato: { label: 'CONTRATO', key: 'tipo_contrato' }
        };

        let html = `<html><head><meta charset="UTF-8"><style>
            .header { background-color: #385623; color: white; font-weight: bold; border: 1px solid #000; }
            .cell { border: 1px solid #000; }
            .zebra { background-color: #e2efda; border: 1px solid #000; }
        </style></head><body><table><tr>`;
        selectedCols.forEach(c => html += `<th class="header">${colMap[c].label}</th>`);
        html += '</tr>';
        lista.forEach((e, idx) => {
            html += '<tr>';
            selectedCols.forEach(c => {
                const val = typeof colMap[c].key === 'function' ? colMap[c].key(e) : e[colMap[c].key];
                html += `<td class="${idx % 2 === 0 ? 'cell' : 'zebra'}">${val || ''}</td>`;
            });
            html += '</tr>';
        });
        html += '</table></body></html>';

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'REPORTE_EMPLEADOS.xls';
        a.click();
        cerrarExportModal();
    } catch (err) {
        console.error(err);
    }
}
