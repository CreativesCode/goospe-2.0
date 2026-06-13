# GESAD API — Catálogo completo de endpoints

> Generado automáticamente desde `swagger.json` (OpenAPI 3.0.1, "API GESAD DE ACCESO A DATOS" vVersión 1.1).
> Todos los paths llevan `{auth_Code}` (código de autorización del centro de trabajo) — omitido de la columna de parámetros por brevedad.
> Parámetros en **negrita** = obligatorios. Paginación: `numero_Pagina` empieza en 1; `registros_Pagina` máx. 1000.

## Índice de grupos

- 01.- Maestros (25 endpoints)
- 02- Trabajadores (35 endpoints)
- 03.- Trabajadores - Históricos (14 endpoints)
- 04.- Usuarios (21 endpoints)
- 05.- Usuarios - Históricos (6 endpoints)
- 06.- Organismos Oficiales (10 endpoints)
- 07.- Control Presencia (3 endpoints)
- 08- Comunicaciones Externas (1 endpoints)
- 10.- Utilidades (1 endpoints)

## 01.- Maestros

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Maestros/Empresas/{auth_Code}` | Datos de empresas | — | `Empresas[]` |
| GET | `/api/Maestros/Centros/{auth_Code}` | Datos de centros | — | `Centros[]` |
| GET | `/api/Maestros/CalendarioLaboral/{auth_Code}` | Calendario laboral del centro | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Calendario_Laboral[]` |
| GET | `/api/Maestros/Bancos/{auth_Code}` | Datos de bancos | — | `Bancos[]` |
| GET | `/api/Maestros/TiposBajasPermisos/{auth_Code}` | Datos de tipos de bajas y permisos | — | `Tipos_Bajas_Permisos[]` |
| GET | `/api/Maestros/EstadoCivil/{auth_Code}` | Tipos de estados civiles | — | `Estado_Civil[]` |
| GET | `/api/Maestros/ModosDPZ/{auth_Code}` | Modos de desplazamiento | — | `Modo_Dpz[]` |
| GET | `/api/Maestros/Provincias/{auth_Code}` | Datos de provincias | — | `Provincias[]` |
| GET | `/api/Maestros/TiposOtrosTiempos/{auth_Code}` | Tipos de otros tiempos | — | `Otros_Tiempos[]` |
| GET | `/api/Maestros/CategoriasProfesionales/{auth_Code}` | Datos de las categorías profesionales | — | `Categorias_Profesionales[]` |
| GET | `/api/Maestros/GruposCotizacion/{auth_Code}` | Datos de los grupos de cotización | — | `Grupos_Cotizacion[]` |
| GET | `/api/Maestros/PuestosTrabajo/{auth_Code}` | Tipos de puestos de trabajo | — | `Puestos_Trabajo[]` |
| GET | `/api/Maestros/TiposContrato/{auth_Code}` | Tipos de contrato | — | `Tipos_Contrato[]` |
| GET | `/api/Maestros/TiposComplementosNomina/{auth_Code}` | Tipos de complementos especiales de nómina | — | `Complementos_Nomina[]` |
| GET | `/api/Maestros/Zonas/{auth_Code}` | Datos de zonas | — | `Zonas[]` |
| GET | `/api/Maestros/ZonasTrabajoSocial/{auth_Code}` | Datos de zonas de trabajo social | — | `Zonas_Trab_Social[]` |
| GET | `/api/Maestros/TiposOrganismosOficiales/{auth_Code}` | Tipos de organismos oficiales | — | `Tipos_Organismos_Oficiales[]` |
| GET | `/api/Maestros/GradosDependencia/{auth_Code}` | Grados de dependencia | — | `Grados_Dependencia[]` |
| GET | `/api/Maestros/ClasificacionContratosCP/{auth_Code}` | Clasificaciones de Contratos de Contraprestación | — | `Clasificacion_Contratos_Cp[]` |
| GET | `/api/Maestros/TipologiasUsuarios/{auth_Code}` | Tipologías de usuario | — | `Tipologias_Usuarios[]` |
| GET | `/api/Maestros/Tareas/{auth_Code}` | Tareas | — | `Tareas[]` |
| GET | `/api/Maestros/Servicios_Fact_Usuarios/{auth_Code}` | Servicios facturables a usuarios | — | `Servicios_Fac_Usuarios[]` |
| GET | `/api/Maestros/TiposTarifa/{auth_Code}` | Tipos de Tarifa | — | `Tipos_Tarifa[]` |
| GET | `/api/Maestros/TrabajadoresSociales/{auth_Code}` | Trabajadores Sociales | — | `Trabajadores_Sociales[]` |
| GET | `/api/Maestros/Encuestas/{auth_Code}` | Plantillas de encuestas | — | `IDataPacker` |

