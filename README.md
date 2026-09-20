# InduRadar Web

Landing pública de InduRadar — Industrial Opportunity Intelligence.

La página publicada es HTML, CSS y JavaScript estáticos para servir el contenido
indexable sin arrancar Flutter. El proyecto Flutter se conserva como base del
futuro portal y app móvil; la versión anterior de la landing está marcada con
la rama `legacy/flutter-landing` y el tag `flutter-landing-2026-09-08`.

## Desarrollo local

```bash
LEAD_ENDPOINT='https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead' \
CONTACT_ENDPOINT='https://<PROJECT_REF>.supabase.co/functions/v1/submit-contact' \
REPORT_ENDPOINT='https://<PROJECT_REF>.supabase.co/functions/v1/get-report' \
  bash scripts/build_static_site.sh build/static
python3 -m http.server 8080 --directory build/static
```

## Portal de clientes

El portal autenticado está disponible en `/portal/`. Su preparación de Auth,
la primera cuenta maestra y la configuración de URLs de recuperación están en
[docs/portal-auth-setup.md](docs/portal-auth-setup.md).

El script genera `build/static`, que es exactamente el directorio publicado.
`LEAD_ENDPOINT`, `CONTACT_ENDPOINT` y `REPORT_ENDPOINT` se inyectan como
configuración pública en tiempo de build. Las URLs de endpoints son visibles en
el navegador y no son secretos; nunca incluyas claves de Supabase, Resend ni
otros secretos.

## Despliegue

El workflow `.github/workflows/deploy-github-pages.yml` publica la landing con:

```bash
LEAD_ENDPOINT="${{ secrets.LEAD_ENDPOINT }}" \
CONTACT_ENDPOINT="${{ secrets.CONTACT_ENDPOINT }}" \
REPORT_ENDPOINT="${{ secrets.REPORT_ENDPOINT }}" \
  bash scripts/build_static_site.sh build/site
```

Configura los tres endpoints en **GitHub → Settings → Secrets and variables →
Actions**. `CONTACT_ENDPOINT` debe apuntar a `submit-contact` y
`REPORT_ENDPOINT` a `get-report`. No añadas claves de Supabase, Resend ni otros
secretos al frontend.

## Identidad y notificación de nuevas solicitudes

Cada `service_request` captura una relación durable con su remitente. Si la
solicitud se crea con sesión iniciada, se conservan el `auth_user_id`,
`account_id`, rol de membresía, `client_request_id`, email autenticado y una
instantánea del contacto enviado en el formulario. La coincidencia entre email
autenticado y email del formulario queda registrada sin sustituir ninguno de los
dos valores.

Las notificaciones administrativas ya no dependen del canal de entrada. Un
trigger común crea una entrada idempotente en
`private.service_request_notification_outbox`; PostgreSQL genera un token de
despacho de un solo uso (solo se conserva su hash) y llama a la Edge Function
`notify-service-request`. La función solo puede reclamar la entrada con ese
token, envía el aviso con Resend y persiste el receipt del proveedor. Los fallos
de correo no revierten la solicitud: quedan pendientes y un cron de base de
datos reintenta de forma acotada. `submit-lead` utiliza este mismo camino y no
mantiene un segundo envío paralelo.

El panel maestro muestra el usuario exacto de `created_by` cuando la solicitud
es autenticada y conserva también el `Submission ID`, de modo que solicitud,
usuario, cuenta e investigación pueden trazarse con identificadores estables.

## Formulario de contacto

El código de la Edge Function está en
`supabase/functions/submit-contact/index.ts`. Valida los campos, limita el
origen a los dominios autorizados y usa un campo trampa para reducir spam. No
guarda datos en Supabase: envía el mensaje a `info@induradar.com` mediante
Resend con el email del usuario como `reply_to`.

Antes de publicar el envío directo, configura en Supabase los secretos privados
`RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` (por defecto,
`info@induradar.com`) y `CONTACT_ALLOWED_ORIGINS` (por ejemplo,
`https://induradar.com,https://www.induradar.com`). Después despliega la
función pública:

```bash
supabase functions deploy submit-contact --no-verify-jwt
```

Hasta que `CONTACT_ENDPOINT` esté configurado en GitHub Pages, la web conserva
el cliente de correo como fallback para no perder consultas.

## Web Report Renderer v1

