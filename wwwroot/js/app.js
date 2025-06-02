document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');

    if (menuToggle && wrapper) {
        menuToggle.addEventListener('click', function (e) {
            e.preventDefault();
            wrapper.classList.toggle('toggled');

            // Cambiar ícono
            const icon = menuToggle.querySelector('i');
            if (wrapper.classList.contains('toggled')) {
                icon.classList.remove('bi-list');
                icon.classList.add('bi-layout-sidebar-inset-reverse');
            } else {
                icon.classList.remove('bi-layout-sidebar-inset-reverse');
                icon.classList.add('bi-list');
            }

            // Guardar estado en localStorage
            localStorage.setItem('sidebarToggled', wrapper.classList.contains('toggled'));
        });

        // Cargar estado guardado
        if (localStorage.getItem('sidebarToggled') === 'true') {
            wrapper.classList.add('toggled');
            const icon = menuToggle.querySelector('i');
            icon.classList.remove('bi-list');
            icon.classList.add('bi-layout-sidebar-inset-reverse');
        }

        // Manejo responsive
        function handleResize() {
            if (window.innerWidth < 992) {
                wrapper.classList.add('toggled');
                if (menuToggle) {
                    const icon = menuToggle.querySelector('i');
                    icon.classList.remove('bi-list');
                    icon.classList.add('bi-layout-sidebar-inset-reverse');
                }
            } else {
                wrapper.classList.remove('toggled');
                if (menuToggle) {
                    const icon = menuToggle.querySelector('i');
                    icon.classList.remove('bi-layout-sidebar-inset-reverse');
                    icon.classList.add('bi-list');
                }
            }
        }

        window.addEventListener('resize', handleResize);
        handleResize(); // Ejecutar al cargar
    }
});