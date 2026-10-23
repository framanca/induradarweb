# WebHMI HTTPS para Omron NX — investigación ST/FB

Estado: **investigación criptográfica / transporte TLS 1.2 post-handshake**. Implementados en ST los bloques SHA-256, AES-128, AES-GCM y la capa de registros TLS 1.2. FALTAN handshake, ECDHE, certificados, CSPRNG y enlace a WebHMI. **No existe todavía un servidor HTTPS funcional y no puede usarse como sustituto seguro de la WebHMI HTTP.**

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
- `crypto/FB_WebSHA256.st`: compresión SHA-256 fraccionada en ciclos.
- `crypto/FB_WebAES128.st`: cifrado de bloques AES-128.
- `crypto/FB_WebAESGCM.st`: autenticación/cifrado AES-GCM con AAD; descifrado rechaza etiquetas inválidas.
- `crypto/FB_WebTLS12Record.st`: registros TLS 1.2 application_data **únicamente después del handshake**. No implementa handshake ni claves.
- `tests/crypto_primitives.test.cjs`: modelos de referencia JS alimentados con constantes del ST; casos NIST y comparación con `node:crypto`. Estas pruebas **NO ejecutan ST ni lo compilan en Sysmac**.

## Estado y condiciones para la fase HTTPS real

| Módulo | Estado |
|---|---|
| TCP ST para un cliente en 8443 | Prototipo **sin verificar en Sysmac/hardware** |
| Detección de encabezado TLS | Código ST creado, no validado en hardware |
| TLS handshake, certificados, ECDHE, CSPRNG | **NO IMPLEMENTADO** |
| SHA-256, AES-128 y AES-GCM ST | **Código creado, pruebas de modelos, SIN validar en Sysmac** |
| TLS 1.2 application_data AEAD | **FB ST creado para claves de sesión ya derivadas, SIN handshake** |
| Lectura/escritura WebHMI por canal TLS | **NO IMPLEMENTADO** |
| Enlace a exportador existente | **NO IMPLEMENTADO** |
| HTTPS en Chrome/Firefox | **NO FUNCIONA TODAVÍA** |

No insertar secretos reales, claves privadas ni certificados en este repositorio. No exponer el equipo a redes de planta o Internet.

El repositorio de origen `framanca/induradarweb` **no ha sido modificado en `main`**. El contenido está preparado en una rama de investigación. El repositorio independiente definitivo requiere crearse en GitHub desde la cuenta propietaria porque el conector actual no dispone de acción "Crear repositorio".

## Firmware y Sysmac Studio: NX102-9000

- **Mínimo de plataforma TCP:** NX102 firmware/Unit Ver. 1.30 y Sysmac Studio Ver. 1.23 para la CPU NX102, según documentación de soporte original. No constituye un mínimo demostrado para HTTPS.
- **Base de desarrollo reproducible recomendada:** NX102-9000 firmware/Unit Ver. **1.64** y Sysmac Studio **1.62**, combinación utilizada en un proyecto independiente de cliente TLS ST. Esto **NO confirma** compatibilidad del nuevo servidor.
- Omron documenta TLS nativo como **cliente** desde firmware Ver. 1.46 y Sysmac Studio 1.46, pero esto no permite HTTPS de navegador servido desde ST.
- Puerto propuesto para HTTPS WebHMI: **8443**. Puerto 443 reservado en la CPU.
- **Versión mínima HTTPS real:** por determinar después de compilar, negociar un handshake completo y medir el runtime en hardware.

### Restricciones funcionales pendientes

No hay interfaz ST documentada para TLS de servidor en NX102. El servidor real requiere intercambio ECDHE, autenticación X.509, firma efímera del handshake, números aleatorios criptográficamente seguros y almacenamiento de claves/estado sin reutilización al reiniciar. Ninguna de esas piezas puede sustituirse por un puerto distinto o una clave AES fija. Los FB criptográficos actuales no están auditados contra canales laterales y pueden resultar demasiado lentos en HMI grandes.

## Referencias

- Omron NJ/NX Instructions Reference Manual W502 — sockets TCP y `SktTLSConnect`.
- RFC 8446 y RFC 9846 — requisitos TLS, generación de números aleatorios y recomendaciones de implementación.
