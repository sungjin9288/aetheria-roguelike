import test from 'node:test';
import assert from 'node:assert/strict';

import { getAvatarSpriteCandidates, JOB_TYPICAL_LOADOUT } from '../src/utils/avatarSpriteCandidates.js';

/**
 * Avatar sprite priority — cycle 46 (단순화).
 *
 * 사용자 핵심 통찰: "장비를 교체했을때 아바타가 바뀌는건 직업이 바뀌는게 되는거"
 * → sprite는 오직 직업(전직)만이 결정. armor/weapon 변경은 sprite에 영향 X.
 *
 * 우선순위:
 *   1. JOB_DEFAULT_SPRITE[jobSlug] (직업별 명시 매핑된 default)
 *   2. jobSlug (직업 단독 sprite)
 *   3. adventurer (universal fallback)
 *
 * 장비 변경 = stat 변화 + 인벤토리 슬롯 시각 + outfit set bonus 메카닉.
 * 시각이 흔들리지 않는 캐릭터 정체성 시스템.
 */

const firstPath = (paths) => paths[0]?.split('/').pop().replace('.png', '');

test('모험가는 모든 장비 변경에 대해 sprite 동일 (직업 정체성 fix)', () => {
    const variations = [
        { armorStyle: 'leather', loadoutStyle: 'dagger' },
        { armorStyle: 'plate', loadoutStyle: 'sword' },
        { armorStyle: 'robe', loadoutStyle: 'caster' },
        { armorStyle: 'coat', loadoutStyle: 'archer' },
    ];
    const sprites = variations.map((v) =>
        firstPath(getAvatarSpriteCandidates({ job: '모험가', ...v }))
    );
    assert.equal(new Set(sprites).size, 1, 'all should be same sprite');
    assert.equal(sprites[0], 'adventurer');
});

test('전사는 항상 warrior-plate-sword (default 매핑)', () => {
    const a = firstPath(getAvatarSpriteCandidates({ job: '전사', armorStyle: 'plate', loadoutStyle: 'sword' }));
    const b = firstPath(getAvatarSpriteCandidates({ job: '전사', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    assert.equal(a, 'warrior-plate-sword');
    assert.equal(b, 'warrior-plate-sword');
});

test('어쌔신은 항상 assassin-leather-dagger', () => {
    const a = firstPath(getAvatarSpriteCandidates({ job: '어쌔신', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    const b = firstPath(getAvatarSpriteCandidates({ job: '어쌔신', armorStyle: 'plate', loadoutStyle: 'sword' }));
    assert.equal(a, 'assassin-leather-dagger');
    assert.equal(b, 'assassin-leather-dagger');
});

test('아크메이지는 항상 archmage-robe-caster', () => {
    const a = firstPath(getAvatarSpriteCandidates({ job: '아크메이지', armorStyle: 'robe', loadoutStyle: 'caster' }));
    const b = firstPath(getAvatarSpriteCandidates({ job: '아크메이지', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    assert.equal(a, 'archmage-robe-caster');
    assert.equal(b, 'archmage-robe-caster');
});

test('그림자 주군은 정규화된 jobSlug로 매핑', () => {
    const sprite = firstPath(getAvatarSpriteCandidates({ job: '그림자 주군', armorStyle: 'leather', loadoutStyle: 'dagger' }));
    assert.equal(sprite, 'shadow-lord-leather-dagger');
});

test('JOB_TYPICAL_LOADOUT는 outfit affinity 표시용으로 보존됨', () => {
    // cycle 46에서는 sprite 결정에 사용 X — UI/메카닉용.
    assert.equal(JOB_TYPICAL_LOADOUT.warrior, 'sword');
    assert.equal(JOB_TYPICAL_LOADOUT.assassin, 'dagger');
});

test('미확인 직업은 adventurer 폴백', () => {
    const sprite = firstPath(getAvatarSpriteCandidates({ job: '???', armorStyle: 'plate', loadoutStyle: 'sword' }));
    assert.equal(sprite, 'adventurer');
});
