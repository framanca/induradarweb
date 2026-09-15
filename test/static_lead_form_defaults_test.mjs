import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');

test('Spain defaults to province selection without checked provinces', () => {
  assert.match(
    appSource,
    /inputsByName\('spainCoverage'\)\.find\(\(input\) => input\.value === SPAIN_BY_PROVINCE\)\.checked = true/,
  );
  assert.doesNotMatch(
    appSource,
    /inputsByName\('spainCoverage'\)\.find\(\(input\) => input\.value === SPAIN_ALL\)\.checked = true/,
  );
});

test('commercial needs start unchecked and require at least one selection', () => {
  assert.doesNotMatch(appSource, /selected: options\.needs\.filter/);
  assert.match(appSource, /!selectedValues\('commercialNeeds'\)\.length/);
  assert.match(appSource, /Selecciona al menos un área de oportunidad u otra\./);
  assert.match(
    appSource,
    /inputsByName\('commercialNeeds'\)\.forEach\(\(input\) => \{ input\.checked = false; \}\)/,
  );
});
