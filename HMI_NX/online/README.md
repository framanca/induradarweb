# WebHMI Online — alternativa con compilador en Supabase

Conserva `HMI_NX`, `HMI_NX_ST` y `HMI_NX/flutter`. Esta versión se publica en una ruta separada, `/HMI_NX_Online/`. El editor usa el mismo modelo, widgets, proyectos `.nxst`, historial y recuperación local. Previsualizar y exportar Sysmac requieren Internet y una sesión de Supabase Auth. Las cuentas permanentes necesitan autorización expresa del propietario; también existe un modo invitado con una sesión anónima y límites más bajos.

## Protección y alcance

El paquete público contiene únicamente `index.html`, estilos, modelo, historial, interfaz, configuración pública y cliente HTTP. **No incluye `st.js`, `zip.js`, `runtime.js` ni `compiler.js`**. El compilador se ejecuta en la Edge Function `webhmi-compile`. No hay alternativa de compilación local ni compilador oculto mediante ofuscación.

La interfaz web siempre puede descargarse. Copiarla o alterar su pantalla de login no permite compilar: el servidor exige un JWT válido en cada petición. Las cuentas permanentes necesitan `app_metadata.webhmi_compile=true`; las sesiones anónimas creadas por el botón «Entrar como invitado» forman un nivel de acceso explícito y limitado. Los metadatos editables por el usuario no conceden permisos. Revocar autorización impide la siguiente petición, aunque el JWT anterior no haya caducado. Un resultado ya descargado no se puede recuperar remotamente.

**Limitación durante la coexistencia:** el repositorio `framanca/induradarweb` es público y las versiones anteriores incluyen el compilador local. La app Flutter offline también lo incorpora, porque necesita compilar sin servidor. Por tanto, conservarlas públicas deja disponible ese código. Esta alternativa protege el uso de su servicio online, pero no impide utilizar la copia antigua. Para proteger una futura evolución, el repositorio del backend y los nuevos algoritmos deberán ser privados y habrá que decidir qué versiones se siguen distribuyendo. No se cambia la visibilidad ni se retira ningún formato en esta entrega.

## Autorizar y revocar cuentas

Reutiliza el proyecto Supabase InduRadar. No permite autorregistrarse desde el editor. Invita o crea las cuentas desde Auth en Supabase. El propietario debe indicar las cuentas que desea autorizar; no se concede acceso automáticamente a todos los usuarios existentes.

Desde SQL Editor, como administrador, usa el correo exacto de la cuenta que hayas elegido:

```sql
-- Autorizar. Este permiso pertenece a app_metadata, nunca a user_metadata.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"webhmi_compile":true}'::jsonb
where email = 'CUENTA_AUTORIZADA';

-- Revocar antes de la siguiente compilación.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"webhmi_compile":false}'::jsonb
where email = 'CUENTA_AUTORIZADA';
```

No cambies otras autorizaciones del portal. El cliente utiliza únicamente una clave publishable, que es pública por diseño. Las claves administrativas nunca se publican. La función usa `getUser` a través de la API Auth y su clave de servidor de entorno; no confía en decodificar un JWT sin verificarlo. `verify_jwt=true` añade la comprobación de la plataforma.

## Desarrollo y despliegue

Desde la raíz del repositorio:

```sh
python3 HMI_NX/online/tool/build.py
node --test HMI_NX/online/test/*.test.cjs
```

El generador adapta una copia de la interfaz y copia el compilador **solo a la carpeta backend**. Sus anclas fallan explícitamente si cambia el editor y exige revisar la separación. La ruta pública se incorpora al constructor del sitio como carpeta adicional. El constructor copia solo `public/`; nunca copia `server/` ni `supabase/`.

La Edge Function se despliega con todos sus archivos relativos. Desde `HMI_NX/online`, comprueba `supabase functions deploy --help` con tu CLI instalada y despliega `webhmi-compile` en el proyecto `gwmwkxvrgctglyjmlqnb`. No desactives la verificación JWT. Después de cambiar el editor, regenera y vuelve a desplegar el backend junto con el cliente. Comprueba que una petición sin sesión recibe 401 y una cuenta sin permiso recibe 403.

Los orígenes autorizados son `https://induradar.com` y `https://www.induradar.com`. CORS es una restricción del navegador; la protección real es el permiso comprobado en el servidor. Para un dominio de pruebas, modifica explícitamente la lista del backend y vuelve a desplegarlo.

