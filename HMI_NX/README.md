# HMI NX Designer 0.2 — ampliación de ingeniería

Editor web y runtime en `HMI_NX/`, aislados de InduRadar. JavaScript/HTML/CSS nativos, sin CDN ni dependencias de compilación. **Los roles son únicamente de operación de máquina. No hay cuentas ni permisos del editor. Sin multidriver ni gráficos de tendencias.**

## Estado real: qué se entrega y qué falta

El editor ampliado, el runtime, la exportación y un servicio de referencia ejecutable están implementados y probados. **No se incluye un FB HTTP compilado para NX102 ni un driver verificado de WebServer_NJ_NX v3.5.** La integración de transporte, identidad, almacenamiento SD y lógica de control en hardware NX102 sigue pendiente. Copiar el HTML e indicar una IP no conecta esa integración.

El runtime exige un servicio que implemente el contrato propio `nx-http-v2`. Bloquea la operación si no coinciden protocolo, proyecto, política y capacidades; no degrada permisos a un simple login de navegador. El banco Node.js incluido solo verifica ese contrato con variables ficticias, sesiones reales y archivos privados. **No es un programa ejecutable en NX ni se impone un gateway adicional para producción.**

La ficha de Omron confirma HTML personalizado desde SD, pero no acredita nuestra API ni los servicios añadidos: https://automation-knowledge-base.omron.eu/support/solutions/articles/103000365996-web-server-for-nj-nx-controller . El PDF/SLR adjunto no se pudo recuperar durante esta ejecución. No se ha inventado compatibilidad.

## Funcionalidad implementada

- Pantallas, maestras, pop-ups y faceplates parametrizados con variables tipadas. Una maestra por pantalla y hasta tres pop-ups; sin anidamiento de pop-ups.
- Textos, figuras, imágenes, botones, entradas numéricas/texto/BOOL y teclado virtual, interruptores, selectores, sliders, barras/niveles, pilotos, usuario, reloj, navegación, alarmas, recetas y operaciones.
- Símbolos SVG propios: motor, bomba, válvula, cilindro, depósito, sensor y transportador. Reglas de color, visibilidad, posición, giro, tamaño, texto y flujo. SVG importados se rasterizan a PNG, no ejecutan contenido activo.
- Multiselección, copiar/pegar, duplicar, grupos, alineación, distribución, bloqueo de posición, capas, zoom/rejilla y deshacer/rehacer.
- Variables Sysmac por CSV, TSV o portapapeles. BOOL/DINT/REAL/STRING, hasta 100 tags; longitud STRING declarada 1–255, acceso, unidades, rangos, frecuencia y tags globales. No se abre `.smc2` ni XLSX; se rechazan tipos no soportados. Los nombres no enlazan por sí solos la memoria del PLC.
- Un gestor de lecturas agrupa dependencias de pantalla, maestra y pop-ups, filtra elementos según el rol y evita peticiones solapadas. Las escrituras van por una cola prioritaria con identificación y resultado, sin reintentos automáticos de órdenes desconocidas.
- Usuarios de operación: roles por elemento, condiciones de habilitación, confirmación, sesión/inactividad, permisos separados de recetas y alarmas. Administración de cuentas y cambio de contraseña a través de un servicio compatible. Las claves nunca se guardan en el proyecto.
- Recetas guardadas/editadas/activas diferenciadas, edición/importación/exportación, duplicación, aplicación por lote con versión y control de conflictos. El servicio independiente decide los campos permitidos y valida/aplica todo el lote.
- Alarmas con códigos, prioridades, histéresis, retardos y apariciones identificadas. Banner, filtros, recuperación por cursor/instantánea y retención. ACK, silencio y reset son acciones diferentes. No se detectan exclusivamente en una pantalla ni se borran por perder comunicación.
- Registro de operaciones HMI con identidad, antes/solicitud/resultado y fecha. CSV y XLSX de alarmas y operaciones retenidas; Excel usa valores literales, no fórmulas introducidas por textos. No es auditoría de cambios realizados desde Sysmac ni certificación regulatoria.
- Dos exportaciones: HTML único autocontenido o runtime común y pantallas/imágenes bajo demanda, con carpeta versionada y verificación SHA-256 de vistas. Ambas conservan lecturas selectivas.

Los históricos de producción periódicos y su muestreador no se añaden en esta fase; no hay tendencias. El servicio reserva un campo de producción para una futura integración, sin presentarlo como función completada.

## Uso

La publicación existente copia solo los archivos estáticos a `/HMI_NX/`. Para servir el editor en local desde la raíz del repositorio:

