// Script de prueba de estrés: inyecta filas de ejemplo y genera el PDF automáticamente
async function injectTestRows(count = 200) {
    const tbody = document.getElementById('cr-summary-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    const placeholderImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    for (let i = 1; i <= count; i++) {
        const tr = document.createElement('tr');
        tr.className = 'avoid-break';

        // IMG/CLAVE
        const tdImg = document.createElement('td');
        tdImg.style.width = '80px';
        tdImg.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><img src="${placeholderImg}" alt="img" style="width:36px;height:36px;object-fit:cover;border:1px solid #e5e7eb;padding:2px;border-radius:4px"/><div style="font-size:11px;font-weight:700">CLV-${String(i).padStart(3,'0')}</div></div>`;
        tr.appendChild(tdImg);

        // Part.
        const tdPart = document.createElement('td'); tdPart.textContent = i; tr.appendChild(tdPart);
        // Peso
        const tdPeso = document.createElement('td'); tdPeso.textContent = (Math.random()*5).toFixed(2) + ' kg'; tr.appendChild(tdPeso);
        // Descripción
        const tdDesc = document.createElement('td');
        tdDesc.innerHTML = `<div class="desc-name">Producto de prueba ${i}</div><div class="desc-line">Descripción extensa de prueba para verificar wrapping y saltos de linea al generar el PDF. Línea de texto adicional para simular contenido real.</div>`;
        tr.appendChild(tdDesc);
        // Cant
        const tdCant = document.createElement('td'); tdCant.className = 'nowrap-cell'; tdCant.textContent = Math.ceil(Math.random()*10); tr.appendChild(tdCant);
        // P. Unit
        const tdUnit = document.createElement('td'); tdUnit.className = 'nowrap-cell'; tdUnit.textContent = `$${(Math.random()*200).toFixed(2)}`; tr.appendChild(tdUnit);
        // Garantía
        const tdGar = document.createElement('td'); tdGar.className = 'nowrap-cell'; tdGar.textContent = '30 días'; tr.appendChild(tdGar);
        // Importe
        const tdImp = document.createElement('td'); tdImp.className = 'nowrap-cell'; tdImp.textContent = `$${(Math.random()*1000).toFixed(2)}`; tr.appendChild(tdImp);

        tbody.appendChild(tr);
    }
}

async function runStressTestIfRequested() {
    try {
        if (location.search.includes('autotest')) {
            // Esperar que el DOM y scripts estén listos
            await new Promise(r => window.addEventListener('load', r));
            // Inyectar filas
            await injectTestRows(200);
            // Esperar un momento para que estilos y recursos se estabilicen
            await new Promise(r => setTimeout(r, 600));
            if (window.generatePDF) {
                window.generatePDF();
            } else {
                console.warn('generatePDF no está disponible aún. Intentando en 500ms...');
                setTimeout(() => { if (window.generatePDF) window.generatePDF(); }, 500);
            }
        }
    } catch (e) {
        console.error('Error en runStressTestIfRequested', e);
    }
}

// Exponer global y ejecutar si corresponde
window.injectTestRows = injectTestRows;
runStressTestIfRequested();
