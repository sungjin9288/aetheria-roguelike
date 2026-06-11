import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getFirstVisitReward } from '../src/utils/exploreUtils.js';
import { getPacedQuestClaimExp } from '../src/utils/progressionPacing.js';
import { QUESTS } from '../src/data/quests.js';

/**
 * Slice 23: 초반 레벨업 감속 — 학습 구간 확보
 *
 * 실기기 설계 피드백: "초반 레벨업이 너무 빠르면 안 된다. 초반을 즐기면서
 * 게임 플레이를 익혀야 한다."
 *
 * 진단: slice 17-18이 퀘스트 burst(1수령 다중 레벨)는 막았지만, slice 19로
 * 전투가 4-5턴이 되며 실시간 레벨 간격이 짧아짐 — Lv5(전직)까지 ~12분.
 * 초반 콘텐츠(전투 학습/상점/첫 유물/퀘스트 보드)를 음미할 시간이 부족.
 *
 * 설계: 성장 "체감"은 전투 템포·스탯(slice 19 보존)에서, 레벨 "간격"은
 * 느긋하게 — 레벨당 전투 수(=연습량)를 늘린다.
 * - START_NEXT_EXP 150 → 200 (Lv1→5 누적 요구 745 → 998, +34%)
 * - 초반(맵 Lv≤10) 첫 방문 EXP 절반 — 골드는 유지 (경제 불변)
 * - 몬스터/퀘스트 EXP 불변 — 전투가 주 성장원, 퀘스트 캡(slice 17) 그대로
 *
 * 계약: slice 17-18 가드 루트와 동일한 초반 콘텐츠(첫 방문 2회 + 초반
 * 퀘스트 4종 + 슬라임/멧돼지/거미 18킬)를 전부 소비해도 Lv4에서 멈춘다 —
 * 전직(Lv5)은 추가 사냥의 보상.
 */

const EARLY_FIRST_VISIT_EXP_CAPS = {
    '고요한 숲': 25,
    '서쪽 평원': 30,
    '호수의 신전': 50,
    '잊혀진 폐허': 60,
    '버려진 광산': 80,
};

const freshVitals = () => ({
    level: 1,
    exp: 0,
    nextExp: CONSTANTS.START_NEXT_EXP,
    hp: CONSTANTS.START_HP,
    maxHp: CONSTANTS.START_HP,
    mp: CONSTANTS.START_MP,
    maxMp: CONSTANTS.START_MP,
    atk: 12,
    def: 5,
    gold: 0,
    stats: { visitedMaps: ['시작의 마을'] },
});

const applyExp = (player, exp) => CombatEngine.applyExpGain(player, exp).updatedPlayer;

const claimQuest = (player, questId) => {
    const quest = QUESTS.find((entry) => entry.id === questId);
    assert.ok(quest, `quest ${questId} 존재`);
    return applyExp(player, getPacedQuestClaimExp(player, quest.reward.exp));
};

const visitExp = (loc) => {
    const reward = getFirstVisitReward(loc, { stats: { visitedMaps: [] } });
    assert.ok(reward, `${loc} 첫 방문 보상 존재`);
    return reward.exp;
};

test('slice 23: 시작 EXP 요구량 200 (감속 계약)', () => {
    assert.equal(CONSTANTS.START_NEXT_EXP, 200);
});

test('slice 23: 초반 첫 방문 EXP 절반 — 골드는 유지', () => {
    for (const [loc, expCap] of Object.entries(EARLY_FIRST_VISIT_EXP_CAPS)) {
        const reward = getFirstVisitReward(loc, { stats: { visitedMaps: [] } });
        assert.ok(reward.exp <= expCap, `${loc} EXP ≤ ${expCap} (실제: ${reward.exp})`);
    }
    // 경제 불변 스팟체크: 고요한 숲 골드 100 유지
    const forest = getFirstVisitReward('고요한 숲', { stats: { visitedMaps: [] } });
    assert.equal(forest.gold, 100, '첫 방문 골드 보상 유지');
});

test('slice 23: 초반 콘텐츠 전체 소비 루트 — Lv4에서 멈춤 (전직 전)', () => {
    let player = freshVitals();

    player = applyExp(player, visitExp('고요한 숲'));   // 첫 방문 (감속 후)
    player = claimQuest(player, 80);                     // [스토리] 첫 번째 여정
    player = applyExp(player, 63);                       // 슬라임 3킬 (신입 보호 21/킬)
    player = claimQuest(player, 1);                      // 슬라임 소탕
    player = applyExp(player, visitExp('서쪽 평원'));    // 첫 방문 (감속 후)
    player = applyExp(player, 200);                      // 멧돼지 5킬 (40/킬)
    player = claimQuest(player, 2);                      // 멧돼지 사냥
    player = applyExp(player, 200);                      // 거미떼 10킬 (20/킬)
    player = claimQuest(player, 110);                    // 거미떼 퇴치

    assert.ok(player.level <= 4,
        `초반 콘텐츠 전부 소비 후 Lv ≤ 4 (실제: Lv${player.level} ${player.exp}/${player.nextExp})`);
    assert.ok(player.level >= 3,
        `과감속 방지 — Lv ≥ 3 유지 (실제: Lv${player.level})`);
});

test('slice 23: 퀘스트 1회 수령 = 최대 1레벨 캡 보존 (slice 17 계약)', () => {
    const player = { ...freshVitals(), level: 2, exp: 225, nextExp: 230 };
    const quest = QUESTS.find((entry) => entry.id === 68);
    const paced = getPacedQuestClaimExp(player, quest.reward.exp);
    const result = CombatEngine.applyExpGain(player, paced);
    assert.equal(result.levelUps, 1, '임계 직전 수령도 1레벨만');
});
