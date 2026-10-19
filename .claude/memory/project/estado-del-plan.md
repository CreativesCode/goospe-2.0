---
name: estado-del-plan
description: En qué fase va el plan PRP-002 (brechas + ideas del legacy) y qué queda
type: project
---

Plan vigente: `.claude/PRPs/prp-legacy-y-brechas.md` (9 fases). Análisis de origen:
`docs/15-analisis-brechas-y-qa.md`.

| Fase | Estado (2026-10-12) |
|------|---------------------|
| 1 Seguridad | Hecha y verificada en producción (migraciones 0033, 0034) |
| 2 Que lo que hay funcione | Hecha (0035) |
| 3 Red de ingeniería | Hecha: lint, tests unitarios, CI. Falta build/e2e en CI, Sentry, staging |
| 4 Calidad de datos | Parcial: 3.706 lugares enriquecidos, duplicados despublicados. Horarios y estado de negocio bloqueados por la facturación de Google |
| 5 Panel del dueño | Hecha y desplegada (0037, 0038, 0039). Incluye proponer lugar nuevo, bitácora en /admin/audit, rendimiento de boost de eventos y redimensionado de imágenes al subir |
| 6 Emails e informes | Base desplegada y apagada (0040): plantillas, registro de envíos, bajas, informe semanal programado, alerta de reseña crítica, mantenimiento. No envía nada hasta tener proveedor |
| 7 Lado usuario | Hecha y desplegada (0041, 0042, 0043). Falta login con Google (necesita credenciales de Google Cloud) y amenities estructurados |
| 8 Monetización | Pendiente, al final |
| 9 Validación final | Pendiente |

Fuera del plan de 9 fases: **rediseño visual (variante audaz)** aplicado en local el 2026-10-13,
sin commit ni push; detalle y pendientes en [[rediseno-audaz]] y lista de revisión en
`docs/16-revision-local.md` (sección 0).

Esperando al usuario: revisar el rediseño en local y decidir cuándo se sube; cuenta de Resend + dominio de envío; reactivar facturación de Google
Cloud (fotos, horarios); revisar ~14 pares de posibles lugares duplicados; decidir si se
versiona `package-lock.json`; rotar secretos del repo legacy.

## Datos de prueba en producción que HAY QUE BORRAR

Creados el 2026-10-19 a pedido del usuario para revisar el panel y la cartelera con la cuenta
demo (`demo@goospe.cl`, uid `3b9e4761-64ec-4eee-8a83-67fc19ee7c4c`). Borrar cuando termine la
revisión, **confirmando antes con el usuario**:
- Lugar **Deleitar** (`06c59f07-7138-497b-881e-415bb34b9270`) reclamado por demo: volver a
  `business_id = null, claimed = false, source = 'osm'`.
- Negocio `c66609bb-b8a0-45c0-8599-2534893b1f89` ("Deleitar"): borrarlo (su `business_members`
  cae por cascade).
- Reclamo aprobado `b0be1f06-55c0-47d4-b1f8-ad63dc5894d6` (evidencia `qa_seed`).
- 4 eventos del lugar: `ad0bf505-d2ed-4824-aeb3-e3ff7880d7f9`, `8145d2d9-348c-4a3c-b8aa-3117a0cfd864`,
  `4a7e0037-b752-4410-b8e3-4fb724b18798`, `a3717c69-7b74-4469-9b59-5622d5e2ce14` (borrar también
  sus asistencias / "me interesa" si alguien las marcó).
- Si se tocó el panel: revisar horarios, fotos, respuestas o cambios que haya dejado la prueba.

## Para encender los emails (fase 6)

1. Cuenta de Resend con el dominio de envío verificado.
2. En Vercel: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_LINK_SECRET` (32+ caracteres) y
   `CRON_SECRET` (16+). Sin las dos primeras cada envío queda registrado como omitido; sin
   `CRON_SECRET` la tarea diaria responde 401.
3. En Supabase Auth: SMTP de Resend y las cuatro plantillas de `supabase/templates/`; después
   activar "Confirm email".

Tarea diaria de Vercel: `/api/cron/daily` a las 11:00 UTC (mantenimiento, alertas pendientes
e informe semanal los lunes). Mantenimiento SQL en pg_cron a las 05:23 UTC.

## Qué trajo la fase 7

- Eventos: página de evento compartible (imagen propia, calendario), cartelera Hoy / Esta
  semana / Próximos por ciudad, "me interesa" separado de "asistiré".
- Listados por ciudad y categoría en `/c/<ciudad>/<categoria>`; `/places` es el índice de
  ciudades; sitemap con todos los lugares; lugares relacionados en la ficha.
- Cuenta: perfil editable con avatar, mi actividad, aceptación de términos, eliminar cuenta,
  historial de notificaciones, aviso a quien guardó un lugar cuando publica evento.
- Feedback y "sugerir corrección" con bandeja en `/admin/feedback`.
- Feed con scroll infinito, cambio manual de ciudad (cookie `goospe_city`), pesos del ranking
  editables en `/admin/ranking`, perfil de gusto que aprende (tarea diaria, sin IA de pago).
- Panel de producto en `/admin/product`: retención, usuarios activos y métrica norte.
- Páginas quiénes somos, ayuda y contacto.

## Sin probar todavía

- Eliminar una cuenta de verdad, y cambiar email o contraseña con éxito.
- Guardar pesos nuevos del ranking.

- Aprobar una propuesta de lugar de punta a punta (crearía un lugar real en producción).
- Rendimiento de boost: no hay ningún boost en la base.
- Envío real de emails, enlace de baja válido y una ejecución completa de la tarea diaria.
- Redimensionado de imágenes en iPhone/Safari.

## Decisiones abiertas

- El email de contacto público es un Gmail personal; conviene uno con marca.
- El último dueño de un negocio con lugares no puede borrar su cuenta solo: debe escribir a Goospe.

- Plazo para borrar notificaciones antiguas ya leídas (hoy no se borran).
- Emails para las propuestas de lugar (hoy solo aviso dentro de la app).
