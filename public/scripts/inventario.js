// --- API REST para Inventario ---
const API_URL = 'http://localhost:3001/api/equipos';
const API_PRODUCTOS_URL = 'http://localhost:3001/api/productos';
// Usa el puerto real de tu backend

// Función para verificar autenticación
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }

  // --- Modales nuevos: Componentes y Accesorios ---
  const modalComponentes = document.getElementById('modal-componentes');
  const openComponentesBtn = document.getElementById('add-componentes-btn');
  const closeComponentesBtn = document.getElementById('close-modal-componentes');
  const cmpGrid = document.getElementById('cmp-grid');
  const cmpBuscar = document.getElementById('cmp-buscar');
  const cmpCodigo = document.getElementById('cmp-codigo');
  const cmpConfirmar = document.getElementById('cmp-confirmar');
  const productoCmpGrid = document.getElementById('producto-componentes-grid');
  const openCmpFromProduct = document.getElementById('open-cmp-from-product');
  let selectedComponents = []; // {codigo, nombre, qty}
  let cmpCatalog = [];

  if (openComponentesBtn && modalComponentes && closeComponentesBtn) {
    if (openComponentesBtn) {
    openComponentesBtn.onclick = () => { window.location.href = 'agregar_productos.html'; };
  }
  if (closeComponentesBtn && modalComponentes) {
    closeComponentesBtn.onclick = () => { modalComponentes.style.display = 'none'; };
  }
    if (closeComponentesBtn && modalComponentes) {
    closeComponentesBtn.onclick = () => { modalComponentes.style.display = 'none'; };
  }
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') modalComponentes.style.display='none'; });
  }

  if (openCmpFromProduct) {
    openCmpFromProduct.onclick = () => { window.location.href = 'agregar_productos.html'; };
  }

  const modalAccesorios = document.getElementById('modal-accesorios');
  const openAccesoriosBtn = document.getElementById('add-accesorios-btn');
  const closeAccesoriosBtn = document.getElementById('close-modal-accesorios');
  const accImagenInput = document.getElementById('acc-imagen');
  const accImagenPreview = document.getElementById('acc-imagen-preview');
  if (openAccesoriosBtn && modalAccesorios && closeAccesoriosBtn) {
    openAccesoriosBtn.onclick = () => { window.location.href = 'agregar_productos.html'; };
    closeAccesoriosBtn.onclick = () => { modalAccesorios.style.display = 'none'; };
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') modalAccesorios.style.display='none'; });
  }
  if (accImagenInput && accImagenPreview) {
    accImagenInput.addEventListener('change', function(){
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = (evt)=>{ accImagenPreview.src = evt.target.result; accImagenPreview.style.display='block'; };
        reader.readAsDataURL(this.files[0]);
      } else { accImagenPreview.src=''; accImagenPreview.style.display='none'; }
    });
  }

  // --- Catálogo mock y tarjetas de selección ---
  function buildCmpCatalog(){
    const tipo = (document.querySelector('input[name="cmp-clasificacion"]:checked')||{}).value || 'venta';
    if (tipo === 'venta') {
      cmpCatalog = [
        { codigo: 1, nombre: 'Base regulable 1.5"' },
        { codigo: 150, nombre: 'Marco ligero 1.5m' },
        { codigo: 320, nombre: 'Cruceta reforzada 2.0m' },
        { codigo: 450, nombre: 'Plataforma metálica 2.5m' },
      ];
    } else {
      cmpCatalog = [
        { codigo: 1000, nombre: 'Renta general' },
        { codigo: 2000, nombre: 'Marco y cruceta' },
        { codigo: 2100, nombre: 'Marco 2.0m' },
        { codigo: 2300, nombre: 'Cruceta 2.0m' },
        { codigo: 3000, nombre: 'Multidireccional' },
        { codigo: 3100, nombre: 'Roseta 8 vías' },
      ];
    }
  }

  function renderCmpCatalog(){
    if (!cmpGrid) return;
    const term = (cmpBuscar && cmpBuscar.value || '').toLowerCase();
    const codFilter = cmpCodigo && cmpCodigo.value ? parseInt(cmpCodigo.value,10) : null;
    const list = cmpCatalog.filter(i => {
      const byName = i.nombre.toLowerCase().includes(term);
      const byCode = codFilter ? (i.codigo === codFilter) : true;
      return byName && byCode;
    });
    cmpGrid.innerHTML = list.map(i => {
      const sel = selectedComponents.find(sc => sc.codigo === i.codigo);
      const qty = sel ? sel.qty : 0;
      return `
        <div class="cmp-card" data-cod="${i.codigo}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-weight:700;">${i.nombre}</div>
            <span style="background:#2979ff22;color:#2979ff;border-radius:999px;padding:2px 8px;font-weight:700;font-size:0.85rem;">${i.codigo}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
            <div style="display:flex;gap:6px;align-items:center;">
              <button type="button" class="qty-dec" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);">-</button>
              <input class="qty-input" type="number" min="0" value="${qty}" style="width:60px;text-align:center;border:1px solid var(--border);border-radius:8px;padding:4px;" />
              <button type="button" class="qty-inc" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);">+</button>
            </div>
            <button type="button" class="toggle-select" style="background:${sel? '#1f9254':'#2979ff'};color:#fff;border:none;border-radius:8px;padding:6px 10px;">
              ${sel? 'Seleccionado':'Agregar'}
            </button>
          </div>
        </div>`;
    }).join('');
    // Bind events
    cmpGrid.querySelectorAll('.cmp-card').forEach(card => {
      const codigo = parseInt(card.getAttribute('data-cod'),10);
      card.querySelector('.qty-dec').onclick = () => updateTmpQty(codigo, -1);
      card.querySelector('.qty-inc').onclick = () => updateTmpQty(codigo, +1);
      card.querySelector('.toggle-select').onclick = () => toggleSelectCmp(codigo);
      const qtyInput = card.querySelector('.qty-input');
      qtyInput.onchange = () => setTmpQty(codigo, parseInt(qtyInput.value||'0',10));
    });
  }

  function setTmpQty(codigo, qty){
    qty = Math.max(0, qty||0);
    const found = selectedComponents.find(c => c.codigo === codigo);
    if (found) { found.qty = qty; } else if (qty>0) { const item = cmpCatalog.find(i=>i.codigo===codigo); if (item) selectedComponents.push({codigo, nombre:item.nombre, qty}); }
    renderCmpCatalog();
  }
  function updateTmpQty(codigo, delta){
    const found = selectedComponents.find(c => c.codigo === codigo);
    const base = found ? found.qty : 0;
    setTmpQty(codigo, base + delta);
  }
  function toggleSelectCmp(codigo){
    const found = selectedComponents.find(c => c.codigo === codigo);
    if (!found) { setTmpQty(codigo, 1); return; }
    // if exists and qty>0 keep, if 0 remove
    if (found.qty > 0) { /* no-op, already selected */ }
    else { selectedComponents = selectedComponents.filter(c => c.codigo !== codigo); }
    renderCmpCatalog();
  }

  if (cmpBuscar) cmpBuscar.addEventListener('input', renderCmpCatalog);
  if (cmpCodigo) cmpCodigo.addEventListener('input', renderCmpCatalog);
  document.querySelectorAll('input[name="cmp-clasificacion"]').forEach(r => r.addEventListener('change', ()=>{ buildCmpCatalog(); renderCmpCatalog(); }));

  if (cmpConfirmar) {
    if (cmpConfirmar && modalComponentes) {
      cmpConfirmar.onclick = () => {
        modalComponentes.style.display = 'none';
        renderSelectedComponentsGrid();
        showMessage('Componentes agregados al producto', 'success');
      };
    }
  }

  function renderSelectedComponentsGrid(){
    if (!productoCmpGrid) return;
    if (selectedComponents.length === 0) {
      productoCmpGrid.innerHTML = `<div style="color:#888;">Sin componentes. Usa "Agregar Componentes".</div>`;
      return;
    }
    productoCmpGrid.innerHTML = selectedComponents.map(c => `
      <div class="cmp-selected" data-cod="${c.codigo}" style="border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <div style="font-weight:700;">${c.nombre}</div>
          <span style="background:#2979ff22;color:#2979ff;border-radius:999px;padding:2px 8px;font-weight:700;font-size:0.85rem;">${c.codigo}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="qty-dec" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);">-</button>
            <input class="qty-input" type="number" min="0" value="${c.qty}" style="width:60px;text-align:center;border:1px solid var(--border);border-radius:8px;padding:4px;" />
            <button type="button" class="qty-inc" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);">+</button>
          </div>
          <button type="button" class="btn-remove" style="background:#f44336;color:#fff;border:none;border-radius:8px;padding:6px 10px;">Eliminar</button>
        </div>
      </div>`).join('');
    productoCmpGrid.querySelectorAll('.cmp-selected').forEach(card => {
      const codigo = parseInt(card.getAttribute('data-cod'),10);
      card.querySelector('.qty-dec').onclick = () => { updateTmpQty(codigo, -1); renderSelectedComponentsGrid(); };
      card.querySelector('.qty-inc').onclick = () => { updateTmpQty(codigo, +1); renderSelectedComponentsGrid(); };
      const qtyInput = card.querySelector('.qty-input');
      qtyInput.onchange = () => { setTmpQty(codigo, parseInt(qtyInput.value||'0',10)); renderSelectedComponentsGrid(); };
      card.querySelector('.btn-remove').onclick = () => { selectedComponents = selectedComponents.filter(x=>x.codigo!==codigo); renderSelectedComponentsGrid(); renderCmpCatalog(); };
    });
  }
  return token;
}

