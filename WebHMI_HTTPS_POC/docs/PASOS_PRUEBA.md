# Prueba de laboratorio: conexión TLS NX mediante ST

**Estado: detección de encabezado + alerta fatal. NO HTTPS.**

## Preparación

1. Utiliza preferentemente un NX102 de pruebas, desconectado de equipos o máquinas en producción. Si solo tienes NX1P2 o NX5, confirma la referencia exacta, versión de unidad y Sysmac Studio.
2. Guarda una copia del proyecto Sysmac existente y crea un proyecto de laboratorio nuevo.
3. Crea un **Program** `WebHMI_TLS_Probe` en lenguaje **Structured Text**.
4. Abre `sysmac/WebHMI_TLS_Probe.st` y pega el contenido en el **cuerpo** del programa (no es un archivo de proyecto Sysmac autónomo).
5. Importa o pega `sysmac/WebHMI_TLS_Probe_LocalVariables.tsv` en las variables locales del programa, usando el mismo formato que en la exportación habitual del editor.
6. Asigna el programa a una tarea apropiada. El watchdog `WebTLS_StateTicks` mide **ciclos de tarea**, no milisegundos.
7. Compila en Sysmac. Si el código da errores por firma o tipos de una instrucción, guarda el listado completo; aún no se ha verificado en Sysmac.
8. Transfiere al equipo de laboratorio y pon el controlador en RUN; comprueba desde Sysmac `WebTLS_State=10`, `WebTLS_AcceptErrors=0`.

## Prueba desde PC

- Conecta el PC a la misma red IP de pruebas y confirma que puede acceder a la IP del NX.
- Desde un PC con OpenSSL (solo herramienta de prueba, no se instala ni ejecuta en el PLC):
  `openssl s_client -connect 192.168.250.1:8443 -tls1_2 -brief`
- También puedes abrir `https://192.168.250.1:8443/` en un navegador, pero **debe dar error de negociación TLS**.
- Supervisa `WebTLS_Connections` y `WebTLS_RecordCandidates`. Si llega a detectar los cinco bytes de la cabecera TLS, el segundo contador debe aumentar (todavía no se comprueba que el mensaje completo sea un ClientHello).
- Prueba además `http://192.168.250.1:8443/`: debe rechazarse, sin ejecutar ninguna API ni mostrar página.
- Comprueba `WebTLS_State` regresa a 10 tras cada intento y que el ciclo de la máquina no se ve afectado.

## Lo que demuestra y lo que NO demuestra

Demuestra, **si se confirma en hardware**, que el programa puede recibir una conexión de navegador al puerto TCP 8443 y distinguir una cabecera TLS. NO proporciona un certificado, autenticación, cifrado, un handshake válido ni respuesta HTTP dentro de TLS. Una página web no podrá abrirse por HTTPS hasta construir y validar esas partes.

**No cargar junto con `WebHMI_Server.st` en el mismo puerto. No usar para operativa real ni control de una máquina.**

## Resultados necesarios

Indica modelo y firmware exactos del PLC, versión de Sysmac Studio, errores de compilación si existen, valor de `WebTLS_Connections`, `WebTLS_RecordCandidates`, `WebTLS_Rejected`, `WebTLS_AcceptErrors`, tarea/ciclo, y comportamiento del navegador.

No adjuntes claves privadas, contraseñas ni certificados con clave privada.
