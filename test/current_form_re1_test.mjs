import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {contractFromLead, normalizeEngineRequest} from '../site/engine-contract.mjs';
import * as XLSX from 'xlsx';
import * as EdgeXLSX from '../supabase/functions/_shared/xlsx-0.20.3.mjs';
import {workbookFromApprovedJson} from '../site/report/engine-report.mjs';

test('RE1 integration preserves the deployed form, payload builder and authenticated submission path', () => {
  const original = JSON.parse(fs.readFileSync(new URL('./fixtures/current-form-20261118.json', import.meta.url)));
  for (const [path, expected] of Object.entries(original.files_sha256)) {
    const current = fs.readFileSync(new URL('../' + path, import.meta.url));
    assert.equal(createHash('sha256').update(current).digest('hex'), expected, path);
  }
  const optional = fs.readFileSync(new URL('../site/research-engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(optional, /window\.fetch\s*=|createElement|DOMContentLoaded/);
});

test('experimental normalizer cannot drop selected sectors when comparing with the server form', () => {
  const lead = {seller_profile: {offer: 'Automatización'}, request: {
    research_objective: 'signal_discovery', sectors: ['wood_furniture', 'chemicals_petrochemicals'],
    target_company_types: ['machine_builder_oem'], signal_types: ['new_factory'],
    geographies: [{country: 'España', province: 'Albacete'}],
  }};
  const raw = contractFromLead(lead, {scope: 'open_market'});
  const normalized = normalizeEngineRequest(raw, {account_id: 'server-account', submission_id: 'server-submission', as_of: '2026-11-18'});
  assert.deepEqual(normalized.sectors, lead.request.sectors);
  assert.deepEqual(lead.request.sectors, ['wood_furniture', 'chemicals_petrochemicals']);
});

test('portal and worker renderer use identical frozen XLSX bytes for the same finalized JSON', () => {
  const payload = JSON.parse(fs.readFileSync(new URL('./fixtures/research-engine-approved.json', import.meta.url)));
  assert.equal(XLSX.version, '0.20.3');
  assert.equal(EdgeXLSX.version, XLSX.version);
  assert.deepEqual(Buffer.from(workbookFromApprovedJson(EdgeXLSX, payload)),
    Buffer.from(workbookFromApprovedJson(XLSX, payload)));
});
