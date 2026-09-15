import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260915071125_editorial_closure_pipeline_v1_20260915.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('new reports require zero-search editorial synthesis before ready', () => {
  assert.match(sql, /editorial_pipeline_status text not null default 'legacy_optional'/);
  assert.match(sql, /alter column editorial_pipeline_status set default 'pending'/);
  assert.match(sql, /report_editorial_synthesis_required_before_ready/);
  assert.match(sql, /search_budget_impact',0/);
  assert.match(sql, /web_research_allowed',false/);
  assert.match(sql, /research_reopening_allowed',false/);
});

test('client-visible opportunities receive the required editorial fields', () => {
  for (const field of ['signal_synopsis', 'confirmed_facts', 'why_now', 'probable_need', 'risk_cautions', 'next_action']) {
    assert.ok(sql.includes(field), `missing editorial field ${field}`);
  }
  assert.match(sql, /executive_summary_required_fields',jsonb_build_array\('conclusion'\)/);
});

test('Chat\/Work closure order is explicit and persists prose through finalize_report', () => {
  const ordered = [
    'prepare_report_and_read_editorial_plan',
    'generate_zero_search_editorial_from_approved_canonical_content',
    'finalize_report_with_persisted_editorial_content',
  ];
  let position = -1;
  for (const step of ordered) {
    const next = sql.indexOf(step);
    assert.ok(next > position, `pipeline step missing or out of order: ${step}`);
    position = next;
  }
  assert.match(sql, /persist_via','finalize_report\.content'/);
  assert.match(sql, /generate_once_persist_in_report_json_render_many/);
});