## Datos y límites

Los proyectos y las copias continúan guardándose localmente en el navegador bajo un espacio de almacenamiento distinto al de la web antigua. El login no guarda credenciales ni tokens en localStorage: al recargar se vuelve a iniciar sesión. El proyecto se envía a Supabase al previsualizar/exportar, no se crea una base de proyectos ni se registra el contenido en los logs. El código no crea tablas, políticas RLS ni migraciones.

El servidor limita el cuerpo a 2 MB incluso sin Content-Length, valida la estructura y aplica los límites actuales del editor, incluido HTML de 512 KB. Hay un límite de 20 peticiones por minuto para cuentas autorizadas y 10 para invitados **por instancia de Edge Function**; no es una cuota global de facturación. Una cuota estricta distribuida requeriría un contador atómico en base de datos.

Las pruebas comprueban autorización, revocación, acceso anónimo controlado, origen, cuotas separadas, tamaño, ausencia de compilador en el paquete web, previsualización y ZIP idéntico al editor actual. La validación del ST en PLC real sigue siendo la que documenta `HMI_NX_ST`; esta separación no constituye una nueva validación de hardware.


## Modo invitado

El botón **Entrar como invitado** crea una sesión anónima de Supabase Auth. No solicita correo ni contraseña, no expone el compilador y continúa usando la Edge Function con `verify_jwt=true`. Cada invitado recibe un `user_id` propio; las compilaciones se registran en `webhmi_compilation_audit.user_id`, lo que permite separar actividad invitada de cuentas permanentes. Si el uso público crece, conviene añadir CAPTCHA/Turnstile para mitigar abuso.

## Auditoría de sesiones y exportación a Sysmac

La petición autenticada **access**, que ejecutan tanto **Entrar** como **Entrar como invitado**, registra un evento en **public.webhmi_access_audit** cuando se concede acceso; no es necesario descargar ningún proyecto. Queda registrado un evento por entrada correcta (no por cada clic dentro del editor ni por cada refresco de token).

La petición de exportación **compile** / **compile-lite** registra un evento en **public.webhmi_compilation_audit**, con:
- Fecha y hora UTC, IP observada por el servidor (si está disponible), ID del usuario, tipo invitado/registrado, éxito/error, código HTTP y versión.
- Nombre, huella SHA-256 del proyecto enviado, tamaño JSON, número de pantallas, número de variables, y modalidad normal / Extra Light.
- El registro se produce **al solicitar Exportar Sysmac**, no al usar Vista previa o al consultar el tamaño.

Solo se guardan **metadatos**. No se guarda el contenido del proyecto, el ST, las imágenes ni el ZIP generado en la base de datos; la huella permite saber si dos exportaciones corresponden al mismo JSON. El servidor no puede confirmar que el navegador haya terminado de guardar el archivo. Si la auditoría falla, la función devuelve un error antes de entregar una exportación o confirmar un acceso exitoso.

Las dos tablas mantienen RLS activado y no están disponibles al navegador (ni para invitados ni para usuarios autenticados). Solo el servidor escribe con su clave privada. No se ponen credenciales ni tokens en la auditoría.

Consultas orientativas para el propietario desde SQL Editor de Supabase (zona horaria Madrid):

```sql
select a.created_at at time zone 'Europe/Madrid' as fecha,
       a.user_type, u.email, host(a.ip) as ip, a.result
from public.webhmi_access_audit a
left join auth.users u on u.id=a.user_id
order by a.created_at desc limit 100;

select c.created_at at time zone 'Europe/Madrid' as fecha,
       c.project_name, c.project_sha256, c.export_variant,
       c.project_screen_count, c.project_variable_count, c.project_bytes,
       c.user_type, u.email, host(c.ip) as ip, c.result, c.version
from public.webhmi_compilation_audit c
left join auth.users u on u.id=c.user_id
order by c.created_at desc limit 100;
```

**Privacidad:** una IP es un dato personal. Es necesario informar de la finalidad, base jurídica y periodo de conservación en la política de privacidad; sugerencia operativa: anonimizar IPs después de 90 días, conservando estadísticas agregadas. Las IPs pueden ser nulas y no prueban la identidad física de la persona (VPN, NAT o proxies).
