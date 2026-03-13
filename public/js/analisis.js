
    (function disableSwInDev() {
      const isDevHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isDevHost || !('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => {
          console.log('[MAP] DEV mode: Service Workers unregistered for localhost');
        })
        .catch((err) => {
          console.error('[MAP] DEV mode: failed to unregister Service Workers', err);
        });
    })();

    // Sidebar eliminado - no se necesita lógica de apertura/cierre

    // Modal Filtros Avanzados y lógica de filtros
    const modalBgFiltros = document.getElementById('modalBgFiltros');
    const formFiltros = document.getElementById('formFiltros');
    const closeFiltros = document.getElementById('closeFiltros');
    const resetFiltros = document.getElementById('resetFiltros');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroCliente = document.getElementById('filtroCliente');
    const filtroEstado = document.getElementById('filtroEstado');
    const filterBtn = document.querySelector('.filter-btn');
    let filtros = { periodo: '30', cliente: 'todos', estado: 'todos' };
    filterBtn.onclick = function() {
      modalBgFiltros.classList.add('active');
      filtroPeriodo.value = filtros.periodo;
      filtroCliente.value = filtros.cliente;
      filtroEstado.value = filtros.estado;
    };
    closeFiltros.onclick = () => modalBgFiltros.classList.remove('active');
    modalBgFiltros.onclick = e => { if(e.target === modalBgFiltros) modalBgFiltros.classList.remove('active'); };
    resetFiltros.onclick = () => {
      filtroPeriodo.value = '30'; filtroCliente.value = 'todos'; filtroEstado.value = 'todos';
    };
    formFiltros.onsubmit = function(e) {
      e.preventDefault();
      filtros = {
        periodo: filtroPeriodo.value,
        cliente: filtroCliente.value,
        estado: filtroEstado.value
      };
      modalBgFiltros.classList.remove('active');
      actualizarDashboard();
    };
    const API_URL = "/api/analisis/operativo";
    function getToken() {
      return localStorage.getItem('token');
    }
    function formatCurrency(value) {
      return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
    }
    function formatPercent(value) {
      return `${(Number(value || 0) * 100).toFixed(1)}%`;
    }
    function formatPeriodLabel(isoDate, bucket) {
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return isoDate;
      if (bucket === 'day') return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      if (bucket === 'week') return `Sem ${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
      return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
    }
    function getRangeByDays(days) {
      const hasta = new Date();
      const desde = new Date();
      desde.setDate(hasta.getDate() - Number(days || 30));
      return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
    }

    function parseMaybeJsonArray(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    }

    function normalizeText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }

    function normalizeCategoryKey(value) {
      const n = normalizeText(value);
      if (!n) return null;
      if (n.includes('accesorio')) return 'otros';
      const hasMarco = n.includes('marco') || n.includes('andamio marco');
      const hasCruceta = n.includes('cruceta') || n.includes('cruzeta');
      if (hasMarco || hasCruceta || n.includes('andamio marco y cruceta')) return 'marco_cruceta';
      if (n.includes('multidireccional') || n.includes('multi direccional') || n.includes('multi')) return 'multidireccional';
      if (n.includes('templet') || n.includes('templete') || n.includes('templetes')) return 'templete';
      return null;
    }

    function categoryLabelFromKey(key) {
      if (key === 'marco_cruceta') return 'Marco y cruceta';
      if (key === 'multidireccional') return 'Multidireccional';
      if (key === 'templete') return 'Templete';
      return 'Otros';
    }

    function shortLabelFromName(name) {
      const cleaned = normalizeText(name).replace(/[^a-z0-9 ]+/g, '');
      if (!cleaned) return 'NA';
      const parts = cleaned.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
      return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
    }

    async function fetchProductosIndex() {
      if (productosIndexCache) return productosIndexCache;
      try {
        const token = getToken();
        const res = await fetch('/api/productos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          productosIndexCache = { productById: new Map(), categoryById: new Map() };
          return productosIndexCache;
        }
        const rows = await res.json();
        const productById = new Map();
        const categoryById = new Map();
        (rows || []).forEach((p) => {
          const id = p?.id_producto ?? p?.id;
          if (id !== undefined && id !== null) {
            productById.set(String(id), p);
          }
          const cid = p?.id_categoria;
          const cname = p?.categoria || p?.nombre_categoria || p?.nombre_categoria_producto;
          if (cid !== undefined && cid !== null && cname) {
            categoryById.set(String(cid), cname);
          }
        });
        productosIndexCache = { productById, categoryById };
        return productosIndexCache;
      } catch (e) {
        console.warn('Error cargando productos para categorias:', e);
        productosIndexCache = { productById: new Map(), categoryById: new Map() };
        return productosIndexCache;
      }
    }

    function lightenHex(hex, amount = 0.15) {
      const r = (hex >> 16) & 255;
      const g = (hex >> 8) & 255;
      const b = hex & 255;
      const nr = Math.min(255, Math.round(r + (255 - r) * amount));
      const ng = Math.min(255, Math.round(g + (255 - g) * amount));
      const nb = Math.min(255, Math.round(b + (255 - b) * amount));
      return (nr << 16) + (ng << 8) + nb;
    }

    function getCategoryFillFromDataItem(di) {
      if (!di) return 0x93c5fd;
      if (di.get('depth') === 1) {
        return di.dataContext?.fill ?? 0x93c5fd;
      }
      let parent = di.get('parent');
      while (parent) {
        if (parent.get('depth') === 1) {
          return parent.dataContext?.fill ?? 0x93c5fd;
        }
        parent = parent.get('parent');
      }
      return 0x93c5fd;
    }
    async function fetchOperativo() {
      const token = getToken();
      const { desde, hasta } = getRangeByDays(filtros.periodo);
      const url = `${API_URL}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&periodo=${encodeURIComponent('mes')}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo cargar analisis operativo');
      return await res.json();
    }

    let chartIngresos, chartClientes, chartMantenimiento;
    let rentabilidadRoot = null; // amCharts5 root para rentabilidad
    let voronoiRoot = null;
    let voronoiMode = 'venta';
    let voronoiCache = { venta: null, renta: null };
    let voronoiPeriodKey = null;
    let productosIndexCache = null;
    let voronoiDetailsMap = null;
    let voronoiSelectedCategory = null;

    let mapRoot, mexicoPolygonSeries, mexicoMapChart;
    let clientesFallbackCache = null;
    let mapSelectionSeq = 0;

    function renderSummaryCards(payload) {
      const data = payload?.data || {};
      const resumen = data.resumenGlobal || {};
      const montos = resumen.montos || {};
      const pipeline = resumen.pipelineComercial || {};
      const ratios = resumen.ratios || {};
      const cards = document.querySelectorAll('.summary-cards .summary-card .value');
      if (cards[0]) cards[0].textContent = formatCurrency(montos.facturadoTimbrado || 0);
      if (cards[1]) cards[1].textContent = formatCurrency(montos.porCobrar || 0);
      if (cards[2]) cards[2].textContent = formatPercent(ratios.conversionCotizacionACierre || 0);
      if (cards[3]) cards[3].textContent = (Number(pipeline.cotizaciones || 0) + Number(pipeline.contratos || 0) + Number(pipeline.facturas || 0)).toLocaleString('es-MX');
    }

    function renderChartOperativo(payload) {
      const serie = payload?.data?.comparativas?.serieOperativa || [];
      const bucket = payload?.data?.filtros?.periodo || 'month';
      chartIngresos.data.labels = serie.map((row) => formatPeriodLabel(row.periodo, bucket));
      chartIngresos.data.datasets[0].data = serie.map((row) => Number(row.contratos || 0));
      chartIngresos.data.datasets[1].data = serie.map((row) => Number(row.ventas || 0));
      chartIngresos.data.datasets[2].data = serie.map((row) => Number(row.facturas || 0));
      chartIngresos.update();
    }

    function renderEstadoClientes(payload) {
      const top = payload?.data?.clientes?.topClientesValor || [];
      const top5 = top.slice(0, 5);
      const labels = top5.map((row) => row.cliente);
      const values = top5.map((row) => Number(row.valor_total || 0));
      const colores = ['#2979ff', '#1abc9c', '#f59e0b', '#e91e63', '#9c27b0'];
      chartClientes.data.labels = labels;
      chartClientes.data.datasets[0].data = values;
      chartClientes.data.datasets[0].backgroundColor = colores.slice(0, top5.length);
      chartClientes.update();
    }

    // ── Rentabilidad: amCharts5 Drag-ordering horizontal bar ──────────────────
    async function fetchRentabilidadContratos() {
      try {
        const token = getToken();
        const { desde, hasta } = getRangeByDays(filtros.periodo);
        const res = await fetch(`/api/contratos`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return [];
        const rows = await res.json();
        const lista = Array.isArray(rows) ? rows : (rows.data || rows.contratos || []);
        // Filtrar por periodo y agrupar por cliente sumando monto_renta
        const filtrados = lista.filter(c => {
          const fecha = c.fecha_inicio || c.fecha_contrato || c.created_at || '';
          return !fecha || (fecha >= desde && fecha <= hasta);
        });
        const agrupado = {};
        filtrados.forEach(c => {
          const cliente = c.razon_social || c.cliente || c.nombre_cliente || `Cliente #${c.id_contrato || c.id || ''}`;
          const monto = Number(c.total || 0);
          if (!agrupado[cliente]) agrupado[cliente] = 0;
          agrupado[cliente] += monto;
        });
        return Object.entries(agrupado)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      } catch (e) {
        console.error('Error cargando rentabilidad contratos:', e);
        return [];
      }
    }

    function renderRentabilidadAmCharts(data) {
      const containerId = 'chartRentabilidad';
      // Destruir instancia previa si existe
      if (rentabilidadRoot) {
        rentabilidadRoot.dispose();
        rentabilidadRoot = null;
      }
      if (!data.length) return;

      rentabilidadRoot = am5.Root.new(containerId);
      rentabilidadRoot.setThemes([am5themes_Animated.new(rentabilidadRoot)]);

      const chart = rentabilidadRoot.container.children.push(
        am5xy.XYChart.new(rentabilidadRoot, {
          panX: false, panY: false,
          wheelX: 'none', wheelY: 'none',
          layout: rentabilidadRoot.verticalLayout
        })
      );

      // Paleta de colores degradada (morado → azul cyan)
      const colorPalette = [
        am5.color(0x9b59b6), am5.color(0x8e44ad), am5.color(0x6c63ff),
        am5.color(0x4a6cf7), am5.color(0x3a7bd5), am5.color(0x2196f3),
        am5.color(0x00bcd4), am5.color(0x26c6da), am5.color(0x4dd0e1), am5.color(0x80deea)
      ];

      const yRenderer = am5xy.AxisRendererY.new(rentabilidadRoot, {
        minGridDistance: 20, inversed: true
      });
      yRenderer.labels.template.setAll({ fontSize: 13, fill: am5.color(0x4b5563) });
      yRenderer.grid.template.setAll({ visible: false });

      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(rentabilidadRoot, {
          maxDeviation: 0, categoryField: 'name',
          renderer: yRenderer
        })
      );

      const xRenderer = am5xy.AxisRendererX.new(rentabilidadRoot, {});
      xRenderer.labels.template.setAll({
        fontSize: 11, fill: am5.color(0x9ca3af),
        numberFormatter: am5.NumberFormatter.new(rentabilidadRoot, { numberFormat: '$#,###.' })
      });
      const xAxis = chart.xAxes.push(
        am5xy.ValueAxis.new(rentabilidadRoot, {
          min: 0, renderer: xRenderer
        })
      );

      const series = chart.series.push(
        am5xy.ColumnSeries.new(rentabilidadRoot, {
          xAxis, yAxis,
          valueXField: 'value',
          categoryYField: 'name',
          tooltip: am5.Tooltip.new(rentabilidadRoot, {
            labelText: '{categoryY}: {valueX.formatNumber("$#,###.00")}'
          })
        })
      );

      series.columns.template.setAll({
        height: am5.percent(70),
        cornerRadiusBR: 5, cornerRadiusTR: 5,
        draggable: true,
        cursorOverStyle: 'grab'
      });

      // Colorear cada barra con la paleta y habilitar drag-to-reorder
      series.columns.template.adapters.add('fill', (fill, target) => {
        const di = target.dataItem;
        if (!di) return fill;
        const idx = series.dataItems.indexOf(di);
        return colorPalette[idx % colorPalette.length];
      });
      series.columns.template.adapters.add('stroke', (stroke, target) => {
        return am5.color(0x00000000);
      });

      // Drag-ordering logic
      series.columns.template.events.on('dragstop', (ev) => {
        let col = ev.target;
        let di = col.dataItem;
        if (!di) return;
        let newIndex = yAxis.pointToPosition(
          am5.utils.spritePointToSvg({ x: 0, y: col.y() + col.height() / 2 }, col)
        );
        newIndex = Math.round(newIndex * (series.dataItems.length - 1));
        newIndex = Math.max(0, Math.min(newIndex, series.dataItems.length - 1));
        const oldIndex = series.dataItems.indexOf(di);
        if (newIndex !== oldIndex) {
          const arr = rentabilidadRoot.__dragData || [...data];
          const moved = arr.splice(oldIndex, 1)[0];
          arr.splice(newIndex, 0, moved);
          rentabilidadRoot.__dragData = arr;
          series.data.setAll(arr);
          yAxis.data.setAll(arr);
        }
        col.set('y', 0); // reset position visual
      });

      const chartData = [...data];
      rentabilidadRoot.__dragData = chartData;
      yAxis.data.setAll(chartData);
      series.data.setAll(chartData);
      series.appear(1000);
      chart.appear(1000, 100);
    }

    async function renderRentabilidadPlaceholder() {
      const data = await fetchRentabilidadContratos();
      renderRentabilidadAmCharts(data);
    }

    function resolveItemName(item) {
      return item?.nombre || item?.descripcion || item?.name || item?.producto || item?.clave || item?.codigo || item?.sku || 'Producto';
    }

    function resolveItemQty(item) {
      const raw = item?.cantidad ?? item?.qty ?? item?.cant ?? item?.quantity ?? 1;
      const num = Number(raw);
      return Number.isFinite(num) && num > 0 ? num : 1;
    }

    function resolveItemProductId(item) {
      return item?.id_producto ?? item?.id ?? item?.producto_id ?? item?.idProducto ?? item?.id_equipo ?? null;
    }

    function resolveItemCategoryKey(item, productosIndex) {
      const productId = resolveItemProductId(item);
      if (productId != null && productosIndex?.productById) {
        const product = productosIndex.productById.get(String(productId));
        const catName = product?.categoria || product?.nombre_categoria || product?.nombre_categoria_producto || null;
        const catId = product?.id_categoria ?? null;
        if (catName) {
          const keyByName = normalizeCategoryKey(catName);
          if (keyByName) return keyByName;
        }
        if (catId != null && productosIndex?.categoryById) {
          const nameById = productosIndex.categoryById.get(String(catId));
          const keyById = normalizeCategoryKey(nameById);
          if (keyById) return keyById;
        }
      }

      const itemCatId = item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? item?.categoriaId ?? null;
      if (itemCatId != null && productosIndex?.categoryById) {
        const nameById = productosIndex.categoryById.get(String(itemCatId));
        const keyById = normalizeCategoryKey(nameById);
        if (keyById) return keyById;
      }

      const raw =
        item?.categoria ||
        item?.category ||
        item?.tipo ||
        item?.linea ||
        item?.familia ||
        item?.nombre_categoria ||
        item?.categoria_nombre ||
        item?.categoria_producto;
      let key = normalizeCategoryKey(raw);
      if (!key) {
        key = normalizeCategoryKey(item?.nombre || item?.descripcion || item?.name || item?.producto);
      }
      return key || 'otros';
    }

    function inRangeByDate(row, desde, hasta) {
      const rawDate = row?.fecha_cotizacion || row?.fecha_contrato || row?.fecha_inicio || row?.created_at || row?.fecha || '';
      if (!rawDate) return true;
      const iso = String(rawDate).slice(0, 10);
      return (!desde || iso >= desde) && (!hasta || iso <= hasta);
    }

    function collectItemsFromCotizaciones(rows, desde, hasta, productosIndex) {
      const items = [];
      (rows || []).forEach((row) => {
        if (!inRangeByDate(row, desde, hasta)) return;
        const productos = parseMaybeJsonArray(row?.productos_seleccionados).concat(parseMaybeJsonArray(row?.productos));
        const accesorios = parseMaybeJsonArray(row?.accesorios_seleccionados).concat(parseMaybeJsonArray(row?.accesorios));
        [...productos, ...accesorios].forEach((item) => {
          items.push({
            name: resolveItemName(item),
            qty: resolveItemQty(item),
            categoryKey: resolveItemCategoryKey(item, productosIndex)
          });
        });
      });
      return items;
    }

    function collectItemsFromContratos(rows, desde, hasta, productosIndex) {
      const items = [];
      (rows || []).forEach((row) => {
        if (!inRangeByDate(row, desde, hasta)) return;
        const directItems = parseMaybeJsonArray(row?.items);
        const productos = parseMaybeJsonArray(row?.productos_seleccionados).concat(parseMaybeJsonArray(row?.productos));
        [...directItems, ...productos].forEach((item) => {
          items.push({
            name: resolveItemName(item),
            qty: resolveItemQty(item),
            categoryKey: resolveItemCategoryKey(item, productosIndex)
          });
        });
      });
      return items;
    }

    async function fetchVentasItems() {
      try {
        const token = getToken();
        const { desde, hasta } = getRangeByDays(filtros.periodo);
        const productosIndex = await fetchProductosIndex();
        const res = await fetch('/api/cotizaciones', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.data || data?.cotizaciones || []);
        const ventas = rows.filter((c) => {
          const tipo = String(c?.tipo || c?.tipo_cotizacion || c?.tipoCotizacion || '').toUpperCase();
          if (!(tipo === 'VENTA' || tipo === '')) return false;
          const estado = String(c?.estado || '').toLowerCase();
          return estado === 'aprobada' || estado === 'facturada';
        });
        return collectItemsFromCotizaciones(ventas, desde, hasta, productosIndex);
      } catch (e) {
        console.warn('Error cargando items de venta:', e);
        return [];
      }
    }

    async function fetchRentasItems() {
      try {
        const token = getToken();
        const { desde, hasta } = getRangeByDays(filtros.periodo);
        const productosIndex = await fetchProductosIndex();
        const res = await fetch('/api/contratos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.data || data?.contratos || []);
        return collectItemsFromContratos(rows, desde, hasta, productosIndex);
      } catch (e) {
        console.warn('Error cargando items de renta:', e);
        return [];
      }
    }

    function groupSmallProducts(entries, minShare = 0.03, maxItems = 12) {
      const total = entries.reduce((acc, [, value]) => acc + value, 0);
      const kept = [];
      let othersValue = 0;
      entries.forEach(([name, value], idx) => {
        const share = total > 0 ? value / total : 0;
        if (idx < maxItems && share >= minShare) {
          kept.push([name, value]);
        } else {
          othersValue += value;
        }
      });
      if (othersValue > 0) kept.push(['Otros', othersValue]);
      return kept;
    }

    function buildVoronoiHierarchy(items, mode) {
      const categories = new Map();
      (items || []).forEach((item) => {
        const key = item.categoryKey || 'otros';
        if (!categories.has(key)) categories.set(key, new Map());
        const map = categories.get(key);
        const name = item.name || 'Producto';
        map.set(name, (map.get(name) || 0) + Number(item.qty || 0));
      });

      const root = {
        name: mode === 'venta' ? 'Ventas' : 'Rentas',
        children: []
      };
      const categoryOrder = ['marco_cruceta', 'multidireccional', 'templete', 'otros'];
      const colors = {
        marco_cruceta: 0x7c3aed,
        multidireccional: 0x2563eb,
        templete: 0xec4899,
        otros: 0x94a3b8
      };

      const detailsMap = new Map();
      const childrenByCategory = new Map();
      categoryOrder.forEach((key) => {
        const map = categories.get(key);
        if (!map) return;
        const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return;
        const grouped = groupSmallProducts(entries);
        const children = grouped.map(([name, value]) => ({
          name,
          value,
          shortName: shortLabelFromName(name)
        }));
        const catName = categoryLabelFromKey(key);
        const catFill = colors[key] ?? colors.otros;
        root.children.push({
          name: catName,
          fill: catFill,
          children
        });
        detailsMap.set(catName, grouped);
        childrenByCategory.set(catName, { children, fill: catFill });
      });

      voronoiDetailsMap = detailsMap;
      return {
        data: root.children.length ? [root] : [],
        detailsMap,
        childrenByCategory
      };
    }

    function destroyVoronoi() {
      if (voronoiRoot) {
        voronoiRoot.dispose();
        voronoiRoot = null;
      }
    }

    function setVoronoiEmpty(message) {
      destroyVoronoi();
      const el = document.getElementById('voronoiTreemap');
      if (el) {
        el.innerHTML = `<div class="voronoi-empty">${message}</div>`;
      }
    }

    function renderVoronoiDetails(title, rows) {
      const panel = document.getElementById('voronoiDetails');
      const list = document.getElementById('voronoiDetailsList');
      if (!panel || !list) return;
      const safeRows = Array.isArray(rows) ? rows : [];
      panel.classList.add('is-active');
      const titleEl = panel.querySelector('.voronoi-details__title');
      const metaEl = panel.querySelector('.voronoi-details__meta');
      if (titleEl) titleEl.textContent = title || 'Detalle por categoría';
      if (metaEl) metaEl.textContent = safeRows.length ? `Top ${safeRows.length} productos` : 'Sin detalles';
      list.innerHTML = safeRows.map(([name, value]) => `
        <div class="voronoi-details__item">
          <span>${name}</span>
          <span class="voronoi-details__badge">${Number(value || 0).toLocaleString('es-MX')}</span>
        </div>
      `).join('');
    }

    async function renderVoronoiTreemap(mode = 'venta', selectedCategory = null) {
      const titleEl = document.getElementById('voronoiTitle');
      const subtitleEl = document.getElementById('voronoiSubtitle');
      if (titleEl) {
        titleEl.textContent = mode === 'venta'
          ? 'productos mas vendidos por categoria'
          : 'productos mas rentados por categoria';
      }
      if (subtitleEl) {
        subtitleEl.textContent = mode === 'venta'
          ? 'ventas por categoria y producto'
          : 'rentas por categoria y producto';
      }

      const el = document.getElementById('voronoiTreemap');
      if (!el || !window.am5 || !window.am5hierarchy) return;
      el.innerHTML = '';

      const cacheKey = mode === 'renta' ? 'renta' : 'venta';
      if (!voronoiCache[cacheKey]) {
        const items = cacheKey === 'venta' ? await fetchVentasItems() : await fetchRentasItems();
        voronoiCache[cacheKey] = buildVoronoiHierarchy(items, cacheKey);
      }
      const cached = voronoiCache[cacheKey];
      const baseData = cached?.data || [];
      if (!baseData.length) {
        setVoronoiEmpty('Sin datos suficientes para mostrar el treemap.');
        return;
      }
      let data = baseData;
      if (selectedCategory && cached?.childrenByCategory?.has(selectedCategory)) {
        const payload = cached.childrenByCategory.get(selectedCategory);
        data = [{
          name: selectedCategory,
          fill: payload.fill,
          children: payload.children
        }];
      }

      destroyVoronoi();
      voronoiRoot = am5.Root.new('voronoiTreemap');
      voronoiRoot.setThemes([am5themes_Animated.new(voronoiRoot)]);

      const zoomable = voronoiRoot.container.children.push(am5.ZoomableContainer.new(voronoiRoot, {
        width: am5.percent(100),
        height: am5.percent(100),
        wheelable: true,
        pinchZoom: true,
        panX: true,
        panY: true
      }));

      const zoomTools = am5.ZoomTools.new(voronoiRoot, { target: zoomable });
      zoomTools.setAll({
        x: am5.p100,
        y: am5.p100,
        centerX: am5.p100,
        centerY: am5.p100,
        paddingRight: 12,
        paddingBottom: 12
      });
      voronoiRoot.container.children.push(zoomTools);

      const series = zoomable.children.push(am5hierarchy.Treemap.new(voronoiRoot, {
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        nodePaddingInner: 2,
        nodePaddingOuter: 14,
        topDepth: 1,
        initialDepth: 2
      }));

      series.rectangles.template.setAll({
        stroke: am5.color(0x000000),
        strokeWidth: 1,
        fillOpacity: 0.9,
        cornerRadiusTL: 10,
        cornerRadiusTR: 10,
        cornerRadiusBL: 10,
        cornerRadiusBR: 10
      });

      series.rectangles.template.adapters.add('fill', (fill, target) => {
        const di = target.dataItem;
        if (!di) return fill;
        const base = getCategoryFillFromDataItem(di);
        if (di.get('depth') === 1) {
          return am5.color(base);
        }
        return am5.color(lightenHex(base, 0.18));
      });
      series.rectangles.template.adapters.add('fillOpacity', (opacity, target) => {
        const di = target.dataItem;
        if (!di) return opacity;
        return di.get('depth') === 1 ? 0.95 : 0.85;
      });
      series.rectangles.template.adapters.add('strokeWidth', (strokeWidth, target) => {
        const di = target.dataItem;
        if (!di) return strokeWidth;
        return di.get('depth') === 1 ? 6 : 1;
      });
      series.rectangles.template.adapters.add('stroke', (stroke, target) => {
        const di = target.dataItem;
        if (!di) return stroke;
        return di.get('depth') === 1 ? am5.color(0x000000) : am5.color(0x111827);
      });

      series.labels.template.setAll({
        fontSize: 12,
        fill: am5.color(0x111827),
        textAlign: 'center',
        centerX: am5.p50,
        centerY: am5.p50,
        oversizedBehavior: 'hide'
      });
      series.labels.template.adapters.add('fill', (fill, target) => {
        const di = target.dataItem;
        if (!di) return fill;
        return di.get('depth') >= 1 ? am5.color(0xffffff) : am5.color(0x111827);
      });
      series.labels.template.adapters.add('text', (text, target) => {
        const di = target.dataItem;
        if (!di) return text;
        const depth = di.get('depth');
        const ctx = di.dataContext || {};
        if (depth === 1) return ctx.name || text;
        if (depth >= 2) {
          const value = Number(di.get('value') || 0);
          if (value < 5) return ctx.shortName || text;
          return ctx.name || text;
        }
        return text;
      });

      series.data.setAll(data);
      if (series.dataItems.length) {
        series.set('selectedDataItem', series.dataItems[0]);
      }

      series.events.on('datavalidated', () => {
        let idx = 0;
        const items = Array.isArray(series.dataItems) ? series.dataItems : [];
        items.forEach((di) => {
          const node = di?.get?.('node');
          if (!node) return;
          node.setAll({ opacity: 0, scale: 0.92 });
          const delay = idx * 18;
          node.animate({
            key: 'opacity',
            to: 1,
            duration: 700,
            delay,
            easing: am5.ease.out(am5.ease.cubic)
          });
          node.animate({
            key: 'scale',
            to: 1,
            duration: 700,
            delay,
            easing: am5.ease.out(am5.ease.cubic)
          });
          idx += 1;
        });
      });

      series.rectangles.template.events.on('click', (ev) => {
        const di = ev.target.dataItem;
        if (!di) return;
        if (voronoiSelectedCategory && di.get('depth') >= 1) {
          voronoiSelectedCategory = null;
          renderVoronoiTreemap(mode, null);
          return;
        }
        const hasChildren = Array.isArray(di.dataContext?.children) && di.dataContext.children.length > 0;
        if (hasChildren) {
          if (di.get('depth') === 1) {
            const name = di.dataContext?.name;
            if (name && selectedCategory === name) {
              voronoiSelectedCategory = null;
              renderVoronoiTreemap(mode, null);
              return;
            }
            voronoiSelectedCategory = name || null;
            renderVoronoiTreemap(mode, name || null);
            return;
          }
          series.selectDataItem(di);
        } else {
          const parent = di.get('parent');
          if (parent) series.selectDataItem(parent);
        }
      });

      series.events.on('selectedDataitemchanged', (ev) => {
        const di = ev?.target?.get('selectedDataItem');
        if (!di) return;
        if (di.get('depth') === 1) {
          const name = di.dataContext?.name || 'Detalle por categoría';
          const rows = voronoiDetailsMap?.get(name) || [];
          renderVoronoiDetails(name, rows);
        }

        // Animate children on drill-down
        const children = Array.isArray(di?.dataContext?.children) ? di.dataContext.children : [];
        if (children.length) {
          let idx = 0;
          series.dataItems.forEach((item) => {
            if (item.get('depth') !== di.get('depth') + 1) return;
            const node = item.get('node');
            if (!node) return;
            node.setAll({ opacity: 0, scale: 0.9 });
            const delay = idx * 14;
            node.animate({
              key: 'opacity',
              to: 1,
              duration: 500,
              delay,
              easing: am5.ease.out(am5.ease.cubic)
            });
            node.animate({
              key: 'scale',
              to: 1,
              duration: 500,
              delay,
              easing: am5.ease.out(am5.ease.cubic)
            });
            idx += 1;
          });
        }
      });

      series.appear(1000, 100);
      zoomable.appear(1000, 100);
    }

    function bindVoronoiControls() {
      const buttons = document.querySelectorAll('.voronoi-toggle');
      if (!buttons.length) return;
      buttons.forEach((btn) => {
        if (btn.__bound) return;
        btn.__bound = true;
        btn.addEventListener('click', async () => {
          const mode = btn.getAttribute('data-mode') || 'venta';
          voronoiMode = mode;
          voronoiSelectedCategory = null;
          buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
          await renderVoronoiTreemap(voronoiMode, voronoiSelectedCategory);
        });
      });
    }

    function renderMantenimientoPlaceholder(payload) {
      const serie = payload?.data?.facturacion?.serie || [];
      chartMantenimiento.data.labels = serie.map((row) => formatPeriodLabel(row.periodo, 'month'));
      chartMantenimiento.data.datasets[0].data = serie.map((row) => Number(row.pendientes || 0));
      chartMantenimiento.update();
    }

    function renderCatalogTable(payload) {
      const tbody = document.querySelector('.metrics-table tbody');
      const catalog = payload?.data?.catalogos?.kpis || {};
      const values = payload?.data || {};
      const rows = [];
      const pushRows = (modulo, kpis, source) => {
        (kpis || []).forEach((kpi) => {
          const raw = source?.[kpi.key];
          let val = raw;
          if (kpi.format === 'currency') val = formatCurrency(raw || 0);
          if (kpi.format === 'integer') val = Number(raw || 0).toLocaleString('es-MX');
          if (kpi.format === 'percent') val = `${Number(raw || 0).toFixed(2)}%`;
          rows.push({ modulo, kpi: kpi.label, valor: val ?? 0, formato: kpi.format });
        });
      };
      pushRows('Ventas', catalog.ventas, values.ventas?.kpis);
      pushRows('Contratos', catalog.contratos, values.contratos?.kpis);
      pushRows('Facturacion', catalog.facturacion, values.facturacion?.kpis);
      pushRows('Clientes', catalog.clientes, values.clientes?.kpis);
      tbody.innerHTML = rows.slice(0, 16).map((row) => `
        <tr>
          <td>${row.modulo}: ${row.kpi}</td>
          <td>${row.valor}</td>
          <td>-</td>
          <td>-</td>
          <td><span class="badge yellow">${row.formato}</span></td>
          <td><span class="trend-up">ok</span></td>
        </tr>
      `).join('');
    }

    function getMapColor(value, max) {
      const n = Number(value || 0);
      const top = Number(max || 0);
      if (n <= 0) return am5.color(0x9ca3af);
      const ratio = top > 0 ? (n / top) : 0;
      if (ratio < 0.45) return am5.color(0xfacc15);
      return am5.color(0x16a34a);
    }

    function renderClientList(stateName, clients) {
      const caption = document.getElementById('cityStateCaption');
      const list = document.getElementById('cityStateList');
      if (!caption || !list) return;
      const rows = Array.isArray(clients) ? clients : [];
      caption.textContent = rows.length > 0
        ? `Clientes en ${stateName}`
        : `Sin clientes registrados en ${stateName}`;
      list.innerHTML = rows.slice(0, 80).map((row) => `<li><span>${row.cliente} (${row.ciudad || 'Sin ciudad'})</span><strong>#${Number(row.idCliente || 0)}</strong></li>`).join('');
    }

    function normalizeSimple(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }

    function getStateAliases(normalizedStateName) {
      const base = normalizeSimple(normalizedStateName);
      const aliases = new Set([base]);
      if (base === 'ciudad de mexico') {
        aliases.add('cdmx');
        aliases.add('distrito federal');
        aliases.add('df');
      }
      if (base === 'estado de mexico') {
        aliases.add('edomex');
        aliases.add('mexico');
      }
      if (base === 'veracruz') aliases.add('veracruz de ignacio de la llave');
      if (base === 'michoacan') aliases.add('michoacan de ocampo');
      return Array.from(aliases);
    }

    async function getClientesFallback() {
      if (Array.isArray(clientesFallbackCache)) return clientesFallbackCache;
      try {
        const token = getToken();
        const res = await fetch('/api/clientes', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return [];
        const rows = await res.json();
        clientesFallbackCache = Array.isArray(rows) ? rows : [];
        return clientesFallbackCache;
      } catch (e) {
        console.warn('No se pudo cargar fallback de clientes:', e);
        return [];
      }
    }

    function renderMexicoClientsMap(payload) {
      const MAP_DEBUG = true;
      console.error('[MAP] renderMexicoClientsMap invoked');
      const mapContainer = document.getElementById('mexicoClientMap');
      if (!mapContainer || !window.am5 || !window.am5map || !window.am5geodata_mexicoLow) return;

      const mapData = payload?.data?.clientes?.mapa || {};
      const estados = Array.isArray(mapData.estados) ? mapData.estados : [];
      const ciudadesPorEstado = mapData.ciudadesPorEstado || {};
      const clientesPorEstado = mapData.clientesPorEstado || {};
      const maxClientesEstado = Number(mapData.maxClientesEstado || 0);
      const zoomOutBtn = document.getElementById('btnMapZoomOut');

      if (mapRoot) {
        mapRoot.dispose();
        mapRoot = null;
      }
      mapRoot = am5.Root.new('mexicoClientMap');
      mapRoot.setThemes([am5themes_Animated.new(mapRoot)]);

      mexicoMapChart = mapRoot.container.children.push(am5map.MapChart.new(mapRoot, {
        panX: 'translateX',
        panY: 'translateY',
        projection: am5map.geoMercator()
      }));

      mexicoPolygonSeries = mexicoMapChart.series.push(am5map.MapPolygonSeries.new(mapRoot, {
        geoJSON: am5geodata_mexicoLow,
        valueField: 'value',
        calculateAggregates: true
      }));
      const statePointSeries = mexicoMapChart.series.push(am5map.MapPointSeries.new(mapRoot, {
        latitudeField: 'latitude',
        longitudeField: 'longitude'
      }));

      const estadosMap = {};
      estados.forEach((state) => { estadosMap[state.id] = state; });
      const polygonData = estados.map((state) => ({ id: state.id, value: Number(state.cantidad || 0), stateName: state.name }));
      mexicoPolygonSeries.data.setAll(polygonData);

      mexicoPolygonSeries.mapPolygons.template.setAll({
        interactive: true,
        cursorOverStyle: 'pointer',
        tooltipText: '{stateName}: {value} clientes',
        fill: am5.color(0xffffff),
        stroke: am5.color(0xcbd5e1),
        strokeWidth: 1.2
      });
      // Estados pequeños donde el label no cabe visualmente
      const SMALL_STATE_IDS = new Set(['MX-CMX', 'MX-TLA', 'MX-COL', 'MX-MOR', 'MX-AGU']);

      mexicoPolygonSeries.events.on('datavalidated', () => {
        mexicoPolygonSeries.mapPolygons.each((polygon) => {
          const item = polygon.dataItem;
          if (!item) return;
          const v = Number(item.get('value') || 0);
          // Color inicial desde la carga (no solo en hover)
          polygon.set('fill', getMapColor(v, maxClientesEstado));
          // Color en hover: versión más saturada/brillante del mismo color
          polygon.states.create('hover', { fill: getMapColor(v, maxClientesEstado), fillOpacity: 0.75 });
          // Click directo en cada instancia (amCharts 5)
          polygon.events.on('click', () => {
            const stateId = item.get('id');
            if (MAP_DEBUG) {
              console.log('[MAP] polygon click (per-instance)', {
                stateId,
                stateName: item.get('stateName'),
                value: item.get('value')
              });
            }
            onSelectState(stateId, item, item);
          });
        });
      });

      const resolveStateId = (rawStateId, item) => {
        if (MAP_DEBUG) {
          console.log('[MAP] resolveStateId input', {
            rawStateId,
            itemId: item?.get?.('id'),
            itemStateName: item?.get?.('stateName'),
            itemName: item?.get?.('name'),
            itemDataContext: item?.dataContext
          });
        }
        const candidates = [
          rawStateId,
          item?.get?.('id'),
          item?.dataContext?.id,
          item?.dataContext?.stateId
        ].filter(Boolean).map((v) => String(v));
        for (const candidate of candidates) {
          if (estadosMap[candidate]) return candidate;
          const up = candidate.toUpperCase();
          if (estadosMap[up]) return up;
        }
        const normalize = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        const byName = normalize(item?.get?.('stateName') || item?.get?.('name') || item?.dataContext?.stateName || '');
        if (byName) {
          const found = estados.find((s) => {
            const n = normalize(s.name);
            return n === byName || n.includes(byName) || byName.includes(n);
          });
          if (found) return found.id;
        }
        if (MAP_DEBUG) console.warn('[MAP] resolveStateId failed', { rawStateId, byName });
        return null;
      };

      const onSelectState = async (stateId, itemForZoom, item) => {
        const currentSeq = ++mapSelectionSeq;
        const resolvedId = resolveStateId(stateId, item);
        if (!resolvedId) return;
        const state = estadosMap[resolvedId];
        if (!state) return;
        if (MAP_DEBUG) {
          console.log('[MAP] onSelectState', {
            currentSeq,
            stateIdInput: stateId,
            resolvedId,
            stateName: state.name
          });
        }
        // Actualiza estado visual de inmediato para confirmar selección.
        renderClientList(state.name, []);
        let selectedClients = Array.isArray(clientesPorEstado[resolvedId]) ? clientesPorEstado[resolvedId] : [];
        if (MAP_DEBUG) {
          console.log('[MAP] backend clientesPorEstado', {
            resolvedId,
            found: selectedClients.length
          });
        }
        if (!selectedClients.length) {
          const allClientes = await getClientesFallback();
          const targetAliases = getStateAliases(state.name);
          if (MAP_DEBUG) {
            console.log('[MAP] fallback activated', {
              resolvedId,
              stateName: state.name,
              targetAliases,
              allClientesCount: allClientes.length
            });
          }
          selectedClients = allClientes
            .filter((c) => {
              const estadoCliente = normalizeSimple(c.estado_direccion || c.estado || '');
              if (!estadoCliente) return false;
              return targetAliases.some((alias) =>
                estadoCliente === alias || estadoCliente.includes(alias) || alias.includes(estadoCliente)
              );
            })
            .map((c) => ({
              idCliente: Number(c.id_cliente || c.id || 0),
              cliente: c.razon_social || c.empresa || c.nombre || `Cliente #${Number(c.id_cliente || c.id || 0)}`,
              ciudad: c.ciudad || c.localidad || 'Sin ciudad'
            }));
          if (MAP_DEBUG) {
            console.log('[MAP] fallback filtered result', {
              resolvedId,
              stateName: state.name,
              resultCount: selectedClients.length,
              sample: selectedClients.slice(0, 5)
            });
          }
        }
        if (currentSeq !== mapSelectionSeq) {
          if (MAP_DEBUG) {
            console.warn('[MAP] stale selection discarded', {
              currentSeq,
              latestSeq: mapSelectionSeq,
              resolvedId
            });
          }
          return;
        }
        if (MAP_DEBUG) {
          console.log('[MAP] renderClientList final', {
            resolvedId,
            stateName: state.name,
            resultCount: selectedClients.length
          });
        }
        renderClientList(state.name, selectedClients);
        if (itemForZoom) mexicoPolygonSeries.zoomToDataItem(itemForZoom);
        if (zoomOutBtn) zoomOutBtn.classList.add('active');
      };

      // Los eventos de click se registran en datavalidated (por instancia) arriba.

      statePointSeries.bullets.push((root, series, dataItem) => {
        const value = Number(dataItem.dataContext?.value || 0);
        const stateId = dataItem.dataContext?.stateId || '';
        // No mostrar label si no hay clientes o si el estado es demasiado pequeño
        if (value === 0 || SMALL_STATE_IDS.has(stateId)) return;
        const container = am5.Container.new(root, { interactive: true, cursorOverStyle: 'pointer' });
        container.children.push(am5.Label.new(root, {
          text: String(value),
          centerX: am5.p50,
          centerY: am5.p50,
          fill: am5.color(0xffffff),
          fontSize: 12,
          fontWeight: '700',
          background: am5.RoundedRectangle.new(root, {
            fill: am5.color(0x1e293b),
            fillOpacity: 0.82,
            cornerRadiusTL: 6,
            cornerRadiusTR: 6,
            cornerRadiusBL: 6,
            cornerRadiusBR: 6
          }),
          paddingTop: 3,
          paddingBottom: 3,
          paddingLeft: 6,
          paddingRight: 6,
          tooltipText: `${dataItem.dataContext?.stateName || stateId}: ${value} clientes`
        }));
        container.events.on('click', () => {
          if (!stateId) return;
          onSelectState(stateId, null, dataItem);
        });
        return am5.Bullet.new(root, { sprite: container });
      });

      mexicoPolygonSeries.events.on('datavalidated', () => {
        const points = [];
        mexicoPolygonSeries.mapPolygons.each((polygon) => {
          const item = polygon.dataItem;
          if (!item) return;
          const centroid = item.get('geoCentroid');
          if (!centroid) return;
          points.push({
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            value: Number(item.get('value') || 0),
            stateName: item.get('stateName') || item.get('name') || 'Estado',
            stateId: item.get('id')
          });
        });
        statePointSeries.data.setAll(points);
      });

      if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
          mexicoMapChart.goHome();
          zoomOutBtn.classList.remove('active');
          renderClientList('Mexico', []);
        };
      }

      renderClientList('Mexico', []);
    }

    async function actualizarDashboard() {
      try {
        const payload = await fetchOperativo();
        renderSummaryCards(payload);
        renderChartOperativo(payload);
        renderEstadoClientes(payload);
        await renderRentabilidadPlaceholder();
        renderMantenimientoPlaceholder(payload);
        renderCatalogTable(payload);
        renderMexicoClientsMap(payload);
        if (voronoiPeriodKey !== filtros.periodo) {
          voronoiPeriodKey = filtros.periodo;
          voronoiCache = { venta: null, renta: null };
          voronoiSelectedCategory = null;
        }
        await renderVoronoiTreemap(voronoiMode, voronoiSelectedCategory);
      } catch (e) {
        console.error('Error cargando analisis operativo:', e);
      }
    }

    window.addEventListener('DOMContentLoaded', async () => {
      const selectPeriodoRapido = document.getElementById('selectPeriodoRapido');
      if (selectPeriodoRapido) {
        selectPeriodoRapido.value = filtros.periodo;
        selectPeriodoRapido.addEventListener('change', () => {
          filtros.periodo = selectPeriodoRapido.value;
          actualizarDashboard();
        });
      }

      chartIngresos = new Chart(document.getElementById('chartIngresos').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { type: 'bar', label: 'Contratos', data: [], backgroundColor: 'rgba(41,121,255,0.45)', borderColor: '#2979ff', borderWidth: 1, stack: 'combined', order: 2 },
            { type: 'bar', label: 'Ventas', data: [], backgroundColor: 'rgba(26,188,156,0.45)', borderColor: '#1abc9c', borderWidth: 1, stack: 'combined', order: 2 },
            { type: 'line', label: 'Facturas', data: [], borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.35, fill: false, pointRadius: 4, order: 1 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } },
          interaction: { mode: 'index', intersect: false },
          scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } }
        }
      });
      chartClientes = new Chart(document.getElementById('chartClientes').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{ data: [], backgroundColor: ['#2979ff','#43a047','#ffc107'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
      chartMantenimiento = new Chart(document.getElementById('chartMantenimiento').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{ label: 'Mantenimientos', data: [], borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.10)', fill: true, tension:0.4 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
      });
      bindVoronoiControls();
      await actualizarDashboard();
    });
    // Exportar a PDF profesional
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.onclick = function() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFont('helvetica','bold');
      doc.setFontSize(22);
      doc.text('Reporte de Analytics - ScaffoldPro', 40, 50);
      doc.setFontSize(13);
      doc.setFont('helvetica','normal');
      doc.text('Generado: ' + new Date().toLocaleString(), 40, 70);
      // Resumen
      doc.setFillColor(227,240,255);
      doc.roundedRect(30, 90, 780, 60, 12, 12, 'F');
      doc.setFontSize(15);
      doc.text('Resumen Ejecutivo', 50, 115);
      doc.setFontSize(12);
      doc.text('Facturado timbrado: ' + document.querySelector('.summary-cards .summary-card:nth-child(1) .value').innerText, 60, 140);
      doc.text('Por cobrar: ' + document.querySelector('.summary-cards .summary-card:nth-child(2) .value').innerText, 220, 140);
      doc.text('Conversion comercial: ' + document.querySelector('.summary-cards .summary-card:nth-child(3) .value').innerText, 400, 140);
      doc.text('Pipeline operativo: ' + document.querySelector('.summary-cards .summary-card:nth-child(4) .value').innerText, 650, 140);
      // Tabla de métricas
      let tabla = [];
      document.querySelectorAll('.metrics-table tbody tr').forEach(tr => {
        let row = [];
        tr.querySelectorAll('td').forEach(td => row.push(td.innerText));
        tabla.push(row);
      });
      doc.autoTable({
        startY: 170,
        head: [['Categoría','Ingresos','Costos','Ganancia','Margen','Tendencia']],
        body: tabla,
        theme: 'grid',
        headStyles: { fillColor: [41,121,255], textColor:255, fontStyle:'bold' },
        styles: { font:'helvetica', fontSize:11, cellPadding:4 },
        margin: { left: 40, right: 40 },
        tableWidth: 760
      });
      // Pie de página
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('ScaffoldPro - Reporte generado automáticamente', 40, 560);
      doc.save('reporte-analytics.pdf');
    };
    // Notificaciones UX mejorado
    const notifIcon = document.querySelector('.topbar-right .fa-bell');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifList = document.getElementById('notifList');
    let notificaciones = [
      { icon: 'fa-bell', texto: 'Nueva entrega programada', unread: true, time: 'hoy' },
      { icon: 'fa-truck', texto: 'Vehículo en ruta', unread: false, time: 'hace 2h' },
      { icon: 'fa-exclamation-triangle', texto: 'Entrega retrasada', unread: true, time: 'ayer' },
    ];
    function renderNotificaciones() {
      notifList.innerHTML = '';
      if (notificaciones.length === 0) {
        notifList.innerHTML = `<div class='notif-empty'>Sin notificaciones</div>`;
        return;
      }
      notificaciones.forEach((n, i) => {
        notifList.innerHTML += `<div class='notif-item${n.unread ? ' unread' : ''}' data-idx='${i}'><i class='fa ${n.icon}'></i> <span>${n.texto}</span><span style='margin-left:auto;color:#888;font-size:0.93em;'>${n.time}</span></div>`;
      });
    }
    renderNotificaciones();
    notifIcon.onclick = e => {
      notifDropdown.classList.toggle('active');
      notifDropdown.style.right = '0px';
      notifDropdown.style.top = notifIcon.getBoundingClientRect().bottom + 8 + 'px';
    };
    document.addEventListener('click', e => {
      if(!notifDropdown.contains(e.target) && e.target !== notifIcon) notifDropdown.classList.remove('active');
    });
    notifList.onclick = function(e) {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      const idx = item.dataset.idx;
      notificaciones[idx].unread = false;
      renderNotificaciones();
    };
    // Menú usuario UX mejorado
    const avatar = document.querySelector('.avatar') || document.getElementById('avatar-img');
    const userMenu = document.getElementById('userMenu') || document.getElementById('user-dropdown');
    if (avatar && userMenu) {
      avatar.onclick = e => {
        userMenu.classList.toggle('active');
        userMenu.style.right = '0px';
        userMenu.style.top = avatar.getBoundingClientRect().bottom + 8 + 'px';
      };
      document.addEventListener('click', e => {
        if(!userMenu.contains(e.target) && e.target !== avatar) userMenu.classList.remove('active');
      });
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
