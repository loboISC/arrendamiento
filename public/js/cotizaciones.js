// API URLs
const API_URL = 'http://localhost:3001/api';
const EQUIPOS_URL = `${API_URL}/equipos`;
const CLIENTES_URL = `${API_URL}/clientes`;
const COTIZACIONES_URL = `${API_URL}/cotizaciones`;
const ALMACENES_URL = `${API_URL}/productos/almacenes`;

// Función para verificar autenticación
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return token;
}

// Función para obtener headers con autenticación
function getAuthHeaders() {
  const token = checkAuth();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Función para mostrar mensajes
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

// Función para buscar producto por clave
async function buscarProducto(clave, id_almacen = null) {
  try {
    console.log('🔍 Buscando producto:', clave, 'en almacén:', id_almacen);
    const headers = getAuthHeaders();
    let url = `${EQUIPOS_URL}/buscar/${clave}`;
    if (id_almacen) {
      url += `?id_almacen=${id_almacen}`;
    }
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
      }
      throw new Error('Producto no encontrado');
    }
    
    const producto = await response.json();
    console.log('📦 Producto recibido del servidor:', producto);
    console.log('🖼️ Imagen del producto:', producto.imagen ? 'SÍ' : 'NO');
    if (producto.imagen) {
      console.log('🖼️ URL de imagen:', producto.imagen.substring(0, 50) + '...');
    }
    return producto;
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    showMessage('Error al buscar producto', 'error');
    return null;
  }
}

// Función para mostrar información del producto encontrado
function mostrarProductoEncontrado(producto) {
  console.log('🎨 Mostrando producto en frontend:', producto);
  console.log('🖼️ Tiene imagen:', !!producto.imagen);
  console.log('🖼️ URL de imagen:', producto.imagen);
  
  const resultadoBusqueda = document.getElementById('resultado-busqueda');
  const infoProducto = document.getElementById('info-producto');
  
  if (!resultadoBusqueda || !infoProducto) {
    console.log('❌ Elementos no encontrados en el DOM');
    return;
  }
  
  console.log('✅ Elementos encontrados en el DOM');
  
  // Verificar si la imagen es válida
  let imagenUrl = 'img/default.jpg';
  if (producto.imagen && producto.imagen.startsWith('data:image')) {
    imagenUrl = producto.imagen;
    console.log('✅ URL de imagen válida detectada');
  } else {
    console.log('❌ URL de imagen inválida, usando default');
  }
  
  // Crear HTML con imagen del producto
  const html = `
    <div class="producto-encontrado">
      <div class="producto-info-texto">
        <div class="producto-campo">
          <strong>Clave:</strong> ${producto.clave || 'N/A'}
        </div>
        <div class="producto-campo">
          <strong>Nombre:</strong> ${producto.nombre || 'N/A'}
        </div>
        <div class="producto-campo">
          <strong>Categoría:</strong> ${producto.categoria || 'N/A'}
        </div>
        <div class="producto-campo">
          <strong>Stock Disponible:</strong> ${producto.stock || 0}
        </div>
        <div class="producto-campo">
          <strong>Precio Unitario:</strong> $${producto.precio || 0}
        </div>
        <div class="producto-campo">
          <strong>Estado:</strong> ${producto.estado || 'Disponible'}
        </div>
      </div>
      <div class="producto-imagen">
        <img src="${imagenUrl}" 
             alt="${producto.nombre || 'Producto'}" 
             onerror="this.src='img/default.jpg'; console.log('❌ Error cargando imagen, usando default');"
             onload="console.log('✅ Imagen cargada exitosamente');"
             style="max-width: 150px; max-height: 150px; object-fit: contain; border-radius: 8px; border: 1px solid #e3e8ef;">
      </div>
    </div>
  `;
  
  console.log('📝 HTML generado:', html);
  infoProducto.innerHTML = html;
  resultadoBusqueda.style.display = 'block';
  
  // Guardar el producto encontrado para agregarlo a la cotización
  window.productoEncontrado = producto;
  console.log('💾 Producto guardado en window.productoEncontrado');
}

