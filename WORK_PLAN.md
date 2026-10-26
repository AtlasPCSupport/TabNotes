# TabNotes: cierre de estabilidad y compatibilidad

Plan autorizado el 2026-10-25. Mantener notas, IDs, ámbitos, workspaces,
historial y lectura de backups existentes. No modificar perfiles reales de Chrome.

- [x] 0. Conservar el upscale en un commit local y verificar el remoto GitHub.
- [x] 1. Implementar escrituras coordinadas entre ventanas y Drive; guardar borradores al cambiar de contexto.
- [x] 2. Proteger contenido e historial cifrados y probar exportación/restauración compatible.
- [x] 3. Implementar capturas con origen/destino, errores y consumo único de solicitudes flotantes (validación real en paso 6).
- [x] 4. Unificar Ajustes/Opciones, destinos de captura y diálogos accesibles. Inbox continúa significando notas sin carpeta.
- [x] 5. Actualizar dependencias aplicables y retirar código obsoleto/sin uso.
- [ ] 6. Validación: regresión y compatibilidad automatizadas completas; importación y captura confirmadas por el usuario; ciclo Drive oficial comprobado con nota sintética. Restan conflictos entre clientes y comprobaciones de `MANUAL_QA.md`.
- [ ] 7. Documentación y paquete preparados; publicación bloqueada hasta completar las comprobaciones manuales.

## Reglas de compatibilidad

- Conservar `tabnotes_data`, StorageData versión 3 y los cuatro ámbitos.
- Leer cifrados legados y `tnenc:v2:`. No descartar historial ni contenido al migrar.
- Conservar importación de ExportData antiguo, backup manual y backup manual cifrado.
- No borrar ni sobrescribir datos ante un error de lectura, descifrado o validación.
- Probar exportación → importación con notas HTML, Markdown, imágenes, tareas,
  cifrado, historial, recordatorios, carpetas y proyectos.
- Los checkpoints de código no son backups de las notas del usuario.

## Auditoría de partida

185 pruebas unitarias, typecheck, lint y compilaciones aprobadas. E2E bloqueadas
al iniciar Chromium (`spawn UNKNOWN`). Confirmados con datos ficticios: historial
sin cifrar, escrituras concurrentes perdidas y exportaciones demasiado grandes
para el importador. Detectados por inspección: cancelación del autoguardado,
solicitudes flotantes globales y pantalla de opciones con importador antiguo.

## Implementación y compatibilidad

- Checkpoint anterior a los cambios: `4ac4592`.
- Web Locks coordina adaptadores y Drive sin cambiar la clave ni el esquema de notas.
- Importación y snapshot se escriben juntos para disponer de una recuperación coherente.
- Cifrado conserva `tnenc:v2:` y lectura de payloads antiguos sin prefijo. El historial
  se cifra por versión. Notas cifradas antiguas se corrigen al introducir su contraseña;
  la migración no puede cifrar su historial sin ella. Títulos/tags siguen siendo metadatos visibles.
- Fixtures sintéticos (sin datos reales): `packages/shared/src/fixtures/legacy-backup.json`.
- Límites ampliados: 100 MiB por backup JSON, 16 MiB por cuerpo/versión, 140 MiB
  por archivo de backup cifrado. La exportación comprueba que el contenido sea restaurable.
- El botón flotante conserva permisos por dominio. Si Chrome no concede captura,
  explica que se debe activar TabNotes desde icono/atajo. No se solicita acceso global silencioso.
- Eliminados popup sin uso, antigua UI de Opciones y registro runtime no utilizado;
  todos recuperables desde el checkpoint.
- Herramientas: Node 24 recomendado, ESLint 10 (flat config), Vite 7, Vitest 4,
  DOMPurify 3.4.17 y React Router 7. Producción sin vulnerabilidades conocidas en la auditoría local.

## Resultado inicial comprobado (histórico)

