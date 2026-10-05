import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { DB } from '../data/db.js';
import { advanceBossGauge, isAreaBossUndefeated } from './bossGauge.js';
import { applyTempBuffRule, mergeTempBuff } from '../systems/tempBuffMerge.js';
import type { GameMap, Player, PostCombatResult } from '../types/index.js';

/**
 * postCombatChoice.ts — 전투 후 "밀어붙인다 / 숨을 고른다" 2선택 (2026-09 D2).
 *
 * campfireEvent.ts / scoutEvents.ts / bossGauge.ts와 동일한 순수 함수 패턴 —
 * 입력 → 새 객체, 부수효과 없음. 실제 적용은 reducer(combatHandlers의
 * RESOLVE_POST_COMBAT_CHOICE) 한 곳에서만 일어나며, 이 파일은 "무엇을 제시할지"와
 * "무엇이 바뀌는지"를 계산만 한다. 카드(PostCombatCard)와 reducer가 같은 함수를
 * 참조하므로 표시된 문구와 실제 효과가 어긋날 수 없다 (lessons R33).
 *
 * 설계:
 *  - 밀어붙인다: 다음 전투용 공격력 tempBuff + 보스 접근 게이지 1칸 추가 +
 *    다음 탐험의 모닥불 분기 차단 (회복 기회를 스스로 포기하는 대가).
 *  - 숨을 고른다: 최대 생명의 일부 회복 + 연속 처치 초기화. 게이지는 올리지 않는다.
 *  - 카드를 그냥 닫으면 아무 일도 일어나지 않는다 (기존 동작 그대로).
 */

export type PostCombatChoiceId = 'push' | 'breather';

export interface PostCombatChoiceOption {
    id: PostCombatChoiceId;
    label: string;
    detail: string;
    testId: string;
}

/** 보스 전투 결과인지 — 보스 격파는 원정을 마무리하는 지점이라 선택을 제시하지 않는다. */
const isBossVictory = (result: PostCombatResult | null | undefined): boolean => Boolean(
    result?.isBoss === true
    || result?.enemyTier === 'BOSS'
    || result?.bossRewardHint
    || (result?.bossClearBonus || 0) > 0,
);

/**
 * 이 전투 결과에 선택을 제시할지. 승리 결과가 있고, 보스 격파가 아니며,
 * 아직 이번 카드에서 선택하지 않았을 때만 true.
 */
export const isPostCombatChoiceOffered = (result: PostCombatResult | null | undefined): boolean => Boolean(
    result
    && !isBossVictory(result)
    && result.postCombatChoiceResolved !== true,
);

/**
 * "밀어붙인다"가 보스 접근 게이지를 올리는지 — `applyPostCombatChoice`가 쓰는 판정 그대로다
 * (미격파 구역 보스가 있는 지역에서만 오른다).
 */
export const doesPushAdvanceBossGauge = (
    player: Player | null | undefined,
    mapData: GameMap | null | undefined,
): boolean => isAreaBossUndefeated(mapData, player);

/**
 * 두 선택지의 표시 정보 — 수치는 전부 BALANCE, 문구는 전부 MSG.
 * 2026-10: "밀어붙인다" 설명은 늘 치르는 대가(다음 탐험의 모닥불 차단)를 말하고, 보스 게이지는 실제로 오를 때만
 * 말한다 — `player`의 현재 지역(지도 데이터는 리듀서와 같은 `DB.MAPS[loc]`)으로 판정한다. 플레이어를 모르면
 * 게이지를 약속하지 않는다.
 */
/** "밀어붙인다"가 거는 강화 — 카드 설명과 정산(`applyPostCombatChoice`)이 같은 값을 읽는다. */
const buildPushBuff = () => ({
    atk: BALANCE.POST_COMBAT_PUSH_ATK_BONUS,
    def: 0,
    turn: BALANCE.POST_COMBAT_PUSH_TURNS,
    name: MSG.POST_COMBAT_PUSH_BUFF_NAME,
});

/** Wave 62 C6: 지금 걸린 강화가 더 세서 "밀어붙인다"의 공격력 강화가 붙지 않는지 — 정산과 같은 규칙(`mergeTempBuff`). */
const isPushBuffKeptOut = (player: Player | null | undefined): boolean => Boolean(
    player && mergeTempBuff(player.tempBuff, buildPushBuff()).kept === 'current',
);