```bash
python -m http.server 8080
# http://localhost:8080/HMI_NX/
```

Abrir sobre HTTP(S), no `file://`, porque el exportador carga sus fuentes locales para empaquetarlas. Empieza con la demo; pulsa **Simular → Identificarse**, elige un rol y habilita escrituras. Observador no tiene permiso para los controles de operación predeterminados. La elección de rol simulada no es autenticación de producción. El panel de inyección de valores es una fuente ficticia, no un comando de operador.

En el diseñador se configuran roles, no contraseñas. Las cuentas reales pertenecen al servicio de máquina y a su política instalada. Modificar el proyecto/HTML no modifica esa política. El permiso `manageUsers` administra usuarios de la máquina, nunca el acceso a proyectos.

Guarda `.nxhmi` como copia. IndexedDB mantiene proyectos en este dispositivo; el navegador puede borrar ese almacenamiento. La migración de v1 conserva un registro separado del original; si IndexedDB no está disponible, intenta descargar la copia original antes de migrar. No hay sincronización cloud.

## Exportación y actualización de SD

```text
SD/index.html
SD/builds/<buildId>/runtime.js       Solo modo split
SD/builds/<buildId>/style.css
SD/builds/<buildId>/views/*.json
SD/builds/<buildId>/assets/*
Engineering/operation-policy.json   Propuesta para instalación autorizada, NO directorio web
Engineering/transport-contract.json
Engineering/manifest.json
Sysmac/variables.csv                Tabla orientativa, NO programa ST
project.nxhmi
LEEME.txt
```

En split se descargan pantalla activa y maestra; las otras vistas e imágenes se solicitan al utilizarlas. Caché de vistas limitada a ocho, salvo activas. Se sube primero la carpeta de build y se sustituye `index.html` al final. Mantener el build anterior para sesiones abiertas/rollback. No sobrescribir recetas, credenciales o registros operativos al actualizar recursos gráficos.

La huella verifica consistencia, no sustituye HTTPS ni una firma/autorización de despliegue. Engineering y los archivos privados del servidor jamás deben publicarse en Pages ni dentro de la carpeta SD web.

## Sesiones y seguridad operacional

El servicio instalado valida identidad, roles, elemento, destino, valor, condición y revisión; no acepta un rol o política nuevos porque los envíe el navegador. Los pulsos de máquina deben resolverse en tareas PLC; el banco solo los modela. No hay jog mantenido, emergencia ni seguridad funcional.

Las escrituras se desarman al cerrar sesión, caducar, perder conexión o no conocer el resultado. La pantalla muestra estados leídos, no un eco optimista de una orden. Se puede consultar el resultado pendiente; nunca se reenvía automáticamente. Un resultado perdido por la retención se informa como desconocido y exige comprobar el equipo.

Credenciales reales requieren HTTPS, excepto el banco loopback local. La SD servida mediante HTTP no aporta cifrado. No expongas el PLC a Internet ni desactives restricciones del navegador. Antes de producción hay que resolver y validar la protección del transporte y los servicios NX.

El servicio de referencia guarda contraseñas con scrypt, identidades fuera del directorio público, registros acotados y archivos mediante escritura temporal/sincronización/renombrado. No convierte un registro local en auditoría inmutable o conforme a una normativa. Ver `server/README.md` y `plc/INTEGRATION.md`.

## Pruebas reproducibles

```bash
node --test HMI_NX/tests/*.test.cjs
# Chromium + Python Playwright instalados; fixtures sin navegación de origen:
HMI_TEST_PHASE=runtime python HMI_NX/tests/browser_smoke.py
HMI_TEST_PHASE=editor  python HMI_NX/tests/browser_smoke.py
HMI_TEST_PHASE=export  python HMI_NX/tests/browser_smoke.py
python HMI_NX/tests/transport_browser.py
```

La suite Node prueba modelo/migración, autorización independiente, recetas atómicas, versiones y concurrencia, sesiones, alarmas, fallos de persistencia, exportación y un servidor HTTP real en loopback. Las pruebas de navegador ejercitan DOM, simulación y exportados con `fetch` controlado.

**Límite del entorno:** Chromium bloquea navegación a orígenes con `ERR_BLOCKED_BY_ADMINISTRATOR`. No se desactivó esa política. Por ello no está comprobada la persistencia IndexedDB después de recargar un origen real, ni la red LAN desde el navegador. Las pruebas Node loopback no prueban Ethernet/SD/NX102. Véase `tests/RESULTS.json` para la ejecución de esta entrega.
