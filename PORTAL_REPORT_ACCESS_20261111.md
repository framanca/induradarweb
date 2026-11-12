El visor autenticado devolvía «El informe no está disponible o tu cuenta no tiene
acceso» al abrir `IR-20261110-9D3D01`. La cuenta `framanca@outlook.com` ya era
administradora global y podía listar los 41 informes aprobados disponibles.
No faltaba asignarle un rol ni trasladarle los informes de otros clientes.

La causa era la preparación de la caché HTML en funciones declaradas `STABLE`.
PostgREST ejecutaba el RPC en una transacción de solo lectura y la creación del
HTML fallaba con SQLSTATE `25006`. Además, el lector interno conservaba el
snapshot inicial y no veía la caché recién creada en la misma llamada. La Edge
Function convertía el error del RPC en el mensaje genérico de acceso.

Las dos migraciones nuevas declaran `VOLATILE` el lector y sus dos entradas
públicas. El RPC usado por el portal tiene un timeout acotado de 45 segundos.
Las guardas comprueban que se conservan cuerpos, propietarios, ACL, controles de
cuenta/publicación y fingerprint del kernel. No se cambian RLS, memberships,
registros de administradores ni timeouts globales. La identidad administradora
sigue teniendo acceso global mediante el registro existente; no depende de una
lista manual de informes o cuentas.

Las versiones de los archivos coinciden con el historial realmente aplicado en
Supabase: `20261111200229` y `20261111200401`. Los nombres inicialmente generados
por el CLI eran `20261111200024` y `20261111200328`; solo se alinearon los nombres
de estos archivos nuevos, sin reescribir migraciones históricas.

Verificación:

- La regresión nativa de `test/report_html_delivery_regression.sql` prueba caché
  vacía, reutilización del mismo HTML, los 41 informes visibles al administrador,
  denegación a otro cliente, aislamiento del listado normal y resistencia a un
  `user_metadata` que declare falsamente el rol admin. Se ejecuta con rollback;
  conserva el Report JSON, los hashes y el fingerprint aceptado.
- Dos llamadas reales al portal devolvieron HTTP 200. En Firefox, con la sesión
  de `framanca@outlook.com`, se observaron el resumen, 9 oportunidades, 27 empresas
  y 35 señales. No se leyó ni exportó el token de la sesión.
- Q0 pasó antes y después con los 14 documentos exactos. Pasaron 39 tests Node,
  32 tests Flutter, `flutter analyze lib test` y las migraciones en rollback local.
  El análisis de todo el repositorio encuentra 26 errores de dependencias en el
  subproyecto HMI_NX/flutter, ajeno a este cambio; no se han cambiado archivos Dart.
- Advisors: cero hallazgos nuevos frente al estado anterior; salud sin incidencias.
  Se mantienen los avisos existentes, incluidas las funciones autenticadas que
  verifican autorización en su cuerpo.

La evidencia resumida está en `PORTAL_REPORT_ACCESS_20261111.json`. El Report JSON
canónico no cambia y el contador sigue en 182 búsquedas. No se activa el daemon.

Referencias técnicas: [snapshots de funciones PostgreSQL](https://www.postgresql.org/docs/current/xfunc-volatility.html)
y [modo de transacción de RPC en PostgREST](https://docs.postgrest.org/en/stable/references/transactions.html#access-mode-on-functions).
