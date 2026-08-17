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

Las tablas de estudios puntuales y seguimiento mensual están en
`assets/config/induradar_pricing_v1.json`. El archivo contiene los tramos RU,
precios estándar, precios piloto, ejemplos y los tipos de servicio que generan
una cuota mensual. Cualquier cambio requiere volver a compilar y desplegar la
web.
