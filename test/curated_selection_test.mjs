import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validReference, safeUrl, validateSelection, renderSelection, dateLabel } from '../site/selection/renderer.js';

const REF = 'IR-20260926-ABC123';
function fixture() {
  return {
    report_schema_version: 'curated-selection-light-1.0.0', report_reference: REF,
    metadata: { report_title: 'Selección de prueba', as_of: '2026-09-25', source_report_reference: 'IR-20260925-ABC123' },
    selection_method: { selected: 30, source_cards_reviewed: 231 },
    executive_summary: { conclusion: 'Resumen de prueba.\n\nSin datos privados.' }, limitations: ['Hipótesis por validar.'],
    opportunities: Array.from({ length: 30 }, (_, i) => ({
      rank: i + 1, company: `Empresa ${i + 1}`, country: 'España', website: 'https://example.test/', source_fit_status: i ? 'confirmed' : 'pending',
      sources: ['https://example.test/source'], signals: [{ title: `Señal ${i}`, summary: 'Hecho documentado.', date: '2026-09-01', sources: ['https://example.test/source'], external_support: true }],
      analysis: { priority_group: i < 20 ? 'Cualificar primero' : 'Posicionamiento', potential: 'Alto condicionado', case_type: 'Equipos', selection_reason: 'Motivo editorial.', package_hypothesis: 'Subconjuntos bajo plano.', moment: 'Desarrollo', moment_reason: 'Fase estimada.', buyer_role: 'Ingeniería', next_action: 'Cualificar.', unknowns: 'Homologación pendiente.', caution: 'No es un pedido.' }
    }))
  };
}
class Node {
  constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag; this.children = []; this.dataset = {}; this.events = {}; this.value = ''; this.hidden = false; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(event, fn) { this.events[event] = fn; }
}
class Document { createElement(tag) { return new Node(this, tag); } }
function all(root) { return [root, ...root.children.flatMap(all)]; }

test('references, dates and link protocols are constrained', () => {
  assert.equal(validReference(REF), true); assert.equal(validReference('../report'), false);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'https://name:secret@example.test/']) assert.equal(safeUrl(url), '');
  assert.equal(safeUrl('https://example.test/path'), 'https://example.test/path');
  assert.equal(dateLabel('2026-09-25T23:59:00Z'), '25/09/2026');
});
test('selection rejects count, rank, reference and missing-evidence corruption', () => {
  const a = fixture(); a.opportunities.pop(); assert.throws(() => validateSelection(a, REF));
  const b = fixture(); b.opportunities[1].rank = 1; assert.throws(() => validateSelection(b, REF));
  const c = fixture(); c.opportunities[0].sources = []; assert.throws(() => validateSelection(c, REF));
  assert.throws(() => validateSelection(fixture(), 'IR-20260926-XYZ123'));
});
test('renders all 30 cards, all evidence, original pending fit and two groups', () => {
  const root = new Node(new Document(), 'main');
  const result = renderSelection(root, fixture(), REF);
  assert.deepEqual(result, { renderedCount: 30, qualifyingCount: 20, positioningCount: 10 });
  const nodes = all(root);
  assert.equal(nodes.filter(n => n.tagName === 'article').length, 30);
  assert.equal(nodes.filter(n => n.className === 'signal').length, 30);
  assert.equal(nodes.filter(n => n.className === 'badge caution').length, 1);
  assert.equal(nodes.filter(n => n.className === 'source-report-link').length, 1);
  assert.equal(new Set(nodes.filter(n => n.tagName === 'article').map(n => n.id)).size, 30);
});
test('filtering is reversible and does not remove retained card data', () => {
  const root = new Node(new Document(), 'main'); renderSelection(root, fixture(), REF);
  const nodes = all(root), select = nodes.find(n => n.tagName === 'select');
  select.value = 'Posicionamiento'; select.events.change();
  assert.equal(nodes.filter(n => n.tagName === 'article' && !n.hidden).length, 10);
  select.value = ''; select.events.change();
  assert.equal(nodes.filter(n => n.tagName === 'article' && !n.hidden).length, 30);
});
test('source text is never interpreted as HTML', () => {
  const p = fixture(); p.opportunities[0].company = '<img src=x onerror=alert(1)>';
  const root = new Node(new Document(), 'main'); renderSelection(root, p, REF);
  assert.equal(all(root).filter(n => n.tagName === 'img').length, 0);
  assert.ok(all(root).some(n => n.textContent === p.opportunities[0].company));
  const source = fs.readFileSync(new URL('../site/selection/renderer.js', import.meta.url), 'utf8');
  assert.equal(/innerHTML|insertAdjacentHTML|document\.write|\beval\(/.test(source), false);
});
test('viewer requires session, uses authorized RPC and clears on sign out', () => {
  const source = fs.readFileSync(new URL('../site/selection/selection.js', import.meta.url), 'utf8');
  assert.match(source, /currentSession/); assert.match(source, /get_curated_report_v1/); assert.match(source, /SIGNED_OUT/); assert.match(source, /clearReport\(\)/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|eyJhbGci/);
  const portal = fs.readFileSync(new URL('../site/portal/curated-links.js', import.meta.url), 'utf8');
  assert.match(portal, /curated_ready/); assert.match(portal, /\/selection\/\?ref=/);
  assert.doesNotMatch(portal, /\.from\(/);
});