`site/report/` contiene el visor HTML determinista de informes. Su entrada
sustantiva es exclusivamente el **Report JSON lossless aprobado** de
`report_versions.report_payload` (Report Schema 2.0.0). El navegador no llama a
un modelo de IA, no reinvestiga y no puede añadir ni omitir contenido
sustantivo. Desde el corte del pipeline canónico, la vista web y cualquier
exportación HTML reutilizan exactamente el mismo HTML persistido; no existen
dos renderizadores para los informes nuevos. Los informes anteriores conservan
el visor legado hasta que se actualicen expresamente.

Flujo:

```text
investigación + síntesis una vez
          ↓
Report JSON aprobado e inmutable
          ↓
Web Document cliente-seguro materializado una vez
          ↓
HTML canónico autocontenido materializado una vez
          ↓
get_web_report_html_by_reference_v1
          ↓
Edge Function get-report (JWT obligatorio)
          ↓
el navegador muestra exactamente esos mismos bytes HTML
```

La cartera web usa como colección principal
`portfolio_summary.client_layers.signal_opportunities`, por lo que mantiene
todas las oportunidades cliente signal-ranked y no aplica un top-20. El universo
empresarial se mantiene separado en
`portfolio_summary.client_layers.company_universe`.

### Literatura editorial

La migración `20260915083000_web_report_renderer_v1.sql` permite incluir una
síntesis editorial opcional dentro de cada oportunidad del Report JSON. El
contrato admite, entre otros, `why_now`, `probable_need`, `confirmed_facts`,
`validation_gaps`, `risk_cautions` y `next_action`.

La literatura se genera como máximo una vez durante la construcción del informe,
se valida/persiste antes de congelar hashes y después se reutiliza en todas las
vistas. Si no existe, el renderer utiliza los campos estructurados ya aprobados.
La falta de prosa editorial nunca bloquea un Report JSON ni crea una obligación
de investigación adicional.

Los arrays de transporte usados durante ensamblaje se eliminan tras incrustar la
prosa para no duplicar texto. El esquema conserva exactamente sus 36 raíces.

### Seguridad del visor

`supabase/functions/get-report/index.ts` exige JWT y únicamente invoca el RPC
cliente-seguro `get_web_report_payload_by_reference_v1`. El RPC aplica pertenencia
a la cuenta, gates de informe listo/finalizado, coherencia del payload y
sanitización de contexto interno. La función no usa `service_role` en el
navegador y responde con `Cache-Control: private, no-store`.

El shell estático espera que el futuro portal exponga el token mediante
`window.INDURADAR_AUTH.getAccessToken()` o lo haya almacenado temporalmente como
`induradar_access_token`. No se aceptan tokens en la URL.

### Telemetría de almacenamiento

`get_report_payload_storage_metrics_v1()` mide número de versiones y tamaño
total/medio/p95/máximo de `report_payload`. El Report JSON completo permanece en
PostgreSQL mientras el volumen sea razonable; no se añade un índice GIN sobre la
literatura. Si el histórico creciera hasta justificarlo, las versiones antiguas
podrían archivarse en Object Storage manteniendo metadata, hashes e inventario
en PostgreSQL sin cambiar el contrato del renderer.

## Créditos de alcance

La configuración editable está en
`assets/config/induradar_credits_v1.json`. La landing la carga en tiempo de
ejecución, muestra créditos estimados y se actualiza al seleccionar sectores,
provincias y señales.

```text
Créditos = 50 base + suplemento de provincias
           + suplemento de sectores + suplemento de señales
```

Los 50 créditos incluyen una provincia, un sector y hasta cinco señales. Las
provincias y sectores adicionales se calculan por tramos marginales definidos
en el JSON; entre 6 y 10 señales se suman 5 créditos y con 11 o más, 10. Por
ejemplo, 3 provincias, 3 sectores y 11 o más señales suman 100 créditos.

“Toda España” equivale a 50 provincias. Portugal no añade provincias mientras
el formulario no permita seleccionar distritos portugueses; esta decisión está
documentada en el propio catálogo. Las RU siguen enviándose solo como métrica
interna de complejidad y no intervienen en los créditos.

Todo cambio del JSON requiere volver a desplegar la web para publicar el nuevo
catálogo.

## Contrato de solicitud

El formulario trabaja con el contrato de datos `1.4.1` y Workflow `3.14.0`. Los
sectores, tipos de empresa, señales, tecnologías y áreas de oportunidad se
normalizan a códigos de taxonomía. Los valores visibles y los campos adicionales
se conservan en `request_extensions` y en los campos de compatibilidad del
payload.

La Edge Function `submit-lead` sigue siendo responsable de generar
`submission_id`, guardar `form_payload` y enviar la notificación. La activación
efectiva de la release de investigación no se deduce del repositorio web: la
determina Q0 contra el runtime de Supabase/PostgreSQL.
