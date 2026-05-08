import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 326: TokenQuotaManager.getRemainingCalls dead method 제거
 *   (cycle 222-325 silent dead config 시리즈 95번째 — cleanup lens 연속).
 *
 * 발견 (dead method):
 * - src/systems/TokenQuotaManager.ts: getRemainingCalls — DAILY_LIMIT - quota.used 반환.
 *   src/, tests/ 어디에서도 TokenQuotaManager.getRemainingCalls() 호출 0건.
 *   내부에서도 self-call 0건.
 *
 * 비교 — 다른 method는 모두 active:
 * - canMakeAICall: aiService에서 2회 사용.
 * - recordCall: aiService에서 2회 사용.
 * - getExhaustedMessage: aiService에서 1회 사용.
 * - syncToFirestore: useFirebaseSync에서 1회 사용.
 *
 * 패턴 (cycle 222-325 silent dead config 시리즈 95번째):
 * - cycle 325: SoundManager hover case dead.
 * - cycle 326: TokenQuotaManager.getRemainingCalls dead method.
 *
 * 수정 (src/systems/TokenQuotaManager.ts):
 * - getRemainingCalls 메서드 제거 (5 lines).
 *
 * 회귀 가드:
 * - canMakeAICall / recordCall / getExhaustedMessage / syncToFirestore 보존.
 * - DAILY_LIMIT / QUOTA_KEY / getQuotaData 내부 사용 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 326: getRemainingCalls 메서드 제거', async () => {
    const source = await readSrc('src/systems/TokenQuotaManager.ts');
    assert.ok(!/getRemainingCalls\s*\(/.test(source),
        'getRemainingCalls 메서드 제거됨');
});

test('cycle 326: TokenQuotaManager 활성 메서드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/systems/TokenQuotaManager.ts');
    const aliveMethods = ['canMakeAICall', 'recordCall', 'getExhaustedMessage', 'syncToFirestore', 'getQuotaData'];
    aliveMethods.forEach((name) => {
        const re = new RegExp(`${name}\\s*\\(`);
        assert.ok(re.test(source), `${name} 메서드 보존`);
    });
});

test('cycle 326: aiService TokenQuotaManager 호출 보존', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/TokenQuotaManager\.canMakeAICall/.test(source),
        'aiService canMakeAICall 호출 보존');
    assert.ok(/TokenQuotaManager\.recordCall/.test(source),
        'aiService recordCall 호출 보존');
});

test('cycle 325 회귀 가드: SoundManager hover case 제거 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.ok(!/case 'hover':\s*\{/.test(source),
        'cycle 325 hover case 제거 보존');
});
