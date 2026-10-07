import { BALANCE } from '../data/constants.js';
import type { MetaVitalsSnapshot, Player } from '../types/index.js';
import { getPrestigeUnlocks } from './prestigeUnlocks.js';

/**
 * 영구 스탯 레벨 연동 · 계승 rank 적 레벨 가산 (2026-09 Wave 40, 소유자 결정 "더 하드하게" — 연동 + 가산).
 *
 * 계승으로 넘어온 영구 스탯(정수 사다리 · 첫 죽음 · 계승 보상)이 Lv1부터 전부 적용되던 동안, 계승 런은 사망이 원래 나는
 * 초반을 통째로 건너뛰었다(16시드 × 계승 4회에서 2·3회차 사망 0). 이제 영구 스탯은 레벨이 `META_BONUS_FULL_LEVEL`에
 * 닿을 때까지 비례해서 적용되고, 계승 rank마다 적의 전투 레벨이 그 레벨에 비례해 오른다(보상 · 표시 레벨은 그대로). 오르는 비율은
 * 계승할 때마다 커지고 오르는 폭은 줄어든다(Wave 73 — 상한 30%에서 멈추던 것을 대체).
 *
 * 영구 공격력은 `calculateFullStats`가 매번 더하므로(Wave 32) 여기의 비율을 곱하면 끝이다. 영구 생명 · 기력은 저장된
 * `maxHp`/`maxMp`에 구워지므로, 재구성(새 게임 · 전직 · 사망 재시작) 때 **전체량 스냅숏**을 남기고 그 × 비율만 굽는다.
 * 레벨업은 비율이 오른 만큼만 더 굽는다. 스냅숏이 없는 기존 세이브는 예전처럼 동작하다가 다음 재구성부터 이 규칙을 따른다.
 */

type MetaSource = Pick<NonNullable<Player['meta']>, 'bonusAtk' | 'bonusHp' | 'bonusMp' | 'prestigeRank'> | null | undefined;

const nonNegative = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
};

/** 영구 스탯 적용 비율 — Lv1은 1/`META_BONUS_FULL_LEVEL`, 그 레벨부터 1. */
export const getMetaBonusRamp = (level: unknown): number => {
    const lv = Math.max(1, Math.floor(nonNegative(level)) || 1);
    return Math.min(1, lv / BALANCE.META_BONUS_FULL_LEVEL);
};

/** 전투 공격력에 더할 영구 공격력(에테르 초월 배율 포함, 레벨 연동). */
export const getRampedMetaAtk = (meta: MetaSource, level: unknown): number => (
    nonNegative(meta?.bonusAtk) * getPrestigeUnlocks(meta?.prestigeRank).statMult * getMetaBonusRamp(level)
);

type StorySource = Pick<NonNullable<Player['storyStatBonus']>, 'hp' | 'mp'> | null | undefined;

/**
 * 재구성 순간의 영구 생명 · 기력 전체량(에테르 초월 배율 포함).
 * 2026-10 Wave 72: 영구가 된 이야기 생명 · 기력(`storyStatBonus`)도 같은 스냅숏에 실린다 — 같은 레벨 비례로 굽고, 에테르 초월
 *   배율(계승 정수 · 첫 죽음의 영구 보너스 ×2)은 걸지 않는다.
 */
export const snapshotMetaVitals = (meta: MetaSource, story?: StorySource): MetaVitalsSnapshot => {
    const statMult = getPrestigeUnlocks(meta?.prestigeRank).statMult;
    return {
        hp: nonNegative(meta?.bonusHp) * statMult + nonNegative(story?.hp),
        mp: nonNegative(meta?.bonusMp) * statMult + nonNegative(story?.mp),
    };
};

/** 그 레벨에서 저장값에 구워져 있어야 할 영구 생명 · 기력. */
export const getBakedMetaVitals = (snapshot: MetaVitalsSnapshot, level: unknown): MetaVitalsSnapshot => {
    const ramp = getMetaBonusRamp(level);
    return { hp: Math.floor(snapshot.hp * ramp), mp: Math.floor(snapshot.mp * ramp) };
};

/** 레벨업 한 번에 더 구울 영구 생명 · 기력 — 스냅숏이 없으면(기존 세이브) 0이다. */
export const getMetaVitalsLevelUpDelta = (
    snapshot: MetaVitalsSnapshot | null | undefined,
    fromLevel: number,
    toLevel: number,
): MetaVitalsSnapshot => {
    if (!snapshot) return { hp: 0, mp: 0 };
    const before = getBakedMetaVitals(snapshot, fromLevel);
    const after = getBakedMetaVitals(snapshot, toLevel);
    return { hp: Math.max(0, after.hp - before.hp), mp: Math.max(0, after.mp - before.mp) };
};

/**
 * 계승 rank만큼 오르는 적 전투 레벨의 비율 — 계승할 때마다 오르고 오르는 폭은 줄어든다(Wave 73).
 * `LIMIT × (1 − DECAY^rank)`: rank 0은 0이고, rank가 오를수록 커지며, `LIMIT`을 넘지 않는다.
 */
export const getPrestigeEnemyLevelRate = (prestigeRank: unknown): number => (
    BALANCE.PRESTIGE_ENEMY_LEVEL_PCT_LIMIT
    * (1 - BALANCE.PRESTIGE_ENEMY_LEVEL_PCT_DECAY ** Math.floor(nonNegative(prestigeRank)))
);

/** 계승 rank만큼 오르는 적의 전투 레벨 — 그 적 레벨에 비례한다(생명 · 공격력 · 방어력에만 쓴다). */
export const getPrestigeEnemyLevelBonus = (prestigeRank: unknown, enemyLevel: unknown): number => (
    Math.round(nonNegative(enemyLevel) * getPrestigeEnemyLevelRate(prestigeRank))
);
