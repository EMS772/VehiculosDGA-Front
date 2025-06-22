// auth-manager.js - Manejo global de autenticación
class AuthManager {
    constructor() {
        this.tokenKey = 'authToken';
        this.userKey = 'userData';
        this.claimsKey = 'userClaims';
        this.apiBaseUrl = 'https://localhost:7037';
    }

    // Verificar si está autenticado
    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const claims = this.getClaims();
            if (!claims || !claims.exp) return false;

            const now = Date.now() / 1000;
            return claims.exp > now;
        } catch (error) {
            console.error('Error al verificar token:', error);
            return false;
        }
    }

    // Obtener token
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // Obtener datos del usuario
    getUserData() {
        const userData = localStorage.getItem(this.userKey);
        return userData ? JSON.parse(userData) : null;
    }

    // Obtener claims del token
    getClaims() {
        const claims = localStorage.getItem(this.claimsKey);
        return claims ? JSON.parse(claims) : null;
    }

    // Verificar si tiene control de flotilla
    hasControlFlotilla() {
        const userData = this.getUserData();
        if (userData) {
            return userData.controlFlotilla === true;
        }

        // Fallback a claims del token
        const claims = this.getClaims();
        return claims && claims.controlFlotilla === 'true';
    }

    // Verificar si tiene control de servicios
    hasControlServicios() {
        const userData = this.getUserData();
        if (userData) {
            return userData.controlServicios === true;
        }

        // Fallback a claims del token
        const claims = this.getClaims();
        return claims && claims.controlServicios === 'true';
    }

    // Obtener nombre completo del usuario
    getUserFullName() {
        const userData = this.getUserData();
        if (userData) {
            return `${userData.nombre} ${userData.apellido}`;
        }

        const claims = this.getClaims();
        if (claims) {
            return `${claims.nombre || ''} ${claims.apellido || ''}`.trim();
        }

        return 'Usuario';
    }

    // Inicializar UI basado en autenticación
    initializeUI() {
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
            return;
        }

        this.updateUserInfo();
        this.handleSidebarVisibility();
        this.handleMenuItemsVisibility();
        this.setupAxiosInterceptors();
    }

    // Actualizar información del usuario en la UI
    updateUserInfo() {
        const userNameElement = document.querySelector('#dropdownUser span');
        if (userNameElement) {
            userNameElement.textContent = this.getUserFullName();
        }
    }

    // Verificar si tiene cualquier permiso de control
    hasAnyControlPermission() {
        return this.hasControlFlotilla() || this.hasControlServicios();
    }

    // Manejar visibilidad del sidebar
    handleSidebarVisibility() {
        const hasAnyPermission = this.hasAnyControlPermission();
        const hasFlotilla = this.hasControlFlotilla();
        const hasServicios = this.hasControlServicios();

        const sidebar = document.getElementById('sidebar-wrapper');
        const pageContent = document.getElementById('page-content-wrapper');
        const menuToggle = document.getElementById('menu-toggle');
        const navbarBrand = document.querySelector('.navbar-brand');

        if (hasAnyPermission) {
            // Mostrar sidebar
            if (sidebar) sidebar.style.display = 'block';
            if (pageContent) pageContent.classList.remove('full-width');
            if (menuToggle) menuToggle.style.display = 'block';
            if (navbarBrand) navbarBrand.classList.add('ms-2');
        } else {
            // Ocultar sidebar
            if (sidebar) sidebar.style.display = 'none';
            if (pageContent) pageContent.classList.add('full-width');
            if (menuToggle) menuToggle.style.display = 'none';
            if (navbarBrand) navbarBrand.classList.remove('ms-2');
        }

        console.log('Control de flotilla:', hasFlotilla);
        console.log('Control de servicios:', hasServicios);
        console.log('Mostrar sidebar:', hasAnyPermission);
    }

    // Manejar visibilidad de elementos específicos del menú
    handleMenuItemsVisibility() {
        const hasFlotilla = this.hasControlFlotilla();
        const hasServicios = this.hasControlServicios();

        // Elementos específicos para control de servicios únicamente
        const serviciosOnlyElements = [
            'a[href*="Mantenimientos"]',
            'a[href*="Seguros"]',
            'a[href*="Registro"]'

        ];

        // Elementos compartidos entre flotilla y servicios
        const sharedElements = [
            'a[href*="Vehiculos"]',
            'a[href*="Colaboradores"]',
            'a[href*="Asignaciones"]',
            'a[href*="Home"]',
            'a[href*="Reportes"]'
        ];

        // Mostrar elementos exclusivos de servicios
        serviciosOnlyElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = hasServicios ? 'block' : 'none';
            }
        });

        // Mostrar elementos compartidos (visibles si tiene flotilla O servicios)
        sharedElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = (hasFlotilla || hasServicios) ? 'block' : 'none';
            }
        });

        console.log('Control de flotilla:', hasFlotilla);
        console.log('Control de servicios:', hasServicios);
    }

    // Configurar interceptores de Axios
    setupAxiosInterceptors() {
        const token = this.getToken();

        if (window.axios) {
            // Interceptor para requests
            axios.interceptors.request.use(
                (config) => {
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                    return config;
                },
                (error) => {
                    return Promise.reject(error);
                }
            );

            // Interceptor para responses
            axios.interceptors.response.use(
                (response) => {
                    return response;
                },
                (error) => {
                    if (error.response && error.response.status === 401) {
                        this.logout();
                    }
                    return Promise.reject(error);
                }
            );
        }
    }

    // Logout
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.claimsKey);
        localStorage.removeItem('controlFlotilla');
        localStorage.removeItem('controlServicios');
        localStorage.removeItem('showSidebar');

        this.redirectToLogin();
    }

    // Redirigir a login
    redirectToLogin() {
        if (window.location.pathname !== '/Auth/Login') {
            window.location.href = '/Auth/Login';
        }
    }

    // Hacer petición autenticada
    async apiCall(endpoint, options = {}) {
        const token = this.getToken();

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;
            const response = await fetch(url, finalOptions);

            if (response.status === 401) {
                this.logout();
                throw new Error('Sesión expirada');
            }

            return response;
        } catch (error) {
            console.error('Error en API call:', error);
            throw error;
        }
    }
}

// Instancia global
const authManager = new AuthManager();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Solo inicializar si no estamos en la página de login
    if (!window.location.pathname.includes('/Auth/Login')) {
        authManager.initializeUI();
    }
});

// Manejar logout
document.addEventListener('click', function (e) {
    if (e.target.closest('a[href*="logout"], a[href*="Logout"], .logout-btn')) {
        e.preventDefault();
        authManager.logout();
    }
});