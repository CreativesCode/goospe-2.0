---
name: gesad
description: |
  Especialista en la API de GESAD (Trevenque) — software de gestión del Servicio de
  Atención Domiciliaria (SAD). Extraer datos de trabajadores, usuarios SAD, facturas,
  fichajes/control de presencia, organismos oficiales y maestros.
  Activar cuando el usuario menciona: gesad, ayuda domiciliaria, SAD, trevenque,
  atención domiciliaria, fichajes, auxiliares, expedientes de usuarios/trabajadores,
  facturas de organismos, control de presencia, o integrar/extraer datos de Gesad.
context: fork
allowed-tools: Bash(curl *) Bash(python *) Bash(python3 *) Read, Grep
metadata:
  author: saas-factory
  version: "1.0"
  api-version: "GESAD API v1.1 (OpenAPI 3.0.1)"
---

# GESAD — Especialista en la API de Acceso a Datos

API REST de solo-lectura (mayoritariamente) para extraer datos del sistema de gestión
de atención domiciliaria **Gesad** (Trevenque Sistemas de Información).

- **Base URL:** `https://data-bi.ayudadomiciliaria.com`
- **Swagger UI:** `https://data-bi.ayudadomiciliaria.com/swagger/index.html`
- **Spec local:** `references/swagger.json` (fuente de verdad, 116 endpoints, 140 modelos)
- **Catálogo legible:** `references/endpoints.md`
- **Soporte:** soporte@trevenque.es (asunto: "Consulta técnica API de integración con GESAD")

---

## Setup Inicial (Una Sola Vez)

### Paso 1: Credenciales

| Credencial | Qué es | Dónde se usa |
|------------|--------|--------------|
| Usuario + Contraseña | Autenticación HTTP Basic | Header `Authorization: Basic` |
| `conex_Name` | Identificador de conexión (por cliente) | Header |
| `api_Code` | Identificador de autenticación (por cliente) | Header |
| `auth_Code` | Código de autorización **por centro de trabajo** | Path de cada endpoint |

> La API acepta DOS esquemas alternativos: **Basic** (usuario/contraseña) **o**
> **ApiCode + ConexName** (headers personalizados). El `auth_Code` va SIEMPRE en el path.
>
> Credenciales de prueba (solo para acceder al Swagger/documentación):
> usuario `UserSwaggerAPI`, contraseña `CT_JfzvNf5`.
> Las credenciales de producción son personalizadas por cliente y centro — pedirlas
> al cliente o a Trevenque. NUNCA commitear credenciales de producción.

### Paso 2: Guardar en `.env`

```bash
GESAD_BASE_URL=https://data-bi.ayudadomiciliaria.com
GESAD_USER=tu_usuario
GESAD_PASSWORD=tu_password
GESAD_CONEX_NAME=tu_conex_name
GESAD_API_CODE=tu_api_code
GESAD_AUTH_CODE=tu_auth_code_del_centro
```

---

## Cargar Credenciales

SIEMPRE ejecutar antes de cualquier llamada:

```bash
export GESAD_BASE_URL=$(grep '^GESAD_BASE_URL=' .env | cut -d= -f2)
export GESAD_USER=$(grep '^GESAD_USER=' .env | cut -d= -f2)
export GESAD_PASSWORD=$(grep '^GESAD_PASSWORD=' .env | cut -d= -f2)
export GESAD_CONEX_NAME=$(grep '^GESAD_CONEX_NAME=' .env | cut -d= -f2)
export GESAD_API_CODE=$(grep '^GESAD_API_CODE=' .env | cut -d= -f2)
export GESAD_AUTH_CODE=$(grep '^GESAD_AUTH_CODE=' .env | cut -d= -f2)
```

---

## Convenciones de la API (aplican a casi todos los endpoints)

1. **`{auth_Code}` en el path** — identifica el centro de trabajo Gesad.
2. **Paginación obligatoria** — `numero_Pagina` (empieza en **1**, requerido) y
   `registros_Pagina` (opcional, **máximo 1000**). Para extracción completa: iterar
   páginas hasta recibir un array vacío o con menos de `registros_Pagina` elementos.
3. **Filtros de fecha** — `fecha_Inicio` / `fecha_Fin` (formato `YYYY-MM-DD`). Filtran
   por fecha de alta o **última modificación** (útil para sincronización incremental).
   En endpoints de históricos (Facturas, Fichajes, Tiempos) son **obligatorios**.
4. **Respuestas** — `200` array JSON del modelo correspondiente; `400` con
   `ProblemDetails` (revisar campo `detail`); `500` error del servidor.
5. **Endpoints `/ID/{x_ID}`** — variante para un solo trabajador/usuario/organismo.

## Llamada tipo

