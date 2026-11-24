import { BALANCE } from '../data/constants';
import { deriveSeed } from '../utils/seededRandom';
import { generateFieldMap, toCoord, toIndex } from './fieldMapGen';
import { applyFieldTraitToLayout, getActiveFieldTraitEffects, readFieldTrait } from './fieldTrait';
import { isTrialPlayer } from '../utils/trialPlayer';
import type { FieldDirection, FieldMapLayout, FieldMapState } from '../types/fieldMap';
import type { GameMap } from '../types/map';
import type { Player } from '../types/player';

/**
 * 2026-11 지역 지도 걷기 판정(설계 §2 · §3 · §7). 순수 함수이고 게임 난수를 쓰지 않는다 — 걷기 · 위험 누적 · 자동 경로가
 * 난수를 쓰지 않으므로 조우 n번의 결과열은 지금 탐험 n번의 결과열과 같다. 걷기 전이는 리듀서 `AT.FIELD_STEP`이 소유한다.
 */

export type { FieldDirection };

export type FieldStepOutcome =
    | { kind: 'blocked' }
    | { kind: 'moved' }
    | { kind: 'chest'; chestId: number }
    | { kind: 'exit'; to: string }
    | { kind: 'door' }
    | { kind: 'encounter' };

export interface FieldStepResult {
    state: FieldMapState;
    outcome: FieldStepOutcome;
}

const DELTA: Record<FieldDirection, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
};

/**
 * 지도를 쓰는 지역 — 목록(`BALANCE.FIELD_MAP_REGIONS`, 3단계부터 사냥 지역 전부) 안의 사냥 지역(혼돈의 심연처럼 층이 있는
 * 지역은 대상 아님). 목록은 부를 때마다 읽는다 — 시험이 지도가 아닌 지역의 탐험 경로를 보려고 목록을 비울 수 있다.
 */
export const isFieldMapRegion = (loc: string | null | undefined, mapData: GameMap | null | undefined): boolean => (
    typeof loc === 'string'
    && (BALANCE.FIELD_MAP_REGIONS as readonly string[]).includes(loc)
    && Boolean(mapData)
    && mapData!.type !== 'safe'
    && mapData!.level !== 'infinite'
);

export const getFieldMapLayout = (state: Pick<FieldMapState, 'loc' | 'seed' | 'trait' | 'plan'>, mapData: GameMap): FieldMapLayout => (
    applyFieldTraitToLayout(
        generateFieldMap(state.loc, state.seed, state.plan?.level ?? mapData.level, state.plan?.exits ?? mapData.exits ?? []),
        readFieldTrait(state),
    )
);

const toCount = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));
const explores = (player: Pick<Player, 'stats'>) => toCount(player.stats?.explores);

/**
 * 지도 씨앗 — 평생 탐험 수 · 지역 · 순번에 여정(계정 장부의 사망 수 · 계승 단계)을 더한다(2026-11-24 소유자 결정
 * "사망하면 새 지도"). 순번은 사망 · 계승에서 1로 돌아가고 평생 탐험 수는 탐험 없이 상자로 걸어가 죽으면 그대로라,
 * 여정을 넣지 않던 동안 다음 여정이 같은 지도 · 같은 미믹 상자를 받았다(원장 §185.1 · §189). 둘 다 0인 첫 여정은
 * 이전 씨앗 그대로다 — 첫 여정의 지도 · 시험 고정값이 움직이지 않는다. 저장된 값만 읽으므로 다시 불러와도 같은 지도다.
 */
const getFieldMapSeed = (player: Pick<Player, 'stats' | 'meta'>, loc: string, seq: number): number => {
    const deaths = toCount(player.stats?.deaths);
    const rank = toCount(player.meta?.prestigeRank);
    return deaths === 0 && rank === 0
        ? deriveSeed(explores(player), loc, 'field-map', seq)
        : deriveSeed(explores(player), loc, 'field-map', seq, 'journey', deaths, rank);
};

