import test from 'node:test';
import assert from 'node:assert/strict';

import { MAPS } from '../src/data/maps.js';
import { BALANCE } from '../src/data/constants.js';
import { FIRST_VISIT_REWARDS } from '../src/data/firstVisitRewards.js';

/**
 * Track J4 (2026-09) — 밸런스 예산 증명.
 *
 * scripts/simulate-progression.mjs (src/systems/progressionSimulator.ts)의
 * authorityUsage는 spawnEnemy/processLoot/CombatEngine.applyExpGain 등
 * "모델링된 전투 보상 정산"만 다루고, moveActions.ts의 첫 방문 보상
 * (getFirstVisitReward)은 목록에 전혀 등장하지 않는다 — 즉 시뮬레이터는
 * J2(첫 방문 보상)를 모델링하지 않는다.
 *
 * 실측(같은 시드 20260810, scripts/simulate-progression.mjs):
 *   - J1(파일 이동)+J2(30개 항목 추가)만 적용한 상태 → reportHash가
 *     Track J 이전 골든 값과 완전히 동일(비트 단위) — J2가 시뮬레이터에
 *     전혀 영향을 주지 않음을 실증.
 *   - J3(드롭 테이블 105+30종 추가) 적용 후에만 reportHash가 바뀜 —
 *     processLoot가 authority로 호출되고, 고정 시드가 새로 커버된
 *     몬스터를 만나면 리포트에 반영되기 때문(의도된 변경,
 *     tests/progression-simulator.test.js의 골든 해시를 갱신함).
 *
 * progression:compare(scripts/compare-progression.mjs)도 predecessorProfile/
 * candidateProfile을 exp/loot/event 배율 "하나"로만 비교하는 합성 비교라
 * "이 커밋이 추가한 실제 콘텐츠 값"을 비교할 수 없다(예: --axis loot
 * --multiplier 1.05로 실행하면 equipmentDropAttempts만 ~5% 늘어나고 레벨별
 * 체크포인트 소요 전투수는 완전히 동일 — 전역 스칼라 비교 도구이지 데이터
 * diff 도구가 아님을 실측 확인).
 *
 * 따라서 J4는 "첫방문 골드 ÷ 지역 평균 몬스터 골드" 비율을 기존 21개
 * 항목에서 직접 역산하고, 새 30개 항목이 그 실측 범위의 ±10% 안에 있는지
 * 직접 검증한다. exploreUtils.ts spawnEnemy(~226-228)의 골드 공식:
 * BALANCE.MONSTER_GOLD_BASE + level×2.
 */

const resolveLevel = (map) => {
    if (map.level === 'infinite') return 50; // spawnEnemy도 무한 심연을 50+로 취급
    if (Array.isArray(map.level)) return (map.level[0] + map.level[1]) / 2;
    return map.level;
};

const EXISTING_MAP_NAMES = [
    '고요한 숲', '서쪽 평원', '호수의 신전', '잊혀진 폐허', '버려진 광산', '어둠의 동굴',
    '화염의 협곡', '용의 둥지', '사막 오아시스', '피라미드', '얼음 성채', '빙하 심연',
    '북부 요새', '기계 폐도', '천공 정원', '심해 회랑', '에테르 관문', '암흑 성',
    '마왕성', '혼돈의 심연', '고대 보물고',
];

const NEW_COMBAT_MAP_NAMES = [
    '신성한 호수', '수정 동굴', '고대 하수도', '바람의 고원', '몰락한 전초기지',
    '화염의 사원', '북부 설원', '고대 마법 탑',
    '붕괴된 마법 요새', '차원의 틈새', '어둠의 지하 감옥', '지하 미궁',
    '공중 신전', '영혼의 강', '금지된 도서관', '세계수 숲', '고대 신전 도시',
    '차원의 균열 전초기지', '폐기된 연구소', '저주받은 묘지', '용암 지대',
    '폭풍의 고원', '에테르 폐허', '공허의 회랑', '종말의 전장', '봄의 정원',
    '서리 폭풍 유적',
];

const NEW_SAFE_MAP_NAMES = ['여행자의 쉼터', '허공의 섬', '황금 왕국'];

test('J4: 새 첫방문 보상의 "골드 ÷ 지역 평균 몬스터 골드" 비율이 기존 21개 항목 실측 범위의 ±10% 안에 있다', () => {
    const avgMonsterGold = (level) => BALANCE.MONSTER_GOLD_BASE + level * 2;

    const existingRatios = EXISTING_MAP_NAMES.map(
        (name) => FIRST_VISIT_REWARDS[name].gold / avgMonsterGold(resolveLevel(MAPS[name])),
    );
    // ±10% 예산(J4 게이트) — 실측 최소/최대에 10%의 여유만 더한다.
    const minRatio = Math.min(...existingRatios) * 0.9;
    const maxRatio = Math.max(...existingRatios) * 1.1;

    assert.equal(NEW_COMBAT_MAP_NAMES.length + NEW_SAFE_MAP_NAMES.length, 30);

    const overBudget = [];
    for (const name of NEW_COMBAT_MAP_NAMES) {
        const level = resolveLevel(MAPS[name]);
        const ratio = FIRST_VISIT_REWARDS[name].gold / avgMonsterGold(level);
        if (ratio < minRatio || ratio > maxRatio) {
            overBudget.push(`${name}: level=${level} ratio=${ratio.toFixed(2)} (허용 [${minRatio.toFixed(2)}, ${maxRatio.toFixed(2)}])`);
        }
    }
    assert.deepEqual(overBudget, [], `±10% 예산 밖 지역: ${overBudget.join(' | ')}`);

    for (const name of NEW_SAFE_MAP_NAMES) {
        assert.ok(FIRST_VISIT_REWARDS[name].gold <= 250,
            `${name} safe 지역 골드는 소액(≤250) 유지`);
    }
});

test('J4: 기존 21개 항목 대비 새 첫방문 항목의 gold/level 비율이 같은 자릿수 대(order of magnitude) 안에 있다', () => {
    const existingRatios = EXISTING_MAP_NAMES.map((name) => {
        const level = resolveLevel(MAPS[name]);
        return FIRST_VISIT_REWARDS[name].gold / level;
    });
    const minExisting = Math.min(...existingRatios) * 0.4;
    const maxExisting = Math.max(...existingRatios) * 2.5;

    for (const name of NEW_COMBAT_MAP_NAMES) {
        const level = resolveLevel(MAPS[name]);
        const ratio = FIRST_VISIT_REWARDS[name].gold / level;
        assert.ok(ratio >= minExisting && ratio <= maxExisting,
            `${name} gold/level=${ratio.toFixed(1)}이 기존 범위[${minExisting.toFixed(1)}, ${maxExisting.toFixed(1)}] 밖`);
    }
});

test('J4: progressionSimulator authorityUsage에는 첫 방문 보상 경로가 없다 (미모델링 사실 자체를 회귀 가드)', async () => {
    // src/systems/progressionSimulator.ts가 이후 getFirstVisitReward를
    // authority로 채택하면 이 테스트가 깨지며 "이제 J2도 모델링됨"을
    // 알려준다 — 그 경우 이 파일의 J4 상단 주석과 실측 결론을 재검토해야 함.
    const { simulateProgression } = await import('../src/systems/progressionSimulator.js');
    const report = simulateProgression({ seed: 1 });
    const usageValues = Object.values(report.authorityUsage || {});
    assert.ok(!usageValues.some((v) => /firstVisit|getFirstVisitReward/i.test(String(v))),
        'authorityUsage에 첫 방문 보상 경로 미포함(현재 미모델링 상태 확인)');
});
