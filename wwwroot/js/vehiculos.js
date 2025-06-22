// ============================================
// CONFIGURACIÓN DE AXIOS Y BASE URL
// ============================================
const API_BASE_URL = 'https://localhost:7037';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000
});

// Interceptor de petición: agregar token
apiClient.interceptors.request.use(config => {
    console.log('[Axios] Request –', config.method, config.url);
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor de respuesta: manejo 401
apiClient.interceptors.response.use(
    response => {
        console.log('[Axios] Response –', response.status, response.config.url);
        return response;
    },
    error => {
        console.warn('[Axios] Response Error –', error.response?.status, error.config?.url);
        if (error.response?.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = '/Account/Login';
        }
        return Promise.reject(error);
    }
);

// ============================================
// GESTOR DE MODALES
// ============================================
class SimpleModalManager {
    static activeModals = new Set();

    static show(modalId) {
        console.log(`[ModalManager] show("${modalId}")`);
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`[ModalManager] Modal "${modalId}" no encontrado`);
            return;
        }
        this.hideAll();
        this.createOverlay();

        modalElement.style.display = 'flex';
        modalElement.classList.add('show');

        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('show');

        this.activeModals.add(modalId);
        this.addCloseListeners(modalId);
    }

    static hide(modalId) {
        console.log(`[ModalManager] hide("${modalId}")`);
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.warn(`[ModalManager] Modal "${modalId}" no encontrado`);
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
        console.log('[ModalManager] hideAll()');
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
            modal.style.display = 'none';
        });
        this.activeModals.clear();
        this.cleanup();
    }

    static createOverlay() {
        console.log('[ModalManager] createOverlay()');
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
        console.log('[ModalManager] cleanup()');
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('show');
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    }
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('[Vue] DOMContentLoaded - Inicializando aplicación de vehículos...');

    // Verificar que las dependencias estén cargadas
    if (typeof Vue === 'undefined') {
        console.error('[Vue] Vue.js no está cargado. Verifica que esté incluido en el HTML.');
        return;
    }

    if (typeof axios === 'undefined') {
        console.error('[Vue] Axios no está cargado. Verifica que esté incluido en el HTML.');
        return;
    }

    // Buscar automáticamente el contenedor principal
    let targetElement = document.querySelector('.row.my-4'); // El contenedor principal de tu HTML

    if (!targetElement) {
        // Si no encuentra el contenedor específico, busca el body o main
        targetElement = document.querySelector('main') || document.querySelector('.container') || document.body;
    }

    // Si aún no encuentra nada, crear un contenedor
    if (!targetElement) {
        targetElement = document.createElement('div');
        document.body.appendChild(targetElement);
    }

    // Asignar ID dinámicamente para Vue
    if (!targetElement.id) {
        targetElement.id = 'vehiculos-app-container';
    }

    console.log('[Vue] Montando en elemento:', targetElement);

    // ============================================
    // APLICACIÓN VUE
    // ============================================
    window.vehiculosApp = new Vue({
        el: '#' + targetElement.id,

        data: {
            vehiculos: [],
            vehiculoDetalle: {},
            documentos: [],

            cargando: false,
            cargandoFotos: false,
            guardando: false,
            subiendoDocumento: false,
            editando: false,
            verificandoSeguro: {},

            filtros: {
                estado: '',
                tipo: '',
                marca: ''
            },

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

            documentoUpload: {
                archivo: null,
                descripcion: ''
            },

            documentosSeleccionados: [],

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

        methods: {
            // ------------------------------
            // MODALES
            // ------------------------------
            mostrarDetalles: function (vehiculo) {
                var self = this;
                this.cargarDetallesParaEdicion(vehiculo).then(function () {
                    SimpleModalManager.show('vehicleDetailsModal');
                });
            },

            mostrarModalCrear: function () {
                this.editando = false;
                this.limpiarFormulario();
                SimpleModalManager.show('addVehicleModal');
            },

            mostrarModalEditar: function (vehiculo) {
                var self = this;
                this.editando = true;
                this.cargarDetallesParaEdicion(vehiculo).then(function () {
                    var v = self.vehiculoDetalle;
                    self.vehiculoForm = {
                        id: v.id,
                        marca: v.marca || '',
                        modelo: v.modelo || '',
                        tipo: v.tipo != null ? String(v.tipo) : '',
                        anio: v.anio || new Date().getFullYear(),
                        color: v.color || '',
                        placaFisica: v.placaFisica || '',
                        placaMatricula: v.placaMatricula || '',
                        placaValidadaDGII: v.placaValidadaDGII || '',
                        chasisValidadoDGII: v.chasisValidadoDGII || '',
                        chasis: v.chasis || '',
                        numeroMotor: v.numeroMotor || '',
                        estado: v.estado || 1,
                        notas: v.notas || '',
                        kilometraje: v.kilometraje || 0,
                        fechaAdquisicion: v.fechaAdquisicion ? v.fechaAdquisicion.split('T')[0] : '',
                        numeroActivoFijo: v.numeroActivoFijo || '',
                        registradoContabilidad: v.registradoContabilidad || false,
                        estatusJuridico: v.estatusJuridico || '',
                        ubicacion: v.ubicacion != null ? String(v.ubicacion) : '',
                        numeroPaseRapido: v.numeroPaseRapido || '',
                        estadoMatricula: v.estadoMatricula || ''
                    };
                    self.documentosSeleccionados = [];
                    SimpleModalManager.show('addVehicleModal');
                });
            },

            cargarDetallesParaEdicion: function (vehiculo) {
                var self = this;
                return apiClient.get('/api/Vehiculos/' + vehiculo.id)
                    .then(function (response) {
                        self.vehiculoDetalle = response.data;
                        return self.cargarDocumentosVehiculo(vehiculo.id);
                    })
                    .catch(function (error) {
                        console.error('[Vue] cargarDetallesParaEdicion – error:', error);
                        self.vehiculoDetalle = vehiculo;
                    });
            },

            cerrarModal: function (modalId) {
                SimpleModalManager.hide(modalId);
            },

            // ------------------------------
            // SEGURO
            // ------------------------------
            verificarSeguroVehiculo: function (vehiculoId) {
                var self = this;
                this.$set(this.verificandoSeguro, vehiculoId, true);

                return apiClient.get('/api/Vehiculos/' + vehiculoId + '/seguro')
                    .then(function (response) {
                        var seguroInfo = response.data;
                        self.mostrarInfoSeguro(seguroInfo);
                        return seguroInfo;
                    })
                    .catch(function (error) {
                        console.error('[Vue] verificarSeguroVehiculo – error:', error);
                        self.mostrarError('Error al verificar el seguro del vehículo');
                        return null;
                    })
                    .finally(function () {
                        self.$set(self.verificandoSeguro, vehiculoId, false);
                    });
            },

            mostrarInfoSeguro: function (seguroInfo) {
                var titulo = 'Estado del Seguro - ' + seguroInfo.placaFisica;
                var mensaje = '';
                var tipo = 'info';

                if (seguroInfo.tieneSeguro) {
                    if (seguroInfo.seguroVigente) {
                        tipo = 'success';
                        mensaje = '✅ SEGURO VIGENTE\n\n' +
                            'Aseguradora: ' + seguroInfo.detalleSeguro.aseguradora + '\n' +
                            'Póliza: ' + seguroInfo.detalleSeguro.numeroPoliza + '\n' +
                            'Vigencia: ' + this.formatearFecha(seguroInfo.detalleSeguro.fechaInicio) + ' - ' + this.formatearFecha(seguroInfo.detalleSeguro.fechaVencimiento) + '\n';

                        if (seguroInfo.detalleSeguro.diasParaVencimiento <= 30) {
                            mensaje += '\n⚠️ ATENCIÓN: Vence en ' + seguroInfo.detalleSeguro.diasParaVencimiento + ' días';
                            tipo = 'warning';
                        }
                    } else {
                        tipo = 'error';
                        mensaje = '❌ SEGURO VENCIDO\n\n' +
                            'Aseguradora: ' + seguroInfo.detalleSeguro.aseguradora + '\n' +
                            'Póliza: ' + seguroInfo.detalleSeguro.numeroPoliza + '\n' +
                            'Venció: ' + this.formatearFecha(seguroInfo.detalleSeguro.fechaVencimiento) + '\n' +
                            'Días vencido: ' + Math.abs(seguroInfo.detalleSeguro.diasParaVencimiento);
                    }
                } else {
                    tipo = 'error';
                    mensaje = '❌ SIN SEGURO\n\nEste vehículo no tiene póliza de seguro asignada.';
                }

                this.mostrarNotificacionSeguro(titulo, mensaje, tipo);
            },

            mostrarNotificacionSeguro: function (titulo, mensaje, tipo) {
                if (!tipo) tipo = 'info';
                var modalId = 'modal-seguro-info';
                var modal = document.getElementById(modalId);

                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = modalId;
                    modal.className = 'modal fade';
                    modal.innerHTML =
                        '<div class="modal-dialog modal-dialog-centered">' +
                        '<div class="modal-content">' +
                        '<div class="modal-header ' + this.obtenerClaseHeader(tipo) + '">' +
                        '<h5 class="modal-title">' + titulo + '</h5>' +
                        '<button type="button" class="btn-close btn-close-white" onclick="SimpleModalManager.hide(\'' + modalId + '\')"></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                        '<div class="alert ' + this.obtenerClaseAlerta(tipo) + ' mb-0">' +
                        '<pre style="margin:0; white-space:pre-wrap; font-family:inherit;">' + mensaje + '</pre>' +
                        '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-secondary" onclick="SimpleModalManager.hide(\'' + modalId + '\')">' +
                        '<i class="fas fa-times me-1"></i> Cerrar' +
                        '</button>' +
                        '</div>' +
                        '</div>' +
                        '</div>';
                    document.body.appendChild(modal);
                } else {
                    modal.querySelector('.modal-title').textContent = titulo;
                    modal.querySelector('.modal-header').className = 'modal-header ' + this.obtenerClaseHeader(tipo);
                    modal.querySelector('.alert').className = 'alert ' + this.obtenerClaseAlerta(tipo) + ' mb-0';
                    modal.querySelector('pre').textContent = mensaje;
                }
                SimpleModalManager.show(modalId);
            },

            obtenerClaseHeader: function (tipo) {
                var clases = {
                    success: 'bg-success text-white',
                    error: 'bg-danger text-white',
                    warning: 'bg-warning text-dark',
                    info: 'bg-primary text-white'
                };
                return clases[tipo] || clases.info;
            },

            obtenerClaseAlerta: function (tipo) {
                var clases = {
                    success: 'alert-success',
                    error: 'alert-danger',
                    warning: 'alert-warning',
                    info: 'alert-info'
                };
                return clases[tipo] || clases.info;
            },

            tieneSeguroVigente: function (vehiculoId) {
                console.log('[Vue] tieneSeguroVigente() – verificando ID:', vehiculoId);
                return apiClient.get('/api/Vehiculos/' + vehiculoId + '/seguro')
                    .then(function (response) {
                        console.log('[Vue] tieneSeguroVigente() – respuesta:', response.data);
                        return response.data ? response.data.seguroVigente : false;
                    })
                    .catch(function (e) {
                        console.error('[Vue] tieneSeguroVigente() – error:', e);
                        return false;
                    });
            },

            // ------------------------------
            // GESTIÓN DE VEHÍCULOS
            // ------------------------------
            cargarVehiculos: function () {
                var self = this;
                this.cargando = true;

                return apiClient.get('/api/Vehiculos')
                    .then(function (response) {
                        self.vehiculos = response.data;
                        console.log('[Vue] Vehículos cargados:', self.vehiculos.length);
                    })
                    .catch(function (error) {
                        console.error('[Vue] cargarVehiculos() – error:', error);
                        self.mostrarError('Error al cargar los vehículos');
                    })
                    .finally(function () {
                        self.cargando = false;
                    });
            },

            filtrarVehiculos: function () {
                var self = this;
                this.cargando = true;

                var url = '/api/Vehiculos';
                var promise;

                if (this.filtros.estado && !this.filtros.tipo && !this.filtros.marca) {
                    url = '/api/Vehiculos/estado/' + this.filtros.estado;
                    promise = apiClient.get(url);
                } else if (this.filtros.tipo || this.filtros.marca) {
                    var searchParams = {
                        estado: this.filtros.estado ? parseInt(this.filtros.estado) : null,
                        tipo: this.filtros.tipo ? parseInt(this.filtros.tipo) : null,
                        marca: this.filtros.marca || null
                    };
                    promise = apiClient.post('/api/Vehiculos/buscar', searchParams);
                } else {
                    promise = apiClient.get(url);
                }

                return promise
                    .then(function (response) {
                        self.vehiculos = response.data;
                    })
                    .catch(function (error) {
                        console.error('[Vue] filtrarVehiculos() – error:', error);
                        self.mostrarError('Error al filtrar los vehículos');
                    })
                    .finally(function () {
                        self.cargando = false;
                    });
            },

            guardarVehiculo: function () {
                var self = this;
                this.guardando = true;

                try {
                    // Preparamos FormData
                    var formData = new FormData();
                    if (this.editando) {
                        formData.append('Id', this.vehiculoForm.id.toString());
                    }
                    formData.append('Marca', (this.vehiculoForm.marca || '').trim());
                    formData.append('Modelo', (this.vehiculoForm.modelo || '').trim());
                    formData.append('Tipo', (this.vehiculoForm.tipo || '').toString());
                    formData.append('Anio', (parseInt(this.vehiculoForm.anio) || new Date().getFullYear()).toString());
                    formData.append('Color', (this.vehiculoForm.color || '').trim());
                    formData.append('PlacaFisica', (this.vehiculoForm.placaFisica || '').trim());
                    formData.append('Chasis', (this.vehiculoForm.chasis || '').trim());
                    formData.append('NumeroMotor', (this.vehiculoForm.numeroMotor || '').trim());
                    formData.append('Estado', parseInt(this.vehiculoForm.estado).toString());
                    formData.append('Kilometraje', (parseInt(this.vehiculoForm.kilometraje) || 0).toString());
                    formData.append('FechaAdquisicion', this.vehiculoForm.fechaAdquisicion || new Date().toISOString().split('T')[0]);
                    formData.append('RegistradoContabilidad', Boolean(this.vehiculoForm.registradoContabilidad).toString());

                    // Campos opcionales
                    if (this.vehiculoForm.placaMatricula && this.vehiculoForm.placaMatricula.trim() !== '') {
                        formData.append('PlacaMatricula', this.vehiculoForm.placaMatricula.trim());
                    }
                    if (this.vehiculoForm.placaValidadaDGII && this.vehiculoForm.placaValidadaDGII.trim() !== '') {
                        formData.append('PlacaValidadaDGII', this.vehiculoForm.placaValidadaDGII.trim());
                    }
                    if (this.vehiculoForm.chasisValidadoDGII && this.vehiculoForm.chasisValidadoDGII.trim() !== '') {
                        formData.append('ChasisValidadoDGII', this.vehiculoForm.chasisValidadoDGII.trim());
                    }
                    if (this.vehiculoForm.notas && this.vehiculoForm.notas.trim() !== '') {
                        formData.append('Notas', this.vehiculoForm.notas.trim());
                    }
                    if (this.vehiculoForm.numeroActivoFijo && this.vehiculoForm.numeroActivoFijo.trim() !== '') {
                        formData.append('NumeroActivoFijo', this.vehiculoForm.numeroActivoFijo.trim());
                    }
                    if (this.vehiculoForm.estatusJuridico && this.vehiculoForm.estatusJuridico.trim() !== '') {
                        formData.append('EstatusJuridico', this.vehiculoForm.estatusJuridico.trim());
                    }
                    if (this.vehiculoForm.numeroPaseRapido && this.vehiculoForm.numeroPaseRapido.trim() !== '') {
                        formData.append('NumeroPaseRapido', this.vehiculoForm.numeroPaseRapido.trim());
                    }
                    if (this.vehiculoForm.estadoMatricula && this.vehiculoForm.estadoMatricula.trim() !== '') {
                        formData.append('EstadoMatricula', this.vehiculoForm.estadoMatricula.trim());
                    }
                    if (this.vehiculoForm.ubicacion && this.vehiculoForm.ubicacion !== '' && this.vehiculoForm.ubicacion !== null) {
                        formData.append('Ubicacion', parseInt(this.vehiculoForm.ubicacion).toString());
                    }

                    // Documentos seleccionados
                    if (this.documentosSeleccionados && this.documentosSeleccionados.length > 0) {
                        for (var i = 0; i < this.documentosSeleccionados.length; i++) {
                            formData.append('Documentos', this.documentosSeleccionados[i]);
                        }
                    }

                    var promise;
                    if (this.editando) {
                        promise = apiClient.put('/api/Vehiculos/' + this.vehiculoForm.id, formData);
                    } else {
                        promise = apiClient.post('/api/Vehiculos', formData);
                    }

                    return promise
                        .then(function (response) {
                            if (self.editando) {
                                self.mostrarExito("Vehículo actualizado exitosamente");
                            } else {
                                self.mostrarExito("Vehículo creado exitosamente");
                            }
                            self.cerrarModal("addVehicleModal");
                            return self.cargarVehiculos();
                        })
                        .catch(function (error) {
                            console.error('[Vue] guardarVehiculo() – error:', error);
                            if (error.response && error.response.status === 400 && error.response.data.errors) {
                                var mensajes = [];
                                Object.keys(error.response.data.errors).forEach(function (campo) {
                                    error.response.data.errors[campo].forEach(function (err) {
                                        mensajes.push(campo + ': ' + err);
                                    });
                                });
                                self.mostrarError('Errores de validación:\n' + mensajes.join('\n'));
                            } else if (error.response && error.response.status === 500) {
                                self.mostrarError("Error interno del servidor. Revisar logs.");
                            } else {
                                self.mostrarError("Error al guardar el vehículo. Intente nuevamente.");
                            }
                        })
                        .finally(function () {
                            self.guardando = false;
                        });

                } catch (error) {
                    console.error('[Vue] guardarVehiculo() – error en try/catch:', error);
                    this.mostrarError("Error al guardar el vehículo. Intente nuevamente.");
                    this.guardando = false;
                }
            },

            // ------------------------------
            // ELIMINACIÓN CON CHEQUEO DE SEGURO
            // ------------------------------
            eliminarVehiculoSiSinSeguro: function (vehiculo) {
                var self = this;
                console.log('[Vue] eliminarVehiculoSiSinSeguro() – ID=' + vehiculo.id);

                this.tieneSeguroVigente(vehiculo.id)
                    .then(function (tieneSeguro) {
                        if (tieneSeguro) {
                            self.mostrarError('No se puede eliminar este vehículo porque tiene un seguro vigente.');
                            return;
                        }
                        // Si no tiene seguro, procedemos a eliminar
                        return self.eliminarVehiculo(vehiculo.id);
                    })
                    .catch(function (err) {
                        console.error('[Vue] eliminarVehiculoSiSinSeguro() – error:', err);
                        self.mostrarError('Error al verificar el seguro. Intente nuevamente.');
                    });
            },

            eliminarVehiculo: function (vehiculoId) {
                var self = this;
                if (!confirm('¿Está seguro de que desea eliminar este vehículo?')) {
                    return;
                }

                return apiClient.delete('/api/Vehiculos/' + vehiculoId)
                    .then(function () {
                        self.mostrarExito('Vehículo eliminado exitosamente');
                        return self.cargarVehiculos();
                    })
                    .catch(function (error) {
                        console.error('[Vue] eliminarVehiculo() – error:', error);
                        self.mostrarError('Error al eliminar el vehículo');
                    });
            },

            // ------------------------------
            // DOCUMENTOS
            // ------------------------------
            cargarDocumentosVehiculo: function (vehiculoId) {
                var self = this;
                this.cargandoFotos = true;

                return apiClient.get('/api/Vehiculos/' + vehiculoId + '/documentos')
                    .then(function (response) {
                        self.documentos = response.data;
                    })
                    .catch(function (error) {
                        console.error('[Vue] cargarDocumentosVehiculo() – error:', error);
                        self.documentos = [];
                    })
                    .finally(function () {
                        self.cargandoFotos = false;
                    });
            },

            descargarDocumento: function (documentoId) {
                var self = this;

                apiClient.get('/api/Documentos/' + documentoId)
                    .then(function (infoResponse) {
                        return apiClient.get('/api/Documentos/' + documentoId + '/Contenido', { responseType: 'blob' })
                            .then(function (response) {
                                var url = window.URL.createObjectURL(new Blob([response.data]));
                                var link = document.createElement('a');
                                link.href = url;

                                var filename = infoResponse.data.nombre || 'documento';
                                if (filename.indexOf('.') === -1) {
                                    var contentType = response.headers['content-type'];
                                    var extension = self.obtenerExtensionPorContentType(contentType);
                                    if (extension) filename += '.' + extension;
                                }

                                link.setAttribute('download', filename);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);

                                self.mostrarExito('Documento "' + filename + '" descargado exitosamente');
                            });
                    })
                    .catch(function (error) {
                        console.error('[Vue] descargarDocumento() – error:', error);
                        self.mostrarError('Error al descargar el documento');
                    });
            },

            eliminarDocumento: function (documentoId) {
                var self = this;
                if (!confirm('¿Está seguro de que desea eliminar este documento?')) return;

                apiClient.delete('/api/Documentos/' + documentoId)
                    .then(function () {
                        self.mostrarExito('Documento eliminado exitosamente');
                        return self.cargarDocumentosVehiculo(self.vehiculoDetalle.id);
                    })
                    .catch(function (error) {
                        console.error('[Vue] eliminarDocumento() – error:', error);
                        self.mostrarError('Error al eliminar el documento');
                    });
            },

            seleccionarDocumentos: function (event) {
                this.documentosSeleccionados = Array.from(event.target.files);
            },

            // ------------------------------
            // UTILIDADES DE DOCUMENTOS
            // ------------------------------
            obtenerExtension: function (filename) {
                if (!filename) return '';
                var parts = filename.split('.');
                return parts.length > 1 ? parts.pop().toUpperCase() : '';
            },

            obtenerTipoDocumento: function (filename) {
                var ext = this.obtenerExtension(filename).toLowerCase();
                var tipos = {
                    pdf: 'PDF', doc: 'Word', docx: 'Word',
                    xls: 'Excel', xlsx: 'Excel',
                    ppt: 'PowerPoint', pptx: 'PowerPoint',
                    jpg: 'Imagen', jpeg: 'Imagen', png: 'Imagen', gif: 'Imagen',
                    txt: 'Texto', zip: 'Archivo', rar: 'Archivo'
                };
                return tipos[ext] || 'Documento';
            },

            obtenerExtensionPorContentType: function (contentType) {
                var mime = {
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
                return mime[contentType] || null;
            },

            formatearTamano: function (bytes) {
                if (!bytes) return 'N/A';
                var sizes = ['Bytes', 'KB', 'MB', 'GB'];
                if (bytes === 0) return '0 Bytes';
                var i = Math.floor(Math.log(bytes) / Math.log(1024));
                return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
            },

            // ------------------------------
            // UTILIDADES GENERALES
            // ------------------------------
            limpiarFormulario: function () {
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
                this.vehiculoDetalle = {};
                this.documentos = [];

                var inputDocsCreate = document.getElementById('vehicleDocumentsCreate');
                if (inputDocsCreate) inputDocsCreate.value = '';
                var inputDocsEdit = document.getElementById('vehicleDocumentsEdit');
                if (inputDocsEdit) inputDocsEdit.value = '';
            },

            obtenerPlacaFisica: function (vehiculo) {
                if (!vehiculo) return 'N/A';
                return vehiculo.placaFisica || vehiculo.placa || 'Sin placa física';
            },

            obtenerTextoTipo: function (tipoId) {
                if (!tipoId && tipoId !== 0) return 'Sin especificar';
                var tipo = this.tiposVehiculo.find(function (t) {
                    return t.value === tipoId.toString();
                });
                return tipo ? tipo.text : 'Tipo ' + tipoId;
            },

            obtenerTextoUbicacion: function (ubicacionId) {
                if (!ubicacionId && ubicacionId !== 0) return 'Sin especificar';
                var ubi = this.ubicacionesVehiculo.find(function (u) {
                    return u.value === ubicacionId.toString();
                });
                return ubi ? ubi.text : 'Ubicación ' + ubicacionId;
            },

            estadoClass: function (estado) {
                if (!estado && estado !== 0) return 'badge bg-secondary';
                var clases = {
                    1: 'badge bg-success',    // Disponible
                    2: 'badge bg-warning text-dark', // Asignado
                    3: 'badge bg-info',       // En Taller
                    4: 'badge bg-secondary',  // No Disponible
                    5: 'badge bg-danger'      // De Baja
                };
                return clases[estado] || 'badge bg-secondary';
            },

            estadoTexto: function (estado) {
                if (!estado && estado !== 0) return 'Sin estado';
                var textos = {
                    1: 'Disponible',
                    2: 'Asignado',
                    3: 'En Taller',
                    4: 'No Disponible',
                    5: 'De Baja'
                };
                return textos[estado] || 'Estado ' + estado;
            },

            formatearFecha: function (fecha) {
                if (!fecha) return 'No especificada';
                try {
                    return new Date(fecha).toLocaleDateString('es-DO');
                } catch (error) {
                    return 'Fecha inválida';
                }
            },

            // ------------------------------
            // NOTIFICACIONES FLOTANTES
            // ------------------------------
            mostrarError: function (mensaje) {
                this.mostrarNotificacion(mensaje, 'error');
            },

            mostrarExito: function (mensaje) {
                this.mostrarNotificacion(mensaje, 'success');
            },

            mostrarNotificacion: function (mensaje, tipo) {
                if (!tipo) tipo = 'info';

                var container = document.getElementById('notification-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'notification-container';
                    container.style.cssText =
                        'position: fixed;' +
                        'top: 20px;' +
                        'right: 20px;' +
                        'z-index: 9999;' +
                        'max-width: 400px;';
                    document.body.appendChild(container);
                }

                var notification = document.createElement('div');
                var iconos = { success: '✓', error: '✗', info: 'ℹ' };
                var colores = { success: '#6bbd4a', error: '#e74c3c', info: '#3a9bd9' };

                notification.style.cssText =
                    'background: white;' +
                    'border-left: 4px solid ' + colores[tipo] + ';' +
                    'border-radius: 8px;' +
                    'box-shadow: 0 4px 12px rgba(0,0,0,0.1);' +
                    'padding: 1rem;' +
                    'margin-bottom: 0.5rem;' +
                    'display: flex;' +
                    'align-items: center;' +
                    'transform: translateX(100%);' +
                    'transition: transform 0.3s ease;';

                notification.innerHTML =
                    '<span style="color: ' + colores[tipo] + '; font-weight: bold; margin-right: 10px; font-size: 1.2rem;">' +
                    iconos[tipo] +
                    '</span>' +
                    '<span style="color: #2d3748;">' + mensaje + '</span>';

                container.appendChild(notification);

                // Mostrar
                setTimeout(function () {
                    notification.style.transform = 'translateX(0)';
                }, 100);

                // Desaparecer
                setTimeout(function () {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(function () {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 4000);

                notification.addEventListener('click', function () {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(function () {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                });
            }
        },

        mounted: function () {
            var self = this;
            var token = localStorage.getItem('authToken');
            if (!token) {
                window.location.href = '/Account/Login';
                return;
            }

            console.log('[Vue] Aplicación montada, cargando vehículos...');
            this.cargarVehiculos().then(function () {
                console.log('[Vue] Vehículos cargados exitosamente');
            });
        },

        beforeDestroy: function () {
            SimpleModalManager.hideAll();
            var container = document.getElementById('notification-container');
            if (container) container.remove();
        }
    });

    console.log('[Vue] Aplicación de vehículos inicializada exitosamente.');
});