// Función para guardar cliente
async function guardarCliente() {
  let tipoCliente = document.querySelector('.client-type-btn.active')?.textContent || 'Persona Física';
  let atencionNombre = document.getElementById('cliente-nombre')?.value?.trim();
  const domicilio = document.getElementById('cliente-domicilio')?.value?.trim();
  let telefono = document.getElementById('cliente-telefono')?.value?.trim();
  const ciudad = document.getElementById('cliente-ciudad')?.value?.trim();
  const email = document.getElementById('cliente-email')?.value?.trim();
  const condiciones = document.getElementById('cliente-condiciones')?.value || 'Persona Física';

  // Normalizar tipo esperado por backend
  const tipoNorm = (tipoCliente || '').toLowerCase().includes('moral') || (tipoCliente || '').toLowerCase().includes('empresa')
    ? 'EMPRESA'
    : 'PERSONA';

  // Fallbacks obligatorios
  if (!atencionNombre || atencionNombre.length === 0) atencionNombre = 'Cliente Workflow';
  if (!telefono || telefono.length === 0) telefono = '0000000000';

  // Log de entrada
  console.log('🧾 Datos crudos cliente:', { tipoCliente, tipoNorm, atencionNombre, telefono, domicilio, ciudad, email, condiciones });

  try {
    const headers = getAuthHeaders();
    const clienteData = {
      nombre: atencionNombre,
      tipo: tipoNorm,
      contacto: atencionNombre,
      email: email || null,
      telefono: telefono,
      direccion: domicilio || null,
      nota: 'Creado desde cotización workflow',
      // Campos opcionales soportados por el backend (si existen en el modelo)
      regimen_fiscal: null,
      codigo_postal: null,
      validado_sat: false
    };

    console.log('📦 clienteData a enviar:', clienteData);

    const response = await fetch(CLIENTES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(clienteData)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('❌ Error HTTP al guardar cliente:', response.status, text);
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
      }
      throw new Error('Error al guardar cliente');
    }

    const clienteGuardado = await response.json();
    console.log('✅ Cliente guardado:', clienteGuardado);
    showMessage('Cliente guardado exitosamente', 'success');
    return clienteGuardado;
  } catch (error) {
    console.error('Error al guardar cliente:', error);
    showMessage('Error al guardar cliente', 'error');
    return null;
  }
}

// Función para agregar producto encontrado a la cotización
function agregarProductoEncontrado() {
  if (!window.productoEncontrado) {
    showMessage('No hay producto seleccionado', 'error');
    return;
  }
  
  const producto = window.productoEncontrado;
  
  // Crear nuevo elemento de equipo
  const equipmentList = document.getElementById('equipment-list');
  const newEquipment = document.createElement('div');
  newEquipment.className = 'equipment-item';
  newEquipment.innerHTML = `
    <input type="text" placeholder="Descripción del equipo" class="equipment-description" value="${producto.nombre}" readonly>
    <input type="number" placeholder="Cantidad" class="quantity" min="1" value="1">
    <input type="number" placeholder="Precio unitario" class="price" min="0" step="0.01" value="${producto.precio}">
    <span class="subtotal">$${producto.precio}</span>
    <button type="button" class="remove-equipment-btn" onclick="removeEquipment(this)">
      <i class="fa fa-trash"></i>
    </button>
  `;
  
  equipmentList.appendChild(newEquipment);
  
  // Ocultar resultado de búsqueda
  document.getElementById('resultado-busqueda').style.display = 'none';
  window.productoEncontrado = null;
  
  // Actualizar cálculos
  updateCalculations();
  showMessage('Producto agregado a la cotización', 'success');
}

