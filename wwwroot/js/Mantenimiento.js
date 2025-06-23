// Mantenimiento.js
        console.log('Iniciando aplicación...');
        console.log('Vue version:', Vue.version);

        const apiBase = "https://localhost:7037/api/Mantenimientos";
        const documentosApiBase = "https://localhost:7037/api/Documentos";
        
        new Vue({
            el: '#app',
            data: {
                mantenimientos: [],
                filtros: { busqueda: '', estado: '', tipo: '', taller: '' },
                form: { 
                    id: null, 
                    vehiculoId: '', 
                    fechaInicio: '', 
                    fechaEstimadaFinalizacion: '', 
                    tipoMantenimiento: '', 
                    descripcion: '', 
                    taller: '', 
                    kilometrajeActual: '', 
                    costoEstimado: '', 
                    estado: 1, 
                    usuarioRegistroId: '',
                    // Campos adicionales para editar
                    mantenimientos: [],
                    todosLosMantenimientos: [], // Agregar esta línea si no existe
                    filtros: { busqueda: '', estado: '', tipo: '', taller: '' },
                    fechaFinalizacion: '',
                    descripcionFinal: '',
                    costo: '',
                    usuarioFinalizacionId: '',
                    documentos: [],
                    documentosExistentes: [] // Para documentos ya guardados en edición
                },
                paginacion: {
                    paginaActual: 1,
                    elementosPorPagina: 10,
                    totalPaginas: 0
                },
                editando: false,
                detalle: null,
                documentos: [], // Documentos del mantenimiento en detalle
                cargandoDocumentos: false,
                finalizar: { 
                    id: null, 
                    fechaFinalizacion: '', 
                    costoFinal: '', 
                    descripcionFinal: '',
                    usuarioFinalizacionId: '', 
                    documentos: [] 
                },
                finalizando: false,
                guardando: false,
                seachTimeout: null
            },
            computed: {
                estadisticas() {
                    const ahora = new Date();
                    const mesActual = ahora.getMonth();
                    const anioActual = ahora.getFullYear();
                    
                    const mantenimientosDelMes = this.mantenimientos.filter(m => {
                        if (m.fechaInicio) {
                            const fechaInicio = new Date(m.fechaInicio);
                            return fechaInicio.getMonth() === mesActual && fechaInicio.getFullYear() === anioActual;
                        }
                        return false;
                    });
                    
                    return {
                        programados: this.mantenimientos.filter(m => m.estadoTexto === 'Programado').length,
                        enProceso: this.mantenimientos.filter(m => m.estadoTexto === 'EnProceso').length,
                        completados: mantenimientosDelMes.filter(m => m.estadoTexto === 'Completado').length,
                        costoTotal: mantenimientosDelMes.reduce((total, m) => {
                            const costo = m.costo > 0 ? m.costo : m.costoEstimado;
                            return total + (costo || 0);
                        }, 0)
                    };
                },
                mantenimientosPaginados() {
                    const inicio = (this.paginacion.paginaActual - 1) * this.paginacion.elementosPorPagina;
                    const fin = inicio + this.paginacion.elementosPorPagina;
                    return this.mantenimientos.slice(inicio, fin);
                },
                paginasVisibles() {
                    const total = this.paginacion.totalPaginas;
                    const actual = this.paginacion.paginaActual;
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
            filters: {
                fecha(val) {
                    if (!val) return '';
                    return new Date(val).toLocaleDateString('es-DO');
                },
                currency(val) {
                    if (!val) return '0.00';
                    return parseFloat(val).toLocaleString('es-DO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
            },
            methods: {
                // ========== MÉTODOS DE CARGA Y FILTROS MEJORADOS ==========
                async cargarMantenimientos() {
                   console.log('📊 Cargando mantenimientos...');
                    try {
                        const response = await fetch(apiBase, {
                            method: 'GET',
                            credentials: 'include', // Incluir cookies de autenticación
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        console.log('📡 Response status:', response.status);
                        
                        if (!response.ok) {
                            if (response.status === 401) {
                                console.error('🚫 ERROR 401 - NO AUTORIZADO');
                                alert('No estás autorizado. Por favor, inicia sesión nuevamente.');
                                return;
                            }
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        console.log('📋 Datos recibidos:', data);
                        
                        this.todosLosMantenimientos = data; // Guardar todos los datos originales
                        this.aplicarFiltros(); // Aplicar filtros actuales y calcular paginación
                        
                    } catch (error) {
                        console.error('❌ Error al cargar mantenimientos:', error);
                        alert('Error al cargar los mantenimientos: ' + error.message);
                    }
                },
                cambiarPagina(pagina) {
                    if (pagina >= 1 && pagina <= this.paginacion.totalPaginas) {
                        this.paginacion.paginaActual = pagina;
                        console.log('📄 Cambiando a página:', pagina, 'de', this.paginacion.totalPaginas);
                    }
                },
                
                calcularPaginacion() {
                    this.paginacion.totalPaginas = Math.ceil(this.mantenimientos.length / this.paginacion.elementosPorPagina);
                    
                    // Si la página actual es mayor que el total, resetear a la primera
                    if (this.paginacion.paginaActual > this.paginacion.totalPaginas) {
                        this.paginacion.paginaActual = 1;
                    }

                    console.log('📊 Paginación calculada:', {
                        totalElementos: this.mantenimientos.length,
                        elementosPorPagina: this.paginacion.elementosPorPagina,
                        totalPaginas: this.paginacion.totalPaginas,
                        paginaActual: this.paginacion.paginaActual
                    });
                },
                
                // Actualizar el método filtrarMantenimientos para recalcular paginación
                filtrarMantenimientos(event) {
                    if (event) {
                        event.preventDefault();
                    }
                    
                    console.log('🔍 Filtrando mantenimientos con:', this.filtros);
                    this.paginacion.paginaActual = 1; // Resetear a primera página al filtrar
                    this.aplicarFiltros();
                },

                // Nuevo método para aplicar filtros localmente
                aplicarFiltros() {
           console.log('🔍 Aplicando filtros:', this.filtros);
                    
                    let resultado = [...this.todosLosMantenimientos];
                    
                    // Filtro por búsqueda (placa o vehículo)
                    if (this.filtros.busqueda && this.filtros.busqueda.trim() !== '') {
                        const busqueda = this.filtros.busqueda.toLowerCase().trim();
                        resultado = resultado.filter(m => {
                            const placa = (m.vehiculoPlaca || '').toLowerCase();
                            const marca = (m.vehiculoMarca || '').toLowerCase();
                            const modelo = (m.vehiculoModelo || '').toLowerCase();
                            const descripcion = (m.descripcion || '').toLowerCase();
                            
                            return placa.includes(busqueda) || 
                                   marca.includes(busqueda) || 
                                   modelo.includes(busqueda) ||
                                   descripcion.includes(busqueda) ||
                                   `${marca} ${modelo}`.includes(busqueda);
                        });
                    }
                    
                    // Filtro por estado
                    if (this.filtros.estado && this.filtros.estado !== '') {
                        resultado = resultado.filter(m => m.estadoTexto === this.filtros.estado);
                    }
                    
                    // Filtro por tipo de mantenimiento
                    if (this.filtros.tipo && this.filtros.tipo !== '') {
                        resultado = resultado.filter(m => {
                            const tipo = (m.tipoMantenimiento || '').toLowerCase();
                            return tipo.includes(this.filtros.tipo.toLowerCase());
                        });
                    }
                    
                    // Filtro por taller
                    if (this.filtros.taller && this.filtros.taller !== '') {
                        const tallerFiltro = this.filtros.taller.toLowerCase();
                        resultado = resultado.filter(m => {
                            const taller = (m.taller || '').toLowerCase();
                            
                            // Mapear valores del select a posibles nombres en los datos
                            switch (tallerFiltro) {
                                case 'taller-dga':
                                    return taller.includes('dga') || taller.includes('interno');
                                case 'taller-externo':
                                    return taller.includes('externo') || (!taller.includes('dga') && !taller.includes('concesionario'));
                                case 'concesionario':
                                    return taller.includes('concesionario') || taller.includes('agencia');
                                default:
                                    return taller.includes(tallerFiltro);
                            }
                        });
                    }
                    
                    this.mantenimientos = resultado;
                    
                    // IMPORTANTE: Recalcular paginación después de filtrar
                    this.calcularPaginacion();
                    
                    console.log('📋 Mantenimientos filtrados:', resultado.length, 'de', this.todosLosMantenimientos.length);
                },

                // Método mejorado para filtrar mantenimientos
                filtrarMantenimientos(event) {
                    if (event) {
                        event.preventDefault();
                    }
                    
                    console.log('🔍 Filtrando mantenimientos con:', this.filtros);
                    this.aplicarFiltros();
                },

                // Nuevo método para limpiar filtros
                limpiarFiltros() {
                    console.log('🧹 Limpiando filtros...');
                    this.filtros = { busqueda: '', estado: '', tipo: '', taller: '' };
                    this.paginacion.paginaActual = 1; // Resetear a primera página
                    this.aplicarFiltros();
                },
                                irAPrimeraPagina() {
                    this.cambiarPagina(1);
                },
                
                irAUltimaPagina() {
                    this.cambiarPagina(this.paginacion.totalPaginas);
                },
                
                paginaAnterior() {
                    if (this.paginacion.paginaActual > 1) {
                        this.cambiarPagina(this.paginacion.paginaActual - 1);
                    }
                },
                
                paginaSiguiente() {
                    if (this.paginacion.paginaActual < this.paginacion.totalPaginas) {
                        this.cambiarPagina(this.paginacion.paginaActual + 1);
                    }
                },

                // Watcher para aplicar filtros automáticamente cuando cambien
                watch: {
                    'filtros.busqueda': function(newVal, oldVal) {
                        // Aplicar filtro automáticamente después de una pausa
                        clearTimeout(this.searchTimeout);
                        this.searchTimeout = setTimeout(() => {
                            this.aplicarFiltros();
                        }, 500);
                    },
                    'filtros.estado': function() {
                        this.aplicarFiltros();
                    },
                    'filtros.tipo': function() {
                        this.aplicarFiltros();
                    },
                    'filtros.taller': function() {
                        this.aplicarFiltros();
                    }
                },

                // ========== MÉTODOS DE VALIDACIÓN ==========
                validarFormulario() {
                    const errores = [];
                    
                    if (!this.form.vehiculoId || this.form.vehiculoId <= 0) {
                        errores.push('• El ID del vehículo es requerido y debe ser mayor a 0');
                    }
                    
                    if (!this.form.tipoMantenimiento || this.form.tipoMantenimiento.trim() === '') {
                        errores.push('• El tipo de mantenimiento es requerido');
                    }
                    
                    if (!this.form.taller || this.form.taller.trim() === '') {
                        errores.push('• El taller es requerido');
                    }
                    
                    if (!this.form.fechaInicio) {
                        errores.push('• La fecha de inicio es requerida');
                    }
                    
                    if (!this.form.kilometrajeActual || this.form.kilometrajeActual <= 0) {
                        errores.push('• El kilometraje actual es requerido y debe ser mayor a 0');
                    }
                    
                    if (!this.form.costoEstimado || this.form.costoEstimado <= 0) {
                        errores.push('• El costo estimado es requerido y debe ser mayor a 0');
                    }
                    
                    if (!this.form.usuarioRegistroId || this.form.usuarioRegistroId.trim() === '') {
                        errores.push('• El ID del usuario de registro es requerido');
                    }
                    
                    if (!this.form.descripcion || this.form.descripcion.trim() === '') {
                        errores.push('• La descripción es requerida');
                    }

                    if (errores.length > 0) {
                        console.error('❌ Errores de validación:', errores);
                        alert('Errores de validación:\n\n' + errores.join('\n'));
                        return false;
                    }
                    
                    return true;
                },

                validarFormularioEdicion() {
                    const errores = [];
                    
                    if (!this.form.fechaInicio) {
                        errores.push('• La fecha de inicio es requerida');
                    }
                    
                    if (!this.form.tipoMantenimiento || this.form.tipoMantenimiento.trim() === '') {
                        errores.push('• El tipo de mantenimiento es requerido');
                    }
                    
                    if (!this.form.taller || this.form.taller.trim() === '') {
                        errores.push('• El taller es requerido');
                    }
                    
                    if (!this.form.kilometrajeActual || this.form.kilometrajeActual <= 0) {
                        errores.push('• El kilometraje actual es requerido y debe ser mayor a 0');
                    }
                    
                    if (!this.form.costoEstimado || this.form.costoEstimado <= 0) {
                        errores.push('• El costo estimado es requerido y debe ser mayor a 0');
                    }
                    
                    if (!this.form.descripcion || this.form.descripcion.trim() === '') {
                        errores.push('• La descripción es requerida');
                    }
                    
                    // Validación condicional: si está completado, debe tener fecha de finalización
                    if (this.form.estado === 3 && !this.form.fechaFinalizacion) {
                        errores.push('• Si el estado es "Completado", la fecha de finalización es requerida');
                    }

                    if (errores.length > 0) {
                        console.error('❌ Errores de validación:', errores);
                        alert('Errores de validación:\n\n' + errores.join('\n'));
                        return false;
                    }
                    
                    return true;
                },

                // ========== MÉTODOS DE FORMULARIO ==========
                resetForm() {
                    this.form = { 
                        id: null, 
                        vehiculoId: '', 
                        fechaInicio: '', 
                        fechaEstimadaFinalizacion: '', 
                        tipoMantenimiento: '', 
                        descripcion: '', 
                        taller: '', 
                        kilometrajeActual: '', 
                        costoEstimado: '', 
                        estado: 1, 
                        usuarioRegistroId: '',
                        // Campos adicionales
                        fechaFinalizacion: '',
                        descripcionFinal: '',
                        costo: '',
                        usuarioFinalizacionId: '',
                        documentos: [],
                        documentosExistentes: []
                    };
                    this.editando = false;
                },

                // ========== MÉTODOS PARA CREAR MANTENIMIENTO ==========
                abrirNuevoMantenimiento() {
                    console.log('🔧 Abriendo formulario nuevo mantenimiento...');
                    this.resetForm();
                    this.editando = false;
                    
                    this.$nextTick(() => {
                        const modalElement = document.getElementById('nuevoMantenimientoModal');
                        if (modalElement) {
                            const modal = new bootstrap.Modal(modalElement);
                            modal.show();
                        } else {
                            console.error('❌ Modal element not found');
                        }
                    });
                },

                async guardarNuevoMantenimiento(event) {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    
                    this.guardando = true;
                    console.log('🚀 Guardando nuevo mantenimiento...');
                    
                    try {
                        if (!this.validarFormulario()) {
                            return;
                        }

                        console.log('📎 Enviando con FormData (requerido por [FromForm])');
                        
                        const formData = new FormData();
                        
                        // Agregar todos los campos como FormData
                        formData.append('VehiculoId', this.form.vehiculoId.toString());
                        formData.append('FechaInicio', this.form.fechaInicio);
                        
                        if (this.form.fechaEstimadaFinalizacion) {
                            formData.append('FechaEstimadaFinalizacion', this.form.fechaEstimadaFinalizacion);
                        }
                        
                        formData.append('TipoMantenimiento', this.form.tipoMantenimiento.trim());
                        formData.append('Descripcion', this.form.descripcion.trim());
                        formData.append('Taller', this.form.taller.trim());
                        formData.append('KilometrajeActual', this.form.kilometrajeActual.toString());
                        formData.append('CostoEstimado', this.form.costoEstimado.toString());
                        formData.append('Estado', this.form.estado.toString());
                        formData.append('UsuarioRegistroId', this.form.usuarioRegistroId.trim());
                        
                        // Agregar archivos si existen
                        if (this.form.documentos && this.form.documentos.length > 0) {
                            console.log('📄 Agregando archivos:', this.form.documentos.length);
                            this.form.documentos.forEach((file) => {
                                if (file instanceof File) {
                                    formData.append('Documentos', file);
                                    console.log(`  - ${file.name} (${file.size} bytes)`);
                                }
                            });
                        }

                        // Debug
                        console.log('📦 Datos que se envían:');
                        for (let [key, value] of formData.entries()) {
                            if (value instanceof File) {
                                console.log(`  ${key}: File(${value.name}, ${value.size} bytes)`);
                            } else {
                                console.log(`  ${key}: ${value}`);
                            }
                        }

                        const response = await fetch(apiBase, {
                            method: 'POST',
                            credentials: 'include', // Incluir cookies de autenticación
                            headers: {
                                'Accept': 'application/json'
                            },
                            body: formData
                        });

                        console.log('📡 Response status:', response.status);
                        
                        if (!response.ok) {
                            if (response.status === 401) {
                                console.error('🚫 ERROR 401 - NO AUTORIZADO');
                                alert('No estás autorizado. Por favor, inicia sesión nuevamente.');
                                return;
                            }
                            
                            const errorText = await response.text();
                            console.error('❌ Error response:', errorText);
                            
                            // ========== MANEJO ESPECÍFICO DE ERRORES DE FOREIGN KEY ==========
                            let errorMessage = this.procesarErrorRespuesta(errorText, response.status);
                            
                            throw new Error(errorMessage);
                        }

                        const result = await response.json();
                        console.log('✅ Mantenimiento creado:', result);
                        
                        this.cerrarModal('nuevoMantenimientoModal');
                        await this.cargarMantenimientos();
                        this.resetForm();
                        
                        alert('✅ Mantenimiento creado exitosamente');
                        
                    } catch (error) {
                        console.error('💥 Error al crear mantenimiento:', error);
                        this.mostrarErrorAmigable(error.message);
                    } finally {
                        this.guardando = false;
                    }
                },

                // Nuevo método para procesar errores específicos
                procesarErrorRespuesta(errorText, statusCode) {
                    try {
                        // Intentar parsear como JSON primero
                        const errorJson = JSON.parse(errorText);
                        let errorMessage = '';
                        
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        } else if (errorJson.errors) {
                            errorMessage = Object.values(errorJson.errors).flat().join('\n');
                        } else if (errorJson.title) {
                            errorMessage = errorJson.title;
                        } else {
                            errorMessage = errorText;
                        }
                        
                        // Verificar si es un error de FOREIGN KEY específico para vehículos
                        if (this.esForeignKeyVehiculoError(errorMessage)) {
                            return `El vehículo con ID ${this.form.vehiculoId} no existe en el sistema.\n\nPor favor:\n• Verifica que el ID del vehículo sea correcto\n• Asegúrate de que el vehículo esté registrado en el sistema\n• Consulta la lista de vehículos disponibles`;
                        }
                        
                        // Verificar otros tipos de errores de FOREIGN KEY
                        if (this.esForeignKeyError(errorMessage)) {
                            return this.obtenerMensajeForeignKeyError(errorMessage);
                        }
                        
                        return errorMessage;
                        
                    } catch (parseError) {
                        // Si no se puede parsear como JSON, trabajar con el texto directo
                        console.log('No se pudo parsear como JSON, procesando como texto:', errorText);
                        
                        // Verificar si es un error de FOREIGN KEY específico para vehículos
                        if (this.esForeignKeyVehiculoError(errorText)) {
                            return `El vehículo con ID ${this.form.vehiculoId} no existe en el sistema.\n\nPor favor:\n• Verifica que el ID del vehículo sea correcto\n• Asegúrate de que el vehículo esté registrado en el sistema\n• Consulta la lista de vehículos disponibles`;
                        }
                        
                        // Verificar otros tipos de errores de FOREIGN KEY
                        if (this.esForeignKeyError(errorText)) {
                            return this.obtenerMensajeForeignKeyError(errorText);
                        }
                        
                        return errorText || `Error ${statusCode}`;
                    }
                },

                // Método para detectar errores de FOREIGN KEY específicos de vehículos
                esForeignKeyVehiculoError(errorMessage) {
                    const mensajeLower = errorMessage.toLowerCase();
                    return (
                        mensajeLower.includes('foreign key') && 
                        (
                            mensajeLower.includes('fk_mantenimientos_vehiculos_vehiculoid') ||
                            mensajeLower.includes('vehiculos') ||
                            mensajeLower.includes('vehiculoid')
                        )
                    ) || (
                        mensajeLower.includes('instrucción insert en conflicto') &&
                        mensajeLower.includes('vehiculos') &&
                        mensajeLower.includes('vehiculoid')
                    );
                },

                // Método para detectar errores de FOREIGN KEY en general
                esForeignKeyError(errorMessage) {
                    const mensajeLower = errorMessage.toLowerCase();
                    return mensajeLower.includes('foreign key') || 
                        mensajeLower.includes('instrucción insert en conflicto') ||
                        mensajeLower.includes('fk_');
                },

                // Método para obtener mensajes amigables para diferentes tipos de FOREIGN KEY
                obtenerMensajeForeignKeyError(errorMessage) {
                    const mensajeLower = errorMessage.toLowerCase();
                    
                    if (mensajeLower.includes('vehiculo')) {
                        return `El vehículo especificado no existe en el sistema.\n\nPor favor verifica el ID del vehículo.`;
                    }
                    
                    if (mensajeLower.includes('usuario')) {
                        return `El usuario especificado no existe en el sistema.\n\nPor favor verifica el ID del usuario.`;
                    }
                    
                    if (mensajeLower.includes('taller')) {
                        return `El taller especificado no existe en el sistema.\n\nPor favor verifica la información del taller.`;
                    }
                    
                    // Mensaje genérico para otros tipos de FOREIGN KEY
                    return `Existe un problema de referencia en los datos.\n\nUno de los valores especificados no existe en el sistema. Por favor verifica toda la información ingresada.`;
                },

                // Método mejorado para mostrar errores de forma amigable
                mostrarErrorAmigable(errorMessage) {
                    // Detectar si es un error de vehículo no encontrado
                    if (this.esForeignKeyVehiculoError(errorMessage)) {
                        // Usar SweetAlert2 si está disponible, sino alert con mejor formato
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'error',
                                title: '¡Vehículo no encontrado!',
                                html: `
                                    <div class="text-start">
                                        <p><strong>El vehículo con ID ${this.form.vehiculoId} no existe en el sistema.</strong></p>
                                        <hr>
                                        <p><strong>¿Qué puedes hacer?</strong></p>
                                        <ul class="text-start">
                                            <li>Verifica que el ID del vehículo sea correcto</li>
                                            <li>Asegúrate de que el vehículo esté registrado en el sistema</li>
                                            <li>Consulta la lista de vehículos disponibles en el módulo de Vehículos</li>
                                            <li>Si el vehículo no existe, créalo primero antes de registrar el mantenimiento</li>
                                        </ul>
                                    </div>
                                `,
                                confirmButtonText: 'Entendido',
                                confirmButtonColor: '#d33',
                                width: '500px'
                            });
                        } else {
                            alert(`🚗 VEHÍCULO NO ENCONTRADO\n\n` +
                                `El vehículo con ID ${this.form.vehiculoId} no existe en el sistema.\n\n` +
                                `¿QUÉ PUEDES HACER?\n` +
                                `• Verifica que el ID del vehículo sea correcto\n` +
                                `• Asegúrate de que el vehículo esté registrado en el sistema\n` +
                                `• Consulta la lista de vehículos disponibles\n` +
                                `• Si el vehículo no existe, créalo primero`);
                        }
                    } else {
                        // Para otros tipos de error, mostrar el mensaje original pero mejorado
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'error',
                                title: '¡Error al crear mantenimiento!',
                                text: errorMessage,
                                confirmButtonText: 'Cerrar',
                                confirmButtonColor: '#d33'
                            });
                        } else {
                            alert(`❌ ERROR AL CREAR MANTENIMIENTO\n\n${errorMessage}`);
                        }
                    }
                },

                // ========== MÉTODOS PARA EDITAR MANTENIMIENTO ==========
                async editarMantenimiento(mnt) {
                    try {
                        console.log('✏️ Preparando edición del mantenimiento:', mnt.id);
                        
                        // Primero cargar los documentos existentes del mantenimiento
                        await this.cargarDocumentosMantenimiento(mnt.id);
                        
                        // Copiar todos los campos del mantenimiento al formulario
                        this.form = {
                            id: mnt.id,
                            vehiculoId: mnt.vehiculoId,
                            fechaInicio: mnt.fechaInicio ? mnt.fechaInicio.split('T')[0] : '',
                            fechaEstimadaFinalizacion: mnt.fechaEstimadaFinalizacion ? mnt.fechaEstimadaFinalizacion.split('T')[0] : '',
                            tipoMantenimiento: mnt.tipoMantenimiento || '',
                            descripcion: mnt.descripcion || '',
                            taller: mnt.taller || '',
                            kilometrajeActual: mnt.kilometrajeActual || '',
                            costoEstimado: mnt.costoEstimado || '',
                            estado: mnt.estado || 1,
                            usuarioRegistroId: mnt.usuarioRegistroId || '',
                            // Campos adicionales
                            fechaFinalizacion: mnt.fechaFinalizacion ? mnt.fechaFinalizacion.split('T')[0] : '',
                            descripcionFinal: mnt.descripcionFinal || '',
                            costo: mnt.costo || '',
                            usuarioFinalizacionId: mnt.usuarioFinalizacionId || '',
                            documentos: [], // Nuevos documentos
                            documentosExistentes: this.documentos || [] // Documentos ya guardados
                        };
                        
                        this.editando = false;
                        console.log('📄 Documentos existentes cargados:', this.form.documentosExistentes.length);
                        
                        const modal = new bootstrap.Modal(document.getElementById('editarMantenimientoModal'));
                        modal.show();
                        
                    } catch (error) {
                        console.error('❌ Error al preparar edición:', error);
                        alert('Error al cargar los datos del mantenimiento para edición');
                    }
                },

                async guardarEdicionMantenimiento() {
                    this.editando = true;
                    
                    try {
                        if (!this.validarFormularioEdicion()) {
                            return;
                        }

                        console.log('📝 Actualizando mantenimiento:', this.form);

                        const formData = new FormData();
                        
                        // Campos básicos actualizables
                        formData.append('FechaInicio', this.form.fechaInicio);
                        
                        if (this.form.fechaEstimadaFinalizacion) {
                            formData.append('FechaEstimadaFinalizacion', this.form.fechaEstimadaFinalizacion);
                        }
                        
                        formData.append('TipoMantenimiento', this.form.tipoMantenimiento.trim());
                        formData.append('Descripcion', this.form.descripcion.trim());
                        formData.append('Taller', this.form.taller.trim());
                        formData.append('KilometrajeActual', this.form.kilometrajeActual.toString());
                        formData.append('CostoEstimado', this.form.costoEstimado.toString());
                        
                        if (this.form.estado !== null && this.form.estado !== undefined) {
                            formData.append('Estado', this.form.estado.toString());
                        }
                        
                        // Campos adicionales actualizables
                        if (this.form.fechaFinalizacion) {
                            formData.append('FechaFinalizacion', this.form.fechaFinalizacion);
                        }
                        
                        if (this.form.descripcionFinal) {
                            formData.append('DescripcionFinal', this.form.descripcionFinal.trim());
                        }
                        
                        if (this.form.costo) {
                            formData.append('Costo', this.form.costo.toString());
                        }
                        
                        if (this.form.usuarioRegistroId) {
                            formData.append('UsuarioRegistroId', this.form.usuarioRegistroId.trim());
                        }
                        
                        if (this.form.usuarioFinalizacionId) {
                            formData.append('UsuarioFinalizacionId', this.form.usuarioFinalizacionId.trim());
                        }

                        // Agregar documentos nuevos si existen
                        if (this.form.documentos && this.form.documentos.length > 0) {
                            console.log('📄 Agregando documentos nuevos:', this.form.documentos.length);
                            this.form.documentos.forEach((file) => {
                                if (file instanceof File) {
                                    formData.append('Documentos', file);
                                    console.log(`  - ${file.name} (${file.size} bytes)`);
                                }
                            });
                        }

                        const response = await fetch(`${apiBase}/${this.form.id}`, {
                            method: 'PUT',
                            headers: {
                                'Accept': 'application/json'
                            },
                            body: formData
                        });

                        console.log('📡 Response status:', response.status);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('❌ Error response:', errorText);
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }

                        const result = await response.json();
                        console.log('✅ Mantenimiento actualizado:', result);

                        await this.cargarMantenimientos();
                        this.cerrarModal('editarMantenimientoModal');
                        this.resetForm();
                        alert('✅ Mantenimiento actualizado exitosamente');

                    } catch (error) {
                        console.error('💥 Error al actualizar mantenimiento:', error);
                        alert(`❌ Error al actualizar el mantenimiento:\n${error.message}`);
                    } finally {
                        this.editando = false;
                    }
                },

                // ========== MÉTODOS PARA FINALIZAR MANTENIMIENTO ==========
                abrirCompletar(mnt) {
                    this.finalizar = { 
                        id: mnt.id, 
                        fechaFinalizacion: new Date().toISOString().split('T')[0],
                        costoFinal: mnt.costoEstimado || 0,
                        descripcionFinal: '',
                        usuarioFinalizacionId: '',
                        documentos: []
                    };
                    
                    console.log('🔧 Abriendo modal completar para mantenimiento:', mnt.id);
                    
                    const modal = new bootstrap.Modal(document.getElementById('completarMantenimientoModal'));
                    modal.show();
                },

                async finalizarMantenimiento() {
                    this.finalizando = true;
                    
                    try {
                        // Validar campos requeridos
                        if (!this.finalizar.fechaFinalizacion) {
                            alert('❌ La fecha de finalización es requerida');
                            return;
                        }
                        
                        if (!this.finalizar.costoFinal || this.finalizar.costoFinal <= 0) {
                            alert('❌ El costo final es requerido y debe ser mayor a 0');
                            return;
                        }

                        console.log('🏁 Finalizando mantenimiento:', this.finalizar);

                        const formData = new FormData();
                        
                        formData.append('FechaFinalizacion', this.finalizar.fechaFinalizacion);
                        formData.append('CostoFinal', this.finalizar.costoFinal.toString());
                        
                        if (this.finalizar.descripcionFinal) {
                            formData.append('DescripcionFinal', this.finalizar.descripcionFinal.trim());
                        }
                        
                        if (this.finalizar.usuarioFinalizacionId) {
                            formData.append('UsuarioFinalizacionId', this.finalizar.usuarioFinalizacionId.trim());
                        }

                        // Agregar archivos si existen
                        if (this.finalizar.documentos && this.finalizar.documentos.length > 0) {
                            console.log('📄 Agregando documentos de finalización:', this.finalizar.documentos.length);
                            this.finalizar.documentos.forEach((file) => {
                                if (file instanceof File) {
                                    formData.append('Documentos', file);
                                    console.log(`  - ${file.name} (${file.size} bytes)`);
                                }
                            });
                        }

                        const response = await fetch(`${apiBase}/${this.finalizar.id}/finalizar`, {
                            method: 'POST',
                            headers: { 
                                'Accept': 'application/json'
                            },
                            body: formData
                        });

                        console.log('📡 Response status:', response.status);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('❌ Error response:', errorText);
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }

                        const result = await response.json();
                        console.log('✅ Mantenimiento finalizado:', result);

                        this.cerrarModal('completarMantenimientoModal');
                        await this.cargarMantenimientos();
                        
                        // Limpiar el objeto finalizar
                        this.finalizar = { 
                            id: null, 
                            fechaFinalizacion: '', 
                            costoFinal: '', 
                            descripcionFinal: '',
                            usuarioFinalizacionId: '',
                            documentos: [] 
                        };
                        
                        alert('✅ Mantenimiento completado exitosamente');

                    } catch (error) {
                        console.error('💥 Error al completar mantenimiento:', error);
                        alert(`❌ Error al completar el mantenimiento:\n${error.message}`);
                    } finally {
                        this.finalizando = false;
                    }
                },

                // ========== MÉTODOS PARA DOCUMENTOS (NUEVO - SIMILAR A VEHÍCULOS) ==========
                async cargarDocumentosMantenimiento(mantenimientoId) {
                    this.cargandoDocumentos = true;
                    console.log('📄 Cargando documentos del mantenimiento:', mantenimientoId);
                    
                    try {
                        // Usar el endpoint de documentos filtrado por mantenimiento
                        const response = await fetch(`${documentosApiBase}/mantenimiento/${mantenimientoId}`);
                        
                        if (!response.ok) {
                            if (response.status === 404) {
                                console.log('📄 No hay documentos para este mantenimiento');
                                this.documentos = [];
                                return;
                            }
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        this.documentos = data;
                        console.log('📋 Documentos cargados:', this.documentos.length);
                        
                    } catch (error) {
                        console.error('❌ Error al cargar documentos:', error);
                        this.documentos = [];
                        // No mostrar error si es 404, solo si es otro tipo de error
                        if (!error.message.includes('404')) {
                            alert('Error al cargar los documentos: ' + error.message);
                        }
                    } finally {
                        this.cargandoDocumentos = false;
                    }
                },

                async descargarDocumento(documento) {
                    try {
                        console.log('📥 Descargando documento:', documento.nombre);
                        
                        // Obtener información del documento
                        const infoResponse = await fetch(`${documentosApiBase}/${documento.id}`);
                        if (!infoResponse.ok) {
                            throw new Error('Error al obtener información del documento');
                        }
                        
                        // Descargar el contenido del documento
                        const response = await fetch(`${documentosApiBase}/${documento.id}/Contenido`, { 
                            responseType: 'blob' 
                        });
                        
                        if (!response.ok) {
                            throw new Error('Error al descargar el documento');
                        }
                        
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;

                        let filename = documento.nombre || 'documento';
                        if (!filename.includes('.')) {
                            const contentType = response.headers.get('content-type');
                            const extension = this.obtenerExtensionPorContentType(contentType);
                            if (extension) filename += `.${extension}`;
                        }

                        link.setAttribute('download', filename);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);

                        console.log('✅ Documento descargado:', filename);
                        
                    } catch (error) {
                        console.error('💥 Error al descargar documento:', error);
                        alert(`❌ Error al descargar el documento: ${error.message}`);
                    }
                },

                async eliminarDocumentoExistente(documentoId, index) {
                    if (!confirm('¿Está seguro de eliminar este documento? Esta acción no se puede deshacer.')) {
                        return;
                    }
                    
                    try {
                        console.log(`🗑️ Eliminando documento ID: ${documentoId}`);
                        
                        const response = await fetch(`${documentosApiBase}/${documentoId}`, {
                            method: 'DELETE',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: No se pudo eliminar el documento`);
                        }
                        
                        // Remover del array local de documentos existentes
                        if (this.form.documentosExistentes && this.form.documentosExistentes.length > index) {
                            this.form.documentosExistentes.splice(index, 1);
                        }
                        
                        // También remover del array de documentos general si existe
                        if (this.documentos && this.documentos.length > 0) {
                            const docIndex = this.documentos.findIndex(doc => doc.id === documentoId);
                            if (docIndex !== -1) {
                                this.documentos.splice(docIndex, 1);
                            }
                        }
                        
                        console.log('✅ Documento eliminado exitosamente');
                        alert('✅ Documento eliminado exitosamente');
                        
                    } catch (error) {
                        console.error('💥 Error al eliminar documento:', error);
                        alert(`❌ Error al eliminar el documento: ${error.message}`);
                    }
                },

                handleFileUpload(event) {
                    const files = event.target.files;
                    if (!files || files.length === 0) return;
                    
                    console.log('📁 Archivos seleccionados:', files.length);
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        
                        // Validar tamaño (5MB máximo)
                        if (file.size > 5 * 1024 * 1024) {
                            alert(`El archivo "${file.name}" es demasiado grande. Máximo 5MB.`);
                            continue;
                        }
                        
                        // Validar tipo de archivo
                        const allowedTypes = [
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'image/jpeg',
                            'image/jpg', 
                            'image/png',
                            'text/plain'
                        ];
                        
                        if (!allowedTypes.includes(file.type)) {
                            alert(`El archivo "${file.name}" no es un formato válido.`);
                            continue;
                        }
                        
                        // Guardar directamente el File object
                        this.form.documentos.push(file);
                        console.log('📄 Archivo agregado:', file.name);
                    }
                    
                    event.target.value = '';
                },

                handleEditFileUpload(event) {
                    const files = event.target.files;
                    if (!files || files.length === 0) return;
                    
                    console.log('📁 Archivos de edición seleccionados:', files.length);
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        
                        // Validar tamaño (5MB máximo)
                        if (file.size > 5 * 1024 * 1024) {
                            alert(`El archivo "${file.name}" es demasiado grande. Máximo 5MB.`);
                            continue;
                        }
                        
                        // Validar tipo de archivo
                        const allowedTypes = [
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'image/jpeg',
                            'image/jpg', 
                            'image/png',
                            'text/plain'
                        ];
                        
                        if (!allowedTypes.includes(file.type)) {
                            alert(`El archivo "${file.name}" no es un formato válido.`);
                            continue;
                        }
                        
                        // Inicializar documentos si no existe
                        if (!this.form.documentos) {
                            this.form.documentos = [];
                        }
                        
                        // Agregar el archivo directamente
                        this.form.documentos.push(file);
                        console.log('📄 Documento de edición agregado:', file.name);
                    }
                    
                    event.target.value = '';
                },

                handleFinalizacionFileUpload(event) {
                    const files = event.target.files;
                    if (!files || files.length === 0) return;
                    
                    console.log('📁 Archivos de finalización seleccionados:', files.length);
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        
                        // Validar tamaño (5MB máximo)
                        if (file.size > 5 * 1024 * 1024) {
                            alert(`El archivo "${file.name}" es demasiado grande. Máximo 5MB.`);
                            continue;
                        }
                        
                        // Validar tipo de archivo
                        const allowedTypes = [
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'image/jpeg',
                            'image/jpg', 
                            'image/png',
                            'text/plain'
                        ];
                        
                        if (!allowedTypes.includes(file.type)) {
                            alert(`El archivo "${file.name}" no es un formato válido.`);
                            continue;
                        }
                        
                        // Agregar el archivo directamente
                        this.finalizar.documentos.push(file);
                        console.log('📄 Documento de finalización agregado:', file.name);
                    }
                    
                    event.target.value = '';
                },

                removeDocument(index) {
                    const documento = this.form.documentos[index];
                    const fileName = documento.name || documento.nombre || 'documento';
                    if (confirm(`¿Eliminar el archivo "${fileName}"?`)) {
                        this.form.documentos.splice(index, 1);
                        console.log('🗑️ Archivo eliminado:', fileName);
                    }
                },

                removeEditDocument(index) {
                    const documento = this.form.documentos[index];
                    const fileName = documento.name || documento.nombre || 'documento';
                    if (confirm(`¿Eliminar el archivo "${fileName}"?`)) {
                        this.form.documentos.splice(index, 1);
                        console.log('🗑️ Documento de edición eliminado:', fileName);
                    }
                },

                removeFinalizacionDocument(index) {
                    const documento = this.finalizar.documentos[index];
                    if (confirm(`¿Eliminar el archivo "${documento.name}"?`)) {
                        this.finalizar.documentos.splice(index, 1);
                        console.log('🗑️ Documento de finalización eliminado:', documento.name);
                    }
                },

                // ========== MÉTODOS UTILITARIOS PARA DOCUMENTOS ==========
                obtenerExtension(filename) {
                    if (!filename) return '';
                    const parts = filename.split('.');
                    return parts.length > 1 ? parts.pop().toUpperCase() : '';
                },

                obtenerTipoDocumento(filename) {
                    const ext = this.obtenerExtension(filename).toLowerCase();
                    const tipos = {
                        pdf: 'PDF', doc: 'Word', docx: 'Word',
                        xls: 'Excel', xlsx: 'Excel',
                        ppt: 'PowerPoint', pptx: 'PowerPoint',
                        jpg: 'Imagen', jpeg: 'Imagen', png: 'Imagen', gif: 'Imagen',
                        txt: 'Texto', zip: 'Archivo', rar: 'Archivo'
                    };
                    return tipos[ext] || 'Documento';
                },

                obtenerExtensionPorContentType(contentType) {
                    const mime = {
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

                formatFileSize(bytes) {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                },

                formatearFecha(fecha) {
                    if (!fecha) return 'No especificada';
                    try {
                        return new Date(fecha).toLocaleDateString('es-DO');
                    } catch {
                        return 'Fecha inválida';
                    }
                },

                // ========== MÉTODOS UTILITARIOS ==========
                cerrarModal(modalId) {
                    const modalElement = document.getElementById(modalId);
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) {
                            modalInstance.hide();
                        }
                    }
                },

                // ========== MÉTODOS DE ACCIONES ==========
                eliminarMantenimiento(id) {
                    if (confirm('¿Seguro que desea eliminar este mantenimiento?')) {
                        fetch(`${apiBase}/${id}`, { method: 'DELETE' })
                            .then(response => {
                                if (response.ok) {
                                    this.cargarMantenimientos();
                                    alert('✅ Mantenimiento eliminado exitosamente');
                                } else {
                                    throw new Error(`Error ${response.status}`);
                                }
                            })
                            .catch(error => {
                                console.error('Error al eliminar:', error);
                                alert('❌ Error al eliminar el mantenimiento');
                            });
                    }
                },

                async verDetalle(id) {
                    try {
                        console.log('📋 Cargando detalles completos del mantenimiento:', id);
                        
                        // Cargar detalles del mantenimiento
                        const response = await fetch(`${apiBase}/${id}`);
                        if (!response.ok) {
                            throw new Error(`Error ${response.status}: ${response.statusText}`);
                        }
                        
                        const mantenimiento = await response.json();
                        console.log('📄 Mantenimiento cargado:', mantenimiento);
                        
                        // Cargar documentos del mantenimiento
                        await this.cargarDocumentosMantenimiento(id);
                        
                        // Asignar documentos al detalle
                        mantenimiento.documentos = this.documentos;
                        
                        this.detalle = mantenimiento;
                        const modal = new bootstrap.Modal(document.getElementById('mantenimientoDetailsModal'));
                        modal.show();
                        
                    } catch (error) {
                        console.error('💥 Error al cargar detalles:', error);
                        // Fallback: usar datos del listado
                        const mantenimiento = this.mantenimientos.find(m => m.id === id);
                        if (mantenimiento) {
                            this.detalle = mantenimiento;
                            this.detalle.documentos = [];
                            const modal = new bootstrap.Modal(document.getElementById('mantenimientoDetailsModal'));
                            modal.show();
                        } else {
                            alert('❌ Error al cargar los detalles del mantenimiento');
                        }
                    }
                },

                // ========== MÉTODOS DE ESTILO Y VISUALIZACIÓN ==========
                estadoBadge(estado) {
                    switch (estado) {
                        case 'SinEspecificar': return 'badge-sin-especificar';
                        case 'Programado': return 'badge-programado';
                        case 'EnProceso': return 'badge-en-proceso';
                        case 'Completado': return 'badge-completado';
                        case 'Cancelado': return 'badge-cancelado';
                        case 'PendientePago': return 'badge-pendiente-pago';
                        default: return 'badge-sin-especificar';
                    }
                },

                estadoTexto(estado) {
                    switch (estado) {
                        case 'SinEspecificar': return 'Sin Especificar';
                        case 'Programado': return 'Programado';
                        case 'EnProceso': return 'En Proceso';
                        case 'Completado': return 'Completado';
                        case 'Cancelado': return 'Cancelado';
                        case 'PendientePago': return 'Pendiente de Pago';
                        default: return estado;
                    }
                },

                estadoProgress(estado) {
                    switch (estado) {
                        case 'SinEspecificar': return 'bg-light';
                        case 'Programado': return 'bg-info';
                        case 'EnProceso': return 'bg-warning';
                        case 'Completado': return 'bg-success';
                        case 'Cancelado': return 'bg-secondary';
                        case 'PendientePago': return 'bg-danger';
                        default: return 'bg-light';
                    }
                },

                progreso(estado) {
                    switch (estado) {
                        case 'SinEspecificar': return 0;
                        case 'Programado': return 0;
                        case 'EnProceso': return 65;
                        case 'Completado': return 100;
                        case 'Cancelado': return 30;
                        case 'PendientePago': return 85;
                        default: return 0;
                    }
                }
            },
            watch: {
                'filtros.busqueda': function(newVal, oldVal) {
                    // Aplicar filtro automáticamente después de una pausa
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        this.paginacion.paginaActual = 1; // Resetear página
                        this.aplicarFiltros();
                    }, 500);
                },
                'filtros.estado': function() {
                    this.paginacion.paginaActual = 1; // Resetear página
                    this.aplicarFiltros();
                },
                'filtros.tipo': function() {
                    this.paginacion.paginaActual = 1; // Resetear página
                    this.aplicarFiltros();
                },
                'filtros.taller': function() {
                    this.paginacion.paginaActual = 1; // Resetear página
                    this.aplicarFiltros();
                }
            },
            mounted() {
                console.log('Vue mounted - Iniciando carga de datos...');
                this.cargarMantenimientos();
            }
        });
        
        console.log('✅ Vue app inicializada');