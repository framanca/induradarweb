# HMI NX ST 0.3

Editor independiente para generar una HMI web autocontenida y un servidor HTTP en Structured Text para Omron NJ/NX, sin SD ni libreria REST de pago.

Ruta publica: `/HMI_NX_ST/`. No reemplaza `/HMI_NX/`.

## Validado en hardware

La base `SktTCPAccept` + `SktTCPRcv` + `SktTCPSend` + `SktClose`, el HTML embebido y la lectura de variables se han validado en un NX102 real. Las nuevas funciones 0.3 deben volver a validarse en hardware tras exportar.

## Funciones 0.3

- Escritura directa RW de BOOL y tipos numericos.
- Botones BOOL SET / RESET / TOGGLE.
- Varias pantallas con navegacion superior y objetos de navegacion.
- Imagenes PNG/JPEG/WebP/SVG embebidas como Data URL dentro del HTML/ST.
- Widgets industriales: motor, bomba, valvula, deposito, sensor y cinta.
- Alarmas vivas con severidad, condiciones y ACK local del navegador.
- Recetas configurables; cada receta se aplica en el PLC dentro de un unico `CASE` ST.
- Escalado proporcional al ancho del navegador con minimo y maximo.

## Alarmas

La version 0.3 evalua alarmas en el navegador a partir de los valores actuales. El ACK es local y no hay historico PLC. Un buffer de eventos ST sera una evolucion posterior para registrar ocurrencias aunque no haya navegador conectado.

## Exportacion

El ZIP incluye:
- `WebHMI_Server.st`
- `WebHMI_LocalVariables.tsv`
- `WebHMI_ExternalVariables.tsv`
- `HMI_Embedded.html`
- `project.nxst`
- `README.txt`

## Limites actuales

Un cliente TCP simultaneo, HTTP/1.0 `Connection: close`, peticion HTTP <=1900 bytes, respuesta `/api/read` recomendada <=1500 bytes, imagen individual <=512 KB y conjunto de imagenes <=2 MB. Sin HTTPS ni usuarios. La logica y seguridades de maquina pertenecen al PLC.
