import { getFieldNeighbor, getFieldTileDanger } from './fieldMapWalk';
import type { FieldDirection, FieldMapLayout, FieldMapState } from '../types/fieldMap';

/**
 * 2026-11 오버월드 3단계 — 자동 걷기의 다음 걸음(소유자 결정 2026-11-16 "(가) 자동 걷기, 상자 앞에서 멈춤").
 * 순수 함수이고 게임 난수를 쓰지 않는다 — 같은 지도 상태면 같은 걸음이다. 조우를 만들려고 아직 밟지 않은 풀숲 · 깊은 곳을
 * 가까운 순서로 밟는다. 상자는 열지 않는다(미믹은 플레이어가 판단한다 — Wave 88): 열지 않은 상자 칸은 밟지 않고, 그 옆에
 * 닿으면 멈춘다(한 상자에 한 번 — 멈춘 상자는 `acknowledgedChests`로 넘겨받아 다시 멈추지 않는다). 위험한 칸을 다 밟았으면
 * 보스 문(없으면 들어갈 수 있는 출구) 옆까지 걸어가 멈춘다 — 지역을 스스로 떠나거나 보스에 스스로 도전하지 않는다.
 *
 * 끝남: 걸음마다 (밟지 않은 위험한 칸 수, 가장 가까운 그 칸까지의 거리)가 사전순으로 줄고, 그 뒤에는 목표 옆까지의 거리가
 * 준다 — 진동하지 않는다(계약이 지도 전수로 잡는다).
 */

export type FieldAutoWalkStopReason = 'chest' | 'door' | 'exit' | 'stuck';

export type FieldAutoWalkPlan =
    | { kind: 'step'; direction: FieldDirection }
    | { kind: 'stop'; reason: FieldAutoWalkStopReason; chestId?: number };

export interface FieldAutoWalkOptions {
    /** 지금 보이는 보스 문의 칸(`getFieldDoor`) — 없으면 null */
    door: number | null;
    /** 멈출 목표가 될 수 있는 출구 칸(들어갈 수 있는 출구) — 없으면 문이 없을 때 '막힘'으로 멈춘다 */
    exits: readonly number[];
    /** 이미 한 번 멈춘 상자 — 그 옆에서는 다시 멈추지 않는다 */
    acknowledgedChests?: readonly number[];
}

const DIRECTIONS: FieldDirection[] = ['up', 'right', 'down', 'left'];

const stop = (reason: FieldAutoWalkStopReason, chestId?: number): FieldAutoWalkPlan => (
    chestId === undefined ? { kind: 'stop', reason } : { kind: 'stop', reason, chestId }
);

/** `blocked`를 지나지 않고 `isGoal` 칸까지 가장 짧은 길의 첫 걸음 — 지금 칸은 목표가 아니다. 없으면 null. */
const firstStepToward = (
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
        for (const direction of DIRECTIONS) {
            const next = getFieldNeighbor(layout, current, direction);
            if (next === null || seen.has(next) || blocked.has(next)) continue;
            seen.add(next);
            firstStep.set(next, current === start ? direction : firstStep.get(current)!);
            queue.push(next);
        }
    }
    return null;
};

const neighborsOf = (layout: FieldMapLayout, index: number): number[] => DIRECTIONS
    .map((direction) => getFieldNeighbor(layout, index, direction))
    .filter((next): next is number => next !== null);

export const planFieldAutoWalk = (field: FieldMapState, layout: FieldMapLayout, options: FieldAutoWalkOptions): FieldAutoWalkPlan => {
    const acknowledged = new Set(options.acknowledgedChests ?? []);
    const unopened = layout.chests.filter((chest) => !field.openedChests.includes(chest.id));
    const around = new Set(neighborsOf(layout, field.pos));
    const nearChest = unopened.find((chest) => around.has(chest.index) && !acknowledged.has(chest.id));
    if (nearChest) return stop('chest', nearChest.id);

    const exitIndexes = layout.exits.map((exit) => exit.index);
    const blocked = new Set<number>([...exitIndexes, ...unopened.map((chest) => chest.index)]);
    if (options.door !== null) blocked.add(options.door);

    const visited = new Set(field.visited);
    const toDanger = firstStepToward(layout, field.pos, blocked, (index) => (
        !visited.has(index) && getFieldTileDanger(layout.tiles[index]) > 0
    ));
    if (toDanger) return { kind: 'step', direction: toDanger };

    const goals = options.door !== null ? [options.door] : [...options.exits];
    const reason: FieldAutoWalkStopReason = options.door !== null ? 'door' : 'exit';
    if (goals.length === 0) return stop('stuck');
    if (goals.some((goal) => around.has(goal))) return stop(reason);
    const beside = new Set(goals.flatMap((goal) => neighborsOf(layout, goal)).filter((index) => !blocked.has(index)));
    const toGoal = firstStepToward(layout, field.pos, blocked, (index) => beside.has(index));
    return toGoal ? { kind: 'step', direction: toGoal } : stop('stuck');
};
