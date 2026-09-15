const EMPTY_OBJECT = Object.freeze({});

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : EMPTY_OBJECT;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))];
}

function clientLayers(payload) {
  return asObject(asObject(payload.portfolio_summary).client_layers);
}

export function getClientOpportunities(payload) {
  const layers = clientLayers(payload);
  if (Array.isArray(layers.signal_opportunities)) return layers.signal_opportunities;
  return asArray(payload.opportunities);
}

export function getCompanyUniverse(payload) {
  const layers = clientLayers(payload);
  if (Array.isArray(layers.company_universe)) return layers.company_universe;
  return asArray(payload.companies);
}

export function getSignalWatchlist(payload) {
  const layers = clientLayers(payload);
  if (Array.isArray(layers.signal_watchlist)) return layers.signal_watchlist;
  return asArray(payload.watchlist);
}

function mapSignal(signal) {
  const sourceRefs = uniqueStrings([
    ...asArray(signal.source_refs),
    ...asArray(signal.evidence).flatMap((evidence) => {
      const sourceItem = asObject(evidence?.source_item);
      return [sourceItem.canonical_url];
    }),
  ]);
  return {
    title: firstNonEmpty(signal.title, signal.summary, 'Señal verificada'),
    summary: firstNonEmpty(signal.summary),
    type: firstNonEmpty(signal.signal_type, signal.signal_type_code),
    date: firstNonEmpty(signal.signal_at, signal.happened_at, signal.published_at, signal.detected_at),
    externalSupport: signal.external_support === true,
    sourceRefs,
  };
}

function mapFormalOpportunity(item) {
  const company = asObject(asArray(item.companies)[0]);
  const site = asObject(asArray(company.sites)[0]);
  const signals = asArray(item.signals).map(mapSignal);
  const evidenceRefs = asArray(item.evidence_bundle).map((evidence) => asObject(evidence?.source_item).canonical_url);
  return {
    rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : null,
    company: firstNonEmpty(company.name, item.title, 'Empresa'),
    title: firstNonEmpty(item.title, company.name, 'Oportunidad'),
    companyType: firstNonEmpty(company.company_type_code),
    website: firstNonEmpty(company.website),
    location: uniqueStrings([site.municipality, site.province, site.country]).join(' · '),
    signalCount: signals.length,
    signals,
    nextAction: firstNonEmpty(item.next_action),
    targetRole: firstNonEmpty(item.target_role),
    window: firstNonEmpty(item.window),
    editorial: asObject(item.editorial),
    sourceRefs: uniqueStrings([...signals.flatMap((signal) => signal.sourceRefs), ...evidenceRefs]),
    probableNeeds: asArray(item.probable_needs).filter((value) => typeof value === 'string' && value.trim()),
    risks: asArray(item.risks).filter((value) => typeof value === 'string' && value.trim()),
    classification: firstNonEmpty(item.classification, 'opportunity'),
  };
}

function mapSignalOpportunity(item) {
  const signals = asArray(item.signals).map(mapSignal);
  return {
    rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : null,
    company: firstNonEmpty(item.company, item.title, 'Empresa'),
    title: firstNonEmpty(item.title, item.company, 'Oportunidad'),
    companyType: firstNonEmpty(item.company_type),
    website: firstNonEmpty(item.website),
    location: uniqueStrings([item.municipality, item.province, item.country]).join(' · '),
    signalCount: Number.isFinite(Number(item.signal_count)) ? Number(item.signal_count) : signals.length,
    signals,
    nextAction: firstNonEmpty(item.next_action),
    targetRole: firstNonEmpty(item.target_role),
    window: firstNonEmpty(item.window),
    editorial: asObject(item.editorial),
    sourceRefs: uniqueStrings([...asArray(item.source_refs), ...signals.flatMap((signal) => signal.sourceRefs)]),
    probableNeeds: asArray(item.probable_needs).filter((value) => typeof value === 'string' && value.trim()),
    risks: asArray(item.risks).filter((value) => typeof value === 'string' && value.trim()),
    classification: firstNonEmpty(item.classification, 'signal_opportunity'),
  };
}

