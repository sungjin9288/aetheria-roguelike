import { MSG } from '../data/messages.js';
import type { AscensionGrowthRow } from '../utils/ascensionPreview';

interface AscensionGrowthTableProps {
    rows: readonly AscensionGrowthRow[];
}

const COLUMNS = MSG.ASCEND_GROWTH_COLUMNS;

/** 영구 능력치(공격력 · 생명 · 기력)는 보너스라 "+N", 계승 정수는 가진 양이라 숫자만 그린다. */
const formatValue = (row: AscensionGrowthRow, value: number) => (row.stat === 'essence' ? `${value}` : `+${value}`);

/**
 * 계승 화면의 영구 능력치 정산표 — 지금 · 내려놓는 몫 · 계승 보상 · 다음 여정을 능력치마다 나눠 그린다.
 * 지금 → 다음 여정 두 값만 보이던 동안 넘어가지 않는 정수 사다리 때문에 크게 줄어든 값이 '영구 성장' 제목 아래에 늘어난 것처럼 보였다.
 */
const AscensionGrowthTable = ({ rows }: AscensionGrowthTableProps) => (
    <table data-testid="ascension-growth-table" className="ae-well mt-2 w-full table-fixed border-separate border-spacing-0 overflow-hidden aether-type-label font-readable">
        <thead>
            <tr className="text-ae-ink-3">
                <th scope="col" className="w-[4.75rem] py-1.5 pl-2.5 pr-1 text-left font-normal">{COLUMNS.stat}</th>
                <th scope="col" className="px-1 py-1.5 text-right font-normal">{COLUMNS.before}</th>
                <th scope="col" className="px-1 py-1.5 text-right font-normal">{COLUMNS.dropped}</th>
                <th scope="col" className="px-1 py-1.5 text-right font-normal">{COLUMNS.reward}</th>
                <th scope="col" className="py-1.5 pl-1 pr-2.5 text-right font-semibold text-ae-ink">{COLUMNS.after}</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.stat} data-testid={`ascension-growth-${row.stat}`} className="ae-growth-row">
                    <th scope="row" className="py-2 pl-2.5 pr-1 text-left font-normal text-ae-ink-2">{MSG.ASCEND_GROWTH_STAT_LABELS[row.stat]}</th>
                    <td data-growth-cell="before" className="px-1 py-2 text-right font-fira tabular-nums text-ae-ink-2">{formatValue(row, row.before)}</td>
                    <td data-growth-cell="dropped" className={`px-1 py-2 text-right font-fira tabular-nums ${row.dropped > 0 ? 'text-ae-threat' : 'text-ae-ink-3'}`}>
                        {row.dropped > 0 ? `−${row.dropped}` : '—'}
                    </td>
                    <td data-growth-cell="reward" className="px-1 py-2 text-right font-fira tabular-nums text-ae-good">+{row.reward}</td>
                    <td data-growth-cell="after" className="aether-type-body py-2 pl-1 pr-2.5 text-right font-fira font-bold tabular-nums text-ae-ink">{formatValue(row, row.after)}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

export default AscensionGrowthTable;
