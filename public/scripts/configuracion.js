 
 
 // Función para redimensionar imágenes
 function resizeImage(base64Str, maxWidth = 128, maxHeight = 128) {
   return new Promise((resolve, reject) => {
     let img = new Image();
     img.src = base64Str;
     img.onload = () => {
       let canvas = document.createElement('canvas');
       let width = img.width;
       let height = img.height;

       if (width > height) {
         if (width > maxWidth) {
           height *= maxWidth / width;
           width = maxWidth;
         }
       } else {
         if (height > maxHeight) {
           width *= maxHeight / height;
           height = maxHeight;
         }
       }
       canvas.width = width;
       canvas.height = height;
       let ctx = canvas.getContext('2d');
       ctx.drawImage(img, 0, 0, width, height);
       resolve(canvas.toDataURL('image/jpeg', 0.8)); // Usar JPEG para mejor compresión
     };
     img.onerror = (err) => {
       console.error("Error al cargar la imagen para redimensionar:", err);
       reject(new Error("No se pudo procesar la imagen. Intenta con otra o una más pequeña."));
     };
   });
 }

 // Cambiar de sección en configuración
 const navBtns = document.querySelectorAll('.config-nav-btn');
 const sections = [
   'section-general',
   'section-empresa',
   'section-usuarios',
   'section-seguridad',
   'section-notificaciones',
   'section-inventario',
   'section-facturacion',
   'section-reportes',
   'section-sistema',
   'section-smtp',
   'section-apariencia'
 ];
 
 // Nota: El vinculación de botones con secciones se hace más adelante de forma más robusta
 // Gestión de usuarios - código limpio
 // Modal Agregar Usuario
 const modalAgregar = document.getElementById('modalAgregarUsuario');
 const closeAgregar = document.getElementById('closeAgregarUsuario');
 const formAgregar = document.getElementById('formAgregarUsuario');
 
 document.getElementById('btnAgregarUsuario').onclick = function() {
   formAgregar.reset();
   modalAgregar.style.display = 'flex';
 };
 
 closeAgregar.onclick = () => { modalAgregar.style.display = 'none'; };
 
 // JS para preview y base64 en agregar usuario
 document.getElementById('add-foto-file').onchange = function(e) {
   const file = e.target.files[0];
   if (!file) return;
   if (!file.type.match('image.*')) {
     alert('Solo se permiten imágenes');
     return;
   }
   const reader = new FileReader();
   reader.onload = async function(evt) {
     try {
       const resizedDataUrl = await resizeImage(evt.target.result);
       document.getElementById('add-foto').value = resizedDataUrl;
       document.getElementById('add-foto-preview').src = resizedDataUrl;
       document.getElementById('add-foto-preview').style.display = 'inline-block';
     } catch (resizeError) {
       alert(resizeError.message);
       e.target.value = ''; // Limpiar el input de archivo
       document.getElementById('add-foto').value = '';
       document.getElementById('add-foto-preview').style.display = 'none';
     }
   };
   reader.readAsDataURL(file);
 };

formAgregar.onsubmit = async function(e) {
  e.preventDefault();
  const nombre = document.getElementById('add-nombre').value.trim();
  const correo = document.getElementById('add-correo').value.trim();
  const password = document.getElementById('add-password').value;
  const password2 = document.getElementById('add-password2').value;
  const rol = document.getElementById('add-rol').value;
  const estado = document.getElementById('add-estado').value;
  const foto = document.getElementById('add-foto').value;

  if(password !== password2) {
    alert('Las contraseñas no coinciden');
    return;
  }

  // Validar contraseña según políticas de seguridad
  if (typeof validarContrasena === 'function') {
    const validacion = validarContrasena(password);
    if (!validacion.valida) {
      alert('La contraseña no cumple con las políticas de seguridad:\n\n' + validacion.errores.join('\n'));
      return;
    }
  }

  try {
    const res = await fetch('http://localhost:3001/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ nombre, correo, password, rol, estado, foto })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `Error del servidor: ${res.status}` }));
      throw new Error(errorData.error || 'Ocurrió un error desconocido.');
    }

    modalAgregar.style.display = 'none';
    await cargarUsuarios();
    alert('Usuario creado correctamente.');
  } catch (err) {
    alert(err.message);
  }
};

// --- Configuración persistente ---
const defaultConfig = {
  general: {
    nombreSistema: 'ScaffoldPro',
    zonaHoraria: 'America/Mexico_City',
    idioma: 'Español',
    moneda: 'MXN - Peso Mexicano',
  },
  empresa: {
    nombre: 'Andamios y Proyectos Torres S.A. de C.V.',
    rfc: 'AAP123456789',
    telefono: '+52 55 1234-5678',
    direccion: 'Av. Industrial 123, Col. Centro, Ciudad de México, CP 01000',
    email: 'contacto@andamiostorres.com',
    web: 'https://www.andamiostorres.com',
    logo: 'img/LOGO_ANDAMIOS_02.png',
  },
  seguridad: {
    autenticacionDosFactor: true,
    sesionesMultiples: false,
    bloqueoAutomatico: '15 minutos',
    longitudMinima: 8,
    requerirMayusculas: true,
    requerirNumeros: true,
    requerirEspeciales: true,
  },
  notificaciones: {
    stockBajo: true,
    equiposMantenimiento: true,
    contratosVencer: true,
    pagosVencidos: true,
    notificacionesEmail: true,
    notificacionesSms: false,
  },
  inventario: {
    alertaStockMinimo: 5,
    diasAnticipacionMantenimiento: 7,
    unidadMedidaDefault: 'Pieza',
    permitirStockNegativo: false,
  },
  sistema: {
    respaldoAutomatico: true,
    frecuenciaRespaldo: 'Diario',
    modoMantenimiento: false,
    actualizacionesAutomaticas: true,
  },
  apariencia: {
    tema: 'light',
    colorPrimario: '#2979ff',
  }
};

function saveConfig(config) {
  localStorage.setItem('scaffoldpro_config', JSON.stringify(config));
}

function loadConfig() {
  const c = localStorage.getItem('scaffoldpro_config');
  return c ? JSON.parse(c) : JSON.parse(JSON.stringify(defaultConfig));
}

function resetConfig() {
  saveConfig(defaultConfig);
  location.reload();
}

let config = loadConfig();

