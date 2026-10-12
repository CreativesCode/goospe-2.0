---
name: base-de-datos
description: Cómo se aplican migraciones y qué convenciones de seguridad sigue la BD
type: reference
---

La base es **producción real** (Supabase, proyecto `ywdjsyxsshaymkjkopho`). No hay staging.

- Orden: primero la migración (aditiva y compatible con el código ya desplegado), luego el push.
- Los subagentes solo hacen SELECT; el agente principal revisa y aplica.
- Aplicación: Management API de Supabase con el token del CLI (el conector MCP no siempre está
  autenticado). El cuerpo se envía sin comentarios SQL y con los caracteres no ASCII escapados;
  si no, el WAF responde 403.
- Convención (0033): toda función SECURITY DEFINER interna lleva `revoke execute ... from
  public, anon, authenticated` y `grant` a `service_role`. Tablas nuevas con RLS activa.
- Modelo: RLS mínima; las escrituras pasan por server actions con service role tras validar
  sesión y pertenencia (`assertPlaceMembership`) o admin (`requireAdmin`).
- Al añadir una columna a una tabla que el usuario puede escribir, revisar los grants por
  columna (aprendizaje de la fase 5).
- Detalle y orden de archivos: `supabase/migrations/README.md`.
