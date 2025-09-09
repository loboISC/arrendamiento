'use strict';

(function(){
  // Utilidades
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  
  // Estado de la aplicación
  let currentService = null;
  let formData = {};

  document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las secciones
    const serviceSelectionSection = $('#cs-service-selection-section');
    const configCapacitacionSection = $('#cs-config-capacitacion-section');
    const configInspeccionSection = $('#cs-config-inspeccion-section');
    const configInspeccionLiberacionSection = $('#cs-config-inspeccion-liberacion-section');
    const summarySection = $('#cs-summary-section');
    const successSection = $('#cs-success-section');
    
    // Referencias a botones de control
    const volverButton = $('#cs-volver');
    const guardarButton = $('#cs-guardar');
    
    // Inicializar la aplicación
    initializeApp();
    
    function initializeApp() {
      setupServiceButtons();
      setupNavigationButtons();
      setupFormHandlers();
      setupTransitions();
      
      // Mostrar solo la sección inicial
      showSection('service-selection');
      volverButton.style.display = 'none';
      guardarButton.style.display = 'none';
    }
    
    function setupServiceButtons() {
      const serviceButtons = $$('.cs-service-card__button');
      
      serviceButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const serviceCard = button.closest('.cs-service-card');
          const serviceKey = serviceCard.dataset.service;
          
          if (serviceKey === 'capacitacion') {
            currentService = 'capacitacion';
            transitionToSection('config', 'capacitacion');
          } else if (serviceKey === 'inspeccion-andamios') {
            currentService = 'inspeccion-andamios';
            transitionToSection('config', 'inspeccion-andamios');
          } else if (serviceKey === 'liberacion-andamios') {
            currentService = 'inspeccion-liberacion-andamios';
            transitionToSection('config', 'inspeccion-liberacion-andamios');
          }
        });
      });
    }
    
    function setupNavigationButtons() {
      // Botón Volver en header
      volverButton?.addEventListener('click', () => {
        if (getCurrentSection() === 'config') {
          transitionToSection('service-selection');
        } else if (getCurrentSection() === 'summary') {
          transitionToSection('config', currentService);
        } else if (getCurrentSection() === 'success') {
          transitionToSection('summary');
        }
      });
      
      // Botón continuar desde configuración - Capacitación
      const continueBtn = $('#cs-continue-to-summary');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          if (validateConfigForm()) {
            saveFormData();
            updateSummaryData();
            transitionToSection('summary');
          }
        });
      }
      
      // Botón continuar desde configuración - Inspección
      const continueInspeccionBtn = $('#cs-continue-to-summary-inspeccion');
      if (continueInspeccionBtn) {
        continueInspeccionBtn.addEventListener('click', () => {
          if (validateInspeccionForm()) {
            saveInspeccionData();
            updateSummaryData();
            transitionToSection('summary');
          }
        });
      }
      
      // Botón continuar desde configuración - Inspección y Liberación
      const continueLiberacionBtn = $('#cs-continue-to-summary-liberacion');
      if (continueLiberacionBtn) {
        continueLiberacionBtn.addEventListener('click', () => {
          if (validateLiberacionForm()) {
            saveLiberacionData();
            updateSummaryData();
            transitionToSection('summary');
          }
        });
      }
      
      // Botón volver desde resumen
      $('#cs-back-to-config')?.addEventListener('click', () => {
        transitionToSection('config', currentService);
      });
      
      // Botón generar cotización
      $('#cs-generate-quote')?.addEventListener('click', () => {
        if (validateClientForm()) {
          generateQuote();
          transitionToSection('success');
        }
      });
      
      // Botón volver desde éxito
      $('#cs-back-to-summary')?.addEventListener('click', () => {
        transitionToSection('summary');
      });
      
      // Botón nueva cotización
      $('#cs-new-quote')?.addEventListener('click', () => {
        resetForm();
        transitionToSection('service-selection');
      });
      
      // Event listeners para los botones de éxito
      $('#download-pdf-btn')?.addEventListener('click', downloadQuotePDF);
      $('#send-email-btn')?.addEventListener('click', sendQuoteByEmail);
      $('#share-link-btn')?.addEventListener('click', shareQuoteLink);
      $('#create-invoice-btn')?.addEventListener('click', createInvoiceFromQuote);
      
      // Event listener para el botón "Agregar más"
      $('.cs-add-more-btn')?.addEventListener('click', addMoreServices);
    }
    
    function setupFormHandlers() {
      // Actualizar resumen en tiempo real - Capacitación
      const numParticipantesInput = $('#num-participantes');
      const fechaPreferidaInput = $('#fecha-preferida');
      const ubicacionInput = $('#ubicacion');
      
      if (numParticipantesInput) {
        numParticipantesInput.addEventListener('input', updateLiveSummary);
      }
      if (fechaPreferidaInput) {
        fechaPreferidaInput.addEventListener('change', updateLiveSummary);
      }
      if (ubicacionInput) {
        ubicacionInput.addEventListener('input', updateLiveSummary);
      }
      
      // Actualizar resumen en tiempo real - Inspección
      const numAndamiosInput = $('#num-andamios-inspeccion');
      const tipoAndamioInput = $('#tipo-andamio');
      const fechaInspeccionInput = $('#fecha-inspeccion');
      const ubicacionInspeccionInput = $('#ubicacion-inspeccion');
      
      if (numAndamiosInput) {
        numAndamiosInput.addEventListener('input', updateInspeccionSummary);
      }
      if (tipoAndamioInput) {
        tipoAndamioInput.addEventListener('change', updateInspeccionSummary);
      }
      if (fechaInspeccionInput) {
        fechaInspeccionInput.addEventListener('change', updateInspeccionSummary);
      }
      if (ubicacionInspeccionInput) {
        ubicacionInspeccionInput.addEventListener('input', updateInspeccionSummary);
      }
      
      // Actualizar resumen en tiempo real - Inspección y Liberación
      const numAndamiosLiberacionInput = $('#num-andamios-liberacion');
      const tipoAndamioLiberacionInput = $('#tipo-andamio-liberacion');
      const fechaLiberacionInput = $('#fecha-liberacion');
      const ubicacionLiberacionInput = $('#ubicacion-liberacion');
      
      if (numAndamiosLiberacionInput) {
        numAndamiosLiberacionInput.addEventListener('input', updateLiberacionSummary);
      }
      if (tipoAndamioLiberacionInput) {
        tipoAndamioLiberacionInput.addEventListener('change', updateLiberacionSummary);
      }
      if (fechaLiberacionInput) {
        fechaLiberacionInput.addEventListener('change', updateLiberacionSummary);
      }
      if (ubicacionLiberacionInput) {
        ubicacionLiberacionInput.addEventListener('input', updateLiberacionSummary);
      }
    }
    
    function setupTransitions() {
      // Agregar clases de transición a todas las secciones
      const sections = $$('section');
      sections.forEach(section => {
        section.classList.add('cs-section-transition');
      });
    }
    
    function transitionToSection(sectionName, serviceType = null) {
      // Ocultar sección actual con animación
      const currentSection = getCurrentSectionElement();
      if (currentSection) {
        currentSection.classList.add('cs-section-fade-out');
        
        setTimeout(() => {
          hideAllSections();
          currentSection.classList.remove('cs-section-fade-out');
          
          // Mostrar nueva sección
          showSection(sectionName, serviceType);
          
          // Actualizar stepper
          updateStepper(sectionName);
          
          // Actualizar botones de navegación
          updateNavigationButtons(sectionName);
          
        }, 300);
      } else {
        showSection(sectionName, serviceType);
        updateStepper(sectionName);
        updateNavigationButtons(sectionName);
      }
    }
    
    function showSection(sectionName, serviceType = null) {
      hideAllSections();
      
      let targetSection;
      
      switch(sectionName) {
        case 'service-selection':
          targetSection = serviceSelectionSection;
          break;
        case 'config':
          if (serviceType === 'capacitacion') {
            targetSection = configCapacitacionSection;
          } else if (serviceType === 'inspeccion-andamios') {
            targetSection = configInspeccionSection;
          } else if (serviceType === 'inspeccion-liberacion-andamios') {
            targetSection = configInspeccionLiberacionSection;
          }
          break;
        case 'summary':
          targetSection = summarySection;
          break;
        case 'success':
          targetSection = successSection;
          break;
      }
      
      if (targetSection) {
        targetSection.hidden = false;
        targetSection.classList.add('cs-section-fade-in');
        
        setTimeout(() => {
          targetSection.classList.remove('cs-section-fade-in');
        }, 300);
      }
    }
    
    function hideAllSections() {
      if (serviceSelectionSection) serviceSelectionSection.hidden = true;
      if (configCapacitacionSection) configCapacitacionSection.hidden = true;
      if (configInspeccionSection) configInspeccionSection.hidden = true;
      if (configInspeccionLiberacionSection) configInspeccionLiberacionSection.hidden = true;
      if (summarySection) summarySection.hidden = true;
      if (successSection) successSection.hidden = true;
    }
    
    function getCurrentSection() {
      if (serviceSelectionSection && !serviceSelectionSection.hidden) return 'service-selection';
      if (configCapacitacionSection && !configCapacitacionSection.hidden) return 'config';
      if (configInspeccionSection && !configInspeccionSection.hidden) return 'config';
      if (configInspeccionLiberacionSection && !configInspeccionLiberacionSection.hidden) return 'config';
      if (summarySection && !summarySection.hidden) return 'summary';
      if (successSection && !successSection.hidden) return 'success';
      return null;
    }
    
    function getCurrentSectionElement() {
      if (serviceSelectionSection && !serviceSelectionSection.hidden) return serviceSelectionSection;
      if (configCapacitacionSection && !configCapacitacionSection.hidden) return configCapacitacionSection;
      if (configInspeccionSection && !configInspeccionSection.hidden) return configInspeccionSection;
      if (configInspeccionLiberacionSection && !configInspeccionLiberacionSection.hidden) return configInspeccionLiberacionSection;
      if (summarySection && !summarySection.hidden) return summarySection;
      if (successSection && !successSection.hidden) return successSection;
      return null;
    }
    
    function updateStepper(sectionName) {
      // Reset all steppers
      $$('.cs-stepper__item').forEach(item => {
        item.classList.remove('cs-stepper__item--active', 'cs-stepper__item--completed');
      });
      
      $$('.cs-stepper__number').forEach(number => {
        const text = number.textContent;
        if (text.includes('1') || text.includes('2') || text.includes('3')) {
          number.innerHTML = text.replace(/\D/g, '');
        }
      });
      
      // Update based on current section
      const steppers = $$('.cs-stepper');
      steppers.forEach(stepper => {
        const step1 = stepper.querySelector('.cs-stepper__item:nth-child(1)');
        const step2 = stepper.querySelector('.cs-stepper__item:nth-child(2)');
        const step3 = stepper.querySelector('.cs-stepper__item:nth-child(3)');
        
        switch(sectionName) {
          case 'service-selection':
            step1?.classList.add('cs-stepper__item--active');
            break;
          case 'config':
            step1?.classList.add('cs-stepper__item--completed');
            const step1Number = step1?.querySelector('.cs-stepper__number');
            if (step1Number) step1Number.innerHTML = '<i class="fa-solid fa-check"></i>';
            step2?.classList.add('cs-stepper__item--active');
            break;
          case 'summary':
            step1?.classList.add('cs-stepper__item--completed');
            const step1NumberSummary = step1?.querySelector('.cs-stepper__number');
            if (step1NumberSummary) step1NumberSummary.innerHTML = '<i class="fa-solid fa-check"></i>';
            step2?.classList.add('cs-stepper__item--completed');
            const step2NumberSummary = step2?.querySelector('.cs-stepper__number');
            if (step2NumberSummary) step2NumberSummary.innerHTML = '<i class="fa-solid fa-check"></i>';
            step3?.classList.add('cs-stepper__item--active');
            break;
          case 'success':
            step1?.classList.add('cs-stepper__item--completed');
            const step1NumberSuccess = step1?.querySelector('.cs-stepper__number');
            if (step1NumberSuccess) step1NumberSuccess.innerHTML = '<i class="fa-solid fa-check"></i>';
            step2?.classList.add('cs-stepper__item--completed');
            const step2NumberSuccess = step2?.querySelector('.cs-stepper__number');
            if (step2NumberSuccess) step2NumberSuccess.innerHTML = '<i class="fa-solid fa-check"></i>';
            step3?.classList.add('cs-stepper__item--completed');
            const step3NumberSuccess = step3?.querySelector('.cs-stepper__number');
            if (step3NumberSuccess) step3NumberSuccess.innerHTML = '<i class="fa-solid fa-check"></i>';
            break;
        }
      });
    }
    
    function updateNavigationButtons(sectionName) {
      switch(sectionName) {
        case 'service-selection':
          volverButton.style.display = 'none';
          guardarButton.style.display = 'none';
          break;
        case 'config':
        case 'summary':
        case 'success':
          volverButton.style.display = 'block';
          guardarButton.style.display = 'block';
          break;
      }
    }
    
    function updateLiveSummary() {
      const numParticipantes = $('#num-participantes')?.value || '1';
      const fechaPreferida = $('#fecha-preferida')?.value || '-';
      const ubicacion = $('#ubicacion')?.value || '-';
      
      const summaryParticipantes = $('#summary-participantes');
      const summaryFecha = $('#summary-fecha');
      const summaryUbicacion = $('#summary-ubicacion');
      
      if (summaryParticipantes) summaryParticipantes.textContent = numParticipantes;
      if (summaryFecha) summaryFecha.textContent = fechaPreferida;
      if (summaryUbicacion) summaryUbicacion.textContent = ubicacion;
    }
    
    function updateInspeccionSummary() {
      const numAndamios = $('#num-andamios-inspeccion')?.value || '1';
      const tipoAndamio = $('#tipo-andamio');
      const tipoTexto = tipoAndamio?.options[tipoAndamio.selectedIndex]?.text || '-';
      const fechaInspeccion = $('#fecha-inspeccion')?.value || '-';
      const ubicacionInspeccion = $('#ubicacion-inspeccion')?.value || '-';
      
      const summaryAndamios = $('#summary-andamios-inspeccion');
      const summaryTipo = $('#summary-tipo-andamio');
      const summaryFechaInsp = $('#summary-fecha-inspeccion');
      const summaryUbicacionInsp = $('#summary-ubicacion-inspeccion');
      
      if (summaryAndamios) summaryAndamios.textContent = numAndamios;
      if (summaryTipo) summaryTipo.textContent = tipoTexto;
      if (summaryFechaInsp) summaryFechaInsp.textContent = fechaInspeccion;
      if (summaryUbicacionInsp) summaryUbicacionInsp.textContent = ubicacionInspeccion;
    }
    
    function updateLiberacionSummary() {
      const numAndamios = $('#num-andamios-liberacion')?.value || '1';
      const tipoAndamio = $('#tipo-andamio-liberacion');
      const tipoTexto = tipoAndamio?.options[tipoAndamio.selectedIndex]?.text || '-';
      const fechaLiberacion = $('#fecha-liberacion')?.value || '-';
      const ubicacionLiberacion = $('#ubicacion-liberacion')?.value || '-';
      
      const summaryAndamios = $('#summary-andamios-liberacion');
      const summaryTipo = $('#summary-tipo-liberacion');
      const summaryFechaLib = $('#summary-fecha-liberacion');
      const summaryUbicacionLib = $('#summary-ubicacion-liberacion');
      
      if (summaryAndamios) summaryAndamios.textContent = numAndamios;
      if (summaryTipo) summaryTipo.textContent = tipoTexto;
      if (summaryFechaLib) summaryFechaLib.textContent = fechaLiberacion;
      if (summaryUbicacionLib) summaryUbicacionLib.textContent = ubicacionLiberacion;
    }
    
    function saveFormData() {
      formData = {
        service: 'capacitacion',
        numParticipantes: $('#num-participantes')?.value || '',
        fechaPreferida: $('#fecha-preferida')?.value || '',
        ubicacion: $('#ubicacion')?.value || '',
        observaciones: $('#observaciones')?.value || ''
      };
    }
    
    function saveInspeccionData() {
      formData = {
        service: 'inspeccion-andamios',
        numAndamios: $('#num-andamios-inspeccion')?.value || '',
        tipoAndamio: $('#tipo-andamio')?.value || '',
        fechaInspeccion: $('#fecha-inspeccion')?.value || '',
        ubicacionInspeccion: $('#ubicacion-inspeccion')?.value || '',
        observacionesInspeccion: $('#observaciones-inspeccion')?.value || ''
      };
    }
    
    function saveLiberacionData() {
      formData = {
        service: 'inspeccion-liberacion-andamios',
        numAndamios: $('#num-andamios-liberacion')?.value || '',
        tipoAndamio: $('#tipo-andamio-liberacion')?.value || '',
        fechaLiberacion: $('#fecha-liberacion')?.value || '',
        ubicacionLiberacion: $('#ubicacion-liberacion')?.value || '',
        observacionesLiberacion: $('#observaciones-liberacion')?.value || ''
      };
    }
    
    function updateSummaryData() {
      if (!formData.service) return;
      
      // Actualizar información del servicio en el resumen
      const serviceTitle = $('#cs-summary-service-title');
      const serviceDetails = $('#cs-summary-service-details');
      
      if (formData.service === 'capacitacion') {
        if (serviceTitle) serviceTitle.textContent = 'Cursos de Capacitación';
        
        if (serviceDetails) {
          serviceDetails.innerHTML = `
            <div class="cs-service-item__detail">
              <span>Participantes:</span>
              <span>${formData.numParticipantes}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Fecha:</span>
              <span>${formData.fechaPreferida}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Ubicación:</span>
              <span>${formData.ubicacion}</span>
            </div>
            ${formData.observaciones ? `
              <div class="cs-service-item__observations">
                <span>Observaciones:</span>
                <p>${formData.observaciones}</p>
              </div>
            ` : ''}
          `;
        }
        
      } else if (formData.service === 'inspeccion-andamios') {
        if (serviceTitle) serviceTitle.textContent = 'Inspección de Andamios';
        
        if (serviceDetails) {
          const tipoAndamio = $('#tipo-andamio');
          const tipoTexto = tipoAndamio?.options[tipoAndamio.selectedIndex]?.text || formData.tipoAndamio;
          
          serviceDetails.innerHTML = `
            <div class="cs-service-item__detail">
              <span>Número de andamios:</span>
              <span>${formData.numAndamios}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Tipo:</span>
              <span>${tipoTexto}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Fecha:</span>
              <span>${formData.fechaInspeccion}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Ubicación:</span>
              <span>${formData.ubicacionInspeccion}</span>
            </div>
            ${formData.observacionesInspeccion ? `
              <div class="cs-service-item__observations">
                <span>Observaciones:</span>
                <p>${formData.observacionesInspeccion}</p>
              </div>
            ` : ''}
          `;
        }
      } else if (formData.service === 'inspeccion-liberacion-andamios') {
        if (serviceTitle) serviceTitle.textContent = 'Inspección y Liberación de Andamios';
        
        if (serviceDetails) {
          const tipoAndamio = $('#tipo-andamio-liberacion');
          const tipoTexto = tipoAndamio?.options[tipoAndamio.selectedIndex]?.text || formData.tipoAndamio;
          
          serviceDetails.innerHTML = `
            <div class="cs-service-item__detail">
              <span>Número de andamios:</span>
              <span>${formData.numAndamios}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Tipo:</span>
              <span>${tipoTexto}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Fecha:</span>
              <span>${formData.fechaLiberacion}</span>
            </div>
            <div class="cs-service-item__detail">
              <span>Ubicación:</span>
              <span>${formData.ubicacionLiberacion}</span>
            </div>
            ${formData.observacionesLiberacion ? `
              <div class="cs-service-item__observations">
                <span>Observaciones:</span>
                <p>${formData.observacionesLiberacion}</p>
              </div>
            ` : ''}
          `;
        }
      }
      
      // Actualizar fecha de validez (30 días desde hoy)
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);
      $('#validity-date').textContent = formatDate(validityDate.toISOString().split('T')[0]);
    }
    
    function validateConfigForm() {
      const numParticipantes = $('#num-participantes')?.value;
      const fechaPreferida = $('#fecha-preferida')?.value;
      const ubicacion = $('#ubicacion')?.value;
      
      if (!numParticipantes || numParticipantes < 1) {
        alert('Por favor, ingresa el número de participantes.');
        return false;
      }
      
      if (!fechaPreferida) {
        alert('Por favor, selecciona una fecha preferida.');
        return false;
      }
      
      if (!ubicacion?.trim()) {
        alert('Por favor, ingresa la ubicación del servicio.');
        return false;
      }
      
      return true;
    }
    
    function validateInspeccionForm() {
      const numAndamios = $('#num-andamios-inspeccion')?.value;
      const tipoAndamio = $('#tipo-andamio')?.value;
      const fechaInspeccion = $('#fecha-inspeccion')?.value;
      const ubicacionInspeccion = $('#ubicacion-inspeccion')?.value;
      
      if (!numAndamios || numAndamios < 1) {
        alert('Por favor, ingresa el número de andamios.');
        return false;
      }
      
      if (!tipoAndamio) {
        alert('Por favor, selecciona el tipo de andamio.');
        return false;
      }
      
      if (!fechaInspeccion) {
        alert('Por favor, selecciona una fecha para la inspección.');
        return false;
      }
      
      if (!ubicacionInspeccion?.trim()) {
        alert('Por favor, ingresa la ubicación del servicio.');
        return false;
      }
      
      return true;
    }
    
    function validateLiberacionForm() {
      const numAndamios = $('#num-andamios-liberacion')?.value;
      const tipoAndamio = $('#tipo-andamio-liberacion')?.value;
      const fechaLiberacion = $('#fecha-liberacion')?.value;
      const ubicacionLiberacion = $('#ubicacion-liberacion')?.value;
      
      if (!numAndamios || numAndamios < 1) {
        alert('Por favor, ingresa el número de andamios.');
        return false;
      }
      
      if (!tipoAndamio) {
        alert('Por favor, selecciona el tipo de andamio.');
        return false;
      }
      
      if (!fechaLiberacion) {
        alert('Por favor, selecciona una fecha para la inspección y liberación.');
        return false;
      }
      
      if (!ubicacionLiberacion?.trim()) {
        alert('Por favor, ingresa la ubicación del servicio.');
        return false;
      }
      
      return true;
    }
    
    function validateClientForm() {
      const clientName = $('#client-name')?.value;
      const clientCompany = $('#client-company')?.value;
      const clientPhone = $('#client-phone')?.value;
      const clientEmail = $('#client-email')?.value;
      
      if (!clientName?.trim()) {
        alert('Por favor, ingresa el nombre del contacto.');
        $('#client-name')?.focus();
        return false;
      }
      
      if (!clientCompany?.trim()) {
        alert('Por favor, ingresa el nombre de la empresa.');
        $('#client-company')?.focus();
        return false;
      }
      
      if (!clientPhone?.trim()) {
        alert('Por favor, ingresa el teléfono.');
        $('#client-phone')?.focus();
        return false;
      }
      
      if (!clientEmail?.trim() || !isValidEmail(clientEmail)) {
        alert('Por favor, ingresa un email válido.');
        $('#client-email')?.focus();
        return false;
      }
      
      return true;
    }
    
    function generateQuoteNumber() {
      const now = new Date();
      const year = now.getFullYear();
      const random = Math.floor(Math.random() * 900000) + 100000; // 6 digit random
      
      return `COT-${year}-${random}`;
    }
    
    function generateQuote() {
      // Generar número de cotización
      const quoteNumber = generateQuoteNumber();
      
      // Guardar datos de la cotización
      const quoteData = {
        number: quoteNumber,
        service: formData.service,
        serviceData: formData,
        client: {
          name: $('#client-name')?.value || '',
          company: $('#client-company')?.value || '',
          phone: $('#client-phone')?.value || '',
          email: $('#client-email')?.value || '',
          address: $('#client-address')?.value || '',
          taxId: $('#client-tax-id')?.value || '',
          notes: $('#client-notes')?.value || ''
        },
        date: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        advisor: {
          name: 'María González',
          department: 'Ventas Técnicas',
          email: 'maria.gonzalez@tecnoseguridadpro.com',
          id: 'ADV001'
        }
      };
      
      // Guardar en sessionStorage
      sessionStorage.setItem('lastQuote', JSON.stringify(quoteData));
      
      // Actualizar UI con número de cotización (solo si los elementos existen)
      const quoteNumberEl = $('#cs-quote-number-success');
      if (quoteNumberEl) quoteNumberEl.textContent = quoteNumber;
      
      const successQuoteNumberEl = $('#success-quote-number');
      if (successQuoteNumberEl) successQuoteNumberEl.textContent = quoteNumber;
      
      // Actualizar fechas
      const today = formatDate(new Date().toISOString().split('T')[0]);
      const validUntil = formatDate(quoteData.validUntil.split('T')[0]);
      
      const successQuoteDateEl = $('#success-quote-date');
      if (successQuoteDateEl) successQuoteDateEl.textContent = today;
      
      const successQuoteValidUntilEl = $('#success-quote-valid-until');
      if (successQuoteValidUntilEl) successQuoteValidUntilEl.textContent = validUntil;
      
      // Actualizar información del cliente en la sección de éxito
      const successClientNameEl = $('#success-client-name');
      if (successClientNameEl) successClientNameEl.textContent = quoteData.client.name;
      
      const successClientCompanyEl = $('#success-client-company');
      if (successClientCompanyEl) successClientCompanyEl.textContent = quoteData.client.company;
      
      const successClientEmailEl = $('#success-client-email');
      if (successClientEmailEl) successClientEmailEl.textContent = quoteData.client.email;
      
      const successClientPhoneEl = $('#success-client-phone');
      if (successClientPhoneEl) successClientPhoneEl.textContent = quoteData.client.phone;
    }
    
    function downloadQuotePDF() {
      const quoteData = JSON.parse(sessionStorage.getItem('lastQuote') || '{}');
      if (!quoteData.number) {
        alert('No hay cotización para descargar');
        return;
      }
      
      // Crear contenido del PDF
      const pdfContent = generatePDFContent(quoteData);
      
      // Simular descarga (en producción usar librería como jsPDF)
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizacion_${quoteData.number}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Mostrar mensaje de éxito
      showNotification('PDF descargado exitosamente', 'success');
    }
    
    function sendQuoteByEmail() {
      const quoteData = JSON.parse(sessionStorage.getItem('lastQuote') || '{}');
      if (!quoteData.number || !quoteData.client.email) {
        alert('Datos de cotización o email del cliente faltantes');
        return;
      }
      
      // Simular envío de email
      const emailData = {
        to: quoteData.client.email,
        subject: `Cotización ${quoteData.number} - ${getServiceTitle(quoteData.service)}`,
        body: generateEmailContent(quoteData)
      };
      
      // En producción, enviar al backend
      console.log('Enviando email:', emailData);
      
      // Simular delay y mostrar éxito
      setTimeout(() => {
        showNotification(`Cotización enviada exitosamente a ${quoteData.client.email}`, 'success');
      }, 1000);
    }
    
    function shareQuoteLink() {
      const quoteData = JSON.parse(sessionStorage.getItem('lastQuote') || '{}');
      if (!quoteData.number) {
        alert('No hay cotización para compartir');
        return;
      }
      
      // Generar enlace de la cotización
      const baseUrl = window.location.origin;
      const quoteUrl = `${baseUrl}/public/ver-cotizacion.html?id=${quoteData.number}`;
      
      // Copiar al portapapeles
      navigator.clipboard.writeText(quoteUrl).then(() => {
        showNotification('Enlace copiado al portapapeles', 'success');
      }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = quoteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Enlace copiado al portapapeles', 'success');
      });
    }
    
    function createInvoiceFromQuote() {
      const quoteData = JSON.parse(sessionStorage.getItem('lastQuote') || '{}');
      if (!quoteData.number) {
        alert('No hay cotización para facturar');
        return;
      }
      
      // Guardar datos para la factura
      sessionStorage.setItem('invoiceFromQuote', JSON.stringify(quoteData));
      
      // Redirigir a la página de facturación
      window.location.href = '/public/generar-factura.html';
    }
    
    // Función para mostrar notificaciones
    function showNotification(message, type = 'success') {
      // Crear elemento de notificación
      const notification = document.createElement('div');
      notification.className = `notification notification--${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
          <span>${message}</span>
        </div>
      `;
      
      // Agregar estilos inline si no existen
      if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
          .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .notification--success {
            background: #10b981;
          }
          
          .notification--error {
            background: #ef4444;
          }
          
          .notification-content {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(styles);
      }
      
      // Agregar al DOM
      document.body.appendChild(notification);
      
      // Remover después de 3 segundos
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
    
    // Función para agregar más servicios
    function addMoreServices() {
      // Guardar datos actuales
      const currentData = {
        service: formData.service,
        serviceData: formData,
        client: {
          name: $('#client-name')?.value || '',
          company: $('#client-company')?.value || '',
          phone: $('#client-phone')?.value || '',
          email: $('#client-email')?.value || '',
          address: $('#client-address')?.value || '',
          taxId: $('#client-tax-id')?.value || '',
          notes: $('#client-notes')?.value || ''
        }
      };
      
      // Guardar en sessionStorage para no perder datos
      sessionStorage.setItem('currentQuoteData', JSON.stringify(currentData));
      
      // Mostrar modal o redirigir a selección de servicios adicionales
      showAddMoreServicesModal();
    }
    
    function showAddMoreServicesModal() {
      // Crear modal para seleccionar servicios adicionales
      const modal = document.createElement('div');
      modal.className = 'add-services-modal';
      modal.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Agregar Servicios Adicionales</h3>
              <button class="modal-close" onclick="this.closest('.add-services-modal').remove()">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <p>Selecciona servicios adicionales para incluir en tu cotización:</p>
              
              <div class="additional-services">
                <div class="service-option" data-service="capacitacion">
                  <div class="service-icon">
                    <i class="fa-solid fa-graduation-cap"></i>
                  </div>
                  <div class="service-info">
                    <h4>Cursos de Capacitación</h4>
                    <p>Formación especializada en seguridad</p>
                  </div>
                  <button class="select-service-btn">Seleccionar</button>
                </div>
                
                <div class="service-option" data-service="inspeccion-andamios">
                  <div class="service-icon">
                    <i class="fa-solid fa-search"></i>
                  </div>
                  <div class="service-info">
                    <h4>Inspección de Andamios</h4>
                    <p>Revisión técnica especializada</p>
                  </div>
                  <button class="select-service-btn">Seleccionar</button>
                </div>
                
                <div class="service-option" data-service="inspeccion-liberacion-andamios">
                  <div class="service-icon">
                    <i class="fa-solid fa-clipboard-check"></i>
                  </div>
                  <div class="service-info">
                    <h4>Inspección y Liberación</h4>
                    <p>Inspección completa con liberación</p>
                  </div>
                  <button class="select-service-btn">Seleccionar</button>
                </div>
                
                <div class="service-option" data-service="renta-andamios">
                  <div class="service-icon">
                    <i class="fa-solid fa-tools"></i>
                  </div>
                  <div class="service-info">
                    <h4>Renta de Andamios</h4>
                    <p>Alquiler de equipos especializados</p>
                  </div>
                  <button class="select-service-btn">Seleccionar</button>
                </div>
                
                <div class="service-option" data-service="venta-andamios">
                  <div class="service-icon">
                    <i class="fa-solid fa-shopping-cart"></i>
                  </div>
                  <div class="service-info">
                    <h4>Venta de Andamios</h4>
                    <p>Equipos nuevos y usados</p>
                  </div>
                  <button class="select-service-btn">Seleccionar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Agregar estilos del modal
      if (!document.querySelector('#modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
          .add-services-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
          }
          
          .modal-overlay {
            background: rgba(0,0,0,0.5);
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          
          .modal-content {
            background: white;
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
          }
          
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .modal-header h3 {
            margin: 0;
            color: #1f2937;
          }
          
          .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #6b7280;
            cursor: pointer;
            padding: 0.5rem;
          }
          
          .modal-body {
            padding: 1.5rem;
          }
          
          .additional-services {
            display: grid;
            gap: 1rem;
            margin-top: 1rem;
          }
          
          .service-option {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            transition: all 0.2s;
          }
          
          .service-option:hover {
            border-color: #3b82f6;
            background: #f8fafc;
          }
          
          .service-icon {
            width: 48px;
            height: 48px;
            background: #3b82f6;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
          }
          
          .service-info {
            flex: 1;
          }
          
          .service-info h4 {
            margin: 0 0 0.25rem 0;
            color: #1f2937;
          }
          
          .service-info p {
            margin: 0;
            color: #6b7280;
            font-size: 0.875rem;
          }
          
          .select-service-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          }
          
          .select-service-btn:hover {
            background: #059669;
          }
        `;
        document.head.appendChild(styles);
      }
      
      // Agregar event listeners a los botones
      modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-service-btn')) {
          const serviceType = e.target.closest('.service-option').dataset.service;
          selectAdditionalService(serviceType);
          modal.remove();
        }
      });
      
      // Cerrar modal al hacer click en overlay
      modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          modal.remove();
        }
      });
      
      document.body.appendChild(modal);
    }
    
    function selectAdditionalService(serviceType) {
      // Mostrar notificación de servicio agregado
      showNotification(`Servicio "${getServiceTitle(serviceType)}" agregado a la cotización`, 'success');
      
      // Aquí puedes implementar la lógica para agregar el servicio
      // Por ahora, redirigir a la configuración del servicio seleccionado
      if (serviceType === 'renta-andamios' || serviceType === 'venta-andamios') {
        showNotification('Funcionalidad en desarrollo. Próximamente disponible.', 'error');
        return;
      }
      
      // Para servicios existentes, redirigir a su configuración
      formData.service = serviceType;
      transitionToSection('config');
      updateStepper('config');
    }
    
    function resetForm() {
      // Limpiar formularios
      $$('input, textarea').forEach(input => {
        if (input.type === 'number') {
          input.value = '1';
        } else {
          input.value = '';
        }
      });
      
      // Resetear estado
      currentService = null;
      formData = {};
      
      // Limpiar sessionStorage
      sessionStorage.removeItem('lastQuote');
    }
    
    function formatDate(dateString) {
      if (!dateString) return '-';
      
      const date = new Date(dateString);
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      
      return date.toLocaleDateString('es-ES', options);
    }
    
    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    
  });
})();