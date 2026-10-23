# Barreras de seguridad antes de activar HTTPS

El código de fase 0 es deliberadamente **fail-closed**. Hasta completar TODOS estos puntos, la exportación HTTPS seguirá deshabilitada.

1. **Criptografía:** implementar y probar con vectores de referencia HKDF/HMAC/SHA-256, ECDHE, firmas de servidor, AES-GCM o ChaCha20-Poly1305 y verificación completa de etiquetas AEAD. Proteger la ejecución frente a temporización y errores.
2. **Entropía:** fuente verificable de semilla por controlador, derivación CSPRNG conforme a estándares, persistencia que evite reutilización de claves o nonces tras reiniciar, descargar un proyecto de otro controlador o restaurar Retain. NO utilizar `Rand` como aleatoriedad criptográfica.
3. **Handshake TLS:** parser con validación de límites de registros, extensiones, versiones y cifrados, rechazo seguro de opciones desconocidas y mensajes malformados, transcript completo, Finished y control de reintentos. Negociación con navegadores actuales.
4. **Certificados:** validar generación, carga, vigencia, nombres/IP SAN, cadena de confianza y renovación; no almacenar ni publicar claves privadas en GitHub o en ZIP compartidos.
5. **Record layer:** cifrar y autenticar todos los bytes de HTTP de entrada/salida; números de secuencia y nonces no reutilizados; nunca permitir fallback transparente a HTTP.
6. **Integración:** adaptar todas las rutas actuales `/api/read`, `/api/write`, `/api/ack`, recetas, HTML/imágenes y sesiones, sin exponer escritura en texto claro; los interlocks siguen en la lógica de máquina.
7. **Autorización:** acceso por usuario/sesión; protección CSRF y control de escrituras; fijar límites de entrada, tamaño de peticiones y conexiones.
8. **Rendimiento:** medir peor caso de handshake, carga PLC por ciclo, tarea de comunicaciones, varios clientes, reconexión y protección contra denegación de servicio en NX1P2, NX102 y NX5.
9. **Verificación:** pruebas interoperables con navegadores, pruebas de regresión y fuzzing del protocolo, análisis estático del ST, validación en Sysmac y revisión criptográfica independiente.

Arquitectura objetivo: `SktTCPAccept` -> `FB_TLS_Handshake` -> `FB_TLS_Record` -> `WebHMI_HTTP_Dispatch` -> `FB_TLS_Record` -> `SktTCPSend`.

No usar `SktTLSConnect` como "servidor": la instrucción documentada opera en modo cliente. No atribuir a esta carpeta un HTTPS funcional hasta que abra una sesión válida en el navegador sin intermediarios.

Estado actual: sólo comprobación de cabecera TCP/TLS, **sin TLS negociado**.
