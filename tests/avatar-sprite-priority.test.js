import test from 'node:test';
import assert from 'node:assert/strict';

import { getAvatarSpriteCandidates } from '../src/utils/avatarSpriteCandidates.js';

/**
 * Avatar sprite candidate priority — Path C 핵심.
 *
 * 베이스 sprite의 baked-in 무기가 overlay system과 충돌. 무기-없는 베이스(adventurer-coat,
 * adventurer-leather, adventurer-sword, adventurer)를 우선시하면 overlay가 100% 무기 표현
 * 담당 가능 → per-item 차별화가 비로소 보임.
 *
 * 기존 우선순위:
 *   1-4. job-specific
 *   5. adventurer-{armorStyle}  ← weaponful일 수 있음
 *   6. adventurer-{loadoutStyle} ← 항상 weaponful
 *   7. adventurer
 *
 * 신규 우선순위:
 *   1-4. job-specific (preserve class identity)
 *   5. WEAPONLESS adventurer-{armor} (코트/가죽/검자루 등 weaponless variants)
 *   6. adventurer (weaponless universal — promoted)
 *   7. weaponful adventurer-{armor} (last resort)
 *   8. adventurer-{loadout} (always weaponful — last resort)
 *
 * 계약:
 *   1. armor='coat' → adventurer-coat가 adventurer-{loadout}보다 먼저
 *   2. armor='leather' → adventurer-leather가 adventurer-{loadout}보다 먼저
 *   3. armor='plate' (no weaponless variant) → adventurer가 adventurer-plate보다 먼저
 *   4. armor='robe' (weaponful) → adventurer가 adventurer-robe보다 먼저
 *   5. job-specific 매치는 여전히 최상위 (warrior 사용 시 warrior-plate가 우선)
 */

const indexOfPath = (paths, key) => paths.findIndex((p) => p.endsWith(`/${key}.png`));

test('weaponless adventurer-coat outranks weaponful adventurer-{loadout}', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'coat', loadoutStyle: 'dagger' });
    const coatIdx = indexOfPath(paths, 'adventurer-coat');
    const daggerIdx = indexOfPath(paths, 'adventurer-dagger');
    assert.ok(coatIdx >= 0, 'adventurer-coat should be in candidates');
    assert.ok(daggerIdx === -1 || coatIdx < daggerIdx,
        `adventurer-coat (idx ${coatIdx}) must precede adventurer-dagger (idx ${daggerIdx})`);
});

test('weaponless adventurer-leather outranks weaponful adventurer-{loadout}', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'bow' });
    const leatherIdx = indexOfPath(paths, 'adventurer-leather');
    const archerIdx = indexOfPath(paths, 'adventurer-archer');
    assert.ok(leatherIdx >= 0);
    assert.ok(archerIdx === -1 || leatherIdx < archerIdx,
        `adventurer-leather (idx ${leatherIdx}) must precede adventurer-archer (idx ${archerIdx})`);
});

test('plate (no weaponless variant) → adventurer (clean) outranks adventurer-plate', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'plate', loadoutStyle: 'sword' });
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    const plateIdx = indexOfPath(paths, 'adventurer-plate');
    assert.ok(adventurerIdx >= 0, 'adventurer (clean) must be a candidate');
    assert.ok(plateIdx === -1 || adventurerIdx < plateIdx,
        `adventurer (idx ${adventurerIdx}) must precede adventurer-plate (idx ${plateIdx})`);
});

test('robe (weaponful) → adventurer (clean) outranks adventurer-robe', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'robe', loadoutStyle: 'staff' });
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    const robeIdx = indexOfPath(paths, 'adventurer-robe');
    assert.ok(adventurerIdx >= 0);
    assert.ok(robeIdx === -1 || adventurerIdx < robeIdx,
        `adventurer (idx ${adventurerIdx}) must precede adventurer-robe (idx ${robeIdx})`);
});

test('job-specific sprites still take top priority (preserve class identity)', () => {
    const paths = getAvatarSpriteCandidates({ job: '나이트', armorStyle: 'plate', loadoutStyle: 'guardian' });
    const knightFullIdx = indexOfPath(paths, 'knight-plate-guardian');
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    assert.ok(knightFullIdx >= 0, 'knight-plate-guardian must be a candidate');
    assert.ok(knightFullIdx < adventurerIdx,
        `knight-plate-guardian (idx ${knightFullIdx}) must precede generic adventurer (idx ${adventurerIdx})`);
});

test('adventurer-{loadout} weaponful sprites are LAST resort (after clean adventurer)', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'cloak', loadoutStyle: 'dagger' });
    // cloak armor variant doesn't exist in adventurer-* sprites
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    const daggerIdx = indexOfPath(paths, 'adventurer-dagger');
    assert.ok(adventurerIdx >= 0);
    assert.ok(daggerIdx === -1 || adventurerIdx < daggerIdx,
        `adventurer (clean, idx ${adventurerIdx}) must precede adventurer-dagger (weaponful, idx ${daggerIdx})`);
});
