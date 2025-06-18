// ============================================
// CONFIGURACIÓN DE AXIOS Y API
// ============================================

const API_BASE_URL = 'https://localhost:44339';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para agregar token a las peticiones
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = '/Account/Login';
        }
        return Promise.reject(error);
    }
);

// ============================================
// GESTOR DE MODALES MEJORADO
// ============================================

class SimpleModalManager {
    static activeModals = new Set();

    // Mostrar modal
    static show(modalId, options = {}) {
        console.log(`Mostrando modal: ${modalId}`);

        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`Modal ${modalId} no encontrado`);
            return;
        }

        // Ocultar otros modales activos
        this.hideAll();

        // Crear y mostrar overlay personalizado
        this.createOverlay();

        // Mostrar modal con animación
        modalElement.style.display = 'flex';
        modalElement.classList.add('show');

        // Mostrar overlay
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }

        // Registrar modal activo
        this.activeModals.add(modalId);

        // Agregar event listeners para cerrar
        this.addCloseListeners(modalId);

        console.log(`Modal ${modalId} mostrado correctamente`);
    }

    // Ocultar modal específico
    static hide(modalId) {
        console.log(`Ocultando modal: ${modalId}`);

        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.warn(`Modal ${modalId} no encontrado`);
            return;
        }

        // Animar salida
        modalElement.classList.remove('show');

        setTimeout(() => {
            modalElement.style.display = 'none';
            this.activeModals.delete(modalId);

            // Si no hay más modales activos, limpiar
            if (this.activeModals.size === 0) {
                this.cleanup();
            }
        }, 300);

        console.log(`Modal ${modalId} ocultado`);
    }

    // Ocultar todos los modales
    static hideAll() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
            modal.style.display = 'none';
        });
        this.activeModals.clear();
        this.cleanup();
    }

    // Crear overlay personalizado
    static createOverlay() {
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'custom-modal-overlay';
            overlay.onclick = () => this.hideAll();
            document.body.appendChild(overlay);
        }
    }

    // Agregar listeners para cerrar modal
    static addCloseListeners(modalId) {
        const modalElement = document.getElementById(modalId);

        // Botones de cierre
        const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.hide(modalId);
            };
        });

        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Limpiar estado global
    static cleanup() {
        // Ocultar overlay
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }

        // Limpiar cualquier backdrop de Bootstrap
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });

        console.log('Cleanup de modales completado');
    }
}

