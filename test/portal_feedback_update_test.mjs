import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const portalHtml = fs.readFileSync('site/portal/index.html', 'utf8');
const portalJs = fs.readFileSync('site/portal/portal.js', 'utf8');
const reportHtml = fs.readFileSync('site/report/index.html', 'utf8');
const reportJs = fs.readFileSync('site/report/report.js', 'utf8');
const notifier = fs.readFileSync('supabase/functions/notify-service-request/index.ts', 'utf8');

test('portal keeps credit movements collapsed and orders reports before requests', () => {
  assert.match(portalHtml, /id="credit-summary-toggle"/);
  assert.match(portalHtml, /id="credit-ledger-panel"[^>]*hidden/);
  assert.ok(portalHtml.indexOf('id="report-list"') < portalHtml.indexOf('id="request-list"'));
  assert.match(portalJs, /wireCreditToggle/);
  assert.match(portalJs, /ledger-scroll/);
});

test('report viewer keeps opportunity and company feedback inline', () => {
  assert.doesNotMatch(reportHtml, /id="open-feedback"/);
  assert.doesNotMatch(reportHtml, /interaction-drawer/);
  assert.match(reportJs, /portal_get_report_interactions_v1/);
  assert.match(reportJs, /portal_submit_feedback_v1/);
  assert.match(reportJs, /portal_set_company_preference_v1/);
  assert.match(reportJs, /induradar-feedback-actions/);
  assert.match(reportJs, /card\.querySelector\('h3'\)/);
  assert.match(reportJs, /cell\.append\(companyButtons/);
  assert.match(reportJs, /Ayúdanos a entender qué es interesante para tus informes/);
  assert.match(reportJs, /showCanonicalHtml/);
  assert.doesNotMatch(reportJs, /document\.write\(html\)/);
});

test('report updates are explicit authenticated follow-up requests', () => {
  assert.match(reportHtml, /id="request-update"/);
  assert.match(reportHtml, /¿Qué quieres que actualicemos\?/);
  assert.match(reportJs, /portal_request_report_update_v1/);
  assert.match(reportJs, /p_client_request_id/);
  assert.match(notifier, /isReportUpdate/);
  assert.match(notifier, /source_report_reference/);
  assert.match(notifier, /Qué quiere actualizar:/);
});

test('thumb selections can be undone in place', () => {
  assert.match(reportJs, /item\.useful === true \? null : true/);
  assert.match(reportJs, /saveOpportunityFeedback\(item, null/);
  assert.match(reportJs, /saveCompanyPreference\(item, 'neutral'/);
  assert.match(reportJs, /Deshacer valoración positiva/);
  assert.match(reportJs, /Deshacer valoración negativa/);
  assert.match(reportJs, /Deshacer interés por esta empresa/);
  assert.match(reportJs, /Deshacer exclusión de esta empresa/);
  assert.match(reportJs, /Solicitar profundización/);
  assert.match(reportJs, /Excluir empresa/);
});
