# Primera prueba útil en NX102-9000: ejecutar CRIPTOGRAFÍA ST

> No instalar en una máquina en producción. Es una prueba de FB criptográficos, NO HTTPS.

## 1. Obtener paquete ya preparado desde GitHub

Abre el workflow **WebHMI HTTPS ST research checks** de la rama `research/webhmi-https-st`, selecciona la ejecución más reciente que terminó correctamente y descarga el artefacto:

**`WebHMI-NX102-Crypto-Sysmac-Lab-NOT-HTTPS`**.

Contiene seis carpetas de bloques de función con `Body.st`, `Inputs.tsv`, `Outputs.tsv`, `Internals.tsv`, y el programa de prueba `WebHMI_CryptoSelfTest.st` con su tabla de variables.

Si no aparece el artefacto, revisa el estado del job en GitHub Actions.

## 2. Versión de trabajo

CPU: NX102-9000. Para reproducibilidad elegimos firmware/Unit Version **1.64** o posterior y **Sysmac Studio 1.56** o posterior. Omron confirma que Studio 1.56 soporta NX102 unit version 1.64. **No son mínimos demostrados para el servidor HTTPS que todavía falta implementar.** No actualizar firmware de una máquina de producción para esta prueba.

## 3. Crear los FB

En un proyecto Sysmac nuevo, crea los POU **Function Block** de tipo ST en este orden:

1. `FB_WebSHA256`
2. `FB_WebAES128`
3. `FB_WebHMACSHA256`
4. `FB_WebTLS12PRF`
5. `FB_WebAESGCM`
6. `FB_WebTLS12Record`

Para cada uno, coloca `Body.st` como cuerpo de ST y transcribe/pega sus variables como **Inputs**, **Outputs** e **Internals** desde las tablas correspondientes. Verifica que Sysmac haya interpretado tipos `ARRAY`, instancias FB y valores iniciales. El formato de pegado puede depender de versión de Sysmac; estas tablas **no son un archivo de proyecto Sysmac**.

## 4. Crear y ejecutar programa autocontenido de prueba

- Crea un `Program` ST denominado `WebHMI_CryptoSelfTest`.
- Pega `WebHMI_CryptoSelfTest.st` en el cuerpo y sus variables en Internals.
- Asígnalo a una tarea periódica apropiada de **PLC de laboratorio**. Para empezar usa una tarea no crítica, y verifica antes el watchdog y tiempos de ejecución.
- Compila y corrige cualquier error real de tipos o instrucciones antes de transferir.
- En RUN, monitoriza variables del programa hasta finalizar:
  - `WebTest_Done` debe ser **TRUE**.
  - `WebTest_Passed` debe ser **TRUE**.
  - `WebTest_CyclesSHA`, `WebTest_CyclesAES`, `WebTest_CyclesGCM`: número de ejecuciones de tarea; no equivalen automáticamente a milisegundos.
- La prueba verifica SHA-256 de `abc`, un vector AES-128 FIPS 197 y un vector AES-GCM NIST con 16 bytes de texto plano a cero.
- Si `WebTest_Done` no llega a TRUE, observar `WebTest_State`; hay un posible error en el protocolo Execute/Done de los FB.
- Para repetir, activar `WebTest_Reset` al menos un ciclo y devolverlo a FALSE.

## 5. Qué resultados devolver

Captura/listado de errores de compilación (si los hay), versión firmware y Studio, `WebTest_Done`, `WebTest_Passed`, contadores de ciclos y tiempos de tarea máximos. No enviar contraseñas ni claves privadas.

## Puerta de salida

Sólo si la prueba ST funciona y los tiempos de ciclo son aceptables pasamos a G2 (entropía y certificados) y G3 (handshake TLS de servidor). La fase HTTP existente no se modifica. No llamaremos HTTPS a ningún servidor que no complete handshake y proteja datos con AEAD autenticado.
