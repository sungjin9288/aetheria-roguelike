import type { Relic } from '../types/index.js';
import { RELIC_EFFECTS_BY_BUILD } from '../data/relics.js';

// Wave 4 O2: 정의는 `data/relics.ts`로 이동했다 — 추첨 가중치(pickWeightedRelics)와
//   조언 UI가 같은 표를 읽어야 하고, data 계층이 utils를 import하면 계층 역전이 된다.
//   기존 importer 호환을 위해 여기서 그대로 re-export 한다.
export { RELIC_EFFECTS_BY_BUILD };

const BUILD_FIT_SCORES = Object.freeze([40, 32, 24, 16, 10]);

const getBuildEffects = (buildId: string) => (
    RELIC_EFFECTS_BY_BUILD[buildId] || RELIC_EFFECTS_BY_BUILD.balanced
);

export const getRelicBuildFit = (buildId: string, effect?: string) => {
    const rank = effect ? getBuildEffects(buildId).indexOf(effect) : -1;
    return {
        matched: rank >= 0,
        rank,
        score: rank >= 0 ? BUILD_FIT_SCORES[rank] || 0 : 0,
    };
};

export const getRecommendedRelicsForBuild = (
    relics: readonly Relic[],
    buildId: string,
    ownedEffects: readonly string[],
    limit: number,
) => {
    if (limit <= 0) return [];

    const owned = new Set(ownedEffects);
    const recommendations: Relic[] = [];

    for (const effect of getBuildEffects(buildId)) {
        if (owned.has(effect)) continue;
        const relic = relics.find((entry) => entry.effect === effect);
        if (!relic) continue;

        recommendations.push(relic);
        if (recommendations.length === limit) return recommendations;
    }

    return recommendations;
};
