// agregar_productos.js
// UX dinámico para crear productos con componentes y cálculo de tarifa renta

(function(){
  // Helpers
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const fmt = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(isFinite(n)? n : 0);
  // Base URL del API: robusto para file:// y http(s)://
  const API_BASE = (function(){
    try {
      if (location.protocol === 'file:') return 'http://localhost:3001';
      if (location.origin && /^https?:/i.test(location.origin)) return location.origin;
      if (location.host) return `${location.protocol}//${location.host}`;
    } catch(_) {}
    return 'http://localhost:3001';
  })();
  console.log('[agregar_productos] API_BASE=', API_BASE, 'origin=', location.origin, 'protocol=', location.protocol);

  // Estado de formulario
  let editId = null; // id del producto en modo edición
  let componentes = []; // { clave, nombre, descripcion, tarifa, cantidad, precio, peso, garantia, ubicacion, imagenes: string[] }
  let accesorios = []; // { clave, nombre, descripcion, tipo: 'venta'|'renta', precio, tarifa, cantidad, imagenes: string[] }
  let imagenes = []; // dataURLs

  // Elementos
  const form = $('#producto-form');
  const nombre = $('#prd-nombre');
  const categoria = $('#prd-categoria');
  const descripcion = $('#prd-descripcion');
  const precioVenta = $('#prd-precio-venta');
  const tarifaRenta = $('#prd-tarifa-renta');
  const tarifaPunta = $('#prd-tarifa-punta');
  const tarifaRentaField = $('#tarifa-renta-field');
  // Flags venta/renta
  const chkVenta = $('#prd-para-venta');
  const chkRenta = $('#prd-para-renta');

  const inputImgs = $('#prd-imagenes');
  const previewGrid = $('#preview-grid');

  const listaComponentes = $('#componentes-list');
  const btnAddComponente = $('#btn-add-componente');
  const totalRentaLabel = $('#total-renta');
  // Accesorios
  const listaAccesorios = $('#accesorios-list');
  const btnAddAccesorio = $('#btn-add-accesorio');

  // Inicializar
  function init(){
    bindEventos();
    renderComponentes();
    renderImagenes();
    renderAccesorios();
    ensureGuardarAccesoriosButton();
    actualizarTotales();
    syncCategoria();
    syncFlags();
    // Cargar si viene ?id=
    const url = new URL(location.href);
    const qid = url.searchParams.get('id');
    if (qid) {
      editId = qid;
      cargarProductoParaEditar(qid);
    }
  }

  // Utilidad: leer archivos como DataURL
  function readFilesAsDataURLs(files){
    const readers = files.map(file => new Promise(res => {
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.readAsDataURL(file);
    }));
    return Promise.all(readers);
  }

  // Eventos
  function bindEventos(){
    if (btnAddComponente) btnAddComponente.addEventListener('click', addComponente);
    if (btnAddAccesorio) btnAddAccesorio.addEventListener('click', addAccesorio);

    if (inputImgs) inputImgs.addEventListener('change', handleImagenes);

    if (categoria) categoria.addEventListener('change', syncCategoria);

    if (chkVenta) chkVenta.addEventListener('change', syncFlags);
    if (chkRenta) chkRenta.addEventListener('change', syncFlags);

    if (form) form.addEventListener('submit', onSubmit);
  }

  async function cargarProductoParaEditar(id){
    try {
      const resp = await fetch(`${API_BASE}/api/productos/${id}`);
      if (!resp.ok) throw new Error('No se pudo cargar el producto');
      const p = await resp.json();
      // Llenar campos básicos
      if (nombre) nombre.value = p.nombre || '';
      if (categoria) categoria.value = p.categoria || '';
      if (descripcion) descripcion.value = p.descripcion || '';
      if (precioVenta) precioVenta.value = (p.precio_venta||0).toFixed(2);
      if (tarifaRenta) tarifaRenta.value = (p.tarifa_renta||0).toFixed(2);
      if (chkVenta) chkVenta.checked = !!p.venta;
      if (chkRenta) chkRenta.checked = !!p.renta;
      syncFlags();
      syncCategoria();
      // Portada
      imagenes = [];
      if (p.imagen_portada) imagenes.push(p.imagen_portada);
      renderImagenes();
      // Componentes
      componentes = (p.componentes||[]).map(c => ({
        clave: c.clave || '',
        nombre: c.nombre || '',
        descripcion: c.descripcion || '',
        precio: Number(c.precio)||0,
        tarifa: Number(c.tarifa)||0,
        cantidad: Number(c.cantidad)||0,
        cantidad_stock: Number(c.cantidad_stock)||0,
        cantidad_precio: Number(c.cantidad_precio)||0,
        peso: Number(c.peso)||0,
        garantia: Number(c.garantia)||0,
        ubicacion: c.ubicacion || '',
        imagenes: c.imagen ? [c.imagen] : []
      }));
      renderComponentes();
      actualizarTotales();
      console.log('[editar producto] cargado', p);
    } catch (e) {
      console.error('Error cargando producto:', e);
      alert('No se pudo cargar el producto para edición');
    }
  }

  function syncCategoria(){
    const val = (categoria?.value || '').toLowerCase();
    // Templetes: eliminar campo tarifa renta (solo venta)
    if (val === 'templetes') {
      tarifaRentaField.style.display = 'none';
      tarifaRenta.value = '';
    } else {
      tarifaRentaField.style.display = '';
      actualizarTotales();
    }
  }

  // Mostrar/ocultar campos según flags de venta/renta
  function syncFlags(){
    const isVenta = !!(chkVenta && chkVenta.checked);
    const isRenta = !!(chkRenta && chkRenta.checked);
    // Precio venta visible solo si para venta
    if (precioVenta) {
      const field = precioVenta.closest('.field');
      if (field) field.style.display = isVenta ? '' : 'none';
      if (!isVenta) precioVenta.value = '';
    }
    // Tarifa renta visible solo si para renta y no templetes oculto
    if (tarifaRentaField) {
      const val = (categoria?.value || '').toLowerCase();
      tarifaRentaField.style.display = (isRenta && val !== 'templetes') ? '' : 'none';
      if (!isRenta) tarifaRenta.value = '';
    }
  }

  // Componentes dinámicos
  function addComponente(){
    componentes.push({ clave:'', nombre:'', descripcion:'', precio:0, tarifa:0, cantidad_precio:0, cantidad_stock:0, peso:0, garantia:0, ubicacion:'', imagenes: [] });
    renderComponentes();
    actualizarTotales();
  }

  function removeComponente(index){
    componentes.splice(index,1);
    renderComponentes();
    actualizarTotales();
  }

  function incCantidadPrecio(index){
    const v = Math.max(0, (componentes[index].cantidad_precio||0) + 1);
    componentes[index].cantidad_precio = v;
    renderComponentes();
    actualizarTotales();
  }

  function decCantidadPrecio(index){
    const v = Math.max(0, (componentes[index].cantidad_precio||0) - 1);
    componentes[index].cantidad_precio = v;
    renderComponentes();
    actualizarTotales();
  }

  function incCantidadStock(index){
    const v = Math.max(0, (componentes[index].cantidad_stock||0) + 1);
    componentes[index].cantidad_stock = v;
    renderComponentes();
    actualizarTotales();
  }

  function decCantidadStock(index){
    const v = Math.max(0, (componentes[index].cantidad_stock||0) - 1);
    componentes[index].cantidad_stock = v;
    renderComponentes();
    actualizarTotales();
  }

  function updateField(index, field, value){
    if (field === 'tarifa' || field === 'cantidad_precio' || field === 'cantidad_stock' || field === 'precio' || field === 'peso' || field === 'garantia') {
      const n = parseFloat(value);
      componentes[index][field] = isFinite(n) ? n : 0;
    } else {
      componentes[index][field] = value;
    }
    actualizarTotales();
  }

  function renderComponentes(){
    if (!listaComponentes) return;
    if (componentes.length === 0) {
      listaComponentes.innerHTML = '<div style="color:#9fb3c8">No hay componentes. Agrega con el botón \'Agregar Componente\'.</div>';
      return;
    }
    listaComponentes.innerHTML = componentes.map((c, i) => `
      <div class="componente-card" data-index="${i}">
        <div class="field">
          <label>Clave <span class="badge">${c.clave || '—'}</span></label>
          <input type="text" value="${c.clave}" placeholder="Ej. 150" oninput="this.closest('.componente-card').__onClave(this.value)" />
        </div>
        <div class="field">
          <label>Nombre</label>
          <input type="text" value="${c.nombre}" placeholder="Nombre de componente" oninput="this.closest('.componente-card').__onNombre(this.value)" />
        </div>
        <div class="field">
          <label>Descripción</label>
          <textarea rows="2" placeholder="Detalle o notas del componente" oninput="this.closest('.componente-card').__onDescripcion(this.value)">${c.descripcion||''}</textarea>
        </div>
        <div class="field">
          <label>Precio Venta</label>
          <input type="number" min="0" step="0.01" value="${c.precio||0}" oninput="this.closest('.componente-card').__onPrecio(this.value)" />
        </div>
        <div class="field">
          <label>Tarifa</label>
          <input type="number" min="0" step="0.01" value="${c.tarifa}" oninput="this.closest('.componente-card').__onTarifa(this.value)" />
        </div>
        <div class="field">
          <label>Peso (kg)</label>
          <input type="number" min="0" step="0.01" value="${c.peso||0}" oninput="this.closest('.componente-card').__onPeso(this.value)" />
        </div>
        <div class="field">
          <label>Garantía</label>
          <input type="number" min="0" step="0.01" value="${c.garantia||0}" oninput="this.closest('.componente-card').__onGarantia(this.value)" />
        </div>
       <div class="field">
       <label for="cmp-ubicacion">Ubicación</label>
  <select id="cmp-ubicacion" required oninput="this.closest('.componente-card').__onUbicacion(this.value)">
    <option value="">Selecciona...</option>
    <option value="Bodega 68 CDMX" ${c.ubicacion==='Bodega 68 CDMX'?'selected':''}>Bodega 68 CDMX</option>
    <option value="Bodega texcoco" ${c.ubicacion==='Bodega texcoco'?'selected':''}>Bodega texcoco</option>
  </select>
  
</div>
        <div class="field">
          <label>Cantidad (Precio/Tarifa)</label>
          <div class="qty-controls">
            <button type="button" class="btn-dec-precio"><i class="fa fa-minus"></i></button>
            <input type="number" min="0" value="${c.cantidad_precio||0}" oninput="this.closest('.componente-card').__onCantidadPrecio(this.value)" />
            <button type="button" class="btn-inc-precio"><i class="fa fa-plus"></i></button>
          </div>
        </div>
        <div class="field">
          <label>Cantidad (Stock)</label>
          <div class="qty-controls">
            <button type="button" class="btn-dec-stock"><i class="fa fa-minus"></i></button>
            <input type="number" min="0" value="${c.cantidad_stock||0}" oninput="this.closest('.componente-card').__onCantidadStock(this.value)" />
            <button type="button" class="btn-inc-stock"><i class="fa fa-plus"></i></button>
          </div>
        </div>
        <div class="field" style="min-width:220px;">
          <label>Imágenes</label>
          <input type="file" accept="image/*" multiple />
          <div class="cmp-preview-grid" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            ${ (c.imagenes||[]).map((src, j)=>`
              <div class="preview" data-idx="${j}" style="position:relative;width:64px;height:64px;border:1px solid #2b3a49;border-radius:8px;overflow:hidden;">
                <img src="${src}" style="width:100%;height:100%;object-fit:cover;"/>
                <button type="button" class="remove" title="Quitar" style="position:absolute;top:2px;right:2px;background:#1f2a36;border:none;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center">
                  <i class="fa fa-times" style="font-size:12px"></i>
                </button>
              </div>
            `).join('') }
          </div>
        </div>
        <div class="field" style="min-width:120px;flex:0 0 auto;">
          <label>&nbsp;</label>
          <button type="button" class="btn-remove" style="background:#f44336;color:#fff;border:none;border-radius:10px;padding:10px 12px"><i class="fa fa-trash"></i></button>
        </div>
      </div>
    `).join('');

    // Bind por card para evitar inline globals
    $$('.componente-card', listaComponentes).forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'),10);
      card.__onClave = (v)=>{ updateField(idx,'clave',v); card.querySelector('.badge').textContent = v || '—'; };
      card.__onNombre = (v)=>updateField(idx,'nombre',v);
      card.__onPrecio = (v)=>updateField(idx,'precio',v);
      card.__onTarifa = (v)=>updateField(idx,'tarifa',v);
      card.__onCantidadPrecio = (v)=>updateField(idx,'cantidad_precio',v);
      card.__onCantidadStock = (v)=>updateField(idx,'cantidad_stock',v);
      card.__onDescripcion = (v)=>updateField(idx,'descripcion',v);
      card.__onPeso = (v)=>updateField(idx,'peso',v);
      card.__onGarantia = (v)=>updateField(idx,'garantia',v);
      card.__onUbicacion = (v)=>updateField(idx,'ubicacion',v);
      $('.btn-dec-precio', card).onclick = ()=>decCantidadPrecio(idx);
      $('.btn-inc-precio', card).onclick = ()=>incCantidadPrecio(idx);
      $('.btn-dec-stock', card).onclick = ()=>decCantidadStock(idx);
      $('.btn-inc-stock', card).onclick = ()=>incCantidadStock(idx);
      $('.btn-remove', card).onclick = ()=>removeComponente(idx);
      // Imágenes por componente
      const fileInput = card.querySelector('input[type=file]');
      if (fileInput) fileInput.onchange = async (e)=>{
        const files = Array.from(e.target.files||[]);
        const datas = await readFilesAsDataURLs(files);
        componentes[idx].imagenes = (componentes[idx].imagenes||[]).concat(datas);
        renderComponentes();
      };
      const grid = card.querySelector('.cmp-preview-grid');
      if (grid) {
        $$('.preview .remove', grid).forEach(btn => {
          btn.onclick = ()=>{
            const p = btn.closest('.preview');
            const j = parseInt(p.getAttribute('data-idx'),10);
            componentes[idx].imagenes.splice(j,1);
            renderComponentes();
          };
        });
      }
    });
  }

  // Accesorios dinámicos
  function addAccesorio(){
    accesorios.push({ clave:'', nombre:'', descripcion:'', tipo:'venta', precio:0, tarifa:0, cantidad:1, peso:0, garantia:0, ubicacion:'', imagenes: [] });
    renderAccesorios();
    actualizarTotales();
  }
  function removeAccesorio(index){
    accesorios.splice(index,1);
    renderAccesorios();
    actualizarTotales();
  }
  function incAccCantidad(index){
    accesorios[index].cantidad = Math.max(0, (accesorios[index].cantidad||0) + 1);
    renderAccesorios();
    actualizarTotales();
  }

  // --- Guardar accesorios de forma independiente ---
  async function guardarAccesorios(){
    if (!Array.isArray(accesorios) || accesorios.length === 0) {
      alert('No hay accesorios para guardar');
      return;
    }
    const confirmMsg = 'Se guardarán los accesorios como artículos de inventario (accesorios) independientes. ¿Continuar?';
    if (!confirm(confirmMsg)) return;

    let okCount = 0, failCount = 0;
    for (const a of accesorios) {
      const payload = {
        nombre: (a.nombre||'').trim() || 'Accesorio',
        clave: (a.clave||'').trim() || null,
        categoria: 'Accesorio',
        estado: 'Disponible',
        stock: Number(a.cantidad)||0,
        precio_unitario: Number(a.precio)||0,
        descripcion: a.descripcion||'',
        imagen: (a.imagenes && a.imagenes[0]) ? a.imagenes[0] : null,
        venta: a.tipo === 'venta',
        renta: a.tipo === 'renta',
        tipo: a.tipo || null,
        tarifa: Number(a.tarifa)||0,
        peso: Number(a.peso)||0,
        garantia: Number(a.garantia)||0,
        ubicacion: (a.ubicacion||'').trim() || null
      };
      try{
        const resp = await fetch(`${API_BASE}/api/equipos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        okCount++;
      }catch(err){
        console.error('Error guardando accesorio:', a, err);
        failCount++;
      }
    }
    const msg = `Accesorios guardados. Exitosos: ${okCount}, Fallidos: ${failCount}`;
    console.log('[agregar_productos] ' + msg);
    const done = document.createElement('div');
    done.className = 'toast-ok';
    done.textContent = msg;
    document.body.appendChild(done);
  }

  function ensureGuardarAccesoriosButton(){
    if (!listaAccesorios) return;
    // Inserta un botón de Guardar Accesorios debajo del listado si no existe
    let container = listaAccesorios.parentElement;
    if (!container) container = document.body;
    if (!document.querySelector('#btn-guardar-accesorios')){
      const btn = document.createElement('button');
      btn.id = 'btn-guardar-accesorios';
      btn.type = 'button';
      btn.textContent = 'Guardar Accesorios';
      btn.className = 'btn btn-primary';
      btn.style.marginTop = '8px';
      btn.addEventListener('click', guardarAccesorios);
      container.appendChild(btn);
    }
  }
  function decAccCantidad(index){
    accesorios[index].cantidad = Math.max(0, (accesorios[index].cantidad||0) - 1);
    renderAccesorios();
    actualizarTotales();
  }
  function updateAccField(index, field, value){
    if (field === 'precio' || field === 'tarifa' || field === 'cantidad' || field === 'peso' || field === 'garantia') {
      const n = parseFloat(value);
      accesorios[index][field] = isFinite(n) ? n : 0;
    } else if (field === 'clave') {
      accesorios[index][field] = value;
      // Auto-ajustar tipo según clave
      const n = parseInt(value, 10);
      if (isFinite(n)) {
        if (n >= 1000) accesorios[index].tipo = 'renta';
        else if (n >= 1 && n <= 999) accesorios[index].tipo = 'venta';
      }
    } else if (field === 'tipo') {
      accesorios[index][field] = (value === 'renta') ? 'renta' : 'venta';
    } else {
      accesorios[index][field] = value;
    }
    actualizarTotales();
  }
  function renderAccesorios(){
    if (!listaAccesorios) return;
    if (accesorios.length === 0) {
      listaAccesorios.innerHTML = '<div style="color:#9fb3c8">No hay accesorios. Agrega con el botón \'Agregar Accesorio\'.</div>';
      return;
    }
    listaAccesorios.innerHTML = accesorios.map((a, i) => `
      <div class="componente-card" data-index="${i}">
        <div class="field">
          <label>Clave <span class="badge">${a.clave || '—'}</span></label>
          <input type="text" value="${a.clave||''}" placeholder="Ej. 120, 1000" oninput="this.closest('.componente-card').__onClave(this.value)" />
        </div>
        <div class="field">
          <label>Nombre</label>
          <input type="text" value="${a.nombre||''}" placeholder="Nombre del accesorio" oninput="this.closest('.componente-card').__onNombre(this.value)" />
        </div>
        <div class="field">
          <label>Descripción</label>
          <textarea rows="2" placeholder="Detalle o notas del accesorio" oninput="this.closest('.componente-card').__onDescripcion(this.value)">${a.descripcion||''}</textarea>
        </div>
        <div class="field">
          <label>Clasificación</label>
          <select oninput="this.closest('.componente-card').__onTipo(this.value)">
            <option value="venta" ${a.tipo==='venta'?'selected':''}>Venta (1-999)</option>
            <option value="renta" ${a.tipo==='renta'?'selected':''}>Renta (1000/2000/3000)</option>
          </select>
        </div>
        <div class="field">
          <label>Precio Venta</label>
          <input type="number" min="0" step="0.01" value="${a.precio||0}" oninput="this.closest('.componente-card').__onPrecio(this.value)" />
        </div>
        <div class="field">
          <label>Tarifa</label>
          <input type="number" min="0" step="0.01" value="${a.tarifa||0}" oninput="this.closest('.componente-card').__onTarifa(this.value)" />
        </div>
        <div class="field">
          <label>Peso (kg)</label>
          <input type="number" min="0" step="0.01" value="${a.peso||0}" oninput="this.closest('.componente-card').__onPeso(this.value)" />
        </div>
        <div class="field">
          <label>Garantía</label>
          <input type="number" min="0" step="0.01" value="${a.garantia||0}" oninput="this.closest('.componente-card').__onGarantia(this.value)" />
        </div>
        <div class="field">
         <label for="acc-ubicacion">Ubicación</label>
  <select id="acc-ubicacion" required oninput="this.closest('.componente-card').__onUbicacion(this.value)">
    <option value="">Selecciona...</option>
    <option value="Bodega 68 CDMX" ${a.ubicacion==='Bodega 68 CDMX'?'selected':''}>Bodega 68 CDMX</option>
    <option value="Bodega Texcoco" ${a.ubicacion==='Bodega Texcoco'?'selected':''}>Bodega Texcoco</option>
  </select>
  
</div>
        <div class="field">
          <label>Cantidad</label>
          <div class="qty-controls">
            <button type="button" class="btn-dec"><i class="fa fa-minus"></i></button>
            <input type="number" min="0" value="${a.cantidad}" oninput="this.closest('.componente-card').__onCantidad(this.value)" />
            <button type="button" class="btn-inc"><i class="fa fa-plus"></i></button>
          </div>
        </div>
        <div class="field" style="min-width:220px;">
          <label>Imágenes</label>
          <input type="file" accept="image/*" multiple />
          <div class="acc-preview-grid" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            ${ (a.imagenes||[]).map((src, j)=>`
              <div class="preview" data-idx="${j}" style="position:relative;width:64px;height:64px;border:1px solid #2b3a49;border-radius:8px;overflow:hidden;">
                <img src="${src}" style="width:100%;height:100%;object-fit:cover;"/>
                <button type="button" class="remove" title="Quitar" style="position:absolute;top:2px;right:2px;background:#1f2a36;border:none;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center">
                  <i class="fa fa-times" style="font-size:12px"></i>
                </button>
              </div>
            `).join('') }
          </div>
        </div>
        <div class="field" style="min-width:120px;flex:0 0 auto;">
          <label>&nbsp;</label>
          <button type="button" class="btn-remove" style="background:#f44336;color:#fff;border:none;border-radius:10px;padding:10px 12px"><i class="fa fa-trash"></i></button>
        </div>
      </div>
    `).join('');

    $$('.componente-card', listaAccesorios).forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'),10);
      card.__onClave = (v)=>{ updateAccField(idx,'clave',v); const b=card.querySelector('.badge'); if(b) b.textContent = v || '—'; };
      card.__onNombre = (v)=>updateAccField(idx,'nombre',v);
      card.__onTipo = (v)=>updateAccField(idx,'tipo',v);
      card.__onPrecio = (v)=>updateAccField(idx,'precio',v);
      card.__onTarifa = (v)=>updateAccField(idx,'tarifa',v);
      card.__onCantidad = (v)=>updateAccField(idx,'cantidad',v);
      card.__onDescripcion = (v)=>updateAccField(idx,'descripcion',v);
      card.__onPeso = (v)=>updateAccField(idx,'peso',v);
      card.__onGarantia = (v)=>updateAccField(idx,'garantia',v);
      card.__onUbicacion = (v)=>updateAccField(idx,'ubicacion',v);
      $('.btn-dec', card).onclick = ()=>decAccCantidad(idx);
      $('.btn-inc', card).onclick = ()=>incAccCantidad(idx);
      $('.btn-remove', card).onclick = ()=>removeAccesorio(idx);
      // Imagenes por accesorio
      const fileInput = card.querySelector('input[type=file]');
      if (fileInput) fileInput.onchange = async (e)=>{
        const files = Array.from(e.target.files||[]);
        const datas = await readFilesAsDataURLs(files);
        accesorios[idx].imagenes = (accesorios[idx].imagenes||[]).concat(datas);
        renderAccesorios();
      };
      const grid = card.querySelector('.acc-preview-grid');
      if (grid) {
        $$('.preview .remove', grid).forEach(btn => {
          btn.onclick = ()=>{
            const p = btn.closest('.preview');
            const j = parseInt(p.getAttribute('data-idx'),10);
            accesorios[idx].imagenes.splice(j,1);
            renderAccesorios();
          };
        });
      }
    });
  }

  // Imágenes múltiples + previews
  function handleImagenes(e){
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const readers = files.map(file => new Promise(res => {
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(datas => {
      imagenes = imagenes.concat(datas);
      renderImagenes();
    });
  }

  function renderImagenes(){
    if (!previewGrid) return;
    if (imagenes.length === 0) { previewGrid.innerHTML = ''; return; }
    previewGrid.innerHTML = imagenes.map((src, i)=>`
      <div class="preview" data-index="${i}">
        <img src="${src}" alt="imagen ${i}" />
        <button type="button" class="remove"><i class="fa fa-times"></i></button>
      </div>
    `).join('');
    $$('.preview', previewGrid).forEach(card => {
      const i = parseInt(card.getAttribute('data-index'),10);
      $('.remove', card).onclick = ()=>{ imagenes.splice(i,1); renderImagenes(); };
    });
  }

  // Totales
  function calcularTarifaRenta(){
    const rentaComponentes = componentes.reduce((acc, c) => acc + (parseFloat(c.tarifa)||0) * (parseFloat(c.cantidad_precio)||0), 0);
    // Accesorios ya no participan en renta del producto
    return rentaComponentes;
  }
  function calcularTotalVenta(){
    const ventaComponentes = componentes.reduce((acc, c) => acc + (parseFloat(c.precio)||0) * (parseFloat(c.cantidad_precio)||0), 0);
    // Accesorios ya no participan en precio de venta del producto
    return ventaComponentes;
  }
  function actualizarTotales(){
    const totalRenta = calcularTarifaRenta();
    if (tarifaRenta) tarifaRenta.value = totalRenta.toFixed(2);
    if (totalRentaLabel) totalRentaLabel.textContent = fmt(totalRenta);
    // Total venta y precio de venta auto
    const totalVenta = calcularTotalVenta();
    const totalVentaLabel = document.querySelector('#total-venta');
    if (totalVentaLabel) totalVentaLabel.textContent = fmt(totalVenta);
    if (chkVenta && chkVenta.checked && precioVenta) {
      precioVenta.value = totalVenta.toFixed(2);
    }
  }

  // Validación básica
  function validar(){
    let ok = true;
    const req = [nombre, categoria, descripcion];
    req.forEach(f => {
      const field = f.closest('.field');
      if (!f.value || (f === categoria && !f.value)) { field.classList.add('invalid'); ok = false; }
      else field.classList.remove('invalid');
    });
    // Al menos un tipo seleccionado
    const atLeastOne = (chkVenta && chkVenta.checked) || (chkRenta && chkRenta.checked);
    if (!atLeastOne) {
      alert('Selecciona al menos una opción: Para Venta o Para Renta');
      ok = false;
    }
    // Si es venta, precioVenta requerido
    if (chkVenta && chkVenta.checked) {
      const field = precioVenta.closest('.field');
      if (!precioVenta.value) { field.classList.add('invalid'); ok = false; }
      else field.classList.remove('invalid');
    }
    // Si categoría es Templetes, no exigir tarifa renta
    if ((categoria.value||'').toLowerCase() !== 'templetes' && (componentes.length === 0)) {
      // permitir 0 componentes pero avisar del total 0
    }
    return ok;
  }

  async function onSubmit(e){
    e.preventDefault();
    if (!validar()) return;

    // Mapear imágenes: portada = primera imagen del producto
    const imagen_portada = imagenes && imagenes.length ? imagenes[0] : null;

    // Reducir payload de componentes/accesorios: tomar primera imagen como 'imagen'
    const componentesPayload = componentes.map(c => ({
      ...c,
      imagen: (c.imagenes && c.imagenes[0]) ? c.imagenes[0] : null
    }));
    // Accesorios: independientes, no se envían ligados al producto

    const data = {
      nombre: nombre.value.trim(),
      categoria: categoria.value,
      descripcion: descripcion.value.trim(),
      precio_venta: (chkVenta && chkVenta.checked) ? parseFloat(precioVenta.value||'0') : 0,
      tarifa_punta: parseFloat(((tarifaPunta && tarifaPunta.value) || '0')),
      tarifa_renta: (chkRenta && chkRenta.checked && categoria.value.toLowerCase()!=='templetes') ? calcularTarifaRenta() : 0,
      venta: !!(chkVenta && chkVenta.checked),
      renta: !!(chkRenta && chkRenta.checked),
      componentes: componentesPayload,
      imagen_portada,
      imagenes
    };

    try {
      console.log('[agregar_productos] Payload a enviar:', data);
      const url = editId ? `${API_BASE}/api/productos/${editId}` : `${API_BASE}/api/productos`;
      const method = editId ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({ error: 'Error al crear' }));
        console.error('Error guardando producto:', err);
        return;
      }
      const json = await resp.json().catch(()=>({ ok:true }));
      console.log('[agregar_productos] Producto guardado OK:', json);
      // No redirigir automáticamente para poder inspeccionar consola
      const doneMsg = document.createElement('div');
      doneMsg.className = 'toast-ok';
      doneMsg.textContent = editId ? `Producto actualizado (ID ${editId}).` : `Producto creado (ID ${json.id_producto}).`;
      document.body.appendChild(doneMsg);
    } catch (error) {
      console.error('Fallo en la solicitud:', error);
    }
  }

  init();
})();
