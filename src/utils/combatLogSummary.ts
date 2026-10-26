/**
 * 전투 기록 요약 — 최근 한 차례(내 행동 → 적 행동 → 부가 효과)를 통째로 고른다.
 *
 * 한 차례는 리듀서의 한 전이가 남긴 줄 묶음이다. `combatHandlers`가 그 줄에
 * `combat-item-${now}-${seed}-${i}`(턴 해석) · `combat-${now}-${seed}-${i}`(승리 정산) id를 붙이므로
 * `${now}-${seed}`가 같은 줄이 한 차례다. 마지막 3줄만 보이던 동안 차례의 44 ~ 57%가 4줄 이상이라
 * 맨 앞의 '내 행동'이 요약에서 밀려났다.
 *
 * 화면 표시만 고른다 — 기록 줄을 더하거나 바꾸지 않는다(기록 id 난수열 · 자연 플레이 드라이버 불변).
 */

export interface CombatLogLine {
    readonly id: string;
    readonly type: string;
    readonly text: string;
}

const COMBAT_TURN_ID_RE = /^combat(?:-item)?-(\d+)-(\d+)-\d+$/;

/** 같은 차례면 같은 값. 차례 줄이 아니면 null. */
export function getCombatTurnKey(id: string): string | null {
    const match = COMBAT_TURN_ID_RE.exec(String(id ?? ''));
    return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * 이번 전투의 차례를 찾기 시작할 경계(이 id 뒤의 줄만 이번 전투).
 * 기록 창이 전투 도중에 새로 그려지면(이벤트 → 전투) 그때까지의 줄은 전투 전 줄이다 —
 * 단 기록이 차례 묶음으로 끝나면 그 묶음은 지금 전투의 마지막 차례로 본다.
 */
export function getInitialCombatFloorId(logs: readonly CombatLogLine[]): string | null {
    if (logs.length === 0) return null;
    const lastKey = getCombatTurnKey(logs[logs.length - 1].id);
    if (!lastKey) return logs[logs.length - 1].id;
    let start = logs.length - 1;
    while (start > 0 && getCombatTurnKey(logs[start - 1].id) === lastKey) start -= 1;
    return start > 0 ? logs[start - 1].id : null;
}

export interface CombatLogSummaryOptions {
    /** 요약 칸에 보일 기록 종류. 차례 묶음의 줄은 종류와 상관없이 모두 보인다. */
    readonly types: ReadonlySet<string>;
    /** 아직 차례가 없을 때 보일 최근 줄 수. */
    readonly fallbackCount: number;
    /** 이 id 뒤에서만 차례를 찾는다(없으면 기록 전체). */
    readonly floorId?: string | null;
    /** 요약에서 뺄 지역 분위기 문장(지역 설명 · 처음 방문 이야기) — 전체 보기에는 그대로 남는다. */
    readonly ambientTexts?: ReadonlySet<string>;
}

export interface CombatLogSummary<T extends CombatLogLine> {
    readonly entries: T[];
    /** 고른 차례. 차례가 없어 최근 줄로 채웠으면 null. */
    readonly turnKey: string | null;
}

function findLatestTurnStart(logs: readonly CombatLogLine[], from: number): { start: number; key: string } | null {
    for (let index = logs.length - 1; index >= from; index -= 1) {
        const key = getCombatTurnKey(logs[index].id);
        if (!key) continue;
        let start = index;
        while (start > from && getCombatTurnKey(logs[start - 1].id) === key) start -= 1;
        return { start, key };
    }
    return null;
}

function findFloorIndex(logs: readonly CombatLogLine[], floorId: string | null | undefined): number {
    return floorId ? logs.findIndex((log) => log.id === floorId) : -1;
}

/** 경계 뒤의 마지막 차례 묶음만(뒤에 붙은 다른 줄 없이) — 화면 낭독기 알림 칸이 읽는다. */
export function selectLatestCombatTurn<T extends CombatLogLine>(
    logs: readonly T[],
    floorId?: string | null,
): CombatLogSummary<T> {
    const turn = findLatestTurnStart(logs, findFloorIndex(logs, floorId) + 1);
    if (!turn) return { entries: [], turnKey: null };
    return {
        entries: logs.slice(turn.start).filter((log) => getCombatTurnKey(log.id) === turn.key),
        turnKey: turn.key,
    };
}

export function selectCombatLogSummary<T extends CombatLogLine>(
    logs: readonly T[],
    options: CombatLogSummaryOptions,
): CombatLogSummary<T> {
    const isSummaryLine = (log: T) => options.types.has(log.type) && !options.ambientTexts?.has(log.text);
    const turn = findLatestTurnStart(logs, findFloorIndex(logs, options.floorId) + 1);
    if (!turn) {
        return { entries: logs.filter(isSummaryLine).slice(-Math.max(0, options.fallbackCount)), turnKey: null };
    }
    const entries = logs
        .slice(turn.start)
        .filter((log) => getCombatTurnKey(log.id) === turn.key || isSummaryLine(log));
    return { entries, turnKey: turn.key };
}

/** 지역 분위기 문장 — 이동 기록이 남기는 지역 설명과 처음 방문 이야기. */
export function getAmbientLogTexts(
    map: { readonly desc?: string; readonly lore?: string } | null | undefined,
    extra: readonly string[] = [],
): ReadonlySet<string> {
    const texts = [map?.desc, map?.lore, ...extra].filter((text): text is string => Boolean(text));
    return new Set(texts);
}
