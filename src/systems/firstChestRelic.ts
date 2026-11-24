import { BALANCE } from '../data/constants';
import { RELICS, pickWeightedRelics } from '../data/relics';
import { createDomainRandom } from '../utils/seededRandom';
import { isTrialPlayer } from '../utils/trialPlayer';
import type { Player } from '../types/player';
import type { Relic } from '../types/relic';

/**
 * 2026-11 첫 여정의 첫 상자(docs/PRE_PLAYTEST_FEATURES_2026-11.md §2) — 계정의 첫 여정에서 처음 여는 보물상자는 미믹이 아니고,
 * 보통 상자 보상에 더해 유물 3장 중 하나를 고르게 한다. 여는 전이(`AT.FIELD_STEP`)가 계정 장부 `stats.firstChestRelic`을 남긴다 —
 * 사망 · 계승 · 다시 시작 뒤에 다시 받지 못한다(`pickPermanentPlayerState`가 넘긴다).
 */

const toCount = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));

/** 받을 수 있는가 — 사망 0 · 계승 0 · 받은 적 없음 · 유물을 얻은 적 없음(진행 중이던 세이브에는 열지 않는다). 오늘의 시련은 본편이 아니다. */
export const isFirstChestRelicOpen = (player: Pick<Player, 'stats' | 'meta' | 'relics' | 'trialRun'> | null | undefined): boolean => Boolean(
    player
    && !isTrialPlayer(player)
    && !player.stats?.firstChestRelic
    && toCount(player.stats?.deaths) === 0
    && toCount(player.meta?.prestigeRank) === 0
    && toCount(player.stats?.relicCount) === 0
    && (player.relics || []).length === 0,
);

/**
 * 후보 — 기존 제안 생성기(`pickWeightedRelics`)이고 난수는 지도 씨앗 · 상자 번호의 도메인 난수다(행동 난수를 쓰지 않는다).
 * 여정 시작 시각을 더한다: 첫 여정의 첫 지도 씨앗은 누구나 탐험 0 · 순번 1이라 같아서, 빼면 모든 새 플레이어가 같은 세 장을 본다
 * (장의 선물과 같은 이유 · 같은 재료). 시작 시각은 여정을 만들 때 한 번 찍히고 저장되므로 리로드로 다시 뽑히지 않는다.
 */
export const getFirstChestRelicOffer = (
    player: Pick<Player, 'stats' | 'relics'>,
    ref: { loc: string; seed: number; chestId: number },
): Relic[] => {
    const owned = player.relics || [];
    return pickWeightedRelics(
        RELICS.filter((relic) => !owned.some((entry) => entry.id === relic.id)),
        BALANCE.FIRST_CHEST_RELIC_CHOICES,
        {
            owned,
            rng: createDomainRandom(ref.seed, ref.loc, ref.chestId, 'first-chest-relic', toCount(player.stats?.currentRun?.startedAt)),
        },
    );
};
