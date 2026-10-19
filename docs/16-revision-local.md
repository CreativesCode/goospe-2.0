# Qué revisar en local — rediseño y fases 5, 6 y 7

Lista para recorrer el proyecto levantado en tu máquina (`http://localhost:3000`) y dar el visto
bueno a lo nuevo. Marca cada casilla al comprobarla y anota al lado lo que no te convenza.

Empieza por la **sección 0 (rediseño)**: es lo último que se hizo, cambia el aspecto de toda la
app y todavía no está subido. Las secciones 1 a 10 son las de las fases 5 a 7, actualizadas donde
el rediseño movió algo de sitio.

## Antes de empezar

- **Tu local usa la base de datos real.** Todo lo que crees, edites o borres queda en producción.
- **Lugar para pruebas:** "Mercado El Encanto" (Puerto Varas). No uses "Nina": es de un dueño real.
- **Cuentas:** la de usuario normal (demo) y la de admin. Usa dos navegadores, o uno normal y
  una ventana privada, para tener las dos sesiones abiertas a la vez.
- **Puerto:** comprueba que en `localhost:3000` responde Goospe. El 13 de octubre ese puerto lo
  ocupaba otro proyecto (Docker) y todo redirigía a una pantalla de login ajena.
- **Tamaños:** revisa cada pantalla a tres anchos: móvil (390), tablet (820) y web (1440). El
  diseño cambia a los 720 y a los 1100 píxeles.
- **Tema:** repite lo importante en claro y en oscuro (botón de la luna, arriba a la derecha).

### Cosas que NO debes hacer al probar

| No hagas esto | Por qué |
|---|---|
| Enviar "Eliminar cuenta" con la contraseña correcta | Borra la cuenta de verdad, sin vuelta atrás |
| Aprobar una propuesta de lugar inventada | Publica un lugar real en la app |
| Guardar pesos nuevos del ranking "para ver qué pasa" | Cambia el orden del feed para todos |
| Lanzar una carga de zona en el admin | Gasta dinero |
| Abusar del conserje, "sugerir con IA", carta con foto o "generar informe" | Cada uso cuesta |

### Cosas que en local se ven "rotas" y es normal

- **Fotos de Google:** no cargan (facturación sin reactivar). Casi todas las tarjetas salen en el
  estado "sin foto": fondo verde muy claro con el icono de la categoría, y un degradado verde
  oscuro en el mazo del feed y en la portada de la ficha.
- **Correos:** no sale ninguno. Cada envío queda registrado como omitido hasta tener proveedor.
- **Tarea diaria programada:** en local no corre.

---

## 0. Rediseño visual (variante audaz)

Hecho el 13 de octubre a partir de `docs/design/design_handoff_goospe_rediseno/`. Para comparar,
abre los prototipos del diseño al lado (instrucciones en el README de esa carpeta).

### En toda la app
- [ ] Ningún texto verde claro sobre fondo blanco: los textos verdes son más oscuros y se leen bien.
- [ ] Los botones verdes llevan texto oscuro, no blanco.
- [ ] El modo oscuro es marrón-negro cálido, sin grises azulados ni zonas blancas sueltas.
- [ ] **Web y tablet:** barra superior con las secciones en píldoras; entre 720 y 900 px solo iconos.
- [ ] **Móvil:** barra inferior con Decídeme al centro en una píldora verde; arriba solo logo, tema y campana.
- [ ] **Móvil:** ya no hay pie de página. Ayuda y Cerrar sesión están en Perfil; comprueba que no echas en falta nada más.
- [ ] El admin sigue funcionando y no quedó ningún botón ilegible (se le aplicó el cambio de colores, no un rediseño).

### Landing
- [ ] Titular gigante "¿Dónde voy hoy?" sobre el degradado y carrusel de lugares reales que sobresale por abajo y por la derecha.
- [ ] La barra "Decídeme" del landing abre el conserje con lo que escribiste **y lanza la consulta sola** (gasta una).
- [ ] La sección del conserje es oscura en ambos temas; sus tres resultados son un ejemplo con nombres inventados. ¿Te parece bien o prefieres otro ejemplo?
- [ ] "Para salir" y "Para tu negocio" están al mismo nivel; "Reclamar mi negocio" lleva al reclamo.
- [ ] En móvil no hay desplazamiento lateral de la página (solo del carrusel).