## 02- Trabajadores

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| POST | `/api/Trabajadores/AltaTrabajador/{auth_code}` | Alta de trabajadores | body: ADDTRABAJADOR | `—` |
| PUT | `/api/Trabajadores/ActualizarTrabajador/{auth_code}` |  | body: UPDTRABAJADOR | `—` |
| GET | `/api/Trabajadores/Expedientes/{auth_Code}` | Datos generales del expediente de los trabajadores | **numero_Pagina**, registros_Pagina, fecha_Inicio, fecha_Fin | `Expedientes_Trabaj[]` |
| GET | `/api/Trabajadores/Expedientes/{auth_Code}/ID/{trabajador_ID}` | Datos generales del expediente de los trabajadores [1 trabajador] | **trabajador_ID** | `Expedientes_Trabaj_Idtrabaj[]` |
| POST | `/api/Trabajadores/AltaContrato/{auth_code}` | Actualización de contrato de de trabajadores | body: ADDCONTRATO | `—` |
| GET | `/api/Trabajadores/Contratos/{auth_Code}` | Historial de Contratos y cambios de contrato de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Contratos_Trabaj[]` |
| GET | `/api/Trabajadores/Contratos/{auth_Code}/ID/{trabajador_ID}` | Historial de Contratos y cambios de contrato de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Contratos_Trabaj_Idtrabaj[]` |
| PUT | `/api/Trabajadores/ActualizarContrato/{auth_code}` | Actualización de contrato de de trabajadores | body: UPDCONTRATO | `—` |
| PUT | `/api/Trabajadores/FinalizarContrato/{auth_code}` | Finalizar contrato de trabajadores | body: FINCONTRATO | `—` |
| DELETE | `/api/Trabajadores/EliminarContrato/{auth_code}` | Eliminar contrato de trabajadores | body: DLTCONTRATO | `—` |
| POST | `/api/Trabajadores/AddBajas/{auth_code}` | Registrar bajas de trabajadores. | body: ADDBAJAS | `—` |
| GET | `/api/Trabajadores/Bajas/{auth_Code}` | Historial de bajas de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Bajas_Trabaj[]` |
| GET | `/api/Trabajadores/Bajas/{auth_Code}/ID/{trabajador_ID}` | Historial de bajas de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Bajas_Trabaj_Idtrabaj[]` |
| PUT | `/api/Trabajadores/UpdBajas/{auth_code}` | Modificar bajas de trabajadores. | body: UPDBAJAS | `—` |
| DELETE | `/api/Trabajadores/DltBajas/{auth_code}` | Eliminar bajas de trabajadores. | body: DLTBAJAS | `—` |
| POST | `/api/Trabajadores/AddPermisos/{auth_code}` | Modificar permisos de trabajadores. | body: ADDPERMISOS | `—` |
| GET | `/api/Trabajadores/Permisos/{auth_Code}` | Historial de permisos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Permisos_Trabaj[]` |
| GET | `/api/Trabajadores/Permisos/{auth_Code}/ID/{trabajador_ID}` | Historial de permisos de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Permisos_Trabaj_Idtrabaj[]` |
| PUT | `/api/Trabajadores/UpdPermisos/{auth_code}` | Modificar permisos de trabajadores. | body: UPDPERMISOS | `—` |
| DELETE | `/api/Trabajadores/DltPermisos/{auth_code}` | Eliminar permisos de trabajadores. | body: DLTPERMISOS | `—` |
| GET | `/api/Trabajadores/ReglasTiempo/{auth_Code}` | Historial de reglas de tiempos y desplazamientos | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Reglas_Tiempo_Trabaj[]` |
| GET | `/api/Trabajadores/ReglasTiempo/{auth_Code}/ID/{trabajador_ID}` | Historial de reglas de tiempos y desplazamientos [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Reglas_Tiempo_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/Quejas/{auth_Code}` | Historial de quejas de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Quejas_Trabaj[]` |
| GET | `/api/Trabajadores/Quejas/{auth_Code}/PeriodoQueja` | Historial de quejas de los trabajadores en un periodo | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Quejas_Trabaj_Fechaqueja[]` |
| GET | `/api/Trabajadores/Quejas/{auth_Code}/ID/{trabajador_ID}` | Historial de quejas de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina | `Quejas_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/Titulaciones/{auth_Code}` | Historial de titulaciones de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Titulaciones_Trabaj[]` |
| GET | `/api/Trabajadores/Titulaciones/{auth_Code}/ID/{trabajador_ID}` | Historial de titulaciones de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Titulaciones_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/Experiencia/{auth_Code}` | Historial de experiencia de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Experiencia_Trabaj[]` |
| GET | `/api/Trabajadores/Experiencia/{auth_Code}/ID/{trabajador_ID}` | Historial de experiencia de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Experiencia_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/CEspeciales/{auth_Code}` | Historial de complementos especiales de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Cespeciales_Trabaj[]` |
| GET | `/api/Trabajadores/CEspeciales/{auth_Code}/ID/{trabajador_ID}` | Historial de complementos especiales de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Cespeciales_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/Recursos/{auth_Code}` | Historial de recursos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Recursos_Trabaj[]` |
| GET | `/api/Trabajadores/Recursos/{auth_Code}/ID/{trabajador_ID}` | Historial de recursos de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Recursos_Trabaj_Idtrabaj[]` |
| GET | `/api/Trabajadores/Encuestas/{auth_Code}` | Historial de encuestas de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Encuestas_Trabaj[]` |
| GET | `/api/Trabajadores/Encuestas/{auth_Code}/ID/{trabajador_ID}` | Historial de encuestas de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Encuestas_Trabaj_Idtrabaj[]` |

