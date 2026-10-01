import { BALANCE, CONSTANTS } from '../data/constants.js';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks.js';
import { getMirrorEffects } from '../systems/mirrorUpgrades.js';
import type { Player } from '../types/index.js';

/**
 * 새 여정의 시작 조건 — 새 게임(`start`)과 계승(`ASCEND`)이 같이 읽는다(2026-10 Wave 58).
 *
 * 계승은 이름을 남겨 새 게임을 다시 타지 않는다. 그래서 거울의 시작 골드 · 첫 유물 선택지와 계승 5단계(첫 유물
 * 선택지 4개) · 7단계(도전 조건 하나 더)가 사망 재시작에만 적용되고, 정상 경로인 "마왕 처치 → 계승" 뒤에는
 * 적용되지 않았다. 두 경로가 이 함수들을 함께 써서 다시 갈라지지 않게 한다.
 */

type Meta = Player['meta'];

const CHALLENGE_IDS: ReadonlySet<string> = new Set(BALANCE.CHALLENGE_MODIFIERS.map((modifier) => modifier.id));

/** 고를 수 있는 도전 조건 수 — 기본 + 계승 7단계 보너스. */
export const getChallengeSlotCount = (prestigeRank: number | undefined): number => (
    BALANCE.CHALLENGE_MODIFIER_SLOTS + getPrestigeUnlocks(prestigeRank).challengeSlotBonus
);

/** 알려진 도전 조건만, 중복 없이, 슬롯 수까지. */
export const sanitizeChallengeModifiers = (value: unknown, prestigeRank: number | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    const picked: string[] = [];
    for (const id of value) {
        if (typeof id !== 'string' || !CHALLENGE_IDS.has(id) || picked.includes(id)) continue;
        picked.push(id);
    }
    return picked.slice(0, getChallengeSlotCount(prestigeRank));
};

/** 도전 규칙 선택 토글 — 고른 것은 빼고, 아니면 슬롯 수까지 더한다(인트로 · 계승 화면 공용). */
export const toggleChallengeSelection = (current: readonly string[], id: string, slots: number): string[] => (
    current.includes(id)
        ? current.filter((challengeId) => challengeId !== id)
        : [...current, id].slice(0, slots)
);

/** 시작 골드 — 기본 + 거울 유산의 금고. 빈손의 시작은 의도된 페널티라 거울 보너스도 함께 0이다. */
export const getRunStartGold = (meta: Meta, challengeModifiers: readonly string[]): number => (
    challengeModifiers.includes('noGold') ? 0 : CONSTANTS.START_GOLD + getMirrorEffects(meta).startGoldBonus
);

/** 첫 유물 선택지 수 — 기본 + 계승 5단계 + 거울 각성의 선택. */
export const getStartBootChoiceCount = (meta: Meta): number => (
    getPrestigeUnlocks(meta?.prestigeRank).startBootChoices + getMirrorEffects(meta).startBootChoiceBonus
);

/** 약한 생명력 — 최대 생명 절반(하한 50). */
export const applyChallengeMaxHp = (maxHp: number, challengeModifiers: readonly string[]): number => (
    challengeModifiers.includes('halfHp') ? Math.max(50, Math.floor(maxHp * 0.5)) : maxHp
);