export const getPostCombatChoiceOptions = (
    player?: Player | null,
    mapData: GameMap | null | undefined = player?.loc ? DB.MAPS[player.loc] : null,
): PostCombatChoiceOption[] => [
    {
        id: 'push',
        label: MSG.POST_COMBAT_PUSH_CHOICE,
        detail: [
            MSG.POST_COMBAT_PUSH_DETAIL(
                Math.round(BALANCE.POST_COMBAT_PUSH_ATK_BONUS * 100),
                BALANCE.POST_COMBAT_PUSH_TURNS,
                doesPushAdvanceBossGauge(player, mapData),
            ),
            // 설명이 약속한 강화가 규칙에 밀릴 때는 그 사실을 함께 말한다(정산 로그와 같은 판정).
            ...(isPushBuffKeptOut(player) ? [MSG.POST_COMBAT_PUSH_DETAIL_BUFF_KEPT] : []),
        ].join(' · '),
        testId: 'post-combat-choice-push',
    },
    {
        id: 'breather',
        label: MSG.POST_COMBAT_BREATHER_CHOICE,
        detail: MSG.POST_COMBAT_BREATHER_DETAIL(
            Math.round(BALANCE.POST_COMBAT_BREATHER_HEAL_RATIO * 100),
        ),
        testId: 'post-combat-choice-breather',
    },
];

export interface PostCombatChoiceResult {
    player: Player;
    logs: Array<{ type: string; text: string }>;
}

/**
 * 선택 적용 — 새 player와 로그를 반환한다 (순수 함수).
 * @param maxHp 장비·패시브가 반영된 실효 최대 생명 (reducer가 calculateFullStats로 계산해 전달).
 */
export const applyPostCombatChoice = (
    player: Player,
    choice: PostCombatChoiceId,
    mapData: GameMap | null | undefined,
    maxHp: number,
): PostCombatChoiceResult => {
    const logs: Array<{ type: string; text: string }> = [];

    if (choice === 'push') {
        const pct = Math.round(BALANCE.POST_COMBAT_PUSH_ATK_BONUS * 100);
        const gaugeAdvances = doesPushAdvanceBossGauge(player, mapData);
        const nextStats = {
            ...(gaugeAdvances ? advanceBossGauge(player, mapData) : (player.stats || {})),
            nextExploreCampfireBlocked: true,
        };
        // Wave 62 C6: 강화 칸 규칙(더 센 쪽 유지) — 더 센 강화(물약 · 모닥불 단련 …)가 걸려 있으면 그것을 남기고 알린다.
        //   모닥불 차단 · 게이지는 강화와 무관하게 그대로 치른다(고른 대가).
        const push = applyTempBuffRule(player, buildPushBuff(), MSG.POST_COMBAT_PUSH_BUFF_NAME);
        if (push.applied) logs.push({ type: 'success', text: MSG.POST_COMBAT_PUSH_LOG(pct, BALANCE.POST_COMBAT_PUSH_TURNS) });
        else if (push.notice) logs.push({ type: 'info', text: push.notice });
        if (gaugeAdvances) logs.push({ type: 'warning', text: MSG.POST_COMBAT_PUSH_GAUGE_LOG });
        return {
            player: {
                ...push.player,
                stats: nextStats,
            },
            logs,
        };
    }

    const effectiveMaxHp = Math.max(1, Math.floor(Number(maxHp) || 0) || Math.max(1, player.maxHp || 1));
    const currentHp = Math.max(0, Number(player.hp) || 0);
    const healAmount = Math.max(1, Math.floor(effectiveMaxHp * BALANCE.POST_COMBAT_BREATHER_HEAL_RATIO));
    const healed = Math.max(0, Math.min(effectiveMaxHp, currentHp + healAmount) - currentHp);
    logs.push({ type: 'success', text: MSG.POST_COMBAT_BREATHER_LOG(healed) });
    return {
        player: { ...player, hp: currentHp + healed, killStreak: 0 },
        logs,
    };
};
