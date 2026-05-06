// ============================================
// Modulo de encuesta personalizada con token
// ============================================

// Funcion auxiliar para obtener elementos de la modal.
function obtenerElementoEncuesta(id) {
  return document.getElementById(id);
}

// Funcion auxiliar para evitar que texto de BD rompa el HTML de resultados.
function escaparHtmlEncuesta(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Funcion auxiliar para pasar datos seguros a manejadores inline.
function escaparParametroEncuesta(valor) {
  return String(valor ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Funcion para abrir la modal de encuesta personalizada.
function abrirModalEncuestaPersonalizada() {
  const modal = obtenerElementoEncuesta('encuesta-personalizada-modal');
  if (!modal) return;

  limpiarFormularioEncuestaPersonalizada();
  modal.classList.add('show');
}

// Funcion para cerrar la modal de encuesta personalizada.
function cerrarModalEncuestaPersonalizada() {
  const modal = obtenerElementoEncuesta('encuesta-personalizada-modal');
  if (modal) modal.classList.remove('show');
}

// Funcion para limpiar el formulario antes de generar una encuesta nueva.
function limpiarFormularioEncuestaPersonalizada() {
  obtenerElementoEncuesta('buscar-cliente-input').value = '';
  obtenerElementoEncuesta('encuesta-cliente-id').value = '';
  obtenerElementoEncuesta('encuesta-cliente-nombre').value = '';
  obtenerElementoEncuesta('encuesta-cliente-email').value = '';
  obtenerElementoEncuesta('encuesta-cliente-email').readOnly = true;
  obtenerElementoEncuesta('encuesta-cliente-email').placeholder = 'Seleccione un cliente para validar su email';
  obtenerElementoEncuesta('encuesta-tipo-operacion').value = '';
  obtenerElementoEncuesta('encuesta-asunto').value = 'Encuesta de Satisfaccion - Andamios Torres';
  obtenerElementoEncuesta('encuesta-mensaje-personal').value = '';
  obtenerElementoEncuesta('encuesta-enviar-ahora').checked = true;
  obtenerElementoEncuesta('resultados-clientes').innerHTML = '';
  obtenerElementoEncuesta('token-info-section').style.display = 'none';
}

// Funcion para buscar clientes registrados en la base de datos.
async function buscarClientesEncuesta() {
  const busqueda = obtenerElementoEncuesta('buscar-cliente-input').value.trim();
  const resultadosDiv = obtenerElementoEncuesta('resultados-clientes');

  if (!busqueda || busqueda.length < 2) {
    resultadosDiv.innerHTML = '<div style="padding: 10px; color: #999;">Ingrese al menos 2 caracteres</div>';
    return;
  }

  resultadosDiv.innerHTML = '<div style="padding: 10px; color: #999;">Buscando...</div>';

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`/api/clientes/search?q=${encodeURIComponent(busqueda)}`, { headers });

    if (!response.ok) {
      throw new Error('Error en la busqueda de clientes');
    }

    const respuesta = await response.json();
    const clientes = Array.isArray(respuesta) ? respuesta : (respuesta.data || []);

    if (!clientes.length) {
      resultadosDiv.innerHTML = '<div style="padding: 10px; color: #999;">No se encontraron clientes</div>';
      return;
    }

    resultadosDiv.innerHTML = clientes.map(cliente => {
      const idCliente = cliente.id_cliente || cliente.id || '';
      const nombreCliente = cliente.nombre || cliente.razon_social || cliente.empresa || 'Cliente sin nombre';
      const emailCliente = cliente.email || cliente.fact_email || '';
      const empresaCliente = cliente.empresa || cliente.razon_social || '';

      return `
        <div style="padding: 12px; border-bottom: 1px solid #e3e8ef; cursor: pointer; background: #f8fafc; transition: background 0.2s;"
          onmouseover="this.style.background='#f1f5f9'"
          onmouseout="this.style.background='#f8fafc'"
          onclick="seleccionarClienteEncuesta('${escaparParametroEncuesta(idCliente)}', '${escaparParametroEncuesta(nombreCliente)}', '${escaparParametroEncuesta(emailCliente)}')">
          <div style="font-weight: 600; color: #232323;">${escaparHtmlEncuesta(nombreCliente)}</div>
          <div style="font-size: 0.9rem; color: #64748b;">${escaparHtmlEncuesta(emailCliente || 'Sin email')}</div>
          ${empresaCliente ? `<div style="font-size: 0.85rem; color: #999;">${escaparHtmlEncuesta(empresaCliente)}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al buscar clientes:', error);
    resultadosDiv.innerHTML = '<div style="padding: 10px; color: #e74c3c;">Error al buscar clientes</div>';
    showMessage('Error al buscar clientes', 'error');
  }
}

// Funcion para seleccionar un cliente encontrado.
function seleccionarClienteEncuesta(idCliente, nombre, email) {
  const emailInput = obtenerElementoEncuesta('encuesta-cliente-email');
  obtenerElementoEncuesta('encuesta-cliente-id').value = idCliente;
  obtenerElementoEncuesta('encuesta-cliente-nombre').value = nombre;
  emailInput.value = email || '';
  emailInput.readOnly = Boolean(email);
  emailInput.placeholder = email ? 'Email registrado del cliente' : 'Ingrese el email del cliente';
  obtenerElementoEncuesta('resultados-clientes').innerHTML = '';
  obtenerElementoEncuesta('buscar-cliente-input').value = nombre;
  (email ? obtenerElementoEncuesta('encuesta-tipo-operacion') : emailInput).focus();
}

// Funcion para crear la encuesta personalizada con token.
async function crearEncuestaPersonalizada() {
  const btnCrear = obtenerElementoEncuesta('btn-crear-encuesta-personalizada');
  const textoOriginal = btnCrear.innerHTML;

  try {
    const idCliente = obtenerElementoEncuesta('encuesta-cliente-id').value;
    const emailCliente = obtenerElementoEncuesta('encuesta-cliente-email').value.trim();
    const nombreCliente = obtenerElementoEncuesta('encuesta-cliente-nombre').value;
    const asunto = obtenerElementoEncuesta('encuesta-asunto').value.trim();
    const tipoOperacion = obtenerElementoEncuesta('encuesta-tipo-operacion').value;
    const proyectoRelacionado = obtenerElementoEncuesta('encuesta-proyecto-relacionado')?.value || '';
    const mensajePersonal = obtenerElementoEncuesta('encuesta-mensaje-personal').value.trim();
    const enviarAhora = obtenerElementoEncuesta('encuesta-enviar-ahora').checked;

    if (!idCliente) {
      showMessage('Debe seleccionar un cliente registrado', 'error');
      return;
    }

    if (!emailCliente) {
      showMessage('Ingrese el email del cliente para enviar la encuesta', 'error');
      obtenerElementoEncuesta('encuesta-cliente-email').focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente)) {
      showMessage('Ingrese un email valido para el cliente', 'error');
      obtenerElementoEncuesta('encuesta-cliente-email').focus();
      return;
    }

    if (!asunto) {
      showMessage('El asunto es requerido', 'error');
      return;
    }

    const datos = {
      id_cliente: Number(idCliente),
      email_cliente: emailCliente,
      nombre_cliente: nombreCliente,
      asunto,
      mensaje_personal: mensajePersonal,
      tipo_operacion: tipoOperacion || 'personalizada',
      proyecto_relacionado: proyectoRelacionado || null,
      enviar_ahora: enviarAhora
    };

    btnCrear.disabled = true;
    btnCrear.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    const headers = getAuthHeaders();
    const response = await fetch('/api/encuestas/personalizada/crear', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Error al crear encuesta personalizada');
    }

    const resultado = await response.json();
    const encuesta = resultado.data || {};

    obtenerElementoEncuesta('encuesta-token').value = encuesta.token || '';
    obtenerElementoEncuesta('encuesta-url-personalizada').value = encuesta.url || encuesta.url_encuesta || '';
    obtenerElementoEncuesta('token-info-section').style.display = 'block';

    showMessage(`Encuesta creada correctamente. ${enviarAhora ? 'Correo enviado al cliente.' : ''}`, 'success');

    setTimeout(() => {
      obtenerElementoEncuesta('token-info-section').scrollIntoView({ behavior: 'smooth' });
    }, 300);
  } catch (error) {
    console.error('Error al crear encuesta:', error);
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    btnCrear.disabled = false;
    btnCrear.innerHTML = textoOriginal;
  }
}

// Funcion para copiar el token al portapapeles.
async function copiarTokenEncuesta() {
  const tokenInput = obtenerElementoEncuesta('encuesta-token');
  const btnCopiar = obtenerElementoEncuesta('btn-copiar-token');
  const textoOriginal = btnCopiar.innerHTML;

  try {
    tokenInput.select();
    await navigator.clipboard.writeText(tokenInput.value);
    btnCopiar.innerHTML = '<i class="fas fa-check"></i> Copiado';
    setTimeout(() => { btnCopiar.innerHTML = textoOriginal; }, 2000);
    showMessage('Token copiado al portapapeles', 'success');
  } catch (_) {
    showMessage('Error al copiar token', 'error');
  }
}

// Funcion para copiar la URL personalizada al portapapeles.
async function copiarUrlEncuesta() {
  const urlInput = obtenerElementoEncuesta('encuesta-url-personalizada');
  const btnCopiar = obtenerElementoEncuesta('btn-copiar-url-encuesta');
  const textoOriginal = btnCopiar.innerHTML;

  try {
    urlInput.select();
    await navigator.clipboard.writeText(urlInput.value);
    btnCopiar.innerHTML = '<i class="fas fa-check"></i> Copiado';
    setTimeout(() => { btnCopiar.innerHTML = textoOriginal; }, 2000);
    showMessage('URL copiada al portapapeles', 'success');
  } catch (_) {
    showMessage('Error al copiar URL', 'error');
  }
}

// Eventos de la modal.
document.addEventListener('DOMContentLoaded', function() {
  obtenerElementoEncuesta('btn-buscar-cliente')?.addEventListener('click', buscarClientesEncuesta);

  obtenerElementoEncuesta('buscar-cliente-input')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarClientesEncuesta();
    }
  });

  obtenerElementoEncuesta('btn-crear-encuesta-personalizada')?.addEventListener('click', crearEncuestaPersonalizada);
  obtenerElementoEncuesta('btn-copiar-token')?.addEventListener('click', copiarTokenEncuesta);
  obtenerElementoEncuesta('btn-copiar-url-encuesta')?.addEventListener('click', copiarUrlEncuesta);
  obtenerElementoEncuesta('close-encuesta-personalizada-modal')?.addEventListener('click', cerrarModalEncuestaPersonalizada);
  obtenerElementoEncuesta('close-encuesta-personalizada-form')?.addEventListener('click', cerrarModalEncuestaPersonalizada);
});

// Funciones globales usadas por el HTML del modulo.
window.abrirModalEncuestaPersonalizada = abrirModalEncuestaPersonalizada;
window.cerrarModalEncuestaPersonalizada = cerrarModalEncuestaPersonalizada;
window.buscarClientesEncuesta = buscarClientesEncuesta;
window.seleccionarClienteEncuesta = seleccionarClienteEncuesta;
window.crearEncuestaPersonalizada = crearEncuestaPersonalizada;
window.copiarTokenEncuesta = copiarTokenEncuesta;
window.copiarUrlEncuesta = copiarUrlEncuesta;
