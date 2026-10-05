import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getLocationVisual, type LocationVisual } from './locationVisuals.js';
import { getRegionTheme, type RegionTheme } from './regionTheme.js';
import type { ExpeditionSummary, GameMap, Player } from '../types/index.js';

/**
 * 도전 규칙(`BALANCE.CHALLENGE_MODIFIERS`)의 엔진 판정 — 2026-10 Wave 62 (원장 §61.2 A9 · A10, §61.4 C1 · C15 · C16,
 * 소유자 결정 "전부 설명대로").
 *
 * 규칙 설명이 약속한 효과를 한 곳에서 판정한다. 화면 · 리듀서 · 엔진이 같은 함수를 읽어 다시 갈라지지 않게 한다:
 * - 보상 배율(C1): 고른 규칙 수 → 전투 경험치 · 골드 배율. 선택 화면의 "+N%"도 이 표에서 나온다.
 * - 빈손의 시작(C16): 모든 골드 수입이 절반 — `grantGold`와 그것을 거치지 않는 수입 경로가 `getGoldIncome`을 읽는다.
 * - 약한 생명력(A9): 저장 최대 생명의 재구성(시작 · 계승 · 전직)은 `applyChallengeMaxHp`, 늘어나는 양(레벨업 · 이야기 보상)은
 *   `getChallengeMaxHpGain`이 절반으로 만든다.
 * - 길 잃은 여행(A10): 위치 이름 · 지역 그림 · 지역 색이 숨는다(`isBlindMap` 하나가 판정).
 */

/** 규칙 판정이 읽는 플레이어 조각 — 화면 · 문구 헬퍼는 플레이어 전체 대신 이것만 받는다. */
export type ChallengeHolder = Pick<Player, 'challengeModifiers'> | null | undefined;

export const hasChallengeModifier = (player: ChallengeHolder, id: string): boolean => (
    Array.isArray(player?.challengeModifiers) && player.challengeModifiers.includes(id)
);

/** 고른 규칙 수 → 전투 경험치 · 골드 배율(표 끝을 넘는 수는 표의 마지막 값). */
export const getChallengeRewardMult = (ruleCount: number): number => {
    const table = BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT;
    const index = Math.max(0, Math.min(table.length - 1, Math.floor(Number(ruleCount) || 0)));
    return table[index];
};

/** 선택 화면의 "+N%" — 엔진 배율과 같은 표에서 계산한다. */
export const getChallengeRewardPercent = (ruleCount: number): number => (
    Math.round((getChallengeRewardMult(ruleCount) - 1) * 100)
);

/**
 * 빈손의 시작 — 이 플레이어가 실제로 받는 골드 수입. 들어오는 골드(양수)만 절반이고, 비용(음수)은 그대로다.
 * 모든 수입 경로가 이것을 정확히 한 번 거친다(`grantGold` · 전투 승리 정산 · 묘비 회수 · 폴백 이벤트 거래).
 * 수입을 말하는 로그 · 미리보기(판매가 · 보상 줄 · 사건 결과)도 이 값을 적는다 — 명목 금액을 적으면 '빈손의 시작'에서
 * "골드 +500"을 읽고 250을 받는다(`tests/no-gold-log-amount-contract.test.js`).
 */
export const getGoldIncome = (player: ChallengeHolder, amount: number): number => (
    amount > 0 && hasChallengeModifier(player, 'noGold')
        ? Math.floor(amount * BALANCE.NO_GOLD_MODIFIER_MULT)
        : amount
);

/** 약한 생명력 — 최대 생명 재구성(시작 · 계승 · 전직) 값의 절반(하한 `CHALLENGE_HALF_HP_FLOOR`). */
export const applyChallengeMaxHp = (maxHp: number, challengeModifiers: readonly string[]): number => (
    challengeModifiers.includes('halfHp')
        ? Math.max(BALANCE.CHALLENGE_HALF_HP_FLOOR, Math.floor(maxHp * BALANCE.CHALLENGE_HALF_HP_MULT))
        : maxHp
);

/** 약한 생명력 — 저장 최대 생명이 늘어나는 양(레벨업 · 성장 보너스 · 이야기 보상)의 절반. 다른 경우 그대로. */
export const getChallengeMaxHpGain = (player: ChallengeHolder, gain: number): number => (
    gain > 0 && hasChallengeModifier(player, 'halfHp')
        ? Math.floor(gain * BALANCE.CHALLENGE_HALF_HP_MULT)
        : gain
);

/** 길 잃은 여행 — 현재 위치와 지도 정보를 숨기는지. */
export const isBlindMap = (player: ChallengeHolder): boolean => hasChallengeModifier(player, 'blindMap');

/** 화면 · 로그에 쓰는 위치 이름 — 길 잃은 여행이면 자리표시(`MSG.BLIND_MAP_LOCATION`). */
export const getVisibleLocationName = (player: ChallengeHolder, loc: string | undefined): string | undefined => (
    isBlindMap(player) ? MSG.BLIND_MAP_LOCATION : loc
);

/** 터미널의 지역 그림 — 길 잃은 여행이면 없다. */
export const getVisibleLocationVisual = (player: (ChallengeHolder & Pick<Player, 'loc'>) | null | undefined): LocationVisual | null => (
    player?.loc && !isBlindMap(player) ? getLocationVisual(player.loc) : null
);

/** 지역 색(배경 wash · 강조색) — 길 잃은 여행이면 없다(레이아웃의 기본 색 하나로 고정된다). */
export const getVisibleRegionTheme = (
    player: (ChallengeHolder & Pick<Player, 'loc'>) | null | undefined,
    mapData: GameMap | null | undefined,
): RegionTheme | null => (
    isBlindMap(player) ? null : getRegionTheme(player?.loc, mapData)
);

/** 원정 기록(귀환 카드 · 지난 원정 줄)의 지역 이름 — 길 잃은 여행이면 자리표시. 저장된 기록은 그대로 두고 그릴 때만 가린다. */
export const getVisibleExpeditionSummary = (player: ChallengeHolder, summary: ExpeditionSummary): ExpeditionSummary => (
    isBlindMap(player)
        ? {
            ...summary,
            origin: MSG.BLIND_MAP_LOCATION,
            destination: MSG.BLIND_MAP_LOCATION,
            lastLocation: MSG.BLIND_MAP_LOCATION,
            returnLocation: MSG.BLIND_MAP_LOCATION,
        }
        : summary
);

/** 출발 준비의 목적지(다음으로 걸을 출구) — 길 잃은 여행이면 출구가 어디로 이어지는지 말하지 않는다. */
export const getVisibleRouteName = (player: ChallengeHolder, routeName: string): string => (
    isBlindMap(player) ? MSG.BLIND_MAP_ROUTE_NAME : routeName
);
