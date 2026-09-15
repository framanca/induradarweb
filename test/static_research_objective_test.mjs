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
  assert.match(selectorSource, /Empresas objetivo/);
  assert.match(selectorSource, /Señales activas/);
  assert.match(selectorSource, /Empresas \+ señales/);
  assert.match(selectorSource, /Ampliar el universo de fabricantes, plantas, OEM, integradores u otras cuentas que encajen en la solicitud\./);
  assert.match(selectorSource, /Buscar inversiones, ampliaciones, proyectos y otros cambios recientes que puedan generar negocio en tu sector\./);
  assert.doesNotMatch(selectorSource, /aunque todavía no exista una señal pública/);
  assert.doesNotMatch(selectorSource, /aunque esas señales descubran empresas/);
  assert.doesNotMatch(selectorSource, /Combinar la ampliación del universo/);
  assert.doesNotMatch(selectorSource, /Elige qué debe pesar más en la investigación/);
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
