import { MSG } from '../../data/messages';
import { getHuntContractRows } from '../../utils/huntContracts';
import type { Player } from '../../types';
import Gauge from '../ui/Gauge';

/**
 * 2026-10 Wave 80: 지역 토벌 의뢰 — 회차마다 다시 하는 3단계 의뢰(처치 · 정예 · 우두머리). 판정 · 문구는
 * `utils/huntContracts.ts`의 뷰모델이 소유하고 여기서는 그리기만 한다.
 */
const HuntContractCard = ({ player }: { player: Player }) => {
    const rows = getHuntContractRows(player);
    if (rows.length === 0) return null;
    return (
        <section data-testid="hunt-contract-card" className="ae-card is-quiet ab-card-pad font-readable">
            <header>
                <h3 className="aether-type-strong text-ae-gold-text">{MSG.HUNT_CONTRACT_PANEL_TITLE}</h3>
                <p className="mt-0.5 aether-type-meta text-ae-ink-3">{MSG.HUNT_CONTRACT_PANEL_HINT}</p>
            </header>
            <div className="ab-rows mt-2">
                {rows.map((row) => {
                    const stageShare = row.done ? 1 : (row.stage + Math.min(1, row.progress / Math.max(1, row.goal))) / 3;
                    return (
                        <div key={row.map} data-testid={`hunt-contract-${row.map}`} className="py-2.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className={`shrink-0 aether-type-body font-bold ${row.done ? 'text-ae-good' : 'text-ae-ink'}`}>{row.map}</span>
                                <span className={`aether-type-meta ${row.done ? 'font-bold text-ae-good' : row.reachable ? 'text-ae-gold-text' : 'text-ae-ink-3'}`}>
                                    {row.status}
                                </span>
                            </div>
                            <Gauge
                                kind="ether"
                                value={Math.round(stageShare * 100)}
                                max={100}
                                label={row.map}
                                className={`ab-gauge-thin mt-2 ${row.done ? 'ab-gauge-good' : 'ab-gauge-gold'}`}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default HuntContractCard;