## 03.- Trabajadores - Históricos

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Trabajadores/BajasPermisos/{auth_Code}` | Histórico de bajas y permisos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Bajper[]` |
| GET | `/api/Trabajadores/BajasPermisos/{auth_Code}/ID/{trabajador_ID}` | Histórico de bajas y permisos de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Bajper_Idtrabaj[]` |
| GET | `/api/Trabajadores/BajasPermisos/Resumen/{auth_Code}` | Resumen de bajas y permisos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Bajper_Resumen[]` |
| GET | `/api/Trabajadores/BajasPermisos/Resumen/{auth_Code}/ID/{trabajador_ID}` | Resumen de bajas y permisos de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Bajper_Resumen_Idtrabaj[]` |
| GET | `/api/Trabajadores/OtrosTiempos/{auth_Code}` | Detalle diario por auxiliar de otros tiempos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Otr_Tiempos[]` |
| GET | `/api/Trabajadores/OtrosTiempos/{auth_Code}/ID/{trabajador_ID}` | Detalle diario por auxiliar de otros tiempos de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Otr_Tiempos_Idtrabaj[]` |
| GET | `/api/Trabajadores/OtrosTiempos/Resumen/{auth_Code}` | Resumen diario por auxiliar de otros tiempos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Otr_Tiempos_Resumen[]` |
| GET | `/api/Trabajadores/OtrosTiempos/Resumen/{auth_Code}/ID/{trabajador_ID}` | Resumen diario por auxiliar de otros tiempos de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Otr_Tiempos_Resumen_Idtrabaj[]` |
| GET | `/api/Trabajadores/Tiempos/{auth_Code}` | Histórico de tiempos diario de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Tiempos_Diario[]` |
| GET | `/api/Trabajadores/Tiempos/{auth_Code}/ID/{trabajador_ID}` | Histórico de tiempos diario de los trabajadores [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Tiempos_Diario_Idtrabaj[]` |
| GET | `/api/Trabajadores/Tiempos/Resumen/{auth_Code}` | Resumen Histórico de tiempos diario de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Tiempos_Diario_Resumen[]` |
| GET | `/api/Trabajadores/Tiempos/Resumen/{auth_Code}/ID/{trabajador_ID}` | Resumen Histórico de tiempos diario de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Hist_Tiempos_Diario_Resumen_Idtrabaj[]` |
| GET | `/api/Trabajadores/BalanceTiempos/{auth_Code}` | Histórico de balance de tiempos por periodos de los trabajadores | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Hist_Balance_Trabaj[]` |
| GET | `/api/Trabajadores/BalanceTiempos/{auth_Code}/ID/{trabajador_ID}` | Histórico de balance de tiempos por periodos de los trabajadores [1 trabajador] | **trabajador_ID**, **fecha_Inicio**, **fecha_Fin** | `Hist_Balance_Trabaj_Idtrabaj[]` |

## 04.- Usuarios

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Usuarios/Expedientes/{auth_Code}` | Datos generales del expediente de los usuarios SAD | fecha_Inicio, fecha_Fin, **numero_Pagina**, registros_Pagina | `Expedientes_Usuari[]` |
| GET | `/api/Usuarios/Expedientes/{auth_Code}/ID/{usuario_ID}` | Datos generales del expediente de los usuarios SAD [1 usuario] | **usuario_ID** | `Expedientes_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/ContratosContraprestacion/{auth_Code}` | Contratos de contraprestación vinculados al expediente de los usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Contratos_Contraprestacion_Usuari[]` |
| GET | `/api/Usuarios/ContratosContraprestacion/{auth_Code}/ID/{usuario_ID}` | Contratos de contraprestación vinculados al expediente de los usuarios SAD [1 usuario] | **usuario_ID** | `Contratos_Contraprestacion_Usuari_Idusuario[]` |
| GET | `/api/Usuarios/Tareas/{auth_Code}` | Historial de tareas x periodo asignadas a los usuarios SAD | **numero_Pagina**, registros_Pagina | `Tareas_Usuari[]` |
| GET | `/api/Usuarios/Tareas/{auth_Code}/ID/{usuario_ID}` | Historial de tareas x periodo asignadas a los usuarios SAD [1 usuario] | **usuario_ID** | `Tareas_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Incidencias/Tecnicas/{auth_Code}` | Historial de incidencias técnicas vinculadas a los usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Inctec_Usuari[]` |
| GET | `/api/Usuarios/Incidencias/Tecnicas/{auth_Code}/ID/{usuario_ID}` | Historial de incidencias técnicas vinculadas a los usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Inctec_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Incidencias/Sociales/{auth_Code}` | Historial de incidencias sociales vinculadas a los usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Incsoc_Usuari[]` |
| GET | `/api/Usuarios/Incidencias/Sociales/{auth_Code}/ID/{usuario_ID}` | Historial de incidencias sociales vinculadas a los usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Incsoc_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Incidencias/Evolutivas/{auth_Code}` | Historial de incidencias evolutivas vinculadas a los usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Incevo_Usuari[]` |
| GET | `/api/Usuarios/Incidencias/Evolutivas/{auth_Code}/ID/{usuario_ID}` | Historial de incidencias evolutivas vinculadas a los usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Incevo_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Quejas/{auth_Code}` | Historial de Quejas vinculadas a usuarios SAD | **numero_Pagina**, registros_Pagina | `Quejas_Usuari[]` |
| GET | `/api/Usuarios/Quejas/{auth_Code}/PeriodoQueja` | Historial de Quejas vinculadas a usuarios SAD [Periodo Queja] | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Quejas_Usuari_Fechaqueja[]` |
| GET | `/api/Usuarios/Quejas/{auth_Code}/ID/{usuario_ID}` | Historial de Quejas vinculadas a usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Quejas_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Bajas/{auth_Code}` | Historial de Bajas Temporales, Definitivas, Inicios Anulados e Inicios Aplazados a usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Bajas_Usuari[]` |
| GET | `/api/Usuarios/Bajas/{auth_Code}/ID/{usuario_ID}` | Historial de Bajas Temporales, Definitivas, Inicios Anulados e Inicios Aplazados a usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Bajas_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/Encuestas/{auth_Code}` | Historial de Encuestas vinculadas a usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Encuestas_Usuari[]` |
| GET | `/api/Usuarios/Encuestas/{auth_Code}/ID/{usuario_ID}` | Historial de Encuestas vinculadas a usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Encuestas_Usuari_Idusuari[]` |
| GET | `/api/Usuarios/PlanificacionBase/{auth_Code}` | Historial de Planificación BASE e Incidenicas puntuales de usuarios SAD | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Planificacion_Base_Usuari[]` |
| GET | `/api/Usuarios/PlanificacionBase/{auth_Code}/ID/{usuario_ID}` | Historial de Planificación BASE e Incidenicas puntuales de usuarios SAD [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Planificacion_Base_Usuari_Idusuari[]` |

## 05.- Usuarios - Históricos

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Usuarios/Facturas/{auth_Code}` | Histórico de facturas generadas a usuarios SAD (Cabeceras, Líneas, Desglose de IVA). | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Master[]` |
| GET | `/api/Usuarios/Facturas/ServiciosFacturados/{auth_Code}` | Histórico de facturas generadas a usuarios SAD (Desglose de servicios facturados) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Servicios[]` |
| GET | `/api/Usuarios/Facturas/ConceptosFacturados/{auth_Code}` | Histórico de facturas generadas a usuarios SAD ( Desglose de conceptos facturados ) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Conceptos[]` |
| GET | `/api/Usuarios/Facturas/{auth_Code}/ID/{usuario_ID}` | Histórico de facturas generadas a usuarios SAD (Cabeceras, Líneas, Desglose de IVA) [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Master_Idusuari[]` |
| GET | `/api/Usuarios/Facturas/ServiciosFacturados/{auth_Code}/ID/{usuario_ID}` | Histórico de facturas generadas a usuarios SAD (Desglose de servicios facturados) [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Servicios_Idusuari[]` |
| GET | `/api/Usuarios/Facturas/ConceptosFacturados/{auth_Code}/ID/{usuario_ID}` | Histórico de facturas generadas a usuarios SAD ( Desglose de conceptos facturados ) [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Usuari_Conceptos_Idusuari[]` |

## 06.- Organismos Oficiales

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Organismos/OrganismosOficiales/{auth_Code}` | Datos generales de Organismos Oficiales. | — | `Expedientes_Organismos[]` |
| GET | `/api/Organismos/ContratosContraprestacion/{auth_Code}` | Contratos de Contraprestación vinculados a Organismos Oficiales. | — | `Contratos_Contraprestacion_Organismos[]` |
| GET | `/api/Organismos/Facturas/{auth_Code}` | Historial de facturas generadas a Organismos Oficiales (Cabeceras, Líneas,IVA) y (Desglose de tarifas por usuarios SAD) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Master[]` |
| GET | `/api/Organismos/Facturas/Servicios/{auth_Code}` | Historial de facturas generadas a Organismos Oficiales (Detalle de servicios diarios) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Servicios[]` |
| GET | `/api/Organismos/Facturas/TiposTarifas/{auth_Code}` | Historial de facturas generadas a Organismos Oficiales (Detalle de tipos de tarifas diarios) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Tipos_Tarifas[]` |
| GET | `/api/Organismos/Facturas/Usuarios/{auth_Code}` | Historial de facturas generadas a Organismos Oficiales (Detalle de Usuarios SAD) | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Usuarios[]` |
| GET | `/api/Organismos/Facturas/{auth_Code}/ID/{organismo_ID}` | Historial de facturas generadas a Organismos Oficiales (Cabeceras, Líneas,IVA) y (Desglose de tarifas por usuarios SAD) [1 Organismo] | **organismo_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Master_Idorganismo[]` |
| GET | `/api/Organismos/Facturas/Servicios/{auth_Code}/ID/{organismo_ID}` | Historial de facturas generadas a Organismos Oficiales (Detalle de servicios diarios) [1 Organismo] | **organismo_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Servicios_Idorganismo[]` |
| GET | `/api/Organismos/Facturas/TiposTarifas/{auth_Code}/ID/{organismo_ID}` | Historial de facturas generadas a Organismos Oficiales (Detalle de tipos de tarifas diarios) [1 Organismo] | **organismo_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Tipos_Tarifas_Idorganismo[]` |
| GET | `/api/Organismos/Facturas/Usuarios/{auth_Code}/ID/{organismo_ID}` | Historial de facturas generadas a Organismos Oficiales (Detalle de Usuarios SAD) [1 Organismo] | **organismo_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Facturas_Organismos_Usuarios_Idorganismo[]` |

## 07.- Control Presencia

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/ControlPresencia/Fichajes/{auth_Code}` | Histórico de servicios planificados y fichajes de Entrada/Salida en el Control de Presencia | **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Fichajes[]` |
| GET | `/api/ControlPresencia/FichajesUsuario/{auth_Code}/ID/{usuario_ID}` | Histórico de servicios planificados y fichajes de Entrada/Salida en el Control de Presencia. [1 usuario] | **usuario_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Fichajes_Usuari_Idusuari[]` |
| GET | `/api/ControlPresencia/FichajesTrabajador/{auth_Code}/ID/{trabajador_ID}` | Histórico de servicios planificados y fichajes de Entrada/Salida en el Control de Presencia [1 trabajador] | **trabajador_ID**, **numero_Pagina**, registros_Pagina, **fecha_Inicio**, **fecha_Fin** | `Fichajes_Trabaj_Idtrabaj[]` |

## 08- Comunicaciones Externas

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| POST | `/api/ComunicExternas/AltaUsuarioSAD/{auth_code}` | Alta de inicios de usuarios SAD | body: ADDINICIOUSUARIOSAD | `—` |

## 10.- Utilidades

| Método | Path | Descripción | Parámetros | Respuesta 200 |
|--------|------|-------------|------------|----------------|
| GET | `/api/Utilidades/ConsultaTelefonos/{auth_Code}` | Consulta de teléfonos | telefono | `array` |

## Cómo consultar los modelos de datos (140 schemas)

Los modelos completos están en `swagger.json` → `components.schemas`. Para inspeccionar uno:

```bash
python -c "import json; s=json.load(open('references/swagger.json', encoding='utf-8')); print(json.dumps(s['components']['schemas']['Expedientes_Usuari'], indent=2, ensure_ascii=False))"
```
