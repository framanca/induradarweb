import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteDir = path.join(root, 'site');
const published = '2026-09-12';
const publishedLabel = '12 de septiembre de 2026';
const baseUrl = 'https://induradar.com';
const publisherLogo = `${baseUrl}/assets/InduRadarLogoVertical-600.webp`;

const cta = {
  title: 'Quieres saber que empresas encajan con tu mercado y cuales muestran senales de oportunidad',
  copy: 'InduRadar combina descubrimiento de empresas, fuentes publicas y senales industriales para convertir un mercado amplio en una cartera comercial mas util y accionable.',
};

const visuals = {
  chain: {
    file: 'visual-cadena-evidencia.svg',
    alt: 'Cadena Fuente, Evidencia, Senal, Proyecto y Oportunidad',
  },
  timeline: {
    file: 'visual-linea-tiempo-inversion.svg',
    alt: 'Linea temporal de una inversion industrial desde senal temprana hasta operacion',
  },
  layers: {
    file: 'visual-universo-senales-oportunidades.svg',
    alt: 'Capas de universo de empresas, empresas con senales y oportunidades accionables',
  },
  matrix: {
    file: 'visual-matriz-senal-necesidad.svg',
    alt: 'Matriz entre senales industriales y necesidades comerciales plausibles',
  },
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(relativePath, content) {
  const filePath = path.join(siteDir, relativePath);
  ensureDir(filePath);
  fs.writeFileSync(filePath, content);
}

function slugToPath(slug) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function metaEscape(value) {
  return htmlEscape(value).replaceAll('\n', ' ');
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function paragraph(text) {
  return `<p>${text}</p>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function numbered(items) {
  return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
}

function section(title, body, id = '') {
  const attr = id ? ` id="${id}"` : '';
  return `<section${attr}><h2>${title}</h2>${body}</section>`;
}

function note(title, copy, link = null) {
  const linkHtml = link ? `<p><a href="${link.href}">${link.label}</a></p>` : '';
  return `<aside class="article-link"><strong>${title}</strong><p>${copy}</p>${linkHtml}</aside>`;
}

function visualBlock(visual) {
  if (!visual) return '';
  return `<figure class="article-visual"><img src="${assetPath(visual.file)}" width="1200" height="630" alt="${visual.alt}" loading="lazy"><figcaption>${visual.alt}</figcaption></figure>`;
}

function assetPath(file) {
  return file.startsWith('../') ? file : `${relativePrefix(currentDepth) || './'}assets/${file}`;
}

let currentDepth = 0;
let currentPageCta = null;
function relativePrefix(depth) {
  if (depth === 0) return '';
  return '../'.repeat(depth);
}

function layout(page) {
  const slug = page.slug.replace(/^\/?/, '/').replace(/\/?$/, '/');
  const depth = slugToPath(slug).split('/').filter(Boolean).length;
  currentDepth = depth;
  currentPageCta = page.cta || null;
  const prefix = relativePrefix(depth);
  const canonical = `${baseUrl}${slug}`;
  const ogImage = page.visual ? `${baseUrl}/assets/${page.visual.file}` : `${baseUrl}/assets/InduRadarLogoVertical-600.webp`;
  const type = page.type || 'Article';
  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: page.schemaHeadline || stripHtml(page.h1),
    name: page.schemaHeadline || stripHtml(page.h1),
    description: page.description,
    image: ogImage,
    datePublished: page.datePublished || published,
    dateModified: page.dateModified || published,
    inLanguage: 'es-ES',
    mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: 'InduRadar' },
    publisher: {
      '@type': 'Organization',
      name: 'InduRadar',
      logo: { '@type': 'ImageObject', url: publisherLogo },
    },
  };
  if (type === 'WebPage') {
    delete schema.headline;
    delete schema.datePublished;
  }
  const breadcrumbs = [
    { name: 'Inicio', item: `${baseUrl}/` },
    ...page.breadcrumbs.map((crumb) => ({
      name: crumb.name,
      item: crumb.href.startsWith('http') ? crumb.href : `${baseUrl}${crumb.href}`,
    })),
  ];
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
  const breadcrumbHtml = breadcrumbs
    .map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const href = crumb.item.replace(baseUrl, '') || '/';
      return `<li${isLast ? ' aria-current="page"' : ''}>${isLast ? htmlEscape(crumb.name) : `<a href="${prefix}${href.replace(/^\//, '')}">${htmlEscape(crumb.name)}</a>`}</li>`;
    })
    .join('');
  const related = relatedBlock(page.related || []);
  const author = page.showAuthor === false ? '' : '<p class="article-author"><strong>Publicado por InduRadar</strong><span>Inteligencia comercial aplicada a mercados industriales.</span></p>';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${metaEscape(page.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" sizes="48x48" href="${baseUrl}/favicon.png">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="InduRadar">
  <meta property="og:title" content="${metaEscape(page.title)}">
  <meta property="og:description" content="${metaEscape(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="${type === 'Article' ? 'article' : 'website'}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:alt" content="${metaEscape(page.visual?.alt || 'InduRadar')}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${metaEscape(page.title)}">
  <meta name="twitter:description" content="${metaEscape(page.description)}">
  <meta name="twitter:image" content="${ogImage}">
  <title>${htmlEscape(page.title)}</title>
  <link rel="stylesheet" href="${prefix}styles.css">
  <link rel="stylesheet" href="${prefix}recursos/styles.css">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
</head>
<body>
  <a class="skip-link" href="#article">Ir al contenido</a>
  <header class="resource-header">
    <div class="resource-header__inner">
      <a class="resource-brand" href="${prefix}" aria-label="InduRadar, inicio"><img src="${prefix}assets/InduRadarLogoVertical-128.webp" width="48" height="38" alt="InduRadar"><span>Industrial Opportunity Intelligence</span></a>
      <nav class="resource-nav" aria-label="Navegacion principal"><a href="${prefix}recursos/">Recursos</a><a href="${prefix}como-funciona-induradar/">Como funciona</a><a class="resource-nav__cta" href="${prefix}#formulario">Solicitar un analisis</a></nav>
    </div>
  </header>
  <main>
    <section class="resource-hero" aria-labelledby="article-title">
      <div class="resource-hero__inner">
        <ol class="breadcrumb" aria-label="Migas de pan">${breadcrumbHtml}</ol>
        <p class="eyebrow">${htmlEscape(page.eyebrow || 'Inteligencia comercial industrial')}</p>
        <h1 id="article-title">${page.h1}</h1>
        <p class="lead">${page.lead}</p>
        ${type === 'Article' ? `<div class="article-meta"><span>Por InduRadar</span><time datetime="${page.datePublished || published}">${publishedLabel}</time><span>Lectura: ${page.reading || '5 min'}</span></div>` : ''}
      </div>
    </section>
    <article id="article" class="article">
      ${author}
      ${visualBlock(page.visual)}
      ${page.body}
      ${related}
      ${ctaBlock(prefix)}
    </article>
  </main>
  <footer class="resource-footer"><div class="resource-footer__inner"><span>InduRadar · Inteligencia comercial industrial</span><a href="${prefix}#formulario">Solicitar un analisis</a></div></footer>
</body>
</html>
`;
}

function ctaBlock(prefix) {
  const title = currentPageCta?.title || cta.title;
  const copy = currentPageCta?.copy || cta.copy;
  return `<aside class="article-cta-box"><h2>${title}</h2><p>${copy}</p><div class="article-cta-actions"><a class="article-cta" href="${prefix}#formulario">Solicitar un análisis</a><a class="article-cta article-cta--secondary" href="${prefix}como-funciona-induradar/">Cómo funciona InduRadar</a></div></aside>`;
}

function relatedBlock(items) {
  if (!items.length) return '';
  return `<aside class="next-reading"><h2>Siguiente lectura</h2><ul>${items.map((item) => `<li><a href="${item.href}">${item.label}</a></li>`).join('')}</ul></aside>`;
}

function writePage(page) {
  const slug = slugToPath(page.slug);
  writeFile(`${slug}/index.html`, layout(page));
}

function cards(items) {
  return `<div class="resource-grid">${items.map((item) => `<article class="resource-card"><p class="eyebrow">${item.eyebrow || 'Guia'}</p><h2>${item.title}</h2><p>${item.copy}</p><a class="resource-card__link" href="${item.href}">${item.link || item.title}</a></article>`).join('')}</div>`;
}

function writeHub() {
  const prefix = '../';
  currentDepth = 1;
  const categories = [
    {
      title: 'Descubrir empresas',
      intro: 'Metodos para construir universos de empresas industriales cuando una base generica no basta.',
      items: [
        ['Nichos industriales especificos', 'como-encontrar-empresas-industriales-nicho-especifico/', 'Como construir un universo por actividad, proceso, ferias, asociaciones y relaciones industriales.'],
        ['Nuevas empresas por CNAE', 'nuevas-empresas-por-cnae/', 'Como combinar CNAE, registros, geografia y validacion de actividad real.'],
        ['Camaras de Comercio', 'camaras-comercio-encontrar-clientes/', 'Como usar censos, directorios y redes territoriales para descubrir empresas.'],
        ['Empresas por proceso industrial', 'buscar-empresas-por-proceso-industrial/', 'Como buscar por inyeccion, extrusion, mecanizado, impresion o paletizado.'],
        ['Fabricantes de maquinaria, OEM e integradores', 'encontrar-fabricantes-maquinaria-oem-integradores/', 'Metodos para descubrir fabricantes e integradores por sector, proceso, feria y capacidad tecnica.'],
        ['Nuevos clientes industriales', 'como-encontrar-nuevos-clientes-industriales/', 'Alternativas a una base generica para encontrar y priorizar cuentas industriales.'],
      ],
    },
    {
      title: 'Detectar senales',
      intro: 'Guias para interpretar cambios publicos antes de que una oportunidad sea evidente.',
      items: [
        ['Senales de inversion industrial', 'senales-empresa-industrial-va-a-invertir/', 'Permisos, ayudas, empleo, suelo, nuevas lineas y combinaciones de senales.'],
        ['Oportunidades a partir de senales', 'senales-oportunidades-negocio-industrial/', 'Como una senal cambia la prioridad comercial de una empresa.'],
        ['Detectar inversiones industriales', 'como-detectar-inversiones-industriales/', 'Senales publicas para descubrir nuevas fabricas, ampliaciones, lineas y modernizaciones.'],
        ['Senales de ampliacion industrial', 'senales-que-anticipan-una-ampliacion-industrial/', 'Permisos, ayudas, obra, contratacion tecnica y otros indicios de aumento de capacidad.'],
        ['Ampliaciones de fabricas', 'detectar-ampliaciones-fabricas-inversion-industrial/', 'Como detectar ampliaciones mediante fuentes territoriales, permisos y anuncios.'],
        ['Ayudas, permisos y licitaciones', 'ayudas-licitaciones-permisos-oportunidades-comerciales/', 'Como usarlos como senales sin convertir inferencias en hechos.'],
        ['Proyectos antes de RFQ', 'encontrar-proyectos-industriales-antes-de-la-peticion-de-oferta/', 'Como llegar antes de que la peticion de oferta cierre decisiones.'],
      ],
    },
    {
      title: 'Encontrar oportunidades según lo que vendes',
      intro: 'Guías para interpretar cambios industriales desde la perspectiva de servicios, proveedores, compras, monitorización y nuevas fábricas.',
      items: [
        ['Servicios a fábricas', 'como-conseguir-clientes-servicios-fabricas/', 'Cómo encontrar fábricas que pueden necesitar mantenimiento, instalaciones, energía, ingeniería, logística, limpieza, consumibles u otros servicios industriales.'],
        ['Nuevos proveedores', 'detectar-fabricas-necesitan-nuevos-proveedores/', 'Señales que pueden indicar que una fábrica necesitará nuevos proveedores por ampliaciones, nuevas líneas, traslados o inversiones.'],
        ['Fase de compra', 'empresa-industrial-fase-de-compra/', 'Cómo interpretar señales de inversión, contratación, permisos y proyectos para detectar una posible ventana de compra industrial.'],
        ['Monitorización de clientes', 'monitorizar-clientes-industriales-oportunidades/', 'Cómo vigilar una cartera de clientes industriales para detectar inversiones, ampliaciones y cambios que alteren prioridades.'],
        ['Nueva fábrica o ampliación', 'que-compra-empresa-nueva-fabrica-ampliacion/', 'Qué categorías de proveedores pueden activarse cuando una empresa abre o amplía una fábrica.'],
      ],
    },
    {
      title: 'Estrategia comercial',
      intro: 'Como separar empresas objetivo, senales materiales y oportunidades accionables.',
      items: [
        ['Universo vs oportunidades', 'universo-empresas-vs-oportunidades-negocio/', 'Por que una empresa que encaja no es necesariamente una oportunidad.'],
        ['Base de datos vs inteligencia comercial', 'base-datos-vs-inteligencia-comercial-industrial/', 'Que cambia cuando una lista de empresas se convierte en un mercado vivo.'],
        ['Que es inteligencia comercial industrial', 'inteligencia-comercial-industrial/', 'Como pasar de una lista de empresas a razones concretas para actuar comercialmente.'],
        ['Donde vender automatizacion', 'donde-vender-automatizacion-industrial/', 'Como priorizar procesos, OEM, integradores y usuarios finales.'],
        ['Oportunidades de automatizacion industrial', 'oportunidades-automatizacion-industrial/', 'Como detectar necesidades de automatizacion antes de que el proyecto este adjudicado.'],
        ['Oportunidades para vender consumibles', 'detectar-oportunidades-consumibles-industriales/', 'Como detectar empresas que pueden aumentar consumo de materiales por nuevas lineas o produccion.'],
        ['Anticipar consumibles', 'anticipar-demanda-consumibles-industriales/', 'Como una inversion puede adelantar demanda recurrente de materiales.'],
        ['Servicios industriales en nuevas fabricas', 'oportunidades-servicios-industriales-nuevas-fabricas/', 'Como una nueva fabrica puede abrir necesidades de mantenimiento, energia, agua y servicios.'],
      ],
    },
  ];
  const body = categories.map((category) => `<div class="resources-index__header resources-index__header--secondary"><p class="eyebrow">${category.title}</p><h2>${category.title}</h2><p class="resources-index__intro">${category.intro}</p></div>${cards(category.items.map(([title, href, copy]) => ({ title, href, copy, link: title })))}`).join('');
  writeFile('recursos/index.html', `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Guias practicas de InduRadar sobre busqueda de empresas, senales de inversion, CNAE, Camaras de Comercio, fabricantes de maquinaria e inteligencia comercial industrial.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${baseUrl}/recursos/">
  <link rel="icon" type="image/png" sizes="48x48" href="${baseUrl}/favicon.png">
  <meta property="og:title" content="Recursos para descubrir empresas y oportunidades industriales | InduRadar">
  <meta property="og:description" content="Guias practicas sobre busqueda de empresas, senales de inversion e inteligencia comercial industrial.">
  <meta property="og:url" content="${baseUrl}/recursos/">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${baseUrl}/assets/visual-universo-senales-oportunidades.svg">
  <meta name="twitter:card" content="summary_large_image">
  <title>Recursos para descubrir empresas y oportunidades industriales | InduRadar</title>
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip-link" href="#recursos">Ir a los recursos</a>
  <header class="resource-header"><div class="resource-header__inner"><a class="resource-brand" href="../" aria-label="InduRadar, inicio"><img src="../assets/InduRadarLogoVertical-128.webp" width="48" height="38" alt="InduRadar"><span>Industrial Opportunity Intelligence</span></a><nav class="resource-nav" aria-label="Navegacion principal"><a href="../como-funciona-induradar/">Como funciona</a><a href="../soluciones/">Soluciones</a><a class="resource-nav__cta" href="../#formulario">Solicitar un analisis</a></nav></div></header>
  <main>
    <section class="resource-hero resource-hero--wide" aria-labelledby="resources-title"><div class="resource-hero__inner"><ol class="breadcrumb" aria-label="Migas de pan"><li><a href="../">Inicio</a></li><li aria-current="page">Recursos</li></ol><p class="eyebrow">Inteligencia comercial industrial</p><h1 id="resources-title">Recursos para descubrir empresas y oportunidades de negocio industrial</h1><p class="lead">Guias practicas sobre busqueda de empresas, senales de inversion, CNAE, Camaras de Comercio, fabricantes de maquinaria, nuevas fabricas e inteligencia comercial industrial.</p></div></section>
    <section id="recursos" class="resources-index" aria-label="Articulos de InduRadar">${body}</section>
  </main>
  <footer class="resource-footer"><div class="resource-footer__inner"><span>InduRadar · Inteligencia comercial industrial</span><a href="../#formulario">Solicitar un analisis</a></div></footer>
</body>
</html>
`);
}

function writeIndexPage(slug, title, description, h1, lead, groups, breadcrumbName) {
  currentDepth = slugToPath(slug).split('/').filter(Boolean).length;
  const prefix = relativePrefix(currentDepth);
  const body = groups.map((group) => `<section class="resources-index__header resources-index__header--secondary"><p class="eyebrow">${group.eyebrow}</p><h2>${group.title}</h2><p class="resources-index__intro">${group.copy}</p>${cards(group.items)}</section>`).join('');
  writeFile(`${slugToPath(slug)}/index.html`, `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${metaEscape(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${baseUrl}${slug}">
  <link rel="icon" type="image/png" sizes="48x48" href="${baseUrl}/favicon.png">
  <meta property="og:title" content="${metaEscape(title)}">
  <meta property="og:description" content="${metaEscape(description)}">
  <meta property="og:url" content="${baseUrl}${slug}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${baseUrl}/assets/visual-universo-senales-oportunidades.svg">
  <meta name="twitter:card" content="summary_large_image">
  <title>${htmlEscape(title)}</title>
  <link rel="stylesheet" href="${prefix}styles.css">
  <link rel="stylesheet" href="${prefix}recursos/styles.css">
</head>
<body>
  <a class="skip-link" href="#recursos">Ir al contenido</a>
  <header class="resource-header"><div class="resource-header__inner"><a class="resource-brand" href="${prefix}" aria-label="InduRadar, inicio"><img src="${prefix}assets/InduRadarLogoVertical-128.webp" width="48" height="38" alt="InduRadar"><span>Industrial Opportunity Intelligence</span></a><nav class="resource-nav" aria-label="Navegacion principal"><a href="${prefix}recursos/">Recursos</a><a href="${prefix}como-funciona-induradar/">Como funciona</a><a class="resource-nav__cta" href="${prefix}#formulario">Solicitar un analisis</a></nav></div></header>
  <main>
    <section class="resource-hero resource-hero--wide" aria-labelledby="page-title"><div class="resource-hero__inner"><ol class="breadcrumb" aria-label="Migas de pan"><li><a href="${prefix}">Inicio</a></li><li aria-current="page">${breadcrumbName}</li></ol><p class="eyebrow">InduRadar</p><h1 id="page-title">${h1}</h1><p class="lead">${lead}</p></div></section>
    <section id="recursos" class="resources-index">${body}</section>
  </main>
  <footer class="resource-footer"><div class="resource-footer__inner"><span>InduRadar · Inteligencia comercial industrial</span><a href="${prefix}#formulario">Solicitar un analisis</a></div></footer>
</body>
</html>`);
}

function articlePage({ slug, title, description, h1, lead, eyebrow, body, visual, related, reading = '5 min', cta: pageCta }) {
  return { slug, title, description, h1, lead, eyebrow, body, visual, related, reading, cta: pageCta, type: 'Article', breadcrumbs: [{ name: 'Recursos', href: '/recursos/' }, { name: stripHtml(h1), href: slug }] };
}

function simpleSections(sections) {
  return sections.map(([title, content]) => section(title, content)).join('');
}

const pages = [
  {
    slug: '/como-funciona-induradar/',
    type: 'WebPage',
    title: 'Como funciona InduRadar | Inteligencia comercial industrial',
    description: 'Descubre como InduRadar encuentra empresas, verifica senales industriales y convierte evidencia publica en oportunidades comerciales trazables.',
    h1: 'Como funciona InduRadar',
    lead: 'Encontrar empresas es facil. Saber que empresas estan cambiando, que esta ocurriendo y por que puede existir una oportunidad comercial ahora es bastante mas dificil.',
    eyebrow: 'Metodo',
    visual: visuals.chain,
    breadcrumbs: [{ name: 'Como funciona InduRadar', href: '/como-funciona-induradar/' }],
    related: [
      { href: '../recursos/base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
      { href: '../recursos/senales-empresa-industrial-va-a-invertir/', label: 'Senales de que una empresa industrial puede invertir' },
      { href: '../recursos/universo-empresas-vs-oportunidades-negocio/', label: 'Universo de empresas vs oportunidades reales' },
    ],
    body: [
      paragraph('InduRadar combina descubrimiento de mercado, investigacion de fuentes publicas y analisis de senales industriales para transformar informacion dispersa en una cartera comercial trazable.'),
      section('1. Primero construimos el universo', paragraph('Antes de hablar de oportunidades hay una pregunta mas basica: que empresas forman realmente el mercado que queremos estudiar.') + list(['CNAE y CAE.', 'Camaras de Comercio.', 'asociaciones y clusteres.', 'ferias y expositores.', 'registros y directorios.', 'fabricantes de maquinaria.', 'integradores e ingenierias.', 'procesos industriales.', 'referencias de clientes y proveedores.', 'busqueda abierta en fuentes publicas.']) + paragraph('Una empresa puede ser relevante aunque todavia no exista ninguna senal comercial reciente.')),
      section('2. Despues buscamos senales', paragraph('Una senal es un hecho observable que indica un cambio relevante. El objetivo no es acumular noticias, sino detectar cambios con significado comercial.') + list(['nueva fabrica.', 'ampliacion.', 'nueva linea.', 'compra o renovacion de maquinaria.', 'automatizacion o robotizacion.', 'ayuda publica.', 'permiso o licitacion.', 'contratacion tecnica.', 'nueva capacidad.', 'nuevo producto.', 'proyecto energetico o de descarbonizacion.'])),
      section('3. Separamos hecho, inferencia y estimacion', '<h3>Hecho confirmado</h3>' + paragraph('Informacion respaldada por una fuente identificable. Por ejemplo, una ayuda publica para modernizar una planta.') + '<h3>Inferencia razonada</h3>' + paragraph('Conclusion comercial plausible derivada de uno o varios hechos. Por ejemplo, que el proyecto podria generar necesidades de automatizacion, integracion o trazabilidad.') + '<h3>Estimacion</h3>' + paragraph('Lectura prudente de una fase o ventana cuando no existe confirmacion directa. Esta separacion evita presentar una posibilidad como si fuera una compra confirmada.')),
      section('4. Seguimos la cadena de evidencia', paragraph('Una oportunidad util debe poder responder que ha ocurrido, donde, cuando, que fuente lo respalda, que necesidad podria generar, que falta por confirmar y que accion comercial tiene sentido.')),
      section('5. No confundimos empresa adecuada con oportunidad', paragraph('Una compania puede tener el sector, tamano, proceso y ubicacion adecuados, y aun asi no mostrar una oportunidad inmediata. Por eso InduRadar distingue universo de empresas, senales y oportunidades.')),
      section('6. Priorizamos por evidencia y momento', paragraph('Las oportunidades se priorizan por calidad de evidencia, actualidad, concrecion, escala, relevancia y claridad de la ventana comercial. El objetivo no es producir una lista mas larga, sino una cartera donde sea mas facil decidir que activar, investigar y monitorizar.')),
      section('7. Las fuentes no son todas iguales', paragraph('Segun el caso, InduRadar combina fuentes oficiales y regulatorias, ayudas, contratacion publica, prensa economica y territorial, asociaciones, ferias, fuentes corporativas, empleo, directorios y fuentes sectoriales. Una unica fuente no tiene por que ser suficiente para elevar una oportunidad.')),
      section('Que no promete InduRadar', paragraph('InduRadar no promete conocer informacion privada, saber quien comprara con certeza, adivinar proveedores, convertir cualquier noticia en una oportunidad, afirmar que algo no existe porque una busqueda no lo haya encontrado ni sustituir la conversacion comercial con el cliente.')),
      section('Que recibe el usuario', paragraph('La salida estandar presenta empresas relevantes, senales materiales, oportunidades verificadas, fuentes publicas, limitaciones y acciones sugeridas. El foco esta en responder donde merece la pena mirar ahora y por que.')),
    ].join(''),
  },
  articlePage({
    slug: '/recursos/base-datos-vs-inteligencia-comercial-industrial/',
    title: 'Base de datos vs inteligencia comercial industrial | InduRadar',
    description: 'Una base de datos indica quien existe. La inteligencia comercial intenta explicar quien esta cambiando, que ocurre y por que actuar ahora.',
    h1: 'Base de datos de empresas industriales vs inteligencia comercial industrial',
    lead: 'Una base de datos responde que empresas existen. En ventas industriales tambien importa saber que empresas estan cambiando y por que merece la pena hablar con ellas ahora.',
    visual: visuals.layers,
    reading: '6 min',
    related: [
      { href: '../universo-empresas-vs-oportunidades-negocio/', label: 'Universo de empresas vs oportunidades reales' },
      { href: '../senales-oportunidades-negocio-industrial/', label: 'Senales para detectar oportunidades de negocio industrial' },
      { href: '../../como-funciona-induradar/', label: 'Como funciona InduRadar' },
      { href: '../como-encontrar-nuevos-clientes-industriales/', label: 'Como encontrar nuevos clientes industriales' },
    ],
    body: simpleSections([
      ['Que aporta una base de datos', paragraph('Puede proporcionar nombre, actividad, CNAE, localizacion, empleados, facturacion, web y contacto. Es una excelente herramienta para segmentar, pero esos datos pueden permanecer casi iguales durante anos.')],
      ['Que anade la inteligencia comercial', paragraph('Busca cambios: ampliaciones, inversiones, nuevas lineas, maquinaria, ayudas, licitaciones, empleo tecnico, nuevos productos, capacidad y proyectos. No sustituye la base de datos: la convierte en un mercado vivo.')],
      ['Ejemplo sencillo', '<h3>Base de datos</h3>' + paragraph('Empresa A. Sector alimentacion. Provincia Valencia. 200 empleados.') + '<h3>Inteligencia comercial</h3>' + paragraph('Empresa A. Nueva linea anunciada. Ayuda publica concedida. Contratacion de ingenieria. Ampliacion en tramitacion. La empresa es la misma; la prioridad comercial no.')],
      ['El mejor enfoque combina ambos mundos', paragraph('Universo estructural + senales actuales + evidencia. Eso permite responder quien encaja, que esta pasando, que empresas priorizar, que necesita validacion y cuando volver a mirar.')],
    ]),
  }),
  articlePage({
    slug: '/recursos/senales-empresa-industrial-va-a-invertir/',
    title: 'Senales de que una empresa industrial puede invertir | InduRadar',
    description: 'Permisos, ayudas, empleo, suelo, nuevas lineas y otros cambios pueden anticipar una inversion industrial antes del anuncio final.',
    h1: 'Que senales indican que una empresa industrial puede estar a punto de invertir',
    lead: 'Las inversiones industriales suelen dejar huellas antes de que la nueva linea entre en produccion. Ninguna senal aislada garantiza una compra, pero algunas combinaciones revelan que un proyecto toma forma.',
    visual: visuals.timeline,
    reading: '7 min',
    related: [
      { href: '../detectar-ampliaciones-fabricas-inversion-industrial/', label: 'Como detectar ampliaciones de fabricas e inversion industrial' },
      { href: '../ayudas-licitaciones-permisos-oportunidades-comerciales/', label: 'Ayudas, licitaciones y permisos como senales comerciales' },
      { href: '../encontrar-proyectos-industriales-antes-de-la-peticion-de-oferta/', label: 'Como encontrar proyectos industriales antes de la peticion de oferta' },
      { href: '../senales-oportunidades-negocio-industrial/', label: 'Senales para detectar oportunidades de negocio industrial' },
    ],
    body: simpleSections([
      ['1. Permisos y expedientes', paragraph('Licencias, evaluacion ambiental, informacion publica o cambios de capacidad pueden aparecer mucho antes de la puesta en marcha.')],
      ['2. Ayudas y financiacion', paragraph('Una ayuda para digitalizacion, descarbonizacion o modernizacion indica que existe un proyecto financiado o en preparacion. No confirma el proveedor final, pero abre una ventana de seguimiento.')],
      ['3. Contratacion tecnica', paragraph('Nuevos puestos de ingenieria, mantenimiento, produccion, calidad o automatizacion pueden acompanar una ampliacion o un nuevo proyecto.')],
      ['4. Suelo, naves y obras', paragraph('Una nueva nave, ampliacion o cambio de emplazamiento puede preceder a nuevas instalaciones productivas.')],
      ['5. Nuevos productos', paragraph('Un cambio de formato, nueva gama o nueva tecnologia puede requerir adaptar procesos y maquinaria.')],
      ['6. Nueva capacidad', paragraph('Cuando una empresa habla de mas produccion, nuevos turnos o aumento de capacidad, merece investigar que activos y procesos cambiaran.')],
      ['7. Ferias y lanzamientos', paragraph('En OEM y fabricantes de maquinaria, un nuevo equipo o plataforma puede anticipar nuevas decisiones de automatizacion y suministro.')],
      ['8. Varias senales juntas', paragraph('Una ayuda por si sola puede ser debil. Una ayuda junto a contratacion, permiso y nueva nave describe una situacion mucho mas interesante.')],
      ['De la senal a la accion', paragraph('El objetivo no es afirmar que la compra existe. Es llegar a una respuesta comercial mas util: que cambia, que evidencia existe, que necesidad es plausible, que falta por confirmar y cuando conviene actuar.')],
    ]),
  }),
];

const newArticles = [
  ['como-encontrar-empresas-industriales-nicho-especifico', 'Como encontrar empresas industriales de un nicho especifico | InduRadar', 'Descubre como construir un universo de empresas industriales cuando Google, los CNAE o los directorios generalistas no son suficientes.', 'Como encontrar empresas industriales de un nicho muy especifico', 'Buscar empresas industriales es facil. Encontrar todas las empresas relevantes de una actividad muy concreta es otra historia.', visuals.layers, [
    ['Empieza por actividad, no solo por nombre', paragraph('Busca que hacen realmente las empresas: procesos, productos, maquinaria, certificaciones, ferias, asociaciones o mercados a los que venden.')],
    ['Cruza directorios, asociaciones y ferias', paragraph('Los directorios sectoriales, Camaras, clusteres y listados de expositores revelan companias que apenas aparecen en busquedas genericas.')],
    ['Sigue relaciones industriales', paragraph('Clientes, proveedores, OEM, integradores, EPC y socios tecnologicos pueden abrir nuevos caminos de descubrimiento.')],
    ['Separa empresa relevante de oportunidad', paragraph('Primero construyes el universo. Despues buscas senales: inversion, ampliacion, nueva linea, contratacion, ayuda, licitacion, nuevo producto o cambio de capacidad.')],
  ]],
  ['nuevas-empresas-por-cnae', 'Como detectar nuevas empresas por CNAE | InduRadar', 'Aprende a combinar CNAE, registros mercantiles y geografia para localizar empresas nuevas con potencial comercial.', 'Como detectar nuevas empresas por CNAE', 'Una empresa recien creada puede convertirse en cliente antes de consolidarse en muchos directorios comerciales.', visuals.layers, [
    ['El CNAE es un punto de partida', paragraph('Dos empresas con el mismo codigo pueden tener procesos y mercados muy diferentes. Conviene combinarlo con fecha de constitucion, geografia, objeto social, actividad real, web, grupo empresarial e instalaciones.')],
    ['Espana y Portugal', paragraph('En Espana puede utilizarse CNAE como semilla estructural. En Portugal, CAE. La clasificacion ayuda a descubrir empresas, pero no sustituye la validacion de actividad real.')],
  ]],
  ['camaras-comercio-encontrar-clientes', 'Como usar Camaras de Comercio para encontrar clientes | InduRadar', 'Camaras, censos y directorios territoriales pueden descubrir empresas que no aparecen facilmente en otras busquedas.', 'Como usar las Camaras de Comercio para encontrar clientes potenciales', 'Las Camaras de Comercio son una fuente infravalorada para descubrir empresas industriales y redes territoriales.', visuals.layers, [
    ['Que puedes encontrar', list(['empresas por actividad.', 'empresas por municipio.', 'programas de digitalizacion.', 'internacionalizacion.', 'exportadores.', 'encuentros B2B.', 'clusteres y redes.'])],
    ['El valor esta en cruzar fuentes', paragraph('Una empresa encontrada en una Camara puede cruzarse despues con CNAE o CAE, web, ayudas, noticias, permisos, contratacion, empleo y ferias.')],
  ]],
  ['senales-oportunidades-negocio-industrial', 'Senales para detectar oportunidades de negocio industrial | InduRadar', 'Aprende que senales publicas pueden anticipar una inversion, una compra de maquinaria o una nueva necesidad industrial.', 'Como descubrir oportunidades de negocio industrial a partir de senales', 'La mejor empresa del mercado no siempre es la mejor oportunidad. Lo que cambia la prioridad es una senal.', visuals.matrix, [
    ['Senales interesantes', list(['ampliacion.', 'nueva linea.', 'nueva maquinaria.', 'permisos.', 'ayudas.', 'licitaciones.', 'empleo tecnico.', 'robotizacion.', 'digitalizacion.', 'nuevos productos.', 'aumento de capacidad.']) + paragraph('Una unica senal no siempre significa compra inmediata. Varias senales convergentes pueden cambiar por completo la prioridad.')],
    ['La clave es el momento', paragraph('Saber quien podria comprar es util. Saber quien esta cambiando ahora puede ser mucho mas valioso.')],
  ]],
  ['encontrar-fabricantes-maquinaria-oem-integradores', 'Como encontrar fabricantes de maquinaria, OEM e integradores | InduRadar', 'Metodos para descubrir fabricantes e integradores por sector, proceso, feria, asociacion y capacidad tecnica.', 'Como encontrar fabricantes de maquinaria, OEM e integradores', 'Los OEM e integradores son un mercado atractivo para proveedores de automatizacion, componentes, software, seguridad, vision, motion o robotica.', visuals.layers, [
    ['Buscar por sector no basta', paragraph('Muchos OEM trabajan para varios sectores. Busca tambien por tipo de maquina, proceso, capacidad, mercados servidos, feria, asociacion, cliente de referencia y tecnologia.')],
    ['Las ferias son un mapa de mercado', paragraph('Los expositores revelan fabricantes especializados que pueden pasar desapercibidos en busquedas generales.')],
    ['Despues llega la pregunta comercial', paragraph('Esta desarrollando una maquina nueva, contratando, entrando en otro mercado o cambiando plataforma? Ahi aparecen las senales.')],
  ]],
  ['detectar-ampliaciones-fabricas-inversion-industrial', 'Como detectar ampliaciones de fabricas e inversion industrial | InduRadar', 'Permisos, ayudas, prensa local y fuentes corporativas pueden anticipar ampliaciones industriales.', 'Como detectar empresas que estan ampliando fabrica o capacidad', 'Una ampliacion rara vez aparece de repente. Antes suelen existir huellas publicas que merece la pena conectar.', visuals.timeline, [
    ['Huellas habituales', list(['suelo.', 'licencias.', 'expedientes ambientales.', 'ayudas.', 'aumento de potencia.', 'obras.', 'contratacion tecnica.', 'nuevas naves.', 'financiacion.', 'anuncios corporativos.'])],
    ['La prensa local importa', paragraph('Muchas inversiones aparecen primero en medios regionales o informacion publica territorial.')],
    ['No todas las ampliaciones significan lo mismo', paragraph('Una nave de almacen no genera las mismas necesidades que una nueva linea. Hay que entender que cambia realmente en el proceso industrial.')],
  ]],
  ['ayudas-licitaciones-permisos-oportunidades-comerciales', 'Ayudas, licitaciones y permisos como senales comerciales | InduRadar', 'Aprende a utilizar subvenciones, contratacion publica y permisos como senales sin confundir financiacion con compra confirmada.', 'Como convertir ayudas, licitaciones y permisos en oportunidades comerciales', 'Las fuentes publicas contienen miles de pistas. El reto es entender cuales indican una oportunidad real.', visuals.timeline, [
    ['Una ayuda no equivale a una compra', paragraph('Confirma financiacion o proyecto, no necesariamente el equipo o proveedor.')],
    ['Una licitacion puede ser mas directa', paragraph('Pliegos, lotes, consultas y adjudicaciones pueden definir mejor la necesidad.')],
    ['Los permisos muestran movimiento', paragraph('Pueden anticipar plantas, ampliaciones o capacidad antes de la noticia comercial.')],
    ['El valor esta en conectar eventos', paragraph('Ayuda + permiso + contratacion tecnica puede ser mas significativo que cualquiera por separado.')],
  ]],
  ['universo-empresas-vs-oportunidades-negocio', 'Universo de empresas vs oportunidades reales | InduRadar', 'Una empresa que encaja con tu producto no es necesariamente una oportunidad. Descubre como separar universo, senales y oportunidades.', 'Universo de empresas vs oportunidades reales', 'Uno de los errores mas frecuentes en prospeccion B2B es confundir encaje con oportunidad.', visuals.layers, [
    ['Primero: construye el universo', paragraph('Que empresas podrian ser clientes? Una empresa puede tener sector, tamano, proceso y geografia adecuados. Eso la convierte en empresa relevante, no necesariamente en oportunidad inmediata.')],
    ['Despues: busca senales', paragraph('Que esta cambiando ahora? Una senal material permite decidir donde investigar, monitorizar o contactar.')],
    ['Finalmente: prioriza', paragraph('Empresa adecuada + senal material + momento + evidencia. Esta separacion evita investigar profundamente cientos de empresas sin necesidad.')],
  ]],
  ['como-encontrar-nuevos-clientes-industriales', 'Como encontrar nuevos clientes industriales | InduRadar', 'Alternativas a las bases genericas: directorios, CNAE, asociaciones, ferias, relaciones industriales y senales de mercado.', 'Como encontrar nuevos clientes industriales sin depender de una base de datos generica', 'Una base de datos puede darte nombres. Una buena prospeccion necesita contexto.', visuals.layers, [
    ['Construye el mercado desde varias fuentes', list(['CNAE y CAE.', 'Camaras.', 'asociaciones.', 'ferias.', 'clusteres.', 'directorios.', 'registros.', 'referencias de proveedores.', 'procesos.'])],
    ['Anade senales', paragraph('Despues identifica cuales muestran cambios relevantes: inversion, ampliacion, empleo tecnico, ayudas, permisos o nuevas lineas.')],
    ['El objetivo no es una lista mas larga', paragraph('Es una lista mejor explicada y mejor priorizada.')],
  ]],
  ['buscar-empresas-por-proceso-industrial', 'Como buscar empresas por proceso industrial | InduRadar', 'Inyeccion, extrusion, mecanizado, impresion o paletizado: buscar por proceso descubre empresas que un CNAE puede no identificar bien.', 'Como descubrir empresas por proceso industrial, no solo por sector', 'Los sectores sirven para ordenar un mercado. Los procesos suelen ser mejores para encontrar clientes.', visuals.matrix, [
    ['Busca el proceso que genera la necesidad', list(['mecanizado.', 'inyeccion.', 'extrusion.', 'termoformado.', 'flexografia.', 'laminacion.', 'dosificacion.', 'envasado.', 'paletizado.', 'inspeccion.', 'manipulacion robotizada.'])],
    ['Combina sector, proceso y geografia', paragraph('El universo resultante puede ser mucho mas preciso que una busqueda por actividad general.')],
    ['Despues busca cambios', paragraph('Las senales determinan donde existe prioridad comercial.')],
  ]],
];

for (const [slug, title, description, h1, lead, visual, sections] of newArticles) {
  pages.push(articlePage({
    slug: `/recursos/${slug}/`,
    title,
    description,
    h1,
    lead,
    visual,
    reading: '4 min',
    related: [
      { href: '../senales-empresa-industrial-va-a-invertir/', label: 'Senales de que una empresa industrial puede invertir' },
      { href: '../base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
      { href: '../../como-funciona-induradar/', label: 'Como funciona InduRadar' },
    ],
    body: simpleSections(sections),
  }));
}

function conceptChainBlock() {
  return section(
    'De empresa objetivo a acción comercial',
    paragraph('InduRadar interpreta la prospección industrial como una cadena de trabajo: <strong>empresa → cambio industrial → señal verificable → necesidad probable → ventana comercial → acción</strong>. La clave está en no convertir una señal aislada en una venta supuesta, sino en usarla para decidir qué investigar, qué priorizar y qué siguiente paso tiene sentido.')
  );
}

const opportunityArticles = [
  {
    slug: 'como-conseguir-clientes-servicios-fabricas',
    title: 'Cómo conseguir nuevos clientes si vendes servicios a fábricas | InduRadar',
    description: 'Cómo encontrar fábricas que pueden necesitar mantenimiento, instalaciones, energía, ingeniería, logística, limpieza, consumibles u otros servicios industriales.',
    h1: 'Cómo conseguir nuevos clientes si vendes servicios a fábricas',
    lead: 'Encontrar fábricas no suele ser el problema. El reto es saber cuáles están cambiando, qué pueden necesitar y cuándo tiene sentido abordarlas comercialmente.',
    cta: 'Indica tu oferta, territorio y sectores objetivo. InduRadar busca empresas, señales industriales y proyectos públicos para ayudarte a priorizar dónde merece la pena actuar.',
    related: [
      { href: '../como-encontrar-nuevos-clientes-industriales/', label: 'Cómo encontrar nuevos clientes industriales' },
      { href: '../senales-oportunidades-negocio-industrial/', label: 'Señales para detectar oportunidades de negocio industrial' },
      { href: '../universo-empresas-vs-oportunidades-negocio/', label: 'Universo de empresas vs oportunidades reales' },
      { href: '../../como-funciona-induradar/', label: 'Cómo funciona InduRadar' },
    ],
    sections: [
      ['Empresa objetivo no es oportunidad comercial', paragraph('Una empresa puede encajar perfectamente con lo que vendes y no tener ninguna necesidad inmediata. Puede pertenecer al sector adecuado, tener el tamaño correcto y estar situada en tu territorio, pero si no está modificando instalaciones, procesos, producción o proveedores, probablemente no exista una ventana comercial clara.') + paragraph('Por eso una prospección industrial útil necesita separar dos conceptos: empresa objetivo y oportunidad comercial. La primera responde a quién podría comprarte algún día. La segunda intenta responder a quién puede tener una necesidad concreta ahora o en los próximos meses.')],
      ['Construir el universo de fábricas relevantes', paragraph('El primer paso sigue siendo identificar qué empresas pueden necesitar lo que vendes. Dependiendo de tu actividad, pueden ser plantas de alimentación, química, farmacéutica, automoción, metal, plástico, packaging, cerámica, papel, logística u otros sectores.') + list(['CNAE y registros empresariales.', 'Directorios industriales.', 'Cámaras de Comercio.', 'Asociaciones empresariales.', 'Polígonos y parques industriales.', 'Ferias sectoriales.', 'Referencias de fabricantes y proveedores.', 'Proyectos y ayudas públicas.', 'Procesos productivos concretos.']) + paragraph('Pero una lista de empresas solo es el principio. Una cartera comercial se vuelve mucho más útil cuando empiezas a identificar qué está cambiando en cada cuenta.')],
      ['Cambios que pueden generar demanda de servicios', paragraph('Muchas compras industriales son consecuencia de otro acontecimiento. Una empresa que amplía capacidad puede necesitar instalaciones eléctricas, climatización, agua, mantenimiento, maquinaria, logística, almacenamiento, packaging, energía, instrumentación, limpieza industrial, seguridad, ingeniería, servicios de calidad o nuevos consumibles.') + paragraph('Por eso las señales industriales son importantes. Una ampliación, una nueva línea, una ayuda pública, una licencia, nuevas contrataciones técnicas o la construcción de una nave pueden indicar que la empresa está entrando en una fase donde aparecerán nuevas necesidades.')],
      ['Relacionar cada señal con una necesidad probable', paragraph('Dos empresas del mismo sector pueden tener necesidades completamente diferentes. Una empresa alimentaria puede estar ampliando frío industrial. Otra puede construir un almacén. Otra puede instalar una línea de envasado. Otra puede estar buscando reducir consumo energético.') + paragraph('El enfoque puede resumirse así: <strong>cambio industrial → necesidad probable → proveedor potencial → momento comercial</strong>. Es más útil relacionar cada señal con una necesidad probable que clasificar simplemente empresas por sector.')],
      ['La ventana comercial importa', paragraph('En mercados industriales, llegar demasiado tarde puede significar que el proveedor ya está adjudicado. Llegar demasiado pronto puede significar que todavía no existe proyecto real. El objetivo es encontrar una ventana en la que la necesidad esté tomando forma, pero todavía exista capacidad de influir en la decisión.') + paragraph('Una ampliación anunciada puede ser una señal temprana. La solicitud de licencia puede indicar avance. La contratación de ingeniería puede indicar definición. La construcción puede reducir algunas oportunidades pero abrir otras. La puesta en marcha puede generar nuevas necesidades de mantenimiento, optimización o servicios.')],
      ['Prudencia antes de actuar', paragraph('Una noticia, una feria o una oferta de empleo no deben convertirse automáticamente en una oportunidad. Es mejor buscar convergencia: ampliación anunciada, inversión aprobada, contratación técnica, nuevo edificio o aumento de capacidad. Cuando varias señales apuntan al mismo cambio, la posibilidad de que exista un proyecto material aumenta.')],
      ['Qué debería responder la investigación', paragraph('La investigación solo tiene valor comercial si termina respondiendo preguntas útiles: qué empresa merece atención, qué está ocurriendo, qué necesidad puede derivarse, qué parte está confirmada, qué falta por verificar, quién puede intervenir en la decisión, cuándo debería revisarse y cuál sería la siguiente acción razonable.')],
      ['Un radar distinto para cada proveedor', paragraph('Un proveedor de mantenimiento no necesita vigilar las mismas señales que una empresa de energía. Una ingeniería no busca exactamente lo mismo que un proveedor de consumibles. Una empresa de packaging tendrá otro radar distinto. Por eso un sistema de prospección industrial debe comenzar por definir qué vende la empresa, qué sectores atiende, en qué territorio trabaja, qué tipos de cuentas busca y qué acontecimientos suelen generar demanda.')],
    ],
  },
  {
    slug: 'detectar-fabricas-necesitan-nuevos-proveedores',
    title: 'Cómo detectar fábricas que pueden necesitar nuevos proveedores | InduRadar',
    description: 'Señales que pueden indicar que una fábrica necesitará nuevos proveedores: ampliaciones, nuevas líneas, traslados, crecimiento, inversiones y cambios industriales.',
    h1: 'Cómo detectar fábricas que pueden necesitar nuevos proveedores',
    lead: 'Una empresa rara vez publica “buscamos nuevos proveedores”. Sin embargo, muchos cambios industriales dejan señales públicas antes de generar nuevas necesidades de compra.',
    cta: 'Define qué vendes y dónde trabajas. InduRadar busca empresas y señales industriales públicas para identificar cambios que puedan generar nuevas necesidades.',
    related: [
      { href: '../senales-empresa-industrial-va-a-invertir/', label: 'Señales de que una empresa industrial puede invertir' },
      { href: '../detectar-ampliaciones-fabricas-inversion-industrial/', label: 'Cómo detectar ampliaciones de fábricas e inversión industrial' },
      { href: '../encontrar-proyectos-industriales-antes-de-la-peticion-de-oferta/', label: 'Cómo encontrar proyectos industriales antes de la petición de oferta' },
      { href: '../universo-empresas-vs-oportunidades-negocio/', label: 'Universo de empresas vs oportunidades reales' },
    ],
    sections: [
      ['Las relaciones industriales cambian cuando aparece un proyecto material', paragraph('Las relaciones industriales suelen ser estables. Una fábrica que produce los mismos productos, con las mismas instalaciones y la misma capacidad, puede mantener durante años los mismos proveedores. La situación cambia cuando aparece un proyecto material.') + paragraph('Una nueva planta, una ampliación, un traslado, una adquisición o una nueva línea pueden obligar a revisar capacidades, especificaciones, servicios y proveedores. Por eso detectar cambios puede ser más útil que buscar empresas únicamente por tamaño o sector.')],
      ['Nueva planta: periodo excepcional de compra', paragraph('La apertura de una nueva planta crea una situación diferente a la operación ordinaria. Puede aparecer demanda de construcción, instalaciones, electricidad, energía, agua, climatización, almacenamiento, maquinaria, mantenimiento, limpieza, seguridad, calidad, servicios técnicos, logística, suministros, consumibles y personal.') + paragraph('No todos esos contratos estarán abiertos cuando la fábrica se anuncie. Pero el proyecto permite identificar una organización que entrará en un periodo excepcional de compra y cambio.')],
      ['Ampliaciones y traslados', paragraph('Una ampliación puede consistir en aumentar superficie productiva, instalar una nueva línea, ampliar almacenes, incorporar nuevos procesos, aumentar capacidad, introducir un nuevo producto, renovar equipos o incrementar turnos. Cada cambio puede alterar necesidades existentes o crear otras nuevas.') + paragraph('Mover una actividad industrial suele desencadenar decisiones de desmontaje, transporte, obra industrial, instalaciones eléctricas, aire comprimido, agua, climatización, almacenamiento, puesta en marcha, mantenimiento, seguridad o adecuación normativa.')],
      ['Pistas públicas antes del anuncio de compra', paragraph('Las mejores pistas no siempre son anuncios de adquisición. Compra de suelo, licencias de obra, permisos ambientales, ayudas, contratación técnica, nuevos productos, crecimiento, aumento de producción, nuevas instalaciones o adquisiciones pueden anticipar nuevas necesidades de proveedores.')],
      ['Separar hecho, inferencia y desconocido', paragraph('Una señal sirve para investigar, no para afirmar una venta. Si una empresa recibe una ayuda para mejorar eficiencia energética, el hecho es que existe una actuación financiada. La inferencia posible es que puede existir demanda de equipos o servicios relacionados. Lo que todavía no sabemos es qué se comprará, cuándo, a quién y si el proveedor ya está seleccionado.')],
      ['La secuencia importa', paragraph('Una única señal puede ser débil. Varias señales relacionadas pueden cambiar la situación: empresa adquiere una parcela, anuncia una inversión, obtiene licencia, contrata responsables de proyecto e inicia construcción. A medida que aparecen nuevas evidencias, el proyecto se vuelve más tangible.')],
      ['La fase cambia el tipo de proveedor', paragraph('En una fase temprana puede haber oportunidades para ingeniería, consultoría, construcción, energía, permisos o proyecto industrial. Más adelante pueden cobrar importancia maquinaria, instalaciones, logística, almacenamiento, calidad o mantenimiento. Tras la puesta en marcha pueden aparecer optimización, consumibles, repuestos, mantenimiento, limpieza y servicios recurrentes.')],
      ['Del universo al radar', paragraph('Una empresa puede no tener una oportunidad hoy y tenerla dentro de seis meses. Por eso merece la pena conservar un universo de cuentas relevantes y volver a comprobar periódicamente si aparece alguna señal material. La prospección industrial deja así de ser una fotografía y se convierte en un radar.')],
    ],
  },
  {
    slug: 'empresa-industrial-fase-de-compra',
    title: 'Cómo saber si una empresa industrial está entrando en fase de compra | InduRadar',
    description: 'Cómo interpretar señales de inversión, contratación, permisos, ampliaciones y proyectos para detectar una posible ventana de compra industrial.',
    h1: 'Cómo saber si una empresa industrial está entrando en fase de compra',
    lead: 'En venta industrial, conocer una empresa es útil. Saber cuándo está cambiando puede ser mucho más importante.',
    cta: 'InduRadar analiza señales y proyectos industriales para priorizar empresas según el cambio que están experimentando y el momento de actuación.',
    related: [
      { href: '../../glosario/ventana-comercial/', label: 'Qué es una ventana comercial' },
      { href: '../encontrar-proyectos-industriales-antes-de-la-peticion-de-oferta/', label: 'Cómo encontrar proyectos industriales antes de la petición de oferta' },
      { href: '../senales-oportunidades-negocio-industrial/', label: 'Señales para detectar oportunidades de negocio industrial' },
      { href: '../../como-funciona-induradar/', label: 'Cómo funciona InduRadar' },
    ],
    sections: [
      ['La compra puede empezar antes de la RFQ', paragraph('Muchas oportunidades se detectan demasiado tarde. Cuando aparece una petición formal de oferta, gran parte de las decisiones pueden estar ya tomadas: alcance, ingeniería, especificaciones, proveedores habituales, presupuesto y calendario. La verdadera ventana comercial puede haber empezado meses antes.')],
      ['Formación del proyecto', paragraph('La empresa identifica un problema o una oportunidad: producir más, introducir un nuevo producto, ahorrar energía, mejorar calidad, aumentar almacenamiento, reducir costes, sustituir equipos, cumplir normativa, trasladar instalaciones o responder a nuevos pedidos. En esta fase muchas veces todavía no existe una compra estructurada, pero pueden aparecer las primeras señales públicas.')],
      ['Señales públicas de avance', paragraph('El proyecto puede comenzar a dejar huella mediante solicitudes de ayudas, permisos, contratación de ingeniería, búsqueda de personal, compra de suelo, licencias, anuncios corporativos, financiación, licitaciones o presentaciones a inversores. Una señal aislada no permite afirmar que exista una compra, pero sí puede justificar seguimiento.')],
      ['Definición técnica y comercial', paragraph('A medida que el proyecto avanza, empiezan a tomarse decisiones que afectan directamente a proveedores: tecnología, capacidad, layout, procesos, especificaciones, presupuesto y calendario. Para muchos proveedores industriales, esta puede ser una de las fases más interesantes porque todavía existe margen para aportar soluciones, pero el proyecto ya tiene suficiente concreción.')],
      ['Ejecución y puesta en marcha', paragraph('En ejecución aparecen adjudicaciones, pedidos, proveedores, obras, instalación, commissioning y puesta en marcha. Algunas oportunidades ya estarán cerradas. Otras pueden aparecer precisamente aquí: necesidades auxiliares, servicios de instalación, modificaciones, imprevistos, suministros, mantenimiento, repuestos o asistencia técnica.') + paragraph('La puesta en marcha no significa que desaparezcan las oportunidades. Puede generar mantenimiento, optimización, servicios recurrentes, consumibles, seguridad, calidad, eficiencia, formación, modificaciones o ampliaciones posteriores.')],
      ['Cada proveedor interpreta una fase distinta', paragraph('Para una ingeniería, una licencia temprana puede ser interesante. Para un proveedor de mantenimiento, puede ser más útil conocer cuándo la instalación entra en operación. Para consumibles, el momento relevante puede empezar cuando aumenta producción. Por eso la fase comercial depende de qué vendes.')],
      ['Qué debe responder la investigación', paragraph('Una investigación útil debería terminar respondiendo qué está ocurriendo, qué necesidad puede generar, qué fase parece tener el proyecto, qué información falta y qué acción tiene sentido ahora. Ese concepto es lo que InduRadar denomina ventana comercial: no una compra confirmada, sino evidencia suficiente para decidir si actuar, investigar más o seguir vigilando.')],
    ],
  },
  {
    slug: 'monitorizar-clientes-industriales-oportunidades',
    title: 'Cómo monitorizar clientes industriales y detectar oportunidades | InduRadar',
    description: 'Cómo vigilar una cartera de clientes industriales para detectar inversiones, ampliaciones, nuevos proyectos, contratación y cambios que puedan generar oportunidades.',
    h1: 'Cómo monitorizar clientes industriales y detectar oportunidades',
    lead: 'Una cartera de clientes cambia constantemente. La empresa que hoy no tiene proyecto puede anunciar una ampliación, contratar ingeniería o iniciar una inversión dentro de unos meses.',
    cta: 'Indica tus cuentas, sectores y oferta. InduRadar puede identificar señales nuevas y cambios que alteren la prioridad comercial de cada empresa.',
    related: [
      { href: '../universo-empresas-vs-oportunidades-negocio/', label: 'Universo de empresas vs oportunidades reales' },
      { href: '../base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
      { href: '../senales-oportunidades-negocio-industrial/', label: 'Señales para detectar oportunidades de negocio industrial' },
      { href: '../../como-funciona-induradar/', label: 'Cómo funciona InduRadar' },
    ],
    sections: [
      ['Las listas envejecen', paragraph('Muchas empresas mantienen listados de cuentas objetivo. El problema es que esas listas envejecen. Una cuenta que parecía poco interesante puede iniciar un proyecto. Otra puede haber terminado su inversión. Otra puede adquirir una compañía, cambiar de dirección o abrir una nueva fábrica.') + paragraph('Si la cartera no se actualiza, el comercial termina trabajando con una fotografía antigua del mercado.')],
      ['Qué acontecimientos merece la pena vigilar', paragraph('No es necesario investigar exhaustivamente cada empresa cada semana. Lo útil es observar acontecimientos que puedan cambiar su prioridad.') + list(['Nueva fábrica.', 'Ampliación.', 'Nueva línea.', 'Traslado.', 'Aumento de capacidad.', 'Ayudas y permisos.', 'Nuevas contrataciones.', 'Adquisiciones.', 'Nuevos productos.', 'Expansión internacional.', 'Inversión energética.', 'Digitalización.', 'Cambios de propiedad.', 'Adjudicaciones y licitaciones.', 'Alianzas.'])],
      ['Separar ruido de cambio material', paragraph('Una buena vigilancia comercial debe evitar ruido. Muchas publicaciones corporativas no cambian la situación comercial: una felicitación corporativa, una feria repetida o una publicación de marketing pueden no justificar ninguna acción. La clave está en detectar cambios materiales que alteran capacidad, procesos, instalaciones, inversión, estructura o actividad comercial.')],
      ['Clasificar la cartera por prioridad', paragraph('Una cartera puede clasificarse entre oportunidades activas, señales en observación, cuentas estructuralmente relevantes y prescriptores o actores indirectos. Esta separación evita tratar todas las cuentas como si estuvieran en el mismo momento.')],
      ['Revisar lo que ha cambiado', paragraph('Cuando ya existe un estudio inicial, la siguiente revisión debería concentrarse en nuevas señales, cambios de fase, nuevas inversiones, nuevos proyectos, empresas nuevas, señales que pierden actualidad, oportunidades que ganan prioridad, proyectos que se cierran y nuevas acciones comerciales. El objetivo no es rehacer el informe desde cero, sino actualizar la situación.')],
      ['Ejemplo de evolución', paragraph('Una empresa puede aparecer durante meses como fabricante relevante sin proyecto conocido. Después publica una vacante de ingeniería, recibe una ayuda para nueva línea y solicita una ampliación de instalaciones. La misma empresa puede pasar de cuenta objetivo a oportunidad prioritaria. Sin vigilancia, ese cambio puede pasar desapercibido.')],
      ['Frecuencia y uso comercial', paragraph('No todas las carteras necesitan la misma frecuencia. Mercados con muchos proyectos pueden necesitar seguimiento mensual. Sectores con ciclos largos pueden admitir revisiones más espaciadas. También puede combinarse vigilancia periódica general, revisión inmediata cuando aparece una señal material e investigación adicional de cuentas prioritarias.') + paragraph('El valor no está solo en descubrir empresas nuevas. También está en decidir a quién llamar, a quién visitar, qué cuenta investigar, qué proyecto revisar, qué empresa puede esperar y qué señal merece seguimiento.')],
    ],
  },
  {
    slug: 'que-compra-empresa-nueva-fabrica-ampliacion',
    title: 'Qué compra una empresa cuando abre o amplía una fábrica | InduRadar',
    description: 'Una nueva fábrica puede generar oportunidades para construcción, instalaciones, energía, maquinaria, logística, mantenimiento, agua, calidad, seguridad y servicios industriales.',
    h1: 'Qué compra una empresa cuando abre o amplía una fábrica',
    lead: 'Una inversión industrial no genera una sola compra. Una nueva planta o una ampliación puede activar decenas de categorías de proveedores durante varios años.',
    cta: 'Describe qué vendes y dónde trabajas. InduRadar identifica inversiones, proyectos y señales industriales y las traduce en posibles necesidades comerciales.',
    related: [
      { href: '../detectar-ampliaciones-fabricas-inversion-industrial/', label: 'Cómo detectar ampliaciones de fábricas e inversión industrial' },
      { href: '../oportunidades-servicios-industriales-nuevas-fabricas/', label: 'Oportunidades de servicios industriales en nuevas fábricas' },
      { href: '../como-detectar-inversiones-industriales/', label: 'Cómo detectar inversiones industriales' },
      { href: '../ayudas-licitaciones-permisos-oportunidades-comerciales/', label: 'Ayudas, licitaciones y permisos como señales comerciales' },
    ],
    sections: [
      ['Mucho más que maquinaria', paragraph('Cuando una empresa anuncia una inversión industrial, es habitual fijarse únicamente en la maquinaria. Sin embargo, una fábrica necesita mucho más. Dependiendo del proyecto pueden aparecer oportunidades para múltiples proveedores antes, durante y después de la construcción. Entender esa cadena permite detectar oportunidades incluso cuando tu empresa no vende el equipo principal.')],
      ['Ingeniería, proyecto y obra industrial', paragraph('Las primeras fases pueden requerir ingeniería, arquitectura industrial, project management, estudios técnicos, consultoría, permisos, medioambiente, seguridad y diseño de instalaciones. Muchas decisiones posteriores nacen en esta fase.') + paragraph('Una planta nueva puede necesitar estructura, cimentación, cerramientos, pavimentos, cubiertas, obra civil, urbanización y adecuación de parcelas. En ampliaciones, estas necesidades pueden concentrarse solo en una parte del complejo.')],
      ['Instalaciones y energía', paragraph('Las instalaciones representan una parte relevante de muchos proyectos industriales: distribución eléctrica, cuadros, iluminación, centros de transformación, cableado, climatización, ventilación, aire comprimido, vapor, gases, fluidos y protección contra incendios.') + paragraph('Las inversiones industriales están cada vez más ligadas a energía: autoconsumo, almacenamiento, eficiencia, recuperación de calor, electrificación, monitorización, combustibles alternativos, aislamiento y gestión energética.')],
      ['Agua, residuos y medioambiente', paragraph('En muchos sectores el agua forma parte del proceso. Puede ser necesario tratamiento, filtración, bombeo, reutilización, depuración, dosificación, refrigeración y gestión de vertidos. También pueden aparecer servicios de residuos, reciclaje, valorización y cumplimiento ambiental.')],
      ['Maquinaria, logística y almacenamiento', paragraph('La compra más evidente suele ser maquinaria, pero dentro de esa categoría puede haber equipos principales, auxiliares, manipulación, packaging, inspección, laboratorios, equipos de proceso, utillajes y repuestos. Además, una planta puede adquirir parte de la maquinaria en distintas fases.') + paragraph('El crecimiento de capacidad puede exigir racks, estanterías, carretillas, almacenamiento automático, transporte interno, muelles, embalaje, expedición, software logístico y gestión de materiales. Cuando una fábrica aumenta producción, la logística suele convertirse en un cuello de botella importante.')],
      ['Mantenimiento, calidad y seguridad', paragraph('La puesta en marcha crea otra capa de demanda: mantenimiento preventivo, predictivo, mecánica, electricidad, lubricación, calibración, reparación, asistencia técnica y contratos de servicio. Una nueva planta puede convertirse en un cliente recurrente durante años.') + paragraph('Dependiendo del sector pueden aparecer necesidades de metrología, inspección, calibración, ensayos, laboratorio, certificación, trazabilidad, validación y control de calidad. También puede requerir evaluación de riesgos, protección contra incendios, señalización, EPIs, formación, adecuación normativa e inspecciones.')],
      ['Servicios recurrentes, personas e IT', paragraph('Alimentación, farmacéutica, química y otros sectores pueden necesitar limpieza industrial, higiene, desinfección, tratamiento de superficies, gestión de residuos y mantenimiento de áreas críticas. Una fábrica en crecimiento también puede generar demanda de selección de personal, formación, ETT, prevención, transporte, seguridad privada, restauración y facility management.') + paragraph('Una nueva instalación puede requerir redes, ciberseguridad, comunicaciones, sistemas de datos, software, ERP, MES, trazabilidad e infraestructura IT. Estas necesidades pueden aparecer antes de la puesta en marcha.')],
      ['Después de la puesta en marcha', paragraph('Tras iniciar producción comienza una segunda etapa. La empresa puede necesitar embalajes, químicos, lubricantes, herramientas, componentes, EPIs, filtros, materiales auxiliares, productos de limpieza y suministros de mantenimiento. El valor de una nueva fábrica no termina en la inversión inicial: puede convertirse en una demanda recurrente durante décadas.')],
      ['Interpretar la fase', paragraph('Una inversión industrial tiene fases. Primero pueden actuar ingenierías y construcción. Después instalaciones y maquinaria. Más adelante mantenimiento, servicios y consumibles. Por eso una noticia sobre una fábrica nueva debe interpretarse en función de qué vendes, en qué fase está el proyecto y qué decisiones siguen abiertas.') + paragraph('Una buena investigación debería identificar empresa, ubicación, proyecto, inversión, fase, calendario, actores implicados, necesidades probables y siguiente acción.')],
    ],
  },
];

for (const article of opportunityArticles) {
  pages.push(articlePage({
    slug: `/recursos/${article.slug}/`,
    title: article.title,
    description: article.description,
    h1: article.h1,
    lead: article.lead,
    visual: visuals.matrix,
    reading: '7 min',
    cta: {
      title: '¿Quieres priorizar oportunidades según lo que vendes?',
      copy: article.cta,
    },
    related: article.related,
    body: [conceptChainBlock(), simpleSections(article.sections)].join(''),
  }));
}

const expandedExisting = [
  ['donde-vender-automatizacion-industrial', 'Donde encontrar oportunidades de automatizacion industrial | InduRadar', 'Donde encontrar oportunidades de automatizacion industrial para vender PLC, sensores, vision, seguridad, motion, robotica y software industrial.', 'Donde vender automatizacion industrial cuando no basta con saber que fabricas existen', 'Para vender tecnologia industrial, una fabrica potencial solo merece atencion cuando existe una razon concreta para investigar, contactar o visitar.', visuals.matrix, [
    ['No empieces buscando empresas: empieza buscando procesos', paragraph('La automatizacion industrial no se vende unicamente a un sector. Se vende alli donde existe un proceso que puede beneficiarse de control, movimiento, inspeccion, seguridad, robotizacion o conectividad.') + list(['packaging.', 'final de linea.', 'mecanizado.', 'impresion.', 'intralogistica.', 'ensamblaje.', 'dosificacion.', 'clasificacion.', 'inspeccion.', 'hornos.', 'tratamiento de materiales.'])],
    ['Los tres mercados principales', '<h3>Fabricantes de maquinaria</h3>' + paragraph('Pueden incorporar automatizacion en maquinas nuevas, redisenos y plataformas estandar.') + '<h3>Integradores e ingenierias</h3>' + paragraph('Pueden prescribir o integrar tecnologia en proyectos de terceros.') + '<h3>Usuario final industrial</h3>' + paragraph('Puede necesitar modernizacion, ampliaciones, nuevas lineas, mantenimiento o digitalizacion.')],
    ['Que senales indican mejor momento comercial', list(['desarrollo de nueva maquina.', 'nueva linea.', 'ampliacion.', 'contratacion de ingenieria.', 'automatizacion o robotizacion.', 'inversiones en calidad.', 'digitalizacion.', 'nueva planta.', 'ayudas industriales.', 'nuevos mercados.'])],
    ['Error habitual', paragraph('Una empresa industrial con buen encaje no es automaticamente una oportunidad. Primero se construye el universo. Despues se identifica que empresas muestran senales activas.')],
  ]],
  ['encontrar-proyectos-industriales-antes-de-la-peticion-de-oferta', 'Como encontrar proyectos industriales antes de la peticion de oferta | InduRadar', 'Como encontrar proyectos industriales antes de la peticion de oferta para vender maquinaria, ingenieria, lineas de produccion e intralogistica.', 'Como encontrar proyectos industriales antes de que llegue la peticion de oferta', 'Llegar cuando el pliego esta cerrado permite ofertar. Llegar durante la definicion del proyecto puede permitir influir.', visuals.timeline, [
    ['La peticion de oferta no suele ser el principio', paragraph('Cuando llega una RFQ, muchas decisiones pueden llevar meses preparandose.') + list(['permisos.', 'suelo.', 'ayudas.', 'contratacion de ingenieria.', 'financiacion.', 'consulta preliminar.', 'ampliacion de capacidad.', 'cambios de producto.', 'obra.', 'licencias.', 'empleo tecnico.'])],
    ['Cuanto antes aparece la senal, mayor incertidumbre', paragraph('Una senal temprana aporta tiempo, pero tambien menos certeza. Conviene distinguir senal temprana, proyecto probable, proyecto confirmado y contratacion.')],
    ['Que fuentes mirar', list(['diarios oficiales.', 'licencias.', 'expedientes ambientales.', 'ayudas.', 'contratacion publica.', 'prensa local.', 'fuentes corporativas.', 'asociaciones.', 'empleo.'])],
    ['El objetivo', paragraph('No se trata de adivinar una compra. Se trata de detectar proyectos suficientemente pronto como para conocer al promotor, identificar actores, entender la necesidad, seguir la evolucion y llegar mejor preparado cuando aparezca la compra.')],
  ]],
  ['anticipar-demanda-consumibles-industriales', 'Como anticipar demanda de consumibles industriales | InduRadar', 'Como anticipar la demanda de consumibles industriales como carton, adhesivos, barnices, ceras, lubricantes, tintas y quimicos.', 'Como anticipar demanda de consumibles industriales', 'Una inversion puede ser un indicador adelantado de demanda recurrente de carton, adhesivo, barniz, cera, tinta, film, lubricante, etiquetas o quimicos.', visuals.matrix, [
    ['Los consumibles tambien tienen senales', paragraph('Un consumible puede parecer una venta recurrente dificil de anticipar. Sin embargo, hay cambios que pueden modificar la demanda.') + list(['aumento de capacidad.', 'nuevas lineas.', 'nuevos productos.', 'nuevas plantas.', 'cambios de proceso.', 'exportacion.', 'crecimiento de produccion.', 'nueva maquinaria.', 'certificaciones.', 'ampliaciones.'])],
    ['El mejor lead no siempre es el mayor cliente', paragraph('Una empresa grande puede tener proveedores totalmente consolidados. Una empresa que abre una linea nueva puede presentar una ventana comercial mucho mas interesante.')],
    ['Investigar el proceso', paragraph('Para consumibles importa especialmente entender que fabrica, como lo fabrica, que materiales consume, que equipos utiliza, que proceso esta creciendo y que cambia en la produccion.')],
  ]],
  ['oportunidades-servicios-industriales-nuevas-fabricas', 'Como detectar oportunidades de servicios industriales | InduRadar', 'Como detectar oportunidades de servicios industriales en nuevas fabricas, ampliaciones y aumentos de produccion.', 'Oportunidades de servicios industriales en nuevas fabricas', 'Una inversion de CAPEX puede convertirse despues en anos de gasto operativo y nuevas necesidades de servicio.', visuals.timeline, [
    ['Una nueva fabrica genera muchas oportunidades distintas', paragraph('Una implantacion industrial puede necesitar mucho mas que maquinaria.') + list(['ingenieria.', 'instalacion electrica.', 'automatizacion.', 'mantenimiento.', 'energia.', 'agua.', 'aire comprimido.', 'climatizacion.', 'tratamiento de residuos.', 'seguridad.', 'IT/OT.', 'logistica.', 'limpieza tecnica.', 'instrumentacion.', 'inspeccion.'])],
    ['La oportunidad cambia segun la fase', paragraph('Anuncio: inteligencia temprana. Permisos: proyecto mas concreto. Construccion: aparecen contratistas y paquetes. Instalacion: aumenta la actividad de proveedores tecnicos. Operacion: mantenimiento, consumibles y mejora continua.')],
    ['No todas las nuevas fabricas son iguales', paragraph('Una planta alimentaria, una quimica y una logistica tienen actores y necesidades diferentes. Conviene analizar el proyecto, no unicamente la noticia de inversion.')],
  ]],
];

for (const [slug, title, description, h1, lead, visual, sections] of expandedExisting) {
  pages.push(articlePage({
    slug: `/recursos/${slug}/`,
    title,
    description,
    h1,
    lead,
    visual,
    reading: '6 min',
    related: [
      { href: '../senales-empresa-industrial-va-a-invertir/', label: 'Senales de que una empresa industrial puede invertir' },
      { href: '../base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
      { href: '../../soluciones/', label: 'Inteligencia comercial segun lo que vendes' },
    ],
    body: simpleSections(sections),
  }));
}

const solutions = [
  ['automatizacion-industrial', 'Oportunidades para proveedores de automatizacion industrial | InduRadar', 'Detectar oportunidades para vender automatizacion industrial', 'InduRadar ayuda a localizar empresas y proyectos donde pueden aparecer necesidades relacionadas con PLC, control, HMI/SCADA, motion, vision, seguridad, sensores, robotica, trazabilidad, conectividad y digitalizacion.', ['nuevas maquinas.', 'lineas.', 'ampliaciones.', 'modernizacion.', 'ayudas.', 'contratacion tecnica.', 'cambios de capacidad.']],
  ['fabricantes-maquinaria', 'Encontrar clientes para fabricantes de maquinaria | InduRadar', 'Encontrar empresas que pueden necesitar nueva maquinaria', 'Un fabricante de maquinaria necesita saber no solo que empresas pertenecen a su mercado, sino cuales pueden estar entrando en una fase de inversion.', ['empresas por sector y proceso.', 'nuevas plantas.', 'ampliaciones.', 'nuevas lineas.', 'ayudas.', 'aumentos de capacidad.', 'cambios de producto.', 'expansion internacional.']],
  ['ingenierias-integradores', 'Oportunidades para ingenierias e integradores | InduRadar', 'Detectar proyectos antes de que la ingenieria este cerrada', 'Permisos, financiacion, nuevas plantas, ampliaciones y cambios de proceso pueden revelar proyectos antes de que todos los paquetes tecnicos esten adjudicados.', ['promotor.', 'planta.', 'fase.', 'actores.', 'proyecto.', 'evidencia.', 'cambios de estado.']],
  ['mantenimiento-industrial', 'Oportunidades de mantenimiento industrial | InduRadar', 'Encontrar oportunidades de mantenimiento industrial', 'La necesidad de mantenimiento crece cuando cambian los activos.', ['nueva maquinaria.', 'ampliaciones.', 'plantas nuevas.', 'modernizacion.', 'aumento de capacidad.', 'nueva automatizacion.', 'nuevas instalaciones.', 'cambios de proceso.']],
  ['energia-agua-residuos-industria', 'Proyectos industriales de energia, agua y residuos | InduRadar', 'Detectar proyectos industriales con necesidades de energia, agua y servicios', 'Las ampliaciones, nuevas fabricas, descarbonizacion, electrificacion y cambios regulatorios pueden generar proyectos tecnicos y de servicios.', ['eficiencia energetica.', 'autoconsumo.', 'almacenamiento.', 'agua.', 'tratamiento.', 'residuos.', 'electrificacion.', 'monitorizacion.', 'servicios energeticos.']],
  ['consumibles-industriales', 'Oportunidades para consumibles industriales | InduRadar', 'Detectar donde puede crecer la demanda de consumibles industriales', 'La demanda cambia cuando cambia la produccion. InduRadar puede localizar empresas donde pueda abrirse una ventana comercial antes de que el consumo se consolide con un proveedor.', ['nueva capacidad.', 'nuevas lineas.', 'nuevas plantas.', 'ampliaciones.', 'cambios de producto.', 'nuevas maquinas.', 'crecimiento de actividad.']],
  ['packaging-industrial', 'Oportunidades de packaging y final de linea | InduRadar', 'Encontrar oportunidades de packaging y final de linea', 'Cambios de formato, nuevos productos, aumento de capacidad y ampliaciones pueden generar necesidades de packaging y automatizacion de final de linea.', ['envasado.', 'encajado.', 'etiquetado.', 'paletizado.', 'transportadores.', 'inspeccion.', 'trazabilidad.', 'wrapping.', 'automatizacion de final de linea.']],
];

for (const [slug, title, h1, lead, signals] of solutions) {
  pages.push({
    slug: `/soluciones/${slug}/`,
    type: 'WebPage',
    title,
    description: `${h1} mediante senales industriales, fuentes publicas y evidencia trazable.`,
    h1,
    lead,
    eyebrow: 'Soluciones',
    visual: visuals.matrix,
    breadcrumbs: [{ name: 'Soluciones', href: '/soluciones/' }, { name: stripHtml(h1), href: `/soluciones/${slug}/` }],
    related: [
      { href: '../../recursos/senales-empresa-industrial-va-a-invertir/', label: 'Senales de que una empresa industrial puede invertir' },
      { href: '../../recursos/base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
      { href: '../../como-funciona-induradar/', label: 'Como funciona InduRadar' },
    ],
    body: simpleSections([
      ['Senales utiles para este perfil', list(signals)],
      ['Como lo usa InduRadar', paragraph('InduRadar cruza sector, proceso, geografia, fuente, senal y momento comercial para localizar situaciones que merecen investigacion o seguimiento.')],
      ['Limite importante', paragraph('Una senal no confirma una compra. Sirve para priorizar donde mirar, que validar y que accion comercial puede tener sentido.')],
    ]),
  });
}

const sectors = [
  ['alimentacion-bebidas', 'Oportunidades industriales en alimentacion y bebidas | InduRadar', 'Oportunidades industriales en alimentacion y bebidas', 'Alimentacion y bebidas combina una base industrial enorme con cambios constantes en producto, capacidad, packaging, frio, trazabilidad y automatizacion.', ['ampliacion de planta.', 'nueva linea.', 'nueva referencia.', 'aumento de capacidad.', 'ayudas.', 'frio industrial.', 'packaging.', 'robotizacion.', 'nuevas instalaciones.'], 'dosificacion, proceso, llenado, envasado, encajado, paletizado, inspeccion, trazabilidad, frio y logistica.'],
  ['packaging-artes-graficas', 'Oportunidades en packaging, impresion y converting | InduRadar', 'Oportunidades en packaging, impresion y converting', 'Nuevos formatos, sostenibilidad, nuevos materiales, capacidad y cambios de producto pueden generar inversion en impresion, laminacion, corte, converting y final de linea.', ['nueva prensa.', 'ampliacion.', 'nuevos formatos.', 'nuevas instalaciones.', 'automatizacion.', 'inversion en calidad.', 'cambios de material.', 'crecimiento de capacidad.'], 'flexografia, digital, laminacion, slitting, rebobinado, etiquetado, packaging flexible, carton y converting.'],
  ['quimica-plasticos', 'Oportunidades industriales en quimica y plasticos | InduRadar', 'Oportunidades industriales en quimica y plasticos', 'Quimica y plasticos pueden generar senales muy valiosas en permisos, medioambiente, nuevas formulaciones, capacidad y renovacion de procesos.', ['expediente ambiental.', 'nueva linea.', 'almacenamiento.', 'ampliacion.', 'electrificacion.', 'reciclaje.', 'nueva capacidad.', 'modernizacion.'], 'mezclado, dosificacion, extrusion, inyeccion, termoformado, compounding, tratamiento, inspeccion y manipulacion.'],
  ['automocion-componentes', 'Oportunidades industriales en automocion y componentes | InduRadar', 'Oportunidades industriales en automocion y componentes', 'Nuevos programas, electrificacion, adjudicaciones de plataformas, nuevos componentes y cambios de proveedor pueden transformar rapidamente la demanda industrial.', ['nuevo programa.', 'nueva linea.', 'adjudicacion.', 'ampliacion.', 'empleo tecnico.', 'electrificacion.', 'bateria.', 'automatizacion.', 'nuevas instalaciones.'], 'ensamblaje, mecanizado, estampacion, soldadura, inspeccion, trazabilidad, manipulacion y logistica interna.'],
  ['metal-maquinaria-fabricacion', 'Oportunidades en metal, maquinaria y fabricacion avanzada | InduRadar', 'Oportunidades en metal, maquinaria y fabricacion avanzada', 'Es uno de los mercados mas fragmentados y dificiles de mapear unicamente mediante CNAE.', ['nueva maquina.', 'nuevos pedidos.', 'ampliacion.', 'nueva nave.', 'robotizacion.', 'exportacion.', 'contratacion tecnica.', 'ayudas.', 'nuevas capacidades.'], 'mecanizado, corte, soldadura, conformado, montaje, tratamiento superficial, inspeccion y fabricacion de maquinaria.'],
];

for (const [slug, title, h1, lead, signals, processes] of sectors) {
  pages.push({
    slug: `/sectores/${slug}/`,
    type: 'WebPage',
    title,
    description: `${h1}: senales, procesos y oportunidades comerciales para proveedores industriales.`,
    h1,
    lead,
    eyebrow: 'Sectores',
    visual: visuals.timeline,
    breadcrumbs: [{ name: 'Sectores', href: '/sectores/' }, { name: stripHtml(h1), href: `/sectores/${slug}/` }],
    related: [
      { href: '../../recursos/senales-empresa-industrial-va-a-invertir/', label: 'Senales de inversion industrial' },
      { href: '../../recursos/buscar-empresas-por-proceso-industrial/', label: 'Como buscar empresas por proceso industrial' },
      { href: '../../soluciones/', label: 'Inteligencia comercial segun lo que vendes' },
    ],
    body: simpleSections([
      ['Senales relevantes', list(signals)],
      ['Procesos a observar', paragraph(processes)],
      ['Para quien puede ser util', paragraph('Automatizacion, maquinaria, packaging, energia, mantenimiento, consumibles, ingenieria y servicios industriales pueden leer senales distintas dentro del mismo sector.')],
    ]),
  });
}

const glossary = [
  ['senal-industrial', 'Que es una senal industrial | InduRadar', 'Que es una senal industrial', 'Una senal industrial es un cambio observable que puede indicar actividad relevante en una empresa o proyecto: una ampliacion, nueva linea, permiso, ayuda, contratacion, inversion o modernizacion.', 'Una senal no equivale automaticamente a una oportunidad. Su valor depende de evidencia, contexto, actualidad y relacion con la oferta comercial.', 'Confundir una noticia aislada con compra confirmada.'],
  ['oportunidad-comercial-industrial', 'Que es una oportunidad comercial industrial | InduRadar', 'Que es una oportunidad comercial industrial', 'Una oportunidad comercial industrial es una situacion donde existen hechos suficientes para justificar una necesidad plausible, una ventana comercial y una siguiente accion.', 'Ayuda a separar cuentas objetivo de situaciones que merecen accion ahora.', 'Confundir una simple empresa objetivo o una noticia con una oportunidad.'],
  ['ampliacion-productiva', 'Que es una ampliacion productiva | InduRadar', 'Que es una ampliacion productiva', 'Una ampliacion productiva es un aumento de capacidad industrial que puede implicar nuevas instalaciones, lineas, maquinaria, turnos, procesos o infraestructuras.', 'Puede anticipar necesidades de maquinaria, automatizacion, servicios, energia, mantenimiento o consumibles.', 'Asumir que toda nueva nave implica una nueva linea productiva.'],
  ['ventana-comercial', 'Que es una ventana comercial | InduRadar', 'Que es una ventana comercial', 'Es el periodo en el que una necesidad, decision o proyecto puede estar suficientemente abierto como para que una accion comercial tenga sentido.', 'Permite priorizar el momento de investigacion, contacto o seguimiento.', 'Llegar demasiado tarde, cuando las decisiones tecnicas ya estan cerradas.'],
  ['inteligencia-comercial-industrial', 'Que es inteligencia comercial B2B industrial | InduRadar', 'Que es inteligencia comercial B2B industrial', 'Es el proceso de transformar fuentes publicas, datos empresariales, senales y evidencia en informacion util para decidir que cuentas y proyectos merecen atencion comercial.', 'Convierte un mercado amplio en decisiones de accion, validacion o monitorizacion.', 'Reducirla a una base de datos o a una alerta de noticias.'],
  ['evidencia-trazable', 'Que es evidencia trazable | InduRadar', 'Que es evidencia trazable', 'Es informacion cuya fuente puede identificarse, revisarse y relacionarse directamente con la afirmacion que pretende sostener.', 'Ayuda a distinguir hechos confirmados, inferencias razonadas y estimaciones.', 'Presentar una inferencia comercial como si fuera un hecho confirmado.'],
];

for (const [slug, title, h1, definition, importance, error] of glossary) {
  pages.push({
    slug: `/glosario/${slug}/`,
    type: 'Article',
    title,
    description: `${h1}: definicion, importancia, ejemplo y errores frecuentes en inteligencia comercial industrial.`,
    h1,
    lead: definition,
    eyebrow: 'Glosario',
    visual: visuals.chain,
    breadcrumbs: [{ name: 'Glosario', href: '/glosario/' }, { name: stripHtml(h1), href: `/glosario/${slug}/` }],
    related: [
      { href: '../../como-funciona-induradar/', label: 'Como funciona InduRadar' },
      { href: '../../recursos/base-datos-vs-inteligencia-comercial-industrial/', label: 'Base de datos vs inteligencia comercial industrial' },
    ],
    body: simpleSections([
      ['Definicion', paragraph(definition)],
      ['Por que importa', paragraph(importance)],
      ['Ejemplo', paragraph('Una ayuda, un permiso, una contratacion tecnica o una ampliacion pueden cambiar la prioridad comercial cuando estan conectados con una necesidad plausible.')],
      ['Errores de interpretacion', paragraph(error)],
    ]),
  });
}

function writeVisuals() {
  const svg = (title, subtitle, items, color = '#075a8f') => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${subtitle}</desc>
  <rect width="1200" height="630" fill="#f4f8fa"/>
  <rect x="54" y="54" width="1092" height="522" rx="18" fill="#ffffff" stroke="#d8e4ea"/>
  <text x="90" y="125" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="800" fill="#102335">${title}</text>
  <text x="90" y="170" font-family="Inter, Arial, sans-serif" font-size="22" fill="#66717c">${subtitle}</text>
  ${items.map((item, i) => {
    const x = 110 + i * Math.floor(950 / Math.max(items.length - 1, 1));
    return `<g><circle cx="${x}" cy="340" r="54" fill="#e2f6f8" stroke="${color}" stroke-width="3"/><text x="${x}" y="347" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="800" fill="#102335">${item}</text>${i < items.length - 1 ? `<path d="M${x + 66} 340 L${x + Math.floor(950 / Math.max(items.length - 1, 1)) - 66} 340" stroke="${color}" stroke-width="4" marker-end="url(#arrow)"/>` : ''}</g>`;
  }).join('')}
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${color}"/></marker></defs>
</svg>`;
  writeFile(`assets/${visuals.chain.file}`, svg('Fuente → Evidencia → Senal → Proyecto → Oportunidad', 'Cadena de trazabilidad comercial', ['Fuente', 'Evidencia', 'Senal', 'Proyecto', 'Oportunidad']));
  writeFile(`assets/${visuals.timeline.file}`, svg('Linea temporal de inversion industrial', 'De senal temprana a operacion', ['Senal', 'Permiso', 'Financiacion', 'Obra', 'Operacion'], '#0d577f'));
  writeFile(`assets/${visuals.layers.file}`, svg('Universo → Senales → Oportunidades', 'Separar encaje, cambio y accion', ['Universo', 'Senales', 'Oportunidades'], '#18bfd7'));
  writeFile(`assets/${visuals.matrix.file}`, svg('Matriz senal / posible necesidad', 'Relacion plausible, no compra confirmada', ['Senal', 'Necesidad', 'Validacion', 'Accion'], '#075a8f'));
}

function writeSitemap() {
  const existingResourceUrls = [
    '/recursos/como-detectar-inversiones-industriales/',
    '/recursos/senales-que-anticipan-una-ampliacion-industrial/',
    '/recursos/oportunidades-automatizacion-industrial/',
    '/recursos/inteligencia-comercial-industrial/',
    '/recursos/detectar-oportunidades-consumibles-industriales/',
  ];
  const urls = [
    ['/', '1.0', 'weekly'],
    ['/privacidad/', '0.3', 'monthly'],
    ['/recursos/', '0.8', 'weekly'],
    ['/soluciones/', '0.7', 'monthly'],
    ['/sectores/', '0.7', 'monthly'],
    ['/glosario/', '0.6', 'monthly'],
    ...existingResourceUrls.map((url) => [url, '0.8', 'monthly']),
    ...pages.map((page) => [page.slug, page.slug.startsWith('/recursos/') ? '0.8' : '0.7', 'monthly']),
  ];
  const unique = new Map(urls.map(([url, priority, freq]) => [url, { priority, freq }]));
  const body = [...unique.entries()].map(([url, { priority, freq }]) => `  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${published}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');
  writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`);
}

function writeSearchChecklist() {
  const checklist = `# Search Console checklist

- [ ] Dominio verificado
- [ ] Sitemap enviado
- [ ] Portada indexada
- [ ] /como-funciona-induradar/ indexada
- [ ] Hub /recursos/ indexado
- [ ] 5 articulos prioritarios inspeccionados
- [ ] Sin bloqueos robots inesperados
- [ ] Sin canonical conflictivas
- [ ] Sin paginas principales con noindex
- [ ] Core Web Vitals revisados
- [ ] Rich Results revisados
`;
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/seo-search-console-checklist.md'), checklist);
}

writeVisuals();
for (const page of pages) writePage(page);
writeHub();
writeIndexPage('/soluciones/', 'Soluciones de inteligencia comercial industrial | InduRadar', 'Inteligencia comercial industrial segun lo que vendes: automatizacion, maquinaria, ingenieria, mantenimiento, energia, consumibles y packaging.', 'Inteligencia comercial industrial segun lo que vendes', 'Las senales que importan cambian segun tu oferta. Una nueva linea puede ser una oportunidad para automatizacion, mantenimiento, consumibles, ingenieria o energia por razones distintas.', [{ eyebrow: 'Perfiles de proveedor', title: 'Soluciones por tipo de oferta', copy: 'Elige el perfil mas cercano a lo que vendes para entender que senales pueden tener mas valor comercial.', items: solutions.map(([slug, title, h1, lead]) => ({ title: h1, href: `${slug}/`, copy: lead, link: h1 })) }], 'Soluciones');
writeIndexPage('/sectores/', 'Sectores industriales | InduRadar', 'Guias sectoriales de inteligencia comercial industrial para alimentacion, packaging, quimica, automocion, metal y fabricacion avanzada.', 'Sectores industriales donde detectar senales de oportunidad', 'Cada sector deja huellas distintas: permisos, ampliaciones, nuevas lineas, cambios de proceso, empleo tecnico o inversiones.', [{ eyebrow: 'Sectores', title: 'Guias sectoriales iniciales', copy: 'Cinco sectores para empezar a aplicar inteligencia comercial industrial con senales y procesos concretos.', items: sectors.map(([slug, title, h1, lead]) => ({ title: h1, href: `${slug}/`, copy: lead, link: h1 })) }], 'Sectores');
writeIndexPage('/glosario/', 'Glosario de inteligencia comercial industrial | InduRadar', 'Definiciones de senal industrial, oportunidad comercial industrial, ampliacion productiva, ventana comercial, inteligencia comercial B2B industrial y evidencia trazable.', 'Glosario de inteligencia comercial industrial', 'Conceptos clave para interpretar empresas, senales, proyectos y oportunidades sin confundir hechos con inferencias.', [{ eyebrow: 'Conceptos', title: 'Definiciones fundamentales', copy: 'Cada entrada incluye definicion, importancia, ejemplo y errores de interpretacion.', items: glossary.map(([slug, title, h1, definition]) => ({ title: h1, href: `${slug}/`, copy: definition, link: h1 })) }], 'Glosario');
writeSitemap();
writeSearchChecklist();

console.log(`Generated ${pages.length} pages, hubs, visuals and sitemap.`);