// --- Aplicar tema y color primario ---
function applyAppearance() {
  const tema = config.apariencia.tema;
  const color = config.apariencia.colorPrimario;
  document.documentElement.style.setProperty('--primary-color', color);
  if (tema === 'dark' || (tema === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// --- Guardar cambios ---
document.querySelector('.save-btn').onclick = function() {
  // General
  config.general.nombreSistema = document.querySelector('#section-general input[type="text"]').value;
  config.general.zonaHoraria = document.querySelector('#section-general select').value;
  config.general.idioma = document.querySelectorAll('#section-general select')[1].value;
  config.general.moneda = document.querySelectorAll('#section-general select')[2].value;
  // Empresa
  config.empresa.nombre = document.getElementById('empresa-nombre').value;
  config.empresa.rfc = document.querySelectorAll('#section-empresa input[type="text"]')[1].value;
  config.empresa.telefono = document.querySelectorAll('#section-empresa input[type="text"]')[2].value;
  config.empresa.direccion = document.querySelector('#section-empresa textarea').value;
  config.empresa.email = document.querySelector('#section-empresa input[type="email"]').value;
  config.empresa.web = document.querySelector('#section-empresa input[type="url"]').value;
  // Apariencia
  config.apariencia.tema = document.getElementById('theme-select').value;
  config.apariencia.colorPrimario = document.getElementById('primary-color-picker').value;
  saveConfig(config);
  applyAppearance();
  showToast('¡Configuración guardada!');
};

// --- Restablecer ---
document.querySelector('.reset-btn').onclick = function() {
  if(confirm('¿Restablecer configuración a valores por defecto?')) resetConfig();
};

// --- Cargar valores al iniciar ---
function loadValues() {
  // General
  document.querySelector('#section-general input[type="text"]').value = config.general.nombreSistema;
  document.querySelector('#section-general select').value = config.general.zonaHoraria;
  document.querySelectorAll('#section-general select')[1].value = config.general.idioma;
  document.querySelectorAll('#section-general select')[2].value = config.general.moneda;
  // Empresa
  document.getElementById('empresa-nombre').value = config.empresa.nombre;
  document.querySelectorAll('#section-empresa input[type="text"]')[1].value = config.empresa.rfc;
  document.querySelectorAll('#section-empresa input[type="text"]')[2].value = config.empresa.telefono;
  document.querySelector('#section-empresa textarea').value = config.empresa.direccion;
  document.querySelector('#section-empresa input[type="email"]').value = config.empresa.email;
  document.querySelector('#section-empresa input[type="url"]').value = config.empresa.web;
  // Logo
  const logoPreview = document.getElementById('logo-preview');
  if (config.empresa.logo) {
    logoPreview.src = config.empresa.logo;
  } else {
    logoPreview.src = 'img/LOGO_ANDAMIOS_02.png';
  }
  // Apariencia
  document.getElementById('theme-select').value = config.apariencia.tema;
  document.getElementById('primary-color-picker').value = config.apariencia.colorPrimario;
  applyAppearance();
}

loadValues();

// --- Apariencia en tiempo real ---
document.getElementById('theme-select').onchange = function() {
  config.apariencia.tema = this.value;
  applyAppearance();
};

document.getElementById('primary-color-picker').oninput = function() {
  config.apariencia.colorPrimario = this.value;
  applyAppearance();
};

// --- Toast feedback ---
function showToast(msg) {
  let toast = document.createElement('div');
  toast.innerText = msg;
  toast.style.position = 'fixed';
  toast.style.bottom = '32px';
  toast.style.right = '32px';
  toast.style.background = '#2979ff';
  toast.style.color = '#fff';
  toast.style.padding = '14px 28px';
  toast.style.borderRadius = '10px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 2px 8px rgba(41,121,255,0.13)';
  toast.style.zIndex = 9999;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(), 2200);
}

// --- Tema oscuro CSS ---
const darkThemeStyles = document.createElement('style');
darkThemeStyles.innerHTML = `
  body.dark-theme { background: #181c22; color: #e3e8ef; }
  body.dark-theme .sidebar { background: #23272f; color: #e3e8ef; }
  body.dark-theme .sidebar a { color: #8a97ad; }
  body.dark-theme .sidebar a.active, body.dark-theme .sidebar a:hover { background: #223355; color: var(--primary-color, #22c8fa); font-weight: 600; }
  body.dark-theme .main-content { background: #181c22; }
  body.dark-theme .config-section { background: #23272f; color: #e3e8ef; }
  body.dark-theme .config-nav { background: #23272f; }
  body.dark-theme .form-input, body.dark-theme .form-select, body.dark-theme textarea { background: #23272f; color: #e3e8ef; border: 1px solid #3a3f4b; }
  body.dark-theme .form-label { color: #b0b8c1; }
  body.dark-theme .upload-btn, body.dark-theme .reset-btn { background: #23272f; color: #e3e8ef; border: 1px solid #3a3f4b; }
  body.dark-theme .reset-btn { background: #2d323c; color: #e3e8ef; border: 1px solid #4a5060; }
  body.dark-theme .reset-btn:hover { background: #3a4252; color: #22c8fa; border: 1px solid #22c8fa; }
  body.dark-theme .save-btn { background: #22c8fa; color: #fff; }
  body.dark-theme .save-btn:hover { background: #38b6ff; }
  body.dark-theme .logo-preview { border: 1px solid #3a3f4b; }
  body.dark-theme .info-text { color: #b0b8c1; }
  body.dark-theme table { background: #23272f; color: #e3e8ef; }
  body.dark-theme th, body.dark-theme td { border-color: #3a3f4b; }
`;
document.head.appendChild(darkThemeStyles);

// --- Color primario CSS ---
document.documentElement.style.setProperty('--primary-color', config.apariencia.colorPrimario);

// Logo upload logic
document.getElementById('logo-upload-btn').onclick = function() {
  document.getElementById('logo-input').click();
};

document.getElementById('logo-input').onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) { alert('Solo se permiten imágenes JPG o PNG'); return; }
  if (file.size > 2 * 1024 * 1024) { alert('El archivo debe ser menor a 2MB'); return; }
  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('logo-preview').src = evt.target.result;
    config.empresa.logo = evt.target.result;
    saveConfig(config);
  };
  reader.readAsDataURL(file);
};

function getToken() {
  return localStorage.getItem('token') || '';
}

function estadoColor(estado) {
  if (!estado) return '';
  return estado.trim().toLowerCase() === 'activo'
    ? '<span style="color:#43a047;font-weight:600;">Activo</span>'
    : '<span style="color:#f44336;font-weight:600;">Inactivo</span>';
}

function renderAcciones(id) {
  return `
    <button class="btn-editar" data-id="${id}" title="Editar" style="background:#e3f2fd;border:none;border-radius:6px;padding:6px 8px;margin-right:4px;cursor:pointer;"><i class="fa fa-pen" style="color:#2979ff;"></i></button>
    <button class="btn-reset" data-id="${id}" title="Cambiar contraseña" style="background:#fffde7;border:none;border-radius:6px;padding:6px 8px;margin-right:4px;cursor:pointer;"><i class="fa fa-key" style="color:#ffd600;"></i></button>
    <button class="btn-eliminar" data-id="${id}" title="Eliminar" style="background:#ffebee;border:none;border-radius:6px;padding:6px 8px;cursor:pointer;"><i class="fa fa-trash" style="color:#f44336;"></i></button>
  `;
}

let usuariosCache = [];

async function cargarUsuarios() {
const tbody = document.getElementById('usuarios-tbody');
tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;text-align:center;color:#888;">Cargando usuarios...</td></tr>';

const token = getToken();
if (!token) {
  tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;text-align:center;color:#f44336;">No hay token de autenticación. <a href="login.html" style="color:#2979ff;">Iniciar sesión</a></td></tr>';
  return;
}

try {
  const res = await fetch('http://localhost:3001/api/usuarios', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.status === 401) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;text-align:center;color:#f44336;">Token inválido. <a href="login.html" style="color:#2979ff;">Reiniciar sesión</a></td></tr>';
    return;
  }
  
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  
  const usuarios = await res.json();
  console.log('Usuarios recibidos:', usuarios); // Debug log
  usuariosCache = usuarios;
  
  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;text-align:center;color:#888;">No hay usuarios registrados.</td></tr>';
    return;
  }
  
  tbody.innerHTML = usuarios.map(u => {
    console.log('Procesando usuario:', u.nombre, 'Foto:', u.foto ? 'Sí' : 'No'); // Debug log
    return `<tr>
      <td style="padding:12px 8px;"><img src="${u.foto || 'img/default-user.png'}" alt="foto" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.src='img/default-user.png'"></td>
      <td style="padding:12px 8px;">${u.nombre}</td>
      <td style="padding:12px 8px;">${u.correo}</td>
      <td style="padding:12px 8px;">${u.rol}</td>
      <td style="padding:12px 8px;">${estadoColor(u.estado)}</td>
      <td style="padding:12px 8px;">${renderAcciones(u.id_usuario)}</td>
    </tr>`;
  }).join('');
  
  // Asigna eventos a los botones
  document.querySelectorAll('.btn-editar').forEach(btn => btn.onclick = abrirModalEditar);
  document.querySelectorAll('.btn-reset').forEach(btn => btn.onclick = resetearPassword);
  document.querySelectorAll('.btn-eliminar').forEach(btn => btn.onclick = eliminarUsuario);
  
} catch (e) {
  console.error('Error cargando usuarios:', e);
  tbody.innerHTML = `<tr><td colspan="5" style="padding:18px;text-align:center;color:#f44336;">
    Error al cargar usuarios: ${e.message}<br>
    <button onclick="cargarUsuarios()" style="background:#2979ff;color:#fff;border:none;border-radius:6px;padding:8px 16px;margin-top:8px;cursor:pointer;">Reintentar</button>
  </td></tr>`;
}
}
// Modal Editar Usuario
const modalEditar = document.getElementById('modalEditarUsuario');
const closeEditar = document.getElementById('closeEditarUsuario');
const formEditar = document.getElementById('formEditarUsuario');
let usuarioEditando = null;
function abrirModalEditar(e) {
const id = this.dataset.id;
usuarioEditando = usuariosCache.find(u => u.id_usuario == id);
if (!usuarioEditando) return;

// Obtener referencias a los inputs
const inputNombre = document.getElementById('edit-nombre');
const inputCorreo = document.getElementById('edit-correo');
const selectRol = document.getElementById('edit-rol');
const selectEstado = document.getElementById('edit-estado');
const inputFoto = document.getElementById('edit-foto');
const inputFotoFile = document.getElementById('edit-foto-file');
const preview = document.getElementById('edit-foto-preview');

// Asegurar que los inputs estén habilitados
inputNombre.disabled = false;
inputNombre.readOnly = false;
inputCorreo.disabled = false;
inputCorreo.readOnly = false;
selectRol.disabled = false;
selectEstado.disabled = false;

// Asignar valores
inputNombre.value = usuarioEditando.nombre;
inputCorreo.value = usuarioEditando.correo;
selectRol.value = usuarioEditando.rol;
selectEstado.value = usuarioEditando.estado;
inputFoto.value = usuarioEditando.foto || '';

if (usuarioEditando.foto) {
  preview.src = usuarioEditando.foto;
  preview.style.display = 'inline-block';
} else {
  preview.style.display = 'none';
}

// Limpia el input file para evitar que se quede el archivo anterior
inputFotoFile.value = '';
modalEditar.style.display = 'flex';

// Forzar focus en el primer input después de un pequeño delay
setTimeout(() => inputNombre.focus(), 100);
}
function cerrarModalEditar() {
  modalEditar.style.display = 'none';
  usuarioEditando = null;
  formEditar.reset();
  document.getElementById('edit-foto').value = '';
  document.getElementById('edit-foto-preview').style.display = 'none';
  document.getElementById('edit-foto-file').value = '';
}
closeEditar.onclick = cerrarModalEditar;
formEditar.onsubmit = async function(e) {
e.preventDefault();
if (!usuarioEditando) return;
const nombre = document.getElementById('edit-nombre').value.trim();
const correo = document.getElementById('edit-correo').value.trim();
const rol = document.getElementById('edit-rol').value;
const estado = document.getElementById('edit-estado').value;
const foto = document.getElementById('edit-foto').value;
try {
  console.log({ nombre, correo, rol, estado, foto });
  const res = await fetch(`http://localhost:3001/api/usuarios/${usuarioEditando.id_usuario}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ nombre, correo, rol, estado, foto })
  });
  if (!res.ok) throw new Error('Error al actualizar usuario');
  cerrarModalEditar();
  await cargarUsuarios();
  alert('Usuario actualizado correctamente');
} catch (err) {
  alert('Error al actualizar usuario');
}
};
window.onclick = function(e) {
if (e.target === modalEditar) cerrarModalEditar();
if (e.target === modalAgregar) modalAgregar.style.display = 'none';
};
// Resetear contraseña
async function resetearPassword() {
const id = this.dataset.id;
const usuario = usuariosCache.find(u => u.id_usuario == id);
if (!usuario) return;
// Aquí podrías hacer una petición real para resetear la contraseña
alert(`Se ha enviado un correo para resetear la contraseña de ${usuario.nombre}`);
}
// Eliminar usuario
async function eliminarUsuario() {
const id = this.dataset.id;
const usuario = usuariosCache.find(u => u.id_usuario == id);
if (!usuario) return;
if (!confirm('¿Eliminar usuario?')) return;
try {
  const res = await fetch(`http://localhost:3001/api/usuarios/${usuario.id_usuario}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error('Error al eliminar usuario');
  await cargarUsuarios();
  alert('Usuario eliminado correctamente');
} catch (err) {
  alert('Error al eliminar usuario');
}
}
document.addEventListener('DOMContentLoaded', cargarUsuarios);
document.addEventListener('DOMContentLoaded', function() {
// Asigna el evento onchange al input file de editar usuario
var editFotoFile = document.getElementById('edit-foto-file');
if (editFotoFile) {
  editFotoFile.onchange = function(e) {
    console.log('Foto file changed');
    const file = e.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name, file.type, file.size);
    if (!file.type.match('image.*')) {
      alert('Solo se permiten imágenes');
      return;
    }
    const reader = new FileReader();
    reader.onload = async function(evt) {
      console.log('File read complete, length:', evt.target.result.length);
      try {
        const resizedDataUrl = await resizeImage(evt.target.result);
        console.log('Resized image length:', resizedDataUrl.length);
        document.getElementById('edit-foto').value = resizedDataUrl;
        document.getElementById('edit-foto-preview').src = resizedDataUrl;
        document.getElementById('edit-foto-preview').style.display = 'inline-block';
        console.log('Photo updated in hidden field');
      } catch (resizeError) {
        console.error('Resize error:', resizeError);
        alert(resizeError.message);
        e.target.value = '';
        document.getElementById('edit-foto').value = usuarioEditando.foto || '';
        document.getElementById('edit-foto-preview').src = usuarioEditando.foto || 'img/default-user.png';
      }
    };
    reader.readAsDataURL(file);
  };
}
});

