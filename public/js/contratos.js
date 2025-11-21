document.addEventListener('DOMContentLoaded', function () {
    // Function to update user profile UI
    const updateUserProfile = (user) => {
        if (!user) return;

        const avatar = document.getElementById('user-avatar');
        const dropdownUsername = document.getElementById('dropdown-username');
        const dropdownUserRole = document.getElementById('dropdown-user-role');

        if (user.nombre) {
            dropdownUsername.textContent = user.nombre;
        }
        if (user.rol) {
            dropdownUserRole.textContent = user.rol;
        }
        if (user.foto) {
            avatar.src = user.foto;
        } else if (user.nombre) {
            // Fallback to initials if no photo
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const context = canvas.getContext('2d');
            context.fillStyle = '#003366'; // brand-blue
            context.fillRect(0, 0, 100, 100);
            context.fillStyle = 'white';
            context.font = 'bold 40px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const initials = user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            context.fillText(initials, 50, 50);
            avatar.src = canvas.toDataURL();
        }
    };

    // Cargar datos del usuario de forma robusta llamando a la función de auth.js
    if (window.auth && typeof window.auth.cargarUsuario === 'function') {
        window.auth.cargarUsuario().then(user => {
            if (user) {
                updateUserProfile(user);
            } else {
                // Si falla la carga desde el servidor, intentar desde localStorage como respaldo
                try {
                    const savedUser = localStorage.getItem('currentUser');
                    if (savedUser) {
                        updateUserProfile(JSON.parse(savedUser));
                    }
                } catch (e) {
                    console.error('Error loading user from localStorage', e);
                }
            }
        });
    }

    // Toggle dropdown visibility
    const avatar = document.getElementById('user-avatar');
    const dropdown = document.getElementById('user-dropdown');
    avatar.addEventListener('click', () => {
        dropdown.classList.toggle('show');
    });

    // Hide dropdown if clicking outside
    window.addEventListener('click', (e) => {
        if (!avatar.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Modal functionality
    const newContractBtn = document.querySelector('.btn-primary'); // Assuming this is the 'NUEVO CONTRATO' button
    const modal = document.getElementById('new-contract-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelContractBtn = document.getElementById('cancel-contract-btn');

    newContractBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    const closeModal = () => {
        modal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeModal);
    cancelContractBtn.addEventListener('click', closeModal);

    // Handle modal navigation
    const modalNavLinks = document.querySelectorAll('.modal-nav-link');
    const modalViews = document.querySelectorAll('.modal-view');

    modalNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;

            modalViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) {
                    view.classList.add('active');
                }
            });

            modalNavLinks.forEach(navLink => {
                navLink.classList.remove('active');
            });
            link.classList.add('active');

            if (targetId === 'preview-view') {
                updatePreview();
            } else if (targetId === 'nota-view') {
                updateNotePreview();
            }
        });
    });

    // Close modal if clicking on the overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.auth && typeof window.auth.cerrarSesion === 'function') {
            window.auth.cerrarSesion();
        }
    });

    const tabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.content-section');

    let calendar = null;
    let contractTemplate = '';
    let noteTemplate = '';
    let logoDataUrl = '';

    const getApiBaseUrl = () => {
        if (window.API_BASE_URL) return window.API_BASE_URL;
        const origin = window.location.origin;
        if (!origin || origin === 'null' || origin === 'file://' || origin.startsWith('file:')) {
            return 'http://localhost:3001';
        }
        return origin.replace(/\/$/, '');
    };

    const API_BASE_URL = getApiBaseUrl();
    const PREVIEW_ENDPOINT = `${API_BASE_URL}/api/preview`;

    const getPreviewHeaders = () => {
        const baseHeaders = window.auth?.getAuthHeaders ? window.auth.getAuthHeaders() : {};
        return {
            'Content-Type': 'application/json',
            ...baseHeaders,
        };
    };

    const loadPreviewIntoIframe = async (iframe, htmlString) => {
        if (!iframe || !htmlString) return;

        const requestId = Date.now().toString();
        iframe.dataset.previewRequestId = requestId;

        try {
            const response = await fetch(PREVIEW_ENDPOINT, {
                method: 'POST',
                headers: getPreviewHeaders(),
                body: JSON.stringify({ html: htmlString })
            });

            if (!response.ok) {
                throw new Error('No se pudo generar la vista previa');
            }

            const { url, id } = await response.json();
            const previewPath = url || (id ? `/api/preview/${id}` : '');

            if (iframe.dataset.previewRequestId !== requestId) {
                return;
            }

            if (!previewPath) {
                throw new Error('Respuesta inválida al generar vista previa');
            }

            if (previewPath.startsWith('http')) {
                iframe.src = previewPath;
            } else {
                const normalizedPath = previewPath.startsWith('/') ? previewPath : `/${previewPath}`;
                iframe.src = `${API_BASE_URL}${normalizedPath}`;
            }
        } catch (error) {
            console.error('Error actualizando vista previa:', error);
            iframe.src = 'about:blank';
        }
    };

    // Load the contract template using the preload script for reliability in Electron
    if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
        window.electronAPI.readFile('pdf_contrato.html')
            .then(html => {
                contractTemplate = html;
                window.contractTemplateContent = html;

                // If user is currently on preview tab, refresh it immediately
                const previewSection = document.getElementById('preview-view');
                if (previewSection && previewSection.classList.contains('active')) {
                    updatePreview();
                }
            })
            .catch(error => {
                console.error('Error reading contract template:', error);
            });
    }

    if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
        window.electronAPI.readFile('hoja_pedido.html')
            .then(html => {
                noteTemplate = html;
                window.noteTemplateContent = html;

                const noteSection = document.getElementById('nota-view');
                if (noteSection && noteSection.classList.contains('active')) {
                    updateNotePreview();
                }
            })
            .catch(error => {
                console.error('Error reading note template:', error);
            });
    }

    if (window.electronAPI && typeof window.electronAPI.readFileDataUrl === 'function') {
        window.electronAPI.readFileDataUrl('img/logo-demo.jpg')
            .then(dataUrl => {
                logoDataUrl = dataUrl;

                const previewSection = document.getElementById('preview-view');
                if (previewSection && previewSection.classList.contains('active')) {
                    updatePreview();
                }

                const noteSection = document.getElementById('nota-view');
                if (noteSection && noteSection.classList.contains('active')) {
                    updateNotePreview();
                }
            })
            .catch(error => {
                console.error('Error reading logo asset:', error);
            });
    }

    const updatePreview = () => {
        if (!contractTemplate) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(contractTemplate, 'text/html');

        // Ensure relative assets resolve correctly inside the iframe
        const baseHref = new URL('./', window.location.href).href;
        let baseEl = doc.querySelector('base');
        if (!baseEl) {
            baseEl = doc.createElement('base');
            doc.head.insertBefore(baseEl, doc.head.firstChild);
        }
        baseEl.setAttribute('href', baseHref);

        // --- Populate data from form into the template ---
        const contractNoValue = document.getElementById('contract-no').value;
        const contractNoEl = doc.querySelector('.text-red-600');
        if (contractNoEl) {
            contractNoEl.textContent = contractNoValue;
        }

        const clientNameValue = document.getElementById('contract-client').value;
        const clientNameInput = doc.querySelector('input[placeholder="Nombre completo o Razón Social"]');
        if (clientNameInput) {
            clientNameInput.value = clientNameValue;
            clientNameInput.setAttribute('value', clientNameValue);
        }

        const deliveryAddressInput = doc.querySelector('input[placeholder="Domicilio de la Obra"]');
        if (deliveryAddressInput) {
            const calle = document.getElementById('calle').value;
            const noExterno = document.getElementById('no-externo').value;
            const colonia = document.getElementById('colonia').value;
            const direccion = `${calle} #${noExterno}, ${colonia}`;
            deliveryAddressInput.value = direccion;
            deliveryAddressInput.setAttribute('value', direccion);
        }

        if (logoDataUrl) {
            const logoImg = doc.querySelector('img[src="img/logo-demo.jpg"]');
            if (logoImg) {
                logoImg.setAttribute('src', logoDataUrl);
            }
        }

        const iframe = document.getElementById('contract-preview-iframe');
        const htmlString = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        loadPreviewIntoIframe(iframe, htmlString);
    };

    const updateNotePreview = () => {
        if (!noteTemplate) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(noteTemplate, 'text/html');

        const baseHref = new URL('./', window.location.href).href;
        let baseEl = doc.querySelector('base');
        if (!baseEl) {
            baseEl = doc.createElement('base');
            doc.head.insertBefore(baseEl, doc.head.firstChild);
        }
        baseEl.setAttribute('href', baseHref);

        doc.querySelectorAll('script').forEach(script => script.remove());

        if (logoDataUrl) {
            doc.querySelectorAll('img[src="img/logo-demo.jpg"]').forEach(img => {
                img.setAttribute('src', logoDataUrl);
            });
        }

        const getValue = (selector, fallback = '') => {
            const el = document.querySelector(selector);
            return el ? el.value || el.textContent || fallback : fallback;
        };

        const safeText = (selector, value, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                el.textContent = value || value === 0 ? value : fallback;
            }
        };

        const safeMultiline = (selector, lines, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                const content = (Array.isArray(lines) ? lines : [lines])
                    .map(v => (v ?? '').toString().trim())
                    .filter(Boolean);
                el.textContent = content.length ? content.join('\n') : fallback;
            }
        };

        const formatCurrency = (value) => {
            const num = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
            if (!Number.isFinite(num)) return '$0.00';
            return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
        };

        const formatDateParts = (value) => {
            if (!value) {
                return { day: '--', month: '--', year: '----', full: '--/--/----' };
            }
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return { day: '--', month: '--', year: '----', full: value };
            }
            return {
                day: String(date.getDate()).padStart(2, '0'),
                month: date.toLocaleString('es-MX', { month: 'long' }).toUpperCase(),
                year: String(date.getFullYear()),
                full: date.toLocaleString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            };
        };

        const contractNumber = getValue('#contract-no');
        const contractClient = getValue('#contract-client');
        const contractDate = getValue('#contract-date');
        const condiciones = getValue('#contract-type');
        const notasEntrega = getValue('#delivery-notes');

        const calle = getValue('#calle');
        const noExterno = getValue('#no-externo');
        const noInterno = getValue('#no-interno');
        const colonia = getValue('#colonia');
        const cp = getValue('#cp');
        const estado = getValue('#estado');
        const municipio = getValue('#municipio');

        const direccionEntrega = [calle, `No. Ext: ${noExterno}`, noInterno ? `No. Int: ${noInterno}` : '', colonia]
            .filter(Boolean)
            .join(', ');

        const facturarLines = [contractClient, colonia, `${municipio}, ${estado}`, `C.P. ${cp}`];
        const remitirLines = [contractClient, direccionEntrega, `${municipio}, ${estado}`, `C.P. ${cp}`];

        const dateParts = formatDateParts(contractDate);
        safeText('#print-folio', contractNumber || '--');
        safeText('#print-contrato', contractNumber || '--');
        safeText('#print-dia', dateParts.day);
        safeText('#print-mes', dateParts.month);
        safeText('#print-ano', dateParts.year);
        safeText('#print-emision', dateParts.full);
        safeText('#print-condiciones', condiciones || '--');
        safeText('#print-notas', notasEntrega || '--');

        const agente = document.getElementById('dropdown-username')?.textContent?.trim();
        safeText('#print-agente', agente || 'Equipo de Ventas');
        safeText('#print-envio-metodo', 'Entrega a domicilio');
        safeText('#print-envio-sucursal', 'Sucursal Principal');
        safeText('#print-envio-fecha', dateParts.full);
        safeText('#print-envio-distancia', '--');

        safeMultiline('#print-facturar-a', facturarLines);
        safeMultiline('#print-remitir-a', remitirLines);

        const itemsRows = Array.from(document.querySelectorAll('.items-table tbody tr'));
        const tbody = doc.querySelector('#print-productos');
        const productRows = [];
        let subtotal = 0;

        itemsRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return;

            const quantity = cells[2].textContent.trim();
            const description = cells[1].textContent.trim();
            const amountRaw = cells[5].textContent.trim();
            const amountNumber = Number(amountRaw.replace(/[^0-9.-]/g, '')) || 0;
            subtotal += amountNumber;

            productRows.push(`
                <tr>
                    <td class="quantity">${quantity || '-'}</td>
                    <td>${description || '-'}</td>
                    <td class="amount">${formatCurrency(amountNumber)}</td>
                </tr>
            `);
        });

        if (tbody) {
            tbody.innerHTML = productRows.length
                ? productRows.join('')
                : '<tr class="empty-row"><td colspan="3">Sin registros disponibles.</td></tr>';
        }

        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        safeText('#print-subtotal', formatCurrency(subtotal));
        safeText('#print-iva', formatCurrency(iva));
        safeText('#print-envio-total', formatCurrency(0));
        safeText('#print-total', formatCurrency(total));

        const iframe = document.getElementById('note-preview-iframe');
        if (!iframe) return;

        const htmlString = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        loadPreviewIntoIframe(iframe, htmlString);
    };

    const showCalendar = () => {
        const calendarEl = document.getElementById('calendar');
        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                events: [
                    {
                        title: 'Contrato: Constructora ABC',
                        start: '2024-01-10',
                        end: '2024-02-11',
                        backgroundColor: '#1abc9c',
                    },
                    {
                        title: 'Contrato: Obras del Norte',
                        start: '2024-01-15',
                        end: '2024-03-16',
                        backgroundColor: '#ffc107',
                        textColor: '#333'
                    },
                    {
                        title: 'Contrato: Edificaciones Sur',
                        start: '2024-01-05',
                        end: '2024-01-21',
                        backgroundColor: '#6c757d',
                    }
                ]
            });
            calendar.render();
        }

        // Update size every time the tab is shown, after the transition
        setTimeout(() => {
            if (calendar) {
                calendar.updateSize();
            }
        }, 50); // A short delay is enough
    };

    // Function to switch tabs
    const switchTab = (targetId) => {
        sections.forEach(section => {
            if (section.id === targetId) {
                section.classList.add('active');
                if (targetId === 'calendar') {
                    showCalendar();
                } else if (targetId === 'preview-view') {
                    updatePreview();
                }
            } else {
                section.classList.remove('active');
            }
        });

        tabs.forEach(tab => {
            if (tab.dataset.target === targetId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    };

    // Event listeners for tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;
            switchTab(targetId);
        });
    });

    // Initialize dashboard charts
    const initDashboard = () => {
        // Chart 1: Activos y Concluidos (Stacked Bar)
        const stackedBarCtx = document.getElementById('stackedBarChart').getContext('2d');
        new Chart(stackedBarCtx, {
            type: 'bar',
            data: {
                labels: ['Elemento 1', 'Elemento 2', 'Elemento 3', 'Elemento 4'],
                datasets: [
                    { label: 'Serie 1', data: [10, 12, 15, 20], backgroundColor: 'rgba(173, 216, 230, 1)' },
                    { label: 'Serie 2', data: [5, 8, 11, 6], backgroundColor: 'rgba(70, 130, 180, 1)' },
                    { label: 'Serie 3', data: [5, 2, 10, 18], backgroundColor: 'rgba(0, 51, 102, 1)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });

        // Chart 2: Contratos por Mes (Line)
        const lineChartCtx = document.getElementById('lineChart').getContext('2d');
        new Chart(lineChartCtx, {
            type: 'line',
            data: {
                labels: ['Elemento 1', 'Elemento 2', 'Elemento 3', 'Elemento 4', 'Elemento 5'],
                datasets: [
                    { label: 'Serie 1', data: [12, 4, 29, 15, 40], borderColor: 'rgba(70, 130, 180, 1)', tension: 0.1, fill: false },
                    { label: 'Serie 2', data: [18, 38, 25, 20, 42], borderColor: 'rgba(0, 51, 102, 1)', tension: 0.1, fill: false },
                    { label: 'Serie 3', data: [0, 15, 10, 30, 50], borderColor: 'rgba(173, 216, 230, 1)', tension: 0.1, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    };

    // Set initial tab and load dashboard
    switchTab('dashboard');
    initDashboard();
});