// ============================================
// APLICACIÓN VUE DE COLABORADORES
// ============================================

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando aplicación de colaboradores...');

    // Instancia de Vue para el módulo de colaboradores (GLOBAL para acceso desde modales)
    window.colaboradoresApp = new Vue({
        el: '#colaboradores-app',

        // ============================================
        // DATOS REACTIVOS
        // ============================================
        data: {
            // Datos principales
            colaboradores: [],
            colaboradorDetalle: {},

            // Estados de carga
            cargando: false,
            guardando: false,
            editando: false,
            verificandoLicencia: {},

            // Filtros
            filtros: {
                activo: '',
                departamento: '',
                categoria: ''
            },

            // Formulario de colaborador
            colaboradorForm: {
                id: null,
                nombre: '',
                apellido: '',
                cedula: '',
                departamento: '',
                cargo: '',
                telefono: '',
                telefonoMovil: '',
                email: '',
                licenciaConducir: '',
                fechaVencimientoLicencia: '',
                direccionCompleta: '',
                numeroCarnet: '',
                categoria: 1,
                observaciones: '',
                activo: true
            },

            // Catálogos
            categoriasColaborador: [
                { value: 1, text: 'Conductor A' },
                { value: 2, text: 'Conductor B' },
                { value: 3, text: 'Conductor C' },
                { value: 4, text: 'Supervisor' },
                { value: 5, text: 'Administrador' },
                { value: 6, text: 'Técnico' },
                { value: 7, text: 'Auxiliar' },
                { value: 8, text: 'Otros' }
            ],

            departamentos: [
                { value: 'Recursos Humanos', text: 'Recursos Humanos' },
                { value: 'Administración', text: 'Administración' },
                { value: 'Operaciones', text: 'Operaciones' },
                { value: 'Logística', text: 'Logística' },
                { value: 'Mantenimiento', text: 'Mantenimiento' },
                { value: 'Seguridad', text: 'Seguridad' },
                { value: 'Finanzas', text: 'Finanzas' },
                { value: 'Tecnología', text: 'Tecnología' },
                { value: 'Legal', text: 'Legal' },
                { value: 'Otros', text: 'Otros' }
            ]
        },

        // ============================================
        // MÉTODOS
        // ============================================
        methods: {
            // ========== GESTIÓN DE MODALES ==========

            mostrarModalCrear() {
                console.log('=== MOSTRAR MODAL CREAR ===');
                this.editando = false;
                this.limpiarFormulario();
                SimpleModalManager.show('addCollaboratorModal');
            },

            mostrarModalEditar(colaborador) {
                console.log('=== MOSTRAR MODAL EDITAR ===');
                console.log('Editando colaborador:', colaborador);
                this.editando = true;

                // Mapear correctamente los campos del colaborador
                this.colaboradorForm = {
                    id: colaborador.id,
                    nombre: colaborador.nombre || '',
                    apellido: colaborador.apellido || '',
                    cedula: colaborador.cedula || '',
                    departamento: colaborador.departamento || '',
                    cargo: colaborador.cargo || '',
                    telefono: colaborador.telefono || '',
                    telefonoMovil: colaborador.telefonoMovil || '',
                    email: colaborador.email || '',
                    licenciaConducir: colaborador.licenciaConducir || '',
                    fechaVencimientoLicencia: colaborador.fechaVencimientoLicencia ? colaborador.fechaVencimientoLicencia.split('T')[0] : '',
                    direccionCompleta: colaborador.direccionCompleta || '',
                    numeroCarnet: colaborador.numeroCarnet || '',
                    categoria: colaborador.categoria || 1,
                    observaciones: colaborador.observaciones || '',
                    activo: colaborador.activo !== undefined ? colaborador.activo : true
                };

                SimpleModalManager.show('addCollaboratorModal');
            },

            async mostrarDetalles(colaborador) {
                console.log('=== MOSTRAR DETALLES ===');
                console.log('Mostrando detalles de colaborador:', colaborador);
                try {
                    // Cargar detalles completos del colaborador
                    const response = await apiClient.get(`/api/Colaboradores/${colaborador.id}`);
                    this.colaboradorDetalle = response.data;
                    console.log('Detalles cargados:', this.colaboradorDetalle);

                    SimpleModalManager.show('collaboratorDetailsModal');

                } catch (error) {
                    console.error('Error al cargar detalles del colaborador:', error);
                    this.mostrarError('Error al cargar los detalles del colaborador');
                }
            },

            cerrarModal(modalId) {
                console.log('=== CERRAR MODAL ===', modalId);
                SimpleModalManager.hide(modalId);
            },

            // ========== VERIFICACIÓN DE LICENCIAS ==========

            async verificarLicenciaColaborador(colaboradorId) {
                // Marcar como verificando
                this.$set(this.verificandoLicencia, colaboradorId, true);

                try {
                    const response = await apiClient.get(`/api/Colaboradores/ValidarLicencia/${colaboradorId}`);
                    const licenciaValida = response.data;

                    // Obtener detalles del colaborador para mostrar información completa
                    const colaboradorResponse = await apiClient.get(`/api/Colaboradores/${colaboradorId}`);
                    const colaborador = colaboradorResponse.data;

                    // Mostrar información de la licencia
                    this.mostrarInfoLicencia(colaborador, licenciaValida);

                    return licenciaValida;
                } catch (error) {
                    console.error('Error al verificar licencia:', error);
                    this.mostrarError('Error al verificar la licencia del colaborador');
                    return null;
                } finally {
                    // Quitar estado de verificando
                    this.$set(this.verificandoLicencia, colaboradorId, false);
                }
            },

            mostrarInfoLicencia(colaborador, licenciaValida) {
                let titulo = `Estado de Licencia - ${colaborador.nombre} ${colaborador.apellido}`;
                let mensaje = '';
                let tipo = 'info';

                if (colaborador.licenciaConducir && colaborador.fechaVencimientoLicencia) {
                    const fechaVencimiento = new Date(colaborador.fechaVencimientoLicencia);
                    const hoy = new Date();
                    const diasParaVencimiento = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                    if (licenciaValida) {
                        tipo = 'success';
                        mensaje = `✅ LICENCIA VIGENTE\n\n`;
                        mensaje += `Número: ${colaborador.licenciaConducir}\n`;
                        mensaje += `Vencimiento: ${this.formatearFecha(colaborador.fechaVencimientoLicencia)}\n`;

                        if (diasParaVencimiento <= 30) {
                            mensaje += `\n⚠ ATENCIÓN: Vence en ${diasParaVencimiento} días`;
                            tipo = 'warning';
                        }
                    } else {
                        tipo = 'error';
                        mensaje = `❌ LICENCIA VENCIDA\n\n`;
                        mensaje += `Número: ${colaborador.licenciaConducir}\n`;
                        mensaje += `Venció: ${this.formatearFecha(colaborador.fechaVencimientoLicencia)}\n`;
                        mensaje += `Días vencida: ${Math.abs(diasParaVencimiento)}`;
                    }
                } else {
                    tipo = 'error';
                    mensaje = `❌ SIN LICENCIA\n\nEste colaborador no tiene licencia de conducir registrada.`;
                }

                // Usar notificación mejorada
                this.mostrarNotificacionLicencia(titulo, mensaje, tipo);
            },

            mostrarNotificacionLicencia(titulo, mensaje, tipo = 'info') {
                const modalId = 'modal-licencia-info';
                let modal = document.getElementById(modalId);

                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = modalId;
                    modal.className = 'modal fade';
                    modal.innerHTML = `
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content">
                                <div class="modal-header ${this.obtenerClaseHeader(tipo)}">
                                    <h5 class="modal-title">${titulo}</h5>
                                    <button type="button" class="btn-close btn-close-white" onclick="SimpleModalManager.hide('${modalId}')"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="alert ${this.obtenerClaseAlerta(tipo)} mb-0">
                                        <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${mensaje}</pre>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" onclick="SimpleModalManager.hide('${modalId}')">
                                        <i class="fas fa-times me-1"></i> Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                } else {
                    // Actualizar contenido del modal existente
                    modal.querySelector('.modal-title').textContent = titulo;
                    modal.querySelector('.modal-header').className = `modal-header ${this.obtenerClaseHeader(tipo)}`;
                    modal.querySelector('.alert').className = `alert ${this.obtenerClaseAlerta(tipo)} mb-0`;
                    modal.querySelector('pre').textContent = mensaje;
                }

                SimpleModalManager.show(modalId);
            },

            obtenerClaseHeader(tipo) {
                const clases = {
                    success: 'bg-success text-white',
                    error: 'bg-danger text-white',
                    warning: 'bg-warning text-dark',
                    info: 'bg-primary text-white'
                };
                return clases[tipo] || clases.info;
            },

            obtenerClaseAlerta(tipo) {
                const clases = {
                    success: 'alert-success',
                    error: 'alert-danger',
                    warning: 'alert-warning',
                    info: 'alert-info'
                };
                return clases[tipo] || clases.info;
            },

            // ========== GESTIÓN DE COLABORADORES ==========

            async cargarColaboradores() {
                this.cargando = true;
                try {
                    console.log(`Cargando colaboradores desde: ${API_BASE_URL}/api/Colaboradores`);

                    const response = await apiClient.get('/api/Colaboradores');
                    this.colaboradores = response.data;

                    console.log('Colaboradores cargados:', this.colaboradores.length);

                    // Debug para ver la estructura de los datos
                    if (this.colaboradores.length > 0) {
                        console.log('Primer colaborador:', this.colaboradores[0]);
                    }
                } catch (error) {
                    console.error('Error al cargar colaboradores:', error);
                    this.mostrarError('Error al cargar los colaboradores');
                } finally {
                    this.cargando = false;
                }
            },

            async filtrarColaboradores() {
                console.log('=== FILTRAR COLABORADORES ===');
                console.log('Filtros actuales:', this.filtros);

                this.cargando = true;
                try {
                    let url = '/api/Colaboradores';

                    // Si hay filtro de activos solamente
                    if (this.filtros.activo === 'true' && !this.filtros.departamento && !this.filtros.categoria) {
                        url = '/api/Colaboradores/Activos';
                    }

                    const response = await apiClient.get(url);
                    let colaboradores = response.data;

                    console.log('Colaboradores antes de filtrar:', colaboradores.length);

                    // Aplicar filtros adicionales en el frontend si es necesario
                    if (this.filtros.departamento) {
                        console.log('Filtrando por departamento:', this.filtros.departamento);
                        colaboradores = colaboradores.filter(c => {
                            const coincide = c.departamento && c.departamento.toLowerCase() === this.filtros.departamento.toLowerCase();
                            if (coincide) {
                                console.log(`Colaborador ${c.nombre} ${c.apellido} - Departamento: ${c.departamento} coincide`);
                            }
                            return coincide;
                        });
                    }

                    if (this.filtros.categoria) {
                        colaboradores = colaboradores.filter(c =>
                            c.categoria === parseInt(this.filtros.categoria)
                        );
                    }

                    if (this.filtros.activo && this.filtros.activo !== 'true') {
                        const esActivo = this.filtros.activo === 'true';
                        colaboradores = colaboradores.filter(c => c.activo === esActivo);
                    }

                    console.log('Colaboradores después de filtrar:', colaboradores.length);
                    this.colaboradores = colaboradores;

                } catch (error) {
                    console.error('Error al filtrar colaboradores:', error);
                    this.mostrarError('Error al filtrar los colaboradores');
                } finally {
                    this.cargando = false;
                }
            },

            async guardarColaborador() {
                this.guardando = true;
                try {
                    // Preparar datos del colaborador
                    const colaboradorData = {
                        nombre: this.colaboradorForm.nombre,
                        apellido: this.colaboradorForm.apellido,
                        cedula: this.colaboradorForm.cedula,
                        departamento: this.colaboradorForm.departamento,
                        cargo: this.colaboradorForm.cargo,
                        telefono: this.colaboradorForm.telefono || null,
                        telefonoMovil: this.colaboradorForm.telefonoMovil || null,
                        email: this.colaboradorForm.email || null,
                        licenciaConducir: this.colaboradorForm.licenciaConducir || null,
                        fechaVencimientoLicencia: this.colaboradorForm.fechaVencimientoLicencia || null,
                        direccionCompleta: this.colaboradorForm.direccionCompleta || null,
                        numeroCarnet: this.colaboradorForm.numeroCarnet || null,
                        categoria: parseInt(this.colaboradorForm.categoria),
                        observaciones: this.colaboradorForm.observaciones || null,
                        activo: this.colaboradorForm.activo
                    };

                    if (this.editando && this.colaboradorForm.id) {
                        // MODO EDICIÓN
                        console.log(`Actualizando colaborador ID: ${this.colaboradorForm.id}`);

                        const response = await apiClient.put(`/api/Colaboradores/${this.colaboradorForm.id}`, colaboradorData);

                        this.mostrarExito('Colaborador actualizado exitosamente');
                    } else {
                        // MODO CREACIÓN
                        console.log('Creando nuevo colaborador');

                        const response = await apiClient.post('/api/Colaboradores', colaboradorData);

                        this.mostrarExito('Colaborador creado exitosamente');
                    }

                    // Cerrar modal y recargar lista
                    this.cerrarModal('addCollaboratorModal');
                    await this.cargarColaboradores();

                } catch (error) {
                    console.error('Error al guardar colaborador:', error);
                    console.error('Respuesta del servidor:', error.response?.data);

                    if (error.response?.data) {
                        // Si el servidor devuelve errores de validación
                        if (typeof error.response.data === 'object' && error.response.data.errors) {
                            const errores = Object.values(error.response.data.errors).flat().join(', ');
                            this.mostrarError(`Errores de validación: ${errores}`);
                        } else if (typeof error.response.data === 'string') {
                            this.mostrarError(`Error: ${error.response.data}`);
                        } else {
                            this.mostrarError('Error de validación en el servidor');
                        }
                    } else {
                        this.mostrarError('Error al guardar el colaborador');
                    }
                } finally {
                    this.guardando = false;
                }
            },

            async eliminarColaborador(colaboradorId) {
                if (!confirm('¿Está seguro de que desea eliminar este colaborador?')) {
                    return;
                }

                try {
                    await apiClient.delete(`/api/Colaboradores/${colaboradorId}`);
                    this.mostrarExito('Colaborador eliminado exitosamente');
                    await this.cargarColaboradores();
                } catch (error) {
                    console.error('Error al eliminar colaborador:', error);
                    this.mostrarError('Error al eliminar el colaborador');
                }
            },

            async desactivarColaborador(colaboradorId) {
                if (!confirm('¿Está seguro de que desea desactivar este colaborador?')) {
                    return;
                }

                try {
                    await apiClient.patch(`/api/Colaboradores/${colaboradorId}/Desactivar`);
                    this.mostrarExito('Colaborador desactivado exitosamente');
                    await this.cargarColaboradores();
                } catch (error) {
                    console.error('Error al desactivar colaborador:', error);
                    this.mostrarError('Error al desactivar el colaborador');
                }
            },

            async reactivarColaborador(colaboradorId) {
                if (!confirm('¿Está seguro de que desea reactivar este colaborador?')) {
                    return;
                }

                try {
                    await apiClient.patch(`/api/Colaboradores/${colaboradorId}/Reactivar`);
                    this.mostrarExito('Colaborador reactivado exitosamente');
                    await this.cargarColaboradores();
                } catch (error) {
                    console.error('Error al reactivar colaborador:', error);
                    this.mostrarError('Error al reactivar el colaborador');
                }
            },

            // ========== UTILIDADES GENERALES ==========

            limpiarFormulario() {
                this.colaboradorForm = {
                    id: null,
                    nombre: '',
                    apellido: '',
                    cedula: '',
                    departamento: '',
                    cargo: '',
                    telefono: '',
                    telefonoMovil: '',
                    email: '',
                    licenciaConducir: '',
                    fechaVencimientoLicencia: '',
                    direccionCompleta: '',
                    numeroCarnet: '',
                    categoria: 1,
                    observaciones: '',
                    activo: true
                };
                this.colaboradorDetalle = {};
            },

            obtenerTextoCategoria(categoriaId) {
                if (!categoriaId && categoriaId !== 0) {
                    return 'Sin especificar';
                }
                const categoria = this.categoriasColaborador.find(c => c.value === parseInt(categoriaId));
                return categoria ? categoria.text : `Categoría ${categoriaId}`;
            },

            estadoClass(activo) {
                return activo ? 'badge bg-success' : 'badge bg-danger';
            },

            estadoTexto(activo) {
                return activo ? 'Activo' : 'Inactivo';
            },

            formatearFecha(fecha) {
                if (!fecha) return 'No especificada';
                try {
                    return new Date(fecha).toLocaleDateString('es-DO');
                } catch (error) {
                    return 'Fecha inválida';
                }
            },

            validarLicenciaVencimiento(fecha) {
                if (!fecha) return 'neutral';

                const fechaVencimiento = new Date(fecha);
                const hoy = new Date();
                const diasParaVencimiento = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                if (diasParaVencimiento < 0) {
                    return 'vencida'; // Rojo
                } else if (diasParaVencimiento <= 30) {
                    return 'por-vencer'; // Amarillo
                } else {
                    return 'vigente'; // Verde
                }
            },

            obtenerClasseLicencia(fecha) {
                const estado = this.validarLicenciaVencimiento(fecha);
                const clases = {
                    'vencida': 'text-danger',
                    'por-vencer': 'text-warning',
                    'vigente': 'text-success',
                    'neutral': 'text-muted'
                };
                return clases[estado] || 'text-muted';
            },

            obtenerIconoLicencia(fecha) {
                const estado = this.validarLicenciaVencimiento(fecha);
                const iconos = {
                    'vencida': 'fas fa-times-circle',
                    'por-vencer': 'fas fa-exclamation-triangle',
                    'vigente': 'fas fa-check-circle',
                    'neutral': 'fas fa-question-circle'
                };
                return iconos[estado] || 'fas fa-question-circle';
            },

            textoDepartamento(departamento) {
                if (!departamento) return 'Sin departamento';

                const departamentos = {
                    'ministerio': 'Ministerio de Agricultura',
                    'salud': 'Ministerio de Salud',
                    'policia': 'Policía Nacional',
                    'defensa': 'Ministerio de Defensa'
                };

                return departamentos[departamento] || departamento;
            },

            formatearFecha(fecha) {
                if (!fecha) return 'No especificada';
                try {
                    return new Date(fecha).toLocaleDateString('es-DO');
                } catch (error) {
                    return 'Fecha inválida';
                }
            },

            // ========== SISTEMA DE NOTIFICACIONES ==========

            mostrarError(mensaje) {
                this.mostrarNotificacion(mensaje, 'error');
            },

            mostrarExito(mensaje) {
                this.mostrarNotificacion(mensaje, 'success');
            },

            mostrarNotificacion(mensaje, tipo = 'info') {
                // Crear contenedor de notificaciones si no existe
                let container = document.getElementById('notification-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'notification-container';
                    container.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 9999;
                        max-width: 400px;
                    `;
                    document.body.appendChild(container);
                }

                // Crear notificación
                const notification = document.createElement('div');
                const iconos = {
                    success: '✓',
                    error: '✗',
                    info: 'ℹ'
                };
                const colores = {
                    success: '#6bbd4a',
                    error: '#e74c3c',
                    info: '#3a9bd9'
                };

                notification.style.cssText = `
                    background: white;
                    border-left: 4px solid ${colores[tipo]};
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    padding: 1rem;
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: center;
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                `;

                notification.innerHTML = `
                    <span style="color: ${colores[tipo]}; font-weight: bold; margin-right: 10px; font-size: 1.2rem;">
                        ${iconos[tipo]}
                    </span>
                    <span style="color: #2d3748;">${mensaje}</span>
                `;

                container.appendChild(notification);

                // Animar entrada
                setTimeout(() => {
                    notification.style.transform = 'translateX(0)';
                }, 100);

                // Auto-eliminar después de 4 segundos
                setTimeout(() => {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 4000);

                // Permitir cerrar al hacer clic
                notification.addEventListener('click', () => {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                });
            }
        },

        // ============================================
        // CICLO DE VIDA DEL COMPONENTE
        // ============================================

        async mounted() {
            console.log('Vue mounted - Iniciando aplicación de colaboradores...');

            // Verificar autenticación
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('No hay token, redirigiendo al login...');
                window.location.href = '/Account/Login';
                return;
            }

            console.log('Token encontrado, cargando colaboradores...');

            // Cargar colaboradores iniciales
            await this.cargarColaboradores();

            console.log('App inicializada correctamente');
        },

        beforeDestroy() {
            // Limpiar modales al salir
            SimpleModalManager.hideAll();
        },

        // ============================================
        // COMPUTED PROPERTIES
        // ============================================
        computed: {
            colaboradoresFiltrados() {
                let result = this.colaboradores;

                // Filtrar por estado activo/inactivo
                if (this.filtros.activo === 'true') {
                    result = result.filter(c => c.activo);
                } else if (this.filtros.activo === 'false') {
                    result = result.filter(c => !c.activo);
                }

                // Filtrar por departamento
                if (this.filtros.departamento) {
                    result = result.filter(c =>
                        c.departamento &&
                        c.departamento.toLowerCase().includes(this.filtros.departamento.toLowerCase())
                    );
                }

                // Filtrar por categoría
                if (this.filtros.categoria) {
                    result = result.filter(c => c.categoria === parseInt(this.filtros.categoria));
                }

                return result;
            },

            totalColaboradores() {
                return this.colaboradores.length;
            },

            totalActivos() {
                return this.colaboradores.filter(c => c.activo).length;
            },

            totalInactivos() {
                return this.colaboradores.filter(c => !c.activo).length;
            },

            // Computed para el formato de fecha actual
            hoy() {
                return new Date();
            }
        }
    });

    // Inicializar tooltips de Bootstrap
    $(function () {
        $('[data-bs-toggle="tooltip"]').tooltip();
    });

    console.log('Aplicación de colaboradores inicializada correctamente');
});