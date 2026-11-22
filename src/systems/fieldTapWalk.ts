import { firstFieldStepToward, getFieldNeighbor, getFieldRevealed } from './fieldMapWalk';
import type { FieldDirection, FieldMapLayout, FieldMapState } from '../types/fieldMap';

/**
 * 칸 눌러 걷기(2026-11 화면 B안)의 다음 한 걸음. 순수 함수이고 게임 난수를 쓰지 않는다 — 걸음 자체는 손으로 누른 한 걸음과
 * 같은 `FIELD_STEP`이다(판정은 리듀서).
 *
 * - 길은 밝혀진 칸만 지난다(안개 너머의 모양을 새지 않는다). 목표 칸은 안개여도 된다.
 * - 출구 · 보스 문 · 열지 않은 상자는 목표일 때만 밟는다. 상자를 열지 않는 것은 자동 걷기와 같은 판단이다
 *   (`planFieldAutoWalk` — 미믹은 플레이어가 판단한다, Wave 88). 상자를 돌아가는 길이 없으면 상자 바로 앞까지 걷고 멈춘다.
 * - `arrives`는 이 걸음이 목표 칸을 밟는지다 — 화면은 그 걸음을 보낸 뒤 목표를 지운다(들어갈 수 없는 출구에서 리듀서가 걸음을
 *   거부해도 목표가 남아 다시 끌려가지 않는다).
 */

export interface FieldTapStep {
    direction: FieldDirection;
    arrives: boolean;
}

export const planFieldTapStep = (
    field: Pick<FieldMapState, 'pos' | 'visited' | 'openedChests'>,
    layout: FieldMapLayout,
    target: number,
    door: number | null,
): FieldTapStep | null => {
    if (target === field.pos) return null;
    const revealed = getFieldRevealed(layout, field.visited);
    const blocked = new Set<number>();
    for (let index = 0; index < layout.tiles.length; index += 1) {
        if (!revealed.has(index) && index !== target) blocked.add(index);
    }
    for (const exit of layout.exits) if (exit.index !== target) blocked.add(exit.index);
    if (door !== null && door !== target) blocked.add(door);
    const chests = new Set(
        layout.chests
            .filter((chest) => chest.index !== target && !field.openedChests.includes(chest.id))
            .map((chest) => chest.index),
    );
    const isGoal = (index: number) => index === target;
    const around = firstFieldStepToward(layout, field.pos, new Set([...blocked, ...chests]), isGoal);
    const direction = around ?? firstFieldStepToward(layout, field.pos, blocked, isGoal);
    if (!direction) return null;
    const next = getFieldNeighbor(layout, field.pos, direction);
    if (next === null || chests.has(next)) return null;
    return { direction, arrives: next === target };
};

/**
 * 방향 패드를 누르고 있을 때의 반복 걸음이 이 방향으로 이어져도 되는가 — 다음 칸이 열지 않은 상자면 멈춘다(칸 눌러 걷기 · 자동 걷기와
 * 같은 판단: 상자는 플레이어가 한 번 더 눌러 연다). 벽이면 어차피 걷지 못하니 참이다(리듀서가 거부한다). 처음 누른 한 걸음은 이 판정을
 * 거치지 않는다 — 상자 쪽을 누르면 연다.
 */
export const canRepeatFieldStep = (
    field: Pick<FieldMapState, 'pos' | 'openedChests'>,
    layout: FieldMapLayout,
    direction: FieldDirection,
): boolean => {
    const next = getFieldNeighbor(layout, field.pos, direction);
    if (next === null) return true;
    return !layout.chests.some((chest) => chest.index === next && !field.openedChests.includes(chest.id));
};
