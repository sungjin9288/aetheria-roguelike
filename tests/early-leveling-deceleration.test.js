import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getFirstVisitReward } from '../src/utils/exploreUtils.js';
import { getPacedCombatExp, getPacedQuestClaimExp } from '../src/utils/progressionPacing.js';
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
 * - Lv1~4 전투 EXP 60% — 처치 보상과 퀘스트 보상의 중복 급성장 완화
 * - Lv1~10 퀘스트 EXP 상한 하향 — 단일 수령뿐 아니라 누적 동선도 제어
 *
 * 계약: 첫 이야기와 슬라임 임무 뒤 Lv1, 멧돼지 임무 뒤 Lv2, 거미 임무까지
 * 완료한 뒤 Lv3 초반에 머문다. 전직(Lv5)은 4~5개 지역을 익힌 뒤의 보상이다.
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

const awardCombatExp = (player, rawExp) => applyExp(player, getPacedCombatExp(player, rawExp));

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

test('slice 52: 초반 누적 성장 동선 — 멧돼지 후 Lv2, 거미 후 Lv3 초반', () => {
    let player = freshVitals();

    player = applyExp(player, visitExp('고요한 숲'));   // 첫 방문 (감속 후)
    player = claimQuest(player, 80);                     // [스토리] 첫 번째 여정
    player = awardCombatExp(player, 60);                 // 슬라임 3킬 (20/킬)
    player = claimQuest(player, 1);                      // 슬라임 소탕
    assert.equal(player.level, 1, '첫 이야기와 슬라임 임무 뒤 학습 구간 Lv1 유지');

    player = applyExp(player, visitExp('서쪽 평원'));    // 첫 방문 (감속 후)
    player = awardCombatExp(player, 200);                // 멧돼지 5킬 (40/킬)
    player = claimQuest(player, 2);                      // 멧돼지 사냥
    assert.equal(player.level, 2, '멧돼지 임무 뒤 Lv3 조기 진입 금지');

    player = awardCombatExp(player, 200);                // 거미떼 10킬 (20/킬)
    player = claimQuest(player, 110);                    // 거미떼 퇴치

    assert.equal(player.level, 3, '거미 임무 뒤 Lv3 진입');
    assert.ok(player.exp <= Math.floor(player.nextExp * 0.4),
        `거미 임무 뒤 Lv3 초반 40% 이내 (실제: ${player.exp}/${player.nextExp})`);
});

test('slice 52: Lv1~4 전투 EXP는 60%, Lv5부터 원래 보상', () => {
    assert.equal(getPacedCombatExp({ level: 1 }, 20), 12);
    assert.equal(getPacedCombatExp({ level: 4 }, 101), 60);
    assert.equal(getPacedCombatExp({ level: 5 }, 101), 101);
});

test('slice 52: 실제 전투 승리 보상에도 초반 pacing 적용', () => {
    const player = {
        ...freshVitals(),
        relics: [],
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        combatFlags: {},
        status: [],
        challengeModifiers: [],
        inv: [],
        equip: {},
        titles: [],
        skillChoices: {},
    };
    const enemy = {
        name: '슬라임',
        baseName: '슬라임',
        hp: 0,
        maxHp: 81,
        atk: 19,
        def: 1,
        exp: 20,
        gold: 18,
        level: 1,
    };

    const result = CombatEngine.handleVictory(player, enemy, {}, {});

    assert.equal(result.expGained, 12);
    assert.equal(result.updatedPlayer.exp, 12);
});

test('slice 23: 퀘스트 1회 수령 = 최대 1레벨 캡 보존 (slice 17 계약)', () => {
    const player = { ...freshVitals(), level: 2, exp: 225, nextExp: 230 };
    const quest = QUESTS.find((entry) => entry.id === 68);
    const paced = getPacedQuestClaimExp(player, quest.reward.exp);
    const result = CombatEngine.applyExpGain(player, paced);
    assert.equal(result.levelUps, 1, '임계 직전 수령도 1레벨만');
});
