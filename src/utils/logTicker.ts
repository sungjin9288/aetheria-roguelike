// 2026-11 화면 B안: 한 줄 소식이 보이는 "방금 일어난 일" — 마지막 묶음의 줄(최대 몇 줄)이다.
//   한 행동의 줄은 한 묶음으로 들어온다(전투 한 차례 = 내 행동 · 적 행동 · 부가 효과, 임무 수령 = 완료 · 단서 · 장의 본문).
//   마지막 한 줄만 보이던 동안 전투에서는 내 행동이, 수령에서는 다음 걸음 단서가 화면에서 사라졌다.
//   표시만이다 — 기록 줄 · 줄 수는 그대로이고, 전체 기록은 '지난 소식' 시트에 있다.
import type { CombatLogLine } from './combatLogSummary';

export interface TickerLineOptions<T extends CombatLogLine> {
    /** 마지막 묶음의 첫 줄 id — 없거나 기록에서 사라졌으면 마지막 줄 하나만 보인다. */
    batchFirstId: string | null;
    /**
     * 싸우는 중이면 이번 전투의 마지막 차례 줄(`selectLatestCombatTurn`) — 비어 있으면 묶음 규칙을 쓴다.
     *   차례는 앞에서부터 남긴다: 차례의 44 ~ 57%가 4줄 이상이고 첫 줄이 '내 행동'이다(`combatLogSummary`).
     */
    combatTurn?: readonly T[] | null;
    /** 보이는 줄의 최대 수 — 묶음이 넘치면 마지막 줄들(이야기 · 단서가 묶음 끝에 온다)을 남긴다. */
    maxLines: number;
}

const isVisibleLine = (line: CombatLogLine): boolean => line.type !== 'loading';

export function selectTickerLines<T extends CombatLogLine>(
    logs: readonly T[],
    { batchFirstId, combatTurn = null, maxLines }: TickerLineOptions<T>,
): T[] {
    const limit = Math.max(1, Math.floor(maxLines));
    const turn = combatTurn ? combatTurn.filter(isVisibleLine) : [];
    if (turn.length > 0) return turn.slice(0, limit);
    const visible = logs.filter(isVisibleLine);
    if (visible.length === 0) return [];
    const startIndex = batchFirstId === null ? -1 : visible.findIndex((line) => line.id === batchFirstId);
    const batch = startIndex >= 0 ? visible.slice(startIndex) : visible.slice(-1);
    return batch.slice(-limit);
}
