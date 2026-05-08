import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 330: SignalBadge 'signature' tone class dead 제거 (cycle 310 cascade)
 *   (cycle 222-329 silent dead config 시리즈 99번째 — cleanup lens 연속).
 *
 * 발견 (dead tone class):
 * - src/components/SignalBadge.tsx: TONE_CLASS.signature — gold 팔레트 정의.
 * - cycle 23 시점 FocusPanel `'확률 증폭'` emphasis surface가 유일 consumer였음.
 * - cycle 310 FocusPanel 제거 후 dispatch path 0건. tone class cascade dead.
 *
 * 비교 — 다른 9 tone class는 active:
 * - neutral / recommended / resonance / upgrade / success / warning / danger /
 *   equipped / spotlight 모두 JSX `tone="..."` 사용처 보유.
 *
 * 패턴 (cycle 222-329 silent dead config 시리즈 99번째):
 * - cycle 329: useGameTestApi 3 dead methods 제거.
 * - cycle 330: SignalBadge signature tone cascade dead (cycle 310 paired).
 *
 * 수정 (src/components/SignalBadge.tsx):
 * - TONE_CLASS.signature 키 제거 (4 lines: 주석 + 키-값).
 *
 * 회귀 가드:
 * - 다른 9 tone class 보존.
 * - SignalBadge default tone neutral fallback 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 330: SignalBadge signature tone class 제거', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    // signature 키 정의 제거 (TONE_CLASS 객체에서).
    assert.ok(!/^\s+signature:\s*'border/m.test(source),
        'signature tone class 제거됨');
});

test('cycle 330: SignalBadge 9 active tone classes 보존', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const aliveTones = ['neutral', 'recommended', 'resonance', 'upgrade', 'success', 'warning', 'danger', 'equipped', 'spotlight'];
    aliveTones.forEach((name) => {
        const re = new RegExp(`^\\s+${name}:\\s*'`, 'm');
        assert.ok(re.test(source), `${name} tone class 보존`);
    });
});

test('cycle 330: SignalBadge default export 보존', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    assert.ok(/export default SignalBadge/.test(source),
        'SignalBadge default export 보존');
});

test('cycle 329 회귀 가드: useGameTestApi 3 dead methods 제거 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/getState:\s*\(\)/.test(source), 'cycle 329 getState 제거 보존');
    assert.ok(!/clearPostCombat:\s*\(\)/.test(source), 'cycle 329 clearPostCombat 제거 보존');
    assert.ok(!/injectAscensionPreview:\s*\(\)/.test(source),
        'cycle 329 injectAscensionPreview 제거 보존');
});
