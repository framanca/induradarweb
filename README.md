# InduRadar Web

Landing pública de InduRadar — Industrial Opportunity Intelligence.

La página publicada es HTML, CSS y JavaScript estáticos para servir el contenido
indexable sin arrancar Flutter. El proyecto Flutter se conserva como base del
futuro portal y app móvil; la versión anterior de la landing está marcada con
la rama `legacy/flutter-landing` y el tag `flutter-landing-2026-09-08`.

## Desarrollo local

```bash
LEAD_ENDPOINT='https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead' \
  bash scripts/build_static_site.sh build/static
python3 -m http.server 8080 --directory build/static
```

El script genera `build/static`, que es exactamente el directorio publicado.
`LEAD_ENDPOINT` se inyecta como configuración pública en tiempo de build. Si
no se proporciona, la landing abre pero el formulario informa de que falta la
configuración y no simula un envío correcto. La URL del endpoint es visible en
el navegador y no es un secreto; nunca incluyas claves de Supabase o Resend.

## Despliegue

El workflow `.github/workflows/deploy-github-pages.yml` publica la landing con:

```bash
LEAD_ENDPOINT="${{ secrets.LEAD_ENDPOINT }}" \
  bash scripts/build_static_site.sh build/site
```

Configura `LEAD_ENDPOINT` en **GitHub → Settings → Secrets and variables →
Actions**. No añadas claves de Supabase, Resend ni otros secretos al frontend.

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
