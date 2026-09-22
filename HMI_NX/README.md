# HMI NX Designer — preview técnica 0.1

Editor visual web independiente dentro de `induradarweb/HMI_NX`. No cambia el portal, los informes ni la base de datos de InduRadar. No depende de React, CDN, herramientas de compilación ni librerías gráficas externas: DOM/CSS/JavaScript nativos, mismo renderer en preview y exportación.

## Estado real de esta entrega

**Implementado:** lienzo drag & drop, mover/redimensionar objetos, zoom, rejilla, deshacer/rehacer, duplicación, orden de capas, pantallas múltiples, textos, rectángulos, botones, lámparas, visualizadores, entradas numéricas/texto/BOOL, barras, imágenes, visibilidad condicional, parpadeo/rotación básica, variables, recetas y alarmas, simulador, persistencia local, importar/exportar proyecto y ZIP para SD.

**No validado ni incluido:** comunicación con hardware NX102 real; driver del protocolo exacto de `WebServer_NJ_NX` v3.5; FB/ST de servidor; transferencia automática a SD; cuentas/autenticación; proyectos cloud; licencias/pagos; seguridad funcional; alarmas históricas/ACK en PLC; almacenamiento de recetas en SD por el PLC. No se presentan esas piezas como terminadas.

La documentación pública de Omron confirma HTML personalizado desde SD y hasta 100 datos BOOL/DINT/REAL/STRING, pero esto **no documenta ni valida** los endpoints de esta implementación. `nx-http-v1` es nuestro contrato propio, no un protocolo oficial de Omron. La descarga del PDF del protocolo no fue accesible durante esta ejecución; no se inventó un driver compatible.

Referencia del fabricante: https://automation-knowledge-base.omron.eu/support/solutions/articles/103000365996-web-server-for-nj-nx-controller

## Puesta en marcha del editor

El build existente de InduRadar copia estos archivos a `/HMI_NX/`. No se instala un backend ni se cambia la base de datos.

Para servir localmente desde la raíz del repositorio:

```bash
python -m http.server 8080
# Abrir http://localhost:8080/HMI_NX/
```

Usar HTTP(S), no abrir `index.html` con doble clic: el exportador necesita leer sus fuentes para empaquetarlas. Empieza con la demo o `Nuevo → Proyecto vacío`. Los diseños se guardan en IndexedDB y se descargan como `.nxhmi`. Este archivo incluye las imágenes. No se envían diseños a GitHub. Descarga copias: borrar datos del navegador borra su almacenamiento local.

## Variables Sysmac

`Variables → Importar CSV / pegar`: CSV, TSV o filas copiadas de la tabla de variables. Encabezados admitidos: `Name`/`Nombre`, `Data Type`/`Tipo de datos`, `Comment`/`Comentario`. Se acepta `STRING[n]` como STRING en el editor; verificar la longitud real del búfer PLC durante el mapeo. Las importaciones empiezan en solo lectura.

Solo BOOL, DINT, REAL y STRING, hasta 100 variables en V1. Se rechazan duplicados y tipos no soportados sin importar parcialmente. INT, UINT, arrays o estructuras necesitan variables puente explícitas o un futuro adaptador. No se interpreta `.smc2` ni XLSX. Importar nombres **no vincula automáticamente** la memoria del PLC.

## Exportación

`Exportar SD` valida referencias, tipos, rangos, permisos, geometría y recursos. Produce:

```text
SD/index.html                   Runtime autocontenido
project.nxhmi                   Fuente editable del proyecto
Sysmac/variables.csv            Tabla de mapeo orientativa, NO programa ST
Sysmac/transport-contract.json  Contrato HTTP propio
LEEME.txt                       Límites y validación necesaria
```

Se exportan los recursos gráficos embebidos; no hay llamadas a CDN. SVG se rasteriza a PNG al importar para excluir contenido activo. Límite de entrada 4 MB por imagen, dimensión rasterizada máxima 2048 px, 12 MB de recursos por proyecto. No incluye un servidor de ficheros en el PLC.