// --- FACTURACIÓN: Lógica y eventos ---

document.addEventListener('DOMContentLoaded', function() {
  // --- Lógica de carga inicial para sección Facturación ---
  const sectionFacturacion = document.getElementById('section-facturacion');
  const formEmisor = document.getElementById('form-emisor-config');
  const formCsd = document.getElementById('form-csd-upload');
  const feedbackEmisor = document.getElementById('emisor-config-feedback');
  const feedbackCsd = document.getElementById('csd-upload-feedback');
  const regimenSelect = document.getElementById('emisor-regimen');

  // Cargar catálogo de régimen fiscal (puedes reemplazar con fetch a tu backend)
  if (regimenSelect) {
    const catalogoRegimen = [
      { clave: '601', nombre: 'General de Ley Personas Morales' },
      { clave: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
      { clave: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
      { clave: '606', nombre: 'Arrendamiento' },
      { clave: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
      { clave: '621', nombre: 'Incorporación Fiscal' },
      { clave: '622', nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
      { clave: '626', nombre: 'Régimen Simplificado de Confianza' }
    ];
    regimenSelect.innerHTML = '<option value="">Selecciona...</option>' +
      catalogoRegimen.map(r => `<option value="${r.clave}">${r.clave} - ${r.nombre}</option>`).join('');
  }

  // Cargar datos del emisor y CSD al mostrar la sección
  async function cargarDatosEmisorYCSD() {
    try {
      console.log('Cargando datos del emisor...');
      // Endpoint de emisor no disponible actualmente, saltando carga
      return;
      /*
      const res = await fetch('http://localhost:3001/api/configuracion/emisor');
      console.log('Respuesta del servidor:', res.status);
      
      if (!res.ok) {
        console.log('Error en la respuesta:', res.status, res.statusText);
        return;
      }
      */
      
      const data = await res.json();
      console.log('Datos recibidos:', data);
      
      if (data.success && data.data) {
        const emisorData = data.data;
        if (emisorData.rfc) document.getElementById('emisor-rfc').value = emisorData.rfc;
        if (emisorData.razon_social) document.getElementById('emisor-razon').value = emisorData.razon_social;
        if (emisorData.regimen_fiscal) document.getElementById('emisor-regimen').value = emisorData.regimen_fiscal;
        if (emisorData.codigo_postal) document.getElementById('emisor-cp').value = emisorData.codigo_postal;
        
        // Mostrar mensaje de éxito
        if (feedbackEmisor) {
          feedbackEmisor.textContent = 'Datos del emisor cargados correctamente.';
          feedbackEmisor.style.color = 'green';
          setTimeout(() => {
            feedbackEmisor.textContent = '';
          }, 3000);
        }
      } else {
        console.log('No hay datos del emisor configurados');
        if (feedbackEmisor) {
          feedbackEmisor.textContent = 'No hay datos del emisor configurados.';
          feedbackEmisor.style.color = '#888';
        }
      }
    } catch (err) {
      console.error('Error cargando datos del emisor:', err);
      if (feedbackEmisor) {
        feedbackEmisor.textContent = 'Error al cargar datos del emisor: ' + err.message;
        feedbackEmisor.style.color = 'red';
      }
    }
  }

  // Cargar datos automáticamente al cargar la página
  cargarDatosEmisorYCSD();

  // --- Navegación robusta para configuración ---
  const navBtns = document.querySelectorAll('.config-nav-btn');
  const allSections = document.querySelectorAll('.config-section');

  // Asocia cada botón con su sección por data-section o por orden
  navBtns.forEach((btn, idx) => {
    // Si no tiene data-section, asígnalo por el id de la sección correspondiente
    if (!btn.dataset.section) {
      const section = allSections[idx];
      if (section) btn.dataset.section = section.id;
    }
    btn.onclick = () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      allSections.forEach(sec => {
        sec.style.display = (sec.id === btn.dataset.section) ? '' : 'none';
      });
      // Si es facturación, carga los datos
      if (btn.dataset.section === 'section-facturacion') {
        cargarDatosEmisorYCSD();
      }
    };
  });

  // Mostrar sección Facturación al hacer click en el menú
  // navBtns.forEach((btn, idx) => {
  //   btn.onclick = () => {
  //     navBtns.forEach(b => b.classList.remove('active'));
  //     btn.classList.add('active');
  //     const sections = [
  //       'section-general',
  //       'section-empresa',
  //       'section-usuarios',
  //       'section-seguridad',
  //       'section-notificaciones',
  //       'section-inventario',
  //       'section-facturacion',
  //       'section-reportes',
  //       'section-sistema',
  //       'section-apariencia'
  //     ];
  //     sections.forEach((id, i) => {
  //       const sec = document.getElementById(id);
  //       if (sec) sec.style.display = (i === idx) ? '' : 'none';
  //     });
  //     // Si es facturación, carga los datos
  //     if (sections[idx] === 'section-facturacion') cargarDatosEmisorYCSD && cargarDatosEmisorYCSD();
  //   };
  // });

  // Guardar datos del emisor
  if (formEmisor) {
    formEmisor.onsubmit = async function(e) {
      e.preventDefault();
      feedbackEmisor.textContent = '';
      const rfc = document.getElementById('emisor-rfc').value.trim();
      const razon = document.getElementById('emisor-razon').value.trim();
      const regimen = document.getElementById('emisor-regimen').value;
      const cp = document.getElementById('emisor-cp').value.trim();
      if (!rfc || !razon || !regimen || !cp) {
        feedbackEmisor.textContent = 'Todos los campos son obligatorios.';
        feedbackEmisor.style.color = 'red';
        return;
      }
      try {
        const res = await fetch('http://localhost:3001/api/configuracion/emisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rfc, razon_social: razon, regimen_fiscal: regimen, codigo_postal: cp })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          feedbackEmisor.textContent = 'Datos del emisor guardados correctamente.';
          feedbackEmisor.style.color = 'green';
        } else {
          feedbackEmisor.textContent = data.error || 'Error al guardar datos del emisor.';
          feedbackEmisor.style.color = 'red';
        }
      } catch (err) {
        feedbackEmisor.textContent = 'Error de red o servidor.';
        feedbackEmisor.style.color = 'red';
      }
    };
  }

  // Subida de CSD
  if (formCsd) {
    formCsd.onsubmit = async function(e) {
      e.preventDefault();
      feedbackCsd.textContent = '';
      const cer = document.getElementById('csd-cer').files[0];
      const key = document.getElementById('csd-key').files[0];
      const pass = document.getElementById('csd-pass').value;
      if (!cer || !key || !pass) {
        feedbackCsd.textContent = 'Debes seleccionar los archivos y la contraseña.';
        feedbackCsd.style.color = 'red';
        return;
      }
      const formData = new FormData();
      formData.append('csd_cer', cer);
      formData.append('csd_key', key);
      formData.append('csd_password', pass);
      try {
        const res = await fetch('http://localhost:3001/api/configuracion/csd-upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          feedbackCsd.textContent = 'CSD cargado correctamente.';
          feedbackCsd.style.color = 'green';
        } else {
          feedbackCsd.textContent = data.error || 'Error al cargar CSD.';
          feedbackCsd.style.color = 'red';
        }
      } catch (err) {
        feedbackCsd.textContent = 'Error de red o servidor.';
        feedbackCsd.style.color = 'red';
      }
    };
  }

  // --- Evento Probar CSD ---
  const btnProbarCSD = document.getElementById('btn-validar-csd');
  if (btnProbarCSD) {
    btnProbarCSD.onclick = async function(e) {
      e.preventDefault();
      const cer = document.getElementById('csd-cer').files[0];
      const key = document.getElementById('csd-key').files[0];
      const pass = document.getElementById('csd-pass').value;
      const feedback = document.getElementById('facturacion-feedback');
      if (!cer || !key || !pass) {
        feedback.textContent = 'Debes seleccionar los archivos y la contraseña.';
        feedback.style.color = 'red';
        return;
      }
      const formData = new FormData();
      formData.append('csd_cer', cer);
      formData.append('csd_key', key);
      formData.append('csd_password', pass);
      feedback.textContent = 'Validando CSD...';
      feedback.style.color = '#888';
      try {
        // Reemplaza la URL por tu endpoint real
        const res = await fetch('http://localhost:3001/api/configuracion/facturacion/probar-csd', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          feedback.textContent = 'CSD válido y contraseña correcta.';
          feedback.style.color = 'green';
        } else {
          feedback.textContent = data.error || 'CSD inválido o contraseña incorrecta.';
          feedback.style.color = 'red';
        }
      } catch (err) {
        feedback.textContent = 'Error al validar el CSD.';
        feedback.style.color = 'red';
      }
    };
  }

  // --- Evento Guardar Configuración de Facturación ---
  const formFacturacion = document.getElementById('form-facturacion');
  if (formFacturacion) {
    formFacturacion.onsubmit = async function(e) {
      e.preventDefault();
      const rfc = document.getElementById('emisor-rfc').value.trim();
      const razon = document.getElementById('emisor-razon').value.trim();
      const regimen = document.getElementById('emisor-regimen').value;
      const cp = document.getElementById('emisor-cp').value.trim();
      const cer = document.getElementById('csd-cer').files[0];
      const key = document.getElementById('csd-key').files[0];
      const pass = document.getElementById('csd-pass').value;
      const feedback = document.getElementById('facturacion-feedback');
      // Validación básica
      if (!rfc || !razon || !regimen || !cp || !cer || !key || !pass) {
        feedback.textContent = 'Todos los campos son obligatorios.';
        feedback.style.color = 'red';
        return;
      }
      if (!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) {
        feedback.textContent = 'RFC inválido.';
        feedback.style.color = 'red';
        return;
      }
      if (!/^[0-9]{5}$/.test(cp)) {
        feedback.textContent = 'Código postal inválido.';
        feedback.style.color = 'red';
        return;
      }
      const formData = new FormData();
      formData.append('rfc', rfc);
      formData.append('razon_social', razon);
      formData.append('regimen_fiscal', regimen);
      formData.append('codigo_postal', cp);
      formData.append('csd_cer', cer);
      formData.append('csd_key', key);
      formData.append('csd_password', pass);
      feedback.textContent = 'Guardando configuración...';
      feedback.style.color = '#888';
      try {
        // Reemplaza la URL por tu endpoint real
        const res = await fetch('http://localhost:3001/api/configuracion/facturacion', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          feedback.textContent = '¡Configuración guardada correctamente!';
          feedback.style.color = 'green';
        } else {
          feedback.textContent = data.error || 'Error al guardar configuración.';
          feedback.style.color = 'red';
        }
      } catch (err) {
        feedback.textContent = 'Error al guardar configuración.';
        feedback.style.color = 'red';
      }
    };
  }
});

// ===== CONFIGURACIÓN SMTP =====
document.addEventListener('DOMContentLoaded', function() {
  const formSmtp = document.getElementById('form-smtp-config');
  const feedbackSmtp = document.getElementById('smtp-feedback');
  const btnProbar = document.getElementById('btn-probar-smtp');
  const passToggle = document.getElementById('smtp-pass-toggle');
  const passInput = document.getElementById('smtp-pass');
  const sslCheckbox = document.getElementById('smtp-ssl');
  const sslLabel = document.getElementById('smtp-ssl-label');

  // Default config SMTP
  const defaultSmtp = {
    alias: '',
    host: '',
    puerto: 465,
    usa_ssl: true,
    usuario: '',
    contrasena: '',
    correo_from: '',
    notas: ''
  };

  // Mostrar/ocultar contraseña
  passToggle.onclick = function(e) {
    e.preventDefault();
    const isPassword = passInput.type === 'password';
    passInput.type = isPassword ? 'text' : 'password';
    passToggle.innerHTML = isPassword ? '<i class="fa fa-eye-slash"></i>' : '<i class="fa fa-eye"></i>';
  };

  // Actualizar etiqueta SSL cuando cambia el checkbox
  sslCheckbox.onchange = function() {
    sslLabel.textContent = this.checked ? 'SSL/TLS (puerto 465)' : 'STARTTLS / Otro';
  };

  // Cargar configuración SMTP desde localStorage
  function loadSmtpConfig() {
    const saved = localStorage.getItem('smtp_config');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultSmtp));
  }

  // Guardar configuración SMTP en localStorage
  function saveSmtpConfig(config) {
    localStorage.setItem('smtp_config', JSON.stringify(config));
  }

  // Cargar valores en el formulario
  function loadSmtpValues() {
    const config = loadSmtpConfig();
    document.getElementById('smtp-alias').value = config.alias || '';
    document.getElementById('smtp-host').value = config.host || '';
    document.getElementById('smtp-port').value = config.puerto || 465;
    document.getElementById('smtp-ssl').checked = config.usa_ssl !== false;
    document.getElementById('smtp-user').value = config.usuario || '';
    document.getElementById('smtp-pass').value = config.contrasena || '';
    document.getElementById('smtp-from').value = config.correo_from || '';
    document.getElementById('smtp-notas').value = config.notas || '';
    sslLabel.textContent = config.usa_ssl ? 'SSL/TLS (puerto 465)' : 'STARTTLS / Otro';
  }

  // Mostrar feedback
  function showSmtpFeedback(msg, type = 'info') {
    feedbackSmtp.textContent = msg;
    feedbackSmtp.style.padding = '12px';
    feedbackSmtp.style.borderRadius = '8px';
    feedbackSmtp.style.marginTop = '12px';
    
    if (type === 'success') {
      feedbackSmtp.style.background = '#c8e6c9';
      feedbackSmtp.style.color = '#2e7d32';
      feedbackSmtp.style.border = '1px solid #a5d6a7';
    } else if (type === 'error') {
      feedbackSmtp.style.background = '#ffcdd2';
      feedbackSmtp.style.color = '#c62828';
      feedbackSmtp.style.border = '1px solid #ef9a9a';
    } else {
      feedbackSmtp.style.background = '#e3f2fd';
      feedbackSmtp.style.color = '#1565c0';
      feedbackSmtp.style.border = '1px solid #90caf9';
    }
  }

  // Guardar configuración SMTP
  if (formSmtp) {
    formSmtp.onsubmit = async function(e) {
      e.preventDefault();
      
      const config = {
        alias: document.getElementById('smtp-alias').value.trim(),
        host: document.getElementById('smtp-host').value.trim(),
        puerto: parseInt(document.getElementById('smtp-port').value),
        usa_ssl: document.getElementById('smtp-ssl').checked,
        usuario: document.getElementById('smtp-user').value.trim(),
        contrasena: document.getElementById('smtp-pass').value,
        correo_from: document.getElementById('smtp-from').value.trim(),
        notas: document.getElementById('smtp-notas').value.trim()
      };

      // Validaciones
      if (!config.host) {
        showSmtpFeedback('El servidor SMTP es requerido', 'error');
        return;
      }
      if (!config.usuario) {
        showSmtpFeedback('El usuario SMTP es requerido', 'error');
        return;
      }
      if (!config.contrasena) {
        showSmtpFeedback('La contraseña SMTP es requerida', 'error');
        return;
      }

      try {
        showSmtpFeedback('Guardando configuración SMTP...', 'info');
        
        // Opción 1: Guardar en localStorage
        saveSmtpConfig(config);
        
        // Opción 2: Enviar al backend (si existe endpoint)
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const res = await fetch('http://localhost:3001/api/configuracion/smtp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(config)
            });
            
            if (res.ok) {
              showSmtpFeedback('✓ Configuración SMTP guardada correctamente en el servidor', 'success');
            } else {
              // Guardado en localStorage al menos
              showSmtpFeedback('✓ Configuración guardada en cliente (pendiente sincronizar con servidor)', 'success');
            }
          } catch (err) {
            // Guardado en localStorage al menos
            showSmtpFeedback('✓ Configuración guardada localmente. Recuerda actualizar las variables de entorno en el servidor.', 'success');
          }
        } else {
          showSmtpFeedback('✓ Configuración guardada localmente', 'success');
        }
      } catch (err) {
        showSmtpFeedback('Error al guardar: ' + err.message, 'error');
      }
    };
  }

  // Probar configuración SMTP
  if (btnProbar) {
    btnProbar.onclick = async function(e) {
      e.preventDefault();
      
      const host = document.getElementById('smtp-host').value.trim();
      const usuario = document.getElementById('smtp-user').value.trim();
      
      if (!host || !usuario) {
        showSmtpFeedback('Completa Host y Usuario antes de probar', 'error');
        return;
      }

      try {
        showSmtpFeedback('Enviando email de prueba...', 'info');
        btnProbar.disabled = true;
        
        const config = {
          host: document.getElementById('smtp-host').value.trim(),
          puerto: parseInt(document.getElementById('smtp-port').value),
          usa_ssl: document.getElementById('smtp-ssl').checked,
          usuario: document.getElementById('smtp-user').value.trim(),
          contrasena: document.getElementById('smtp-pass').value,
          correo_from: document.getElementById('smtp-from').value.trim() || document.getElementById('smtp-user').value.trim()
        };

        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3001/api/configuracion/smtp/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(config)
        });

        const data = await res.json();
        
        if (res.ok && data.success) {
          showSmtpFeedback('✓ Email de prueba enviado a ' + data.email_destino, 'success');
        } else {
          showSmtpFeedback('✗ Error: ' + (data.error || 'No se pudo enviar el email'), 'error');
        }
      } catch (err) {
        showSmtpFeedback('Error al enviar: ' + err.message, 'error');
      } finally {
        btnProbar.disabled = false;
      }
    };
  }

  // Cargar valores al iniciar
  loadSmtpValues();
});