- Revisión de código validada: `06bb9bee4db4cff2a10c47f6384f79abecdf8f09`.
- 191 pruebas unitarias; lint, typecheck, builds web/extensión, metadata e higiene aprobados.
- CI Linux: 37 E2E aprobadas y 1 omitida (arrastrar una nota a una carpeta).
  [Ejecución y evidencia visual](https://github.com/AtlasPCSupport/TabNotes/actions/runs/40257819210).
- Revisadas las capturas de onboarding, Capture Hub, recorte y Ajustes compartidos.
- Corregida durante E2E una reinicialización repetida del editor al cambiar el idioma:
  la inicialización ya no depende de una función de traducción de identidad variable.
- ZIP de la revisión del recorte (anterior al arreglo flotante): `store/tabnotes-extension-v2.12.0.zip` (201555 bytes).
  SHA-256: `63255a88ab2285ffb91ae2fc5f10bfa503efb3b4ad482d440c092229d85a4be6`.
- Cambios subidos a [PR #7](https://github.com/AtlasPCSupport/TabNotes/pull/7), en borrador.
  No se han integrado en main, creado un release ni enviado a Chrome Web Store.

### QA real de Chrome estable — 2026-10-26

Perfil aislado, extensión desempaquetada 2.12.0, Chrome 149.0.7827.115:

- Onboarding abierto y navegación de sus tres tarjetas comprobada.
- Nota sintética conservada al cambiar de ámbito y volver a abrirla desde la lista.
- Screenshot real renderizado como imagen y persistente tras recargar la extensión.
- Detectado y corregido un fallo del recorte con imágenes ya cargadas: el efecto de
  inicialización borraba las dimensiones recibidas por `onLoad`. La prueba añadida
  falla antes del arreglo y pasa después; total local actualizado: 192 unitarias.
- Recorte real seleccionado y guardado como segunda imagen tras aplicar el arreglo.
- Exportación real descargada: dos notas, texto con acentos y dos imágenes HTML
  presentes en el JSON. Importación por selector nativo pendiente de completar.
- Error de permisos tras recargar: mensaje visible; volver a invocar la extensión
  desde su icono restablece `activeTab` y permite capturar. Página de Chrome
  restringida muestra explicación sin modificar notas.
- Botón flotante y sus permisos por dominio aún no validados manualmente.

### Corrección del botón flotante — 2026-10-26

- El usuario informa que completó las comprobaciones manuales de importación y
  compatibilidad sin fallos aparentes. Es un resultado reportado, no una auditoría
  independiente de sus backups personales.
- Reproducido en Chrome estable: una pestaña independiente de TabNotes interceptaba
  la solicitud destinada al panel lateral. Ahora solo el panel real y visible la consume;
  al terminar de cambiar de pestaña se vuelve a comprobar una solicitud pendiente.
- Tras actualizar, se reemplaza el botón de la versión anterior que Chrome deja en
  la página con un contexto de mensajería inválido. No se reemplaza contenido del sitio.
- Respuestas `{ ok: false }`, rechazos y errores síncronos ya muestran una explicación
  junto al botón. Añadidas traducciones EN/ES y cuatro pruebas del script flotante.
- QA real: Nueva nota y Selección → nota nueva llegan al panel correcto con Ajustes
  abierto en otra pestaña. Huellas de las 20 notas existentes en QA permanecen iguales;
  solo se añadieron dos notas sintéticas para las comprobaciones.
- Screenshot sin concesión `activeTab`: error visible y ninguna nota vacía creada.
  El acceso a un solo dominio no sustituye ese permiso de captura. No se añadió acceso
  global. El usuario confirmó después que ya funciona al invocar la acción real de TabNotes.
- Se limpia un aviso anterior de captura fallida cuando otra acción se completa.
- Añadida regresión E2E para que las pestañas independientes no roben solicitudes.
  La prueba headless positiva emula la identidad del panel, no los permisos reales.

## Validación pendiente

El navegador automatizado local no inicia (`spawn UNKNOWN`), por lo que las E2E
se ejecutaron en CI. No se ha modificado el perfil habitual de Chrome. El perfil
aislado contiene las notas que el usuario importó para las pruebas; no tratarlo como
descartable ni borrar/restaurar sus datos automáticamente.

Completar `MANUAL_QA.md` en un perfil aislado: copia de un backup real anterior,
permisos de captura/clip por dominio en Chrome estable, impresión PDF, arrastre,
PWA sin conexión y Drive con la identidad oficial de Store. Las pruebas de captura
automatizadas simulan la respuesta de Chrome; no demuestran la concesión de permisos.
Actualizar capturas promocionales tras validar estos flujos. No publicar hasta
comprobar estos resultados; la aprobación de Store no garantiza por sí sola OAuth.

### Cierre adicional — 2026-10-26

- CI `2f07518`: 196 unitarias y 38 E2E aprobadas, una omitida (arrastre).
  [Evidencia](https://github.com/AtlasPCSupport/TabNotes/actions/runs/40353997216).
- Candidato `2515f8b`: aviso de permiso de captura específico en EN/ES y dos E2E
  adicionales de errores sin cambios de datos. Validación local aprobada (lint,
  tipos, 196 unitarias, builds, metadata e higiene). CI del candidato aprobada:
  40 E2E y una omitida; [ejecución](https://github.com/AtlasPCSupport/TabNotes/actions/runs/40355959415).
- PWA: edición y recarga offline aprobadas con datos sintéticos. La actualización
  de caché conserva cachés ajenas, pero su recarga offline inmediata requiere más
  validación por una pantalla vacía observada. No afecta al ZIP de la extensión.
- Copia OAuth con identidad oficial cargada en el perfil nuevo y autorizada por el
  usuario, quien confirmó que la cuenta es de pruebas. Verificado 2026-10-26: 2.12.0,
  conexión, subida manual de versiones 1/2, restauración real sobre una copia local
  antigua, subida automática de versión 3 y restauración repetida sin duplicados.
  Las lecturas del archivo real de Drive confirman contenido exacto e ID. Estado
  final: una nota ficticia, `ok`, sin errores y sincronización periódica activa.
  No se cambió el cliente OAuth ni se eludió la comprobación de identidad.
- ZIP actualizado y comprobado: 202239 bytes, SHA-256
  `0808eccb83c6816d2b8ef62f05f4fc3b713a3dc3900b1adaf411e929155fce0f`.
- PR #7 permanece en borrador; main, Store y GitHub Releases no se han publicado.
