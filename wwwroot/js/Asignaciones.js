// ============================================
// CONFIGURACIÓN DE AXIOS Y API
// ============================================

const API_BASE_URL = 'https://localhost:7037';

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

    static show(modalId, options = {}) {
        console.log(`Mostrando modal: ${modalId}`);

        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`Modal ${modalId} no encontrado`);
            return;
        }

        this.hideAll();
        this.createOverlay();

        modalElement.style.display = 'flex';
        modalElement.classList.add('show');

        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }

        this.activeModals.add(modalId);
        this.addCloseListeners(modalId);

        console.log(`Modal ${modalId} mostrado correctamente`);
    }

    static hide(modalId) {
        console.log(`Ocultando modal: ${modalId}`);

        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.warn(`Modal ${modalId} no encontrado`);
            return;
        }

        modalElement.classList.remove('show');

        setTimeout(() => {
            modalElement.style.display = 'none';
            this.activeModals.delete(modalId);

            if (this.activeModals.size === 0) {
                this.cleanup();
            }
        }, 300);

        console.log(`Modal ${modalId} ocultado`);
    }

    static hideAll() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
            modal.style.display = 'none';
        });
        this.activeModals.clear();
        this.cleanup();
    }

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

    static addCloseListeners(modalId) {
        const modalElement = document.getElementById(modalId);

        const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.hide(modalId);
            };
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    static cleanup() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });

        console.log('Cleanup de modales completado');
    }
}

