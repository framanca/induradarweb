# Integración NX102 — puntos todavía no entregados como programa PLC

No se incluye un `.slr`, proyecto Sysmac compilado o FB HTTP verificado. El contrato `nx-http-v2` y el banco ejecutable definen la semántica que hay que integrar; no acreditan compatibilidad con la librería de Omron ni se cargan en el NX como un programa JavaScript.

## Dependencias materiales

1. Recuperar la documentación y la librería exactas de WebServer_NJ_NX y comprobar su protocolo real, buffers, rutas de SD y tamaño de fichero. No asumir `/WEB/index.html`, ni que `/api/hmi/*` ya exista.
2. Implementar/adaptar transporte HTTP y mapeo simbólico explícito a estructuras PLC. La importación de variables no accede por sí sola a memoria del controlador.
3. Resolver autenticación y protección del transporte en un servicio de máquina compatible. No se sustituye autorización real por ocultar botones. Cuentas/credenciales/política activa fuera del directorio público.
4. Aplicar comandos en la tarea PLC bajo permisos/enclavamientos y lista blanca. No escribir directamente salidas físicas por nombre proporcionado por el navegador.
5. Implementar recetas en búfer temporal: recepción, validación completa, comprobación de versión/estado, aplicación de estructura y resultado. Un lote inválido no se aplica parcialmente.
6. Capturar alarmas en PLC, con identificadores de aparición y secuencia, aunque no exista navegador. Recuperar cursor e indicar huecos. ACK, silencio y reset no son intercambiables.
7. Persistir recetas operativas y registros fuera de builds web, con límites, retención, estados de SD y recuperación ante corte. El registro HMI no cubre automáticamente cambios desde Sysmac.
8. Validar todo en NX102 de laboratorio: carga/ciclo, tamaño SD, latencia, pérdida/red, doble cliente, reconexión, reboot, expiración, credenciales inválidas, datos obsoletos y fallos de almacenamiento.

## Contrato de referencia

El exportado incluye `Engineering/transport-contract.json`, la política y su SHA256. El runtime empieza consultando `GET /api/hmi/capabilities` y exige igualdad de proyecto y política y las capacidades mínimas. El servidor autentica al usuario y deriva su rol; no confía en roles del request.

`POST /api/hmi/read` recibe nombres permitidos agrupados y debe devolver valores tipados, calidad, revisión y estado de fuente. Frecuencia configurada = objetivo de consulta, no garantía temporal.

`POST /api/hmi/command` recibe commandId, policyDigest, elementId, action, expectedRevision y data. Antes de aplicar se comprueban autorización por elemento/acción, condición, tipo/rango, política y revisión. El servidor conserva resultado por identificador; reutilizar un ID con otro contenido se rechaza. El cliente no reenvía automáticamente una orden no confirmada.

`POST /api/hmi/events` recibe época, cursor y límite. Devuelve eventos secuenciados, continuidad/huecos y una instantánea cuando proceda. El cliente puede recuperar la vista sin declarar resueltos los eventos perdidos.

Las operaciones y respuestas exactas se pueden ejecutar contra `server/reference.cjs` para desarrollar el adaptador. El banco no sustituye la implementación PLC ni justifica omitir pruebas físicas.
