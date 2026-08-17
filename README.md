# InduRadar Web

Landing page inicial de InduRadar construida con Flutter Web y preparada para reutilizar UI y lógica en iOS/Android más adelante.

## Alcance actual

- Página pública sencilla con logo, propuesta de valor y formulario.
- Formulario `cliente_v3` basado en `docs/InduRadar_Formulario_Cliente_v3(1).docx`:
  - tu empresa y tu oferta
  - empresa objetivo
  - señales que deben activar una alerta
  - necesidades y referencias
  - tipo de investigación y seguimiento
  - privacidad y comunicaciones
- Envío por HTTP POST a un endpoint configurable.

## Desarrollo local

Instala dependencias:

```bash
flutter pub get
```

Arranca la web:

```bash
flutter run -d chrome
```

Con endpoint real:

```bash
flutter run -d chrome --dart-define=LEAD_ENDPOINT=https://example.com/form
```

## Payload del formulario

El formulario envía JSON:

```json
{
  "source": "induradar_landing",
  "form_version": "cliente_v3",
  "channel": "web_form",
  "submitted_at": "2026-08-17T12:00:00.000Z",
  "first_name": "Nombre",
  "last_name": "Apellido",
  "full_name": "Nombre Apellido",
  "company": "Empresa S.L.",
  "job_title": "Director comercial",
  "email": "nombre@empresa.com",
  "phone": "+34 600 000 000",
  "website": "https://empresa.com",
  "city_province": "Castellón",
  "offer_description": "Automatización industrial para líneas de envasado",
  "offer": "Automatización industrial para líneas de envasado",
  "offer_categories": ["Tecnología, automatización y software"],
  "problems_solved": [
    "Aumentar productividad o capacidad",
    "Mejorar trazabilidad, control o digitalización"
  ],
  "priority_solutions": "PLC, visión artificial, robótica colaborativa",
  "target_sectors": [
    "Cerámica, vidrio y materiales de construcción",
    "Alimentación y bebidas"
  ],
  "target_company_types": [
    "Fabricante industrial o planta productiva",
    "Fabricante de maquinaria / OEM"
  ],
  "geography_countries": ["España", "Portugal"],
  "geography_regions": ["Comunidad Valenciana"],
  "geography_provinces": ["Castellón", "Valencia"],
  "geography_free_zone": "Radio de 100 km alrededor de Valencia",
  "target_revenue_range": "10-50 M€",
  "target_employee_range": "101-500 empleados",
  "minimum_opportunity_value": "> 25.000 €",
  "target_company_description": "Plantas con ingeniería propia, crecimiento reciente y decisión local.",
  "investment_capacity_signals": [
    "Nueva fábrica, planta, nave o centro",
    "Compra o renovación de maquinaria/equipos"
  ],
  "innovation_product_signals": ["Nuevo proceso productivo"],
  "organization_growth_signals": ["Expansión geográfica / internacional"],
  "public_finance_signals": ["Subvención o ayuda concedida"],
  "signal_types": [
    "Nueva fábrica, planta, nave o centro",
    "Compra o renovación de maquinaria/equipos",
    "Nuevo proceso productivo",
    "Expansión geográfica / internacional",
    "Subvención o ayuda concedida"
  ],
  "commercial_needs": [
    "Problemas de capacidad o productividad",
    "Necesidad de digitalización o trazabilidad"
  ],
  "probable_needs": [
    "Problemas de capacidad o productividad",
    "Necesidad de digitalización o trazabilidad"
  ],
  "opportunity_trigger_description": "Una inversión o ampliación que justifique contacto comercial.",
  "recent_case_description": "Cliente que amplió línea y necesitó automatización.",
  "current_clients": ["Cliente A", "Cliente B"],
  "ideal_clients": ["Empresa similar 1"],
  "watchlist_accounts": ["Cuenta estratégica 1"],
  "competitors": ["Competidor 1 - excluir"],
  "excluded_companies": ["Cliente protegido 1"],
  "no_buy_reason": "Decisión centralizada fuera de España o ticket insuficiente.",
  "service_types": ["Estudio puntual", "Informe mensual"],
  "service_comments": "Primera entrega durante septiembre.",
  "privacy_accepted": true,
  "marketing_consent": false
}
```

Para Formspree suele bastar con configurar `LEAD_ENDPOINT` con la URL del formulario. Para Supabase, lo más limpio es crear una Edge Function pública que reciba este JSON, valide campos, guarde en base de datos y dispare email interno si hace falta.

No llames a Resend directamente desde Flutter Web con una API key privada: cualquier secreto metido en una landing queda visible en el navegador. Si se usa Resend, debe ir detrás de un endpoint propio.

## Build web

```bash
flutter build web --release --base-href / --dart-define=LEAD_ENDPOINT=https://example.com/form
```

El resultado queda en `build/web`.

## GitHub Pages con induradar.com

El workflow `.github/workflows/deploy-github-pages.yml` construye Flutter Web y publica `build/web`.

Pasos:

```bash
git init
git add .
git commit -m "Initial InduRadar landing page"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

En GitHub:

- Crear el repositorio.
- Activar Pages desde GitHub Actions.
- En `Settings > Pages > Custom domain`, configurar `induradar.com`.
- Añadir el secret `LEAD_ENDPOINT`.
- El archivo `web/CNAME` deja documentado el dominio personalizado.
- El workflow compila por defecto con `BASE_HREF=/`, correcto para `https://induradar.com/`.

En DNS:

- Crear cuatro registros `A` para `@` apuntando a GitHub Pages:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Opcionalmente crear registros `AAAA` para IPv6.
- Crear `CNAME` para `www` apuntando al dominio GitHub Pages del propietario del repo, por ejemplo `<usuario>.github.io`.
- Evitar registros wildcard como `*.induradar.com`.
