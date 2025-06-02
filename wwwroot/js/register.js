// wwwroot/js/register.js
new Vue({
    el: '#app-register',
    data: {
        user: {
            nombre: '',
            apellido: '',
            cargo: '',
            email: '',
            password: '',
            confirmPassword: ''
        },
        acceptTerms: false,
        loading: false,
        error: null,
        success: null
    },
    methods: {
        register() {
            this.loading = true;
            this.error = null;
            this.success = null;

            // Validación básica
            if (this.user.password !== this.user.confirmPassword) {
                this.error = 'Las contraseñas no coinciden';
                this.loading = false;
                return;
            }

            // Configuración Axios para la API
            axios.post('https://localhost:7037/api/Auth/register', {
                email: this.user.email,
                password: this.user.password,
                confirmPassword: this.user.confirmPassword,
                nombre: this.user.nombre,
                apellido: this.user.apellido,
                cargo: this.user.cargo
            })
                .then(response => {
                    this.loading = false;
                    this.success = 'Registro exitoso. Ahora puede iniciar sesión.';

                    // Redireccionar al login después de 2 segundos
                    setTimeout(() => {
                        window.location.href = '/Account/Login';
                    }, 2000);
                })
                .catch(err => {
                    this.loading = false;
                    if (err.response) {
                        // Manejar errores específicos
                        if (err.response.status === 400) {
                            if (err.response.data.errors) {
                                // Errores de validación
                                const errors = err.response.data.errors;
                                const firstError = Object.values(errors)[0][0];
                                this.error = firstError;
                            } else {
                                this.error = err.response.data.message || 'Error en el registro';
                            }
                        } else {
                            this.error = 'Error en el registro. Intente de nuevo.';
                        }
                    } else {
                        // Error de red o cliente
                        this.error = 'Error de conexión. Intente de nuevo más tarde.';
                        console.error(err);
                    }
                });
        }
    }
});