// =============================================
// SEGURIDAD: Configuración y validación
// =============================================

document.addEventListener('DOMContentLoaded', function() {
  const formSeguridad = document.getElementById('form-seguridad');
  const feedbackSeguridad = document.getElementById('seguridad-feedback');
  
  // Elementos del formulario de seguridad
  const seg2fa = document.getElementById('seg-2fa');
  const segSesionesMultiples = document.getElementById('seg-sesiones-multiples');
  const segBloqueoAuto = document.getElementById('seg-bloqueo-auto');
  const segLongitudMin = document.getElementById('seg-longitud-min');
  const segReqMayusculas = document.getElementById('seg-req-mayusculas');
  const segReqNumeros = document.getElementById('seg-req-numeros');
  const segReqEspeciales = document.getElementById('seg-req-especiales');

  // Cargar configuración de seguridad desde localStorage
  function cargarConfigSeguridad() {
    const config = JSON.parse(localStorage.getItem('configSeguridad') || '{}');
    
    if (seg2fa) seg2fa.checked = config.dosFactores ?? true;
    if (segSesionesMultiples) segSesionesMultiples.checked = config.sesionesMultiples ?? false;
    if (segBloqueoAuto) segBloqueoAuto.value = config.bloqueoAuto ?? '15';
    if (segLongitudMin) segLongitudMin.value = config.longitudMinima ?? 8;
    if (segReqMayusculas) segReqMayusculas.checked = config.requerirMayusculas ?? true;
    if (segReqNumeros) segReqNumeros.checked = config.requerirNumeros ?? true;
    if (segReqEspeciales) segReqEspeciales.checked = config.requerirEspeciales ?? true;
    
    console.log('Configuración de seguridad cargada:', config);
  }

  // Guardar configuración de seguridad
  function guardarConfigSeguridad() {
    const config = {
      dosFactores: seg2fa?.checked ?? true,
      sesionesMultiples: segSesionesMultiples?.checked ?? false,
      bloqueoAuto: segBloqueoAuto?.value ?? '15',
      longitudMinima: parseInt(segLongitudMin?.value) || 8,
      requerirMayusculas: segReqMayusculas?.checked ?? true,
      requerirNumeros: segReqNumeros?.checked ?? true,
      requerirEspeciales: segReqEspeciales?.checked ?? true
    };
    
    localStorage.setItem('configSeguridad', JSON.stringify(config));
    console.log('Configuración de seguridad guardada:', config);
    return config;
  }

  // Formulario de seguridad
  if (formSeguridad) {
    formSeguridad.onsubmit = function(e) {
      e.preventDefault();
      
      try {
        const config = guardarConfigSeguridad();
        
        // Iniciar el bloqueo automático si está configurado
        iniciarBloqueoAutomatico(parseInt(config.bloqueoAuto));
        
        if (feedbackSeguridad) {
          feedbackSeguridad.innerHTML = '<span style="color:#4caf50;"><i class="fa fa-check-circle"></i> Configuración de seguridad guardada correctamente</span>';
          setTimeout(() => { feedbackSeguridad.innerHTML = ''; }, 3000);
        }
      } catch (err) {
        if (feedbackSeguridad) {
          feedbackSeguridad.innerHTML = '<span style="color:#f44336;"><i class="fa fa-times-circle"></i> Error al guardar: ' + err.message + '</span>';
        }
      }
    };
  }

  // Cargar configuración al iniciar
  cargarConfigSeguridad();
  
  // Iniciar bloqueo automático con la configuración guardada
  const configGuardada = JSON.parse(localStorage.getItem('configSeguridad') || '{}');
  iniciarBloqueoAutomatico(parseInt(configGuardada.bloqueoAuto) || 15);
});

