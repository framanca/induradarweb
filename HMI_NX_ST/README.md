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