### Feed
- [ ] **Móvil:** una tarjeta por pantalla, se ajusta sola al deslizar; barritas de posición a la derecha y "Desliza para ver más" solo en la primera.
- [ ] **Móvil:** los chips de arriba (ciudad y categorías) filtran el mazo.
- [ ] **Web:** mazo grande a la izquierda y panel a la derecha con "Por qué te sugerimos…", progreso y "Lo que sigue".
- [ ] **Web:** avanzan la rueda, los botones ↑ ↓ y las flechas del teclado; tocar una fila de "Lo que sigue" salta a esa tarjeta.
- [ ] Al abrir el feed empieza en la tarjeta 1 (hubo un fallo que lo dejaba en la 32; está corregido, confírmalo).
- [ ] **"Paso"** sigue descartando el lugar con "Deshacer", como antes. El diseño solo saltaba a la siguiente: di cuál prefieres.
- [ ] La frase de "Por qué te sugerimos" sale de datos del lugar (distancia, valoración, precio, etiquetas), sin IA. ¿Suena bien?
- [ ] Al llegar al final aparece "Viste todo cerca de ti" con Decídeme y Volver al inicio.
- [ ] **Tablet:** el panel queda debajo del mazo.

### Ficha de lugar
- [ ] Portada a pantalla completa con nombre grande, y Guardar / Compartir / Cómo llego encima.
- [ ] **Web:** a la derecha, tarjeta fija con precio, mapa, dirección, horario y contacto, que acompaña al bajar.
- [ ] **Móvil:** barra fija abajo con corazón, compartir y "Cómo llego", sin tapar el final de la página.
- [ ] Guardar en la ficha y comprobar que aparece en Guardados.

### Buscar
- [ ] **Web:** filtros en una columna a la izquierda (categoría, precio máximo, abierto ahora).
- [ ] **Tablet y móvil:** categorías como chips y un botón de filtros que despliega precio y "abierto ahora".
- [ ] **Móvil:** resultados en filas con la foto a la izquierda.
- [ ] El corazón de cada tarjeta guarda y quita.

### Decídeme
- [ ] Tarjeta verde con el texto, "Con quién" y "Presupuesto"; a la derecha las tres opciones.
- [ ] Una sola pregunta de prueba, marcando un "Con quién" y un presupuesto: ¿las opciones lo respetan?
- [ ] "Otras 3 opciones" no repite las anteriores (gasta otra consulta).

### Eventos, Guardados y Perfil
- [ ] Cartelera agrupada por día, con el número grande a la izquierda. Necesita un evento de prueba (ver sección 5).
- [ ] Guardados: contador junto al título y chips por categoría; quitar el corazón no borra la tarjeta hasta recargar.
- [ ] Perfil en dos columnas en web: tarjeta con tus datos a la izquierda, listas y "Guardados recientes" a la derecha.
- [ ] "Apariencia" en Perfil cambia el tema; "Cerrar sesión" funciona desde ahí.

### Acceso y onboarding
- [ ] Entrar / Crear cuenta: pantalla partida en web, selector de pestañas arriba, "¿La olvidaste?" junto a Contraseña.
- [ ] Recuperar contraseña y "revisa tu correo" mantienen el mismo aspecto.
- [ ] Onboarding en dos columnas, con casillas grandes para gustos y presupuesto; en móvil, barra fija "Empezar · N elegidos".
- [ ] Editar "Mis gustos" desde el perfil conserva lo ya elegido.

### Panel de negocio (nadie lo ha visto todavía)
Solo entra el dueño de un lugar, así que esta parte se escribió sin poder abrirla. Necesitas
"Mercado El Encanto" reclamado y aprobado (ver sección 1).

- [ ] Abre sin error. Si falla, es lo primero que hay que avisar.
- [ ] Lateral con Resumen, Ficha, Fotos, Carta, Eventos, Reseñas, Estadísticas y Destacar; en móvil son chips.
- [ ] **Resumen:** cuatro cifras con su variación frente a la semana anterior, gráfico de vistas (7, 30 y 90 días), informe semanal, reseñas por responder y "Completa tu ficha".
- [ ] Los porcentajes de variación tienen sentido; sin datos previos debe decir "nuevo", no un número.
- [ ] Cada sección muestra lo mismo que antes estaba en una sola página larga.
- [ ] "Nuevo evento" abre el formulario de alta directamente.

---

## 1. Panel del dueño (fase 5)

Entra con la cuenta demo. Si "Mercado El Encanto" no aparece en "Mis lugares", reclámalo desde
el panel y apruébalo con la cuenta admin en Reclamos (la demo ya tiene ese reclamo enviado y en
revisión). Tras el rediseño, cada bloque de abajo es una sección del lateral del panel.