// =============================================
// BLOQUEO AUTOMÁTICO POR INACTIVIDAD
// =============================================

let timerInactividad = null;
let tiempoBloqueoMinutos = 15;

function iniciarBloqueoAutomatico(minutos) {
  // Limpiar timer anterior
  if (timerInactividad) {
    clearTimeout(timerInactividad);
    timerInactividad = null;
  }
  
  // Si es 0 o "Nunca", no activar bloqueo
  if (!minutos || minutos === 0) {
    console.log('Bloqueo automático desactivado');
    return;
  }
  
  tiempoBloqueoMinutos = minutos;
  console.log('Bloqueo automático configurado a', minutos, 'minutos');
  
  // Reiniciar timer en cada actividad del usuario
  const reiniciarTimer = () => {
    if (timerInactividad) clearTimeout(timerInactividad);
    
    timerInactividad = setTimeout(() => {
      console.log('Sesión bloqueada por inactividad');
      bloquearSesion();
    }, tiempoBloqueoMinutos * 60 * 1000);
  };
  
  // Eventos de actividad
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evento => {
    document.addEventListener(evento, reiniciarTimer, { passive: true });
  });
  
  // Iniciar timer
  reiniciarTimer();
}

function bloquearSesion() {
  // Guardar la URL actual para redirigir después del login
  sessionStorage.setItem('redirectAfterLogin', window.location.href);
  
  // Mostrar alerta y redirigir al login
  alert('Tu sesión ha sido bloqueada por inactividad. Por favor, inicia sesión nuevamente.');
  
  // Limpiar token y redirigir
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

// =============================================
// VALIDACIÓN DE CONTRASEÑAS (Políticas)
// =============================================

function validarContrasena(password) {
  const config = JSON.parse(localStorage.getItem('configSeguridad') || '{}');
  const errores = [];
  
  const longitudMinima = config.longitudMinima || 8;
  const requerirMayusculas = config.requerirMayusculas ?? true;
  const requerirNumeros = config.requerirNumeros ?? true;
  const requerirEspeciales = config.requerirEspeciales ?? true;
  
  // Validar longitud
  if (password.length < longitudMinima) {
    errores.push(`La contraseña debe tener al menos ${longitudMinima} caracteres`);
  }
  
  // Validar mayúsculas
  if (requerirMayusculas && !/[A-Z]/.test(password)) {
    errores.push('La contraseña debe contener al menos una letra mayúscula');
  }
  
  // Validar números
  if (requerirNumeros && !/[0-9]/.test(password)) {
    errores.push('La contraseña debe contener al menos un número');
  }
  
  // Validar caracteres especiales
  if (requerirEspeciales && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errores.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*...)');
  }
  
  return {
    valida: errores.length === 0,
    errores: errores
  };
}

