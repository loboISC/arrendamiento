/* Cotización Renta - Versión simplificada para debug del cierre de notas */

(() => {
  console.log('Cotización Renta JS cargado');

  // Elementos DOM
  const els = {
    notesFab: document.getElementById('cr-notes-fab'),
    notesFloater: document.getElementById('cr-notes-floater'),
    notesFloaterHead: document.getElementById('cr-notes-floater-head'),
    noteText: document.getElementById('cr-note-text'),
    noteSave: document.getElementById('cr-note-save'),
    notesList: document.getElementById('cr-notes-list'),
    notesStep: document.getElementById('cr-notes-step'),
    notesCount: document.getElementById('cr-notes-count'),
    notesChip: document.getElementById('cr-notes-chip')
  };

  // Estado
  const state = { notes: [] };

  // Funciones de notas
  function openNotesFloater() {
    console.log('Abriendo floater');
    if (!els.notesFloater) return;
    els.notesFloater.hidden = false;
    els.notesFloater.setAttribute('aria-hidden', 'false');
    els.notesFloater.style.pointerEvents = 'auto';
    if (els.notesStep) els.notesStep.textContent = 'Paso actual';
    renderNotes();
  }

  function closeNotesFloater() {
    console.log('Cerrando floater');
    if (!els.notesFloater) return;
    els.notesFloater.hidden = true;
    els.notesFloater.setAttribute('aria-hidden', 'true');
    els.notesFloater.style.pointerEvents = 'none';
  }

  function renderNotes() {
    if (!els.notesList) return;
    els.notesList.innerHTML = '';
    if (state.notes.length === 0) {
      els.notesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No hay notas aún</p>';
    }
  }

  function addNote(text) {
    if (!text?.trim()) return;
    const note = {
      id: 'n_' + Date.now(),
      ts: Date.now(),
      step: 'Paso actual',
      text: text.trim()
    };
    state.notes.push(note);
    if (els.noteText) els.noteText.value = '';
    renderNotes();
    console.log('Nota agregada:', note);
  }

  // Inicialización
  function init() {
    console.log('Inicializando...');
    
    // FAB toggle
    if (els.notesFab) {
      els.notesFab.addEventListener('click', (e) => {
        console.log('FAB clicked');
        e.preventDefault();
        e.stopPropagation();
        
        if (els.notesFloater && els.notesFloater.hidden) {
          openNotesFloater();
        } else {
          closeNotesFloater();
        }
      });
    }

    // Botón guardar nota
    if (els.noteSave) {
      els.noteSave.addEventListener('click', () => {
        console.log('Save clicked');
        addNote(els.noteText?.value || '');
      });
    }

    // Ctrl+Enter para guardar
    if (els.noteText) {
      els.noteText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          addNote(els.noteText.value);
        }
      });
    }

    // Cierre con botones [data-close-notes]
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-notes]');
      if (closeBtn) {
        console.log('Close button clicked:', closeBtn);
        e.preventDefault();
        e.stopPropagation();
        closeNotesFloater();
      }
    });

    // Cierre con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        console.log('Escape pressed');
        e.preventDefault();
        closeNotesFloater();
      }
    });

    console.log('Elementos encontrados:', {
      fab: !!els.notesFab,
      floater: !!els.notesFloater,
      closeButtons: document.querySelectorAll('[data-close-notes]').length
    });
  }

  // Ejecutar cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
