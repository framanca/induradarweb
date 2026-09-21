import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const reportJs = fs.readFileSync('site/report/report.js', 'utf8');
const portalJs = fs.readFileSync('site/portal/portal.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/get-report/index.ts', 'utf8');

test('report viewer supports authenticated XLSX download', () => {
  assert.match(reportJs, /format[^\n]*xlsx|downloadXlsx/);
  assert.match(reportJs, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(reportJs, /download[^\n]*xlsx/);
});

test('portal exposes XLSX download and email-link actions', () => {
  assert.match(portalJs, /Descargar Excel/);
  assert.match(portalJs, /Enviar enlace Excel/);
  assert.match(portalJs, /email_download_link/);
});

test('get-report materializes XLSX from approved report payload and reuses storage', () => {
  assert.match(edge, /get_xlsx_export_payload_by_reference_v1/);
  assert.match(edge, /report-exports/);
  assert.match(edge, /register_report_xlsx_export_v1/);
  assert.match(edge, /xlsx-deterministic-v2\.0\.0/);
  assert.match(edge, /Opportunity Rank/);
  assert.match(edge, /Signal Strength/);
  assert.match(edge, /Earliness/);
  assert.match(edge, /Temperature/);
});

test('email delivery is link-only for XLSX', () => {
  assert.match(edge, /email_download_link/);
  assert.match(edge, /download=xlsx/);
  assert.doesNotMatch(edge, /attachments\s*:/);
});
