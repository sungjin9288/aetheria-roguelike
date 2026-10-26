import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { SEASON_XP } from '../../data/seasonPass';
import { hasDedicatedSignatureArt } from '../../data/signatureItems';
import { countNewCodexEntries, registerLootToCodex } from '../../utils/gameUtils';
import { addSeasonXp } from './helpers';
import { AT } from '../actionTypes';
import type { GameAction } from '../actionTypes';
import type { GameState, LegendaryAcquisition } from '../gameReducer';
import type { Item, Player } from '../../types';

/**
 * 전설 각인 획득 전이 — 2026-10-26 소유자 결정 D33.
 *
 * 전설 각인을 얻으면 도감 등록 · 시즌 경험(도감 발견) · 전용 기록 줄이 남는다. 예전에는 표시 훅
 * (`useLegendaryDropDetector`)이 가방을 관찰하다 dispatch로 남겼다 — 그래서 원장이 화면에 묶여 있었다:
 * 화면 없이 리듀서 · 액션 팩토리만 도는 자연 플레이 드라이버에서는 임무 · 체인 보상으로 얻은 각인이 도감 ·
 * 시즌에 오르지 않았고, 관찰 기준이 세션 메모리라 장착했다 벗은 각인이 다시 '획득'되기도 했다.
 * 이제 리듀서의 모든 전이 뒤에 이 함수가 한 번 정산하고, 표시 훅은 `legendaryAcquisitions`만 읽는다.
 *
 * 규칙:
 *   - 획득 = 이 전이 전에 가방 · 장비 어디에도 없던 이름의 전설 각인이 가방에 들어왔다(이름당 한 번).
 *     장착 · 해제(가방 ↔ 장비)와 같은 각인의 둘째 사본은 획득이 아니다.
 *   - 복원(`LOAD_DATA`)은 획득이 아니다 — 불러온 가방은 기준일 뿐이다(GF-13과 같은 규칙).
 *   - 도감은 `registerLootToCodex`(바탕 이름)로 등록하고, 시즌 경험은 **이 정산이 새로 등록한 칸 수**만큼이다 —
 *     같은 전이가 이미 도감에 올린 각인(전투 승리 정산)은 다시 세지 않는다(이중 적립 금지).
 *   - 난수를 쓰지 않는다 — 기록 줄 id는 획득 순번이다(드라이버의 난수열 · 시드 고정값을 밀지 않는다).
 */

/** 표시 대기열이 읽는 최근 획득 수 — 화면이 한 번에 쌓아 둘 수 있는 양이지 게임 수치가 아니다. */
export const LEGENDARY_ACQUISITION_HISTORY_LIMIT = 16;

const isSignatureEntry = (item: Item | null | undefined): item is Item =>
    Boolean(item?.name) && hasDedicatedSignatureArt(item);

const getOwnedSignatureNames = (player: Player): Set<string> => {
    const names = new Set<string>();
    for (const item of player.inv || []) {
        if (isSignatureEntry(item)) names.add(item.name as string);
    }
    const equip = player.equip;
    for (const item of [equip?.weapon, equip?.armor, equip?.offhand]) {
        if (isSignatureEntry(item)) names.add(item.name as string);
    }
    return names;
};

/** 이 전이로 새로 들어온 전설 각인 — 이름당 하나, 가방 순서. */
export const findArrivedSignatures = (before: Player, after: Player): Item[] => {
    if (before.inv === after.inv) return [];
    const owned = getOwnedSignatureNames(before);
    const arrived: Item[] = [];
    for (const item of after.inv || []) {
        if (!isSignatureEntry(item) || owned.has(item.name as string)) continue;
        owned.add(item.name as string);
        arrived.push(item);
    }
    return arrived;
};

export const settleSignatureAcquisitions = (
    previous: GameState,
    next: GameState,
    action: GameAction,
): GameState => {
    if (action.type === AT.LOAD_DATA) return next;
    if (previous.player === next.player) return next;
    const arrived = findArrivedSignatures(previous.player, next.player);
    if (arrived.length === 0) return next;

    const registered = registerLootToCodex(next.player, arrived);
    const newCodexEntries = countNewCodexEntries(registered) - countNewCodexEntries(next.player);
    const player = addSeasonXp(registered, SEASON_XP.codexDiscover * newCodexEntries);

    const history = next.legendaryAcquisitions || [];
    const lastSeq = history.at(-1)?.seq ?? 0;
    const acquisitions: LegendaryAcquisition[] = arrived.map((item, index) => ({ seq: lastSeq + index + 1, item }));
    const logs = acquisitions.map(({ seq, item }) => ({
        id: `legendary-acquired:${seq}`,
        type: 'legendary',
        text: MSG.SIGNATURE_DISCOVERED(item.name as string),
    }));

    return {
        ...next,
        player,
        logs: [...next.logs, ...logs].slice(-BALANCE.LOG_MAX_SIZE),
        legendaryAcquisitions: [...history, ...acquisitions].slice(-LEGENDARY_ACQUISITION_HISTORY_LIMIT),
        syncStatus: 'syncing',
    };
};
