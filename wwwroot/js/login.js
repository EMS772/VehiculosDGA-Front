// TEST: Si ves esta alerta, significa que este archivo SÍ se está cargando
alert('ARCHIVO login.js CARGADO - Puerto configurado: 44339');

// Configuración de Axios para la API
const apiClient = axios.create({
    baseURL: 'https://localhost:44339', // TU PUERTO CORRECTO
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// TEST: Verificar en consola
console.log('=== VERIFICACIÓN DE CONFIGURACIÓN ===');
console.log('BaseURL configurada:', apiClient.defaults.baseURL);
console.log('Si ves 44339 arriba, la configuración es correcta');

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

                // FORZAR URL COMPLETA - IGNORAR CONFIGURACIÓN DE AXIOS
                const fullUrl = 'https://localhost:44339/api/Auth/Login';

                console.log('=== INTENTANDO LOGIN ===');
                console.log('URL FORZADA:', fullUrl);

                // USAR AXIOS DIRECTAMENTE SIN LA INSTANCIA apiClient
                const response = await axios({
                    method: 'post',
                    url: fullUrl,
                    data: {
                        email: this.credentials.email,
                        password: this.credentials.password
                    },
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Login exitoso
                if (response.data) {
                    this.success = 'Inicio de sesión exitoso. Redirigiendo...';

                    if (response.data.token) {
                        localStorage.setItem('authToken', response.data.token);
                    }

                    if (response.data.user) {
                        localStorage.setItem('userData', JSON.stringify(response.data.user));
                    }

                    if (this.rememberMe) {
                        localStorage.setItem('rememberedEmail', this.credentials.email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }

                    setTimeout(() => {
                        window.location.href = '/Home/Index';
                    }, 1000);
                }

            } catch (error) {
                console.error('=== ERROR DETALLADO ===');
                console.error('Error completo:', error);
                console.error('URL que falló:', error.config?.url || 'URL no disponible');
                console.error('Status:', error.response?.status || 'No status');

                if (error.response) {
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
                    this.error = 'Error de conexión. Verificar que API esté en puerto 44339';
                } else {
                    this.error = 'Error inesperado. Intente nuevamente';
                }
            } finally {
                this.loading = false;
            }
        },

        loadRememberedEmail() {
            const rememberedEmail = localStorage.getItem('rememberedEmail');
            if (rememberedEmail) {
                this.credentials.email = rememberedEmail;
                this.rememberMe = true;
            }
        }
    },

    mounted() {
        console.log('=== VUE MONTADO ===');
        this.loadRememberedEmail();
    }
});