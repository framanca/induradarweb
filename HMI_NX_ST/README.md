# HMI NX ST — POC independiente

Editor experimental para generar una HMI web autocontenida y un programa Structured Text que actúa como servidor HTTP mínimo usando las instrucciones socket estándar del NJ/NX (`SktTCPAccept`, `SktTCPRcv`, `SktTCPSend`, `SktClose`).

Ruta publicada: `/HMI_NX_ST/`. No reemplaza ni modifica `/HMI_NX/`.

## Importación de variables

Acepta CSV/TSV/TXT con encabezados habituales (`Name`/`Nombre`, `Data Type`/`Tipo`, `Comment`/`Comentario`), filas sin encabezado `nombre ; tipo ; comentario` y declaraciones ST sencillas `Variable : REAL;`. El flujo recomendado para la POC es copiar/exportar la tabla de Variables Globales de Sysmac Studio y cargarla aquí.

El transporte POC acepta BOOL, enteros, REAL/LREAL y STRING para lectura; escritura solo BOOL/números. Tipos no compatibles se importan pero quedan desactivados.

## Exportación

Genera ZIP con:
- `WebHMI_Server.st`: cuerpo de un `Program` ST.
- `WebHMI_LocalVariables.tsv`: tabla de variables locales del programa servidor.
- `HMI_Embedded.html`: HTML que queda embebido en fragmentos dentro del ST.
- `project.nxst`: fuente editable del editor.
- `README.txt`: puesta en marcha y límites.

## Límites deliberados de V0

Un cliente simultáneo, HTTP/1.0 con `Connection: close`, una sola pantalla, petición HTTP <=1900 bytes, sin HTTPS/usuarios/recetas/alarmas. Es una POC para compilar primero en Sysmac y validar en un NX102 aislado. No utilizar para seguridad funcional.

## Protección contra eliminaciones accidentales (editor)

- **Deshacer / Rehacer**: controles en la cabecera y atajos `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` y `Ctrl/Cmd+Shift+Z`. Hasta 100 modificaciones por sesión; también se registran los arrastres de widgets como una sola acción.
- Se pide confirmación explícita antes de borrar una pantalla completa, un widget, una alarma o una receta. Un borrado cancelado no modifica el proyecto.
- Antes de ejecutar un borrado confirmado se exige una copia local de recuperación. Si el navegador rechaza el almacenamiento, el editor bloquea ese borrado en lugar de continuar sin copia.
- Tras actualizar o reabrir la pestaña se restaura automáticamente el último proyecto local guardado; la demo y «Nuevo» requieren una elección explícita y respaldo previo.
- **Deshacer/Rehacer es temporal** y se reinicia al abrir otro proyecto. Para revertir borrados después de cerrar o refrescar, usar «Recuperar» y sus instantáneas de respaldo. Descargar periódicamente `.nxst`: el almacenamiento del navegador no equivale a una copia externa y no se comparte entre otros equipos/perfiles.

Pruebas del historial: `node HMI_NX_ST/tests/history.test.cjs`. Además de estas pruebas unitarias, validar manualmente en Chrome, Firefox y Safari los flujos de borrar/cancelar/deshacer/refrescar y pérdida de almacenamiento.

## Navegación de la HMI generada

La cabecera de operación presenta una única barra de navegación con el selector **Pantalla** y, a su lado, el botón **Alarmas**, que mantiene el indicador del número de alarmas activas. Al seleccionar una pantalla se conserva la navegación por los botones internos configurados por el diseñador, actualizándose siempre la selección del desplegable. La vista de alarmas sigue siendo una ventana superpuesta; abrirla no cambia la pantalla activa. Se mantiene un diseño responsive con controles táctiles adecuados para móvil.

Prueba de regresión: `node --test HMI_NX_ST/tests/navigation.test.cjs`.
