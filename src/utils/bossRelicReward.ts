import { RELICS, pickWeightedRelics } from '../data/relics';
import type { Monster, Player, Relic } from '../types/index.js';

/**
 * 보스 처치 유물 보상(2026-10 Wave 59, 소유자 결정 "보스 보상 설명대로 구현 + 측정") — 브리핑이 유물 드랍을 약속한 보스
 * (시간의 파수꾼 "희귀 유물" · 공허의 군주 "공허 계열 전설 유물")는 처치 때 유물 선택을 1번 보장한다. 이전에는 보스 처치로 유물을
 * 얻는 경로가 없었다.
 *
 * 후보는 가지지 않은 유물 가운데 `rarities` 안에서 고르고, 이름에 `preferNames`가 들어간 유물(시간 · 공허 계열)을 먼저 채운 뒤
 * 나머지 칸을 같은 등급의 다른 유물로 채운다. 유물 칸이 가득 차 있어도 제안한다 — 선택 화면이 교체 · 넘기기를 보인다(보장 보상).
 */
export const pickBossRewardRelics = (
    player: Player,
    enemy: Pick<Monster, 'mechanics'>,
    count: number,
    rng: () => number,
): Relic[] => {
    const reward = enemy.mechanics?.relicReward;
    if (!reward || count <= 0) return [];
    const owned = player.relics || [];
    const available = RELICS.filter((relic) => (
        Boolean(relic.rarity && reward.rarities.includes(relic.rarity)) && !owned.some((ownedRelic) => ownedRelic.id === relic.id)
    ));
    if (available.length === 0) return [];
    const isPreferred = (relic: Relic) => Boolean(reward.preferNames?.some((keyword) => String(relic.name || '').includes(keyword)));
    const preferred = available.filter(isPreferred);
    const first = pickWeightedRelics(preferred, Math.min(count, preferred.length), { owned, rng });
    const rest = available.filter((relic) => !first.some((picked) => picked.id === relic.id));
    const fill = pickWeightedRelics(rest, count - first.length, { owned, rng });
    return [...first, ...fill];
};