function mapOpportunity(item) {
  return typeof item?.company === 'string' ? mapSignalOpportunity(item) : mapFormalOpportunity(asObject(item));
}

function mapUniverseCompany(item) {
  const value = asObject(item);
  const sites = asArray(value.sites);
  const firstSite = asObject(sites[0]);
  return {
    name: firstNonEmpty(value.company, value.name, value.legal_name, 'Empresa'),
    activity: firstNonEmpty(value.activity, value.company_type, value.company_type_code, value.fit_rationale),
    location: uniqueStrings([
      value.municipality,
      value.province,
      value.country,
      firstSite.municipality,
      firstSite.province,
      firstSite.country,
    ]).slice(0, 3).join(' · '),
    website: firstNonEmpty(value.website),
    status: firstNonEmpty(value.research_status, value.review_status, value.status, 'Identificada en el universo'),
  };
}

export function buildReportViewModel(documentPayload) {
  const envelope = asObject(documentPayload);
  const payload = asObject(envelope.payload ?? envelope);
  const metadata = asObject(payload.metadata);
  const executive = asObject(payload.executive_summary);
  const counts = asObject(executive.counts);
  const opportunities = getClientOpportunities(payload).map(mapOpportunity);
  const universe = getCompanyUniverse(payload).map(mapUniverseCompany);
  const sources = asArray(payload.source_index);
  const sourceUrls = uniqueStrings(sources.map((item) => firstNonEmpty(item?.canonical_url, item?.url)));

  return {
    reference: firstNonEmpty(envelope.report_reference, payload.report_reference, metadata.report_reference),
    asOf: firstNonEmpty(envelope.as_of, metadata.as_of),
    title: firstNonEmpty(metadata.report_title, asObject(payload.scope).title, 'Informe de señales y oportunidades industriales'),
    rendererVersion: firstNonEmpty(envelope.renderer_version, asObject(payload.render_contract).web_report_renderer_version, '1.0.0'),
    executive,
    counts,
    opportunities,
    universe,
    watchlist: getSignalWatchlist(payload),
    ecosystem: asArray(payload.ecosystem),
    actions: asArray(payload.client_actions),
    limitations: asArray(payload.limitations),
    sectionNarratives: asObject(payload.section_narratives),
    sources,
    sourceUrls,
    scope: asObject(payload.scope),
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function safeLink(url, label) {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(value)) return null;
  const link = element('a', 'source-link', label || value);
  link.href = value;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function addList(parent, values, className = 'plain-list') {
  const items = asArray(values).filter((value) => typeof value === 'string' && value.trim());
  if (!items.length) return;
  const list = element('ul', className);
  for (const value of items) list.append(element('li', '', value));
  parent.append(list);
}

function addLabeledText(parent, label, value) {
  if (typeof value !== 'string' || !value.trim()) return;
  const block = element('div', 'fact-block');
  block.append(element('h4', '', label), element('p', '', value.trim()));
  parent.append(block);
}

function addEditorial(parent, opportunity) {
  const editorial = opportunity.editorial;
  if (!editorial || editorial === EMPTY_OBJECT || Object.keys(editorial).length === 0) return false;
  const section = element('section', 'editorial-grid');
  addLabeledText(section, 'Por qué importa ahora', editorial.why_now);
  addLabeledText(section, 'Necesidad probable', editorial.probable_need);
  addLabeledText(section, 'Encaje y rol objetivo', editorial.fit_and_role);
  addLabeledText(section, 'Actores y cadena de decisión', editorial.actor_chain);
  addLabeledText(section, 'Riesgos y cautelas', editorial.risk_cautions);
  addLabeledText(section, 'Siguiente acción', editorial.next_action);
  if (asArray(editorial.confirmed_facts).length) {
    const block = element('div', 'fact-block');
    block.append(element('h4', '', 'Hechos confirmados'));
    addList(block, editorial.confirmed_facts);
    section.append(block);
  }
  if (asArray(editorial.validation_gaps).length) {
    const block = element('div', 'fact-block');
    block.append(element('h4', '', 'Qué falta por validar'));
    addList(block, editorial.validation_gaps);
    section.append(block);
  }
  if (!section.childNodes.length) return false;
  parent.append(section);
  return true;
}

function renderSignals(parent, opportunity) {
  if (!opportunity.signals.length) return;
  const details = element('details', 'signal-details');
  const summary = element('summary', '', `${opportunity.signalCount} señal${opportunity.signalCount === 1 ? '' : 'es'} material${opportunity.signalCount === 1 ? '' : 'es'}`);
  details.append(summary);
  const list = element('div', 'signal-list');
  for (const signal of opportunity.signals) {
    const card = element('article', 'signal-card');
    const meta = uniqueStrings([signal.type, signal.date ? signal.date.slice(0, 10) : '']).join(' · ');
    card.append(element('h4', '', signal.title));
    if (meta) card.append(element('p', 'signal-meta', meta));
    if (signal.summary && signal.summary !== signal.title) card.append(element('p', '', signal.summary));
    if (signal.sourceRefs.length) {
      const links = element('div', 'source-links');
      signal.sourceRefs.forEach((url, index) => {
        const link = safeLink(url, `Fuente ${index + 1}`);
        if (link) links.append(link);
      });
      card.append(links);
    }
    list.append(card);
  }
  details.append(list);
  parent.append(details);
}

function renderOpportunity(opportunity) {
  const details = element('details', 'opportunity-card');
  details.dataset.search = [opportunity.company, opportunity.title, opportunity.location, ...opportunity.signals.map((s) => s.title)].join(' ').toLowerCase();
  const summary = element('summary', 'opportunity-summary');
  const rank = opportunity.rank !== null ? `#${opportunity.rank}` : '•';
  const heading = element('div', 'opportunity-heading');
  heading.append(element('span', 'rank-chip', rank), element('strong', '', opportunity.company));
  const chips = element('div', 'chips');
  chips.append(element('span', '', `${opportunity.signalCount} señal${opportunity.signalCount === 1 ? '' : 'es'}`));
  if (opportunity.location) chips.append(element('span', '', opportunity.location));
  summary.append(heading, chips);
  details.append(summary);

  const body = element('div', 'opportunity-body');
  if (opportunity.title && opportunity.title !== opportunity.company) body.append(element('h3', '', opportunity.title));
  const hasEditorial = addEditorial(body, opportunity);
  if (!hasEditorial) {
    if (opportunity.probableNeeds.length) {
      const needs = element('div', 'fact-block');
      needs.append(element('h4', '', 'Necesidades probables'));
      addList(needs, opportunity.probableNeeds);
      body.append(needs);
    }
    addLabeledText(body, 'Siguiente acción recomendada', opportunity.nextAction);
    addLabeledText(body, 'Rol objetivo', opportunity.targetRole);
    if (opportunity.risks.length) {
      const risks = element('div', 'fact-block');
      risks.append(element('h4', '', 'Riesgos y cautelas'));
      addList(risks, opportunity.risks);
      body.append(risks);
    }
  }
  renderSignals(body, opportunity);
  if (opportunity.website) {
    const link = safeLink(opportunity.website, 'Web de la empresa');
    if (link) body.append(link);
  }
  details.append(body);
  return details;
}

function renderExecutive(model) {
  const section = element('section', 'report-section executive-section');
  section.id = 'resumen';
  section.append(element('p', 'eyebrow', 'Resumen ejecutivo'), element('h2', '', 'La lectura en 60 segundos'));
  const narrative = firstNonEmpty(model.executive.conclusion, model.executive.summary, model.executive.main_conclusion);
  if (narrative) section.append(element('p', 'lead-copy', narrative));
  const metrics = element('div', 'metric-grid');
  const metricValues = [
    ['Oportunidades', model.opportunities.length],
    ['Universo', model.universe.length],
    ['Fuentes', model.sourceUrls.length || model.sources.length],
    ['Ecosistema', model.ecosystem.length],
  ];
  for (const [label, value] of metricValues) {
    const card = element('div', 'metric-card');
    card.append(element('strong', '', value), element('span', '', label));
    metrics.append(card);
  }
  section.append(metrics);
  if (model.actions.length) {
    const actions = element('div', 'action-block');
    actions.append(element('h3', '', 'Acciones recomendadas'));
    const list = element('ul', 'plain-list');
    for (const action of model.actions) {
      const text = typeof action === 'string' ? action : firstNonEmpty(action?.action, action?.summary, action?.title);
      if (text) list.append(element('li', '', text));
    }
    if (list.childNodes.length) actions.append(list);
    section.append(actions);
  }
  return section;
}

function renderUniverse(model) {
  const section = element('section', 'report-section');
  section.id = 'universo';
  section.append(element('p', 'eyebrow', 'Universo empresarial'), element('h2', '', `${model.universe.length} empresas identificadas`));
  section.append(element('p', 'section-copy', 'La inclusión en el universo no implica investigación individual, intención de compra ni oportunidad.'));
  const tableWrap = element('div', 'table-wrap');
  const table = element('table', 'universe-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Empresa', 'Actividad / tipo', 'Localización', 'Estado'].forEach((label) => headRow.append(element('th', '', label)));
  head.append(headRow);
  table.append(head);
  const body = document.createElement('tbody');
  for (const company of model.universe) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const website = safeLink(company.website, company.name);
    nameCell.append(website ?? document.createTextNode(company.name));
    row.append(nameCell, element('td', '', company.activity), element('td', '', company.location), element('td', '', company.status));
    body.append(row);
  }
  table.append(body);
  tableWrap.append(table);
  section.append(tableWrap);
  return section;
}

function renderSources(model) {
  const section = element('section', 'report-section');
  section.id = 'fuentes';
  section.append(element('p', 'eyebrow', 'Trazabilidad'), element('h2', '', 'Fuentes públicas'));
  const list = element('ol', 'source-index');
  for (const item of model.sources) {
    const source = asObject(item);
    const url = firstNonEmpty(source.canonical_url, source.url);
    const label = firstNonEmpty(source.title, source.source_title, source.source_name, url, 'Fuente');
    const li = document.createElement('li');
    const link = safeLink(url, label);
    li.append(link ?? document.createTextNode(label));
    if (source.source_name && source.source_name !== label) li.append(document.createTextNode(` · ${source.source_name}`));
    list.append(li);
  }
  if (!list.childNodes.length) list.append(element('li', '', 'No hay fuentes cliente-visibles en esta proyección.'));
  section.append(list);
  return section;
}

export function renderReport(root, model) {
  root.replaceChildren();
  root.append(renderExecutive(model));

  const opportunities = element('section', 'report-section');
  opportunities.id = 'oportunidades';
  const header = element('div', 'section-header');
  const text = element('div');
  text.append(element('p', 'eyebrow', 'Oportunidades ordenadas por señales'), element('h2', '', `${model.opportunities.length} oportunidades vigentes`));
  const search = element('input', 'report-search');
  search.type = 'search';
  search.placeholder = 'Buscar empresa, señal o localidad';
  search.setAttribute('aria-label', 'Buscar en oportunidades');
  header.append(text, search);
  opportunities.append(header);
  const list = element('div', 'opportunity-list');
  model.opportunities.forEach((opportunity) => list.append(renderOpportunity(opportunity)));
  opportunities.append(list);
  root.append(opportunities);

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const card of list.children) card.hidden = Boolean(query) && !card.dataset.search.includes(query);
  });

  if (model.universe.length) root.append(renderUniverse(model));

  if (model.limitations.length) {
    const limitations = element('section', 'report-section');
    limitations.id = 'limitaciones';
    limitations.append(element('p', 'eyebrow', 'Límites'), element('h2', '', 'Limitaciones de interpretación'));
    const values = model.limitations.map((item) => typeof item === 'string' ? item : firstNonEmpty(item?.description, item?.reason, item?.summary)).filter(Boolean);
    addList(limitations, values);
    root.append(limitations);
  }

  root.append(renderSources(model));
}
