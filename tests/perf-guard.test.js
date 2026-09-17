import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePerfMetrics } from '../scripts/perf-metrics.mjs';

test('required performance metrics reject missing, invalid and negative values', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, '12']) {
    assert.equal(validatePerfMetrics({ boot: value }, { boot: 100 }).length, 1);
  }
  assert.equal(validatePerfMetrics({}, { boot: 100 }).length, 1);
});

test('performance limits preserve zero, boundary and over-budget behavior', () => {
  assert.deepEqual(validatePerfMetrics({ boot: 0 }, { boot: 100 }), []);
  assert.deepEqual(validatePerfMetrics({ boot: 100 }, { boot: 100 }), []);
  assert.equal(validatePerfMetrics({ boot: 101 }, { boot: 100 }).length, 1);
});

test('app start mark precedes React rendering and the guard waits for real initial measurements', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const guard = readFileSync(new URL('../scripts/perf-guard.mjs', import.meta.url), 'utf8');
  const start = main.indexOf("markPerfOnce('aetheria:app-mounted')");
  assert.ok(start >= 0 && start < main.indexOf('createRoot(document'));
  assert.match(guard, /await page\.waitForFunction/);
  assert.match(guard, /validatePerfMetrics\(metrics, thresholds\)/);
});
