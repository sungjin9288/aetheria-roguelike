import type { Relic, RelicRarity } from '../types/index.js';

/**
 * 등급 서열(낮음 → 높음) — `Record<RelicRarity, …>`라 등급이 늘면 여기서 컴파일 에러가 난다. 추첨 가중치 표
 * (`data/relics.ts`의 `RELIC_WEIGHTS` · `RARITY_ORDER`)와 같은 순서다. 그 파일은 바이트 해시가 증빙에 묶여 있어
 * (`relic-hp-drain-atk.json`) 이 판정을 그 옆에 두지 않는다.
 */
const RARITY_RANK: Readonly<Record<RelicRarity, number>> = Object.freeze({
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
});

const RARITIES_HIGH_TO_LOW = (Object.keys(RARITY_RANK) as RelicRarity[])
    .sort((left, right) => RARITY_RANK[right] - RARITY_RANK[left]);

/**
 * 등급을 약속한 보상의 후보 풀(Wave 62 C3) — 이야기 "전설의 유물"은 데이터가 `rarity: 'legendary'`를 선언하고, 엔진은
 * 미보유 유물(`available`) 가운데 그 등급만 넘겨 추첨한다(`pickWeightedRelics`). 그 등급을 모두 가졌으면 남은 유물 중
 * **가장 높은 등급**으로 내려간다(결정론) — `fellBack`이 true면 호출부가 로그로 알린다. 남은 유물이 없으면 빈 풀이다.
 */
export const selectRarityRewardPool = (
    available: readonly Relic[],
    rarity: RelicRarity,
): { pool: Relic[]; rarity: RelicRarity | null; fellBack: boolean } => {
    const exact = available.filter((relic) => relic.rarity === rarity);
    if (exact.length > 0) return { pool: exact, rarity, fellBack: false };
    for (const fallbackRarity of RARITIES_HIGH_TO_LOW) {
        const pool = available.filter((relic) => relic.rarity === fallbackRarity);
        if (pool.length > 0) return { pool, rarity: fallbackRarity, fellBack: true };
    }
    return { pool: [], rarity: null, fellBack: true };
};
