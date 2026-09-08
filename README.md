# InduRadar Web

Landing page pública de InduRadar — Industrial Opportunity Intelligence.

Construida con Flutter Web y desplegada mediante GitHub Pages.

## Desarrollo local

```bash
flutter pub get
flutter run -d chrome \
  --dart-define=LEAD_ENDPOINT='https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead'
```

`LEAD_ENDPOINT` se incorpora en tiempo de compilación. Si no se proporciona, la
web se puede abrir, pero el formulario mostrará un error de configuración y no
simulará un envío correcto.

## Despliegue

El workflow `.github/workflows/deploy-github-pages.yml` construye la web con:

```bash
flutter build web \
  --release \
  --base-href "$BASE_HREF" \
  --dart-define=LEAD_ENDPOINT="${{ secrets.LEAD_ENDPOINT }}"
```

Configura `LEAD_ENDPOINT` en **GitHub → Settings → Secrets and variables →
Actions**. No añadas claves de Supabase, Resend ni otros secretos al frontend.

## Créditos de alcance

La configuración editable está en
`assets/config/induradar_credits_v1.json`. La web muestra créditos estimados,
no euros, y se actualiza al seleccionar sectores, provincias y señales.

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

Cualquier cambio del JSON de créditos requiere volver a compilar y desplegar la
web.

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
