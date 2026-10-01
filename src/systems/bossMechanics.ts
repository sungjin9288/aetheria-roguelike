import type { Monster, StatusId } from '../types/index.js';

/**
 * 보스 기믹 판정(2026-10 Wave 59, 소유자 결정 "보스 기믹 전부 설명대로 구현").
 *
 * 브리핑(`BOSS_BRIEFS`)이 약속한 행동은 몬스터 데이터의 `mechanics`가 선언하고, 엔진(`CombatEngine.enemyAI` ·
 * `combatActionTurn` · `handleVictory`)과 예고(`predictEnemyNextAction`)는 이 파일의 판정만 읽는다 — 예고와 실제
 * 행동이 같은 식을 쓰게 하기 위해서다(이전에는 3페이즈 문턱에서 예고가 2페이즈 값을 보였다). 난수를 쓰지 않는다.
 */

type BossPhase = NonNullable<Monster['phase2']>;

/** 페이즈 전환이 거는 상태 목록 — 둘 이상이면 함께 건다("상태이상이 겹칩니다"). */
export const getPhaseStatuses = (phase: BossPhase | undefined | null): StatusId[] => {
    const effect = phase?.statusEffect;
    if (!effect) return [];
    return Array.isArray(effect) ? [...effect] : [effect as StatusId];
};

/** 2페이즈 문턱 — 데이터 값 그대로(기본 50%). Wave 59 전에는 적 행동마다 ±10%를 새로 뽑았다. */
export const getPhase2Threshold = (enemy: Monster, fallback: number) => enemy.phase2?.threshold ?? fallback;

/** 3페이즈 문턱 — 데이터 값 그대로(기본 25%). */
export const getPhase3Threshold = (enemy: Monster) => enemy.phase3?.threshold ?? 0.25;

/**
 * 이번 행동이 브레스인가. `actionCount`는 이번 행동까지 센 값(1부터)이다 — `every`번째 행동마다 브레스다.
 * 기절로 넘어간 행동도 세므로, 브레스 차례에 기절시키면 그 브레스는 나오지 않는다.
 */
export const isBreathAction = (enemy: Monster) => {
    const breath = enemy.mechanics?.breath;
    const count = enemy.actionCount ?? 0;
    return Boolean(breath) && count > 0 && count % breath!.every === 0;
};

/** 다음 행동이 브레스인가(예고용 — 지금까지 센 행동 수 + 1로 판정한다). */
export const isBreathNext = (enemy: Monster) => {
    const breath = enemy.mechanics?.breath;
    return Boolean(breath) && ((enemy.actionCount ?? 0) + 1) % breath!.every === 0;
};

/** 장기전 손해 — 이번 행동의 공격력 추가 비율(0이면 아직 시작 전). */
export const getLongFightEnrageBonus = (enemy: Monster) => {
    const enrage = enemy.mechanics?.longFightEnrage;
    if (!enrage) return 0;
    const over = (enemy.actionCount ?? 0) - enrage.afterActions;
    return over > 0 ? Math.min(enrage.max, over * enrage.perAction) : 0;
};

/** 장기전 보상 — 처치 골드 · 경험치 추가 비율(행동 수 × perAction, 상한 max). */
export const getLongFightRewardBonus = (enemy: Monster) => {
    const reward = enemy.mechanics?.longFightReward;
    if (!reward) return 0;
    return Math.min(reward.max, Math.max(0, enemy.actionCount ?? 0) * reward.perAction);
};

/** 저항 무력화 페이즈인가 — 그 페이즈에 들어간 뒤로 상태 저항 유물 · 원소 저항 장비가 통하지 않는다. */
export const isResistPierced = (enemy: Monster) => Boolean(
    (enemy.phase3Triggered && enemy.phase3?.pierceResist)
    || (enemy.phase2Triggered && enemy.phase2?.pierceResist),
);

/** 2페이즈 뒤 강타가 거는 상태(없으면 null) — 2페이즈 전에는 걸지 않는다. */
export const getActiveHeavyStatus = (enemy: Monster) => (
    enemy.phase2Triggered ? enemy.mechanics?.heavyStatus ?? null : null
);
