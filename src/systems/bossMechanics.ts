import { BALANCE } from '../data/constants.js';
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
    if (!breath) return false;
    // 2026-11 H5: 충전을 함께 선언한 보스(레드 드래곤 "충전 → 브레스")는 모은 강타가 곧 브레스다 — 충전 차례에 기절시키면 브레스가 없다.
    if (enemy.mechanics?.charge) return Boolean(enemy.chargeArmed);
    return count > 0 && count % breath.every === 0;
};

/** 다음 행동이 브레스인가(예고용 — 지금까지 센 행동 수 + 1로 판정한다). */
export const isBreathNext = (enemy: Monster) => {
    const breath = enemy.mechanics?.breath;
    if (!breath) return false;
    if (enemy.mechanics?.charge) return Boolean(enemy.chargeArmed);
    return ((enemy.actionCount ?? 0) + 1) % breath.every === 0;
};

// ── 충전 강타(2026-11 H5, 소유자 결정 Q1 ~ Q4) ─────────────────────────────────────────────
// 보스가 정해진 차례에 공격 대신 힘을 모으고 다음 차례에 큰 한 방을 낸다. 모으는 동안 기절시키거나 크게 때리면 끊긴다.
// 판정은 행동 수(`actionCount`)와 적 인스턴스의 상태(`chargeArmed` · `chargeHpMark`)만 읽는다 — 난수를 쓰지 않는다.

/** 강타 차례 주기(`every`번째 행동이 강타 — 그 앞 행동이 충전). */
export const getChargeEvery = (enemy: Monster) => enemy.mechanics?.charge?.every ?? BALANCE.BOSS_CHARGE_EVERY;

/** 끊기는 피해 — 충전과 강타 사이에 이만큼(보스 최대 생명의 비율) 깎으면 끊긴다. */
export const getChargeBreakDamage = (enemy: Monster) => {
    const ratio = enemy.mechanics?.charge?.breakRatio ?? BALANCE.BOSS_CHARGE_BREAK_RATIO;
    return Math.max(1, Math.ceil(Math.max(1, enemy.maxHp || enemy.hp || 1) * ratio));
};

/** 첫 강타 차례(몇 번째 행동) — 보스 데이터 `first`, 없으면 `BALANCE.BOSS_CHARGE_FIRST_STRIKE`, 그것도 0이면 `every`번째. */
export const getChargeFirstStrike = (enemy: Monster) => {
    const every = getChargeEvery(enemy);
    const first = enemy.mechanics?.charge?.first ?? BALANCE.BOSS_CHARGE_FIRST_STRIKE;
    return first > 0 ? Math.max(2, first) : every;
};

/** `count`번째 행동이 강타 차례인가 — 첫 강타 뒤 `every`번째마다. */
export const isChargeStrikeCount = (enemy: Monster, count: number) => {
    const first = getChargeFirstStrike(enemy);
    return count >= first && (count - first) % getChargeEvery(enemy) === 0;
};

/** 이번 행동(이미 센 `actionCount`)이 충전 차례인가 — 모은 상태가 아니고, 강타 차례 바로 앞이다. */
export const isChargeTurn = (enemy: Monster) => {
    if (!enemy.mechanics?.charge || enemy.chargeArmed) return false;
    const count = enemy.actionCount ?? 0;
    return count > 0 && isChargeStrikeCount(enemy, count + 1);
};

/** 다음 행동이 충전 차례인가(예고용). */
export const isChargeTurnNext = (enemy: Monster) => (
    isChargeTurn({ ...enemy, actionCount: (enemy.actionCount ?? 0) + 1 })
);

/** 충전 뒤 지금까지 깎인 생명(강타 차례 판정 전 — 그 사이 플레이어 행동 · 반사가 준 피해). */
export const getChargeDamageTaken = (enemy: Monster) => (
    Math.max(0, (enemy.chargeHpMark ?? enemy.hp ?? 0) - (enemy.hp ?? 0))
);

/**
 * 모은 강타가 피해로 끊겼는가(기절로 끊기는 것은 엔진의 기절 차례가 판정한다). `breakMult`는 준 피해를 몇 배로 세나 —
 * 끊는 일격 조합(2026-11 H4, `getChargeBreakMult`)만 1보다 크다.
 */
export const isChargeBrokenByDamage = (enemy: Monster, breakMult = 1) => (
    Boolean(enemy.mechanics?.charge && enemy.chargeArmed)
    && getChargeDamageTaken(enemy) * Math.max(1, breakMult) >= getChargeBreakDamage(enemy)
);

/** 끊기까지 더 줘야 하는 실제 피해(예고용) — 센 배율이 크면 그만큼 적다. */
export const getChargeBreakRemaining = (enemy: Monster, breakMult = 1) => {
    const mult = Math.max(1, breakMult);
    return Math.max(1, Math.ceil((getChargeBreakDamage(enemy) - getChargeDamageTaken(enemy) * mult) / mult));
};

/**
 * 충전 강타의 배율 — 지금 패턴(페이즈 · 도발 포함)의 보통 행동 기대 배율 × 2. 방어 자세는 피해 0, 맹공은 `ENEMY_HEAVY_HIT_MULT`다.
 * 엔진은 이 강타에 플레이어 방어력을 두 번 적용한다(두 행동 몫을 한 번에 친다) — 그래서 충전 + 강타의 피해 합은 어떤 방어력에서도
 * 보통 두 행동의 기대 피해 이하다(소유자 결정 Q3 (a) "위험 중립"). 위험은 피해가 한 번에 몰린다는 데 있다.
 */
export const getChargeReleaseMult = (pattern: { guardChance: number; heavyChance: number }) => {
    const guard = Math.max(0, Math.min(1, pattern.guardChance));
    const heavy = Math.max(0, Math.min(1 - guard, pattern.heavyChance));
    return 2 * (heavy * BALANCE.ENEMY_HEAVY_HIT_MULT + (1 - guard - heavy));
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
