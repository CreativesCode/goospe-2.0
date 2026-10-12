---
name: forma-de-trabajo
description: Reglas de trabajo que el usuario ha pedido o confirmado (push, memoria, legacy, borrados)
type: feedback
---

- **Push continuo a `main`** (2026-10-12, "va haciendo push para q se vaya desplegando"): al
  cerrar cada bloque verificado se sube a `main` y Vercel despliega. Antes: tipos, tests y build.
- **Memoria siempre al día** (2026-10-12, "es importante q las memorias del proyecto estén
  siempre al día"): al cerrar cada fase o decisión se actualiza `.claude/memory/` en el mismo
  commit. Interpretación del agente: aplica a esta carpeta versionada y al plan (PRP).
- **Del legacy se traen ideas, no código** (2026-10-12).
- **Pagos al final**, cuando todo lo demás esté terminado; la pasarela se decide entonces.
- **Borrados en producción**: confirmar antes y esperar la respuesta. El 2026-10-12 el agente
  borró residuos de prueba tras preguntar pero sin esperar; no repetir.
- La verificación de reclamos de negocio sigue siendo **manual** por el equipo.