// Función para obtener headers con autenticación (sin efectos secundarios)
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchEquipos() {
  const headers = getAuthHeaders();
  const res = await fetch(API_URL, { headers });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return [];
    }
    throw new Error('Error al obtener inventario');
  }
  const data = await res.json();
  console.log('Equipos recibidos del backend:', data);
  return data;
}

async function crearEquipo(data) {
  const headers = getAuthHeaders();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
    let errorText = await res.text();
    console.log('Respuesta error backend crearEquipo:', errorText);
    throw new Error('Error al crear equipo');
  }
  return await res.json();
}

async function actualizarEquipo(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
    throw new Error('Error al actualizar equipo');
  }
  return await res.json();
}

async function eliminarEquipo(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_URL}/${id}`, { 
    method: 'DELETE',
    headers
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
    throw new Error('Error al eliminar equipo');
  }
  return await res.json();
}

// Función para cargar datos del usuario autenticado
async function loadUserData() {
  const token = localStorage.getItem('token');
  if (!token) {
    // Si no hay token, redirigir a login
    window.location.href = 'login.html';
    return;
  }

  try {
    // Verificar token con el servidor usando el endpoint correcto
    const res = await fetch('http://localhost:3001/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const userData = await res.json();
      localStorage.setItem('user', JSON.stringify(userData));
      updateUserInterface(userData);
    } else {
      // Token inválido, redirigir a login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  } catch (err) {
    console.error('Error al cargar datos del usuario:', err);
    // Si hay error de conexión, usar datos locales si existen
    const localUser = localStorage.getItem('user');
    if (localUser) {
      try {
        const userData = JSON.parse(localUser);
        updateUserInterface(userData);
      } catch (parseError) {
        console.error('Error parseando datos del usuario:', parseError);
        localStorage.removeItem('user');
        window.location.href = 'login.html';
      }
    } else {
      // No hay datos locales, redirigir a login
      window.location.href = 'login.html';
    }
  }
}

// Función para actualizar la interfaz del usuario
function updateUserInterface(user) {
  const avatarImg = document.getElementById('avatar-img');
  const avatarDropdown = document.getElementById('avatar-img-dropdown');
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
  const userEmail = document.getElementById('user-email');

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
}

// El menú de usuario se maneja automáticamente desde auth.js

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

document.addEventListener('DOMContentLoaded', async function() {
  // La autenticación se maneja automáticamente desde auth.js
  // Solo verificamos que el usuario esté autenticado
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // Los permisos se manejan desde el sistema unificado de autenticación

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

  // --- Estado global de inventario ---
  let equipos = [];
  let productos = [];

  // --- Variables de filtros y tabs (mover antes de cargarEquipos) ---
  let filtroCategoria = 'Todas las Categorías';
  let filtroEstado = 'Todos los Estados';
  let filtroBusqueda = '';
  let tabActual = 'renta';

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

  // --- Cargar inventario (equipos + productos) ---
async function fetchProductos() {
  const headers = getAuthHeaders();
  const res = await fetch(API_PRODUCTOS_URL, { headers });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return [];
    }
    console.error('Error al obtener productos:', await res.text());
    return [];
  }
  return await res.json();
}

async function cargarInventario() {
  try {
    const [eq, prod] = await Promise.all([
      fetchEquipos(),
      fetchProductos()
    ]);
    equipos = Array.isArray(eq) ? eq : [];
    productos = Array.isArray(prod) ? prod : [];
    renderInventarioTabs(); // <--- Esto es clave
  } catch (err) {
    console.error('Error al cargar inventario:', err);
    showMessage('No se pudo cargar el inventario', 'error');
  }
}

  // Cargar inventario al inicializar
  await cargarInventario();

  // Botón Nuevo Producto: redirigir a la nueva página
  const modalProducto = document.getElementById('modal-producto');
  const addProductoBtn = document.getElementById('add-producto-btn');
  const closeModalProducto = document.getElementById('close-modal-producto');

  if (addProductoBtn) {
    addProductoBtn.onclick = () => {
      window.location.href = 'agregar_productos.html';
    };
  }
  // Si aún existe el modal por alguna razón, mantener cierre seguro
  if (closeModalProducto && modalProducto) {
    closeModalProducto.onclick = () => { modalProducto.style.display = 'none'; };
  }
  // Modal antiguo eliminado: evitar abrirlo

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
      const categoria = document.getElementById('eq-categoria').value;
      const ubicacion = document.getElementById('eq-ubicacion').value;
      const condicion = document.getElementById('eq-condicion').value;
      const peso = document.getElementById('eq-peso').value;
      const clave = document.getElementById('eq-clave').value.trim();
      const descripcion = document.getElementById('eq-descripcion').value.trim();
      const precioInput = document.getElementById('eq-precio');
      const precio_unitario = parseFloat(precioInput.value);
      const garantia = document.getElementById('eq-garantia').value;
      const importe = document.getElementById('eq-importe').value;
      const stock = document.getElementById('eq-stock').value;
      const venta = document.getElementById('eq-venta').checked;
      const renta = document.getElementById('eq-renta').checked;
      const imagenInput = document.getElementById('eq-imagen');
      // Validaciones
      if (!nombre || !categoria || !ubicacion || !condicion || !peso || !clave || !descripcion || isNaN(precio_unitario) || !garantia || !importe || !stock) {
        showMessage('Por favor completa todos los campos requeridos', 'error');
        return;
      }
      let data = { nombre, categoria, ubicacion, condicion, peso, clave, descripcion, precio_unitario, garantia, importe, stock, venta, renta };
      // Solo si se selecciona una nueva imagen, la agregas al objeto
      if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
          data.imagen = evt.target.result;
          try {
            await actualizarEquipo(equipo.id_equipo, data);
            equipoModal.style.display = 'none';
            await cargarEquipos();
            showMessage('Producto actualizado exitosamente', 'success');
          } catch (err) {
            showMessage('No se pudo actualizar el producto', 'error');
          }
        };
        reader.readAsDataURL(imagenInput.files[0]);
        return;
      }
      // Si no hay nueva imagen, no envíes el campo imagen
      try {
        await actualizarEquipo(equipo.id_equipo, data);
        equipoModal.style.display = 'none';
        await cargarEquipos();
        showMessage('Producto actualizado exitosamente', 'success');
      } catch (err) {
        showMessage('No se pudo actualizar el producto', 'error');
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
        <b>Ubicación:</b> ${e.ubicacion ? e.ubicacion.replace(/\n/g,'<br><span style=\'color:#888;font-size:0.95em;\'>') : ''}</span><br>
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
      //const partida = document.getElementById('comp-partida').value.trim();
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
    const totalInventario = (equipos?.length || 0) + (productos?.length || 0);
    const totalVenta = equipos.filter(e=>!!e.venta).length + productos.filter(p=>!!p.venta).length;
    const totalRenta = equipos.filter(e=>!!e.renta).length + productos.filter(p=>!!p.renta).length;
    const alquilados = equipos.filter(e=>String(e.estado).toLowerCase()==='alquilado').length; // productos alquilados se controlan al cerrar contrato
    const elTotal = document.getElementById('total-inventario');
    const elVenta = document.getElementById('total-venta');
    const elRenta = document.getElementById('total-renta');
    const elAlq = document.getElementById('total-alquilados');
    if (elTotal) elTotal.textContent = totalInventario;
    if (elVenta) elVenta.textContent = totalVenta;
    if (elRenta) elRenta.textContent = totalRenta;
    if (elAlq) elAlq.textContent = alquilados;
  }

  // --- Filtros y tabs funcionales ---
  // Filtros selectores
  const selectCategoria = document.querySelector('.filters-row select:nth-child(2)');
  const selectEstado = document.querySelector('.filters-row select:nth-child(3)');
  const inputBusqueda = document.querySelector('.filters-row input[type="text"]');

  if (selectCategoria) {
    selectCategoria.onchange = function() {
      filtroCategoria = this.value;
      renderInventarioTabs();
    };
  }
  if (selectEstado) {
    selectEstado.onchange = function() {
      filtroEstado = this.value;
      renderInventarioTabs();
    };
  }
  if (inputBusqueda) {
    inputBusqueda.oninput = function() {
      filtroBusqueda = this.value.toLowerCase();
      renderInventarioTabs();
    };
  }

  // Tabs funcionales
  // Tabs por atributo data-tab en inventario.html
  const tabButtons = Array.from(document.querySelectorAll('.tabs .tab'));
  function changeTab(newTab) {
    const map = {
      renta: document.getElementById('inventario-lista-renta'),
      venta: document.getElementById('inventario-lista-venta'),
      productos: document.getElementById('inventario-lista-productos')
    };
    const current = map[tabActual];
    const next = map[newTab];
    if (current) current.classList.add('is-hidden');
    setTimeout(() => {
      Object.values(map).forEach(el => { if (el) { el.style.display = 'none'; el.classList.remove('is-hidden'); } });
      if (next) { next.style.display = 'block'; requestAnimationFrame(()=> next.classList.add('is-hidden')); requestAnimationFrame(()=> next.classList.remove('is-hidden')); }
      tabActual = newTab;
      if (tabButtons && tabButtons.length) {
        tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === newTab));
      }
      renderInventarioTabs();
    }, 180);
  }
  if (tabButtons.length) {
    tabButtons.forEach(btn => {
      const t = btn.getAttribute('data-tab');
      btn.addEventListener('click', () => changeTab(t));
    });
  }

  // --- Selector de Exportar ---
  const exportSelect = document.getElementById('export-select');
  if (exportSelect) {
    exportSelect.onchange = async function () {
      const formato = this.value;
      if (!formato) return;

      // Construir la lista de items según la pestaña y filtros actuales (misma lógica que renderInventarioTabs)
      const normalize = (item, tipo) => ({
        __tipo: tipo,
        id: item.id_equipo || item.id_producto,
        nombre: item.nombre,
        clave: item.clave || item.codigo || '',
        categoria: item.categoria || '',
        estado: item.estado || 'Disponible',
        ubicacion: item.ubicacion || '',
        peso: item.peso || '',
        descripcion: item.descripcion || '',
        renta: !!item.renta,
        venta: !!item.venta,
        tarifa: item.tarifa || item.tarifa_dia || item.precio_renta || 0,
        precio_venta: item.precio_unitario || item.precio_venta || 0,
        imagen: item.imagen || ''
      });

      let items = [];
      if (tabActual === 'renta') items = equipos.filter(e => e.renta).concat(productos.filter(p => p.renta));
      else if (tabActual === 'venta') items = equipos.filter(e => e.venta).concat(productos.filter(p => p.venta));
      else items = productos;

      if (filtroCategoria && filtroCategoria !== 'Todas las Categorías') {
        items = items.filter(e => (e.categoria || '').toLowerCase() === filtroCategoria.toLowerCase());
      }
      if (filtroEstado && filtroEstado !== 'Todos los Estados') {
        items = items.filter(e => {
          const estado = (e.estado || e.condicion || '').toLowerCase();
          return estado === filtroEstado.toLowerCase();
        });
      }
      if (filtroBusqueda) {
        items = items.filter(e =>
          (e.nombre && e.nombre.toLowerCase().includes(filtroBusqueda)) ||
          (e.clave && e.clave.toLowerCase().includes(filtroBusqueda)) ||
          (e.descripcion && e.descripcion.toLowerCase().includes(filtroBusqueda))
        );
      }

      const data = items.map(it => normalize(it, it.id_equipo ? 'equipo' : 'producto'));

      const exportCSV = (rows) => {
        const headers = ['tipo','id','nombre','clave','categoria','estado','ubicacion','peso','renta','venta','tarifa','precio_venta'];
        const esc = v => {
          if (v === null || v === undefined) return '';
          const s = String(v).replaceAll('"', '""');
          return `"${s}"`;
        };
        const lines = [headers.join(',')].concat(
          rows.map(r => headers.map(h => esc(r[h])).join(','))
        );
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_${tabActual||'todos'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      try {
        if (formato === 'csv') {
          exportCSV(data);
          showMessage('Exportación CSV generada', 'success');
        } else if (formato === 'excel') {
          // Stub: aquí puedes llamar a tu endpoint backend cuando esté listo
          // await fetch('http://localhost:3001/api/export/excel', { method:'POST', headers:getAuthHeaders(), body: JSON.stringify({ items:data }) });
          showMessage('Exportación a Excel aún no implementada en backend', 'error');
        } else if (formato === 'pdf') {
          // Descargar desde backend
          const url = 'http://localhost:3001/api/productos/export/pdf/catalogo';
          window.open(url, '_blank');
        } else if (formato === 'sql') {
          const url = 'http://localhost:3001/api/productos/export/sql/all';
          window.open(url, '_blank');
        }
      } catch (err) {
        console.error('Error exportando:', err);
        showMessage('Error al exportar', 'error');
      } finally {
        this.value = '';
      }
    };
  }

  // --- Renderizado de inventario tipo ficha, con filtros y tabs ---
  function renderInventarioTabs() {
    renderResumen();
    const listaRenta = document.getElementById('inventario-lista-renta');
    const listaVenta = document.getElementById('inventario-lista-venta');
    const listaProductos = document.getElementById('inventario-lista-productos');
    if (!listaRenta || !listaVenta || !listaProductos) return;

    // Transición suave entre páginas/listas
    function swapList(container, html) {
      if (!container) return;
      // Ocultar actuales con animación
      const oldCards = Array.from(container.querySelectorAll('.producto-ficha'));
      oldCards.forEach(c => c.classList.add('hidden'));
      setTimeout(() => {
        container.innerHTML = html;
        // Forzar estado inicial oculto y luego mostrar para transición de entrada
        requestAnimationFrame(() => {
          const newCards = Array.from(container.querySelectorAll('.producto-ficha'));
          newCards.forEach(c => c.classList.add('hidden'));
          requestAnimationFrame(() => {
            newCards.forEach(c => c.classList.remove('hidden'));
          });
        });
      }, oldCards.length ? 220 : 0);
    }
    
    // Filtrado base por tab
    console.log('Total equipos antes del filtro:', equipos.length);
    console.log('Tab actual:', tabActual);
    console.log('Primeros 3 equipos con renta/venta:', equipos.slice(0, 3).map(e => ({ nombre: e.nombre, renta: e.renta, venta: e.venta })));
    
    // Normalizador para mostrar campos comunes
    const normalize = (item, tipo) => {
      const tarifa = Number(item.tarifa ?? item.tarifa_dia ?? item.precio_renta ?? 0) || 0;
      const precioVenta = Number(item.precio_unitario ?? item.precio_venta ?? 0) || 0;
      const val = v => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
      let renta = val(item.renta);
      let venta = val(item.venta);
      if (!renta && tarifa > 0) renta = true; // inferir por precio de renta
      if (!venta && precioVenta > 0) venta = true; // inferir por precio de venta
      return {
        __tipo: tipo,
        id: item.id_equipo || item.id_producto || item.id,
        nombre: item.nombre,
        clave: item.clave || item.codigo || '',
        categoria: item.categoria || '',
        estado: item.estado || 'Disponible',
        ubicacion: item.ubicacion || '',
        peso: item.peso || '',
        descripcion: item.descripcion || '',
        renta,
        venta,
        tarifa,
        precio_venta: precioVenta,
        imagen: item.imagen || ''
      };
    };

    // Normalizar primero para tener flags renta/venta correctos
    const equiposN = equipos.map(e => normalize(e, 'equipo'));
    const productosN = productos.map(p => normalize(p, 'producto'));

    // Filtrado por tab usando datos normalizados
    let items = [];
    if (tabActual === 'renta') items = equiposN.filter(e => e.renta).concat(productosN.filter(p => p.renta));
    else if (tabActual === 'venta') items = equiposN.filter(e => e.venta).concat(productosN.filter(p => p.venta));
    else items = productosN; // pestaña productos

    console.log('Normalizados -> equipos:', equiposN.length, 'productos:', productosN.length, 'items mostrados:', items.length);
    
    // Filtro de categoría
    if (filtroCategoria && filtroCategoria !== 'Todas las Categorías') {
      items = items.filter(e => (e.categoria || '').toLowerCase() === filtroCategoria.toLowerCase());
    }
    
    // Filtro de estado (condicion o estado)
    if (filtroEstado && filtroEstado !== 'Todos los Estados') {
      items = items.filter(e => {
        const estado = (e.estado || e.condicion || '').toLowerCase();
        return estado === filtroEstado.toLowerCase();
      });
    }
    
    // Filtro de búsqueda
    if (filtroBusqueda) {
      items = items.filter(e =>
        (e.nombre && e.nombre.toLowerCase().includes(filtroBusqueda)) ||
        (e.clave && e.clave.toLowerCase().includes(filtroBusqueda)) ||
        (e.descripcion && e.descripcion.toLowerCase().includes(filtroBusqueda))
      );
    }
    
    // Normalizar para asegurar presencia de __tipo e id para acciones
    items = items.map(e => normalize(e, e.id_equipo ? 'equipo' : 'producto'));
    
    function estadoBadge(estado) {
      if (!estado) return '';
      const e = estado.toLowerCase();
      if (e === 'disponible') return `<span class='badge-estado badge-disponible'>Disponible</span>`;
      if (e === 'alquilado') return `<span class='badge-estado badge-alquilado'>Alquilado</span>`;
      if (e === 'mantenimiento') return `<span class='badge-estado badge-mantenimiento'>Mantenimiento</span>`;
      if (e === 'fuera de servicio') return `<span class='badge-estado badge-fueraservicio'>Fuera de Servicio</span>`;
      return `<span class='badge-estado'>${estado}</span>`;
    }
    
    function condicionBadge(condicion) {
      if (!condicion) return '';
      const c = condicion.toLowerCase();
      if (c === 'nuevo') return `<span class='badge-estado' style='background:#e6f9f0;color:#1abc9c;padding:4px 14px;border-radius:8px;font-weight:600;'>Nuevo</span>`;
      if (c === 'usado') return `<span class='badge-estado' style='background:#f3f3f3;color:#888;padding:4px 14px;border-radius:8px;font-weight:600;'>Usado</span>`;
      return `<span class='badge-estado'>${condicion}</span>`;
    }
    
    function ficha(item, idx) {
      return `
      <div class="producto-ficha">
        <div class="producto-info">
          <div class="producto-nombre">${item.nombre || ''}</div>
          <div class="producto-clave">Clave: <b>${item.clave || ''}</b></div>
          <div class="producto-categoria">Categoría: <b>${item.categoria || ''}</b></div>
          <div class="producto-ubicacion">Ubicación: <b>${item.ubicacion || ''}</b></div>
          <div class="producto-medidas">
            <span>Peso: <b>${item.peso || ''}kg</b></span>
          </div>
          <div class="producto-precios">
            ${item.renta ? `<span>Tarifa: <b>$${Number(item.tarifa||0).toFixed(2)}</b></span>`:''}
            ${item.venta ? `<span style="margin-left:12px;">Precio Venta: <b>$${Number(item.precio_venta||0).toFixed(2)}</b></span>`:''}
          </div>
          <div class="producto-estado">${estadoBadge(item.estado)}</div>
          <div class="producto-descripcion">${item.descripcion || ''}</div>
          <div class="producto-acciones">
            <button onclick='editarItem("${item.__tipo}", ${item.id})' class='btn-editar'><i class="fa fa-pen"></i> Editar</button>
            <button onclick='eliminarItem("${item.__tipo}", ${item.id})' class='btn-eliminar'>Eliminar</button>
          </div>
        </div>
        <div class="producto-img">
          <img src='${item.imagen || 'img/default.jpg'}' alt='${item.nombre || ''}' onerror="this.src='img/default.jpg';" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
        </div>
      </div>
      `;
    }
    
    if (tabActual === 'renta') {
      swapList(listaRenta, items.length ? items.map(ficha).join('') : '<div style="color:#888;">No hay productos para renta.</div>');
      listaVenta.innerHTML = '';
      listaProductos.innerHTML = '';
    } else if (tabActual === 'venta') {
      swapList(listaVenta, items.length ? items.map(ficha).join('') : '<div style="color:#888;">No hay productos para venta.</div>');
      listaRenta.innerHTML = '';
      listaProductos.innerHTML = '';
    } else {
      swapList(listaProductos, items.length ? items.map(ficha).join('') : '<div style="color:#888;">No hay productos registrados.</div>');
      listaRenta.innerHTML = '';
      listaVenta.innerHTML = '';
    }
  }

  // Badge de condición en modal edición
  window.actualizarCondicionBadge = function() {
    const select = document.getElementById('eq-condicion');
    const badge = document.getElementById('eq-condicion-badge');
    if (!select || !badge) return;
    const c = (select.value || '').toLowerCase();
    if (c === 'nuevo') {
      badge.innerHTML = `<span class='badge-estado' style='background:#e6f9f0;color:#1abc9c;padding:4px 14px;border-radius:8px;font-weight:600;'>Nuevo</span>`;
    } else if (c === 'usado') {
      badge.innerHTML = `<span class='badge-estado' style='background:#f3f3f3;color:#888;padding:4px 14px;border-radius:8px;font-weight:600;'>Usado</span>`;
    } else {
      badge.innerHTML = '';
    }
  };

  // Al abrir la modal de edición, actualiza el badge
  window.editarEquipo = function(i) {
    editEqIndex = i;
    document.getElementById('equipo-modal-title').innerText = 'Editar Equipo';
    const e = equipos[i];
    document.getElementById('eq-nombre').value = e.nombre || '';
    document.getElementById('eq-categoria').value = e.categoria || '';
    document.getElementById('eq-ubicacion').value = e.ubicacion || '';
    document.getElementById('eq-condicion').value = e.condicion || '';
    document.getElementById('eq-peso').value = e.peso || '';
    document.getElementById('eq-clave').value = e.clave || '';
    document.getElementById('eq-descripcion').value = e.descripcion || '';
    document.getElementById('eq-precio').value = e.precio_unitario || e.tarifa_dia || '';
    document.getElementById('eq-garantia').value = e.garantia || '';
    document.getElementById('eq-importe').value = e.importe || '';
    document.getElementById('eq-stock').value = e.stock || 1;
    document.getElementById('eq-venta').checked = !!e.venta;
    document.getElementById('eq-renta').checked = !!e.renta;
    // Imagen principal preview
    const eqImagenPreview = document.getElementById('eq-imagen-preview');
    if (eqImagenPreview) {
      eqImagenPreview.src = e.imagen || 'img/default.jpg';
      eqImagenPreview.style.display = 'block';
    }
    // Limpiar input file
    const eqImagenInput = document.getElementById('eq-imagen');
    if (eqImagenInput) eqImagenInput.value = '';
    actualizarCondicionBadge();
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

  // --- Acciones unificadas para editar y eliminar según tipo ---
  window.editarItem = function(tipo, id) {
    if (tipo === 'equipo') {
      const idx = equipos.findIndex(e => String(e.id_equipo) === String(id));
      if (idx >= 0) return editarEquipo(idx);
      showMessage('Equipo no encontrado', 'error');
      return;
    }
    if (tipo === 'producto') {
      // TODO: implementar modal de edición de producto. Por ahora redirigimos a la página de edición.
      window.location.href = `agregar_productos.html?id=${id}`;
      return;
    }
  };

  window.eliminarItem = async function(tipo, id) {
    if (!confirm('¿Eliminar este elemento?')) return;
    if (id === undefined || id === null || id === '') {
      console.error('Eliminar item: id inválido', { tipo, id });
      showMessage('ID inválido al eliminar', 'error');
      return;
    }
    try {
      if (tipo === 'equipo') {
        await eliminarEquipo(id);
        await cargarEquipos();
        renderInventarioTabs();
        showMessage('Equipo eliminado', 'success');
      } else if (tipo === 'producto') {
        await eliminarProducto(id);
        await cargarInventario();
        renderInventarioTabs();
        showMessage('Producto eliminado', 'success');
      }
    } catch (err) {
      console.error('Eliminar item error:', err);
      showMessage('No se pudo eliminar', 'error');
    }
  };

  async function eliminarProducto(id) {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken') || '';
    const res = await fetch(`http://localhost:3001/api/productos/${id}` , {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      const msg = await res.text().catch(()=> 'Error desconocido');
      throw new Error(`DELETE /productos/${id} ${res.status}: ${msg}`);
    }
    return true;
  }

  async function actualizarProducto(id, data) {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken') || '';
    const res = await fetch(`http://localhost:3001/api/productos/${id}` , {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data || {})
    });
    if (!res.ok) {
      const msg = await res.text().catch(()=> 'Error desconocido');
      throw new Error(`PUT /productos/${id} ${res.status}: ${msg}`);
    }
    return res.json();
  }

  // Guardar producto principal (crear) – UI sólo (borrador local)
  const guardarInventarioBtn = document.getElementById('guardar-inventario');
  const draftProductos = [];
  if (guardarInventarioBtn) {
    guardarInventarioBtn.onclick = async function() {
      const nombre = document.getElementById('inv-nombre')?.value.trim();
      const categoria = document.getElementById('inv-categoria')?.value;
      const estado = document.getElementById('inv-estado')?.value;
      const descripcion = document.getElementById('inv-descripcion')?.value.trim();
      const precio_renta = parseFloat(document.getElementById('inv-precio-renta')?.value || '0');
      const precio_venta = parseFloat(document.getElementById('inv-precio-venta')?.value || '0');
      const imagenInput = document.getElementById('inv-imagen');
      if (!nombre || !categoria || !estado || !descripcion) {
        showMessage('Completa nombre, categoría, estado y descripción', 'error');
        return;
      }
      const finalize = (img) => {
        const producto = { nombre, categoria, estado, descripcion, precio_renta, precio_venta, imagen: img || '', componentes: selectedComponents };
        draftProductos.push(producto);
        document.getElementById('modal-producto').style.display = 'none';
        document.getElementById('form-inventario')?.reset();
        if (invImagenPreview) { invImagenPreview.src = ''; invImagenPreview.style.display = 'none'; }
        renderSelectedComponentsGrid();
        showMessage('Producto guardado en borrador (UI). Integraremos con backend luego.', 'success');
      };
      if (imagenInput && imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(evt){ finalize(evt.target.result); };
        reader.readAsDataURL(imagenInput.files[0]);
      } else {
        finalize('');
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