El perfil de simulación permanece simulación en el exportado. El perfil NX HTTP v1 intentará el contrato siguiente, **solo después de que exista el adaptador**. Con `mismo origen` activado utiliza el origen que sirve la HMI; en la prueba del editor usa la IP configurada.

## Contrato NX HTTP v1 (adaptador pendiente)

Lectura agrupada, una petición no solapada por ciclo:

```http
POST /api/hmi/read
Content-Type: application/json

{"names":["Machine.Running","Process.Setpoint"]}
```

Respuesta:

```json
{"values":{"Machine.Running":true,"Process.Setpoint":55}}
```

Escritura, sin reintentos automáticos:

```http
POST /api/hmi/write
Content-Type: application/json

{"commandId":"session:sequence","atomic":true,"values":{"Process.Setpoint":60}}
```

Confirmación estricta:

```json
{"commandId":"session:sequence","accepted":true,"applied":true}
```

El servidor debe aplicar la lista blanca, tipos/rangos, permisos, autenticación/CSRF apropiados, idempotencia por `commandId`, y atomicidad real del lote. Un conjunto inválido se rechaza completo. HTTP 200 no confirma por sí solo una escritura. Confirmar un parámetro tampoco significa que la máquina haya ejecutado la acción física.

El runtime arranca desarmado. Además del permiso de proyecto hay que habilitar la escritura cada sesión. Datos ausentes, error de comunicación o datos no vigentes bloquean escrituras; no se sustituye el fallo por valores simulados. Un timeout de escritura significa resultado desconocido: verificar el PLC, no reenviar automáticamente. El estado visual se actualiza por lectura, no por eco optimista de la orden.

El periodo mínimo configurable de 100 ms es un objetivo de polling, **no una garantía ni un benchmark del NX**. Medir carga, latencias, pérdida de red y concurrencia con hardware real. No usar el navegador para parada de emergencia, jog mantenido o control determinista. No exponer HTTP del PLC a Internet. El editor HTTPS puede bloquear acceso a NX HTTP; ejecutar desde el propio NX o usar un puente HTTPS autorizado. No desactivar protecciones del navegador.

## Recetas y alarmas

Recetas: conjuntos de valores RW tipados. En simulación se aplican juntos; en real el adaptador debe aplicar o rechazar todo el lote. No se guardan automáticamente recetas desde el PLC en la SD.

Alarmas: condiciones BOOL/umbrales evaluadas con cada lectura completa, incluso fuera de la pantalla de alarmas. Al perder datos no se declaran resueltas. Histórico de hasta 200 eventos y reconocimiento **locales a la sesión del navegador**; no es el ACK del PLC y no se conserva tras recargar.

## Pruebas

```bash
node --test HMI_NX/tests/core.test.cjs
# Opcionales: requieren Python Playwright y Chromium local
CHROMIUM_PATH=/usr/bin/chromium python HMI_NX/tests/browser_smoke.py
CHROMIUM_PATH=/usr/bin/chromium python HMI_NX/tests/transport_browser.py
```

Ejecutadas durante esta entrega: 11 pruebas unitarias; prueba de navegador offline del diseñador, edición, importación, simulador, escritura, recetas, alarmas, navegación, ZIP y HTML exportado; prueba de transporte con respuestas HTTP simuladas (sin solapamiento, permisos, rangos, ACK, pérdida de red, ausencia de variables, desarmado y no reintento).

El navegador del entorno no permite navegar a orígenes, por lo que las pruebas DOM cargan fuentes en memoria y sustituyen `fetch` con fixtures. **No se ha validado la persistencia IndexedDB tras una recarga real de origen, ni acceso de red del navegador al PLC.** Las pruebas no desactivan la política del navegador. Estas limitaciones no deben confundirse con pruebas de campo superadas.

## Siguientes piezas técnicas

Antes de vender o utilizar para operar maquinaria: validar transporte y FB real, integrar mapeo de Sysmac, medir rendimiento y límites de SD, completar pruebas de hardware/fallos, definir modelo de comandos/autorizaciones, y añadir cuentas/aislamiento cloud y licencias con controles de servidor. Un login dibujado en una web estática no proporciona esa protección.