// Función para actualizar cálculos
function updateCalculations() {
  const equipmentItems = document.querySelectorAll('.equipment-item');
  let subtotal = 0;
  
  equipmentItems.forEach(item => {
    const quantity = parseFloat(item.querySelector('.quantity').value) || 0;
    const price = parseFloat(item.querySelector('.price').value) || 0;
    const itemSubtotal = quantity * price;
    
    item.querySelector('.subtotal').textContent = `$${itemSubtotal.toFixed(2)}`;
    subtotal += itemSubtotal;
  });
  
  // Actualizar resumen financiero
  const diasRenta = parseInt(document.getElementById('cotizacion-dias')?.value) || 15;
  const rentaDia = subtotal;
  const totalDias = rentaDia * diasRenta;
  // Corregido: el input en el HTML es "costo-envio"
  const envio = parseFloat(document.getElementById('costo-envio')?.value) || 0;
  const descuento = parseFloat(document.getElementById('descuento-valor')?.value) || 0;
  const subtotalFinal = totalDias + envio - descuento;
  const iva = subtotalFinal * 0.16;
  const totalFinal = subtotalFinal + iva;
  const garantia = totalFinal * 0.1; // 10% de garantía
  
  // Actualizar elementos en el DOM
  const elementos = {
    'renta-dia': rentaDia.toFixed(2),
    'total-dias': totalDias.toFixed(2),
    'subtotal': subtotalFinal.toFixed(2),
    'envio-resumen': envio.toFixed(2),
    'descuento': descuento.toFixed(2),
    'iva': iva.toFixed(2),
    'total-final': totalFinal.toFixed(2),
    'garantia': garantia.toFixed(2)
  };
  
  Object.keys(elementos).forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `$${elementos[id]}`;
    }
  });
  
  // Actualizar texto de días
  const diasTexto = document.getElementById('dias-texto');
  if (diasTexto) {
    diasTexto.textContent = diasRenta;
  }
}

// Función para agregar equipo manual
function addEquipment() {
  const equipmentList = document.getElementById('equipment-list');
  const newEquipment = document.createElement('div');
  newEquipment.className = 'equipment-item';
  newEquipment.innerHTML = `
    <input type="text" placeholder="Descripción del equipo" class="equipment-description">
    <input type="number" placeholder="Cantidad" class="quantity" min="1" value="1">
    <input type="number" placeholder="Precio unitario" class="price" min="0" step="0.01">
    <span class="subtotal">$0.00</span>
    <button type="button" class="remove-equipment-btn" onclick="removeEquipment(this)">
      <i class="fa fa-trash"></i>
    </button>
  `;
  
  equipmentList.appendChild(newEquipment);
}

// Función para eliminar equipo
function removeEquipment(button) {
  button.closest('.equipment-item').remove();
  updateCalculations();
}

// Función para generar número de cotización
function generarNumeroCotizacion() {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const hora = String(fecha.getHours()).padStart(2, '0');
  const minuto = String(fecha.getMinutes()).padStart(2, '0');
  const segundo = String(fecha.getSeconds()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 900) + 100); // 3 dígitos
  return `${año}${mes}${dia}${hora}${minuto}${segundo}${rnd}`;
}

