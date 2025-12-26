 
 
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
     alert(err.message); // Muestra el error específico del servidor (ej: "El correo ya está en uso.")
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
   apariencia: {
     tema: 'light',
     colorPrimario: '#2979ff',
   }
   // Puedes agregar más secciones aquí si lo deseas
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
document.getElementById('edit-nombre').value = usuarioEditando.nombre;
document.getElementById('edit-correo').value = usuarioEditando.correo;
document.getElementById('edit-rol').value = usuarioEditando.rol;
document.getElementById('edit-estado').value = usuarioEditando.estado;
document.getElementById('edit-foto').value = usuarioEditando.foto || '';
const preview = document.getElementById('edit-foto-preview');
if (usuarioEditando.foto) {
  preview.src = usuarioEditando.foto;
  preview.style.display = 'inline-block';
} else {
  preview.style.display = 'none';
}
// Limpia el input file para evitar que se quede el archivo anterior
document.getElementById('edit-foto-file').value = '';
modalEditar.style.display = 'flex';
}
closeEditar.onclick = () => { modalEditar.style.display = 'none'; };
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
  modalEditar.style.display = 'none';
  await cargarUsuarios();
  alert('Usuario actualizado correctamente');
} catch (err) {
  alert('Error al actualizar usuario');
}
};
window.onclick = function(e) {
if (e.target === modalEditar) modalEditar.style.display = 'none';
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
        document.getElementById('edit-foto').value = resizedDataUrl;
        document.getElementById('edit-foto-preview').src = resizedDataUrl;
        document.getElementById('edit-foto-preview').style.display = 'inline-block';
      } catch (resizeError) {
        alert(resizeError.message);
        e.target.value = ''; // Limpiar el input de archivo
        // Revertir al valor original si la nueva imagen falla
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
