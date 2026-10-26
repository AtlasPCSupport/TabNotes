# TabNotes — validación y entrega

## Ajustes de interfaz posteriores al envío — candidato 2.12.1

Rama: `codex/ui-clarity-polish`. Nuevo ZIP local 2.12.1; no es otro envío a la Store.
La validación de entrega que figura debajo corresponde al paquete 2.12.0 anterior,
no al `dist` reconstruido con estos ajustes de interfaz.

- Cabecera: solo se retira el engranaje superior; idiomas, tema, grafo, proyecto,
  ayuda y navegación inferior se conservan.
- Ámbitos: Página / Sitio / Proyecto / Global con explicación contextual EN/ES;
  valores internos, formato de notas y backups sin cambios.
- Capturar: destino resaltado como paso 1 y tipo de captura como paso 2,
  manteniendo un destino común para texto, screenshot y recorte; nota en blanco
  separada; Escape cierra el menú y devuelve el foco.
- Lista: Sin organizar en español, proyecto actual en la explicación, grupos
  vacíos ocultos y tareas de solo lectura sin marcadores Markdown ni HTML/base64.
- Pruebas reales: screenshot y recorte a nota actual/nueva en Chrome estable,
  con imágenes visibles y texto previo conservado. Perfil nuevo con datos ficticios;
  no se usa el perfil habitual ni los perfiles anteriores con notas importadas.
- Evidencia y registro local: `tmp/ui-clarity-qa/QA.md` y sus capturas.
  Acceso directo de escritorio: `TabNotes-Pruebas-UI.lnk`.
- Validación local: 213 unitarias y 44 E2E aprobadas; una E2E de arrastre
  omitida por la limitación conocida de headless. Lint, tipos, formato,
  compilación, metadata e higiene aprobados.

Si Chromium de Playwright no arranca en Windows (`spawn UNKNOWN`), el runner admite
Chrome instalado con carga de extensiones por CDP. Siempre crea un perfil efímero:

```powershell
$env:TABNOTES_E2E_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm --filter @tabnotes/extension exec playwright test
```

CI sigue usando Chromium de Playwright por defecto. No se alteran permisos del
manifest, cliente OAuth ni identidades de Drive. El envío 2.12.0 a revisión no se
ha modificado. Sus ZIP locales anteriores se retiran del escritorio por petición
del usuario, después de validar el nuevo paquete.

---

## Entrega 2.12.0 anterior — registro histórico

Fecha: 2026-10-26, America/Lima. Pruebas en perfiles de Chrome aislados.
No se modificó el perfil habitual. El usuario confirmó que la cuenta de Drive es de pruebas.
No subir la carpeta TabNotes-2.12.0-Prueba-Drive a la Store.

## Candidato final

- Runtime: 0cf9204; bfd269e ajusta únicamente una expectativa de prueba.
- Validación local: lint, tipos, 200 unitarias, builds, metadata e higiene aprobados.
- Auditoría de producción: ninguna vulnerabilidad conocida reportada.
- CI final del código aprobada: 200 unitarias y 41 E2E; una omitida.
  https://github.com/AtlasPCSupport/TabNotes/actions/runs/40380703403
- La única E2E omitida es arrastre HTML5 en headless; se comprobó en Chrome estable real.
- No cambiaron tabnotes_data, StorageData versión 3, cliente OAuth ni scopes de Drive.

## Comprobaciones reales completadas

