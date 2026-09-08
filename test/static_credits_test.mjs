import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateCreditsQuote } from '../site/credits.js';

const catalog = JSON.parse(
  await readFile(new URL('../assets/config/induradar_credits_v1.json', import.meta.url), 'utf8'),
);

test('credit model matches the published reference cases', () => {
  const cases = [
    [1, 1, 5, 50],
    [1, 3, 5, 60],
    [2, 3, 5, 75],
    [2, 3, 12, 85],
    [2, 5, 12, 95],
    [3, 3, 12, 100],
    [3, 5, 12, 110],
    [4, 3, 12, 112],
    [5, 5, 12, 134],
    [10, 10, 12, 199],
    [20, 10, 12, 269],
  ];

  for (const [provinceCount, sectorCount, signalCount, expected] of cases) {
    const quote = calculateCreditsQuote(catalog, { provinceCount, sectorCount, signalCount });
    assert.equal(quote.total_credits, expected, `${provinceCount}/${sectorCount}/${signalCount}`);
  }
});
