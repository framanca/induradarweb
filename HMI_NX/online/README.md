# WebHMI Online — alternativa con compilador en Supabase

Conserva `HMI_NX`, `HMI_NX_ST` y `HMI_NX/flutter`. Esta versión se publica en una ruta separada, `/HMI_NX_Online/`. El editor usa el mismo modelo, widgets, proyectos `.nxst`, historial y recuperación local. Previsualizar y exportar Sysmac requieren Internet, una sesión de Supabase Auth y autorización expresa del propietario.

## Protección y alcance

El paquete público contiene únicamente `index.html`, estilos, modelo, historial, interfaz, configuración pública y cliente HTTP. **No incluye `st.js`, `zip.js`, `runtime.js` ni `compiler.js`**. El compilador se ejecuta en la Edge Function `webhmi-compile`. No hay alternativa de compilación local ni compilador oculto mediante ofuscación.

La interfaz web siempre puede descargarse. Copiarla o alterar su pantalla de login no permite compilar: el servidor verifica la identidad y el permiso en cada petición. Las cuentas anónimas se rechazan. Los metadatos editables por el usuario no conceden permisos. Revocar autorización impide la siguiente petición, aunque el JWT anterior no haya caducado. Un resultado ya descargado no se puede recuperar remotamente.

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

El servidor limita el cuerpo a 2 MB incluso sin Content-Length, valida la estructura y aplica los límites actuales del editor, incluido HTML de 512 KB. Hay un límite de 20 peticiones por minuto por usuario **por instancia de Edge Function**; no es una cuota global de facturación. Una cuota estricta distribuida requeriría un contador atómico en base de datos.

Las pruebas comprueban autorización, revocación, rechazo anónimo, origen, cuota, tamaño, ausencia de compilador en el paquete web, previsualización y ZIP idéntico al editor actual. La validación del ST en PLC real sigue siendo la que documenta `HMI_NX_ST`; esta separación no constituye una nueva validación de hardware.
