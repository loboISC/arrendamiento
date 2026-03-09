
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

    // Menú lateral desplegable (solo para pantallas pequeñas)
    const sidebar = document.getElementById('sidebar');
    const openSidebar = document.getElementById('openSidebar');
    const closeSidebar = document.getElementById('closeSidebar');
    if(openSidebar && closeSidebar && sidebar) {
      openSidebar.onclick = () => sidebar.classList.add('open');
      closeSidebar.onclick = () => sidebar.classList.remove('open');
    }
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
    async function fetchOperativo() {
      const token = getToken();
      const { desde, hasta } = getRangeByDays(filtros.periodo);
      const url = `${API_URL}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&periodo=${encodeURIComponent('mes')}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo cargar analisis operativo');
      return await res.json();
    }

    let chartIngresos, chartClientes, chartRentabilidad, chartMantenimiento;
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
      const labels = top.slice(0, 6).map((row) => row.cliente);
      const values = top.slice(0, 6).map((row) => Number(row.valor_total || 0));
      chartClientes.data.labels = labels;
      chartClientes.data.datasets[0].data = values;
      chartClientes.update();
    }

    function renderRentabilidadPlaceholder(payload) {
      const serie = payload?.data?.ventas?.serie || [];
      chartRentabilidad.data.labels = serie.map((row) => formatPeriodLabel(row.periodo, 'month'));
      chartRentabilidad.data.datasets[0].data = serie.map((row) => Number(row.monto_cierre || 0));
      chartRentabilidad.update();
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
        renderRentabilidadPlaceholder(payload);
        renderMantenimientoPlaceholder(payload);
        renderCatalogTable(payload);
        renderMexicoClientsMap(payload);
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
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
      chartRentabilidad = new Chart(document.getElementById('chartRentabilidad').getContext('2d'), {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{ label: 'Rentabilidad', data: [], backgroundColor: '#2979ff' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
      chartMantenimiento = new Chart(document.getElementById('chartMantenimiento').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{ label: 'Mantenimientos', data: [], borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.10)', fill: true, tension:0.4 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
      });
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
