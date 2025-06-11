// Configuración de Axios para la API
const apiClient = axios.create({
    baseURL: 'https://localhost:7037', // Reemplaza PUERTO_DE_TU_API con el puerto real
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Instancia de Vue para el login
new Vue({
    el: '#app-login',
    data: {
        credentials: {
            email: '',
            password: ''
        },
        rememberMe: false,
        loading: false,
        error: '',
        success: ''
    },
    methods: {
        async login() {
            this.loading = true;
            this.error = '';
            this.success = '';

            try {
                // Validación básica
                if (!this.credentials.email || !this.credentials.password) {
                    this.error = 'Por favor complete todos los campos';
                    return;
                }

                console.log('Intentando login con URL:', 'https://localhost:7037/api/Auth/Login');
                console.log('Datos a enviar:', {
                    email: this.credentials.email,
                    password: '***' // No mostrar la contraseña real
                });

                // Llamada a la API de login
                const response = await apiClient.post('/api/Auth/Login', {
                    email: this.credentials.email,
                    password: this.credentials.password
                });

                // Login exitoso
                if (response.data) {
                    this.success = 'Inicio de sesión exitoso. Redirigiendo...';

                    // Guardar todos los datos de autenticación
                    this.saveAuthData(response.data);

                    // Recordar email si está marcado
                    if (this.rememberMe) {
                        localStorage.setItem('rememberedEmail', this.credentials.email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }

                    // Redirigir al Index del controlador Home
                    setTimeout(() => {
                        window.location.href = '/Home/Index';
                    }, 1000);
                }

            } catch (error) {
                console.error('Error en login:', error);

                if (error.response) {
                    // Error de respuesta del servidor
                    switch (error.response.status) {
                        case 400:
                            this.error = 'Datos de inicio de sesión inválidos';
                            break;
                        case 401:
                            this.error = error.response.data || 'Credenciales incorrectas';
                            break;
                        case 500:
                            this.error = 'Error interno del servidor. Intente nuevamente más tarde';
                            break;
                        default:
                            this.error = 'Error inesperado. Intente nuevamente';
                    }
                } else if (error.request) {
                    this.error = 'Error de conexión. Verifique su conexión a internet';
                } else {
                    this.error = 'Error inesperado. Intente nuevamente';
                }
            } finally {
                this.loading = false;
            }
        },

        // Guardar datos de autenticación
        saveAuthData(authResponse) {
            // Guardar token
            if (authResponse.token) {
                localStorage.setItem('authToken', authResponse.token);
            }

            // Guardar datos completos del usuario
            if (authResponse.user) {
                localStorage.setItem('userData', JSON.stringify(authResponse.user));
            }

            // Guardar permisos específicos para acceso rápido
            if (authResponse.user) {
                localStorage.setItem('controlFlotilla', authResponse.user.controlFlotilla.toString());
                localStorage.setItem('controlServicios', authResponse.user.controlServicios.toString());

                // Guardar información de qué mostrar
                const showSidebar = authResponse.user.controlFlotilla || authResponse.user.controlServicios;
                localStorage.setItem('showSidebar', showSidebar.toString());
            }

            // Decodificar token para guardar claims
            if (authResponse.token) {
                try {
                    const claims = this.parseJwt(authResponse.token);
                    localStorage.setItem('userClaims', JSON.stringify(claims));
                } catch (error) {
                    console.error('Error al decodificar token:', error);
                }
            }
        },

        // Decodificar JWT
        parseJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(jsonPayload);
            } catch (error) {
                console.error('Error al decodificar JWT:', error);
                return null;
            }
        },

        // Cargar email recordado si existe
        loadRememberedEmail() {
            const rememberedEmail = localStorage.getItem('rememberedEmail');
            if (rememberedEmail) {
                this.credentials.email = rememberedEmail;
                this.rememberMe = true;
            }
        }
    },

    // Ejecutar al cargar el componente
    mounted() {
        this.loadRememberedEmail();
    }
});