| Área           | Evidencia y alcance                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capturas       | Screenshot/recorte como imágenes, persistencia y errores visibles en Chrome estable; el usuario confirmó que funcionan desde la acción real de TabNotes. Headless simula la API, no los permisos.                                       |
| Botón flotante | Nueva nota y selección a nota nueva llegan al panel nativo con Ajustes abierto. El permiso es por dominio; invocar Extensiones → TabNotes concede activeTab para captura.                                                               |
| Importación    | El usuario completó sus pruebas manuales y reportó buen funcionamiento. Regresiones sintéticas cubren backups legados, cifrado, historial, imágenes grandes e importación atómica. No es una auditoría de todos sus backups personales. |
| Drive          | Identidad oficial y OAuth reales; versiones manuales 1/2, recuperación sobre copia antigua, subida automática de versión 3 y restauración repetida sin duplicados. Lecturas del archivo real confirman texto e ID.                      |
| Conflictos     | Dos ediciones divergentes en QA, una en el archivo real de Drive simulando otro cliente. Tras corregir el fallo encontrado, dos restauraciones y subida final conservan ambas. No se completó un segundo login OAuth en la web pública. |
| Arrastre       | Panel nativo y comprobación en storage: raíz → carpeta y carpeta → raíz, mismo ID. No se contó una espera de automatización como aprobación.                                                                                            |
| PDF            | Botón real, imagen y título/tags con ángulos y comillas. PDF producido por Chrome, renderizado e inspeccionado: acentos, imagen y texto correctos, sin HTML literal. Solo en QA se interceptó window.print; no se imprimió físicamente. |
| Títulos        | La compilación corregida reabre el título literal y conserva todos los datos al recargar. La E2E añade edición posterior para comprobar que no sobrescribe el título.                                                                   |
| Inbox          | Filtros Texto/Imágenes/Tareas y resúmenes sin base64. Una imagen con pie de texto pertenece a ambos filtros; no son excluyentes. El cuerpo original no cambia.                                                                          |
| Onboarding     | Reapertura desde Ayuda, Tab/Shift+Tab dentro del diálogo y cierre con Escape.                                                                                                                                                           |
| Interfaz       | Cinco capturas reales 1280×800; revisión adicional 1440×900 y 390×844, español/inglés, claro/oscuro. En panel estrecho no hay desbordamiento horizontal y la navegación inferior queda visible.                                         |
| PWA            | Nueva compilación activada, tres recargas offline y nota con acentos intacta. Se conserva la caché ajena de prueba. Se comprobó también con assets precargados sin encabezado Origin.                                                   |

## Correcciones del cierre

- PWA: caché separada por build y coincidencia de módulos públicos pese a Vary: Origin.
  Una instalación incompleta no sobrescribe la caché activa anterior.
- Títulos: no se elimina formato del valor guardado al cargarlo en el editor.
- Drive: una revisión ya retenida como conflicto no sustituye después la edición local
  al repetir la recuperación. También se respeta descartar esa copia.
- PDF: los párrafos HTML legados se renderizan, no se muestran como etiquetas.
- Tarjetas: resumen textual limitado a 240 caracteres, sin HTML/base64 y sin modificar backups.

## Archivos del escritorio

- TabNotes-2.12.0-final.zip: ZIP para actualizar la extensión existente en Store.
- TabNotes-2.12.0-final.zip.sha256: suma de verificación.
- TabNotes-2.12.0-actualizacion.zip: copia idéntica con el nombre anterior.
- TabNotes-2.12.0-Store-Assets/: cinco PNG de la interfaz real con datos ficticios.

ZIP comprobado: 202294 bytes, 28 archivos, manifest 2.12.0 en raíz, sin sourcemaps,
claves QA, perfiles, notas ni dependencias de desarrollo. Cada archivo coincide
con apps/extension/dist. SHA-256:
7c2b961c534c3bf1504fc61534bcb3c591226a6c496cf9115ce51bd88ce71350

Evidencia local ignorada por git: tmp/pdfs/, tmp/final-qa/ y tmp/drive-qa-20261026/.
El perfil/cuenta QA conserva sus notas ficticias y el proyecto de demostración;
no se borraron sus backups.

## Pendiente de distribución, no ejecutado

1. Integrar PR #7 en main y crear una publicación GitHub si el usuario lo autoriza.
   El código está subido a la rama; PR permanece en borrador.
2. Subir el ZIP final como actualización de la ficha existente, revisar las declaraciones
   de permisos/privacidad y enviar a revisión. Usar las capturas nuevas si se actualizan.
3. Tras aprobarse, instalar la actualización oficial y verificar versión, notas anteriores,
   screenshot/recorte y Drive. Hacer backup manual antes de actualizar el perfil habitual.
4. Para distribuir también los cambios web/PWA, desplegar por separado el sitio. El ZIP
   de Chrome no actualiza la web pública ni su sesión OAuth; la fuente web queda en el repo.

La aprobación de Store no está bajo control del agente. No afirmar que se publicó
ni que el sitio público se actualizó solo porque las pruebas o el ZIP estén listos.