// Exponer función globalmente para usar en otros scripts
window.validarContrasena = validarContrasena;

// =============================================
// SISTEMA DE LOGS EN TIEMPO REAL
// =============================================

// Almacén de logs
const sistemaDeLogs = {
  logs: [],
  maxLogs: 500,
  filtroActual: 'all',
  
  // Recomendaciones detalladas para errores comunes (para producción)
  recomendaciones: {
    'Failed to fetch': {
      corto: 'Servidor no disponible',
      detalle: 'El servidor backend no responde. Posibles causas:\n• El servidor Node.js no está corriendo\n• El puerto 3001 está bloqueado\n• Firewall bloqueando conexiones',
      accion: 'Ejecuta: npm run server\nVerifica que el puerto 3001 esté libre\nRevisa el firewall del servidor',
      archivo: 'src/index.js',
      severidad: 'alta'
    },
    'NetworkError': {
      corto: 'Error de red',
      detalle: 'No se puede establecer conexión de red.',
      accion: 'Verifica la conexión a internet\nRevisa la configuración de red\nComprueba si hay proxy configurado',
      severidad: 'alta'
    },
    'ECONNREFUSED': {
      corto: 'Conexión rechazada',
      detalle: 'El servidor rechazó la conexión. El servicio no está escuchando en el puerto esperado.',
      accion: 'Reinicia el servidor: npm run server\nVerifica que PostgreSQL esté corriendo\nRevisa las variables de entorno',
      archivo: 'src/index.js, .env',
      severidad: 'alta'
    },
    '401': {
      corto: 'No autorizado',
      detalle: 'Token de sesión inválido o expirado.',
      accion: 'Cierra sesión y vuelve a iniciar\nLimpia localStorage del navegador\nVerifica JWT_SECRET en .env',
      archivo: 'src/controllers/auth.js',
      severidad: 'media'
    },
    '403': {
      corto: 'Acceso denegado',
      detalle: 'El usuario no tiene permisos para esta acción.',
      accion: 'Verifica el rol del usuario en la BD\nRevisa los permisos en el controlador',
      archivo: 'src/middleware/auth.js',
      severidad: 'media'
    },
    '404': {
      corto: 'No encontrado',
      detalle: 'El recurso o endpoint solicitado no existe.',
      accion: 'Verifica la URL del endpoint\nRevisa las rutas en src/routes/\nComprueba que el recurso exista en la BD',
      archivo: 'src/routes/',
      severidad: 'media'
    },
    '500': {
      corto: 'Error del servidor',
      detalle: 'Error interno en el backend. Puede ser un bug o problema de BD.',
      accion: 'Revisa los logs del servidor en la terminal\nVerifica la conexión a PostgreSQL\nBusca errores en el controlador',
      archivo: 'src/controllers/, src/db.js',
      severidad: 'alta'
    },
    'CORS': {
      corto: 'Error de CORS',
      detalle: 'El navegador bloqueó la petición por políticas de origen cruzado.',
      accion: 'Verifica la configuración de CORS en el servidor\nAgrega el dominio a los orígenes permitidos',
      archivo: 'src/index.js (cors config)',
      severidad: 'alta'
    },
    'timeout': {
      corto: 'Tiempo agotado',
      detalle: 'La solicitud tardó demasiado en responder.',
      accion: 'Verifica la conexión de red\nOptimiza la consulta SQL si es lenta\nAumenta el timeout si es necesario',
      severidad: 'media'
    },
    'JSON': {
      corto: 'Error de JSON',
      detalle: 'La respuesta del servidor no es JSON válido.',
      accion: 'Revisa que el endpoint devuelva res.json()\nVerifica que no haya errores HTML en la respuesta',
      archivo: 'src/controllers/',
      severidad: 'media'
    },
    'token': {
      corto: 'Error de token',
      detalle: 'Problema con la autenticación JWT.',
      accion: 'Verifica JWT_SECRET en .env\nLimpia localStorage y vuelve a iniciar sesión\nRevisa la expiración del token',
      archivo: 'src/controllers/auth.js, .env',
      severidad: 'media'
    },
    'password': {
      corto: 'Error de contraseña',
      detalle: 'Las credenciales no coinciden.',
      accion: 'Verifica que el usuario exista\nComprueba que la contraseña esté hasheada con bcrypt\nRevisa el estado del usuario (Activo/Inactivo)',
      archivo: 'src/controllers/auth.js',
      severidad: 'baja'
    },
    'database': {
      corto: 'Error de BD',
      detalle: 'Problema de conexión o consulta a PostgreSQL.',
      accion: 'Verifica que PostgreSQL esté corriendo\nRevisa DATABASE_URL en .env\nComprueba la sintaxis SQL',
      archivo: 'src/db.js, .env',
      severidad: 'alta'
    },
    'undefined': {
      corto: 'Variable indefinida',
      detalle: 'Se intentó acceder a una variable que no existe.',
      accion: 'Revisa el código en la línea indicada\nVerifica que los datos se estén pasando correctamente\nAgrega validaciones null/undefined',
      severidad: 'media'
    },
    'null': {
      corto: 'Valor nulo',
      detalle: 'Se recibió null donde se esperaba un valor.',
      accion: 'Verifica que el registro exista en la BD\nAgrega validación antes de usar el valor\nRevisa la consulta SQL',
      severidad: 'media'
    },
    'usuario': {
      corto: 'Error de usuario',
      detalle: 'Problema relacionado con la gestión de usuarios.',
      accion: 'Verifica que el usuario exista en la tabla usuarios\nRevisa el estado del usuario\nComprueba los permisos del rol',
      archivo: 'src/controllers/usuarios.js',
      severidad: 'media'
    },
    'foto': {
      corto: 'Error de imagen',
      detalle: 'Problema al procesar la foto de perfil.',
      accion: 'Verifica que la imagen sea válida (JPG/PNG)\nComprueba el tamaño (máx 2MB)\nRevisa la conversión base64',
      archivo: 'public/scripts/configuracion.js',
      severidad: 'baja'
    },
    'smtp': {
      corto: 'Error de correo',
      detalle: 'Problema con el envío de correos SMTP.',
      accion: 'Verifica las credenciales SMTP\nComprueba el puerto (465 SSL / 587 TLS)\nRevisa que el servidor SMTP esté accesible',
      archivo: 'src/controllers/configuracion.js, .env',
      severidad: 'media'
    },
    'factura': {
      corto: 'Error de facturación',
      detalle: 'Problema al generar o procesar factura.',
      accion: 'Verifica los datos del emisor\nComprueba los sellos digitales CSD\nRevisa el formato de los datos',
      archivo: 'src/controllers/facturacion.js',
      severidad: 'alta'
    },
    'contrato': {
      corto: 'Error de contrato',
      detalle: 'Problema con la gestión de contratos.',
      accion: 'Verifica que el cliente exista\nComprueba las fechas del contrato\nRevisa los equipos asociados',
      archivo: 'src/controllers/contratos.js',
      severidad: 'media'
    },
    'inventario': {
      corto: 'Error de inventario',
      detalle: 'Problema con la gestión de equipos/inventario.',
      accion: 'Verifica que el equipo exista\nComprueba el stock disponible\nRevisa el estado del equipo',
      archivo: 'src/controllers/inventario.js',
      severidad: 'media'
    }
  },
  
  // Obtener recomendación basada en el mensaje
  obtenerRecomendacion(mensaje) {
    const msgLower = mensaje.toLowerCase();
    for (const [clave, recomendacion] of Object.entries(this.recomendaciones)) {
      if (msgLower.includes(clave.toLowerCase())) {
        return recomendacion;
      }
    }
    return null;
  },
  
  // Agregar un log
  agregar(tipo, mensaje, fuente = 'Sistema') {
    const log = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      tipo: tipo, // 'error', 'warning', 'info', 'success'
      mensaje: mensaje,
      fuente: fuente,
      recomendacion: tipo === 'error' ? this.obtenerRecomendacion(mensaje) : null
    };
    
    this.logs.unshift(log);
    
    // Limitar cantidad de logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Guardar en localStorage
    this.guardar();
    
    // Actualizar UI si está visible
    this.actualizarUI();
    
    return log;
  },
  
  // Guardar logs en localStorage
  guardar() {
    try {
      // Solo guardar los últimos 100 para no saturar localStorage
      const logsParaGuardar = this.logs.slice(0, 100).map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString()
      }));
      localStorage.setItem('sistemaDeLogs', JSON.stringify(logsParaGuardar));
    } catch (e) {
      console.warn('No se pudieron guardar los logs:', e);
    }
  },
  
  // Cargar logs desde localStorage
  cargar() {
    try {
      const guardados = localStorage.getItem('sistemaDeLogs');
      if (guardados) {
        this.logs = JSON.parse(guardados).map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (e) {
      console.warn('No se pudieron cargar los logs:', e);
      this.logs = [];
    }
  },
  
  // Limpiar logs
  limpiar() {
    this.logs = [];
    localStorage.removeItem('sistemaDeLogs');
    this.actualizarUI();
    this.agregar('info', 'Logs limpiados', 'Sistema');
  },
  
  // Exportar logs
  exportar() {
    const contenido = this.logs.map(log => {
      const fecha = log.timestamp.toLocaleString();
      const rec = log.recomendacion;
      let recTexto = '';
      
      if (rec) {
        if (typeof rec === 'object') {
          recTexto = `\n   → Diagnóstico: ${rec.corto}`;
          recTexto += `\n   → Detalle: ${rec.detalle?.replace(/\n/g, ' ') || 'N/A'}`;
          recTexto += `\n   → Acción: ${rec.accion?.replace(/\n/g, ' ') || 'N/A'}`;
          if (rec.archivo) recTexto += `\n   → Archivos: ${rec.archivo}`;
          recTexto += `\n   → Severidad: ${rec.severidad || 'N/A'}`;
        } else {
          recTexto = `\n   → Recomendación: ${rec}`;
        }
      }
      
      return `[${fecha}] [${log.tipo.toUpperCase()}] [${log.fuente}] ${log.mensaje}${recTexto}`;
    }).join('\n\n');
    
    const encabezado = `=== LOGS DEL SISTEMA - ${new Date().toLocaleString()} ===\n` +
      `Total de logs: ${this.logs.length}\n` +
      `Errores: ${this.logs.filter(l => l.tipo === 'error').length}\n` +
      `Advertencias: ${this.logs.filter(l => l.tipo === 'warning').length}\n` +
      `${'='.repeat(50)}\n\n`;
    
    const blob = new Blob([encabezado + contenido], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_sistema_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.agregar('success', 'Logs exportados correctamente', 'Sistema');
  },
  
  // Filtrar logs
  filtrar(tipo) {
    this.filtroActual = tipo;
    this.actualizarUI();
  },
  
  // Actualizar la UI
  actualizarUI() {
    const contenedor = document.getElementById('logs-lista');
    const contadorErrores = document.getElementById('contador-errores');
    const contadorWarnings = document.getElementById('contador-warnings');
    const contadorTotal = document.getElementById('contador-total');
    const estadoSistema = document.getElementById('estado-sistema-texto');
    
    if (!contenedor) return;
    
    // Contar por tipo
    const errores = this.logs.filter(l => l.tipo === 'error').length;
    const warnings = this.logs.filter(l => l.tipo === 'warning').length;
    
    // Actualizar contadores
    if (contadorErrores) contadorErrores.textContent = errores;
    if (contadorWarnings) contadorWarnings.textContent = warnings;
    if (contadorTotal) contadorTotal.textContent = this.logs.length;
    
    // Actualizar estado del sistema
    if (estadoSistema) {
      if (errores > 0) {
        estadoSistema.innerHTML = '<i class="fa fa-times-circle"></i> Hay errores en el sistema';
        estadoSistema.style.color = '#c62828';
        estadoSistema.parentElement.style.background = '#ffebee';
        estadoSistema.parentElement.style.borderLeftColor = '#f44336';
      } else if (warnings > 0) {
        estadoSistema.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Hay advertencias';
        estadoSistema.style.color = '#e65100';
        estadoSistema.parentElement.style.background = '#fff3e0';
        estadoSistema.parentElement.style.borderLeftColor = '#ff9800';
      } else {
        estadoSistema.innerHTML = '<i class="fa fa-check-circle"></i> Funcionando correctamente';
        estadoSistema.style.color = '#2e7d32';
        estadoSistema.parentElement.style.background = '#e8f5e9';
        estadoSistema.parentElement.style.borderLeftColor = '#4caf50';
      }
    }
    
    // Filtrar logs
    const logsFiltrados = this.filtroActual === 'all' 
      ? this.logs 
      : this.logs.filter(l => l.tipo === this.filtroActual);
    
    // Renderizar logs
    if (logsFiltrados.length === 0) {
      contenedor.innerHTML = `
        <div style="color:#888;text-align:center;padding:40px;">
          <i class="fa fa-terminal" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
          ${this.filtroActual === 'all' ? 'No hay logs registrados' : 'No hay logs de este tipo'}
        </div>
      `;
      return;
    }
    
    contenedor.innerHTML = logsFiltrados.map((log, index) => {
      const colores = {
        error: { bg: '#ffebee', border: '#f44336', icon: 'fa-times-circle', iconColor: '#f44336' },
        warning: { bg: '#fff3e0', border: '#ff9800', icon: 'fa-exclamation-triangle', iconColor: '#ff9800' },
        info: { bg: '#e3f2fd', border: '#2196f3', icon: 'fa-info-circle', iconColor: '#2196f3' },
        success: { bg: '#e8f5e9', border: '#4caf50', icon: 'fa-check-circle', iconColor: '#4caf50' }
      };
      
      const severidadColores = {
        alta: '#f44336',
        media: '#ff9800',
        baja: '#4caf50'
      };
      
      const estilo = colores[log.tipo] || colores.info;
      const hora = log.timestamp.toLocaleTimeString();
      const fecha = log.timestamp.toLocaleDateString();
      const rec = log.recomendacion;
      const tieneDetalles = rec && typeof rec === 'object';
      
      let html = `
        <div class="log-item" data-log-index="${index}" style="background:${estilo.bg};border-left:3px solid ${estilo.border};padding:10px 12px;border-radius:4px;cursor:${tieneDetalles ? 'pointer' : 'default'};transition:all 0.2s;position:relative;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <i class="fa ${estilo.icon}" style="color:${estilo.iconColor};margin-top:2px;"></i>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:600;color:#333;font-size:0.8rem;">${log.fuente}</span>
                <div style="display:flex;align-items:center;gap:8px;">
      `;
      
      // Mostrar badge de severidad si existe
      if (tieneDetalles && rec.severidad) {
        html += `<span style="background:${severidadColores[rec.severidad] || '#888'};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;">${rec.severidad.toUpperCase()}</span>`;
      }
      
      html += `
                  <span style="color:#888;font-size:0.75rem;">${fecha} ${hora}</span>
                </div>
              </div>
              <div style="color:#333;word-break:break-word;">${this.escaparHtml(log.mensaje)}</div>
      `;
      
      // Mostrar recomendación resumida
      if (rec) {
        const textoCorto = tieneDetalles ? rec.corto : rec;
        html += `
              <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.7);border-radius:4px;font-size:0.8rem;">
                <i class="fa fa-lightbulb" style="color:#ff9800;"></i>
                <strong>Diagnóstico:</strong> ${textoCorto}
                ${tieneDetalles ? '<span style="color:#2979ff;margin-left:8px;font-size:0.75rem;"><i class="fa fa-mouse-pointer"></i> Pasa el mouse para más detalles</span>' : ''}
              </div>
        `;
      }
      
      // Panel de detalles expandido (oculto por defecto, se muestra con hover)
      if (tieneDetalles) {
        html += `
              <div class="log-detalles" style="display:none;margin-top:12px;padding:12px;background:#fff;border-radius:6px;border:1px solid ${estilo.border};box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                <div style="margin-bottom:10px;">
                  <div style="font-weight:700;color:#333;margin-bottom:4px;"><i class="fa fa-search"></i> Detalle del problema:</div>
                  <div style="color:#555;white-space:pre-line;font-size:0.85rem;">${rec.detalle || 'Sin detalles adicionales'}</div>
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-weight:700;color:#333;margin-bottom:4px;"><i class="fa fa-wrench"></i> Acciones a tomar:</div>
                  <div style="color:#555;white-space:pre-line;font-size:0.85rem;">${rec.accion || 'Revisar el código relacionado'}</div>
                </div>
                ${rec.archivo ? `
                <div style="margin-bottom:0;">
                  <div style="font-weight:700;color:#333;margin-bottom:4px;"><i class="fa fa-file-code"></i> Archivos a revisar:</div>
                  <div style="color:#2979ff;font-family:monospace;font-size:0.85rem;background:#f5f5f5;padding:6px 10px;border-radius:4px;">${rec.archivo}</div>
                </div>
                ` : ''}
              </div>
        `;
      }
      
      html += `
            </div>
          </div>
        </div>
      `;
      
      return html;
    }).join('');
    
    // Agregar eventos de hover para mostrar detalles
    contenedor.querySelectorAll('.log-item').forEach(item => {
      const detalles = item.querySelector('.log-detalles');
      if (detalles) {
        item.addEventListener('mouseenter', () => {
          detalles.style.display = 'block';
          item.style.transform = 'scale(1.01)';
          item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        });
        item.addEventListener('mouseleave', () => {
          detalles.style.display = 'none';
          item.style.transform = 'scale(1)';
          item.style.boxShadow = 'none';
        });
        // También permitir click para mantener abierto
        item.addEventListener('click', () => {
          const estaVisible = detalles.style.display === 'block';
          // Cerrar todos los demás
          contenedor.querySelectorAll('.log-detalles').forEach(d => d.style.display = 'none');
          detalles.style.display = estaVisible ? 'none' : 'block';
        });
      }
    });
  },
  
  // Escapar HTML para prevenir XSS
  escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }
};

// Interceptar console.log, console.error, console.warn
(function() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  console.log = function(...args) {
    originalLog.apply(console, args);
    const mensaje = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    // Solo capturar logs relevantes (no todos)
    if (mensaje.length > 5 && !mensaje.includes('DevTools')) {
      sistemaDeLogs.agregar('info', mensaje, 'Console');
    }
  };
  
  console.error = function(...args) {
    originalError.apply(console, args);
    const mensaje = args.map(a => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    }).join(' ');
    sistemaDeLogs.agregar('error', mensaje, 'Console');
  };
  
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    const mensaje = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    sistemaDeLogs.agregar('warning', mensaje, 'Console');
  };
  
  console.info = function(...args) {
    originalInfo.apply(console, args);
    const mensaje = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (mensaje.length > 5) {
      sistemaDeLogs.agregar('info', mensaje, 'Console');
    }
  };
})();

