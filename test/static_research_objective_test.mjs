import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const selectorSource = await readFile(
  new URL('../site/research-objective.js', import.meta.url),
  'utf8',
);
const buildScript = await readFile(
  new URL('../scripts/build_static_site.sh', import.meta.url),
  'utf8',
);

test('research objective selector exposes all three SFP2 paths', () => {
  for (const value of ['universe_discovery', 'signal_discovery', 'balanced']) {
    assert.match(selectorSource, new RegExp(`value: '${value}'`));
  }
  assert.match(selectorSource, /Mapear empresas objetivo/);
  assert.match(selectorSource, /Detectar oportunidades y señales/);
  assert.match(selectorSource, /Mapear empresas \+ detectar oportunidades/);
});

test('signal discovery remains the backwards-compatible default', () => {
  assert.match(selectorSource, /const DEFAULT_OBJECTIVE = 'signal_discovery'/);
});

test('selected objective is persisted in the lead payload', () => {
  assert.match(selectorSource, /payload\.research_objective = researchObjective/);
  assert.match(selectorSource, /payload\.request\.research_objective = researchObjective/);
  assert.match(selectorSource, /request_extensions[\s\S]*research_objective: researchObjective/);
  assert.doesNotMatch(selectorSource, /no crea un presupuesto adicional de búsquedas/);
});

test('static build loads objective bootstrap before the main form module', () => {
  assert.match(buildScript, /research-objective\.js/);
  assert.match(buildScript, /app\.js/);
});