/** 새 지도 — 방문마다 새로 만들고(순번), 위험은 이전 지도에서 이어진다(드나들며 위험을 지우지 못한다). */
export const createFieldMapState = (player: Pick<Player, 'stats' | 'meta' | 'fieldMap'>, loc: string, mapData: GameMap): FieldMapState => {
    const previous = player.fieldMap;
    const seq = toCount(previous?.seq) + 1;
    const seed = getFieldMapSeed(player, loc, seq);
    const layout = generateFieldMap(loc, seed, mapData.level, mapData.exits ?? []);
    return {
        loc,
        seq,
        seed,
        pos: layout.entrance,
        visited: [layout.entrance],
        openedChests: [],
        danger: Math.max(0, Number(previous?.danger) || 0),
        pending: null,
        autoRun: false,
    };
};

/**
 * 다른 지역에 들어설 때의 지도 상태 — 지도 지역이면 새 지도(방문마다 새로), 아니면 이전 지도를 처리할 일 없이 남긴다
 * (위험이 다음 지도로 이어진다 — 마을을 드나들며 위험을 지우지 못한다).
 */
export const getFieldMapOnArrival = (
    player: Pick<Player, 'stats' | 'meta' | 'fieldMap'>,
    loc: string,
    mapData: GameMap | null | undefined,
): FieldMapState | null | undefined => {
    if (mapData && isFieldMapRegion(loc, mapData)) return createFieldMapState(player, loc, mapData);
    return player.fieldMap ? { ...player.fieldMap, pending: null } : player.fieldMap;
};

/** 조우 문턱 — 탐험 수 · 지역의 해시라 조우마다 바뀌고, 다시 불러와도 같다. 고른 지도 성격(`fieldTrait.ts`)이 배율을 건다. */
export const getFieldEncounterThreshold = (
    player: Pick<Player, 'stats' | 'trialRun'> & Partial<Pick<Player, 'loc' | 'fieldMap'>>,
    loc: string,
): number => {
    // 오늘의 시련은 조우가 촘촘하다 — 세 장의 지도가 짧은 판 하나다.
    const [min, max] = isTrialPlayer(player)
        ? [BALANCE.DAILY_TRIAL_ENCOUNTER_MIN, BALANCE.DAILY_TRIAL_ENCOUNTER_MAX]
        : [BALANCE.FIELD_ENCOUNTER_MIN, BALANCE.FIELD_ENCOUNTER_MAX];
    const base = min + (deriveSeed(explores(player), loc, 'encounter') % (max - min + 1));
    return Math.max(1, Math.round(base * getActiveFieldTraitEffects({ loc, fieldMap: player.fieldMap }).encounterSteps));
};

export const getFieldTileDanger = (char: string): number => {
    if (char === ',') return BALANCE.FIELD_DANGER_GRASS;
    if (char === ';') return BALANCE.FIELD_DANGER_DEEP;
    return 0;
};

const insertSorted = (list: number[], value: number): number[] => {
    if (list.includes(value)) return list;
    return [...list, value].sort((a, b) => a - b);
};

export const getFieldNeighbor = (layout: FieldMapLayout, index: number, direction: FieldDirection): number | null => {
    const { x, y } = toCoord(layout.width, index);
    const [dx, dy] = DELTA[direction];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= layout.width || ny >= layout.height) return null;
    const next = toIndex(layout.width, nx, ny);
    return layout.tiles[next] === '#' ? null : next;
};

/**
 * 한 걸음. 처리할 일(`pending`)이 남아 있으면 걷지 않는다 — 연타해도 조우 · 출구가 둘로 갈라지지 않는다.
 * `door`는 지금 보이는 보스 문의 칸(3단계, `systems/fieldDoor.ts`) — 밟으면 위험을 더하지 않고 문을 처리할 일로 남긴다.
 */
