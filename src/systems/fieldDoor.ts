import { BALANCE } from '../data/constants';
import { fieldDistances } from './fieldMapGen';
import { isAreaBossChallengeable, isBossGaugeFull } from '../utils/bossGauge';
import type { FieldMapLayout } from '../types/fieldMap';
import type { GameMap } from '../types/map';
import type { Player } from '../types/player';

/**
 * 2026-11 오버월드 3단계 — 보스 문(설계 §1-6 · §4, 소유자 결정 2026-11-16). 그 지역의 구역 보스에 도전할 수 있고
 * (`isAreaBossChallengeable`) 게이지가 찼을 때만 문이 보이고, 자리는 입구에서 걸어서 가장 먼 칸이다(입구 · 출구 · 상자 제외,
 * 같으면 낮은 칸 번호). 문을 밟으면 탐험의 도전 카드와 같은 카드가 열린다 — 지도 지역에서는 탐험이 카드를 띄우지 않는다.
 * 순수 함수이고 게임 난수를 쓰지 않는다(자리는 지도 모양에서, 보이는지는 저장된 상태에서 나온다).
 */

const doorIndexCache = new WeakMap<FieldMapLayout, number | null>();

/**
 * 그 칸을 막아도 입구에서 다른 모든 걸을 수 있는 칸에 닿는가 — 문이 길목이 되지 않게 한다. 상자 · 출구만 보던 첫 구현은
 * 문 너머에 막다른 풀숲이 남을 수 있었고, 게이지가 그 안에서 차면 문을 밟아야만 나올 수 있었다(측정 중 드라이버가 막혔다).
 */
const keepsEverythingReachable = (layout: FieldMapLayout, blocked: number): boolean => {
    const tiles = `${layout.tiles.slice(0, blocked)}#${layout.tiles.slice(blocked + 1)}`;
    const distance = fieldDistances(tiles, layout.width, layout.entrance);
    for (let index = 0; index < tiles.length; index += 1) {
        if (tiles[index] !== '#' && index !== layout.entrance && distance[index] <= 0) return false;
    }
    return true;
};

/**
 * 문 자리 — 지도 모양만 본다(보이든 말든 같은 자리). 입구에서 가장 먼 칸부터 보고, 그 칸을 막아도 다른 모든 칸에 닿는
 * 첫 칸이다(길목이 아닌 칸 — 같은 거리면 낮은 칸 번호). 걸을 수 있는 칸이 없으면 null.
 */
export const getFieldDoorIndex = (layout: FieldMapLayout): number | null => {
    if (doorIndexCache.has(layout)) return doorIndexCache.get(layout) ?? null;
    const distance = fieldDistances(layout.tiles, layout.width, layout.entrance);
    const reserved = new Set([layout.entrance, ...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
    const candidates: number[] = [];
    for (let index = 0; index < distance.length; index += 1) {
        if (distance[index] > 0 && !reserved.has(index)) candidates.push(index);
    }
    candidates.sort((a, b) => distance[b] - distance[a] || a - b);
    const best = candidates.find((index) => keepsEverythingReachable(layout, index)) ?? null;
    doorIndexCache.set(layout, best);
    return best;
};

/** 문이 열렸는가 — 도전할 수 있는 구역 보스가 있고 그 지역의 게이지가 찼다(회피 기록은 보지 않는다 — 문은 남는다). */
export const isFieldDoorOpen = (player: Player | null | undefined, loc: string, mapData: GameMap | null | undefined): boolean => (
    Boolean(player && mapData) && isAreaBossChallengeable(mapData, player)
    // 오늘의 시련: 마지막 지도에서는 문이 처음부터 열려 있다(게이지를 보지 않는다 — 도망친 뒤에도 문은 남는다).
    && (player?.trialRun ? player.trialRun.map >= BALANCE.DAILY_TRIAL_MAPS : isBossGaugeFull(player, loc))
);

/** 지금 보이는 문의 칸 — 닫혀 있으면 null */
export const getFieldDoor = (
    player: Player | null | undefined,
    loc: string,
    mapData: GameMap | null | undefined,
    layout: FieldMapLayout | null | undefined,
): number | null => (layout && isFieldDoorOpen(player, loc, mapData) ? getFieldDoorIndex(layout) : null);
