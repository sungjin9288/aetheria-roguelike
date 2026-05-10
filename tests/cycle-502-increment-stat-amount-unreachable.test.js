import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 502: incrementStat `amount` parameter unreachable 정리
 *   (cycle 222-501 silent dead config 시리즈 252번째 — unreachable code path
 *   util-level cleanup, cycle 463/501 lens의 util 변형).
 *
 * 발견 (1 parameter unreachable):
 * - src/utils/playerStateUtils.ts (line 21):
 *     export const incrementStat = (player, field, amount: number = 1): Player =>
 *         updateStats(player, { [field]: ((player.stats as any)?.[field] || 0) + amount });
 * - 호출 사이트 (3 callsite, useInventoryActions.ts):
 *     · line 242: incrementStat({...}, 'crafts').
 *     · line 302: incrementStat(updatedPlayer, 'bountiesCompleted').
 *     · line 436: incrementStat({...}, 'syntheses').
 *     · 3 callsite 모두 amount 전달 0건. default 1 도달 불가.
 *     · 다른 파일에서 incrementStat import 0건 (useInventoryActions만 사용).
 * - 결과: amount 항상 1 → `+ amount`는 항상 `+ 1`.
 *
 * 패턴 (cycle 222-501 시리즈 252번째):
 * - cycle 463/465/466/493/495/496/498/501: 컴포넌트 className unreachable lens.
 * - cycle 502: util level 동일 lens 적용 — incrementStat amount 파라미터 dead.
 *
 * 수정 (src/utils/playerStateUtils.ts):
 * - signature에서 amount: number = 1 제거 → (player, field).
 * - body의 `+ amount` → `+ 1` 정적 inline.
 *
 * 회귀 가드:
 * - 3 callsite 동작 그대로 (각각 1씩 증가).
 * - updateStats 호출 / Player 타입 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 502: incrementStat signature에서 amount 0건', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    const fnIdx = source.indexOf('export const incrementStat');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bamount\b/.test(sig), 'signature에 amount 0건');
});

test('cycle 502: body amount 참조 0건', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    const fnIdx = source.indexOf('export const incrementStat');
    // 함수 본문은 한 줄 expression, 다음 export 또는 const까지 슬라이스
    const fnEnd = source.indexOf(';', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bamount\b/.test(block), 'body amount 참조 0건');
    assert.ok(/\+\s*1\b/.test(block), '+ 1 정적 inline 보존');
});

test('cycle 502: 정합성 가드 — useInventoryActions 3 callsite 호출 존재 + amount 명시 전달 0건', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // incrementStat 호출 3건이 존재하는지 (callsite 자체 가드)
    const matches = source.match(/incrementStat\(/g) || [];
    assert.equal(matches.length, 3, 'incrementStat 호출 정확히 3건');
    // amount(3번째 인자로 숫자 리터럴)를 명시 전달하는 패턴 0건
    // 즉 incrementStat(..., 'field_literal', <number>) 형태가 0건이어야 함
    assert.ok(!/incrementStat\([\s\S]+?,\s*'[^']+',\s*\d+\)/.test(source),
        '3 args (amount 전달) 호출 0건');
});

test('cycle 502: updateStats 호출 / Player 타입 보존', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(/updateStats\(player/.test(source), 'updateStats 호출 보존');
    assert.ok(/Player/.test(source), 'Player 타입 보존');
});
