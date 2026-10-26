# TabNotes: cierre de estabilidad y compatibilidad

Plan autorizado el 2026-10-25. Mantener notas, IDs, ámbitos, workspaces,
historial y lectura de backups existentes. No modificar perfiles reales de Chrome.

- [x] 0. Conservar el upscale en un commit local y verificar el remoto GitHub.
- [x] 1. Implementar escrituras coordinadas entre ventanas y Drive; guardar borradores al cambiar de contexto.
- [x] 2. Proteger contenido e historial cifrados y probar exportación/restauración compatible.
- [x] 3. Implementar capturas con origen/destino, errores y consumo único de solicitudes flotantes (validación real en paso 6).
- [x] 4. Unificar Ajustes/Opciones, destinos de captura y diálogos accesibles. Inbox continúa significando notas sin carpeta.
- [x] 5. Actualizar dependencias aplicables y retirar código obsoleto/sin uso.
- [ ] 6. Pruebas de regresión, backups antiguos, E2E y validación de Chrome.
- [ ] 7. Actualizar documentación, generar paquete verificable y publicar según resultados.

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

## Validación pendiente

Ejecutar E2E en CI Linux, resolver cualquier regresión y probar permisos reales de
captura/clip en Chrome estable. Probar Drive con la identidad oficial de Store.
Actualizar capturas promocionales tras validar UI. No marcar la publicación terminada
hasta comprobar estos resultados.
