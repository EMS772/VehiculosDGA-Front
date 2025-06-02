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

                    // Guardar token si viene en la respuesta
                    if (response.data.token) {
                        localStorage.setItem('authToken', response.data.token);
                    }

                    // Guardar datos del usuario si vienen en la respuesta
                    if (response.data.user) {
                        localStorage.setItem('userData', JSON.stringify(response.data.user));
                    }

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