// Nueva función para cargar almacenes y popular el dropdown
async function cargarAlmacenes() {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(ALMACENES_URL, { headers });
    if (!response.ok) {
      throw new Error('Error al cargar almacenes');
    }
    const almacenes = await response.json();
    console.log('✅ Almacenes recibidos del servidor:', almacenes); // <-- Added for debugging
    const warehouseFilter = document.getElementById('warehouse-filter');
    if (warehouseFilter) {
      warehouseFilter.innerHTML = '<option value="">Todos los Almacenes</option>'; // Resetear opciones
      almacenes.forEach(almacen => {
        const option = document.createElement('option');
        option.value = almacen.id_almacen;
        option.textContent = almacen.nombre_almacen;
        warehouseFilter.appendChild(option);
      });
      console.log('✅ Dropdown de almacenes actualizado.'); // <-- Added for debugging
    }
  } catch (error) {
    console.error('❌ Error al cargar almacenes:', error);
    showMessage('Error al cargar almacenes', 'error');
  }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Generar número de cotización
  const numeroCotizacion = document.getElementById('cotizacion-numero');
  if (numeroCotizacion) {
    numeroCotizacion.value = generarNumeroCotizacion();
  }
  
  // Establecer fecha actual
  const fechaCotizacion = document.getElementById('cotizacion-fecha');
  if (fechaCotizacion) {
    const hoy = new Date().toISOString().split('T')[0];
    fechaCotizacion.value = hoy;
  }
  
  // Resolver cliente actual desde workflow/session sin crear duplicados
  async function resolverClienteActual() {
    try {
      let idFromWorkflow = null;
      try {
        const wf = JSON.parse(sessionStorage.getItem('workflowClienteData') || 'null');
        idFromWorkflow = wf && wf.id_cliente ? Number(wf.id_cliente) : null;
      } catch {}
      let idFromCotData = null;
      try {
        idFromCotData = window.cotizacionData && window.cotizacionData.cliente && window.cotizacionData.cliente.id_cliente
          ? Number(window.cotizacionData.cliente.id_cliente) : null;
      } catch {}
      let idFromUltima = null;
      try {
        const ult = JSON.parse(sessionStorage.getItem('ultimaCotizacionGuardada') || 'null');
        idFromUltima = ult && ult.cliente && (ult.cliente.id_cliente || ult.cliente.id) ? Number(ult.cliente.id_cliente || ult.cliente.id) : null;
      } catch {}

      const id = idFromWorkflow || idFromCotData || idFromUltima;
      if (!id) return null;

      console.log('🆔 Reutilizando cliente existente con id_cliente =', id);
      const headers = getAuthHeaders();
      const resp = await fetch(`${CLIENTES_URL}/${id}`, { headers });
      if (!resp.ok) {
        console.warn('No se pudo cargar el cliente existente, status:', resp.status);
        return { id_cliente: id };
      }
      const cli = await resp.json();
      return cli && cli.id_cliente ? cli : { ...cli, id_cliente: id };
    } catch (e) {
      console.warn('resolverClienteActual() falló, se creará cliente nuevo si es necesario:', e);
      return null;
    }
  }

  // Event listeners
  const btnBuscarProducto = document.getElementById('btn-buscar-producto');
  if (btnBuscarProducto) {
    btnBuscarProducto.addEventListener('click', async function() {
      const clave = document.getElementById('buscar-clave')?.value?.trim();
      const id_almacen = document.getElementById('warehouse-filter')?.value;
      if (!clave) {
        showMessage('Por favor ingrese una clave de producto', 'error');
        return;
      }
      
      const producto = await buscarProducto(clave, id_almacen);
      if (producto) {
        mostrarProductoEncontrado(producto);
      }
    });
  }
  
  const btnAgregarEncontrado = document.getElementById('btn-agregar-encontrado');
  if (btnAgregarEncontrado) {
    btnAgregarEncontrado.addEventListener('click', agregarProductoEncontrado);
  }
  
  // Event listener para el filtro de almacén
  const warehouseFilter = document.getElementById('warehouse-filter');
  if (warehouseFilter) {
    warehouseFilter.addEventListener('change', async function() {
      const clave = document.getElementById('buscar-clave')?.value?.trim();
      const id_almacen = this.value;
      if (clave) { // Solo buscar si ya hay una clave de producto ingresada
        const producto = await buscarProducto(clave, id_almacen);
        if (producto) {
          mostrarProductoEncontrado(producto);
        }
      }
    });
  }
  
  // Event listeners para actualizar cálculos
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('quantity') || 
        e.target.classList.contains('price') ||
        e.target.id === 'cotizacion-dias' ||
        e.target.id === 'costo-envio' ||
        e.target.id === 'descuento-valor') {
      updateCalculations();
    }
  });
  
  // Selector de tipo de cliente
  const btnPersonaFisica = document.getElementById('btn-persona-fisica');
  const btnEmpresa = document.getElementById('btn-empresa');
  
  if (btnPersonaFisica && btnEmpresa) {
    btnPersonaFisica.addEventListener('click', function() {
      btnPersonaFisica.classList.add('active');
      btnEmpresa.classList.remove('active');
    });
    
    btnEmpresa.addEventListener('click', function() {
      btnEmpresa.classList.add('active');
      btnPersonaFisica.classList.remove('active');
    });
  }
  
  // Función para guardar cotización completa
  window.guardarCotizacion = async function() {
    // 1) Resolver cliente sin duplicar; si no existe, crear
    let cliente = await resolverClienteActual();
    if (!cliente) {
      cliente = await guardarCliente();
    } else {
      console.log('♻️ Usando cliente existente, no se creará uno nuevo:', cliente);
    }
    if (!cliente) return;

    // 2) Construir equipos y cálculos
    const equipmentItems = document.querySelectorAll('.equipment-item');
    const equipos = [];
    let subtotal = 0;
    equipmentItems.forEach(item => {
      const descripcion = item.querySelector('.equipment-description')?.value || '';
      const cantidad = parseFloat(item.querySelector('.quantity')?.value) || 0;
      const precio = parseFloat(item.querySelector('.price')?.value) || 0;
      const itemSubtotal = cantidad * precio;
      subtotal += itemSubtotal;
      equipos.push({ descripcion, cantidad, precio, subtotal: itemSubtotal });
    });

    const diasRenta = parseInt(document.getElementById('cotizacion-dias')?.value) || 15;
    const rentaDia = subtotal;
    const totalDias = rentaDia * diasRenta;
    const envio = parseFloat(document.getElementById('costo-envio')?.value) || 0;
    const descuento = parseFloat(document.getElementById('descuento-valor')?.value) || 0;
    const subtotalFinal = totalDias + envio - descuento;
    const iva = subtotalFinal * 0.16;
    const totalFinal = subtotalFinal + iva;

    // 3) Construir payload para backend
    const payload = {
      numero_cotizacion: document.getElementById('cotizacion-numero')?.value || null,
      id_cliente: cliente.id_cliente || cliente.id || null,
      nombre_cliente: cliente.nombre || null,
      cliente_telefono: cliente.telefono || null,
      cliente_email: cliente.email || null,
      cliente_direccion: cliente.direccion || null,
      cliente_tipo: cliente.tipo || 'PERSONA',
      fecha_cotizacion: document.getElementById('cotizacion-fecha')?.value || null,
      tipo: document.getElementById('cotizacion-tipo')?.value || 'RENTA',
      estado: document.getElementById('cotizacion-estado')?.value || 'Borrador',
      prioridad: document.getElementById('cotizacion-prioridad')?.value || 'Media',
      descripcion: JSON.stringify(equipos),
      notas: document.getElementById('cotizacion-notas')?.value || '',
      total: totalFinal,
      equipos
    };

    console.log('🧾 Payload cotización:', payload);

    // 4) Enviar a backend
    try {
      const headers = getAuthHeaders();
      const resp = await fetch(COTIZACIONES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('❌ Error HTTP al guardar cotización:', resp.status, text);
        if (resp.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = 'login.html';
          return;
        }
        throw new Error('Error al guardar cotización');
      }

      const cotizacionGuardada = await resp.json();
      console.log('✅ Cotización guardada:', cotizacionGuardada);
      // Persistir para la página de contrato
      try {
        sessionStorage.setItem('ultimaCotizacionGuardada', JSON.stringify({ cotizacion: cotizacionGuardada, cliente }));
        // Persistir estructura consumida por elaborar-contrato.html
        const clienteContrato = {
          id_cliente: cliente.id_cliente || cliente.id || null,
          nombre: cliente.nombre || '',
          telefono: cliente.telefono || '',
          email: cliente.email || '',
          direccion: cliente.direccion || cliente.domicilio || '' ,
          domicilio: cliente.direccion || cliente.domicilio || '' ,
          tipo: (cliente.tipo || 'PERSONA')
        };
        const cotizacionParaContrato = {
          cliente: clienteContrato,
          equipos: Array.isArray(equipos) ? equipos : [],
          total: totalFinal,
          subtotal: subtotalFinal,
          direccion_entrega: null
        };
        sessionStorage.setItem('cotizacionParaContrato', JSON.stringify(cotizacionParaContrato));
        // Compatibilidad retro: guardar también en localStorage
        try {
          localStorage.setItem('datosCotizacion', JSON.stringify({
            cliente: clienteContrato,
            equipos: Array.isArray(equipos) ? equipos : [],
            total: totalFinal,
            subtotal: subtotalFinal
          }));
        } catch {}
      } catch {}
      // Actualizar el número en el input si backend generó uno distinto
      try {
        const numeroInput = document.getElementById('cotizacion-numero');
        if (numeroInput && cotizacionGuardada.numero_cotizacion) {
          numeroInput.value = cotizacionGuardada.numero_cotizacion;
        }
      } catch {}
      showMessage('Cotización guardada exitosamente', 'success');
      return cotizacionGuardada;
    } catch (e) {
      console.error('Error al guardar cotización:', e);
      showMessage('Error al guardar cotización', 'error');
    }
  };

  // Cargar almacenes al inicio
  cargarAlmacenes();
});

// Hacer funciones disponibles globalmente
window.addEquipment = addEquipment;
window.removeEquipment = removeEquipment;
window.buscarProducto = buscarProducto;
window.mostrarProductoEncontrado = mostrarProductoEncontrado;
window.agregarProductoEncontrado = agregarProductoEncontrado;
window.guardarCliente = guardarCliente; 