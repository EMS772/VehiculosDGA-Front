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
// GESTOR DE MODALES SIMPLIFICADO
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
            btn.onclick = e => {
                e.preventDefault();
                this.hide(modalId);
            };
        });

        const escapeHandler = e => {
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
// APLICACIÓN VUE DE SEGUROS
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando aplicación de seguros...');

    window.segurosApp = new Vue({
        el: '#seguros-app',

        // ============================================
        // DATOS REACTIVOS
        // ============================================
        data: {
            // Datos principales
            seguros: [],
            vehiculos: [],
            seguroDetalle: {},
            documentosSeguro: [],

            // Estados de carga
            cargando: false,
            guardando: false,
            editando: false,

            // Filtros y paginación
            mostrarFiltros: false,
            filtros: {
                aseguradora: '',
                estado: '',
                fechaInicio: '',
                fechaFin: ''
            },
            paginaActual: 1,
            itemsPorPagina: 10,

            // Formulario de seguro
            seguroForm: {
                id: null,
                vehiculoId: '',
                aseguradora: '',
                numeroPoliza: '',
                tipoCobertura: '',   // mapea a TipoPoliza
                montoCobertura: 0,
                fechaInicio: '',
                fechaVencimiento: '',
                primaMensual: 0,
                costoAnual: 0,
                deducible: 0,
                corredor: '',
                telefonoContacto: '',
                emailContacto: '',
                cobertura: ''        // mapea a Cobertura (detalles de cobertura)
            },

            // Documentos
            documentosSeleccionados: [],

            // Propiedades para renovación
            seguroRenovacion: {},
            documentosRenovacion: [],
            renovacionForm: {
                numeroPoliza: '',
                fechaInicio: '',
                fechaVencimiento: '',
                kilometraje: 0,
                primaMensual: 0,
                costoAnual: 0,
                deducible: 0,
                cobertura: ''
            },

            // Estadísticas
            estadisticas: {
                activos: 0,
                porVencer30: 0,
                porVencer15: 0,
                vencidos: 0
            }
        },

        // ============================================
        // PROPIEDADES COMPUTADAS
        // ============================================
        computed: {
            segurosFiltrados() {
                let segurosFilt = this.seguros;

                // Aplicar filtros
                if (this.filtros.aseguradora) {
                    segurosFilt = segurosFilt.filter(s =>
                        s.aseguradora.toLowerCase().includes(this.filtros.aseguradora.toLowerCase())
                    );
                }

                if (this.filtros.estado) {
                    segurosFilt = segurosFilt.filter(s => {
                        const estado = this.obtenerEstadoSeguro(s);
                        return estado === this.filtros.estado;
                    });
                }

                if (this.filtros.fechaInicio) {
                    segurosFilt = segurosFilt.filter(s =>
                        new Date(s.fechaVencimiento) >= new Date(this.filtros.fechaInicio)
                    );
                }

                if (this.filtros.fechaFin) {
                    segurosFilt = segurosFilt.filter(s =>
                        new Date(s.fechaVencimiento) <= new Date(this.filtros.fechaFin)
                    );
                }

                // Paginación
                const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
                const fin = inicio + this.itemsPorPagina;
                return segurosFilt.slice(inicio, fin);
            },

            totalPaginas() {
                return Math.ceil(this.seguros.length / this.itemsPorPagina);
            }
        },

        // ============================================
        // MÉTODOS
        // ============================================
        methods: {
            // ========== CARGA DE DATOS ==========
            async cargarSeguros() {
                this.cargando = true;
                try {
                    const response = await apiClient.get('/api/Seguros');
                    this.seguros = response.data;
                    console.log('Seguros cargados:', this.seguros.length);
                    await this.actualizarEstadisticas();
                } catch (error) {
                    console.error('Error al cargar seguros:', error);
                } finally {
                    this.cargando = false;
                }
            },

            async cargarVehiculos() {
                try {
                    const response = await apiClient.get('/api/Vehiculos');
                    this.vehiculos = response.data;
                    console.log('Vehículos cargados:', this.vehiculos.length);
                } catch (error) {
                    console.error('Error al cargar vehículos:', error);
                }
            },

            async actualizarEstadisticas() {
                try {
                    const response = await apiClient.get('/api/Seguros/dashboard');
                    const dashboard = response.data;
                    this.estadisticas = {
                        activos: dashboard.resumen.segurosVigentes,
                        porVencer30: dashboard.resumen.proximosAVencer30Dias,
                        porVencer15: await this.contarProximosAVencer(15),
                        vencidos: dashboard.resumen.segurosVencidos
                    };
                } catch (error) {
                    console.error('Error al cargar estadísticas:', error);
                    this.calcularEstadisticasLocales();
                }
            },

            async contarProximosAVencer(dias) {
                try {
                    const response = await apiClient.get(`/api/Seguros/proximos-vencer/${dias}`);
                    return response.data.length;
                } catch (error) {
                    console.error(`Error al obtener seguros próximos a vencer en ${dias} días:`, error);
                    return 0;
                }
            },

            calcularEstadisticasLocales() {
                const hoy = new Date();
                const en15Dias = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000);
                const en30Dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

                this.estadisticas = {
                    activos: this.seguros.filter(s => new Date(s.fechaVencimiento) >= hoy).length,
                    porVencer30: this.seguros.filter(s => {
                        const vence = new Date(s.fechaVencimiento);
                        return vence >= hoy && vence <= en30Dias;
                    }).length,
                    porVencer15: this.seguros.filter(s => {
                        const vence = new Date(s.fechaVencimiento);
                        return vence >= hoy && vence <= en15Dias;
                    }).length,
                    vencidos: this.seguros.filter(s => new Date(s.fechaVencimiento) < hoy).length
                };
            },

            // ========== GESTIÓN DE MODALES ==========
            mostrarModalCrear() {
                this.editando = false;
                this.limpiarFormulario();
                SimpleModalManager.show('addInsuranceModal');
            },

            mostrarModalEditar(seguro) {
                this.editando = true;
                this.cargarDatosFormulario(seguro);
                SimpleModalManager.show('addInsuranceModal');
            },

            mostrarModalRenovacion(seguro) {
                console.log('=== INICIAR RENOVACIÓN DE SEGURO ===');
                console.log('Seguro a renovar:', seguro);
                this.seguroRenovacion = { ...seguro };
                this.limpiarFormularioRenovacion();
                this.precargarDatosRenovacion(seguro);
                SimpleModalManager.show('renewInsuranceModal');
            },

            async verDetalles(seguro) {
                try {
                    console.log('=== VER DETALLES SEGURO ===', seguro);
                    const response = await apiClient.get(`/api/Seguros/${seguro.id}`);
                    this.seguroDetalle = response.data;
                    await this.cargarDocumentosSeguro(seguro.id);
                    SimpleModalManager.show('viewInsuranceModal');
                } catch (error) {
                    console.error('Error al cargar detalles del seguro:', error);
                }
            },

            cerrarModal(modalId) {
                SimpleModalManager.hide(modalId);
            },

            // ========== MÉTODOS DE RENOVACIÓN ==========
            precargarDatosRenovacion(seguro) {
                const fechaVencimientoActual = new Date(seguro.fechaVencimiento);
                const nuevaFechaInicio = new Date(fechaVencimientoActual);
                nuevaFechaInicio.setDate(nuevaFechaInicio.getDate() + 1);

                const nuevaFechaVencimiento = new Date(nuevaFechaInicio);
                nuevaFechaVencimiento.setFullYear(nuevaFechaVencimiento.getFullYear() + 1);

                const añoRenovacion = new Date().getFullYear();
                const numeroPolizaSugerido = `${seguro.numeroPoliza}-R${añoRenovacion}`;
                const kilometrajeActual = seguro.vehiculo ? seguro.vehiculo.kilometraje : 0;

                this.renovacionForm = {
                    numeroPoliza: numeroPolizaSugerido,
                    fechaInicio: nuevaFechaInicio.toISOString().split('T')[0],
                    fechaVencimiento: nuevaFechaVencimiento.toISOString().split('T')[0],
                    kilometraje: kilometrajeActual,
                    primaMensual: seguro.primaMensual || 0,
                    costoAnual: seguro.costoAnual || 0,
                    deducible: seguro.deducible || 0,
                    cobertura: seguro.cobertura || ''
                };

                console.log('Datos precargados para renovación:', this.renovacionForm);
            },

            limpiarFormularioRenovacion() {
                this.renovacionForm = {
                    numeroPoliza: '',
                    fechaInicio: '',
                    fechaVencimiento: '',
                    kilometraje: 0,
                    primaMensual: 0,
                    costoAnual: 0,
                    deducible: 0,
                    cobertura: ''
                };
                this.documentosRenovacion = [];
            },

            calcularFechasAutomaticas() {
                if (!this.seguroRenovacion.fechaVencimiento) {
                    console.error('No se puede calcular sin fecha de vencimiento del seguro actual');
                    return;
                }

                const fechaVencimientoActual = new Date(this.seguroRenovacion.fechaVencimiento);
                const nuevaFechaInicio = new Date(fechaVencimientoActual);
                nuevaFechaInicio.setDate(nuevaFechaInicio.getDate() + 1);

                const nuevaFechaVencimiento = new Date(nuevaFechaInicio);
                nuevaFechaVencimiento.setFullYear(nuevaFechaVencimiento.getFullYear() + 1);

                this.renovacionForm.fechaInicio = nuevaFechaInicio.toISOString().split('T')[0];
                this.renovacionForm.fechaVencimiento = nuevaFechaVencimiento.toISOString().split('T')[0];

                console.log('Fechas calculadas automáticamente para renovación');
            },

            calcularFechaSugerida(fechaBase, diasSumar) {
                if (!fechaBase) return 'No disponible';
                const fecha = new Date(fechaBase);
                fecha.setDate(fecha.getDate() + diasSumar);
                return this.formatearFecha(fecha);
            },

            seleccionarDocumentosRenovacion(event) {
                this.documentosRenovacion = Array.from(event.target.files);
                console.log(`${this.documentosRenovacion.length} documentos seleccionados para renovación`);
            },

            async procesarRenovacion() {
                this.guardando = true;
                try {
                    if (!this.validarFormularioRenovacion()) {
                        this.guardando = false;
                        return;
                    }

                    console.log('=== PROCESANDO RENOVACIÓN ===');
                    console.log('Seguro original:', this.seguroRenovacion);
                    console.log('Datos de renovación:', this.renovacionForm);

                    const formData = new FormData();
                    formData.append('numeroPoliza', this.renovacionForm.numeroPoliza);
                    formData.append('fechaInicio', this.renovacionForm.fechaInicio);
                    formData.append('fechaVencimiento', this.renovacionForm.fechaVencimiento);
                    formData.append('kilometraje', this.renovacionForm.kilometraje);
                    formData.append('primaMensual', this.renovacionForm.primaMensual);
                    formData.append('costoAnual', this.renovacionForm.costoAnual);
                    formData.append('deducible', this.renovacionForm.deducible);
                    formData.append('cobertura', this.renovacionForm.cobertura);

                    if (this.documentosRenovacion.length > 0) {
                        this.documentosRenovacion.forEach(doc => {
                            formData.append('documentos', doc);
                        });
                        console.log(`Agregando ${this.documentosRenovacion.length} documentos a la renovación`);
                    }

                    await apiClient.post(
                        `/api/Seguros/${this.seguroRenovacion.id}/renovar`,
                        formData,
                        {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        }
                    );

                    console.log(`Renovación completada. Nueva póliza: ${this.renovacionForm.numeroPoliza}`);
                    this.cerrarModal('renewInsuranceModal');
                    await this.cargarSeguros();
                } catch (error) {
                    console.error('Error al renovar seguro:', error);
                } finally {
                    this.guardando = false;
                }
            },

            validarFormularioRenovacion() {
                if (!this.renovacionForm.numeroPoliza.trim()) {
                    console.error('Debe especificar el nuevo número de póliza');
                    return false;
                }
                if (!this.renovacionForm.fechaInicio) {
                    console.error('Debe especificar la fecha de inicio de la renovación');
                    return false;
                }
                if (!this.renovacionForm.fechaVencimiento) {
                    console.error('Debe especificar la fecha de vencimiento de la renovación');
                    return false;
                }

                const fechaInicio = new Date(this.renovacionForm.fechaInicio);
                const fechaVencimiento = new Date(this.renovacionForm.fechaVencimiento);
                if (fechaVencimiento <= fechaInicio) {
                    console.error('La fecha de vencimiento debe ser posterior a la fecha de inicio');
                    return false;
                }

                const fechaVencimientoActual = new Date(this.seguroRenovacion.fechaVencimiento);
                if (fechaInicio <= fechaVencimientoActual) {
                    console.error('La fecha de inicio de la renovación debe ser posterior al vencimiento actual');
                    return false;
                }

                if (isNaN(this.renovacionForm.kilometraje) || this.renovacionForm.kilometraje < 0) {
                    console.error('Debe especificar un kilometraje válido');
                    return false;
                }
                if (!this.renovacionForm.primaMensual || this.renovacionForm.primaMensual <= 0) {
                    console.error('Debe especificar una prima mensual válida');
                    return false;
                }
                if (!this.renovacionForm.costoAnual || this.renovacionForm.costoAnual <= 0) {
                    console.error('Debe especificar un costo anual válido');
                    return false;
                }

                console.log('Validación de renovación exitosa');
                return true;
            },

            // ========== MÉTODOS PARA INFORMACIÓN DEL VEHÍCULO ==========
            obtenerInfoVehiculoSeguro(seguro) {
                if (!seguro || !seguro.vehiculo) {
                    return 'Sin vehículo asignado';
                }
                const vehiculo = seguro.vehiculo;
                return `${vehiculo.marca || 'N/A'} ${vehiculo.modelo || 'N/A'}`;
            },

            obtenerPlacaVehiculoSeguro(seguro) {
                if (!seguro || !seguro.vehiculo) {
                    return 'Sin placa';
                }
                return seguro.vehiculo.placaFisica || 'Sin placa';
            },

            obtenerTipoCobertura(seguro) {
                return seguro.tipoPoliza || 'No especificado';
            },

            // ========== OPERACIONES CRUD ==========
            async guardarSeguro() {
                this.guardando = true;
                try {
                    if (!this.validarFormulario()) {
                        this.guardando = false;
                        return;
                    }

                    const vehiculoSeleccionado = this.obtenerInfoVehiculo();
                    const kilometrajeVehiculo = vehiculoSeleccionado ? vehiculoSeleccionado.kilometraje || 0 : 0;

                    const formData = new FormData();
                    if (this.editando) {
                        formData.append('id', this.seguroForm.id);
                        formData.append('vehiculoId', parseInt(this.seguroForm.vehiculoId));
                        formData.append('aseguradora', this.seguroForm.aseguradora);
                        formData.append('numeroPoliza', this.seguroForm.numeroPoliza);
                        formData.append('tipoPoliza', this.seguroForm.tipoCobertura);
                        formData.append('cobertura', this.seguroForm.cobertura);
                        formData.append('montoCobertura', parseFloat(this.seguroForm.montoCobertura));
                        formData.append('kilometraje', kilometrajeVehiculo);
                        formData.append('deducible', parseFloat(this.seguroForm.deducible) || 0);
                        formData.append('primaMensual', parseFloat(this.seguroForm.primaMensual));
                        formData.append('costoAnual', parseFloat(this.seguroForm.costoAnual));
                        formData.append('fechaInicio', this.seguroForm.fechaInicio);
                        formData.append('fechaVencimiento', this.seguroForm.fechaVencimiento);

                        if (this.seguroForm.corredor) {
                            formData.append('corredorSeguro', this.seguroForm.corredor);
                        }
                        if (this.seguroForm.telefonoContacto) {
                            formData.append('telefonoContacto', this.seguroForm.telefonoContacto);
                        }
                        if (this.seguroForm.emailContacto) {
                            formData.append('emailContacto', this.seguroForm.emailContacto);
                        }

                        if (this.documentosSeleccionados.length > 0) {
                            this.documentosSeleccionados.forEach(doc => {
                                formData.append('documentos', doc);
                            });
                            console.log(`Agregando ${this.documentosSeleccionados.length} documentos nuevos al seguro`);
                        }

                        await apiClient.put(`/api/Seguros/${this.seguroForm.id}`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        console.log('Seguro actualizado exitosamente');
                    } else {
                        formData.append('vehiculoId', parseInt(this.seguroForm.vehiculoId));
                        formData.append('aseguradora', this.seguroForm.aseguradora);
                        formData.append('numeroPoliza', this.seguroForm.numeroPoliza);
                        formData.append('tipoPoliza', this.seguroForm.tipoCobertura);
                        formData.append('cobertura', this.seguroForm.cobertura);
                        formData.append('montoCobertura', parseFloat(this.seguroForm.montoCobertura));
                        formData.append('kilometraje', kilometrajeVehiculo);
                        formData.append('deducible', parseFloat(this.seguroForm.deducible) || 0);
                        formData.append('primaMensual', parseFloat(this.seguroForm.primaMensual));
                        formData.append('costoAnual', parseFloat(this.seguroForm.costoAnual));
                        formData.append('fechaInicio', this.seguroForm.fechaInicio);
                        formData.append('fechaVencimiento', this.seguroForm.fechaVencimiento);
                        formData.append('corredorSeguro', this.seguroForm.corredor || '');
                        formData.append('telefonoContacto', this.seguroForm.telefonoContacto || '');
                        formData.append('emailContacto', this.seguroForm.emailContacto || '');

                        if (this.documentosSeleccionados.length > 0) {
                            this.documentosSeleccionados.forEach(doc => {
                                formData.append('documentos', doc);
                            });
                        }

                        await apiClient.post('/api/Seguros', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        console.log('Seguro registrado exitosamente');
                    }

                    this.cerrarModal('addInsuranceModal');
                    await this.cargarSeguros();
                } catch (error) {
                    console.error('Error al guardar seguro:', error);
                } finally {
                    this.guardando = false;
                }
            },

            async eliminarSeguro(seguro) {
                if (!confirm(`¿Está seguro de eliminar el seguro ${seguro.numeroPoliza}?`)) {
                    return;
                }

                try {
                    await apiClient.delete(`/api/Seguros/${seguro.id}`);
                    console.log('Seguro eliminado exitosamente');
                    await this.cargarSeguros();
                } catch (error) {
                    console.error('Error al eliminar seguro:', error);
                }
            },

            async renovarSeguro(seguro) {
                this.mostrarModalRenovacion(seguro);
            },

            async notificarSeguro(seguro) {
                console.log(`Simulación: Notificación enviada para el seguro ${seguro.numeroPoliza}`);
            },

            // ========== GESTIÓN DE DOCUMENTOS ==========
            async cargarDocumentosSeguro(seguroId) {
                try {
                    const response = await apiClient.get(`/api/Seguros/${seguroId}/documentos`);
                    this.documentosSeguro = response.data;
                    console.log(`Cargados ${this.documentosSeguro.length} documentos para el seguro ${seguroId}`);
                } catch (error) {
                    console.error('Error al cargar documentos:', error);
                    this.documentosSeguro = [];
                }
            },

            async descargarDocumento(documento) {
                try {
                    const response = await apiClient.get(`/api/Documentos/${documento.id}/Contenido`, {
                        responseType: 'blob'
                    });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', documento.nombre);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    console.log(`Documento "${documento.nombre}" descargado`);
                } catch (error) {
                    console.error('Error al descargar documento:', error);
                }
            },

            async eliminarDocumento(documento) {
                if (!confirm(`¿Está seguro de eliminar el documento "${documento.nombre}"?`)) {
                    return;
                }

                try {
                    console.log(`Eliminando documento ${documento.id} del seguro ${this.seguroDetalle.id}`);
                    await apiClient.delete(`/api/Seguros/${this.seguroDetalle.id}/documentos/${documento.id}`);
                    console.log(`Documento "${documento.nombre}" eliminado exitosamente`);
                    await this.cargarDocumentosSeguro(this.seguroDetalle.id);
                } catch (error) {
                    console.error('Error al eliminar documento:', error);
                }
            },

            async eliminarTodosDocumentosSeguro() {
                if (this.documentosSeguro.length === 0) {
                    console.log('No hay documentos para eliminar');
                    return;
                }

                const cantidad = this.documentosSeguro.length;
                if (!confirm(`¿Está seguro de eliminar TODOS los ${cantidad} documentos de este seguro?`)) {
                    return;
                }

                try {
                    console.log(`Eliminando todos los ${cantidad} documentos del seguro ${this.seguroDetalle.id}`);
                    await apiClient.delete(`/api/Seguros/${this.seguroDetalle.id}/documentos`);
                    console.log(`Todos los documentos (${cantidad}) han sido eliminados`);
                    this.documentosSeguro = [];
                } catch (error) {
                    console.error('Error al eliminar todos los documentos:', error);
                    await this.cargarDocumentosSeguro(this.seguroDetalle.id);
                }
            },

            async agregarDocumentosASeguro(event) {
                const archivos = Array.from(event.target.files);
                if (archivos.length === 0) return;
                if (!this.seguroDetalle || !this.seguroDetalle.id) {
                    console.error('No hay un seguro seleccionado');
                    return;
                }

                try {
                    this.guardando = true;
                    for (const archivo of archivos) {
                        if (archivo.size > 10 * 1024 * 1024) {
                            console.error(`El archivo "${archivo.name}" es demasiado grande (máximo 10MB)`);
                            continue;
                        }
                        await this.agregarDocumentoASeguro(this.seguroDetalle.id, archivo);
                    }
                    await this.cargarDocumentosSeguro(this.seguroDetalle.id);
                    event.target.value = '';
                    console.log(`${archivos.length} documento(s) agregado(s) exitosamente`);
                } catch (error) {
                    console.error('Error al agregar documentos:', error);
                } finally {
                    this.guardando = false;
                }
            },

            async agregarDocumentoASeguro(seguroId, archivo) {
                const formData = new FormData();
                formData.append('archivo', archivo);
                formData.append('nombre', archivo.name);
                formData.append('tipoDocumento', 'Seguro');
                formData.append('seguroId', seguroId);
                await apiClient.post(`/api/Seguros/${seguroId}/documentos`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            },

            seleccionarDocumentos(event) {
                this.documentosSeleccionados = Array.from(event.target.files);
            },

            // ========== MÉTODOS AUXILIARES PARA DOCUMENTOS ==========
            formatearTamanoArchivo(bytes) {
                if (!bytes) return 'N/A';
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                if (bytes === 0) return '0 Bytes';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                const size = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;
                return `${size} ${sizes[i]}`;
            },

            obtenerIconoDocumento(nombreArchivo) {
                if (!nombreArchivo) return 'bi-file-earmark';
                const extension = nombreArchivo.toLowerCase().split('.').pop();
                const iconos = {
                    pdf: 'bi-file-earmark-pdf',
                    doc: 'bi-file-earmark-word',
                    docx: 'bi-file-earmark-word',
                    xls: 'bi-file-earmark-excel',
                    xlsx: 'bi-file-earmark-excel',
                    jpg: 'bi-file-earmark-image',
                    jpeg: 'bi-file-earmark-image',
                    png: 'bi-file-earmark-image',
                    gif: 'bi-file-earmark-image',
                    txt: 'bi-file-earmark-text',
                    zip: 'bi-file-earmark-zip',
                    rar: 'bi-file-earmark-zip'
                };
                return iconos[extension] || 'bi-file-earmark';
            },

            obtenerColorIcono(nombreArchivo) {
                if (!nombreArchivo) return 'text-secondary';
                const extension = nombreArchivo.toLowerCase().split('.').pop();
                const colores = {
                    pdf: 'text-danger',
                    doc: 'text-primary',
                    docx: 'text-primary',
                    xls: 'text-success',
                    xlsx: 'text-success',
                    jpg: 'text-warning',
                    jpeg: 'text-warning',
                    png: 'text-warning',
                    gif: 'text-warning',
                    txt: 'text-info',
                    zip: 'text-dark',
                    rar: 'text-dark'
                };
                return colores[extension] || 'text-secondary';
            },

            // ========== FILTROS Y PAGINACIÓN ==========
            toggleFiltros() {
                this.mostrarFiltros = !this.mostrarFiltros;
            },

            aplicarFiltros() {
                this.paginaActual = 1;
            },

            limpiarFiltros() {
                this.filtros = {
                    aseguradora: '',
                    estado: '',
                    fechaInicio: '',
                    fechaFin: ''
                };
                this.paginaActual = 1;
            },

            cambiarPagina(pagina) {
                if (pagina >= 1 && pagina <= this.totalPaginas) {
                    this.paginaActual = pagina;
                }
            },

            obtenerKilometrajeVehiculo() {
                if (!this.seguroForm.vehiculoId || !this.vehiculos.length) {
                    return 0;
                }
                const vehiculo = this.vehiculos.find(v => v.id == this.seguroForm.vehiculoId);
                return vehiculo ? vehiculo.kilometraje || 0 : 0;
            },

            obtenerInfoVehiculo() {
                if (!this.seguroForm.vehiculoId || !this.vehiculos.length) {
                    return null;
                }
                return this.vehiculos.find(v => v.id == this.seguroForm.vehiculoId);
            },

            limpiarFormulario() {
                this.seguroForm = {
                    id: null,
                    vehiculoId: '',
                    aseguradora: '',
                    numeroPoliza: '',
                    tipoCobertura: '',
                    montoCobertura: 0,
                    fechaInicio: '',
                    fechaVencimiento: '',
                    primaMensual: 0,
                    costoAnual: 0,
                    deducible: 0,
                    corredor: '',
                    telefonoContacto: '',
                    emailContacto: '',
                    cobertura: ''
                };
                this.documentosSeleccionados = [];
            },

            cargarDatosFormulario(seguro) {
                this.seguroForm = {
                    id: seguro.id,
                    vehiculoId: seguro.vehiculoId,
                    aseguradora: seguro.aseguradora,
                    numeroPoliza: seguro.numeroPoliza,
                    tipoCobertura: seguro.tipoPoliza,           // se mantiene igual que antes
                    montoCobertura: seguro.montoCobertura,
                    fechaInicio: seguro.fechaInicio ? seguro.fechaInicio.split('T')[0] : '',
                    fechaVencimiento: seguro.fechaVencimiento ? seguro.fechaVencimiento.split('T')[0] : '',
                    primaMensual: seguro.primaMensual,
                    costoAnual: seguro.costoAnual,
                    deducible: seguro.deducible || 0,
                    corredor: seguro.corredorSeguro || '',
                    telefonoContacto: seguro.telefonoContacto || '',
                    emailContacto: seguro.emailContacto || '',
                    cobertura: seguro.cobertura || ''           // se asigna correctamente a 'cobertura'
                };

                this.documentosSeleccionados = [];
                console.log('Datos cargados para edición:', this.seguroForm);
            },

            validarFormulario() {
                if (!this.seguroForm.vehiculoId) {
                    console.error('Debe seleccionar un vehículo');
                    return false;
                }
                if (!this.seguroForm.aseguradora) {
                    console.error('Debe especificar la aseguradora');
                    return false;
                }
                if (!this.seguroForm.numeroPoliza) {
                    console.error('Debe especificar el número de póliza');
                    return false;
                }
                if (!this.seguroForm.tipoCobertura) {
                    console.error('Debe seleccionar el tipo de póliza');
                    return false;
                }
                if (!this.seguroForm.fechaInicio || !this.seguroForm.fechaVencimiento) {
                    console.error('Debe especificar las fechas de inicio y vencimiento');
                    return false;
                }
                if (new Date(this.seguroForm.fechaVencimiento) <= new Date(this.seguroForm.fechaInicio)) {
                    console.error('La fecha de vencimiento debe ser posterior a la fecha de inicio');
                    return false;
                }
                return true;
            },

            // ========== FORMATEO Y ESTADO ==========
            formatearFecha(fecha) {
                if (!fecha) return 'N/A';
                try {
                    return new Date(fecha).toLocaleDateString('es-DO');
                } catch {
                    return 'Fecha inválida';
                }
            },

            formatearMoneda(monto) {
                if (!monto) return '0.00';
                return new Intl.NumberFormat('es-DO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(monto);
            },

            obtenerDiasRestantes(fechaVencimiento) {
                if (!fechaVencimiento) return 'N/A';
                const hoy = new Date();
                const vence = new Date(fechaVencimiento);
                const diff = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
                if (diff < 0) {
                    return `Vencido hace ${Math.abs(diff)} días`;
                } else if (diff === 0) {
                    return 'Vence hoy';
                } else {
                    return `${diff} días restantes`;
                }
            },

            obtenerEstadoSeguro(seguro) {
                const hoy = new Date();
                const vence = new Date(seguro.fechaVencimiento);
                const diff = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
                if (diff < 0) return 'vencido';
                if (diff <= 15) return 'por-vencer';
                return 'activo';
            },

            obtenerTextoEstado(seguro) {
                const estado = this.obtenerEstadoSeguro(seguro);
                const estadosTexto = {
                    activo: 'Activo',
                    'por-vencer': 'Por vencer',
                    vencido: 'Vencido'
                };
                return estadosTexto[estado] || 'Desconocido';
            },

            obtenerBadgeEstado(seguro) {
                const estado = this.obtenerEstadoSeguro(seguro);
                const clases = {
                    activo: 'badge bg-success',
                    'por-vencer': 'badge bg-warning',
                    vencido: 'badge bg-danger'
                };
                return clases[estado] || 'badge bg-secondary';
            },

            obtenerClaseEstado(seguro) {
                const estado = this.obtenerEstadoSeguro(seguro);
                const clases = {
                    'por-vencer': 'table-warning',
                    vencido: 'table-danger'
                };
                return clases[estado] || '';
            },

            esSeguroActivo(seguro) {
                return this.obtenerEstadoSeguro(seguro) === 'activo';
            },

            imprimirSeguro() {
                window.print();
            }
        },

        // ============================================
        // CICLO DE VIDA
        // ============================================
        async mounted() {
            console.log('Vue mounted - Iniciando aplicación de seguros...');

            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('No hay token, redirigiendo al login...');
                window.location.href = '/Account/Login';
                return;
            }

            try {
                await Promise.all([
                    this.cargarSeguros(),
                    this.cargarVehiculos()
                ]);
                console.log(`Sistema cargado: ${this.seguros.length} seguros encontrados`);
            } catch (error) {
                console.error('Error al inicializar la aplicación:', error);
            }
        },

        beforeDestroy() {
            console.log('Destruyendo aplicación de seguros...');
            SimpleModalManager.hideAll();
        }
    });

    console.log('Aplicación Vue de seguros inicializada correctamente');
});