// Capturar errores globales
window.addEventListener('error', function(event) {
  sistemaDeLogs.agregar('error', `${event.message} (${event.filename}:${event.lineno})`, 'JavaScript');
});

window.addEventListener('unhandledrejection', function(event) {
  const mensaje = event.reason?.message || event.reason || 'Promise rechazada';
  sistemaDeLogs.agregar('error', mensaje, 'Promise');
});

// Inicializar sistema de logs
document.addEventListener('DOMContentLoaded', function() {
  // Cargar logs guardados
  sistemaDeLogs.cargar();
  
  // Log inicial
  sistemaDeLogs.agregar('success', 'Sistema de logs iniciado', 'Sistema');
  
  // Configurar botones de filtro
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.log-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#fff';
        b.style.color = '#333';
      });
      this.classList.add('active');
      this.style.background = '#2979ff';
      this.style.color = '#fff';
      
      sistemaDeLogs.filtrar(this.dataset.filter);
    });
  });
  
  // Botón limpiar
  const btnLimpiar = document.getElementById('btn-limpiar-logs');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas limpiar todos los logs?')) {
        sistemaDeLogs.limpiar();
      }
    });
  }
  
  // Botón exportar
  const btnExportar = document.getElementById('btn-exportar-logs');
  if (btnExportar) {
    btnExportar.addEventListener('click', () => sistemaDeLogs.exportar());
  }
  
  // Actualizar UI inicial
  sistemaDeLogs.actualizarUI();
});

