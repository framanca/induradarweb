// Deterministic, text-only rendering of the approved selection payload.
export const validReference = value => /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(String(value || ''));
export function safeUrl(value) {
  try { const u = new URL(String(value || '')); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function validateSelection(p, reference) {
  if (!p || p.report_schema_version !== 'curated-selection-light-1.0.0' || !validReference(reference) || p.report_reference !== reference) throw new Error('invalid_selection');
  const n = Number(p.selection_method?.selected), rows = p.opportunities;
  if (!Number.isInteger(n) || n < 1 || !Array.isArray(rows) || rows.length !== n) throw new Error('selection_count_mismatch');
  const ranks = new Set();
  for (const r of rows) {
    if (!Number.isInteger(r.rank) || r.rank < 1 || r.rank > n || ranks.has(r.rank) || !String(r.company || '').trim()) throw new Error('invalid_selection_row');
    if (!r.analysis || !Array.isArray(r.signals) || !r.signals.length || !Array.isArray(r.sources) || !r.sources.length) throw new Error('missing_selection_evidence');
    ranks.add(r.rank);
  }
  return [...rows].sort((a, b) => a.rank - b.rank);
}
const normalized = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export function dateLabel(value) { const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : 'Fecha no precisada'; }
export function renderSelection(root, p, reference) {
  const rows = validateSelection(p, reference), d = root.ownerDocument;
  function node(tag, text, cls) { const n = d.createElement(tag); if (text != null) n.textContent = String(text); if (cls) n.className = cls; return n; }
  function link(url, text) { const href = safeUrl(url); if (!href) return node('span', text || url); const a = node('a', text || href); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  function sources(urls) { const ul = node('ul', null, 'source-links'); for (const url of [...new Set(urls || [])]) { const li = node('li'); li.append(link(url)); ul.append(li); } return ul; }
  function block(title, text, cls = '') { const b = node('div', null, `analysis-block ${cls}`); b.append(node('h3', title), node('p', text || 'No consta en la selección.')); return b; }
  root.replaceChildren(); root.className = 'curated-document';
  const intro = node('header', null, 'report-intro');
  intro.append(node('p', 'SELECCIÓN COMERCIAL · EVIDENCIA Y ACCIÓN', 'eyebrow'), node('h1', p.metadata?.report_title || 'Selección de oportunidades'), node('p', `${reference} · Evidencia hasta ${dateLabel(p.metadata?.as_of)}`, 'report-meta'), node('p', 'Priorización editorial de un informe aprobado. No es una investigación nueva ni una relación de pedidos abiertos.', 'standfirst'));
  root.append(intro);
  const first = rows.filter(r => r.analysis.priority_group === 'Cualificar primero').length, positioning = rows.filter(r => r.analysis.priority_group === 'Posicionamiento').length;
  const stats = node('section', null, 'statistics'); stats.setAttribute('aria-label', 'Alcance de la selección');
  for (const [label, count] of [['Oportunidades seleccionadas', rows.length], ['Cualificar primero', first], ['Posicionamiento', positioning], ['Fichas revisadas', p.selection_method.source_cards_reviewed]]) { const b = node('div', null, 'stat'); b.append(node('strong', count), node('span', label)); stats.append(b); }
  root.append(stats);
  const summary = node('section', null, 'summary-panel'); summary.append(node('h2', 'Dónde concentrar el esfuerzo'));
  for (const text of String(p.executive_summary?.conclusion || '').split(/\n\s*\n/).filter(Boolean)) summary.append(node('p', text));
  root.append(summary);
  const toolbar = node('section', null, 'selection-filters'), searchLabel = node('label', 'Buscar empresa o aplicación'), search = node('input');
  search.type = 'search'; search.placeholder = 'Nombre, equipo o paquete de suministro…'; search.setAttribute('aria-label', 'Buscar en la selección'); searchLabel.append(search);
  const groupLabel = node('label', 'Prioridad de actuación'), group = node('select');
  for (const [v, text] of [['', 'Todas las seleccionadas'], ['Cualificar primero', 'Cualificar primero'], ['Posicionamiento', 'Posicionamiento']]) { const o = node('option', text); o.value = v; group.append(o); }
  groupLabel.append(group); const count = node('p', '', 'filter-count'); count.setAttribute('role', 'status'); toolbar.append(searchLabel, groupLabel, count); root.append(toolbar);
  const index = node('section', null, 'index-panel'); index.id = 'seleccion'; index.append(node('h2', 'Prioridad comparativa'), node('p', 'Orden por encaje, paquete abordable, repetición y momento. La prioridad no confirma una compra ni una homologación.'));
  const wrap = node('div', null, 'table-scroll'), table = node('table'), head = node('thead'), tr = node('tr'), body = node('tbody');
  for (const text of ['N.º', 'Empresa y aplicación', 'Momento estimado', 'Potencial', 'Actuación']) tr.append(node('th', text)); head.append(tr); table.append(head, body); wrap.append(table); index.append(wrap); root.append(index);
  const cards = node('section', null, 'opportunity-cards'); cards.id = 'oportunidades'; const filtered = [];
  for (const r of rows) {
    const a = r.analysis, id = `oportunidad-${r.rank}`, row = node('tr'), cell = node('td'), jump = node('a', r.company); jump.href = `#${id}`;
    cell.append(jump, node('small', a.case_type)); row.append(node('td', String(r.rank).padStart(2, '0')), cell, node('td', a.moment), node('td', a.potential), node('td', a.priority_group)); body.append(row);
    const card = node('article', null, 'opportunity-card'); card.id = id; card.dataset.rank = String(r.rank);
    const header = node('header', null, 'card-header'), company = node('div');
    company.append(node('h2', r.company), node('p', [a.case_type, [...new Set([r.municipality, r.province, r.country].filter(Boolean))].join(' · ')].filter(Boolean).join(' — '), 'company-meta'));
    if (safeUrl(r.website)) company.append(link(r.website, 'Web de la empresa'));
    header.append(node('span', String(r.rank).padStart(2, '0'), 'rank'), company); card.append(header);
    const badges = node('div', null, 'badges'); badges.append(node('span', a.priority_group, a.priority_group === 'Posicionamiento' ? 'badge positioning' : 'badge'), node('span', `Potencial ${String(a.potential).toLowerCase()}`, 'badge neutral'));
    if (r.source_fit_status === 'pending') badges.append(node('span', 'Encaje de origen pendiente de validar', 'badge caution')); card.append(badges);
    card.append(block('Por qué está en la selección', a.selection_reason, 'selection-reason'));
    const grid = node('div', null, 'analysis-grid'); grid.append(block('Qué podría fabricar Lemar · hipótesis', a.package_hypothesis), block(`Momento estimado · ${a.moment}`, a.moment_reason), block('Función compradora que conviene cualificar', a.buyer_role), block('Siguiente paso comercial', a.next_action, 'next-action')); card.append(grid);
    card.append(block('Qué falta confirmar', a.unknowns, 'uncertainty'), block('Precaución de interpretación', a.caution, 'uncertainty'));
    const facts = node('details', null, 'evidence'); facts.append(node('summary', `Hechos y fuentes documentados · ${r.signals.length} registros de señal`), node('p', 'Registros conservados del informe de origen. Varias publicaciones pueden describir un mismo hecho; no sumarlas como compras independientes.', 'evidence-note'));
    for (const s of r.signals) { const item = node('section', null, 'signal'); item.append(node('h4', s.title), node('p', `${dateLabel(s.date)} · ${s.external_support ? 'Con soporte externo registrado' : 'Soporte corporativo registrado'}`, 'signal-meta'), node('p', s.summary), sources(s.sources)); facts.append(item); }
    const all = node('details', null, 'all-sources'); all.append(node('summary', 'Todas las fuentes de esta ficha'), sources(r.sources)); facts.append(all); card.append(facts);
    const back = node('a', 'Volver al índice', 'back-index'); back.href = '#seleccion'; card.append(back); cards.append(card);
    filtered.push({ row, card, group: a.priority_group, text: normalized(`${r.company} ${a.case_type} ${a.package_hypothesis}`) });
  }
  root.append(cards);
  const method = node('section', null, 'method-panel'); method.id = 'metodo'; method.append(node('h2', 'Criterio de selección y límites'), node('p', 'Primero: producto o equipo propio y aplicación mecánica. Después: paquete abordable, repetición y momento de entrada. Se penalizan la compra indirecta no resuelta, la ventana pasada, la duplicación de un caso y las barreras técnicas sin acreditar.'));
  const limits = node('ul'); for (const text of p.limitations || []) limits.append(node('li', text)); method.append(limits);
  const source = p.metadata?.source_report_reference;
  if (validReference(source)) { const a = node('a', `Consultar informe completo ${source}`, 'source-report-link'); a.href = `/report/?ref=${encodeURIComponent(source)}`; method.append(a); }
  root.append(method);
  function applyFilter() { let n = 0; for (const item of filtered) { const show = (!search.value.trim() || item.text.includes(normalized(search.value.trim()))) && (!group.value || item.group === group.value); item.row.hidden = item.card.hidden = !show; if (show) n++; } count.textContent = `${n} de ${rows.length} oportunidades visibles`; }
  search.addEventListener('input', applyFilter); group.addEventListener('change', applyFilter); applyFilter();
  return { renderedCount: rows.length, qualifyingCount: first, positioningCount: positioning };
}
