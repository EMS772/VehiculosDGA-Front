// Reporte.js
// Este archivo maneja la lógica de generación de reportes y visualización de estadísticas
       
       console.log('🔧 Verificando librerías...');
        console.log('Vue disponible:', typeof Vue !== 'undefined' ? '✅' : '❌');
        console.log('Chart.js disponible:', typeof Chart !== 'undefined' ? '✅' : '❌');

        const apiBase = "https://localhost:7037";
        const documentosApiBase = "https://localhost:7037/api/Documentos";
        
        new Vue({
            el: '#reportes-app',
            data: {
                usuarioActual: null,
                reporteForm: {
                    tipo: '',
                    formatoSalida: 'pdf',
                    periodo: 'all',
                    fechaDesde: '',
                    fechaHasta: '',
                    estadoVehiculo: [],
                    estadoAsignacion: [],
                    departamento: [],
                    tipoVehiculo: [],
                    notas: ''
                },
                filtroGrafico: {
                    periodo: 'Últimos 6 meses',
                    año: '2023'
                },
                filtroHistorial: {
                    fechaDesde: '',
                    fechaHasta: '',
                    soloMisReportes: false
                },
                mostrarResultados: false,
                cargandoReporte: false,
                cargandoExport: false,
                cargandoHistorial: false,
                columnasReporte: [],
                datosReporte: [],
                tituloReporte: '',
                historialReportes: [],
                estadisticasReportes: null,
                paginaActualHistorial: 1,
                itemsPorPaginaHistorial: 10,
                vehicleStatusChart: null,
                maintenanceCostChart: null,
                ultimaActualizacionGraficos: null,
                actualizandoGraficos: false
            },
            computed: {
                totalPaginasHistorial() {
                    return Math.ceil(this.historialReportes.length / this.itemsPorPaginaHistorial);
                },
                historialPaginado() {
                    const inicio = (this.paginaActualHistorial - 1) * this.itemsPorPaginaHistorial;
                    const fin = inicio + this.itemsPorPaginaHistorial;
                    return this.historialReportes.slice(inicio, fin);
                },
                paginasVisiblesHistorial() {
                    const total = this.totalPaginasHistorial;
                    const actual = this.paginaActualHistorial;
                    const visibles = [];
                    
                    // Mostrar páginas alrededor de la actual
                    const inicio = Math.max(2, actual - 1);
                    const fin = Math.min(total - 1, actual + 1);
                    
                    for (let i = inicio; i <= fin; i++) {
                        visibles.push(i);
                    }
                    
                    return visibles;
                }
            },
            mounted() {
                console.log('🚀 App de reportes iniciada');
                this.verificarAutenticacion();
                this.cargarHistorialReportes();
                this.cargarEstadisticasReportes();

                // Esperar a que Chart.js esté disponible y el DOM esté listo
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.verificarChart();
                        this.inicializarGraficos();
                    }, 500);
                });
            },
            methods: {
                 verificarChart() {
                    console.log('🔧 Verificando Chart.js...');
                    console.log('Chart disponible:', typeof Chart !== 'undefined' ? '✅' : '❌');
                    
                    if (typeof Chart === 'undefined') {
                        console.error('❌ Chart.js no está cargado. Cargando desde CDN...');
                        this.cargarChartJS();
                        return false;
                    }
                    
                    console.log('Chart.js versión:', Chart.version || 'Desconocida');
                    return true;
                },

                cargarChartJS() {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
                    script.onload = () => {
                        console.log('✅ Chart.js cargado dinámicamente');
                        setTimeout(() => {
                            this.inicializarGraficos();
                        }, 100);
                    };
                    document.head.appendChild(script);
                },
                // ========== MÉTODOS PARA REPORTES RÁPIDOS CON NUEVOS ENDPOINTS ==========
                async generarReporteRapido(tipo) {
                    console.log('🚀 Generando reporte rápido con nuevo endpoint:', tipo);
                    
                    const boton = event.target.closest('button');
                    
                    // Cambiar estado del botón
                    this.cambiarEstadoBoton(boton, true, 'Generando...');
                    
                    try {
                        // Usar los nuevos endpoints que guardan en base de datos
                        const resultado = await this.llamarAPIReporteYGuardar(tipo);
                        
                        this.mostrarNotificacion('success', resultado.message);
                        
                        // Recargar historial para mostrar el nuevo reporte
                        await this.cargarHistorialReportes();
                        await this.cargarEstadisticasReportes();
                        
                        console.log('✅ Reporte generado y guardado:', resultado);
                        
                    } catch (error) {
                        console.error('💥 Error:', error);
                        this.mostrarNotificacion('error', `Error: ${error.message}`);
                        
                    } finally {
                        // Siempre restaurar el botón
                        this.cambiarEstadoBoton(boton, false, 'Generar');
                    }
                },

                async llamarAPIReporteYGuardar(tipo) {
                    const apiUrls = {
                        'vehicles': '/api/Reportes/vehiculosActivos/generar-y-guardar',
                        'assignments': '/api/Reportes/asignacionesActivas/generar-y-guardar', 
                        'maintenance': '/api/Reportes/mantenimientosPendientes/generar-y-guardar',
                        'insurance': '/api/Reportes/segurosPorVencer/generar-y-guardar'
                    };
                    
                    const apiUrl = `${apiBase}${apiUrls[tipo]}`;
                    
                    // Para mantenimientos e insurance, podemos agregar parámetros de días de antelación
                    let urlConParametros = apiUrl;
                    if (tipo === 'maintenance' || tipo === 'insurance') {
                        urlConParametros += '?diasAntelacion=30'; // Por defecto 30 días
                    }
                    
                    const response = await fetch(urlConParametros, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        let errorMessage;
                        
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMessage = errorJson.error || errorJson.message || `Error ${response.status}`;
                        } catch {
                            errorMessage = errorText || `Error ${response.status}: ${response.statusText}`;
                        }
                        
                        throw new Error(errorMessage);
                    }
                    
                    const resultado = await response.json();
                    
                    if (!resultado.documentoId) {
                        throw new Error('El servidor no devolvió un ID de documento válido');
                    }
                    
                    return resultado;
                },

                // ========== MÉTODOS PARA HISTORIAL DE REPORTES ==========
                async cargarHistorialReportes() {
                    this.cargandoHistorial = true;
                    console.log('📊 Cargando historial de reportes...');
                    
                    try {
                        // Construir URL con filtros
                        let url = `${apiBase}/api/Reportes/historial`;
                        const params = new URLSearchParams();
                        
                        if (this.filtroHistorial.fechaDesde) {
                            params.append('fechaDesde', this.filtroHistorial.fechaDesde);
                        }
                        
                        if (this.filtroHistorial.fechaHasta) {
                            params.append('fechaHasta', this.filtroHistorial.fechaHasta);
                        }
                        
                        if (this.filtroHistorial.soloMisReportes) {
                            params.append('soloMisReportes', 'true');
                        }
                        
                        if (params.toString()) {
                            url += '?' + params.toString();
                        }
                        
                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        this.historialReportes = data.reportes || [];
                        
                        // Recalcular paginación después de cargar los datos
                        this.recalcularPaginacionHistorial();
                        
                        console.log('📋 Historial cargado:', this.historialReportes.length, 'reportes');
                        
                    } catch (error) {
                        console.error('❌ Error al cargar historial:', error);
                        this.mostrarNotificacion('error', 'Error al cargar el historial de reportes');
                        this.historialReportes = [];
                        
                    } finally {
                        this.cargandoHistorial = false;
                    }
                },

                                // Método para ir a la primera página
                irAPrimeraPagina() {
                    this.cambiarPaginaHistorial(1);
                },
                
                // Método para ir a la última página
                irAUltimaPagina() {
                    this.cambiarPaginaHistorial(this.totalPaginasHistorial);
                },
                
                // Método para ir a una página específica
                irAPagina(pagina) {
                    const paginaNum = parseInt(pagina);
                    if (!isNaN(paginaNum) && paginaNum >= 1 && paginaNum <= this.totalPaginasHistorial) {
                        this.cambiarPaginaHistorial(paginaNum);
                        return true;
                    }
                    return false;
                },
                
                // Método para obtener información de paginación
                obtenerInfoPaginacion() {
                    const inicio = (this.paginaActualHistorial - 1) * this.itemsPorPaginaHistorial + 1;
                    const fin = Math.min(this.paginaActualHistorial * this.itemsPorPaginaHistorial, this.historialReportes.length);
                    
                    return {
                        paginaActual: this.paginaActualHistorial,
                        totalPaginas: this.totalPaginasHistorial,
                        elementosPorPagina: this.itemsPorPaginaHistorial,
                        totalElementos: this.historialReportes.length,
                        elementoInicio: inicio,
                        elementoFin: fin,
                        hayPaginaAnterior: this.paginaActualHistorial > 1,
                        hayPaginaSiguiente: this.paginaActualHistorial < this.totalPaginasHistorial
                    };
                },

                async cargarEstadisticasReportes() {
                    console.log('📊 Cargando estadísticas de reportes...');
                    
                    try {
                        const response = await fetch(`${apiBase}/api/Reportes/estadisticas`, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        this.estadisticasReportes = await response.json();
                        console.log('📈 Estadísticas cargadas:', this.estadisticasReportes);
                        
                    } catch (error) {
                        console.error('❌ Error al cargar estadísticas:', error);
                        this.estadisticasReportes = null;
                    }
                },

                aplicarFiltrosHistorial() {
                    console.log('🔍 Aplicando filtros al historial:', this.filtroHistorial);
                    this.paginaActualHistorial = 1; // Resetear paginación
                    this.cargarHistorialReportes();
                },

                limpiarFiltrosHistorial() {
                    this.filtroHistorial = {
                        fechaDesde: '',
                        fechaHasta: '',
                        soloMisReportes: false
                    };
                    this.paginaActualHistorial = 1; // Resetear paginación
                    this.cargarHistorialReportes();
                },

                // ========== MÉTODOS PARA ACCIONES DE REPORTES ==========
                async descargarReporte(reporte) {
                    console.log('📥 Descargando reporte:', reporte.nombre);
                    
                    try {
                        // Usar el endpoint de documentos para descargar
                        const response = await fetch(`${documentosApiBase}/${reporte.id}/Contenido`, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: No se pudo descargar el reporte`);
                        }
                        
                        const blob = await response.blob();
                        
                        if (blob.size === 0) {
                            throw new Error('El archivo está vacío');
                        }
                        
                        // Determinar el nombre del archivo
                        let nombreArchivo = reporte.nombre;
                        if (!nombreArchivo.toLowerCase().includes('.xlsx')) {
                            nombreArchivo += '.xlsx';
                        }
                        
                        this.descargarArchivo(blob, nombreArchivo);
                        
                        this.mostrarNotificacion('success', `Reporte "${reporte.nombre}" descargado exitosamente`);
                        
                    } catch (error) {
                        console.error('💥 Error al descargar reporte:', error);
                        this.mostrarNotificacion('error', `Error al descargar el reporte: ${error.message}`);
                    }
                },

                async verDetallesReporte(reporte) {
                    console.log('👁️ Viendo detalles del reporte:', reporte);
                    
                    const detalles = `
                        <div class="reporte-detalles">
                            <h5><i class="bi bi-file-earmark-text me-2"></i>${reporte.nombre}</h5>
                            <hr>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <strong><i class="bi bi-tag me-1"></i>Tipo:</strong><br>
                                    <span class="badge ${this.tipoReporteClass(this.obtenerTipoReporte(reporte.tipoReporte))}">${reporte.tipoReporte}</span>
                                </div>
                                <div class="col-md-6">
                                    <strong><i class="bi bi-person me-1"></i>Generado por:</strong><br>
                                    ${reporte.usuarioGenerador}
                                </div>
                                <div class="col-md-6">
                                    <strong><i class="bi bi-calendar me-1"></i>Fecha de generación:</strong><br>
                                    ${this.formatearFecha(reporte.fechaGeneracion)}
                                </div>
                                <div class="col-md-6">
                                    <strong><i class="bi bi-hdd me-1"></i>Tamaño:</strong><br>
                                    ${reporte.tamanoMB} MB
                                </div>
                                <div class="col-12">
                                    <strong><i class="bi bi-info-circle me-1"></i>ID del documento:</strong><br>
                                    <code>${reporte.id}</code>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Mostrar modal con detalles (usando SweetAlert2 si está disponible, sino alert básico)
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            title: 'Detalles del Reporte',
                            html: detalles,
                            icon: 'info',
                            confirmButtonText: 'Cerrar',
                            customClass: {
                                popup: 'swal-wide'
                            }
                        });
                    } else {
                        // Fallback con alert básico
                        alert(`Detalles del Reporte:\n\nNombre: ${reporte.nombre}\nTipo: ${reporte.tipoReporte}\nGenerado por: ${reporte.usuarioGenerador}\nFecha: ${this.formatearFecha(reporte.fechaGeneracion)}\nTamaño: ${reporte.tamanoMB} MB`);
                    }
                },

                async eliminarReporte(reporte) {
                    if (!confirm(`¿Está seguro de eliminar el reporte "${reporte.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
                        return;
                    }
                    
                    try {
                        console.log('🗑️ Eliminando reporte:', reporte.id);
                        
                        const response = await fetch(`${documentosApiBase}/${reporte.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: No se pudo eliminar el reporte`);
                        }
                        
                        // Remover del array local
                        const index = this.historialReportes.findIndex(r => r.id === reporte.id);
                        if (index !== -1) {
                            this.historialReportes.splice(index, 1);
                        }
                        
                        // Actualizar estadísticas
                        await this.cargarEstadisticasReportes();
                        
                        this.mostrarNotificacion('success', `Reporte "${reporte.nombre}" eliminado exitosamente`);
                        
                    } catch (error) {
                        console.error('💥 Error al eliminar reporte:', error);
                        this.mostrarNotificacion('error', `Error al eliminar el reporte: ${error.message}`);
                    }
                },

                // ========== MÉTODO PARA LIMPIAR REPORTES ANTIGUOS (SOLO ADMIN) ==========
                async limpiarReportesAntiguos(diasAntiguedad = 90) {
                    if (!confirm(`¿Está seguro de eliminar todos los reportes con más de ${diasAntiguedad} días?\n\nEsta acción no se puede deshacer y solo debe realizarla un administrador.`)) {
                        return;
                    }
                    
                    try {
                        console.log('🧹 Limpiando reportes antiguos...');
                        
                        const response = await fetch(`${apiBase}/api/Reportes/limpiar-antiguos?diasAntiguedad=${diasAntiguedad}`, {
                            method: 'DELETE',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }
                        
                        const resultado = await response.json();
                        
                        this.mostrarNotificacion('success', `${resultado.reportesEliminados} reportes antiguos eliminados exitosamente`);
                        
                        // Recargar datos
                        await this.cargarHistorialReportes();
                        await this.cargarEstadisticasReportes();
                        
                    } catch (error) {
                        console.error('💥 Error al limpiar reportes:', error);
                        this.mostrarNotificacion('error', `Error al limpiar reportes: ${error.message}`);
                    }
                },

                // ========== MÉTODOS UTILITARIOS MEJORADOS ==========
                obtenerTipoReporte(tipoReporte) {
                    const mapeo = {
                        'Vehículos Activos': 'vehicles',
                        'Asignaciones Activas': 'assignments',
                        'Mantenimientos Pendientes': 'maintenance',
                        'Seguros por Vencer': 'insurance'
                    };
                    return mapeo[tipoReporte] || 'custom';
                },

                tipoReporteClass(tipo) {
                    const clases = {
                        'vehicles': 'bg-primary text-white',
                        'assignments': 'bg-success text-white',
                        'maintenance': 'bg-warning text-dark',
                        'insurance': 'bg-danger text-white',
                        'documents': 'bg-info text-white',
                        'custom': 'bg-secondary text-white'
                    };
                    return clases[tipo] || 'bg-secondary text-white';
                },

                formatearFecha(fecha) {
                    if (!fecha) return 'No especificada';
                    try {
                        return new Date(fecha).toLocaleString('es-DO', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } catch {
                        return 'Fecha inválida';
                    }
                },

                formatearTamaño(bytes) {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                },

                cambiarEstadoBoton(boton, cargando, texto) {
                    if (!boton) return;
                    
                    boton.disabled = cargando;
                    
                    if (cargando) {
                        boton.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${texto}`;
                    } else {
                        boton.innerHTML = `<i class="bi bi-download me-1"></i> ${texto}`;
                    }
                },

                descargarArchivo(blob, nombreArchivo) {
                    try {
                        // Crear URL temporal para el blob
                        const url = window.URL.createObjectURL(blob);
                        
                        // Crear elemento <a> temporal para la descarga
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = nombreArchivo;
                        link.style.display = 'none';
                        
                        // Agregar al DOM, hacer clic y remover
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Limpiar URL temporal después de un momento
                        setTimeout(() => {
                            window.URL.revokeObjectURL(url);
                        }, 100);
                        
                        console.log('📥 Archivo descargado:', nombreArchivo);
                        
                    } catch (error) {
                        console.error('Error al descargar archivo:', error);
                        throw new Error('Error al descargar el archivo');
                    }
                },

                mostrarNotificacion(tipo, mensaje) {
                    // Crear elemento de notificación
                    const notificacion = document.createElement('div');
                    notificacion.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
                    notificacion.style.cssText = `
                        top: 20px;
                        right: 20px;
                        z-index: 9999;
                        min-width: 300px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    `;
                    
                    notificacion.innerHTML = `
                        <div class="d-flex align-items-center">
                            <i class="bi bi-${tipo === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'} me-2"></i>
                            <div>${mensaje}</div>
                            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
                        </div>
                    `;
                    
                    // Agregar al DOM
                    document.body.appendChild(notificacion);
                    
                    // Auto-remover después de 5 segundos
                    setTimeout(() => {
                        if (notificacion.parentNode) {
                            notificacion.remove();
                        }
                    }, 5000);
                },

                // ========== MÉTODOS DE PAGINACIÓN ==========
                cambiarPaginaHistorial(pagina) {
                    if (pagina >= 1 && pagina <= this.totalPaginasHistorial) {
                        this.paginaActualHistorial = pagina;
                        
                        // Scroll suave hacia arriba de la tabla
                        const tabla = document.querySelector('.table-responsive');
                        if (tabla) {
                            tabla.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                },

                cambiarItemsPorPagina() {
                    console.log('📄 Cambiando elementos por página a:', this.itemsPorPaginaHistorial);
                    
                    // Resetear a la primera página cuando cambie el número de elementos
                    this.paginaActualHistorial = 1;
                    
                    // Recalcular paginación
                    this.recalcularPaginacionHistorial();
                },

                recalcularPaginacionHistorial() {
                    const nuevasTotalPaginas = Math.ceil(this.historialReportes.length / this.itemsPorPaginaHistorial);
                    
                    // Si la página actual es mayor que el nuevo total, ir a la última página
                    if (this.paginaActualHistorial > nuevasTotalPaginas && nuevasTotalPaginas > 0) {
                        this.paginaActualHistorial = nuevasTotalPaginas;
                    }
                    
                    console.log('📊 Paginación recalculada:', {
                        totalReportes: this.historialReportes.length,
                        itemsPorPagina: this.itemsPorPaginaHistorial,
                        totalPaginas: nuevasTotalPaginas,
                        paginaActual: this.paginaActualHistorial
                    });
                },

                actualizarHistorial() {
                    this.cargarHistorialReportes();
                    this.cargarEstadisticasReportes();
                },

                // ========== MÉTODOS DE GRÁFICOS (CONSERVADOS) ==========
                async inicializarGraficos() {
                    console.log('📊 Inicializando gráficos...');
                    
                    if (!this.verificarChart()) {
                        console.warn('⚠️ Chart.js no disponible, intentando cargar...');
                        return;
                    }
                    
                    // Verificar que los elementos canvas existan
                    const vehicleCanvas = document.getElementById('vehicleStatusChart');
                    const maintenanceCanvas = document.getElementById('maintenanceCostChart');
                    
                    console.log('Canvas vehicleStatusChart:', vehicleCanvas ? '✅' : '❌');
                    console.log('Canvas maintenanceCostChart:', maintenanceCanvas ? '✅' : '❌');
                    
                    if (!vehicleCanvas || !maintenanceCanvas) {
                        console.error('❌ Elementos canvas no encontrados');
                        return;
                    }
                    
                    try {
                        // Inicializar con datos de ejemplo primero
                        this.crearGraficoVehiculosEjemplo();
                        this.crearGraficoMantenimientosEjemplo();
                        
                        // Luego cargar datos reales
                        await this.cargarGraficoVehiculos();
                        await this.cargarGraficoMantenimientos();
                        
                        console.log('✅ Gráficos inicializados correctamente');
                        
                    } catch (error) {
                        console.error('❌ Error al inicializar gráficos:', error);
                        // Fallback a datos de ejemplo
                        this.crearGraficoVehiculosEjemplo();
                        this.crearGraficoMantenimientosEjemplo();
                    }
                },

                async cargarGraficoVehiculos() {
                    try {
                        console.log('📊 Cargando datos de vehículos...');
                        
                        const response = await fetch(`${apiBase}/api/Vehiculos`, {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        const vehiculos = await response.json();
                        console.log('📊 Datos de vehículos recibidos:', vehiculos);
                        
                        if (!Array.isArray(vehiculos)) {
                            console.warn('⚠️ Datos de vehículos no son un array, usando datos de ejemplo');
                            this.crearGraficoVehiculosEjemplo();
                            return;
                        }
                        
                        const estadisticas = this.procesarEstadisticasVehiculos(vehiculos);
                        this.crearGraficoVehiculos(estadisticas);
                        
                    } catch (error) {
                        console.error('❌ Error al cargar gráfico de vehículos:', error);
                        this.crearGraficoVehiculosEjemplo();
                    }
                },

                procesarEstadisticasVehiculos(vehiculos) {
                    const estadisticas = {
                        'Activos': 0,
                        'En Mantenimiento': 0,
                        'Asignados': 0,
                        'No Asignados': 0,
                        'Fuera de Servicio': 0
                    };
                    
                    if (!Array.isArray(vehiculos)) {
                        console.warn('⚠️ vehiculos no es un array:', vehiculos);
                        return estadisticas;
                    }
                    
                    vehiculos.forEach(vehiculo => {
                        // Obtener el estado del vehículo
                        const estado = vehiculo.estado || vehiculo.Estado || 1;
                        
                        // Mapear estados según la lógica de tu sistema
                        switch (parseInt(estado)) {
                            case 1: // Disponible
                                estadisticas['Activos']++;
                                estadisticas['No Asignados']++;
                                break;
                            case 2: // Asignado
                                estadisticas['Activos']++;
                                estadisticas['Asignados']++;
                                break;
                            case 3: // En Taller
                                estadisticas['En Mantenimiento']++;
                                break;
                            case 4: // No Disponible
                                estadisticas['Fuera de Servicio']++;
                                break;
                            case 5: // De Baja
                                estadisticas['Fuera de Servicio']++;
                                break;
                            default:
                                estadisticas['Fuera de Servicio']++;
                                break;
                        }
                    });
                    
                    console.log('📊 Estadísticas procesadas:', estadisticas);
                    return estadisticas;
                },

                crearGraficoVehiculos(estadisticas) {
                    const ctx = document.getElementById('vehicleStatusChart');
                    if (!ctx) {
                        console.error('❌ No se encontró el canvas vehicleStatusChart');
                        return;
                    }
                    
                    // Destruir gráfica anterior si existe
                    if (this.vehicleStatusChart) {
                        this.vehicleStatusChart.destroy();
                        this.vehicleStatusChart = null;
                    }
                    
                    const labels = [];
                    const data = [];
                    const backgroundColor = [];
                    const borderColor = [];
                    
                    // Configurar colores y datos
                    const colorMap = {
                        'Activos': { bg: '#28a745', border: '#1e7e34' },
                        'En Mantenimiento': { bg: '#ffc107', border: '#d39e00' },
                        'Asignados': { bg: '#007bff', border: '#0056b3' },
                        'No Asignados': { bg: '#17a2b8', border: '#138496' },
                        'Fuera de Servicio': { bg: '#dc3545', border: '#bd2130' }
                    };
                    
                    Object.keys(estadisticas).forEach(estado => {
                        if (estadisticas[estado] > 0) {
                            labels.push(estado);
                            data.push(estadisticas[estado]);
                            backgroundColor.push(colorMap[estado]?.bg || '#6c757d');
                            borderColor.push(colorMap[estado]?.border || '#545b62');
                        }
                    });
                    
                    // Si no hay datos, mostrar mensaje
                    if (data.length === 0) {
                        labels.push('Sin datos');
                        data.push(1);
                        backgroundColor.push('#e9ecef');
                        borderColor.push('#dee2e6');
                    }
                    
                    console.log('📊 Creando gráfico con datos:', { labels, data });
                    
                    try {
                        this.vehicleStatusChart = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: labels,
                                datasets: [{
                                    data: data,
                                    backgroundColor: backgroundColor,
                                    borderColor: borderColor,
                                    borderWidth: 2,
                                    hoverOffset: 4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: {
                                            usePointStyle: true,
                                            padding: 20,
                                            font: {
                                                size: 12
                                            }
                                        }
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                if (context.label === 'Sin datos') {
                                                    return 'No hay datos disponibles';
                                                }
                                                const label = context.label || '';
                                                const value = context.parsed || 0;
                                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                                const percentage = ((value / total) * 100).toFixed(1);
                                                return `${label}: ${value} vehículos (${percentage}%)`;
                                            }
                                        }
                                    }
                                }
                            }
                        });
                        
                        console.log('✅ Gráfico de vehículos creado exitosamente');
                        
                    } catch (error) {
                        console.error('❌ Error al crear gráfico de vehículos:', error);
                    }
                },

                async cargarGraficoMantenimientos() {
                    try {
                        console.log('📊 Cargando datos de mantenimientos...');
                        
                        // Obtener mantenimientos con costos
                        const response = await fetch(`${apiBase}/api/Mantenimientos`, {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        const mantenimientos = await response.json();
                        console.log('📊 Datos de mantenimientos recibidos:', mantenimientos);
                        
                        if (!Array.isArray(mantenimientos)) {
                            console.warn('⚠️ Datos de mantenimientos no son un array, usando datos de ejemplo');
                            this.crearGraficoMantenimientosEjemplo();
                            return;
                        }
                        
                        const costosPorAnoMes = this.procesarCostosMantenimiento(mantenimientos);
                        this.crearGraficoMantenimientos(costosPorAnoMes);
                        
                    } catch (error) {
                        console.error('❌ Error al cargar gráfico de mantenimientos:', error);
                        this.crearGraficoMantenimientosEjemplo();
                    }
                },

                procesarCostosMantenimiento(mantenimientos) {
                    const fechaActual = new Date();
                    const anoActual = fechaActual.getFullYear();
                    const anoAnterior = anoActual - 1;
                    
                    const mesesDelAno = [
                        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
                    ];
                    
                    // Estructura para almacenar costos por año y mes
                    const costosPorAno = {
                        [anoAnterior]: {},
                        [anoActual]: {}
                    };
                    
                    // Inicializar todos los meses en 0 para ambos años
                    [anoAnterior, anoActual].forEach(ano => {
                        mesesDelAno.forEach(mes => {
                            costosPorAno[ano][mes] = 0;
                        });
                    });
                    
                    if (!Array.isArray(mantenimientos)) {
                        console.warn('⚠️ mantenimientos no es un array:', mantenimientos);
                        return costosPorAno;
                    }
                    
                    // Procesar mantenimientos
                    mantenimientos.forEach(mantenimiento => {
                        // Obtener la fecha del mantenimiento
                        const fechaInicio = mantenimiento.fechaInicio || mantenimiento.FechaInicio || mantenimiento.fecha;
                        
                        if (fechaInicio) {
                            try {
                                const fecha = new Date(fechaInicio);
                                const ano = fecha.getFullYear();
                                const mes = mesesDelAno[fecha.getMonth()];
                                
                                // Solo procesar si es del año actual o anterior
                                if (ano === anoActual || ano === anoAnterior) {
                                    // Obtener el costo (priorizar costo real sobre estimado)
                                    const costoReal = mantenimiento.costo || mantenimiento.Costo || 0;
                                    const costoEstimado = mantenimiento.costoEstimado || mantenimiento.CostoEstimado || 0;
                                    
                                    const costoFinal = costoReal > 0 ? costoReal : costoEstimado;
                                    
                                    if (costoFinal > 0) {
                                        costosPorAno[ano][mes] += costoFinal;
                                    }
                                }
                            } catch (error) {
                                console.warn('⚠️ Error al procesar fecha:', fechaInicio, error);
                            }
                        }
                    });
                    
                    console.log('📊 Costos por año y mes procesados:', costosPorAno);
                    return costosPorAno;
                },

                crearGraficoMantenimientos(costosPorAnoMes) {
                    const ctx = document.getElementById('maintenanceCostChart');
                    if (!ctx) {
                        console.error('❌ No se encontró el canvas maintenanceCostChart');
                        return;
                    }
                    
                    // Destruir gráfica anterior si existe
                    if (this.maintenanceCostChart) {
                        this.maintenanceCostChart.destroy();
                        this.maintenanceCostChart = null;
                    }
                    
                    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    const anos = Object.keys(costosPorAnoMes).sort();
                    
                    // Preparar datasets para cada año
                    const datasets = anos.map((ano, index) => {
                        const datos = meses.map(mes => costosPorAnoMes[ano][mes] || 0);
                        
                        // Colores diferentes para cada año
                        const colores = [
                            { bg: 'rgba(0, 123, 255, 0.8)', border: 'rgba(0, 123, 255, 1)' }, // Azul
                            { bg: 'rgba(40, 167, 69, 0.8)', border: 'rgba(40, 167, 69, 1)' }, // Verde
                            { bg: 'rgba(255, 193, 7, 0.8)', border: 'rgba(255, 193, 7, 1)' }  // Amarillo
                        ];
                        
                        const color = colores[index % colores.length];
                        
                        return {
                            label: `Costos ${ano}`,
                            data: datos,
                            backgroundColor: color.bg,
                            borderColor: color.border,
                            borderWidth: 2,
                            borderRadius: 4,
                            borderSkipped: false,
                            tension: 0.1
                        };
                    });
                    
                    console.log('📊 Creando gráfico de mantenimientos con datasets:', datasets);
                    
                    try {
                        this.maintenanceCostChart = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: meses,
                                datasets: datasets
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: {
                                    mode: 'index',
                                    intersect: false,
                                },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        labels: {
                                            font: {
                                                size: 12
                                            }
                                        }
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                const value = context.parsed.y;
                                                return `${context.dataset.label}: RD$ ${value.toLocaleString('es-DO', {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0
                                                })}`;
                                            },
                                            footer: function(tooltipItems) {
                                                let total = 0;
                                                tooltipItems.forEach(item => {
                                                    total += item.parsed.y;
                                                });
                                                return `Total: RD$ ${total.toLocaleString('es-DO')}`;
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    x: {
                                        grid: {
                                            display: false
                                        },
                                        ticks: {
                                            font: {
                                                size: 11
                                            }
                                        }
                                    },
                                    y: {
                                        beginAtZero: true,
                                        ticks: {
                                            callback: function(value) {
                                                return 'RD$ ' + value.toLocaleString('es-DO');
                                            },
                                            font: {
                                                size: 11
                                            }
                                        }
                                    }
                                }
                            }
                        });
                        
                        console.log('✅ Gráfico de mantenimientos creado exitosamente');
                        
                    } catch (error) {
                        console.error('❌ Error al crear gráfico de mantenimientos:', error);
                    }
                },

                crearGraficoVehiculosEjemplo() {
                    console.log('📊 Creando gráfico de vehículos con datos de ejemplo');
                    
                    const estadisticasEjemplo = {
                        'Activos': 20,
                        'En Mantenimiento': 3,
                        'Asignados': 15,
                        'No Asignados': 5,
                        'Fuera de Servicio': 2
                    };
                    
                    this.crearGraficoVehiculos(estadisticasEjemplo);
                },

                crearGraficoMantenimientosEjemplo() {
                    console.log('📊 Creando gráfico de mantenimientos con datos de ejemplo');
                    
                    const fechaActual = new Date();
                    const anoActual = fechaActual.getFullYear();
                    const anoAnterior = anoActual - 1;
                    const mesActual = fechaActual.getMonth();
                    
                    const costosEjemplo = {
                        [anoAnterior]: {
                            'Ene': 125000, 'Feb': 98000, 'Mar': 145000, 'Abr': 110000,
                            'May': 155000, 'Jun': 135000, 'Jul': 148000, 'Ago': 132000,
                            'Sep': 119000, 'Oct': 165000, 'Nov': 142000, 'Dic': 158000
                        },
                        [anoActual]: {
                            'Ene': mesActual >= 0 ? 135000 : 0,
                            'Feb': mesActual >= 1 ? 108000 : 0,
                            'Mar': mesActual >= 2 ? 155000 : 0,
                            'Abr': mesActual >= 3 ? 120000 : 0,
                            'May': mesActual >= 4 ? 165000 : 0,
                            'Jun': mesActual >= 5 ? 145000 : 0,
                            'Jul': mesActual >= 6 ? 158000 : 0,
                            'Ago': mesActual >= 7 ? 142000 : 0,
                            'Sep': mesActual >= 8 ? 129000 : 0,
                            'Oct': mesActual >= 9 ? 175000 : 0,
                            'Nov': mesActual >= 10 ? 152000 : 0,
                            'Dic': mesActual >= 11 ? 168000 : 0
                        }
                    };
                    
                    this.crearGraficoMantenimientos(costosEjemplo);
                },

                // ========== MÉTODOS MEJORADOS PARA CONTROLES DE GRÁFICOS ==========
                cambiarPeriodoGrafico(periodo) {
                    console.log('📊 Cambiando período gráfico a:', periodo);
                    this.filtroGrafico.periodo = periodo;
                    
                    // Recargar gráfico de vehículos con nuevo filtro
                    this.cargarGraficoVehiculos();
                },

                cambiarAñoGrafico(año) {
                    console.log('📊 Cambiando año gráfico a:', año);
                    this.filtroGrafico.año = año;
                    
                    // Recargar gráfico de mantenimientos con nuevo filtro
                    this.cargarGraficoMantenimientos();
                },

                async actualizarGraficos() {
                    console.log('🔄 Actualizando gráficos...');
                    this.actualizandoGraficos = true;
                    
                    try {
                        await this.cargarGraficoVehiculos();
                        await this.cargarGraficoMantenimientos();
                        
                        this.ultimaActualizacionGraficos = new Date();
                        this.mostrarNotificacion('success', 'Gráficos actualizados correctamente');
                        
                    } catch (error) {
                        console.error('❌ Error al actualizar gráficos:', error);
                        this.mostrarNotificacion('error', 'Error al actualizar los gráficos');
                        
                    } finally {
                        this.actualizandoGraficos = false;
                    }
                },
                // ========== MÉTODOS DE ESTADÍSTICAS DE REPORTES ==========
                mostrarEstadisticas() {
                    if (!this.estadisticasReportes) {
                        this.mostrarNotificacion('error', 'No hay estadísticas disponibles');
                        return;
                    }

                    const stats = this.estadisticasReportes;
                    const detalles = `
                        <div class="estadisticas-reportes">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="card bg-primary text-white">
                                        <div class="card-body text-center">
                                            <i class="bi bi-file-earmark-text fs-2 mb-2"></i>
                                            <h3>${stats.totalReportes}</h3>
                                            <p class="mb-0">Total de Reportes</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-success text-white">
                                        <div class="card-body text-center">
                                            <i class="bi bi-calendar-month fs-2 mb-2"></i>
                                            <h3>${stats.reportesUltimos30Dias}</h3>
                                            <p class="mb-0">Últimos 30 días</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-info text-white">
                                        <div class="card-body text-center">
                                            <i class="bi bi-hdd fs-2 mb-2"></i>
                                            <h3>${stats.tamanioTotalMB} MB</h3>
                                            <p class="mb-0">Tamaño Total</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-warning text-dark">
                                        <div class="card-body text-center">
                                            <i class="bi bi-clock-history fs-2 mb-2"></i>
                                            <h5 class="mb-1">${stats.ultimoReporte ? this.formatearFecha(stats.ultimoReporte.fechaGeneracion) : 'N/A'}</h5>
                                            <p class="mb-0">Último Reporte</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <hr>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <h6><i class="bi bi-pie-chart me-2"></i>Reportes por Tipo:</h6>
                                    <ul class="list-unstyled">
                                        ${stats.reportesPorTipo.map(item => 
                                            `<li><span class="badge bg-secondary me-2">${item.cantidad}</span>${item.tipo}</li>`
                                        ).join('')}
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6><i class="bi bi-people me-2"></i>Usuarios Más Activos:</h6>
                                    <ul class="list-unstyled">
                                        ${stats.usuariosMasActivos.map(item => 
                                            `<li><span class="badge bg-primary me-2">${item.reportes}</span>${item.usuario}</li>`
                                        ).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            title: 'Estadísticas de Reportes',
                            html: detalles,
                            icon: 'info',
                            confirmButtonText: 'Cerrar',
                            customClass: {
                                popup: 'swal-wide'
                            }
                        });
                    } else {
                        alert('Estadísticas de Reportes:\n\n' + 
                            `Total: ${stats.totalReportes}\n` +
                            `Últimos 30 días: ${stats.reportesUltimos30Dias}\n` +
                            `Tamaño total: ${stats.tamanioTotalMB} MB`);
                    }
                },

                // ========== MÉTODOS CONSERVADOS ==========
                manejarCambioPeriodo() {
                    if (this.reporteForm.periodo !== 'custom') {
                        this.reporteForm.fechaDesde = '';
                        this.reporteForm.fechaHasta = '';
                    }
                },

                async generarReporte() {
                    console.log('Generando reporte personalizado...');
                    // Implementar lógica del reporte personalizado aquí
                },

                obtenerTituloReporte(tipo) {
                    const titulos = {
                        'vehicles': 'Vehículos Activos',
                        'assignments': 'Asignaciones Activas', 
                        'maintenance': 'Mantenimientos Pendientes',
                        'insurance': 'Seguros por Vencer',
                        'maintenances': 'Mantenimientos',
                        'insurances': 'Seguros',
                        'documents': 'Documentos',
                        'custom': 'Personalizado'
                    };
                    return titulos[tipo] || 'Reporte';
                },

                // Método temporal para debug
                testGraficos() {
                    console.log('🧪 Probando gráficos...');
                    console.log('Chart.js disponible:', typeof Chart !== 'undefined');
                    console.log('Canvas vehicleStatusChart:', document.getElementById('vehicleStatusChart'));
                    console.log('Canvas maintenanceCostChart:', document.getElementById('maintenanceCostChart'));
                    
                    // Probar con datos de ejemplo directamente
                    this.crearGraficoVehiculosEjemplo();
                    this.crearGraficoMantenimientosEjemplo();
                },

                // ========== MÉTODOS DE PRUEBA==========
                async llamarAPIReporteYGuardar(tipo) {
                    // ========== VERIFICACIÓN DE AUTENTICACIÓN ==========
                    console.log('🔐 Verificando estado de autenticación...');
                    
                    // Verificar si hay cookies de autenticación
                    const cookies = document.cookie;
                    console.log('🍪 Cookies disponibles:', cookies ? 'Sí' : 'No');
                    
                    // Verificar si hay token en localStorage (si usas JWT)
                    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('jwt');
                    console.log('🎟️ Token en localStorage:', token ? `Sí (${token.substring(0, 20)}...)` : 'No');
                    
                    // Verificar si hay token en sessionStorage
                    const sessionToken = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
                    console.log('🎫 Token en sessionStorage:', sessionToken ? `Sí (${sessionToken.substring(0, 20)}...)` : 'No');
                    
                    // Verificar el estado de la sesión
                    try {
                        const authCheck = await fetch(`${apiBase}/api/Auth/check`, {
                            method: 'GET',
                            credentials: 'include', // Importante: incluir cookies
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        console.log('🔍 Estado de autenticación:', authCheck.status === 200 ? 'Autenticado ✅' : `No autenticado ❌ (${authCheck.status})`);
                    } catch (error) {
                        console.log('⚠️ No se pudo verificar el estado de autenticación:', error.message);
                    }

                    // ========== CONFIGURACIÓN DE LA PETICIÓN ==========
                    const apiUrls = {
                        'vehicles': '/api/Reportes/vehiculosActivos/generar-y-guardar',
                        'assignments': '/api/Reportes/asignacionesActivas/generar-y-guardar', 
                        'maintenance': '/api/Reportes/mantenimientosPendientes/generar-y-guardar',
                        'insurance': '/api/Reportes/segurosPorVencer/generar-y-guardar'
                    };
                    
                    const apiUrl = `${apiBase}${apiUrls[tipo]}`;
                    
                    // Para mantenimientos e insurance, podemos agregar parámetros de días de antelación
                    let urlConParametros = apiUrl;
                    if (tipo === 'maintenance' || tipo === 'insurance') {
                        urlConParametros += '?diasAntelacion=30'; // Por defecto 30 días
                    }
                    
                    console.log('🌐 URL de la petición:', urlConParametros);
                    
                    // ========== CONFIGURAR HEADERS DE AUTENTICACIÓN ==========
                    const headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    };
                    
                    // Si tienes token JWT, agregarlo al header Authorization
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                        console.log('🔑 Header Authorization agregado');
                    } else if (sessionToken) {
                        headers['Authorization'] = `Bearer ${sessionToken}`;
                        console.log('🔑 Header Authorization agregado (desde sessionStorage)');
                    }
                    
                    // Configurar opciones de fetch
                    const fetchOptions = {
                        method: 'POST',
                        headers: headers,
                        credentials: 'include' // IMPORTANTE: Incluir cookies de sesión
                    };
                    
                    console.log('📦 Opciones de fetch:', {
                        method: fetchOptions.method,
                        headers: Object.keys(fetchOptions.headers),
                        credentials: fetchOptions.credentials
                    });
                    
                    // ========== REALIZAR LA PETICIÓN ==========
                    try {
                        console.log('🚀 Realizando petición...');
                        
                        const response = await fetch(urlConParametros, fetchOptions);
                        
                        console.log('📡 Respuesta recibida:');
                        console.log('  - Status:', response.status);
                        console.log('  - Status Text:', response.statusText);
                        console.log('  - Headers:', [...response.headers.entries()]);
                        
                        if (!response.ok) {
                            // ========== MANEJO ESPECÍFICO DEL ERROR 401 ==========
                            if (response.status === 401) {
                                console.error('🚫 ERROR 401 - NO AUTORIZADO:');
                                console.error('  - Posibles causas:');
                                console.error('    1. No estás logueado');
                                console.error('    2. Tu sesión expiró');
                                console.error('    3. No tienes permisos para esta acción');
                                console.error('    4. El token JWT es inválido o expiró');
                                console.error('    5. Las cookies de sesión no se están enviando');
                                
                                // Intentar obtener más información del error
                                try {
                                    const errorResponse = await response.text();
                                    console.error('  - Respuesta del servidor:', errorResponse);
                                } catch (e) {
                                    console.error('  - No se pudo leer la respuesta del error');
                                }
                                
                                // Redirigir al login si es necesario
                                const shouldRedirectToLogin = confirm('Tu sesión ha expirado o no tienes permisos. ¿Deseas ir al login?');
                                if (shouldRedirectToLogin) {
                                    window.location.href = '/Account/Login'; // Ajusta la ruta según tu aplicación
                                    return;
                                }
                            }
                            
                            const errorText = await response.text();
                            let errorMessage;
                            
                            try {
                                const errorJson = JSON.parse(errorText);
                                errorMessage = errorJson.error || errorJson.message || `Error ${response.status}`;
                            } catch {
                                errorMessage = errorText || `Error ${response.status}: ${response.statusText}`;
                            }
                            
                            throw new Error(errorMessage);
                        }
                        
                        const resultado = await response.json();
                        console.log('✅ Petición exitosa:', resultado);
                        
                        if (!resultado.documentoId) {
                            throw new Error('El servidor no devolvió un ID de documento válido');
                        }
                        
                        return resultado;
                        
                    } catch (error) {
                        console.error('💥 Error en la petición:', error);
                        
                        // Logging adicional para debugging
                        if (error.name === 'TypeError' && error.message.includes('fetch')) {
                            console.error('🌐 Error de conexión - posibles causas:');
                            console.error('  - El servidor no está ejecutándose');
                            console.error('  - Problemas de CORS');
                            console.error('  - URL incorrecta');
                        }
                        
                        throw error;
                    }
                },
                // Agregar este método en el objeto methods de Vue
                async verificarAutenticacion() {
                    console.log('🔐 Verificando autenticación al iniciar...');
                    
                    try {
                        const response = await fetch(`${apiBase}/api/Auth/user`, {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            const user = await response.json();
                            console.log('👤 Usuario autenticado:', user);
                            this.usuarioActual = user;
                        } else {
                            console.log('❌ Usuario no autenticado');
                            this.usuarioActual = null;
                        }
                    } catch (error) {
                        console.error('❌ Error al verificar autenticación:', error);
                        this.usuarioActual = null;
                    }
                }
            }
        });