### Ficha
- [ ] Editar horario por día con varios tramos (ej. 9–13 y 16–20) y verlo bien en la ficha pública.
- [ ] Editar dirección, categorías y email; el cambio aparece en la ficha al instante.
- [ ] Subir portada, logo y fotos. Debe mostrar "Optimizando…", "Subiendo…" y el ahorro de peso.
- [ ] Subir un archivo que no es imagen: debe rechazarlo con un mensaje claro.
- [ ] Borrar una foto: desaparece de inmediato.
- [ ] Pedir cambio de nombre o de ubicación: no se aplica directo, queda como solicitud.
- [ ] Pausar el lugar y volver a activarlo (ahora en Ficha › Visibilidad).

### Reseñas
- [ ] Responder una reseña y verla en la ficha pública con el sello del negocio.
- [ ] Con la cuenta de dueño no se puede reseñar el propio lugar.

### Estadísticas
- [ ] Gráficos por día, por hora y por día de la semana, a 7, 30 y 90 días.
- [ ] En móvil, al tocar una barra el valor se queda visible al levantar el dedo.
- [ ] Los números tienen sentido con lo que has navegado tú mismo.

### Eventos
- [ ] Crear un evento de prueba, editarlo y cancelarlo.
- [ ] "Ver página" abre la página pública del evento.

### Solicitudes y propuestas
- [ ] "Mis solicitudes" muestra el estado y, si hubo rechazo, el motivo.
- [ ] "Proponer un lugar nuevo" desde el panel: el formulario valida y la propuesta queda "En revisión".
- [ ] Desde "Reclamar", buscar un lugar que no existe ofrece proponerlo con el nombre ya escrito.
- [ ] Cancelar una propuesta propia.

### Notificaciones del dueño
- [ ] La campana avisa de reseña nueva, de inscritos a un evento y de solicitudes resueltas.

---

## 2. Admin (fases 5 y 7)

Con la cuenta admin.

- [ ] **Solicitudes:** aparecen los cambios pedidos por dueños y los lugares propuestos.
- [ ] En una propuesta se ve el bloque "Posibles duplicados" cuando el nombre se parece a uno existente.
- [ ] Rechazar exige escribir un motivo, y el solicitante lo ve después.
- [ ] **Bitácora:** lista de acciones, de la más nueva a la más antigua; los filtros y "Limpiar" funcionan; el detalle muestra el antes y el después.
- [ ] **Feedback:** llegan los mensajes y las correcciones sugeridas; Resolver y Descartar los quitan de la lista al instante.
- [ ] **Producto:** retención, usuarios activos y métrica norte, sin números raros.
- [ ] **Ranking del feed:** muestra los pesos actuales y rechaza valores inválidos. No guardes cambios.
- [ ] Con la cuenta demo, ninguna página del admin es accesible.
- [ ] En móvil, la bandeja de propuestas se lee bien.

---

## 3. Feed y ciudad (fase 7)

- [ ] El feed sigue cargando lugares al bajar, sin repetir tarjetas.
- [ ] Avanzar bastante en el mazo, abrir un lugar y volver: regresa a la misma tarjeta. Probar en móvil y en escritorio.
- [ ] Recargar la página: el orden es el mismo.
- [ ] **Cambiar de ciudad:** el selector busca sin importar tildes ni mayúsculas; al elegir Granada, el feed, la búsqueda y la cartelera pasan a Granada.
- [ ] La ciudad elegida se mantiene al recargar.
- [ ] "Cerca de mí" vuelve a tu ubicación.
- [ ] Funciona igual sin iniciar sesión.

---

## 4. Búsqueda (fase 7)

- [ ] Buscar por algo que no es el nombre (ej. "romántico", "sushi") devuelve lugares.
- [ ] Filtros de categoría, precio y "abierto ahora".
- [ ] Los filtros quedan en la dirección: copiarla y abrirla en otra ventana da los mismos resultados.
- [ ] Los botones atrás y adelante del navegador recorren las búsquedas.
- [ ] Una búsqueda sin resultados muestra un mensaje y "Limpiar filtros".

---

## 5. Eventos (fase 7)

Necesitas un evento futuro; crea uno de prueba en "Mercado El Encanto" (y cancélalo al terminar).

- [ ] La cartelera abre sin filtros y con cada pestaña: Hoy, Esta semana, Próximos.
- [ ] El selector de ciudad funciona, y "Cerca de mí" vuelve a todas las ciudades (ya no hay fila de chips por ciudad).
- [ ] La página del evento muestra fecha y hora correctas, el lugar y los asistentes.
- [ ] "Me interesa" y "Asistiré" son distintos y los contadores cambian bien.
- [ ] Sin sesión, al pulsar asistir te lleva a iniciar sesión y luego vuelve al evento.
- [ ] "Añadir al calendario" descarga un archivo que tu calendario abre con la fecha correcta.
- [ ] Compartir copia el enlace; al pegarlo en WhatsApp se ve con imagen y título.
- [ ] Un evento cancelado muestra el aviso de cancelado, no una página de error.

