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
  bash scripts/build_static_site.sh build/static
python3 -m http.server 8080 --directory build/static
```

El script genera `build/static`, que es exactamente el directorio publicado.
`LEAD_ENDPOINT` y `CONTACT_ENDPOINT` se inyectan como configuración pública en
tiempo de build. Las URLs de endpoints son visibles en el navegador y no son
secretos; nunca incluyas claves de Supabase o Resend.

## Despliegue

El workflow `.github/workflows/deploy-github-pages.yml` publica la landing con:

```bash
LEAD_ENDPOINT="${{ secrets.LEAD_ENDPOINT }}" \
CONTACT_ENDPOINT="${{ secrets.CONTACT_ENDPOINT }}" \
  bash scripts/build_static_site.sh build/site
```

Configura `LEAD_ENDPOINT` y `CONTACT_ENDPOINT` en **GitHub → Settings →
Secrets and variables → Actions**. `CONTACT_ENDPOINT` debe ser
`https://<PROJECT_REF>.supabase.co/functions/v1/submit-contact`. No añadas
claves de Supabase, Resend ni otros secretos al frontend.

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

El proyecto no incluye Supabase CLI ni credenciales de despliegue. Hasta que
`CONTACT_ENDPOINT` esté configurado en GitHub Pages, la web conserva el cliente
de correo como fallback para no perder consultas.

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

El formulario envía a la Edge Function la estructura canónica del contrato de
datos `1.3.2` y la configuración operativa `3.13.1`. Los sectores, tipos de
empresa, señales, tecnologías y áreas de oportunidad se normalizan a códigos de
taxonomía. Los valores visibles y los campos adicionales se conservan en
`request_extensions` y en los campos de compatibilidad del payload.

La Edge Function `submit-lead` sigue siendo responsable de generar
`submission_id`, guardar `form_payload` y enviar la notificación. Si su lógica
normaliza también la columna `service_requests.contract_version`, debe tomar el
valor superior `contract_version = 1.3.2`; en cualquier caso, la versión queda
guardada dentro del JSON completo.
