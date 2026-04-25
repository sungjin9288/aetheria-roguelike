import test from 'node:test';
import assert from 'node:assert/strict';

import { getAvatarSpriteCandidates } from '../src/utils/avatarSpriteCandidates.js';

/**
 * Avatar sprite candidate priority — cycle 41 redesign.
 *
 * 사용자 QA 피드백 (cycle 41): weaponless 베이스 + overlay floating dagger가
 * 부자연스럽다. 자연스러운 장비 착용감을 위해 weapon-baked-in sprite를 우선시.
 *
 * 우선순위 (cycle 41):
 *   1-4. job-specific (class identity 보존)
 *   5. weaponless armor → loadout sprite (weapon baked-in) 우선
 *      weaponful armor → 그것 자체 우선 (armor + weapon 통합)
 *   6. 위와 반대 케이스
 *   7. adventurer (generic 폴백)
 *
 * 계약:
 *   1. armor='leather' (weaponless) + dagger → adventurer-dagger 우선 (자연스러움)
 *   2. armor='coat' (weaponless) + sword → adventurer-sword 우선
 *   3. armor='plate' (weaponful) + sword → adventurer-plate 우선 (이미 plate+sword)
 *   4. armor='robe' (weaponful) + caster → adventurer-robe 우선
 *   5. job-specific 매치는 여전히 최상위
 */

const indexOfPath = (paths, key) => paths.findIndex((p) => p.endsWith(`/${key}.png`));

test('weaponless leather + dagger → adventurer-dagger (weapon baked-in) 우선', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'dagger' });
    const daggerIdx = indexOfPath(paths, 'adventurer-dagger');
    const leatherIdx = indexOfPath(paths, 'adventurer-leather');
    assert.ok(daggerIdx >= 0, 'adventurer-dagger must be in candidates');
    assert.ok(leatherIdx === -1 || daggerIdx < leatherIdx,
        `adventurer-dagger (idx ${daggerIdx}) must precede adventurer-leather (idx ${leatherIdx})`);
});

test('weaponless coat + sword → adventurer-sword 우선', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'coat', loadoutStyle: 'sword' });
    const swordIdx = indexOfPath(paths, 'adventurer-sword');
    const coatIdx = indexOfPath(paths, 'adventurer-coat');
    assert.ok(swordIdx >= 0);
    assert.ok(coatIdx === -1 || swordIdx < coatIdx,
        `adventurer-sword (${swordIdx}) must precede adventurer-coat (${coatIdx})`);
});

test('weaponful plate + sword → adventurer-plate 우선 (이미 통합)', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'plate', loadoutStyle: 'sword' });
    const plateIdx = indexOfPath(paths, 'adventurer-plate');
    const swordIdx = indexOfPath(paths, 'adventurer-sword');
    assert.ok(plateIdx >= 0);
    assert.ok(swordIdx === -1 || plateIdx < swordIdx,
        `adventurer-plate (${plateIdx}) must precede adventurer-sword (${swordIdx})`);
});

test('weaponful robe + caster → adventurer-robe 우선', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'robe', loadoutStyle: 'caster' });
    const robeIdx = indexOfPath(paths, 'adventurer-robe');
    const casterIdx = indexOfPath(paths, 'adventurer-caster');
    assert.ok(robeIdx >= 0);
    assert.ok(casterIdx === -1 || robeIdx < casterIdx,
        `adventurer-robe (${robeIdx}) must precede adventurer-caster (${casterIdx})`);
});

test('job-specific sprites still top priority (class identity 보존)', () => {
    const paths = getAvatarSpriteCandidates({ job: '나이트', armorStyle: 'plate', loadoutStyle: 'guardian' });
    const knightFullIdx = indexOfPath(paths, 'knight-plate-guardian');
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    assert.ok(knightFullIdx >= 0);
    assert.ok(knightFullIdx < adventurerIdx,
        `knight-plate-guardian must precede generic adventurer`);
});

test('cloak (자체 sprite 없음) + dagger → adventurer-dagger 폴백', () => {
    const paths = getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'cloak', loadoutStyle: 'dagger' });
    // cloak는 weaponless로 분류 안 됨 (set에 없음). priority 5는 armorKey, 6은 loadoutKey.
    // adventurer-cloak 없음 → adventurer-dagger 다음 순
    const daggerIdx = indexOfPath(paths, 'adventurer-dagger');
    const adventurerIdx = indexOfPath(paths, 'adventurer');
    assert.ok(daggerIdx >= 0, 'adventurer-dagger must be in candidates');
    assert.ok(daggerIdx < adventurerIdx,
        `adventurer-dagger (${daggerIdx}) must precede generic adventurer (${adventurerIdx})`);
});