---

## 6. Listados y ficha pública (fase 7)

- [ ] "Lugares" es ahora un índice de ciudades.
- [ ] Entrar a una ciudad, a una categoría dentro de ella, y pasar a la página 2.
- [ ] El bloque "Populares en…" aparece en la ciudad.
- [ ] En una ficha aparecen "lugares relacionados" y tienen sentido.
- [ ] Teléfono, WhatsApp y email de la ficha abren la acción correspondiente.
- [ ] Una dirección inventada muestra la página propia de "no encontrado".
- [ ] Un lugar despublicado no se puede abrir desde fuera.
- [ ] Quiénes somos, Ayuda y Contacto abren desde el pie de página (solo web y tablet; en móvil, Ayuda está en Perfil) y el texto te convence.

---

## 7. Cuenta del usuario (fase 7)

- [ ] **Editar perfil:** nombre, foto, ciudad y año de nacimiento se guardan.
- [ ] **Mi actividad:** mis reseñas con su estado y la respuesta del dueño, mis eventos, mis fotos.
- [ ] **Registro:** no deja crear cuenta sin aceptar los términos. Llega hasta el aviso; no hace falta crear una cuenta nueva.
- [ ] **Cambiar email y contraseña:** piden la contraseña actual y avisan si es incorrecta.
- [ ] **Eliminar cuenta:** el botón solo se activa al escribir ELIMINAR, y con contraseña incorrecta avisa. No pases de ahí.
- [ ] Con la cuenta admin, eliminar cuenta está bloqueado.
- [ ] **Notificaciones:** historial completo, "marcar todas como leídas", y cada una lleva a su sitio.
- [ ] Silenciar "lugares guardados" se mantiene al recargar.
- [ ] Guardar un lugar con una cuenta y publicar un evento en él con la otra: llega un solo aviso.

---

## 8. Feedback (fase 7)

- [ ] El formulario de feedback funciona con sesión y sin ella.
- [ ] "Sugerir corrección" en una ficha (horario, cerrado, ubicación, duplicado).
- [ ] Tras varios envíos seguidos aparece el aviso de límite.
- [ ] Lo enviado aparece en la bandeja del admin.

---

## 9. Correos (fase 6, apagados)

Nada de esto envía todavía; solo se puede revisar lo que ya está visible.

- [ ] Al final de "Mis lugares" aparecen las preferencias de correo y se guardan al recargar.
- [ ] La página de baja con un enlace inválido muestra un mensaje limpio, no un error.

Lo demás (informe semanal automático, alertas de reseña crítica, correos de reclamo y los de
registro con marca) se revisará cuando exista la cuenta de Resend con el dominio verificado.

---

## 10. Repaso general

- [ ] Iniciar y cerrar sesión; tras un error de contraseña el email se conserva.
- [ ] Guardados: guardar, quitar y verlos en la lista.
- [ ] Conserje: una sola pregunta de prueba (vale la de la sección 0).
- [ ] Nada se desborda ni obliga a desplazarse de lado en móvil.

---

## Lo que no se ha probado nunca

Conviene que lo sepas al revisar; cualquiera de estos puede fallar por primera vez contigo.

- Aprobar una propuesta de lugar de principio a fin.
- Eliminar una cuenta de verdad, y cambiar email o contraseña con éxito.
- Guardar pesos nuevos del ranking.
- El rendimiento del boost: no hay ningún boost creado.
- El envío real de correos y la tarea diaria completa.
- La reducción de fotos en iPhone.
- El panel de un lugar tras el rediseño: no se ha abierto ni una vez.
- La cartelera agrupada por día con eventos reales, y los resultados del conserje con el diseño nuevo.
- El modo oscuro fuera del feed.
- La compilación de producción (`npm run build`) con el rediseño.

## Decisiones que esperan tu respuesta

- **Subir el rediseño:** está hecho en local, sin commit ni push. Di cuándo se sube a producción.
- "Paso" en el feed: descartar el lugar (como hoy) o solo saltar a la siguiente tarjeta (como el diseño).
- Si en móvil hace falta algún enlace más de los que estaban en el pie (Contacto, Términos, Privacidad).
- Borrar o no los residuos de las pruebas que quedaron en producción.
- Qué email de contacto mostrar (hoy es un Gmail personal).
- Si el último dueño de un negocio puede borrar su cuenta solo, o debe escribir a Goospe (hoy: debe escribir).
- Plazo para borrar notificaciones antiguas ya leídas (hoy no se borran).
