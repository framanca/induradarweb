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

## Tarifas

La configuración editable está en
`assets/config/induradar_pricing_v2.json`. El precio depende únicamente del
número de sectores (`S`) y provincias españolas (`P`) seleccionados:

```text
A(n) = 0                                         si n <= 3
A(n) = 5 * min(n - 3, 4) + 2,5 * max(n - 7, 0) si n > 3

Estudio puntual = 99 + A(S) + A(P)
Revisión mensual = 30 + 0,5 * [A(S) + A(P)]
Revisión semanal = 50 + 0,5 * [A(S) + A(P)]
```

Durante el piloto se aplica un 50 % al precio final. Las revisiones son cuotas
mensuales y requieren un estudio puntual previo activo del mismo alcance. “Toda
España” equivale a 50 provincias. Portugal se conserva como alcance nacional,
pero no añade provincias españolas a `P`. Las RU siguen enviándose únicamente
como métrica interna de complejidad y no intervienen en el precio.

Cualquier cambio del JSON de precios requiere volver a compilar y desplegar la
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
