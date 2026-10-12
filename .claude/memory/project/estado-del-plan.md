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
| 7 Lado usuario | Pendiente |
| 8 Monetización | Pendiente, al final |
| 9 Validación final | Pendiente |

Esperando al usuario: cuenta de Resend + dominio de envío; reactivar facturación de Google
Cloud (fotos, horarios); revisar ~14 pares de posibles lugares duplicados; decidir si se
versiona `package-lock.json`; rotar secretos del repo legacy.

## Para encender los emails (fase 6)

1. Cuenta de Resend con el dominio de envío verificado.
2. En Vercel: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_LINK_SECRET` (32+ caracteres) y
   `CRON_SECRET` (16+). Sin las dos primeras cada envío queda registrado como omitido; sin
   `CRON_SECRET` la tarea diaria responde 401.
3. En Supabase Auth: SMTP de Resend y las cuatro plantillas de `supabase/templates/`; después
   activar "Confirm email".

Tarea diaria de Vercel: `/api/cron/daily` a las 11:00 UTC (mantenimiento, alertas pendientes
e informe semanal los lunes). Mantenimiento SQL en pg_cron a las 05:23 UTC.

## Sin probar todavía

- Aprobar una propuesta de lugar de punta a punta (crearía un lugar real en producción).
- Rendimiento de boost: no hay ningún boost en la base.
- Envío real de emails, enlace de baja válido y una ejecución completa de la tarea diaria.
- Redimensionado de imágenes en iPhone/Safari.

## Decisiones abiertas

- Plazo para borrar notificaciones antiguas ya leídas (hoy no se borran).
- Emails para las propuestas de lugar (hoy solo aviso dentro de la app).
