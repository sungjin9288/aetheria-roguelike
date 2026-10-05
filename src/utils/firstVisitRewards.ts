import { FIRST_VISIT_REWARDS, type FirstVisitReward } from '../data/firstVisitRewards.js';
import type { Player } from '../types/index.js';

/**
 * 첫 방문 보상은 여정마다 지역당 한 번이다 — 2026-10 Wave 62 (원장 §61.4 C11, 소유자 결정 "첫 방문은 여정마다").
 *
 * 보상 판정이 방문 기록(`stats.visitedMaps`)을 읽던 동안, 사망 재시작(`start`가 방문 기록을 시작 마을로 되돌린다)은 51곳을
 * 다시 다 주고 계승(방문 기록을 넘긴다)은 하나도 주지 않았다. 방문 기록의 뜻(발견 지역 수 · 업적 · 임무)은 그대로 두고,
 * 이번 여정에 받은 지역을 런 범위 필드 `player.firstVisitRewardMaps`가 따로 든다. 새 여정(새 게임 · 사망 재시작 · 계승)이
 * 빈 목록으로 연다.
 *
 * 예전 세이브에는 이 필드가 없다. 그때는 방문 기록을 "이번 여정에 받은 지역"으로 읽는다 — 방문 기록은 이번 여정에 받은
 * 지역을 모두 담고 있으므로(받을 때 함께 기록된다) 같은 여정에 두 번 주지 않는다. 계승 뒤의 예전 세이브는 그 여정이 끝날
 * 때까지 이전 여정에 방문한 지역의 보상을 받지 못한다(예전 동작 그대로) — 다음 여정부터 새 규칙이다.
 */

/** 이번 여정에 첫 방문 보상을 받은 지역. */
export const getFirstVisitClaimedMaps = (player: Pick<Player, 'firstVisitRewardMaps' | 'stats'> | null | undefined): string[] => (
    Array.isArray(player?.firstVisitRewardMaps)
        ? player.firstVisitRewardMaps
        : (Array.isArray(player?.stats?.visitedMaps) ? player.stats.visitedMaps : [])
);

/** 이 지역의 첫 방문 보상 — 이번 여정에 이미 받았거나 보상이 없는 지역이면 `null`. */
export const getJourneyFirstVisitReward = (
    loc: string,
    player: Pick<Player, 'firstVisitRewardMaps' | 'stats'> | null | undefined,
): FirstVisitReward | null => {
    if (getFirstVisitClaimedMaps(player).includes(loc)) return null;
    return FIRST_VISIT_REWARDS[loc] || null;
};

/** 이번 여정에 이 지역의 첫 방문 보상을 받았다고 기록한다(예전 세이브는 방문 기록에서 시작한다). */
export const markFirstVisitRewardClaimed = <T extends Pick<Player, 'firstVisitRewardMaps' | 'stats'>>(player: T, loc: string): T => {
    const claimed = getFirstVisitClaimedMaps(player);
    if (claimed.includes(loc)) return player;
    return { ...player, firstVisitRewardMaps: [...claimed, loc] };
};
