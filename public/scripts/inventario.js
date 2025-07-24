// --- API REST para Inventario ---
const API_URL = 'http://localhost:3001/api/equipos';
// Usa el puerto real de tu backend

async function fetchEquipos() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Error al obtener inventario');
  const data = await res.json();
  console.log('Equipos recibidos del backend:', data);
  return data;
}

async function crearEquipo(data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    let errorText = await res.text();
    console.log('Respuesta error backend crearEquipo:', errorText);
    throw new Error('Error al crear equipo');
  }
  return await res.json();
}

async function actualizarEquipo(id, data) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error al actualizar equipo');
  return await res.json();
}

async function eliminarEquipo(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar equipo');
  return await res.json();
}

(function() {
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
    avatarImg.onclick = function(e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.body.addEventListener('click', function(e) {
      if (!e.target.closest('#user-menu')) dropdown.style.display = 'none';
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    };
  }
})();

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

document.addEventListener('DOMContentLoaded', function() {
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

  // Notificaciones demo
  const previewNotifs = [
    { icon: 'fa-cube', color: '#ffc107', text: 'Stock bajo: Andamios estándar (15 unidades restantes)', time: 'Hace 2h' },
    { icon: 'fa-calendar', color: '#f44336', text: 'Contrato #2024-156 vence mañana', time: 'Hace 4h' },
    { icon: 'fa-screwdriver-wrench', color: '#2979ff', text: 'Equipo #AND-4521 requiere mantenimiento urgente', time: 'Hace 6h' }
  ];

  const notifList = document.getElementById('notif-list');
  if (notifList) {
    notifList.innerHTML = previewNotifs.map(n => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 18px;">
        <span style="background:${n.color}22;color:${n.color};border-radius:8px;padding:7px 9px 7px 9px;font-size:1.1rem;"><i class="fa ${n.icon}"></i></span>
        <div style="flex:1;">
          <div style="font-size:0.99rem;font-weight:600;">${n.text}</div>
          <div style="color:#888;font-size:0.93rem;">${n.time}</div>
        </div>
      </div>
    `).join('');
  }

  const notifBell = document.getElementById('notif-bell');
  const notifDropdown = document.getElementById('notif-dropdown');
  if (notifBell && notifDropdown) {
    notifBell.onmouseenter = () => notifDropdown.style.display = 'block';
    notifBell.onmouseleave = () => setTimeout(() => { if (!notifDropdown.matches(':hover')) notifDropdown.style.display = 'none'; }, 200);
    notifDropdown.onmouseleave = () => notifDropdown.style.display = 'none';
    notifDropdown.onmouseenter = () => notifDropdown.style.display = 'block';
    notifBell.onclick = () => window.location.href = 'notificaciones.html';
  }

  // Eliminar la demo de equipos (deja solo la variable global equipos = [])
  // --- Estado global de equipos ---
  let equipos = [];

  // --- Mensajes de éxito y error ---
  function showMessage(msg, type = 'success') {
    let el = document.getElementById('msg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'msg-toast';
      el.style.position = 'fixed';
      el.style.top = '32px';
      el.style.right = '32px';
      el.style.zIndex = '9999';
      el.style.padding = '16px 28px';
      el.style.borderRadius = '10px';
      el.style.fontSize = '1.1rem';
      el.style.fontWeight = '600';
      el.style.boxShadow = '0 2px 12px #2979ff22';
      el.style.transition = 'opacity 0.3s';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'success' ? '#e6f9f0' : '#fdeaea';
    el.style.color = type === 'success' ? '#1abc9c' : '#f44336';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  // --- Renderizado de la tabla de equipos ---
  function renderEquipos() {
    const tbody = document.getElementById('equipos-tbody');
    if (!tbody) return;
    tbody.innerHTML = equipos.map((e,i) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            ${e.imagen ?
              `<img src="${e.imagen}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e3e8ef;">` :
              `<i class="fa fa-cube" style="color:#bdbdbd;font-size:1.2rem;"></i>`
            }
            <div>
              <div style="font-weight:600;">${e.nombre}</div>
              <span style="color:#888;font-size:0.95em;">${e.codigo}</span>
            </div>
          </div>
        </td>
        <td>${estadoBadge(e.estado)}</td>
        <td><i class="fa fa-location-dot"></i> ${e.ubicacion ? e.ubicacion.replace(/\n/g,'<br><span style=\'color:#888;font-size:0.95em;\'>') : ''}</span></td>
        <td>${condicionBadge(e.condicion)}</td>
        <td>${e.proximo_mantenimiento || e.mant || 'Pendiente'}</td>
        <td>$${e.tarifa_dia || e.tarifa || ''}</td>
        <td class="actions">
          <a href="#" onclick="verEquipo(${i});return false;"><i class="fa fa-qrcode"></i> Ver</a>
          <a href="#" onclick="editarEquipo(${i});return false;">Editar</a>
          <a href="#" onclick="eliminarInventario(${i});return false;" style="color:#f44336;">Eliminar</a>
        </td>
      </tr>
    `).join('');
  }

  // --- Cargar equipos desde la API ---
  async function cargarEquipos() {
    try {
      equipos = await fetchEquipos();
      renderInventario(); // <--- Esto es clave
    } catch (err) {
      alert('No se pudo cargar el inventario');
    }
  }

  cargarEquipos();

  // Modal agregar/editar producto principal
  const modalProducto = document.getElementById('modal-producto');
  const addProductoBtn = document.getElementById('add-producto-btn');
  const closeModalProducto = document.getElementById('close-modal-producto');

  if (addProductoBtn && modalProducto && closeModalProducto) {
    addProductoBtn.onclick = () => {
      // Solo limpia el formulario tradicional
      if (formComponente) formComponente.reset();
      if (invImagenPreview) {
        invImagenPreview.src = '';
        invImagenPreview.style.display = 'none';
      }
      modalProducto.style.display = 'flex';
    };
    closeModalProducto.onclick = () => {
      modalProducto.style.display = 'none';
    };
  }

  // Preview imagen producto principal
  const invImagenInput = document.getElementById('inv-imagen');
  const invImagenPreview = document.getElementById('inv-imagen-preview');
  if (invImagenInput && invImagenPreview) {
    invImagenInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          invImagenPreview.src = evt.target.result;
          invImagenPreview.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        invImagenPreview.src = '';
        invImagenPreview.style.display = 'none';
      }
    });
  }

  let editEqIndex = null;
  const equipoModal = document.getElementById('equipo-modal');
  // const addEquipoBtn = document.getElementById('add-equipo-btn'); // Este botón no existe en el HTML proporcionado
  const closeEquipoModal = document.getElementById('close-equipo-modal');
  const equipoForm = document.getElementById('equipo-form');

  // Si el botón 'add-equipo-btn' existiera, su lógica iría aquí:
  // if (addEquipoBtn && equipoModal && closeEquipoModal && equipoForm) {
  //   addEquipoBtn.onclick = () => {
  //     document.getElementById('equipo-modal-title').innerText = 'Agregar Equipo';
  //     equipoForm.reset();
  //     editEqIndex = null;
  //     equipoModal.style.display = 'flex';
  //   };
  //   closeEquipoModal.onclick = () => equipoModal.style.display = 'none';
  //   equipoForm.onsubmit = function(e) {
  //     e.preventDefault();
  //     const nombre = document.getElementById('eq-nombre').value.trim();
  //     const codigo = document.getElementById('eq-codigo').value.trim();
  //     const categoria = document.getElementById('eq-categoria').value;
  //     const estado = document.getElementById('eq-estado').value;
  //     const ubicacion = document.getElementById('eq-ubicacion').value.trim();
  //     const condicion = document.getElementById('eq-condicion').value;
  //     const tarifa = parseFloat(document.getElementById('eq-tarifa').value);
  //     const mant = document.getElementById('eq-mant').value;
  //     if(editEqIndex === null) {
  //       equipos.push({ nombre, codigo, categoria, estado, ubicacion, condicion, tarifa, mant });
  //     } else {
  //       equipos[editEqIndex] = { nombre, codigo, categoria, estado, ubicacion, condicion, tarifa, mant };
  //     }
  //     renderEquipos();
  //     equipoModal.style.display = 'none';
  //   };
  // }

  // Lógica para cerrar el modal de equipo si existe
  if (closeEquipoModal) {
    closeEquipoModal.onclick = () => equipoModal.style.display = 'none';
  }

  // Lógica para enviar el formulario de equipo si existe
  if (equipoForm) {
    equipoForm.onsubmit = async function(e) {
      e.preventDefault();
      if (editEqIndex === null) return;
      const equipo = equipos[editEqIndex];
      if (!equipo || !equipo.id_equipo) return;
      const nombre = document.getElementById('eq-nombre').value.trim();
      const clave = document.getElementById('eq-codigo').value.trim();
      const categoria = document.getElementById('eq-categoria').value;
      const estado = document.getElementById('eq-estado').value;
      const ubicacion = document.getElementById('eq-ubicacion').value.trim();
      const condicion = document.getElementById('eq-condicion').value;
      const tarifa_dia = parseFloat(document.getElementById('eq-tarifa').value);
      const proximo_mantenimiento = document.getElementById('eq-mant').value;
      const imagenInput = document.getElementById('inv-imagen');
      let data = { nombre, clave, categoria, estado, ubicacion, condicion, tarifa_dia, proximo_mantenimiento };
      // Solo si se selecciona una nueva imagen, la agregas al objeto
      if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
          data.imagen = evt.target.result;
          console.log('PUT equipo:', data);
          try {
            await actualizarEquipo(equipo.id_equipo, data);
            equipoModal.style.display = 'none';
            await cargarEquipos();
          } catch (err) {
            alert('No se pudo actualizar el producto');
          }
        };
        reader.readAsDataURL(imagenInput.files[0]);
        return; // Sal de la función, el fetch se hace en el onload
      }
      // Si no hay nueva imagen, no envíes el campo imagen
      console.log('PUT equipo:', data);
      try {
        await actualizarEquipo(equipo.id_equipo, data);
        equipoModal.style.display = 'none';
        await cargarEquipos();
      } catch (err) {
        alert('No se pudo actualizar el producto');
      }
    };
  }

  // Modal ver equipo
  const verEquipoModal = document.getElementById('ver-equipo-modal');
  const closeVerEquipoModal = document.getElementById('close-ver-equipo-modal');
  if (verEquipoModal && closeVerEquipoModal) {
    window.verEquipo = function(i) {
      const e = equipos[i];
      document.getElementById('ver-equipo-detalle').innerHTML = `
        <b>Nombre:</b> ${e.nombre}<br>
        <b>Código:</b> ${e.codigo}<br>
        <b>Categoría:</b> ${e.categoria}<br>
        <b>Estado:</b> ${e.estado}<br>
        <b>Ubicación:</b> ${e.ubicacion ? e.ubicacion.replace(/\n/g,'<br>') : ''}<br>
        <b>Condición:</b> ${e.condicion}<br>
        <b>Tarifa/Día:</b> $${e.tarifa_dia || e.tarifa || ''}<br>
        <b>Próximo Mantenimiento:</b> ${e.proximo_mantenimiento || e.mant || 'Pendiente'}<br>
      `;
      verEquipoModal.style.display = 'flex';
    };
    closeVerEquipoModal.onclick = () => verEquipoModal.style.display = 'none';
  }

  let componentesTemp = [];
  function renderComponentes() {
    const lista = document.getElementById('componentes-lista-editar');
    if (!lista) return;
    let html = '';
    if (componentesTemp.length === 0) {
      html += '<div style="color:#888;">No hay componentes agregados.</div>';
    } else {
      html += componentesTemp.map((item, idx) => `
        <div style='display:flex;align-items:center;gap:12px;background:#f7f9fb;border-radius:8px;padding:8px 12px;margin-bottom:6px;'>
          <input type='text' value='${item.nombre || ''}' placeholder='Nombre' style='width:110px;' onchange='actualizarCampoComponenteInput(${idx},"nombre",this.value)'>
          <input type='text' value='${item.clave || ''}' placeholder='Clave' style='width:90px;' onchange='actualizarCampoComponenteInput(${idx},"clave",this.value)'>
          <input type='number' value='${item.partida || ''}' placeholder='Partida' style='width:60px;' onchange='actualizarCampoComponenteInput(${idx},"partida",this.value)'>
          <input type='number' value='${item.peso || ''}' placeholder='Peso' style='width:60px;' onchange='actualizarCampoComponenteInput(${idx},"peso",this.value)'>
          <input type='number' value='${item.garantia || ''}' placeholder='Garantía' style='width:70px;' onchange='actualizarCampoComponenteInput(${idx},"garantia",this.value)'>
          <input type='number' value='${item.cantidad || ''}' placeholder='Cantidad' style='width:60px;' onchange='actualizarCampoComponenteInput(${idx},"cantidad",this.value)'>
          <input type='text' value='${item.descripcion || ''}' placeholder='Descripción' style='width:140px;' onchange='actualizarCampoComponenteInput(${idx},"descripcion",this.value)'>
          <input type='file' accept='image/*' style='width:120px;' onchange='cambiarImagenComponente(event,${idx})'>
          <img src='${item.imagen_url || 'img/default.jpg'}' alt='' style='height:38px;width:38px;object-fit:contain;border-radius:6px;border:1px solid #e3e8ef;'>
          <button onclick='eliminarComponente(${idx})' style='background:#f44336;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;'>Eliminar</button>
        </div>
      `).join('');
    }
    html += `<button type="button" id="agregar-componente-btn" style="margin-top:10px;background:#2979ff;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:1rem;font-weight:600;cursor:pointer;">Agregar Componente</button>`;
    lista.innerHTML = html;
    const agregarComponenteBtn = document.getElementById('agregar-componente-btn');
    if (agregarComponenteBtn) {
      agregarComponenteBtn.onclick = function() {
        console.log('Agregando componente...');
        componentesTemp.push({ nombre:'', clave:'', partida:'', peso:'', garantia:'', cantidad:'', descripcion:'', imagen_url:'' });
        renderComponentes();
      };
    }
  }
  // Delegación de eventos para el botón agregar-componente-btn
  const listaComponentes = document.getElementById('componentes-lista');
  if (listaComponentes) {
    listaComponentes.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'agregar-componente-btn') {
        console.log('Agregando componente...');
        componentesTemp.push({ nombre:'', clave:'', partida:'', peso:'', garantia:'', cantidad:'', descripcion:'', imagen_url:'' });
        renderComponentes();
      }
    });
  }
  window.actualizarCampoComponenteInput = function(idx, campo, valor) {
    componentesTemp[idx][campo] = valor;
  };
  // Botón para agregar nuevo componente
  // const agregarComponenteBtn = document.getElementById('agregar-componente-btn'); // Este botón no existe en el HTML proporcionado
  // if (agregarComponenteBtn) { // Este botón ya se crea en renderComponentes()
  //   agregarComponenteBtn.onclick = function() {
  //     componentesTemp.push({ nombre:'', clave:'', partida:'', peso:'', garantia:'', cantidad:'', descripcion:'', imagen_url:'' });
  //     renderComponentes();
  //   };
  // }

  window.editarComponente = function(idx) {
    const c = componentesTemp[idx];
    document.getElementById('comp-nombre').value = c.nombre;
    document.getElementById('comp-clave').value = c.clave;
    document.getElementById('comp-partida').value = c.partida;
    document.getElementById('comp-peso').value = c.peso;
    document.getElementById('comp-garantia').value = c.garantia;
    document.getElementById('comp-cantidad').value = c.cantidad;
    document.getElementById('comp-descripcion').value = c.descripcion;
    componentesTemp.splice(idx, 1); // Eliminar el componente para que se agregue de nuevo con los cambios
    renderComponentes();
  }

  const formComponente = document.getElementById('form-componente');
  // Preview imagen componente
  const compImagenInput = document.getElementById('comp-imagen');
  const compImagenPreview = document.getElementById('comp-imagen-preview');
  if (compImagenInput && compImagenPreview) {
    compImagenInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          compImagenPreview.src = evt.target.result;
          compImagenPreview.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        compImagenPreview.src = '';
        compImagenPreview.style.display = 'none';
      }
    });
  }

  if (formComponente) {
    formComponente.onsubmit = function(e) {
      e.preventDefault();
      const nombre = document.getElementById('comp-nombre').value.trim();
      const clave = document.getElementById('comp-clave').value.trim();
      const partida = document.getElementById('comp-partida').value.trim();
      const peso = document.getElementById('comp-peso').value.trim();
      const garantia = document.getElementById('comp-garantia').value.trim();
      const cantidad = document.getElementById('comp-cantidad').value.trim();
      const descripcion = document.getElementById('comp-descripcion').value.trim();
      const imagenInput = document.getElementById('comp-imagen');
      let imagen_url = '';
      if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          imagen_url = evt.target.result;
          componentesTemp.push({ nombre, clave, partida, peso, garantia, cantidad, descripcion, imagen_url });
          renderComponentes();
          formComponente.reset();
          compImagenPreview.src = '';
          compImagenPreview.style.display = 'none';
        };
        reader.readAsDataURL(imagenInput.files[0]);
      } else {
        componentesTemp.push({ nombre, clave, partida, peso, garantia, cantidad, descripcion, imagen_url: '' });
        renderComponentes();
        formComponente.reset();
        compImagenPreview.src = '';
        compImagenPreview.style.display = 'none';
      }
    };
  }
  renderComponentes();

  // --- Actualiza los cuadros de resumen con datos reales ---
  function renderResumen() {
    const total = equipos.length;
    const disponibles = equipos.filter(e => e.estado === 'Disponible').length;
    const alquilados = equipos.filter(e => e.estado === 'Alquilado').length;
    const mantenimiento = equipos.filter(e => e.estado === 'Mantenimiento').length;
    const resumenes = [
      { selector: '.summary-card .label', text: 'Total Equipos', value: total },
      { selector: '.summary-card .label', text: 'Disponibles', value: disponibles },
      { selector: '.summary-card .label', text: 'Alquilados', value: alquilados },
      { selector: '.summary-card .label', text: 'En Mantenimiento', value: mantenimiento }
    ];
    // Asume que los cuadros están en el mismo orden que en el HTML
    const cards = document.querySelectorAll('.summary-card');
    if (cards.length >= 4) {
      cards[0].querySelector('.value').textContent = total;
      cards[1].querySelector('.value').textContent = disponibles;
      cards[2].querySelector('.value').textContent = alquilados;
      cards[3].querySelector('.value').textContent = mantenimiento;
    }
  }

  // --- Renderizado de inventario tipo ficha, con imágenes de componentes y botón editar ---
  function renderInventario() {
    renderResumen();
    const lista = document.getElementById('inventario-lista');
    if (!lista) return;
    if (equipos.length === 0) {
      lista.innerHTML = '<div style="color:#888;">No hay productos en el inventario.</div>';
      return;
    }
    function estadoBadge(estado) {
      if (!estado) return '';
      const e = estado.toLowerCase();
      if (e === 'disponible') return `<span class='badge-estado badge-disponible'>Disponible</span>`;
      if (e === 'alquilado') return `<span class='badge-estado badge-alquilado'>Alquilado</span>`;
      if (e === 'mantenimiento') return `<span class='badge-estado badge-mantenimiento'>Mantenimiento</span>`;
      if (e === 'fuera de servicio') return `<span class='badge-estado badge-fueraservicio'>Fuera de Servicio</span>`;
      return `<span class='badge-estado'>${estado}</span>`;
    }
    lista.innerHTML = equipos.map((item, idx) => `
      <div class="producto-ficha">
        <div class="producto-info">
          <div class="producto-nombre">${item.nombre || ''}</div>
          <div class="producto-clave">Clave: <b>${item.clave || ''}</b></div>
          <div class="producto-medidas">
            <span>Peso: <b>${item.peso || ''}kg</b></span>
            ${item.partida ? `<span> | Partida: <b>${item.partida}</b></span>` : ''}
          </div>
          <div class="producto-condicion">Condición: <b>${item.condicion || ''}</b></div>
          <div class="producto-ubicacion">Ubicación: <b>${item.ubicacion || ''}</b></div>
          <div style="margin:8px 0 8px 0;">
            Estado: ${estadoBadge(item.estado)}
          </div>
          <div class="producto-componentes">
            <div class="comp-title">Componentes:</div>
            <ul>
              ${(item.componentes && item.componentes.length > 0)
                ? item.componentes.map(c => `
                  <li style='display:flex;align-items:center;gap:10px;'>
                    ${c.imagen_url ? `<img src='${c.imagen_url}' alt='' style='height:28px;width:28px;object-fit:contain;border-radius:4px;border:1px solid #e3e8ef;'>` : ''}
                    <span><b>${c.cantidad || 1}</b> ${c.nombre} <span class='comp-clave'>[${c.clave}]</span></span>
                  </li>`).join('')
                : '<li style="color:#888;">Sin componentes</li>'}
            </ul>
          </div>
          <div class="producto-tarifa">$${item.tarifa_dia || item.tarifa || 0} <span>Tarifa/Día</span></div>
          <div class="producto-acciones">
            <button onclick='editarEquipo(${idx})' class='btn-editar'><i class="fa fa-pen"></i> Editar</button>
            <button onclick='eliminarInventario(${idx})' class='btn-eliminar'>Eliminar</button>
          </div>
        </div>
        <div class="producto-img">
          <img src='${item.imagen || 'img/default.jpg'}' alt='${item.nombre || ''}'>
        </div>
      </div>
    `).join('');
  }

  // Lógica para abrir el modal de edición con los datos del equipo y sus componentes
  window.editarEquipo = function(i) {
    editEqIndex = i;
    document.getElementById('equipo-modal-title').innerText = 'Editar Equipo';
    const e = equipos[i];
    document.getElementById('eq-nombre').value = e.nombre;
    document.getElementById('eq-codigo').value = e.clave;
    // Si tienes categoría, puedes setearla aquí
    // document.getElementById('eq-categoria').value = e.categoria || 'Andamios';
    document.getElementById('eq-estado').value = e.estado;
    document.getElementById('eq-ubicacion').value = e.ubicacion;
    document.getElementById('eq-condicion').value = e.condicion;
    document.getElementById('eq-tarifa').value = e.tarifa_dia || e.tarifa;
    document.getElementById('eq-mant').value = e.proximo_mantenimiento || e.mant || '';
    // Imagen principal preview
    const invImagenPreview = document.getElementById('inv-imagen-preview');
    if (invImagenPreview) {
      invImagenPreview.src = e.imagen || 'img/default.jpg';
      invImagenPreview.style.display = 'block';
    }
    // Limpiar input file
    const invImagenInput = document.getElementById('inv-imagen');
    if (invImagenInput) invImagenInput.value = '';
    // Poblar componentesTemp para edición avanzada
    if (Array.isArray(e.componentes)) {
      componentesTemp = JSON.parse(JSON.stringify(e.componentes));
    } else {
      componentesTemp = [];
    }
    renderComponentes(); // <--- Esto es clave
    equipoModal.style.display = 'flex';
  };

  window.eliminarInventario = async function(idx) {
    const equipo = equipos[idx];
    if (!equipo || !equipo.id_equipo) return;
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await eliminarEquipo(equipo.id_equipo);
      await cargarEquipos();
    } catch (err) {
      alert('No se pudo eliminar el producto');
    }
  };

  // Guardar producto principal (crear)
  const guardarInventarioBtn = document.getElementById('guardar-inventario');
  if (guardarInventarioBtn) {
    guardarInventarioBtn.onclick = async function() {
      const nombre = document.getElementById('inv-nombre').value.trim();
      const clave = document.getElementById('inv-clave').value.trim();
      const partida = document.getElementById('inv-partida').value.trim();
      const peso = document.getElementById('inv-peso').value.trim();
      const garantia = document.getElementById('inv-garantia').value.trim();
      const descripcion = document.getElementById('inv-descripcion').value.trim();
      const imagenInput = document.getElementById('inv-imagen');
      const venta = document.getElementById('inv-venta').checked;
      const renta = document.getElementById('inv-renta').checked;
      if (!nombre || !clave || !partida || !peso || !garantia || !descripcion) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }
      let imagen = '';
      if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
          imagen = evt.target.result;
          const producto = { nombre, clave, partida, peso, garantia, descripcion, imagen, venta, renta, componentes: [...componentesTemp] };
          try {
            await crearEquipo(producto);
            document.getElementById('modal-producto').style.display = 'none';
            document.getElementById('form-inventario').reset();
            invImagenPreview.src = '';
            invImagenPreview.style.display = 'none';
            componentesTemp = [];
            renderComponentes();
            await cargarEquipos();
            showMessage('Producto creado exitosamente', 'success');
          } catch (err) {
            console.log('Error al crear producto:', err);
            showMessage('No se pudo crear el producto', 'error');
          }
        };
        reader.readAsDataURL(imagenInput.files[0]);
      } else {
        // Si estamos editando, conserva la imagen anterior
        imagen = (editEqIndex !== null && equipos[editEqIndex]) ? equipos[editEqIndex].imagen : '';
        const producto = { nombre, clave, partida, peso, garantia, descripcion, imagen, venta, renta, componentes: [...componentesTemp] };
        try {
          await crearEquipo(producto);
          document.getElementById('modal-producto').style.display = 'none';
          document.getElementById('form-inventario').reset();
          invImagenPreview.src = '';
          invImagenPreview.style.display = 'none';
          componentesTemp = [];
          renderComponentes();
          await cargarEquipos();
          showMessage('Producto creado exitosamente', 'success');
        } catch (err) {
          console.log('Error al crear producto:', err);
          showMessage('No se pudo crear el producto', 'error');
        }
      }
    };
  }

  // Función para agregar producto a la tabla principal
  function agregarProductoATabla(producto) {
    const nuevoEquipo = {
      nombre: producto.nombre,
      codigo: producto.clave,
      categoria: 'Andamios', // Por defecto, se puede cambiar después
      estado: 'Disponible', // Por defecto disponible
      ubicacion: 'Almacén Principal\nSucursal Centro', // Ubicación por defecto
      condicion: 'Excelente', // Condición por defecto
      tarifa: parseFloat(producto.garantia) / 100, // Usar garantía como base para tarifa
      mant: '', // Sin mantenimiento programado inicialmente
      imagen: producto.imagen // Agregar la imagen del producto
    };
    equipos.push(nuevoEquipo);
    renderEquipos();
  }
});
