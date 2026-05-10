import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 535: cycleSkill `dir = 1` default unreachable
 *   (cycle 222-534 silent dead config 시리즈 278번째 — redundant default annotation
 *   util/component/hook default 청소 메가 시리즈 31번째).
 *
 * 발견 (1 default unreachable):
 * - src/hooks/gameActions/characterActions.ts (line 43):
 *     cycleSkill: (dir: any = 1) => {
 *         const skills = getJobSkills(player);
 *         if (!skills.length) return;
 *         ...
 *         const next = ((current + dir) % skills.length + skills.length) % skills.length;
 *         ...
 *     }
 * - 호출 사이트 (2 callsite, 모두 명시):
 *     · commandParser.ts:80 — actions.cycleSkill?.(1)
 *     · CombatPanel.tsx:113 — actions.cycleSkill(1)
 *     · 다른 caller 0건.
 * - 결과: dir 항상 1 명시 전달. default 1 도달 불가.
 *
 * 패턴 (cycle 222-534 시리즈 278번째):
 * - cycle 502-534: util/component/hook default 청소 메가 시리즈 31사이클.
 * - cycle 535: hooks/gameActions 동일 모듈 default — cycle 532에 이은
 *   characterActions.ts 추가 cleanup.
 *
 * 수정 (src/hooks/gameActions/characterActions.ts):
 * - cycleSkill signature: (dir: any = 1) → (dir: any).
 * - body의 modulo 계산 / dispatch 보존.
 *
 * 회귀 가드:
 * - 2 callsite 동작 그대로.
 * - body skills.length / Number.isInteger / dispatch 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 535: cycleSkill signature에서 dir default 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(source),
        'cycleSkill dir default 1 제거');
    assert.ok(/cycleSkill:\s*\(dir:\s*any\)/.test(source),
        'cycleSkill 파라미터 자체는 보존');
});

test('cycle 535: 정합성 가드 — 2 callsite 보존 (1 명시)', async () => {
    const cmd = await readSrc('src/utils/commandParser.ts');
    assert.ok(/actions\.cycleSkill\?\.\(1\)/.test(cmd),
        'commandParser cycleSkill?.(1) callsite 보존');

    const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/actions\.cycleSkill\(1\)/.test(cp),
        'CombatPanel cycleSkill(1) callsite 보존');
});

test('cycle 535: body modulo 계산 + dispatch 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(/const next = \(\(current \+ dir\) % skills\.length \+ skills\.length\) % skills\.length/.test(source),
        'modulo 계산 보존');
    assert.ok(/skillLoadout: \{ selected: next/.test(source),
        'dispatch payload 보존');
});

test('cycle 535: cycle 502-534 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
    const lh = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(!/getLootUpgradeHint[^=]*equip:\s*any\s*=\s*\{\}/.test(lh),
        'cycle 534 getLootUpgradeHint equip default 0건');

    const rcp = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.ok(!/const getRelicSynergyScore[^=]*ownedRelics:\s*any\s*=\s*\[\]/.test(rcp),
        'cycle 533 getRelicSynergyScore ownedRelics default 0건');
});
