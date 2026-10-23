# WebHMI HTTPS para Omron NX — investigación ST/FB

Estado: **FASE 0 — prueba de sockets con detección de un encabezado TLS**. No existe todavía un servidor HTTPS funcional y **no puede usarse como sustituto seguro de la WebHMI HTTP**.

## Objetivo final

Exportar, como en el editor actual de `HMI_NX_ST`, un ZIP Sysmac que contenga `WebHMI_Server.st`, `WebHMI_LocalVariables.tsv`, `WebHMI_ExternalVariables.tsv`, `HMI_Embedded.html`, `project.nxst` y documentación. El servidor deberá aceptar HTTPS, cifrar las lecturas/escrituras y ejecutarse 100 % en ST/FB dentro de NX1P2, NX102 o NX5. Ningún proxy, IPC, runtime ni librería externa durante la ejecución.

## Hechos verificados

El exportador actual `HMI_NX_ST/st.js` genera HTTP, no HTTPS. Se basa en los FB `SktTCPAccept`, `SktTCPRcv`, `SktTCPSend` y `SktClose`. La instrucción documentada `SktTLSConnect` establece TLS de **cliente**; no hay documentado un equivalente para un servidor de aplicación que acepte navegadores en TLS. Por ello NO basta con cambiar a 8443.

## Fase 0 incluida

- `sysmac/WebHMI_TLS_Probe.st`: cuerpo de programa ST que acepta TCP en puerto 8443, acumula 5 bytes de cabecera TLS, registra contadores y devuelve una alerta TLS fatal de `handshake_failure`. **No establece sesiones TLS**.
- `sysmac/WebHMI_TLS_Probe_LocalVariables.tsv`: variables locales para importar a Sysmac Studio.
- `tests/tls_record_header.test.cjs`: pruebas de modelo JS para clasificación básica de cabeceras TLS. No ejecuta ni compila ST.
- `docs/PASOS_PRUEBA.md`: guía de laboratorio.
- `docs/CRITERIOS_SEGURIDAD.md`: hitos obligatorios para poder habilitar el servidor HTTPS y exportar una HMI real.

## Estado y condiciones para la fase HTTPS real

| Módulo | Estado |
|---|---|
| TCP ST para un cliente en 8443 | Prototipo **sin verificar en Sysmac/hardware** |
| Detección de encabezado TLS | Código ST creado, no validado en hardware |
| TLS handshake, certificados, ECDHE, CSPRNG | **NO IMPLEMENTADO** |
| Encriptación TLS AEAD, lectura/escritura | **NO IMPLEMENTADO** |
| Enlace a exportador existente | **NO IMPLEMENTADO** |
| HTTPS en Chrome/Firefox | **NO FUNCIONA TODAVÍA** |

No insertar secretos reales, claves privadas ni certificados en este repositorio. No exponer el equipo a redes de planta o Internet.

El repositorio de origen `framanca/induradarweb` **no ha sido modificado en `main`**. El contenido está preparado en una rama de investigación. El repositorio independiente definitivo requiere crearse en GitHub desde la cuenta propietaria porque el conector actual no dispone de acción "Crear repositorio".

## Referencias

- Omron NJ/NX Instructions Reference Manual W502 — sockets TCP y `SktTLSConnect`.
- RFC 8446 y RFC 9846 — requisitos TLS, generación de números aleatorios y recomendaciones de implementación.
