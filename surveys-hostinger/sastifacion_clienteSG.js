// Global validation for all survey/evaluation pages
(function () {
  // Detectar URL base del API (funciona en localhost y en Hostinger)
  function getApiBaseUrl() {
    // Si está en un subdominio público (ej: encuesta.andamiositorres.com)
    // intenta conectar al backend en la misma raíz del dominio
    const protocol = window.location.protocol; // http: o https:
    const host = window.location.host; // localhost:3001, encuesta.andamiositorres.com, etc.
    
    // Si es localhost en puerto específico, usa localhost:3001
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://localhost:3001`;
    }
    
    // Si es un dominio público, intenta conectar a api.tudominio.com
    if (host.includes('andamiositorres.com')) {
      // Reemplaza "encuesta" con "api"
      const subdomain = host.split('.')[0];
      if (subdomain === 'encuesta') {
        return `${protocol}//api.andamiositorres.com`;
      }
    }
    
    // Fallback: intenta al mismo host/puerto (para desarrollo)
    return `${protocol}//${host}`;
  }

  const API_BASE_URL = getApiBaseUrl();

  // Lightweight modal helper
  function ensureModal() {
    if (document.getElementById('app-modal-overlay')) return;
    const style = document.createElement('style');
    style.id = 'app-modal-styles';
    style.textContent = `
      #app-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:9999}
      #app-modal{width:min(92vw,420px);background:#fff;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,.18);overflow:hidden;border:1px solid #e6eaf2}
      #app-modal-header{background:#003366;color:#fff;padding:.75rem 1rem;font-weight:700;letter-spacing:.3px}
      #app-modal-body{padding:1rem;color:#1f2937;line-height:1.45}
      #app-modal-actions{display:flex;justify-content:flex-end;gap:.5rem;padding:0 1rem 1rem}
      #app-modal button{appearance:none;border:0;border-radius:8px;padding:.5rem .9rem;cursor:pointer;font-weight:600}
      #app-modal .btn-primary{background:#003366;color:#fff}
      #app-modal .btn-primary:hover{filter:brightness(1.05)}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'app-modal-overlay';
    overlay.innerHTML = `
      <div id="app-modal" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
        <div id="app-modal-header"><span id="app-modal-title">Validación</span></div>
        <div id="app-modal-body"></div>
        <div id="app-modal-actions">
          <button type="button" class="btn-primary" id="app-modal-ok">Entendido</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) hideModal(); });
    document.getElementById('app-modal-ok').addEventListener('click', hideModal);
  }

  function showModal(message){
    ensureModal();
    const body = document.getElementById('app-modal-body');
    body.textContent = '';
    if (typeof message === 'string') body.textContent = message; else body.appendChild(message);
    const overlay = document.getElementById('app-modal-overlay');
    overlay.style.display = 'flex';
    // focus button
    const ok = document.getElementById('app-modal-ok');
    setTimeout(()=> ok && ok.focus(), 0);
  }
  function hideModal(){
    const overlay = document.getElementById('app-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  // ---- Token y utilidades de envío ----
  function getEncuestaIdFromURL() {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('id_encuesta') || sp.get('encuesta') || null;
    } catch (_) { return null; }
  }
  function getSurveySlug() {
    const p = (location.pathname || '').toLowerCase();
    if (p.includes('encuestacurso')) return 'curso';
    if (p.includes('examenes')) return 'examen';
    // index.html se asume encuesta de cliente
    return 'cliente';
  }
  function collectAnswers(root = document) {
    const data = {};
    // inputs de texto y fecha
    Array.from(root.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], input[type="email"], textarea')).forEach(el => {
      const name = el.name || el.id; if (!name) return;
      const v = (el.value || '').trim();
      data[name] = v;
    });
    // radios: solo el seleccionado por name
    const radioByName = {};
    Array.from(root.querySelectorAll('input[type="radio"]')).forEach(r => {
      if (!r.name) return;
      if (r.checked) radioByName[r.name] = r.value;
      if (!(r.name in radioByName)) radioByName[r.name] = radioByName[r.name] || '';
    });
    Object.assign(data, radioByName);
    return data;
  }
  function mapChoiceToValue(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    // se guarda tal cual: molesto | no-satisfecho | satisfecho | muy-satisfecho
    return s;
  }
  function buildApiPayload(answers) {
    return {
      nombre_cliente: answers.clientName || answers.nombre_cliente || null,
      email_cliente: answers.email_cliente || answers.email || null,
      q1_atencion_ventas: mapChoiceToValue(answers.q1),
      q2_calidad_productos: mapChoiceToValue(answers.q2),
      q3_tiempo_entrega: mapChoiceToValue(answers.q3),
      q4_servicio_logistica: mapChoiceToValue(answers.q4),
      q5_experiencia_compra: mapChoiceToValue(answers.q5),
      sugerencias: answers.suggestionText || answers.sugerencias || null
    };
  }
  async function submitToServer() {
    const id = getEncuestaIdFromURL();
    if (!id) throw new Error('Falta id_encuesta en la URL');

    const answers = collectAnswers();
    const payload = buildApiPayload(answers);
    const res = await fetch(`${API_BASE_URL}/api/encuestas/publico/${encodeURIComponent(id)}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Error ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  async function prefillFromServer() {
    const id = getEncuestaIdFromURL();
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/encuestas/publico/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const data = json?.data;
      const cliente = data?.cliente;
      const nameInput = document.getElementById('clientName');
      if (nameInput && cliente?.nombre) {
        nameInput.value = String(cliente.nombre);
        nameInput.readOnly = true;
      }
    } catch (_) {
      // no bloquear la encuesta si falla el prefill
    }
  }
  function $all(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function groupBy(arr, key) { return arr.reduce((m, el) => ((m[el[key]] = m[el[key]] || []).push(el), m), {}); }

  function markError(el) {
    try {
      el.classList.add('field-error');
      el.style.outline = '2px solid rgba(209,19,28,0.6)'; // red outline
      el.style.outlineOffset = '2px';
    } catch (_) {}
  }
  function clearMarks() {
    $all('.field-error').forEach(el => {
      el.classList.remove('field-error');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return !!(rect.width || rect.height) && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  }

  // --- Footer date updater ---
  function formatTodayDDMMYY() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }
  function updateFooterDate() {
    try {
      const items = Array.from(document.querySelectorAll('.footer-item'));
      if (!items.length) return;
      const target = items.find(it => {
        const label = it.querySelector('.footer-label');
        return label && /fecha\s*:*/i.test(label.textContent.trim());
      });
      if (!target) return;
      // The date value is expected in a <p> sibling within the same .footer-item
      const ps = target.querySelectorAll('p');
      // usually first <p> is the label, second is the value
      const valueEl = ps.length > 1 ? ps[1] : null;
      if (valueEl) valueEl.textContent = formatTodayDDMMYY();
    } catch (_) { /* noop */ }
  }

  function validatePage() {
    clearMarks();
    const errors = [];

    // 1) Required fields by attribute (works for Examenes.html textareas/inputs already marked required)
    const attrRequired = $all('input[required], select[required], textarea[required]');
    for (const el of attrRequired) {
      if (!isVisible(el)) continue;
      if (el.type === 'radio' || el.type === 'checkbox') continue; // radio/checkbox handled by group logic
      if (!String(el.value || '').trim()) {
        errors.push({ el, msg: 'Campo requerido sin completar.' });
      }
    }

    // 2) Implicit required fields in common sections (client/user info) even if HTML lacks required
    const implicitInputs = $all(
      '.client-details input[type="text"], .client-details input[type="date"],\
       .user-info-section input[type="text"], .user-info-section input[type="date"]'
    );
    for (const el of implicitInputs) {
      if (!isVisible(el)) continue;
      if (!String(el.value || '').trim()) {
        errors.push({ el, msg: 'Complete los datos requeridos.' });
      }
    }

    // 3) Radio groups: require one checked per group inside typical containers
    const radioContainers = $all('.radio-group, .options-group');
    const visitedNames = new Set();
    for (const container of radioContainers) {
      const radios = $all('input[type="radio"]', container);
      if (!radios.length) continue;
      const byName = groupBy(radios, 'name');
      for (const name in byName) {
        if (visitedNames.has(name)) continue; // avoid duplicates if multiple containers reuse name
        visitedNames.add(name);
        const anyChecked = byName[name].some(r => r.checked);
        if (!anyChecked) {
          // mark the first radio and the container
          const el = byName[name][0];
          errors.push({ el, msg: 'Seleccione una opción.' });
        }
      }
    }

    // 4) Open textareas explicitly required (e.g., Examenes desarrollo)
    const reqTextareas = $all('textarea[required]');
    for (const t of reqTextareas) {
      if (!isVisible(t)) continue;
      if (!String(t.value || '').trim()) {
        errors.push({ el: t, msg: 'Responda este campo.' });
      }
    }

    // Highlight and scroll to first error
    if (errors.length) {
      const first = errors[0].el;
      markError(first);
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showModal('Por favor complete todos los campos y preguntas antes de enviar.');
    }

    return { valid: errors.length === 0, errors };
  }

  function attachHandlers() {
    // For real forms (Examenes.html)
    $all('form').forEach(form => {
      form.addEventListener('submit', async evt => {
        const { valid } = validatePage();
        if (!valid) { evt.preventDefault(); return; }
        evt.preventDefault();
        try {
          showModal('Enviando, por favor espere...');
          await submitToServer();
          showModal('¡Enviado con éxito! Gracias por su respuesta.');
          form.reset();
        } catch (e) {
          showModal(`No se pudo enviar. ${e?.message || 'Intente de nuevo.'}`);
        }
      }, { capture: true });
    });

    // For pages without <form> (index.html, EncuestaCurso.html), catch button click
    $all('button.submit-button').forEach(btn => {
      btn.addEventListener('click', async evt => {
        const { valid } = validatePage();
        if (!valid) { evt.preventDefault(); return; }
        evt.preventDefault();
        try {
          showModal('Enviando, por favor espere...');
          await submitToServer();
          showModal('¡Enviado con éxito! Gracias por su respuesta.');
        } catch (e) {
          showModal(`No se pudo enviar. ${e?.message || 'Intente de nuevo.'}`);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', attachHandlers);
  document.addEventListener('DOMContentLoaded', updateFooterDate);
  document.addEventListener('DOMContentLoaded', prefillFromServer);
})();
