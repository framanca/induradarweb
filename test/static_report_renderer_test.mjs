import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportViewModel,
  getClientOpportunities,
  getCompanyUniverse,
} from '../site/report/renderer.js';

function signalOpportunity(index) {
  return {
    rank: index + 1,
    company: `Empresa ${String(index + 1).padStart(2, '0')}`,
    title: `Proyecto ${index + 1}`,
    province: 'Valencia',
    country: 'España',
    signal_count: index % 4 + 1,
    signals: [{
      title: `Señal ${index + 1}`,
      summary: `Hecho verificado ${index + 1}`,
      signal_type: 'facility_expansion',
      source_refs: [`https://example.com/source-${index + 1}`],
    }],
    next_action: `Acción ${index + 1}`,
    target_role: 'Ingeniería',
  };
}

test('client signal-ranked opportunities are the primary web portfolio', () => {
  const signalOpportunities = Array.from({ length: 25 }, (_, index) => signalOpportunity(index));
  const payload = {
    opportunities: [{ title: 'Formal only', companies: [{ name: 'Formal' }], signals: [] }],
    portfolio_summary: { client_layers: { signal_opportunities: signalOpportunities } },
  };

  assert.equal(getClientOpportunities(payload).length, 25);
  const model = buildReportViewModel({ report_reference: 'IR-20260915-ABC123', payload });
  assert.equal(model.opportunities.length, 25, 'renderer must not impose a top-20 cap');
  assert.equal(model.opportunities[0].company, 'Empresa 01');
  assert.equal(model.opportunities[24].company, 'Empresa 25');
});

test('empty signal-ranked client layer does not fall back to internal formal opportunities', () => {
  const payload = {
    opportunities: [{ title: 'Internal formal opportunity' }],
    portfolio_summary: { client_layers: { signal_opportunities: [] } },
  };
  assert.deepEqual(getClientOpportunities(payload), []);
});

test('editorial prose is optional and preserved when already embedded', () => {
  const item = signalOpportunity(0);
  item.editorial = {
    schema_version: '1.0.0',
    why_now: 'La fase actual abre una ventana comercial.',
    probable_need: 'Automatización e inspección.',
  };
  const model = buildReportViewModel({
    report_reference: 'IR-20260915-ABC123',
    payload: { portfolio_summary: { client_layers: { signal_opportunities: [item], company_universe: [] } } },
  });
  assert.equal(model.opportunities[0].editorial.why_now, 'La fase actual abre una ventana comercial.');
  assert.equal(model.opportunities[0].nextAction, 'Acción 1');
});

test('company universe remains a separate lossless collection', () => {
  const payload = {
    portfolio_summary: {
      client_layers: {
        signal_opportunities: [signalOpportunity(0)],
        company_universe: Array.from({ length: 31 }, (_, index) => ({
          company: `Universo ${index + 1}`,
          province: 'Alicante',
          country: 'España',
        })),
      },
    },
  };
  assert.equal(getCompanyUniverse(payload).length, 31);
  const model = buildReportViewModel({ payload });
  assert.equal(model.opportunities.length, 1);
  assert.equal(model.universe.length, 31);
});

test('sources remain traceable and are deduplicated for summary metrics only', () => {
  const model = buildReportViewModel({
    payload: {
      portfolio_summary: { client_layers: { signal_opportunities: [], company_universe: [] } },
      source_index: [
        { title: 'Fuente A', canonical_url: 'https://example.com/a' },
        { title: 'Fuente A repetida', canonical_url: 'https://example.com/a' },
        { title: 'Fuente B', canonical_url: 'https://example.com/b' },
      ],
    },
  });
  assert.equal(model.sources.length, 3, 'source index membership stays untouched');
  assert.deepEqual(model.sourceUrls, ['https://example.com/a', 'https://example.com/b']);
});
