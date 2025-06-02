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
// GESTOR DE MODALES SIMPLIFICADO
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

        // Limpiar estado previo
        this.hideAll();

        // Crear overlay si no existe
        this.createOverlay();

        // Mostrar modal
        modalElement.style.display = 'flex';
        modalElement.classList.add('show');

        // Mostrar overlay
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }

        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';

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
        // Restaurar scroll del body
        document.body.style.overflow = '';

        // Ocultar overlay
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }

        // Limpiar cualquier backdrop de Bootstrap
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });

        // Limpiar clases del body
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';

        console.log('Cleanup de modales completado');
    }
}

// ============================================
// APLICACIÓN VUE DE VEHÍCULOS
// ============================================

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando aplicación de vehículos...');

    // Instancia de Vue para el módulo de vehículos (GLOBAL para acceso desde modales)
    window.vehiculosApp = new Vue({
        el: '#vehiculos-app',

        // ============================================
        // DATOS REACTIVOS
        // ============================================
        data: {
            // Datos principales
            vehiculos: [],
            vehiculoDetalle: {},
            documentos: [],

            // Estados de carga
            cargando: false,
            cargandoFotos: false, // Renombrar después a cargandoDocumentos
            guardando: false,
            subiendoDocumento: false,
            editando: false,

            // Filtros
            filtros: {
                estado: '',
                tipo: '',
                marca: ''
            },

            // Formulario de vehículo
            vehiculoForm: {
                id: null,
                marca: '',
                modelo: '',
                tipo: '',
                anio: new Date().getFullYear(),
                color: '',
                placaFisica: '',
                placaMatricula: '',
                placaValidadaDGII: '',
                chasisValidadoDGII: '',
                chasis: '',
                numeroMotor: '',
                estado: 1,
                notas: '',
                kilometraje: 0,
                fechaAdquisicion: '',
                numeroActivoFijo: '',
                registradoContabilidad: false,
                estatusJuridico: '',
                ubicacion: '',
                numeroPaseRapido: '',
                estadoMatricula: ''
            },

            // Subida de documentos
            documentoUpload: {
                archivo: null,
                descripcion: ''
            },

            // Archivos seleccionados
            documentosSeleccionados: [],

            // Catálogos
            tiposVehiculo: [
                { value: '1', text: 'Sedán' },
                { value: '2', text: 'SUV' },
                { value: '3', text: 'Pickup' },
                { value: '4', text: 'Van' },
                { value: '5', text: 'Camión' },
                { value: '6', text: 'Motocicleta' },
                { value: '7', text: 'Bus' },
                { value: '8', text: 'Otros' }
            ],

            ubicacionesVehiculo: [
                { value: '1', text: 'Oficina Principal' },
                { value: '2', text: 'Sede Regional Norte' },
                { value: '3', text: 'Sede Regional Sur' },
                { value: '4', text: 'Sede Regional Este' },
                { value: '5', text: 'Sede Regional Oeste' },
                { value: '6', text: 'Taller Mecánico' },
                { value: '7', text: 'En Campo' },
                { value: '8', text: 'Almacén' },
                { value: '9', text: 'En Mantenimiento' },
                { value: '10', text: 'Otros' }
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
                SimpleModalManager.show('addVehicleModal');
            },

            mostrarModalEditar(vehiculo) {
                console.log('=== MOSTRAR MODAL EDITAR ===');
                console.log('Editando vehículo:', vehiculo);
                this.editando = true;

                // Mapear correctamente los campos del vehículo según el DTO completo
                this.vehiculoForm = {
                    id: vehiculo.id,
                    marca: vehiculo.marca || '',
                    modelo: vehiculo.modelo || '',
                    tipo: vehiculo.tipo ? vehiculo.tipo.toString() : '',
                    anio: vehiculo.anio || new Date().getFullYear(),
                    color: vehiculo.color || '',
                    placaFisica: vehiculo.placaFisica || '',
                    placaMatricula: vehiculo.placaMatricula || '',
                    placaValidadaDGII: vehiculo.placaValidadaDGII || '',
                    chasisValidadoDGII: vehiculo.chasisValidadoDGII || '',
                    chasis: vehiculo.chasis || '',
                    numeroMotor: vehiculo.numeroMotor || '',
                    estado: vehiculo.estado || 1,
                    notas: vehiculo.notas || '',
                    kilometraje: vehiculo.kilometraje || 0,
                    fechaAdquisicion: vehiculo.fechaAdquisicion ? vehiculo.fechaAdquisicion.split('T')[0] : '',
                    numeroActivoFijo: vehiculo.numeroActivoFijo || '',
                    registradoContabilidad: vehiculo.registradoContabilidad || false,
                    estatusJuridico: vehiculo.estatusJuridico || '',
                    ubicacion: vehiculo.ubicacion || '',
                    numeroPaseRapido: vehiculo.numeroPaseRapido || '',
                    estadoMatricula: vehiculo.estadoMatricula || ''
                };

                // Limpiar archivos seleccionados
                this.documentosSeleccionados = [];

                SimpleModalManager.show('addVehicleModal');
            },

            async mostrarDetalles(vehiculo) {
                console.log('=== MOSTRAR DETALLES ===');
                console.log('Mostrando detalles de vehículo:', vehiculo);
                try {
                    // Cargar detalles completos del vehículo
                    const response = await apiClient.get(`/api/Vehiculos/${vehiculo.id}`);
                    this.vehiculoDetalle = response.data;
                    console.log('Detalles cargados:', this.vehiculoDetalle);

                    // Cargar documentos del vehículo
                    await this.cargarDocumentosVehiculo(vehiculo.id);

                    SimpleModalManager.show('vehicleDetailsModal');

                } catch (error) {
                    console.error('Error al cargar detalles del vehículo:', error);
                    this.mostrarError('Error al cargar los detalles del vehículo');
                }
            },

            cerrarModal(modalId) {
                console.log('=== CERRAR MODAL ===', modalId);
                SimpleModalManager.hide(modalId);
            },

            // ========== GESTIÓN DE VEHÍCULOS ==========

            async cargarVehiculos() {
                this.cargando = true;
                try {
                    console.log('Cargando vehículos desde:', `${API_BASE_URL}/api/Vehiculos`);

                    const response = await apiClient.get('/api/Vehiculos');
                    this.vehiculos = response.data;

                    console.log('Vehículos cargados:', this.vehiculos.length);

                    // Debug para ver la estructura de los datos
                    if (this.vehiculos.length > 0) {
                        console.log('Primer vehículo:', this.vehiculos[0]);
                    }
                } catch (error) {
                    console.error('Error al cargar vehículos:', error);
                    this.mostrarError('Error al cargar los vehículos');
                } finally {
                    this.cargando = false;
                }
            },

            async filtrarVehiculos() {
                this.cargando = true;
                try {
                    let url = '/api/Vehiculos';

                    // Si hay filtros específicos, usar endpoints especializados
                    if (this.filtros.estado && !this.filtros.tipo && !this.filtros.marca) {
                        url = `/api/Vehiculos/estado/${this.filtros.estado}`;
                    } else if (this.filtros.tipo || this.filtros.marca) {
                        // Usar endpoint de búsqueda para filtros complejos
                        const searchParams = {
                            estado: this.filtros.estado ? parseInt(this.filtros.estado) : null,
                            tipo: this.filtros.tipo ? parseInt(this.filtros.tipo) : null,
                            marca: this.filtros.marca || null
                        };

                        const response = await apiClient.post('/api/Vehiculos/buscar', searchParams);
                        this.vehiculos = response.data;
                        return;
                    }

                    const response = await apiClient.get(url);
                    this.vehiculos = response.data;

                } catch (error) {
                    console.error('Error al filtrar vehículos:', error);
                    this.mostrarError('Error al filtrar los vehículos');
                } finally {
                    this.cargando = false;
                }
            },

            async guardarVehiculo() {
                this.guardando = true;
                try {
                    // Preparar FormData para envío de archivos
                    const formData = new FormData();

                    // Mapear los campos según el DTO del backend
                    const vehiculoData = {
                        marca: this.vehiculoForm.marca,
                        modelo: this.vehiculoForm.modelo,
                        tipo: parseInt(this.vehiculoForm.tipo),
                        anio: parseInt(this.vehiculoForm.anio),
                        color: this.vehiculoForm.color,
                        placaFisica: this.vehiculoForm.placaFisica,
                        placaMatricula: this.vehiculoForm.placaMatricula || null,
                        placaValidadaDGII: this.vehiculoForm.placaValidadaDGII || null,
                        chasisValidadoDGII: this.vehiculoForm.chasisValidadoDGII || null,
                        chasis: this.vehiculoForm.chasis,
                        numeroMotor: this.vehiculoForm.numeroMotor,
                        estado: parseInt(this.vehiculoForm.estado),
                        notas: this.vehiculoForm.notas || null,
                        kilometraje: parseInt(this.vehiculoForm.kilometraje) || 0,
                        fechaAdquisicion: this.vehiculoForm.fechaAdquisicion,
                        numeroActivoFijo: this.vehiculoForm.numeroActivoFijo || null,
                        registradoContabilidad: this.vehiculoForm.registradoContabilidad || false,
                        estatusJuridico: this.vehiculoForm.estatusJuridico || null,
                        ubicacion: this.vehiculoForm.ubicacion ? parseInt(this.vehiculoForm.ubicacion) : null,
                        numeroPaseRapido: this.vehiculoForm.numeroPaseRapido || null,
                        estadoMatricula: this.vehiculoForm.estadoMatricula || null
                    };

                    if (this.editando && this.vehiculoForm.id) {
                        // Para edición, usar JSON en lugar de FormData si no hay documentos nuevos
                        if (!this.documentosSeleccionados || this.documentosSeleccionados.length === 0) {
                            vehiculoData.id = this.vehiculoForm.id;
                            console.log(`Actualizando vehículo ID: ${this.vehiculoForm.id} sin documentos`);

                            const response = await apiClient.put(`/api/Vehiculos/${this.vehiculoForm.id}`, vehiculoData, {
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });
                        } else {
                            // Si hay documentos nuevos, usar FormData
                            Object.keys(vehiculoData).forEach(key => {
                                if (vehiculoData[key] !== null && vehiculoData[key] !== '' && vehiculoData[key] !== undefined) {
                                    formData.append(key, vehiculoData[key]);
                                }
                            });
                            formData.append('id', this.vehiculoForm.id);

                            this.documentosSeleccionados.forEach((doc) => {
                                formData.append('documentos', doc);
                            });

                            console.log(`Actualizando vehículo ID: ${this.vehiculoForm.id} con documentos`);
                            const response = await apiClient.put(`/api/Vehiculos/${this.vehiculoForm.id}`, formData, {
                                headers: {
                                    'Content-Type': 'multipart/form-data'
                                }
                            });
                        }
                    } else {
                        // Para creación, siempre usar FormData
                        Object.keys(vehiculoData).forEach(key => {
                            if (vehiculoData[key] !== null && vehiculoData[key] !== '' && vehiculoData[key] !== undefined) {
                                formData.append(key, vehiculoData[key]);
                            }
                        });

                        // Agregar documentos si hay seleccionados
                        if (this.documentosSeleccionados && this.documentosSeleccionados.length > 0) {
                            this.documentosSeleccionados.forEach((doc) => {
                                formData.append('documentos', doc);
                            });
                        }

                        console.log('Creando nuevo vehículo');
                        const response = await apiClient.post('/api/Vehiculos', formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                    }

                    this.mostrarExito(this.editando ? 'Vehículo actualizado exitosamente' : 'Vehículo creado exitosamente');

                    // Cerrar modal
                    this.cerrarModal('addVehicleModal');

                    // Recargar lista de vehículos
                    await this.cargarVehiculos();

                } catch (error) {
                    console.error('Error al guardar vehículo:', error);
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
                        this.mostrarError('Error al guardar el vehículo');
                    }
                } finally {
                    this.guardando = false;
                }
            },

            async eliminarVehiculo(vehiculoId) {
                if (!confirm('¿Está seguro de que desea eliminar este vehículo?')) {
                    return;
                }

                try {
                    await apiClient.delete(`/api/Vehiculos/${vehiculoId}`);
                    this.mostrarExito('Vehículo eliminado exitosamente');
                    await this.cargarVehiculos();
                } catch (error) {
                    console.error('Error al eliminar vehículo:', error);
                    this.mostrarError('Error al eliminar el vehículo');
                }
            },

            // ========== GESTIÓN DE DOCUMENTOS ==========

            async cargarDocumentosVehiculo(vehiculoId) {
                this.cargandoFotos = true;
                try {
                    console.log(`Cargando documentos para vehículo ID: ${vehiculoId}`);

                    const response = await apiClient.get(`/api/Vehiculos/${vehiculoId}/documentos`);
                    this.documentos = response.data;

                    console.log('Documentos cargados:', this.documentos);

                } catch (error) {
                    console.error('Error al cargar documentos:', error);
                    this.documentos = [];
                } finally {
                    this.cargandoFotos = false;
                }
            },

            async descargarDocumento(documentoId) {
                try {
                    // Primero obtener información del documento
                    const infoResponse = await apiClient.get(`/api/Documentos/${documentoId}`);
                    const documentoInfo = infoResponse.data;

                    // Luego descargar el contenido
                    const response = await apiClient.get(`/api/Documentos/${documentoId}/Contenido`, {
                        responseType: 'blob'
                    });

                    // Crear URL para descarga
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;

                    // Usar el nombre original del archivo con su extensión
                    let filename = documentoInfo.nombre || 'documento';

                    // Si no tiene extensión, intentar obtenerla del Content-Type
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
                    await this.cargarDocumentosVehiculo(this.vehiculoDetalle.id);
                } catch (error) {
                    console.error('Error al eliminar documento:', error);
                    this.mostrarError('Error al eliminar el documento');
                }
            },

            mostrarModalSubirDocumento() {
                this.documentoUpload = {
                    archivo: null,
                    descripcion: ''
                };

                // Limpiar input de archivo
                const inputFile = document.getElementById('documentFile');
                if (inputFile) {
                    inputFile.value = '';
                }

                SimpleModalManager.show('uploadDocumentModal');
            },

            seleccionarArchivoDocumento(event) {
                const file = event.target.files[0];
                if (file) {
                    this.documentoUpload.archivo = file;
                }
            },

            async subirDocumento() {
                if (!this.documentoUpload.archivo) {
                    this.mostrarError('Debe seleccionar un archivo');
                    return;
                }

                this.subiendoDocumento = true;
                try {
                    const formData = new FormData();
                    formData.append('archivo', this.documentoUpload.archivo);
                    formData.append('descripcion', this.documentoUpload.descripcion || '');
                    formData.append('vehiculoId', this.vehiculoDetalle.id);

                    await apiClient.post(`/api/Vehiculos/${this.vehiculoDetalle.id}/documentos`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    this.mostrarExito('Documento subido exitosamente');
                    this.cerrarModal('uploadDocumentModal');

                    // Recargar documentos
                    await this.cargarDocumentosVehiculo(this.vehiculoDetalle.id);
                } catch (error) {
                    console.error('Error al subir documento:', error);
                    this.mostrarError('Error al subir el documento');
                } finally {
                    this.subiendoDocumento = false;
                }
            },

            // ========== FUNCIONES DE ARCHIVOS ==========

            seleccionarDocumentos(event) {
                this.documentosSeleccionados = Array.from(event.target.files);
                console.log('Documentos seleccionados:', this.documentosSeleccionados.length);
            },

            // ========== UTILIDADES DE DOCUMENTOS ==========

            obtenerExtension(filename) {
                if (!filename) return '';
                const parts = filename.split('.');
                return parts.length > 1 ? parts.pop().toUpperCase() : '';
            },

            obtenerTipoDocumento(filename) {
                const extension = this.obtenerExtension(filename).toLowerCase();

                const tipos = {
                    'pdf': 'PDF',
                    'doc': 'Word',
                    'docx': 'Word',
                    'xls': 'Excel',
                    'xlsx': 'Excel',
                    'ppt': 'PowerPoint',
                    'pptx': 'PowerPoint',
                    'jpg': 'Imagen',
                    'jpeg': 'Imagen',
                    'png': 'Imagen',
                    'gif': 'Imagen',
                    'txt': 'Texto',
                    'zip': 'Archivo',
                    'rar': 'Archivo'
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
                    'application/vnd.ms-powerpoint': 'ppt',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'text/plain': 'txt',
                    'application/zip': 'zip',
                    'application/x-rar-compressed': 'rar'
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
                this.vehiculoForm = {
                    id: null,
                    marca: '',
                    modelo: '',
                    tipo: '',
                    anio: new Date().getFullYear(),
                    color: '',
                    placaFisica: '',
                    placaMatricula: '',
                    placaValidadaDGII: '',
                    chasisValidadoDGII: '',
                    chasis: '',
                    numeroMotor: '',
                    estado: 1,
                    notas: '',
                    kilometraje: 0,
                    fechaAdquisicion: '',
                    numeroActivoFijo: '',
                    registradoContabilidad: false,
                    estatusJuridico: '',
                    ubicacion: '',
                    numeroPaseRapido: '',
                    estadoMatricula: ''
                };
                this.documentosSeleccionados = [];

                // Limpiar inputs de archivos
                const inputDocs = document.getElementById('vehicleDocuments');
                if (inputDocs) inputDocs.value = '';
            },

            obtenerPlacaFisica(vehiculo) {
                if (!vehiculo) return 'N/A';
                return vehiculo.placaFisica || vehiculo.placa || 'Sin placa física';
            },

            obtenerTextoTipo(tipoId) {
                if (!tipoId && tipoId !== 0) {
                    return 'Sin especificar';
                }
                const tipo = this.tiposVehiculo.find(t => t.value === tipoId.toString());
                return tipo ? tipo.text : `Tipo ${tipoId}`;
            },

            obtenerTextoUbicacion(ubicacionId) {
                if (!ubicacionId && ubicacionId !== 0) {
                    return 'Sin especificar';
                }
                const ubicacion = this.ubicacionesVehiculo.find(u => u.value === ubicacionId.toString());
                return ubicacion ? ubicacion.text : `Ubicación ${ubicacionId}`;
            },

            estadoClass(estado) {
                if (!estado && estado !== 0) return 'badge bg-secondary';

                const estados = {
                    1: 'badge bg-success',      // Disponible
                    2: 'badge bg-warning text-dark',      // Asignado
                    3: 'badge bg-info',         // En Taller
                    4: 'badge bg-secondary',    // No Disponible
                    5: 'badge bg-danger'        // De Baja
                };
                return estados[estado] || 'badge bg-secondary';
            },

            estadoTexto(estado) {
                if (!estado && estado !== 0) return 'Sin estado';

                const estados = {
                    1: 'Disponible',
                    2: 'Asignado',
                    3: 'En Taller',
                    4: 'No Disponible',
                    5: 'De Baja'
                };
                return estados[estado] || `Estado ${estado}`;
            },

            formatearFecha(fecha) {
                if (!fecha) return 'No especificada';
                return new Date(fecha).toLocaleDateString('es-DO');
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
        }, // ========== FIN DE METHODS ==========

        // ============================================
        // CICLO DE VIDA DEL COMPONENTE
        // ============================================

        async mounted() {
            console.log('Vue mounted - Iniciando aplicación de vehículos...');

            // Verificar autenticación
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('No hay token, redirigiendo al login...');
                window.location.href = '/Account/Login';
                return;
            }

            console.log('Token encontrado, cargando vehículos...');

            // Cargar vehículos iniciales
            await this.cargarVehiculos();

            console.log('App inicializada correctamente');
        },

        beforeDestroy() {
            // Limpiar modales al salir
            SimpleModalManager.hideAll();

            // Limpiar contenedor de notificaciones
            const container = document.getElementById('notification-container');
            if (container) {
                container.remove();
            }
        }
    }); // ========== FIN DE VUE INSTANCE ==========

    console.log('Aplicación Vue de vehículos inicializada correctamente');
}); // ========== FIN DE DOMContentLoaded ==========