export const resolveFieldStep = (
    field: FieldMapState,
    layout: FieldMapLayout,
    direction: FieldDirection,
    threshold: number,
    door: number | null = null,
): FieldStepResult => {
    const blocked = { state: field, outcome: { kind: 'blocked' as const } };
    if (field.pending) return blocked;
    const next = getFieldNeighbor(layout, field.pos, direction);
    if (next === null) return blocked;

    const wasVisited = field.visited.includes(next);
    const moved: FieldMapState = { ...field, pos: next, visited: insertSorted(field.visited, next) };

    const exit = layout.exits.find((entry) => entry.index === next);
    if (exit) return { state: { ...moved, pending: { kind: 'exit', to: exit.to } }, outcome: { kind: 'exit', to: exit.to } };
    if (door !== null && next === door) return { state: { ...moved, pending: { kind: 'door' } }, outcome: { kind: 'door' } };

    const chest = layout.chests.find((entry) => entry.index === next);
    if (chest && !field.openedChests.includes(chest.id)) {
        return {
            state: { ...moved, openedChests: insertSorted(field.openedChests, chest.id) },
            outcome: { kind: 'chest', chestId: chest.id },
        };
    }
    if (chest) return { state: moved, outcome: { kind: 'moved' } };

    const danger = field.danger + (wasVisited ? 0 : getFieldTileDanger(layout.tiles[next]));
    if (danger >= threshold) {
        return { state: { ...moved, danger: 0, pending: { kind: 'encounter' } }, outcome: { kind: 'encounter' } };
    }
    return { state: { ...moved, danger }, outcome: { kind: 'moved' } };
};

/** 구석 구슬의 단계 0 ~ 3 — 문턱 대비 45 · 60 · 75%(설계 §3) */
export const getFieldDangerSignal = (danger: number, threshold: number): number => {
    if (threshold <= 0) return 0;
    const ratio = danger / threshold;
    return BALANCE.FIELD_DANGER_SIGNAL_STEPS.filter((step) => ratio >= step).length;
};

/** 밝혀진 칸 — 밟은 칸 주변 `FIELD_MAP_FOG_RADIUS`칸(체비셰프 거리) */
export const getFieldRevealed = (layout: FieldMapLayout, visited: readonly number[]): Set<number> => {
    const radius = BALANCE.FIELD_MAP_FOG_RADIUS;
    const revealed = new Set<number>();
    for (const index of visited) {
        const { x, y } = toCoord(layout.width, index);
        for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < layout.width && ny < layout.height) revealed.add(toIndex(layout.width, nx, ny));
            }
        }
    }
    return revealed;
};

export const areAllFieldChestsOpened = (state: Pick<FieldMapState, 'openedChests'>, layout: FieldMapLayout): boolean => (
    layout.chests.every((chest) => state.openedChests.includes(chest.id))
);

export const FIELD_DIRECTIONS: readonly FieldDirection[] = ['up', 'right', 'down', 'left'];

/**
 * `blocked`를 지나지 않고 `isGoal` 칸까지 가장 짧은 길의 첫 걸음 — 지금 칸은 목표가 아니다. 없으면 null.
 * 방향 순서(`FIELD_DIRECTIONS`)가 같은 거리의 길을 가른다 — 자동 탐험 · 자동 걷기가 같은 이 함수를 쓴다.
 */
export const firstFieldStepToward = (
    layout: FieldMapLayout,
    start: number,
    blocked: ReadonlySet<number>,
    isGoal: (index: number) => boolean,
): FieldDirection | null => {
    const firstStep = new Map<number, FieldDirection>();
    const queue = [start];
    const seen = new Set([start]);
    for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head];
        if (current !== start && isGoal(current)) return firstStep.get(current) ?? null;
        for (const direction of FIELD_DIRECTIONS) {
            const next = getFieldNeighbor(layout, current, direction);
            if (next === null || seen.has(next) || blocked.has(next)) continue;
            seen.add(next);
            firstStep.set(next, current === start ? direction : firstStep.get(current)!);
            queue.push(next);
        }
    }
    return null;
};

/**
 * 자동 탐험의 다음 걸음(설계 §7) — 열지 않은 상자 중 가장 가까운 곳, 다 열었으면 입구로. 입구에 닿았고 상자가 없으면 null(끝).
 * 출구 칸은 지나가지 않는다(밟으면 지역을 떠난다). 보스 문(3단계)도 지나가지 않는다 — 도전은 플레이어가 고른다.
 */
export const planFieldAutoStep = (state: FieldMapState, layout: FieldMapLayout, door: number | null = null): FieldDirection | null => {
    const exits = new Set(layout.exits.map((exit) => exit.index));
    if (door !== null) exits.add(door);
    const targets = new Set(
        layout.chests.filter((chest) => !state.openedChests.includes(chest.id)).map((chest) => chest.index),
    );
    if (targets.size === 0) {
        if (state.pos === layout.entrance) return null;
        targets.add(layout.entrance);
    }
    return firstFieldStepToward(layout, state.pos, exits, (index) => targets.has(index));
};
