(function(){
      const steps = Array.from(document.querySelectorAll('.step-content'));
      const dots = Array.from(document.querySelectorAll('.step-indicator .step'));
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');
      const modal = {
        prod: document.getElementById('modalProducto'),
        acc: document.getElementById('modalAccesorio'),
        fac: document.getElementById('modalFacturacion'),
      };
      let current = 0;
      const pDots = document.getElementById('progressDots');

      // Catálogo dinámico desde backend (venta)
      let catalogo = [];

      function normalizeEquipo(e){
        const id = e.id || e._id || e.id_producto || e.clave || e.codigo || cryptoRandomId();
        const nombre = e.nombre || e.titulo || e.descripcionCorta || 'Producto';
        const desc = e.descripcion || e.descripcionCorta || e.detalle || '';
        // Usar precio de venta; soportar snake_case y otras variantes
        const precio = Number(
          e.precio_venta ?? e.precioVenta ?? e.precioVentaUnit ?? e.precio ?? e.precioUnitario ?? 0
        ) || 0;
        const img = (e.imagenUrl || e.imagen || (Array.isArray(e.imagenes) && e.imagenes[0]) || (e.fotos && e.fotos[0]) || 'img/default.jpg');
        return { id, nombre, desc, precio, img };
      }

      function cryptoRandomId(){
        try { return crypto.randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2); }
      }

      async function cargarCatalogoVenta(){
        const endpoints = [
          // Nuevo endpoint público basado en public.productos
          'http://localhost:3001/api/productos/disponibles',
          'http://localhost:3001/api/productos',
        ];
        let ok = false;
        for (const url of endpoints) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            let data = await resp.json();
            if (Array.isArray(data?.data)) data = data.data;
            const lista = Array.isArray(data) ? data : [];
            catalogo = lista.map(normalizeEquipo);
            console.log('Productos cargados desde', url, '->', catalogo.length);
            ok = true; break;
          } catch (e) {
            console.warn('Fallo', url, e);
          }
        }
        if (!ok) {
          console.error('No se pudo cargar catálogo desde API. Usando fallback.');
          catalogo = [
            { id:'fallback-1', nombre:'Producto A', desc:'Descripción', precio:150, img:'img/default.jpg' },
            { id:'fallback-2', nombre:'Producto B', desc:'Descripción', precio:200, img:'img/default.jpg' },
            { id:'fallback-3', nombre:'Producto C', desc:'Descripción', precio:250, img:'img/default.jpg' },
          ];
        }

        // Render inicial si estamos en paso 2
        if (current === 0) {
          renderStepProductos();
        }
      }
      const accs = [
        { id:'plataforma', nombre:'Plataforma de Trabajo', desc:'Plataforma metálica 1.5m x 2m', precio:50, img:'img/default.jpg' },
        { id:'barandal', nombre:'Barandal de Seguridad', desc:'Barandal tubular con red', precio:30, img:'img/default.jpg' },
        { id:'acceso', nombre:'Escalera de Acceso', desc:'Escalera integrada al andamio', precio:25, img:'img/default.jpg' },
      ];

      const seleccion = { productos: [], accesorios: [] };

      function render(){
        steps.forEach((el,i)=>{ el.hidden = i !== current; });
        dots.forEach((d,i)=>{ d.classList.toggle('active', i === current); });
        prevBtn.disabled = current === 0;
        nextBtn.hidden = current === steps.length - 1;

        // progress dots visual
        pDots.innerHTML = '';
        for (let i=0; i<steps.length; i++) {
          const dot = document.createElement('div');
          dot.className = 'dot' + (i < current ? ' completed' : i===current ? ' active' : '');
          pDots.appendChild(dot);
        }

        // step-specific renders
        if (current === 0) renderStepProductos();
        if (current === 1) renderResumenProductos();
        if (current === 2) renderStepAccesorios();
        if (current === 3) renderResumenAccesorios();

        // reglas UX: bloquear siguiente si no hay selección en paso 2
        if (current === 0) {
          nextBtn.disabled = seleccion.productos.length === 0;
        } else {
          nextBtn.disabled = false;
        }
      }

      // Navegación
      prevBtn.addEventListener('click', ()=>{ if(current>0){ current--; render(); }});
      nextBtn.addEventListener('click', ()=>{ if(current<steps.length-1){ current++; render(); }});

      // Botones especiales
      document.getElementById('btnAbrirFacturacion')?.addEventListener('click', ()=>{ modal.fac.style.display='block'; });
      document.getElementById('btnHojaPedido')?.addEventListener('click', ()=>{ alert('Vista previa de Hoja de Pedido (pendiente de enlace).'); });
      // Cierre/acciones modales
      document.getElementById('mpCancelar')?.addEventListener('click', ()=> modal.prod.style.display='none');
      document.getElementById('mpGuardar')?.addEventListener('click', ()=> { modal.prod.style.display='none'; /* guardar cambios */});
      document.getElementById('maCancelar')?.addEventListener('click', ()=> modal.acc.style.display='none');
      document.getElementById('maGuardar')?.addEventListener('click', ()=> { modal.acc.style.display='none'; /* guardar cambios */});
      document.getElementById('mfCancelar')?.addEventListener('click', ()=> modal.fac.style.display='none');
      document.getElementById('mfTimbrar')?.addEventListener('click', ()=> { modal.fac.style.display='none'; alert('Timbrado simulado.'); });

      // Render helpers
      function cardTemplate(item, selected){
        const precioFmt = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(Number(item.precio||0));
        const imgSrc = item.img || 'img/default.jpg';
        return `\n        <div class=\"product-card ${selected? 'selected':''}\" data-id=\"${item.id}\">\n          <div class=\"chip-sale\">Precio de venta<\/div>\n          <div class=\"card-check\">${selected ? '&#10004;' : '&#43;'}<\/div>\n          <img src=\"${imgSrc}\" class=\"product-image\" alt=\"${item.nombre}\">\n          <div class=\"product-title\">${item.nombre}<\/div>\n          <div class=\"product-description\">${item.desc || ''}<\/div>\n          <div class=\"product-price\">${precioFmt}<\/div>\n        <\/div>`;
      }

      function renderStepProductos(){
        const wrap = document.getElementById('gridProductos');
        if (!wrap) return;
        if (!catalogo || catalogo.length === 0) {
          wrap.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:24px">No se encontraron productos. Revisa la conexión al servidor (http://localhost:3001) o intenta nuevamente.</div>`;
          return;
        }
        wrap.innerHTML = catalogo.map(p=>cardTemplate(p, seleccion.productos.some(s=>s.id===p.id))).join('');
        wrap.querySelectorAll('.product-card').forEach(card=>{
          card.addEventListener('click', ()=>{
            const id = card.getAttribute('data-id');
            const prod = catalogo.find(p=>String(p.id)===String(id));
            const idx = seleccion.productos.findIndex(s=>String(s.id)===String(id));
            if (idx>=0) { seleccion.productos.splice(idx,1); }
            else if (prod) { seleccion.productos.push({ ...prod, cantidad:1 }); }
            renderStepProductos();
          });
        });
        // contador selección
        const contSel = document.getElementById('contadorSeleccion');
        if (contSel) contSel.textContent = `${seleccion.productos.length} seleccionados`;
      }

      function renderResumenProductos(){
        const cont = document.getElementById('resumenProductos');
        cont.innerHTML = '';
        seleccion.productos.forEach(p=>{
          const row = document.createElement('div');
          row.className = 'card inline';
          row.style.alignItems = 'center';
          row.style.gap = '12px';
          row.innerHTML = `
            <img src="${p.img}" alt="${p.nombre}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#101722">
            <div style="flex:1 1 auto">
              <div style="font-weight:700">${p.nombre}</div>
              <div class="muted" style="font-size:12px">$${p.precio}/día</div>
            </div>
            <label style="font-size:12px">Cantidad:</label>
            <input type="number" min="1" value="${p.cantidad}" style="width:80px" class="form-control qty-input">
          `;
          row.querySelector('.qty-input').addEventListener('input', (e)=>{ p.cantidad = Math.max(1, parseInt(e.target.value||'1')); });
          cont.appendChild(row);
        });
      }

      function renderStepAccesorios(){
        const wrap = document.getElementById('gridAccesorios');
        wrap.innerHTML = accs.map(a=>cardTemplate(a, seleccion.accesorios.some(s=>s.id===a.id))).join('');
        wrap.querySelectorAll('.product-card').forEach(card=>{
          card.addEventListener('click', ()=>{
            const id = card.getAttribute('data-id');
            const acc = accs.find(a=>a.id===id);
            const idx = seleccion.accesorios.findIndex(s=>s.id===id);
            if (idx>=0) { seleccion.accesorios.splice(idx,1); }
            else { seleccion.accesorios.push({ ...acc, cantidad:1 }); }
            renderStepAccesorios();
          });
        });
      }

      function renderResumenAccesorios(){
        const cont = document.getElementById('resumenAccesorios');
        cont.innerHTML = '';
        seleccion.accesorios.forEach(a=>{
          const row = document.createElement('div');
          row.className = 'card inline';
          row.style.alignItems = 'center';
          row.style.gap = '12px';
          row.innerHTML = `
            <img src="${a.img}" alt="${a.nombre}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#101722">
            <div style="flex:1 1 auto">
              <div style="font-weight:700">${a.nombre}</div>
              <div class="muted" style="font-size:12px">$${a.precio}/día</div>
            </div>
            <label style="font-size:12px">Cantidad:</label>
            <input type="number" min="1" value="${a.cantidad}" style="width:80px" class="form-control qty-input">
          `;
          row.querySelector('.qty-input').addEventListener('input', (e)=>{ a.cantidad = Math.max(1, parseInt(e.target.value||'1')); });
          cont.appendChild(row);
        });
      }

      render();
      // Cargar productos clasificados para venta
      cargarCatalogoVenta();
    })();
  