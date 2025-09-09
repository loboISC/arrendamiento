document.addEventListener('DOMContentLoaded', function() {
    // Obtener elementos
    const modal = document.getElementById('nuevo-cliente-modal');
    const openModalBtn = document.querySelector('.add-btn');
    const closeModalBtn = document.getElementById('close-nuevo-cliente-modal');
    const form = document.getElementById('nuevo-cliente-form');

    console.log('Modal elements:', { modal, openModalBtn, closeModalBtn, form });

    // Verificar que existan los elementos necesarios
    if (!modal || !openModalBtn || !closeModalBtn) {
        console.error('No se encontraron los elementos necesarios para la modal');
        return;
    }

    // Función para abrir la modal
    function openModal() {
        console.log('Abriendo modal...');
        modal.style.display = 'flex';
        // Forzar reflow para asegurar que la animación se ejecute
        modal.offsetHeight;
        requestAnimationFrame(() => {
            modal.classList.add('show');
            console.log('Clase show añadida');
        });
        document.body.style.overflow = 'hidden';
    }

    // Función para cerrar la modal
    function closeModal() {
        console.log('Cerrando modal...');
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Event listeners
    openModalBtn.addEventListener('click', function(e) {
        console.log('Botón de abrir clickeado');
        openModal();
    });
    
    closeModalBtn.addEventListener('click', function(e) {
        console.log('Botón de cerrar clickeado');
        closeModal();
    });

    // Cerrar al hacer clic fuera de la modal
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Prevenir cierre al hacer clic dentro del modal
    modal.querySelector('.modal-content')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Manejar envío del formulario
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Formulario enviado');
            closeModal();
        });
    }

    // Cerrar con la tecla Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });
});
