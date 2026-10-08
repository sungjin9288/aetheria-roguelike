import { MSG } from '../../data/messages';
import { getHuntContractRows } from '../../utils/huntContracts';
import type { Player } from '../../types';

/**
 * 2026-10 Wave 80: 지역 토벌 의뢰 — 회차마다 다시 하는 3단계 의뢰(처치 · 정예 · 우두머리). 판정 · 문구는
 * `utils/huntContracts.ts`의 뷰모델이 소유하고 여기서는 그리기만 한다.
 */
const HuntContractCard = ({ player }: { player: Player }) => {
    const rows = getHuntContractRows(player);
    if (rows.length === 0) return null;
    return (
        <div data-testid="hunt-contract-card" className="mb-3 p-3 rounded-[1rem] border border-[#d5b180]/20 bg-[#d5b180]/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2">
                <span className="text-[#f6e7c8] text-xs font-readable">{MSG.HUNT_CONTRACT_PANEL_TITLE}</span>
                <span className="text-xs text-slate-400">{MSG.HUNT_CONTRACT_PANEL_HINT}</span>
            </div>
            <div className="flex flex-col gap-1.5">
                {rows.map((row) => {
                    const stageShare = row.done ? 1 : (row.stage + Math.min(1, row.progress / Math.max(1, row.goal))) / 3;
                    return (
                        <div
                            key={row.map}
                            data-testid={`hunt-contract-${row.map}`}
                            className={`rounded-[0.95rem] border px-3 py-2 ${row.done ? 'border-emerald-300/24 bg-emerald-300/[0.06]' : 'border-white/8 bg-black/18'}`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mb-1">
                                <span className={`shrink-0 text-sm ${row.done ? 'text-emerald-100' : 'text-slate-200/84'}`}>{row.map}</span>
                                <span className={`text-xs ${row.done ? 'text-emerald-100 font-bold' : row.reachable ? 'text-[#f6e7c8]' : 'text-slate-500'}`}>
                                    {row.status}
                                </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-black/30">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${row.done ? 'bg-emerald-300' : 'bg-[#d5b180]/70'}`}
                                    style={{ width: `${Math.round(stageShare * 100)}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HuntContractCard;
