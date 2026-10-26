# Validación de TabNotes 2.12 antes de publicar

Usar un perfil de Chrome de pruebas y cargar `apps/extension/dist` desde
`chrome://extensions`. Las pruebas automatizadas utilizan datos ficticios;
no se han abierto ni modificado las notas del perfil habitual del usuario.

Referencia automatizada: código `06bb9be`, 191 pruebas unitarias y 37 E2E aprobadas
en [CI](https://github.com/AtlasPCSupport/TabNotes/actions/runs/40257819210).
Una E2E de arrastre sigue omitida. Las capturas E2E simulan la API de Chrome;
las casillas siguientes requieren una comprobación real antes de publicar.

QA del 2026-10-26: Chrome estable aislado comprobó cambio de ámbito, persistencia
tras recarga, screenshot y recorte reales (nota actual), aviso de página restringida
y exportación JSON con dos imágenes. Se corrigió la inicialización del recorte con
imágenes ya cargadas; ahora hay 192 unitarias aprobadas localmente. Las casillas no
se marcan globalmente porque incluyen otros destinos y datos antiguos aún pendientes.

## Compatibilidad y recuperación

- [ ] Importar una copia de un backup anterior en el perfil de pruebas.
- [ ] Comprobar cantidad de notas, IDs/ámbitos, proyectos, carpetas, etiquetas,
      imágenes, tareas, historial y recordatorios.
- [ ] Escribir y cambiar inmediatamente de nota, ámbito o proyecto. Volver y
      comprobar que están los últimos caracteres.
- [ ] Abrir dos ventanas, crear notas y editar notas distintas simultáneamente.
- [ ] Exportar, importar en un segundo perfil vacío y comparar el contenido.
- [ ] Repetir con backup cifrado; probar contraseña incorrecta sin cambios en datos.
- [ ] Importar datos adicionales y usar la recuperación de la importación.

## Cifrado

- [ ] Cifrar una nota que tenga historial; su cuerpo no debe verse en historial,
      almacenamiento ni backup JSON sin descifrar.
- [ ] Desbloquear, editar, cerrar/reabrir el panel y volver a desbloquear.
- [ ] El título y las etiquetas siguen visibles por diseño; el diálogo lo explica.
- [ ] Desbloquear una nota cifrada antigua para proteger también su historial legado.
      La migración requiere su contraseña y conserva los contenidos recuperables.

## Captura y permisos

- [ ] En una página HTTPS normal, invocar primero TabNotes desde icono/atajo.
- [ ] Capture Hub: screenshot y crop → nota actual / nueva nota.
- [ ] La imagen debe renderizar, persistir tras recargar y no aparecer como texto base64.
- [ ] Seleccionar texto: clip → nota actual / nueva, incluido menú contextual.
- [ ] Activar botón flotante en un dominio, aceptar el permiso y probar sus acciones.
- [ ] Abrir otro dominio: el permiso y el botón no deben aparecer automáticamente.
- [ ] Tras navegar a otra pestaña, probar captura flotante. Si Chrome exige volver
      a invocar la extensión, debe aparecer la explicación en vez de fallar en silencio.
- [ ] Desactivar el botón con varias pestañas del mismo dominio abiertas:
      desaparece en todas. Revocar permisos también debe impedir la inyección.
- [ ] Cambiar de nota/pestaña mientras llega una captura: no modificar otra nota.
- [ ] Páginas restringidas y permisos denegados: mensaje claro, sin notas dañadas.

## Interfaz y otras entradas

- [ ] Onboarding completo, cerrar con Escape y volver a abrir desde Ayuda.
- [ ] Tab/Shift+Tab permanecen dentro de los diálogos; al cerrar vuelve el foco.
- [ ] Panel estrecho (390 px), temas claro/oscuro, español/inglés.
- [ ] Inbox muestra las notas sin carpeta del proyecto activo.
- [ ] Filtros Texto/Imágenes/Tareas y sus contadores.
- [ ] Opciones de Chrome muestra los mismos Ajustes e importador que el panel.
- [ ] Arrastrar una nota a una carpeta (única prueba E2E omitida).
- [ ] Exportar PDF con imágenes y título/etiquetas que contengan `<`, `>` y comillas.
- [ ] Web/PWA: editar y recargar sin conexión, después actualizar a la nueva versión.

## Drive y publicación

- [ ] Build desempaquetado: aviso de identidad OAuth local esperado.
- [ ] Identidad oficial de Store: conectar, sincronizar, modificar y volver a sincronizar.
- [ ] Comprobar conflicto entre web/extensión sin perder una de las versiones.
- [ ] Actualizar capturas promocionales con la interfaz validada.
- [ ] ZIP generado desde la revisión comprobada, manifest 2.12.0 y sin mapas de código.
- [ ] Tras subir, verificar versión instalada, web pública y política de privacidad.

La aprobación de Store y el acceso real a la cuenta Google no se pueden demostrar
con imágenes simuladas ni solo con pruebas unitarias.