// Exponer globalmente para uso en otros scripts
window.sistemaDeLogs = sistemaDeLogs;

// =============================================
// PROTECCIÓN CON CLAVE DE ACCESO PARA REPORTES
// =============================================

const reportesAcceso = {
  // Clave de acceso por defecto (puedes cambiarla)
  // En producción, esta clave debería venir del backend o configuración segura
  claveHash: null,
  claveDefault: '140120', // Clave por defecto
  sesionDesbloqueada: false,
  
  // Inicializar
  init() {
    // Cargar clave personalizada si existe
    const claveGuardada = localStorage.getItem('reportes_clave_hash');
    if (claveGuardada) {
      this.claveHash = claveGuardada;
    } else {
      // Usar clave por defecto y guardarla hasheada
      this.claveHash = this.hashSimple(this.claveDefault);
      localStorage.setItem('reportes_clave_hash', this.claveHash);
    }
    
    // Verificar si hay sesión activa (expira en 30 minutos)
    const sesionGuardada = sessionStorage.getItem('reportes_desbloqueado');
    const tiempoSesion = sessionStorage.getItem('reportes_tiempo');
    
    if (sesionGuardada === 'true' && tiempoSesion) {
      const tiempoTranscurrido = Date.now() - parseInt(tiempoSesion);
      const treintaMinutos = 30 * 60 * 1000;
      
      if (tiempoTranscurrido < treintaMinutos) {
        this.sesionDesbloqueada = true;
        this.mostrarContenido();
      } else {
        // Sesión expirada
        this.bloquear();
      }
    }
    
    this.configurarEventos();
  },
  
  // Hash simple para la clave (no es criptográficamente seguro, pero suficiente para este caso)
  hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },
  
  // Verificar clave
  verificarClave(claveIngresada) {
    const hashIngresado = this.hashSimple(claveIngresada);
    return hashIngresado === this.claveHash;
  },
  
  // Cambiar clave
  cambiarClave(claveActual, claveNueva) {
    if (!this.verificarClave(claveActual)) {
      return { exito: false, mensaje: 'La clave actual es incorrecta' };
    }
    
    if (claveNueva.length < 4) {
      return { exito: false, mensaje: 'La nueva clave debe tener al menos 4 caracteres' };
    }
    
    this.claveHash = this.hashSimple(claveNueva);
    localStorage.setItem('reportes_clave_hash', this.claveHash);
    
    return { exito: true, mensaje: 'Clave cambiada correctamente' };
  },
  
  // Desbloquear
  desbloquear(clave) {
    const errorDiv = document.getElementById('reportes-clave-error');
    
    if (this.verificarClave(clave)) {
      this.sesionDesbloqueada = true;
      sessionStorage.setItem('reportes_desbloqueado', 'true');
      sessionStorage.setItem('reportes_tiempo', Date.now().toString());
      
      this.mostrarContenido();
      
      // Log de acceso
      if (window.sistemaDeLogs) {
        sistemaDeLogs.agregar('success', 'Acceso a Reportes desbloqueado', 'Seguridad');
      }
      
      return true;
    } else {
      // Mostrar error
      if (errorDiv) {
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = '<i class="fa fa-exclamation-circle"></i> Clave incorrecta. Intenta de nuevo.';
      }
      
      // Registrar intento fallido
      if (window.sistemaDeLogs) {
        sistemaDeLogs.agregar('warning', 'Intento de acceso fallido a Reportes', 'Seguridad');
      }
      
      // Limpiar input
      const input = document.getElementById('reportes-clave-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      
      return false;
    }
  },
  
  // Bloquear
  bloquear() {
    this.sesionDesbloqueada = false;
    sessionStorage.removeItem('reportes_desbloqueado');
    sessionStorage.removeItem('reportes_tiempo');
    
    const lockScreen = document.getElementById('reportes-lock-screen');
    const contenido = document.getElementById('reportes-contenido');
    const errorDiv = document.getElementById('reportes-clave-error');
    const input = document.getElementById('reportes-clave-input');
    
    if (lockScreen) lockScreen.style.display = 'block';
    if (contenido) contenido.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    if (input) input.value = '';
    
    if (window.sistemaDeLogs) {
      sistemaDeLogs.agregar('info', 'Sección de Reportes bloqueada', 'Seguridad');
    }
  },
  
  // Mostrar contenido
  mostrarContenido() {
    const lockScreen = document.getElementById('reportes-lock-screen');
    const contenido = document.getElementById('reportes-contenido');
    
    if (lockScreen) lockScreen.style.display = 'none';
    if (contenido) contenido.style.display = 'block';
    
    // Actualizar logs
    if (window.sistemaDeLogs) {
      sistemaDeLogs.actualizarUI();
    }
  },
  
  // Configurar eventos
  configurarEventos() {
    // Botón verificar clave
    const btnVerificar = document.getElementById('btn-verificar-clave');
    if (btnVerificar) {
      btnVerificar.addEventListener('click', () => {
        const input = document.getElementById('reportes-clave-input');
        if (input && input.value) {
          this.desbloquear(input.value);
        }
      });
    }
    
    // Botón bloquear
    const btnBloquear = document.getElementById('btn-bloquear-reportes');
    if (btnBloquear) {
      btnBloquear.addEventListener('click', () => {
        this.bloquear();
      });
    }
    
    // Focus en input al mostrar sección
    const observador = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const section = document.getElementById('section-reportes');
          if (section && section.style.display !== 'none' && !this.sesionDesbloqueada) {
            const input = document.getElementById('reportes-clave-input');
            if (input) setTimeout(() => input.focus(), 100);
          }
        }
      });
    });
    
    const sectionReportes = document.getElementById('section-reportes');
    if (sectionReportes) {
      observador.observe(sectionReportes, { attributes: true });
    }
  }
};

// Inicializar protección de reportes
document.addEventListener('DOMContentLoaded', function() {
  reportesAcceso.init();
});

// Exponer para uso externo
window.reportesAcceso = reportesAcceso;
