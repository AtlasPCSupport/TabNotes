# TabNotes: cierre de estabilidad y compatibilidad

Plan autorizado el 2026-10-25. Mantener notas, IDs, ámbitos, workspaces,
historial y lectura de backups existentes. No modificar perfiles reales de Chrome.

- [x] 0. Conservar el upscale en un commit local y verificar el remoto GitHub.
- [x] 1. Implementar escrituras coordinadas entre ventanas y Drive; guardar borradores al cambiar de contexto.
- [x] 2. Proteger contenido e historial cifrados y probar exportación/restauración compatible.
- [x] 3. Implementar capturas con origen/destino, errores y consumo único de solicitudes flotantes (validación real en paso 6).
- [x] 4. Unificar Ajustes/Opciones, destinos de captura y diálogos accesibles. Inbox continúa significando notas sin carpeta.
- [x] 5. Actualizar dependencias aplicables y retirar código obsoleto/sin uso.
- [ ] 6. Validación: regresión y compatibilidad automatizadas completas; permisos reales y datos de usuario pendientes en un perfil de pruebas.
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

## Resultado comprobado

- Revisión de código validada: `06bb9bee4db4cff2a10c47f6384f79abecdf8f09`.
- 191 pruebas unitarias; lint, typecheck, builds web/extensión, metadata e higiene aprobados.
- CI Linux: 37 E2E aprobadas y 1 omitida (arrastrar una nota a una carpeta).
  [Ejecución y evidencia visual](https://github.com/AtlasPCSupport/TabNotes/actions/runs/40257819210).
- Revisadas las capturas de onboarding, Capture Hub, recorte y Ajustes compartidos.
- Corregida durante E2E una reinicialización repetida del editor al cambiar el idioma:
  la inicialización ya no depende de una función de traducción de identidad variable.
- ZIP local: `store/tabnotes-extension-v2.12.0.zip` (201523 bytes).
  SHA-256: `5eb2829fb1e43f2736aa80f5e79b7b3b7a0a6c03f21de48b9f8e30f55d4ac71c`.
- Cambios subidos a [PR #7](https://github.com/AtlasPCSupport/TabNotes/pull/7), en borrador.
  No se han integrado en main, creado un release ni enviado a Chrome Web Store.

## Validación pendiente

El navegador automatizado local no inicia (`spawn UNKNOWN`), por lo que las E2E
se ejecutaron en CI. No se han modificado perfiles de Chrome ni notas reales.

Completar `MANUAL_QA.md` en un perfil aislado: copia de un backup real anterior,
permisos de captura/clip por dominio en Chrome estable, impresión PDF, arrastre,
PWA sin conexión y Drive con la identidad oficial de Store. Las pruebas de captura
automatizadas simulan la respuesta de Chrome; no demuestran la concesión de permisos.
Actualizar capturas promocionales tras validar estos flujos. No publicar hasta
comprobar estos resultados; la aprobación de Store no garantiza por sí sola OAuth.
