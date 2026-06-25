import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.ts';
import { MAPS } from '../src/data/maps.ts';

/**
 * PR #9 (2026-06): 맵 풀 미참조 몬스터(고아) 해소.
 *   MONSTERS에 정의됐으나 어떤 맵의 monsters[]/bossMonsters[]/boss에서도 참조되지
 *   않아 영영 스폰 안 되던 33종(authored-but-dead)을 테마/레벨 일치 맵에 배선.
 *   특히 보스가 없던 6개 존이 각자의 보스를 갖게 됨.
 */

const referencedNames = () => {
    const ref = new Set();
    for (const m of Object.values(MAPS)) {
        for (const n of [
            ...(m.monsters || []),
            ...(m.bossMonsters || []),
            ...(typeof m.boss === 'string' ? [m.boss] : []),
        ]) ref.add(n);
    }
    return ref;
};

test('모든 MONSTERS는 최소 한 맵 풀에서 참조됨 (고아 0)', () => {
    const ref = referencedNames();
    const orphans = Object.keys(MONSTERS).filter((n) => !ref.has(n));
    assert.equal(orphans.length, 0, `고아 몬스터(미스폰): ${orphans.join(', ')}`);
});

test('보스 없던 6개 존이 각자의 보스를 가짐 + isBoss', () => {
    const newBosses = [
        ['저주받은 묘지', '묘지기 네크론'],
        ['용암 지대', '화염 군주 이프리트'],
        ['폭풍의 고원', '천둥새 제피로스'],
        ['에테르 폐허', '멸절의 사도'],
        ['공허의 회랑', '허무의 전령'],
        ['혼돈의 심연', '원시의 신'],
    ];
    for (const [zone, boss] of newBosses) {
        assert.equal(MAPS[zone].boss, boss, `${zone} boss`);
        assert.ok(MONSTERS[boss]?.isBoss, `${boss}는 isBoss여야 함`);
    }
});

test('기존 보스 보존 — 덮어쓰기 없음', () => {
    assert.equal(MAPS['기계 폐도'].boss, '기계 장군', '기계 폐도 기존 보스 유지');
    assert.equal(MAPS['차원의 틈새'].boss, '차원 포식자', '차원의 틈새 기존 보스 유지');
    assert.equal(MAPS['에테르 관문'].boss, true, '에테르 관문 boss:true 유지');
    // 점유 보스 존의 신규 보스는 bossMonsters[]로 (덮어쓰기 회피)
    assert.ok(MAPS['기계 폐도'].bossMonsters?.includes('프로토타입 제로'));
    assert.ok(MAPS['에테르 관문'].bossMonsters?.includes('무한의 화신'));
});

test('맵 풀이 참조하는 모든 이름은 MONSTERS에 존재 (역방향 무결성)', () => {
    const missing = [...referencedNames()].filter((n) => !MONSTERS[n]);
    assert.equal(missing.length, 0, `정의 없는 참조: ${missing.join(', ')}`);
});