// ============================================
// APLICACIÓN VUE DE ASIGNACIONES
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando aplicación de asignaciones...');

    window.asignacionesApp = new Vue({
        el: '#asignaciones-app',

        data: {
            // Datos principales
            asignaciones: [],
            asignacionDetalle: {},
            documentos: [],
            plantillas: [],

            // Estados de carga
            cargando: false,
            cargandoDetalle: false,
            guardando: false,
            subiendoDocumento: false,
            editando: false,
            procesandoDevolucion: false,

            // Filtros
            filtros: {
                estado: '',
                tipoAsignacion: '',
                fechadesde: '',
                fehcaHasta: ''
            },

            // Formulario de asignación
            asignacionForm: {
                id: null,
                vehiculoId: null,
                colaboradorId: null,
                fechaAsignacion: new Date().toISOString().split('T')[0],
                kilometrajeInicial: 0,
                fechaEstimadaDevolucion: null,
                proposito: '',
                observaciones: '',
                numeroOficio: '',
                tipoAsignacion: 1,
                institucionAsignada: '',
                departamentoAsignado: '',
                responsableInstitucion: '',
                cargoResponsable: '',
                tipoExpediente: 1,
                observacionesExpediente: '',
                generarPlantilla: false
            },

            // Formulario de devolución
            devolucionForm: {
                fechaDevolucion: new Date().toISOString().split('T')[0],
                kilometrajeFinal: 0,
                estadoDevolucion: 'Bueno',
                observaciones: ''
            },

            // Subida de documentos
            documentoUpload: {
                archivo: null,
                descripcion: ''
            },

            // Archivos seleccionados
            documentosSeleccionados: [],

            // Catálogos
            tiposAsignacion: [
                { value: 1, text: 'Personal' },
                { value: 2, text: 'Institucional' },
                { value: 3, text: 'Departamental' }
            ],
            tiposExpediente: [
                { value: 1, text: 'Digital' },
                { value: 2, text: 'Físico' }
            ],
            estadosAsignacion: [
                { value: 1, text: 'Activa' },
                { value: 2, text: 'Completada' },
                { value: 3, text: 'Cancelada' }
            ],
            estadosDevolucion: [
                { value: 'Excelente', text: 'Excelente' },
                { value: 'Bueno', text: 'Bueno' },
                { value: 'Regular', text: 'Regular' },
                { value: 'Malo', text: 'Malo' }
            ],
            estadosExpediente: [
                { value: 1, text: 'En Proceso' },
                { value: 2, text: 'Pendiente' },
                { value: 3, text: 'Aprobado' },
                { value: 4, text: 'Rechazado' }
            ],

            // Listas para selects
            vehiculosDisponibles: [],
            colaboradoresDisponibles: []
        },

        methods: {
            // ========== GESTIÓN DE MODALES ==========

            async mostrarModalCrear() {
                console.log('=== MOSTRAR MODAL CREAR ===');
                this.editando = false;
                this.limpiarFormulario();

                try {
                    await this.cargarVehiculosDisponibles();
                    await this.cargarColaboradoresDisponibles();
                    SimpleModalManager.show('nuevaAsignacionModal');
                } catch (error) {
                    console.error('Error al cargar datos para el modal:', error);
                    this.mostrarError('Error al cargar los datos necesarios');
                }
            },

            async mostrarModalEditar(asignacion) {
                console.log('=== MOSTRAR MODAL EDITAR ===');
                this.editando = true;
                try {
                    // Cargar detalles completos
                    const response = await apiClient.get(`/api/Asignaciones/${asignacion.id}`);
                    this.asignacionDetalle = response.data;
                    console.log('Datos originales de la asignación:', this.asignacionDetalle);

                    // IMPORTANTE: Imprimir los datos del vehículo que vienen con la asignación
                    console.log('Datos de vehículo en asignacion original:', asignacion.vehiculo);
                    console.log('ID del vehículo:', asignacion.vehiculoId);

                    // IMPORTANTE: Usar los datos de vehículo y colaborador de la asignación original
                    // ya que esos datos ya fueron cargados en la tabla
                    if (asignacion.vehiculo && asignacion.vehiculo.marca) {
                        console.log('Asignando vehículo desde asignacion original:', asignacion.vehiculo);
                        this.asignacionDetalle.vehiculo = { ...asignacion.vehiculo };
                    } else {
                        // Si no hay datos en la asignación original, cargarlos explícitamente
                        try {
                            console.log('Cargando vehículo desde API con ID:', this.asignacionDetalle.vehiculoId);
                            const vehiculoResponse = await apiClient.get(`/api/Vehiculos/${this.asignacionDetalle.vehiculoId}`);
                            console.log('Respuesta del vehículo desde API:', vehiculoResponse);

                            if (vehiculoResponse.data) {
                                this.asignacionDetalle.vehiculo = vehiculoResponse.data;
                                console.log('Vehículo cargado desde API:', this.asignacionDetalle.vehiculo);
                            } else {
                                console.warn('La API devolvió datos vacíos para el vehículo');
                            }
                        } catch (vehiculoError) {
                            console.error('Error al cargar vehículo:', vehiculoError);

                            // Si hay un error, crear un objeto básico
                            this.asignacionDetalle.vehiculo = {
                                id: this.asignacionDetalle.vehiculoId,
                                marca: 'No disponible',
                                modelo: 'No disponible'
                            };
                            console.log('Creado objeto vehiculo básico:', this.asignacionDetalle.vehiculo);
                        }
                    }

                    // Verificar si los datos del vehículo ahora están disponibles
                    console.log('Datos finales del vehículo:', this.asignacionDetalle.vehiculo);

                    // Código para el colaborador (ya funciona correctamente)
                    if (asignacion.colaborador) {
                        this.asignacionDetalle.colaborador = asignacion.colaborador;
                        console.log('Usando datos de colaborador de la tabla:', this.asignacionDetalle.colaborador);
                    } else {
                        try {
                            const colaboradorResponse = await apiClient.get(`/api/Colaboradores/${this.asignacionDetalle.colaboradorId}`);
                            this.asignacionDetalle.colaborador = colaboradorResponse.data;
                            console.log('Datos del colaborador cargados:', this.asignacionDetalle.colaborador);
                        } catch (colaboradorError) {
                            console.error('Error al cargar colaborador:', colaboradorError);
                        }
                    }

                    // Cargar vehículos y colaboradores para los selects
                    await this.cargarVehiculosDisponibles();
                    await this.cargarColaboradoresDisponibles();

                    // Preparar formulario con datos de la asignación
                    this.asignacionForm = {
                        id: this.asignacionDetalle.id,
                        vehiculoId: this.asignacionDetalle.vehiculoId,
                        colaboradorId: this.asignacionDetalle.colaboradorId,
                        fechaAsignacion: this.asignacionDetalle.fechaAsignacion ? this.asignacionDetalle.fechaAsignacion.split('T')[0] : '',
                        fechaEstimadaDevolucion: this.asignacionDetalle.fechaEstimadaDevolucion ? this.asignacionDetalle.fechaEstimadaDevolucion.split('T')[0] : null,
                        proposito: this.asignacionDetalle.proposito || '',
                        observaciones: this.asignacionDetalle.observaciones || '',
                        numeroOficio: this.asignacionDetalle.numeroOficio || '',
                        tipoAsignacion: this.asignacionDetalle.tipoAsignacion || 1,
                        institucionAsignada: this.asignacionDetalle.institucionAsignada || '',
                        departamentoAsignado: this.asignacionDetalle.departamentoAsignado || '',
                        responsableInstitucion: this.asignacionDetalle.responsableInstitucion || '',
                        cargoResponsable: this.asignacionDetalle.cargoResponsable || '',
                        tipoExpediente: this.asignacionDetalle.tipoExpediente || 1,
                        observacionesExpediente: this.asignacionDetalle.observacionesExpediente || '',
                        kilometrajeInicial: this.asignacionDetalle.kilometrajeInicial || 0,
                        generarPlantilla: false
                    };

                    SimpleModalManager.show('editarAsignacionModal');
                } catch (error) {
                    console.error('Error al preparar el modal de edición:', error);
                    this.mostrarError('Error al cargar los datos de la asignación');
                }
            },

            async mostrarDetalles(asignacion) {
                console.log('=== MOSTRAR DETALLES ===');
                console.log('Asignación recibida:', asignacion);

                try {
                    this.cargandoDetalle = true;

                    // Cargar los detalles de la asignación
                    const response = await apiClient.get(`/api/Asignaciones/${asignacion.id}`);
                    console.log('DATOS COMPLETOS DE LA ASIGNACIÓN:', response.data);

                    // Verificar si ya tenemos los datos del colaborador en la asignación original
                    if (asignacion.colaborador && asignacion.colaborador.nombre) {
                        console.log('USANDO DATOS DE COLABORADOR YA CARGADOS:', asignacion.colaborador);
                        response.data.colaborador = asignacion.colaborador;
                    }
                    // Si no, intentar cargar el colaborador desde la API
                    else if (response.data.colaboradorId) {
                        console.log('ID DEL COLABORADOR:', response.data.colaboradorId);
                        console.log('NOMBRE DEL COLABORADOR (si existe):', response.data.colaboradorNombre);

                        try {
                            // Solicitud a la API para obtener datos del colaborador
                            const colaboradorResponse = await apiClient.get(`/api/Colaboradores/${response.data.colaboradorId}`);
                            console.log('RESPUESTA COMPLETA DEL COLABORADOR:', colaboradorResponse);
                            console.log('DATOS DEL COLABORADOR:', colaboradorResponse.data);

                            // Verificar si la respuesta contiene datos útiles
                            if (colaboradorResponse.data) {
                                response.data.colaborador = colaboradorResponse.data;
                                console.log('COLABORADOR ASIGNADO:', response.data.colaborador);
                            } else {
                                console.warn('LA API DEVOLVIÓ DATOS VACÍOS PARA EL COLABORADOR');

                                // Crear un objeto colaborador con datos de respaldo
                                response.data.colaborador = {
                                    id: response.data.colaboradorId,
                                    nombre: response.data.colaboradorNombre || 'N/A',
                                    apellido: '',
                                    departamento: 'No disponible',
                                    cargo: 'No disponible',
                                    cedula: 'No disponible'
                                };
                            }
                        } catch (colaboradorError) {
                            console.error('ERROR AL CARGAR COLABORADOR:', colaboradorError);

                            // Crear un objeto colaborador con los datos disponibles
                            response.data.colaborador = {
                                id: response.data.colaboradorId,
                                nombre: response.data.colaboradorNombre || 'N/A',
                                apellido: '',
                                departamento: 'No disponible',
                                cargo: 'No disponible',
                                cedula: 'No disponible'
                            };

                            console.log('OBJETO COLABORADOR CREADO TRAS ERROR:', response.data.colaborador);
                        }
                    } else {
                        console.warn('NO HAY ID DE COLABORADOR EN LA ASIGNACIÓN');

                        // Crear un objeto colaborador vacío
                        response.data.colaborador = {
                            nombre: 'No asignado',
                            apellido: '',
                            departamento: 'No aplicable',
                            cargo: 'No aplicable',
                            cedula: 'No aplicable'
                        };
                    }

                    this.asignacionDetalle = response.data;
                    console.log('ASIGNACION DETALLE FINAL:', this.asignacionDetalle);
                    console.log('COLABORADOR FINAL:', this.asignacionDetalle.colaborador);

                    this.documentos = this.asignacionDetalle.documentos || [];
                    this.plantillas = this.asignacionDetalle.plantillasGeneradas || [];

                    SimpleModalManager.show('asignacionDetailsModal');
                } catch (error) {
                    console.error('Error al cargar detalles de la asignación:', error);
                    this.mostrarError('Error al cargar los detalles de la asignación');
                } finally {
                    this.cargandoDetalle = false;
                }
            },

            mostrarModalDevolucion(asignacion) {
                console.log('=== MOSTRAR MODAL DEVOLUCIÓN ===');
                this.asignacionDetalle = asignacion;
                this.devolucionForm = {
                    fechaDevolucion: new Date().toISOString().split('T')[0],
                    kilometrajeFinal: asignacion.kilometrajeInicial || 0,
                    estadoDevolucion: 'Bueno',
                    observaciones: ''
                };
                SimpleModalManager.show('devolucionModal');
            },

            cerrarModal(modalId) {
                console.log('=== CERRAR MODAL ===', modalId);
                SimpleModalManager.hide(modalId);
            },

            // ========== GESTIÓN DE ASIGNACIONES ==========

            async cargarAsignaciones() {
                this.cargando = true;
                try {
                    console.log('Cargando asignaciones...');
                    const response = await apiClient.get('/api/Asignaciones');
                    const asignacionesData = response.data;
                    console.log('Asignaciones cargadas:', asignacionesData.length);

                    // Cargar detalles de vehículos y colaboradores para cada asignación
                    for (const asignacion of asignacionesData) {
                        try {
                            // Cargar detalles del vehículo
                            const vehiculoResponse = await apiClient.get(`/api/Vehiculos/${asignacion.vehiculoId}`);
                            asignacion.vehiculo = vehiculoResponse.data;

                            // Cargar detalles del colaborador
                            const colaboradorResponse = await apiClient.get(`/api/Colaboradores/${asignacion.colaboradorId}`);
                            asignacion.colaborador = colaboradorResponse.data;
                        } catch (detailError) {
                            console.error(`Error al cargar detalles para asignación ${asignacion.id}:`, detailError);
                        }
                    }

                    // Asignar las asignaciones con todos los detalles al array principal
                    this.asignaciones = asignacionesData;
                    console.log('Asignaciones procesadas con detalles:', this.asignaciones);
                } catch (error) {
                    console.error('Error al cargar asignaciones:', error);
                    this.mostrarError('Error al cargar las asignaciones');
                } finally {
                    this.cargando = false;
                }
            },

            async filtrarAsignaciones() {
                console.log('Aplicando filtros:', this.filtros);
                this.cargando = true;

                try {
                    // Construir parámetros de consulta basados en los filtros
                    const params = new URLSearchParams();

                    if (this.filtros.estado) {
                        params.append('estado', this.filtros.estado);
                    }

                    if (this.filtros.tipoAsignacion) {
                        params.append('tipoAsignacion', this.filtros.tipoAsignacion);
                    }

                    if (this.filtros.fechaDesde) {
                        // Asegurarse de que la fecha esté en el formato correcto (YYYY-MM-DD)
                        const fechaDesde = this.formatearFecha(this.filtros.fechaDesde, true);
                        params.append('fechaDesde', fechaDesde);
                    }

                    if (this.filtros.fechaHasta) {
                        // Asegurarse de que la fecha esté en el formato correcto (YYYY-MM-DD)
                        const fechaHasta = this.formatearFecha(this.filtros.fechaHasta, true);
                        params.append('fechaHasta', fechaHasta);
                    }

                    // Construir la URL con los parámetros (si hay alguno)
                    const url = params.toString()
                        ? `/api/Asignaciones?${params.toString()}`
                        : '/api/Asignaciones';

                    console.log('URL de consulta:', url);

                    // Realizar la petición con los filtros
                    const response = await apiClient.get(url);
                    console.log('Respuesta recibida, elementos:', response.data.length);

                    // Procesar los resultados (similar a cargarAsignaciones)
                    const asignacionesData = response.data;

                    // Cargar detalles adicionales (vehículo y colaborador)
                    for (const asignacion of asignacionesData) {
                        try {
                            // Cargar vehículo
                            const vehiculoResponse = await apiClient.get(`/api/Vehiculos/${asignacion.vehiculoId}`);
                            asignacion.vehiculo = vehiculoResponse.data;

                            // Cargar colaborador
                            const colaboradorResponse = await apiClient.get(`/api/Colaboradores/${asignacion.colaboradorId}`);
                            asignacion.colaborador = colaboradorResponse.data;
                        } catch (detailError) {
                            console.error(`Error al cargar detalles para asignación ${asignacion.id}:`, detailError);
                        }
                    }

                    // Actualizar las asignaciones en la vista
                    this.asignaciones = asignacionesData;

                    // Mostrar mensaje si no hay resultados
                    if (this.asignaciones.length === 0) {
                        console.log('No se encontraron asignaciones con los criterios seleccionados');
                    }
                } catch (error) {
                    console.error('Error al filtrar asignaciones:', error);

                    // Mostrar más detalles del error para depuración
                    if (error.response) {
                        console.log('Status:', error.response.status);
                        console.log('Data:', error.response.data);
                    }

                    this.mostrarError('Error al filtrar las asignaciones');
                    this.asignaciones = []; // Limpiar la lista en caso de error
                } finally {
                    this.cargando = false;
                }
            },

            async cargarVehiculosDisponibles() {
                try {
                    const response = await apiClient.get('/api/Vehiculos/estado/1'); // Solo disponibles
                    this.vehiculosDisponibles = response.data;

                    // Loguear para depuración
                    if (this.vehiculosDisponibles.length > 0) {
                        console.log('Ejemplo de vehículo cargado:', this.vehiculosDisponibles[0]);
                    }
                } catch (error) {
                    console.error('Error al cargar vehículos disponibles:', error);
                    this.vehiculosDisponibles = [];
                }
            },

            async cargarColaboradoresDisponibles() {
                try {
                    const response = await apiClient.get('/api/Colaboradores');
                    this.colaboradoresDisponibles = response.data;
                } catch (error) {
                    console.error('Error al cargar colaboradores:', error);
                    this.colaboradoresDisponibles = [];
                }
            },

            // ========== VALIDACIONES ==========
            validarFormulario() {
                const errores = [];

                if (!this.editando) {
                    if (!this.asignacionForm.vehiculoId) {
                        errores.push('Debe seleccionar un vehículo');
                    }

                    if (!this.asignacionForm.colaboradorId) {
                        errores.push('Debe seleccionar un colaborador');
                    }

                    if (!this.asignacionForm.fechaAsignacion) {
                        errores.push('Debe especificar la fecha de asignación');
                    }
                }

                if (!this.asignacionForm.proposito || this.asignacionForm.proposito.trim() === '') {
                    errores.push('Debe especificar el propósito de la asignación');
                }

                return errores;
            },

            async guardarAsignacion() {
                const errores = this.validarFormulario();
                if (errores.length > 0) {
                    this.mostrarError('Errores de validación: ' + errores.join(', '));
                    return;
                }

                this.guardando = true;
                try {
                    if (this.editando && this.asignacionForm.id) {
                        // Actualizar existente - solo campos editables
                        const asignacionDataPUT = {
                            fechaEstimadaDevolucion: this.asignacionForm.fechaEstimadaDevolucion || null,
                            proposito: this.asignacionForm.proposito,
                            observaciones: this.asignacionForm.observaciones || null,
                            numeroOficio: this.asignacionForm.numeroOficio || null,
                            institucionAsignada: this.asignacionForm.institucionAsignada || null,
                            departamentoAsignado: this.asignacionForm.departamentoAsignado || null,
                            responsableInstitucion: this.asignacionForm.responsableInstitucion || null,
                            cargoResponsable: this.asignacionForm.cargoResponsable || null,
                            observacionesExpediente: this.asignacionForm.observacionesExpediente || null
                        };

                        await apiClient.put(`/api/Asignaciones/${this.asignacionForm.id}`, asignacionDataPUT);
                        this.mostrarExito('Asignación actualizada correctamente');
                        this.cerrarModal('editarAsignacionModal');
                    } else {
                        // Crear nueva - usar FormData
                        const formData = new FormData();

                        // Agregar datos básicos
                        formData.append('vehiculoId', this.asignacionForm.vehiculoId);
                        formData.append('colaboradorId', this.asignacionForm.colaboradorId);
                        formData.append('fechaAsignacion', this.asignacionForm.fechaAsignacion);
                        formData.append('kilometrajeInicial', this.asignacionForm.kilometrajeInicial || 0);

                        if (this.asignacionForm.fechaEstimadaDevolucion) {
                            formData.append('fechaEstimadaDevolucion', this.asignacionForm.fechaEstimadaDevolucion);
                        }

                        formData.append('proposito', this.asignacionForm.proposito);

                        if (this.asignacionForm.observaciones) {
                            formData.append('observaciones', this.asignacionForm.observaciones);
                        }

                        formData.append('numeroOficio', this.asignacionForm.numeroOficio);
                        formData.append('tipoAsignacion', this.asignacionForm.tipoAsignacion);

                        if (this.asignacionForm.institucionAsignada) {
                            formData.append('institucionAsignada', this.asignacionForm.institucionAsignada);
                        }

                        if (this.asignacionForm.departamentoAsignado) {
                            formData.append('departamentoAsignado', this.asignacionForm.departamentoAsignado);
                        }

                        if (this.asignacionForm.responsableInstitucion) {
                            formData.append('responsableInstitucion', this.asignacionForm.responsableInstitucion);
                        }

                        if (this.asignacionForm.cargoResponsable) {
                            formData.append('cargoResponsable', this.asignacionForm.cargoResponsable);
                        }

                        formData.append('tipoExpediente', this.asignacionForm.tipoExpediente);

                        if (this.asignacionForm.observacionesExpediente) {
                            formData.append('observacionesExpediente', this.asignacionForm.observacionesExpediente);
                        }

                        formData.append('generarPlantilla', this.asignacionForm.generarPlantilla);

                        // Agregar documentos si hay
                        if (this.documentosSeleccionados && this.documentosSeleccionados.length > 0) {
                            this.documentosSeleccionados.forEach((doc) => {
                                formData.append('documentos', doc);
                            });
                        }

                        await apiClient.post('/api/Asignaciones', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });

                        this.mostrarExito('Asignación creada correctamente');
                        this.cerrarModal('nuevaAsignacionModal');
                    }

                    await this.cargarAsignaciones();
                } catch (error) {
                    console.error('Error al guardar asignación:', error);

                    if (error.response?.data) {
                        if (typeof error.response.data === 'object' && error.response.data.errors) {
                            const errores = Object.values(error.response.data.errors).flat().join(', ');
                            this.mostrarError(`Errores de validación: ${errores}`);
                        } else if (typeof error.response.data === 'string') {
                            this.mostrarError(`Error: ${error.response.data}`);
                        } else {
                            this.mostrarError('Error de validación en el servidor');
                        }
                    } else {
                        this.mostrarError('Error al guardar la asignación');
                    }
                } finally {
                    this.guardando = false;
                }
            },

            confirmarEliminar(asignacion) {
                if (confirm('¿Está seguro de que desea eliminar esta asignación?')) {
                    this.eliminarAsignacion(asignacion.id);
                }
            },

            async eliminarAsignacion(asignacionId) {
                try {
                    await apiClient.delete(`/api/Asignaciones/${asignacionId}`);
                    this.mostrarExito('Asignación eliminada exitosamente');
                    await this.cargarAsignaciones();
                } catch (error) {
                    console.error('Error al eliminar asignación:', error);
                    this.mostrarError('Error al eliminar la asignación');
                }
            },

            async realizarDevolucion() {
                if (!confirm('¿Está seguro de que desea registrar la devolución de este vehículo?')) {
                    return;
                }

                // Validación básica antes de enviar
                if (!this.devolucionForm.fechaDevolucion) {
                    this.mostrarError('La fecha de devolución es obligatoria');
                    return;
                }

                if (!this.devolucionForm.kilometrajeFinal || isNaN(this.devolucionForm.kilometrajeFinal)) {
                    this.mostrarError('El kilometraje final debe ser un número válido');
                    return;
                }

                // Verificar que el kilometraje final sea mayor que el inicial
                if (Number(this.devolucionForm.kilometrajeFinal) <= Number(this.asignacionDetalle.kilometrajeInicial)) {
                    this.mostrarError(`El kilometraje final (${this.devolucionForm.kilometrajeFinal}) debe ser mayor que el inicial (${this.asignacionDetalle.kilometrajeInicial})`);
                    return;
                }

                this.procesandoDevolucion = true;
                try {
                    // Crear un objeto de datos para loggear (no se envía)
                    const datosLog = {
                        fechaDevolucion: this.devolucionForm.fechaDevolucion,
                        kilometrajeFinal: this.devolucionForm.kilometrajeFinal,
                        estadoDevolucion: this.devolucionForm.estadoDevolucion,
                        observaciones: this.devolucionForm.observaciones || '',
                        documentos: this.documentosSeleccionados ? this.documentosSeleccionados.length : 0
                    };
                    console.log('Datos a enviar:', datosLog);
                    console.log('ID de asignación:', this.asignacionDetalle.id);

                    const formData = new FormData();

                    // Asegurarse de que la fecha tenga el formato correcto (YYYY-MM-DD)
                    const fechaDevolucion = this.devolucionForm.fechaDevolucion;
                    formData.append('fechaDevolucion', fechaDevolucion);

                    // Asegurarse de que el kilometraje sea un número
                    formData.append('kilometrajeFinal', Number(this.devolucionForm.kilometrajeFinal));

                    formData.append('estadoDevolucion', this.devolucionForm.estadoDevolucion);
                    formData.append('observaciones', this.devolucionForm.observaciones || '');

                    if (this.documentosSeleccionados && this.documentosSeleccionados.length > 0) {
                        this.documentosSeleccionados.forEach((doc, index) => {
                            console.log(`Documento ${index}:`, doc.name, doc.type, doc.size);
                            formData.append('documentos', doc);
                        });
                    }

                    // Intentar con la primera letra en mayúscula también (por si el backend espera PascalCase)
                    // formData.append('FechaDevolucion', fechaDevolucion);
                    // formData.append('KilometrajeFinal', Number(this.devolucionForm.kilometrajeFinal));
                    // formData.append('EstadoDevolucion', this.devolucionForm.estadoDevolucion);
                    // formData.append('Observaciones', this.devolucionForm.observaciones || '');

                    // Intentar como objeto JSON en caso de que el backend no esté configurado para FormData
                    try {
                        const response = await apiClient.post(`/api/Asignaciones/${this.asignacionDetalle.id}/devolucion`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        console.log('Respuesta exitosa:', response);

                        this.mostrarExito('Devolución registrada exitosamente');
                        this.cerrarModal('devolucionModal');
                        await this.cargarAsignaciones();
                    } catch (postError) {
                        console.error('Error en la solicitud POST:', postError);

                        // Si hay error con FormData, intentar con JSON como alternativa
                        if (postError.response && postError.response.status === 400 && !this.documentosSeleccionados.length) {
                            console.log('Intentando con formato JSON...');

                            const jsonData = {
                                fechaDevolucion: fechaDevolucion,
                                kilometrajeFinal: Number(this.devolucionForm.kilometrajeFinal),
                                estadoDevolucion: this.devolucionForm.estadoDevolucion,
                                observaciones: this.devolucionForm.observaciones || ''
                            };

                            const jsonResponse = await apiClient.post(
                                `/api/Asignaciones/${this.asignacionDetalle.id}/devolucion`,
                                jsonData
                            );

                            console.log('Respuesta exitosa con JSON:', jsonResponse);
                            this.mostrarExito('Devolución registrada exitosamente');
                            this.cerrarModal('devolucionModal');
                            await this.cargarAsignaciones();
                        } else {
                            throw postError; // Re-lanzar el error para que lo capture el catch externo
                        }
                    }
                } catch (error) {
                    console.error('Error al realizar devolución:', error);

                    // Mostrar información detallada del error
                    if (error.response) {
                        console.log('Status:', error.response.status);
                        console.log('Headers:', error.response.headers);
                        console.log('Error data:', error.response.data);

                        // Intentar mostrar un mensaje de error más descriptivo
                        let errorMessage = 'Error al procesar la devolución';
                        if (error.response.data) {
                            if (typeof error.response.data === 'string') {
                                errorMessage = error.response.data;
                            } else if (error.response.data.errors) {
                                // Si hay errores de validación
                                const errors = Object.values(error.response.data.errors).flat().join(', ');
                                errorMessage = `Errores de validación: ${errors}`;
                            } else if (error.response.data.message) {
                                errorMessage = error.response.data.message;
                            }
                        }

                        this.mostrarError(errorMessage);
                    } else if (error.request) {
                        console.log('Request:', error.request);
                        this.mostrarError('No se recibió respuesta del servidor');
                    } else {
                        console.log('Error message:', error.message);
                        this.mostrarError(`Error: ${error.message}`);
                    }
                } finally {
                    this.procesandoDevolucion = false;
                }
            },

            // ========== GESTIÓN DE DOCUMENTOS ==========

            async descargarDocumento(documentoId) {
                try {
                    const infoResponse = await apiClient.get(`/api/Documentos/${documentoId}`);
                    const documentoInfo = infoResponse.data;

                    const response = await apiClient.get(`/api/Documentos/${documentoId}/Contenido`, {
                        responseType: 'blob'
                    });

                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;

                    let filename = documentoInfo.nombre || 'documento';
                    if (!filename.includes('.')) {
                        const contentType = response.headers['content-type'];
                        const extension = this.obtenerExtensionPorContentType(contentType);
                        if (extension) {
                            filename += `.${extension}`;
                        }
                    }

                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);

                    this.mostrarExito(`Documento "${filename}" descargado exitosamente`);
                } catch (error) {
                    console.error('Error al descargar documento:', error);
                    this.mostrarError('Error al descargar el documento');
                }
            },

            async eliminarDocumento(documentoId) {
                if (!confirm('¿Está seguro de que desea eliminar este documento?')) {
                    return;
                }

                try {
                    await apiClient.delete(`/api/Documentos/${documentoId}`);
                    this.mostrarExito('Documento eliminado exitosamente');

                    // Recargar documentos
                    if (this.asignacionDetalle && this.asignacionDetalle.id) {
                        const response = await apiClient.get(`/api/Asignaciones/${this.asignacionDetalle.id}`);
                        this.asignacionDetalle = response.data;
                        this.documentos = this.asignacionDetalle.documentos || [];
                    }
                } catch (error) {
                    console.error('Error al eliminar documento:', error);
                    this.mostrarError('Error al eliminar el documento');
                }
            },

            async descargarPlantilla(plantillaId) {
                try {
                    const infoResponse = await apiClient.get(`/api/Plantillas/${plantillaId}`);
                    const plantillaInfo = infoResponse.data;

                    const response = await apiClient.get(`/api/Plantillas/${plantillaId}/Contenido`, {
                        responseType: 'blob'
                    });

                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', plantillaInfo.nombre || 'plantilla.docx');
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);

                    this.mostrarExito(`Plantilla "${plantillaInfo.nombre}" descargada exitosamente`);
                } catch (error) {
                    console.error('Error al descargar plantilla:', error);
                    this.mostrarError('Error al descargar la plantilla');
                }
            },

            seleccionarDocumentos(event) {
                this.documentosSeleccionados = Array.from(event.target.files);
                console.log('Documentos seleccionados:', this.documentosSeleccionados.length);
            },

            // ========== FUNCIONES DE ARCHIVOS ==========

            obtenerExtension(filename) {
                if (!filename) return '';
                const parts = filename.split('.');
                return parts.length > 1 ? parts.pop().toUpperCase() : '';
            },

            obtenerTipoDocumento(filename) {
                const extension = this.obtenerExtension(filename).toLowerCase();
                const tipos = {
                    'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word',
                    'xls': 'Excel', 'xlsx': 'Excel', 'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
                    'jpg': 'Imagen', 'jpeg': 'Imagen', 'png': 'Imagen', 'gif': 'Imagen',
                    'txt': 'Texto', 'zip': 'Archivo', 'rar': 'Archivo'
                };
                return tipos[extension] || 'Documento';
            },

            obtenerExtensionPorContentType(contentType) {
                const mimeTypes = {
                    'application/pdf': 'pdf',
                    'application/msword': 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                    'application/vnd.ms-excel': 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
                    'text/plain': 'txt', 'application/zip': 'zip'
                };
                return mimeTypes[contentType] || null;
            },

            formatearTamano(bytes) {
                if (!bytes) return 'N/A';
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                if (bytes === 0) return '0 Bytes';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
            },

            // ========== UTILIDADES GENERALES ==========

            limpiarFormulario() {
                this.asignacionForm = {
                    id: null,
                    vehiculoId: null,
                    colaboradorId: null,
                    fechaAsignacion: new Date().toISOString().split('T')[0],
                    kilometrajeInicial: 0,
                    fechaEstimadaDevolucion: null,
                    proposito: '',
                    observaciones: '',
                    numeroOficio: '',
                    tipoAsignacion: 1,
                    institucionAsignada: '',
                    departamentoAsignado: '',
                    responsableInstitucion: '',
                    cargoResponsable: '',
                    tipoExpediente: 1,
                    observacionesExpediente: '',
                    generarPlantilla: false
                };
                this.documentosSeleccionados = [];
            },

            obtenerTextoEstado(estadoId) {
                const textoEstados = {
                    0: 'Activa',
                    1: 'Activa',
                    2: 'Completada',
                    3: 'Cancelada'
                };
                return textoEstados[estadoId] || `Estado ${estadoId}`;
            },

            obtenerEstadoClass(estadoId) {
                const claseEstados = {
                    0: 'badge bg-success',
                    1: 'badge bg-success',
                    2: 'badge bg-primary',
                    3: 'badge bg-danger'
                };
                return claseEstados[estadoId] || 'badge bg-secondary';
            },

            obtenerTextoTipoAsignacion(tipoId) {
                const tipo = this.tiposAsignacion.find(t => t.value === tipoId);
                return tipo ? tipo.text : `Tipo ${tipoId}`;
            },

            obtenerTextoTipoExpediente(tipoId) {
                const tipo = this.tiposExpediente.find(t => t.value === tipoId);
                return tipo ? tipo.text : `Tipo ${tipoId}`;
            },

            obtenerTextoExpediente(estadoId) {
                const estado = this.estadosExpediente.find(e => e.value === estadoId);
                return estado ? estado.text : `Estado ${estadoId}`;
            },

            obtenerExpedienteClass(estadoId) {
                const estados = {
                    1: 'badge bg-info',
                    2: 'badge bg-warning',
                    3: 'badge bg-success',
                    4: 'badge bg-danger'
                };
                return estados[estadoId] || 'badge bg-secondary';
            },

            formatearFecha(fecha) {
                if (!fecha) return 'No especificada';
                try {
                    return new Date(fecha).toLocaleDateString('es-DO');
                } catch (error) {
                    return 'Fecha inválida';
                }
            },

            // función para limpiar filtros
            limpiarFiltros() {
                console.log('Limpiando filtros');

                // Reiniciar todos los filtros
                this.filtros = {
                    estado: '',
                    tipoAsignacion: '',
                    fechaDesde: '',
                    fechaHasta: ''
                };

                // Cargar todas las asignaciones sin filtros
                this.cargarAsignaciones();
            },

            // función auxiliar para formatear fechas
            formatearFecha(fecha, paraAPI = false) {
                if (!fecha) return paraAPI ? '' : 'No especificada';

                try {
                    // Convertir a objeto Date
                    const fechaObj = new Date(fecha);

                    if (paraAPI) {
                        // Formato YYYY-MM-DD para la API
                        return fechaObj.toISOString().split('T')[0];
                    } else {
                        // Formato para mostrar al usuario
                        return fechaObj.toLocaleDateString('es-DO');
                    }
                } catch (error) {
                    console.error('Error al formatear fecha:', error);
                    return paraAPI ? '' : 'Fecha inválida';
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

                const notification = document.createElement('div');
                const iconos = { success: '✓', error: '✗', info: 'ℹ' };
                const colores = { success: '#6bbd4a', error: '#e74c3c', info: '#3a9bd9' };

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

                setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);

                setTimeout(() => {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 4000);

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
            console.log('Vue mounted - Iniciando aplicación de asignaciones...');

            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('No hay token, redirigiendo al login...');
                window.location.href = '/Account/Login';
                return;
            }

            console.log('Token encontrado, cargando asignaciones...');

            try {
                await this.cargarAsignaciones();
                console.log('App inicializada correctamente');
            } catch (error) {
                console.error('Error durante la inicialización de la aplicación:', error);
                this.mostrarError('Error al inicializar la aplicación. Por favor, recargue la página.');
            }
        },

        beforeDestroy() {
            SimpleModalManager.hideAll();
            const container = document.getElementById('notification-container');
            if (container) {
                container.remove();
            }
        }
    });

    console.log('Aplicación Vue de asignaciones inicializada correctamente');
});