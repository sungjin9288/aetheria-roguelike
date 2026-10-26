import { getTitleColor, getTitleLabel, getTitlePassiveLabel } from '../../../utils/gameUtils';
import { MSG } from '../../../data/messages';

interface SystemTitleButtonProps {
    id: string;
    active: boolean;
    onSelect: (id: string) => void;
}

/** 칭호 한 줄 — 누르면 적용 · 해제(aria-pressed가 적용 상태). */
export const SystemTitleButton = ({ id, active, onSelect }: SystemTitleButtonProps) => (
    <button
        type="button"
        data-testid={`system-title-${id}`}
        aria-pressed={active}
        onClick={() => onSelect(id)}
        className="ab-link-row min-h-12 flex-col !items-start !gap-1 px-2"
    >
        <span className="flex flex-wrap items-center gap-2">
            <span className={`font-readable aether-type-body font-bold ${getTitleColor(id)}`}>[{getTitleLabel(id)}]</span>
            {active && <span className="ae-chip ae-chip-gold">{MSG.SYSTEM_TITLE_ACTIVE}</span>}
        </span>
        <span className="block font-readable aether-type-meta leading-snug text-ae-ink-2">{getTitlePassiveLabel(id)}</span>
    </button>
);

interface SystemTitleListProps {
    ids: string[];
    activeTitle: string | null | undefined;
    onSelect: (id: string) => void;
}

export const SystemTitleList = ({ ids, activeTitle, onSelect }: SystemTitleListProps) => (
    <div className="ab-rows">
        {ids.map((id) => <SystemTitleButton key={id} id={id} active={activeTitle === id} onSelect={onSelect} />)}
    </div>
);
