import { getBakedMetaVitals, getMetaBonusRamp } from '../systems/metaBonusRamp';
import { getChallengeMaxHpGain } from './challengeRules';
import { MSG } from '../data/messages';
import type { Player } from '../types/player';

/**
 * 이야기(이벤트 체인) 능력치 보상 — 2026-10 Wave 72 (소유자 결정 "영구로 전환", Wave 62 C2를 대체).
 *
 * 체인은 계정당 한 번이라 런 범위이던 동안 한 번 죽으면 그 보상을 영원히 잃었다. 이제 `player.storyStatBonus`는 사망 · 계승을
 * 넘어 남고(영구 상태 선별), 다른 영구 능력치처럼 `META_BONUS_FULL_LEVEL`까지 레벨에 비례한다:
 * - 공격력 · 방어력: `calculateFullStats`가 배율 뒤에 더한다(Wave 58 고정값 규칙) — 여기 `getRampedStoryFlat`.
 * - 생명 · 기력: 저장 최대치가 정본이라 영구 생명 · 기력 스냅숏(`snapshotMetaVitals`)에 함께 실려 재구성 · 레벨업이 굽는다.
 * 저장값은 원래 양(도전 조건 '약한 생명력'의 절반 적용 전)이다 — 그 규칙은 굽는 순간(`applyChallengeMaxHp` · `getChallengeMaxHpGain`)이 건다.
 */
export interface StoryStatBonus {
    atk: number;
    def: number;
    hp: number;
    mp: number;
}

const nonNegative = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
};

export const readStoryStatBonus = (value: Player['storyStatBonus'] | null | undefined): StoryStatBonus => ({
    atk: nonNegative(value?.atk),
    def: nonNegative(value?.def),
    hp: nonNegative(value?.hp),
    mp: nonNegative(value?.mp),
});

/** "공격력 +1 · 생명 +5" — 0인 항목은 뺀다(정예 목격 칭호 · 이야기 보상 표시가 함께 쓴다). */
export const formatPermanentStatBonus = (bonus: StoryStatBonus): string => (
    (['atk', 'def', 'hp', 'mp'] as const)
        .filter((key) => bonus[key] > 0)
        .map((key) => `${MSG.CHAIN_REWARD_STAT_LABEL[key]} +${bonus[key]}`)
        .join(' · ')
);

/** 영구 상태 선별용 — 값이 하나도 없으면 필드를 남기지 않는다. */
export const pickPermanentStoryStatBonus = (value: Player['storyStatBonus'] | null | undefined): StoryStatBonus | null => {
    const story = readStoryStatBonus(value);
    return story.atk + story.def + story.hp + story.mp > 0 ? story : null;
};

/** 전투 공격력 · 방어력에 더할 이야기 보상(레벨 비례). */
export const getRampedStoryFlat = (player: Pick<Player, 'storyStatBonus' | 'level'>): { atk: number; def: number } => {
    const story = readStoryStatBonus(player.storyStatBonus);
    const ramp = getMetaBonusRamp(player.level);
    return { atk: Math.floor(story.atk * ramp), def: Math.floor(story.def * ramp) };
};

/**
 * 이야기 능력치 보상 지급 — 원래 양을 영구 누적에 더하고, 생명 · 기력은 지금 레벨의 비례만큼 저장 최대치에 굽는다.
 * 스냅숏이 있으면(Wave 40 이후 재구성) 스냅숏에 더하고 비례 차이만 굽는다 — 나머지는 레벨업이 굽는다. 스냅숏이 없는 예전
 * 세이브는 예전처럼 전부 굽는다(다음 재구성부터 스냅숏 규칙을 따른다). '약한 생명력'의 절반은 굽는 양에 건다.
 */
export const applyStoryStatGrant = (
    player: Player,
    reward: { atk?: number; def?: number; hp?: number; mp?: number },
): { player: Player; hpGain: number; mpGain: number } => {
    const story = readStoryStatBonus(player.storyStatBonus);
    const add = readStoryStatBonus(reward);
    const nextStory: StoryStatBonus = {
        atk: story.atk + add.atk,
        def: story.def + add.def,
        hp: story.hp + add.hp,
        mp: story.mp + add.mp,
    };
    const next: Player = { ...player, storyStatBonus: nextStory };
    let bakedHp = add.hp;
    let bakedMp = add.mp;
    const snapshot = player.metaVitalsSnapshot;
    if (snapshot && (add.hp > 0 || add.mp > 0)) {
        const nextSnapshot = { hp: snapshot.hp + add.hp, mp: snapshot.mp + add.mp };
        const before = getBakedMetaVitals(snapshot, player.level);
        const after = getBakedMetaVitals(nextSnapshot, player.level);
        bakedHp = Math.max(0, after.hp - before.hp);
        bakedMp = Math.max(0, after.mp - before.mp);
        next.metaVitalsSnapshot = nextSnapshot;
    }
    const hpGain = getChallengeMaxHpGain(player, bakedHp);
    next.maxHp = (next.maxHp || 0) + hpGain;
    next.maxMp = (next.maxMp || 0) + bakedMp;
    return { player: next, hpGain, mpGain: bakedMp };
};
