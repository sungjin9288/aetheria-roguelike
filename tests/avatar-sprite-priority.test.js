import test from 'node:test';
import assert from 'node:assert/strict';

import { getAvatarSpriteCandidates, JOB_TYPICAL_LOADOUT } from '../src/utils/avatarSpriteCandidates.js';

/**
 * Avatar sprite candidate priority — cycle 43 redesign.
 *
 * 사용자 QA 피드백 (cycle 43): "직업별로만 캐릭터 아바타 구분해야지, 무기 바꿨다고
 * 캐릭터 아바타가 궁수로 바뀌면 문제". 직업이 캐릭터 정체성 → sprite 결정에
 * loadoutStyle 사용 X, JOB_TYPICAL_LOADOUT 매핑으로 직업별 default 시각 고정.
 *
 * 우선순위 (cycle 43):
 *   1. job-armor-typicalLoadout (직업 정체성 + armor)
 *   2. job-armor (armor variant)
 *   3. job-typicalLoadout
 *   4. jobSlug (직업 단독)
 *   5. adventurer-armor (직업 sprite 없으면)
 *   6. adventurer (generic)
 *
 * 계약:
 *   1. 같은 직업 + 같은 armor에서 weapon 변경 시 sprite 안 바뀜 (직업 정체성)
 *   2. 어쌔신/도적/그림자주군 → typicalLoadout='dagger'
 *   3. 마법사/아크메이지/흑마법사/시간술사/대마법사 → 'caster'
 *   4. 나이트/팔라딘 → 'guardian'
 *   5. 전사 → 'sword', 버서커 → 'heavy', 레인저 → 'archer'
 *   6. 모험가는 typical 없음 (generic 폴백)
 */

const indexOfPath = (paths, key) => paths.findIndex((p) => p.endsWith(`/${key}.png`));
const firstPath = (paths) => paths[0]?.split('/').pop().replace('.png', '');

test('사용자 케이스: 모험가 + leather + 무기 변경 시 sprite 안 바뀜', () => {
    const dagger = firstPath(getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    const sword = firstPath(getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'sword' }));
    const bow = firstPath(getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'bow' }));
    assert.equal(dagger, 'adventurer-leather');
    assert.equal(sword, 'adventurer-leather');
    assert.equal(bow, 'adventurer-leather');
});

test('어쌔신 — typicalLoadout=dagger, 무기 변경 무관', () => {
    const dagger = firstPath(getAvatarSpriteCandidates({ job: '어쌔신', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    const sword = firstPath(getAvatarSpriteCandidates({ job: '어쌔신', armorStyle: 'leather', loadoutStyle: 'sword' }));
    assert.equal(dagger, 'assassin-leather-dagger');
    assert.equal(sword, 'assassin-leather-dagger');
});

test('나이트 — typicalLoadout=guardian, 무기 변경 무관', () => {
    const guardian = firstPath(getAvatarSpriteCandidates({ job: '나이트', armorStyle: 'plate', loadoutStyle: 'guardian' }));
    const dagger = firstPath(getAvatarSpriteCandidates({ job: '나이트', armorStyle: 'plate', loadoutStyle: 'dagger' }));
    assert.equal(guardian, 'knight-plate-guardian');
    assert.equal(dagger, 'knight-plate-guardian');
});

test('아크메이지 — typicalLoadout=caster, 무기 변경 무관', () => {
    const caster = firstPath(getAvatarSpriteCandidates({ job: '아크메이지', armorStyle: 'robe', loadoutStyle: 'caster' }));
    const sword = firstPath(getAvatarSpriteCandidates({ job: '아크메이지', armorStyle: 'robe', loadoutStyle: 'sword' }));
    assert.equal(caster, 'archmage-robe-caster');
    assert.equal(sword, 'archmage-robe-caster');
});

test('JOB_TYPICAL_LOADOUT 매핑 핵심 직업', () => {
    assert.equal(JOB_TYPICAL_LOADOUT.warrior, 'sword');
    assert.equal(JOB_TYPICAL_LOADOUT.knight, 'guardian');
    assert.equal(JOB_TYPICAL_LOADOUT.berserker, 'heavy');
    assert.equal(JOB_TYPICAL_LOADOUT.assassin, 'dagger');
    assert.equal(JOB_TYPICAL_LOADOUT.rogue, 'dagger');
    assert.equal(JOB_TYPICAL_LOADOUT.ranger, 'archer');
    assert.equal(JOB_TYPICAL_LOADOUT.mage, 'caster');
    assert.equal(JOB_TYPICAL_LOADOUT.archmage, 'caster');
    assert.equal(JOB_TYPICAL_LOADOUT.paladin, 'guardian');
    assert.equal(JOB_TYPICAL_LOADOUT['shadow-lord'], 'dagger');
    assert.equal(JOB_TYPICAL_LOADOUT['grand-mage'], 'caster');
});

test('모험가는 typical 없음 — armor 매핑 폴백', () => {
    const leather = firstPath(getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'leather', loadoutStyle: 'sword' }));
    const plate = firstPath(getAvatarSpriteCandidates({ job: '모험가', armorStyle: 'plate', loadoutStyle: 'sword' }));
    assert.equal(leather, 'adventurer-leather');
    assert.equal(plate, 'adventurer-plate');
});

test('직업별 sprite가 없으면 adventurer-armor로 폴백', () => {
    // 어쌔신이 plate 입은 경우 — assassin-plate-dagger / assassin-plate / assassin-dagger 모두 없음
    // → assassin (있음) 폴백
    const paths = getAvatarSpriteCandidates({ job: '어쌔신', armorStyle: 'plate', loadoutStyle: 'sword' });
    assert.equal(firstPath(paths), 'assassin');
});
