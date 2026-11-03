import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, History, Landmark } from 'lucide-react';
import { MSG } from '../../data/messages';
import { getPreferredScrollBehavior } from '../../utils/scrollBehavior';

interface LastExpeditionLine {
  destination: string;
  battles: number;
  explores: number;
  expGained: number;
}

interface TownActionsProps {
  lastExpedition: LastExpeditionLine | null;
  onOpenDebrief: () => void;
  quickButtons: ReactNode;
  quickCount: number;
  facilityButtons: ReactNode;
  facilityCount: number;
  facilitySummary: string;
}

// 2026-10 통합 감사(UX-01): 접힌 마을 시설을 열면 단추가 화면 아래(작은 폰에서는 전부)에 그려져
//   "눌러도 아무 일이 없는" 것처럼 보였다. 열릴 때 펼친 시설 묶음을 화면 안으로 끌어온다(닫을 때는 그대로).
const revealTownFacilities = (details: HTMLDetailsElement) => {
  if (!details.open) return;
  details.scrollIntoView({ block: 'nearest', behavior: getPreferredScrollBehavior() });
};

const quickGridClass = (count: number) => {
  if (count >= 3) return 'grid grid-cols-3 gap-2';
  if (count === 2) return 'grid grid-cols-2 gap-2';
  return 'grid grid-cols-1 gap-2';
};

/**
 * 마을 조작판의 아래쪽(2026-10 에테르 유리) — 지난 원정 한 줄, 빠른 행동(유리), 접히는 마을 시설(유리 격자).
 *   단추 자체는 조작판의 `renderActionButton`이 그린다 — 이 컴포넌트는 배치만 소유한다.
 */
const TownActions = ({
  lastExpedition,
  onOpenDebrief,
  quickButtons,
  quickCount,
  facilityButtons,
  facilityCount,
  facilitySummary,
}: TownActionsProps) => (
  <>
    {lastExpedition && (
      <button
        type="button"
        data-testid="control-last-expedition"
        onClick={onOpenDebrief}
        className="ae-town-row flex min-h-[48px] w-full items-center gap-2.5 px-3 py-2 text-left font-readable"
      >
        <History size={16} aria-hidden="true" className="shrink-0 text-ae-gold" />
        <div className="min-w-0 flex-1">
          <div className="aether-type-body font-semibold text-ae-ink">
            지난 원정 · {lastExpedition.destination}
          </div>
          <div className="mt-0.5 font-fira aether-type-meta tabular-nums text-ae-ink-2">
            {MSG.LAST_EXPEDITION_SUMMARY_LINE(lastExpedition.battles, lastExpedition.explores, lastExpedition.expGained)}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 aether-type-body font-semibold text-ae-ether-hi">
          보기
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </button>
    )}
    <div data-testid="control-town-quick-actions" className={`ae-town-quick ${quickGridClass(quickCount)}`}>
      {quickButtons}
    </div>
    {facilityCount > 0 && (
      <details
        data-testid="control-town-facilities"
        onToggle={(event) => revealTownFacilities(event.currentTarget)}
        className="ae-town-facilities group"
      >
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-left font-readable [&::-webkit-details-marker]:hidden">
          <Landmark size={16} aria-hidden="true" className="shrink-0 text-ae-gold" />
          <span className="shrink-0 aether-type-title font-semibold text-ae-ink">{MSG.TOWN_FACILITIES_TITLE}</span>
          <span className="min-w-0 flex-1 text-right aether-type-meta text-ae-ink-2">
            {facilitySummary}
          </span>
          <ChevronDown size={16} aria-hidden="true" className="ae-town-facilities-chevron shrink-0 text-ae-ink-3" />
        </summary>
        <div data-testid="control-town-facility-actions" className="ae-town-facility-grid grid grid-cols-3 gap-2 p-2 pt-0">
          {facilityButtons}
        </div>
      </details>
    )}
  </>
);

export default TownActions;
