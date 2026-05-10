import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 536: applyExpGain `expGained = 0` default unreachable
 *   (cycle 222-535 silent dead config 시리즈 279번째 — redundant default annotation
 *   util/component/hook/system default 청소 메가 시리즈 32번째). systems/ 진입.
 *
 * 발견 (1 default unreachable):
 * - src/systems/CombatEngine.ts (line 1338):
 *     applyExpGain(player: Player, expGained: any = 0) {
 *         const p: any = { ...player, exp: (player.exp || 0) + expGained };
 *         ...
 *     }
 * - 호출 사이트 (3 production callers + 1 internal + N test):
 *     · useInventoryActions.ts:296 — CombatEngine.applyExpGain(updatedPlayer,
 *       qData.reward.exp)
 *     · gameActions/eventActions.ts:108 — CombatEngine.applyExpGain
 *       (updatedPlayer, selectedOutcome.exp)
 *     · gameActions/moveActions.ts:70 — CombatEngine.applyExpGain(updated,
 *       visitReward.exp)
 *     · CombatEngine.ts:1546 — this.applyExpGain(p, expGained)
 *     · tests/combat-engine-core.test.js — 16 callsite, 모두 명시 값 (50/100/
 *       500/10000 등). test의 local applyExpGain re-implementation은 별개 함수.
 * - 결과: expGained 항상 명시 전달. default 0 도달 불가.
 *
 * 패턴 (cycle 222-535 시리즈 279번째):
 * - cycle 502-535: util/component/hook default 청소 메가 시리즈 32사이클.
 * - cycle 536: systems/ 디렉토리 진입 — utils/ + components/ + hooks/ 외
 *   systems/까지 lens 확장 (cycle 529 components/, 532 hooks/ 진입에 이어).
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 expGained: any = 0 → expGained: any.
 * - body의 (player.exp || 0) + expGained 보존.
 *
 * 회귀 가드:
 * - 4 production callsite (3 외부 + 1 internal) + tests 동작 그대로.
 * - body level-up while loop / visualEffect / logs 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 536: applyExpGain signature에서 expGained default 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('applyExpGain(player: Player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/expGained:\s*any\s*=\s*0/.test(sig),
        'applyExpGain expGained default 0 제거');
    assert.ok(/\bexpGained\b/.test(sig), 'expGained 파라미터 자체는 보존');
});

test('cycle 536: 정합성 가드 — 4 production callsite 보존', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/CombatEngine\.applyExpGain\(updatedPlayer,\s*qData\.reward\.exp\)/.test(inv),
        'useInventoryActions callsite 보존');

    const ev = await readSrc('src/hooks/gameActions/eventActions.ts');
    assert.ok(/CombatEngine\.applyExpGain\(updatedPlayer,\s*selectedOutcome\.exp\)/.test(ev),
        'eventActions callsite 보존');

    const mv = await readSrc('src/hooks/gameActions/moveActions.ts');
    assert.ok(/CombatEngine\.applyExpGain\(updated,\s*visitReward\.exp\)/.test(mv),
        'moveActions callsite 보존');

    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/this\.applyExpGain\(p,\s*expGained\)/.test(ce),
        'internal this.applyExpGain callsite 보존');
});

test('cycle 536: body level-up loop / visualEffect 처리 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/\(player\.exp \|\| 0\) \+ expGained/.test(source),
        '(player.exp || 0) + expGained defensive 보존');
    assert.ok(/while \(p\.level < CONSTANTS\.MAX_LEVEL && p\.exp >= p\.nextExp\)/.test(source),
        'level-up while loop 보존');
});

test('cycle 536: cycle 502-535 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
    const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(ca),
        'cycle 535 cycleSkill dir default 0건');

    const lh = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(!/getLootUpgradeHint[^=]*equip:\s*any\s*=\s*\{\}/.test(lh),
        'cycle 534 getLootUpgradeHint equip default 0건');
});