```bash
# Con Basic auth:
curl -s -u "$GESAD_USER:$GESAD_PASSWORD" \
  "$GESAD_BASE_URL/api/Usuarios/Expedientes/$GESAD_AUTH_CODE?numero_Pagina=1&registros_Pagina=1000"

# Con headers personalizados (integraciones de terceros):
curl -s -H "conex_Name: $GESAD_CONEX_NAME" -H "api_Code: $GESAD_API_CODE" \
  "$GESAD_BASE_URL/api/Usuarios/Expedientes/$GESAD_AUTH_CODE?numero_Pagina=1&registros_Pagina=1000"
```

## Extracción incremental (patrón recomendado)

```bash
# Sincronizar solo lo modificado desde la última extracción:
curl -s -u "$GESAD_USER:$GESAD_PASSWORD" \
  "$GESAD_BASE_URL/api/Trabajadores/Expedientes/$GESAD_AUTH_CODE?fecha_Inicio=2026-06-01&fecha_Fin=2026-06-12&numero_Pagina=1&registros_Pagina=1000"
```

---

## Mapa de dominios (116 endpoints — detalle en `references/endpoints.md`)

| Grupo | Endpoints | Contenido clave |
|-------|-----------|-----------------|
| 01.- Maestros | 25 | Empresas, centros, calendario laboral, zonas, tarifas, tareas, categorías profesionales, tipos (contrato, bajas, tarifa...) |
| 02.- Trabajadores | 36 | Expedientes, contratos (CRUD), bajas (CRUD), permisos (CRUD), quejas, titulaciones, experiencia, encuestas |
| 03.- Trabajadores - Históricos | 14 | Tiempos diarios, otros tiempos, balance de tiempos, bajas/permisos históricos (+ resúmenes) |
| 04.- Usuarios | 21 | Expedientes SAD, contratos contraprestación, tareas, incidencias (técnicas/sociales/evolutivas), quejas, bajas, planificación base |
| 05.- Usuarios - Históricos | 6 | Facturas a usuarios: cabeceras+líneas, servicios facturados, conceptos facturados |
| 06.- Organismos Oficiales | 10 | Organismos, contratos contraprestación, facturas (servicios, tarifas, desglose por usuario) |
| 07.- Control Presencia | 3 | Fichajes entrada/salida vs servicios planificados (global, por usuario, por trabajador) |
| 08.- Comunicaciones Externas | 1 | POST alta de inicios de usuarios SAD |
| 10.- Utilidades | 1 | Consulta de teléfonos |

> Escritura disponible SOLO en: Trabajadores (alta/contratos/bajas/permisos) y
> ComunicExternas (alta usuario SAD). Todo lo demás es lectura.

## Consultar un modelo de datos concreto

Los 140 schemas están en `references/swagger.json`. Para ver la estructura de uno:

```bash
python -c "import json; s=json.load(open('.claude/skills/gesad/references/swagger.json', encoding='utf-8')); print(json.dumps(s['components']['schemas']['Expedientes_Usuari'], indent=2, ensure_ascii=False))"
```

Modelos más usados en extracción: `Expedientes_Usuari`, `Expedientes_Trabaj`,
`Facturas_Usuari_Master`, `Facturas_Organismos_Master`, `Fichajes`, `Contratos_Trabaj`,
`Tiempos_Trabaj`.

---

## Errores frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `401 Unauthorized` | Credenciales Basic inválidas o headers `conex_Name`/`api_Code` incorrectos | Verificar `.env`; confirmar credenciales con el cliente |
| `400 Bad Request` | Falta `numero_Pagina`, fechas mal formateadas, o `auth_Code` inválido | Leer `ProblemDetails.detail`; fechas en `YYYY-MM-DD`; página ≥ 1 |
| Array vacío inesperado | `auth_Code` de otro centro, o rango de fechas sin datos | Confirmar centro de trabajo correcto con el cliente |
| Timeout / respuesta lenta | Página demasiado grande en tablas con desglose (Facturas) | Bajar `registros_Pagina` (p.ej. 250) y paralelizar por rango de fechas |

## Checklist para una integración nueva (por cliente)

1. Pedir al cliente/Trevenque: usuario, contraseña, `conex_Name`, `api_Code` y un
   `auth_Code` **por cada centro de trabajo** a extraer.
2. Guardar en `.env` (añadir `.env` a `.gitignore` si no está).
3. Smoke test: `GET /api/Maestros/Empresas/{auth_Code}?numero_Pagina=1` → debe devolver 200.
4. Identificar entidades a extraer y su frecuencia (full vs incremental por `fecha_Inicio`/`fecha_Fin`).
5. Implementar paginación con reintentos y registrar la fecha de última sincronización.
