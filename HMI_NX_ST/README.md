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


## Propiedades de pantalla y selección desde el PLC

En el editor, selecciona la pantalla y pulsa **✎ Editar pantalla** para cambiar su **nombre**, **número** (entero positivo único entre 1 y 65535) y **color de fondo**. El color se aplica tanto al lienzo como al HTML generado. Al copiar una pantalla se conservan el fondo y los widgets, pero se asigna un número nuevo para evitar colisiones; la primera pantalla de la lista es siempre la **principal**.

En **Proyecto → Control de pantalla desde PLC**, elige una variable entera importada de Sysmac (SINT, USINT, INT, UINT, DINT, UDINT, LINT o ULINT). El editor la marca como expuesta y el exportador la incluye en las variables Externals y en `/api/read`. El mapeo es por el **número configurado de pantalla**, no por índice del desplegable ni por nombre.

Ejemplo: principal n.º 1, ajustes n.º 10, alarmas n.º 20. Si `CurrentScreen : UINT` vale 10, se muestra Ajustes. Con 20, Alarmas. Si vale 0, 999 o un número sin pantalla, se muestra la principal. La variable se monitoriza en cada snapshot válido del PLC.

Con esta opción activada, el PLC tiene la autoridad: los controles de navegación manual de la HMI operativa quedan deshabilitados, para evitar que la pantalla cambie inmediatamente de vuelta tras pulsarlos. No se escribe automáticamente en el PLC al navegar. Si no se configura la variable, sigue disponible la navegación manual de siempre. Ante un fallo de comunicación se mantiene la última pantalla válida y se indica el estado degradado; no se toma una decisión nueva con datos obsoletos.

Los proyectos anteriores que no tenían número ni color se normalizan con números 1, 2, 3… y fondo blanco. Las operaciones son reversibles mediante Deshacer en la sesión y quedan incluidas en el autoguardado de proyecto.

Pruebas: `node --test HMI_NX_ST/tests/screens.test.cjs HMI_NX_ST/tests/navigation.test.cjs`.
