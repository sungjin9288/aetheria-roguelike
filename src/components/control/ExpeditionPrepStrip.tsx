import { Backpack, BookOpen, GraduationCap, Map as MapIcon, Moon, Route, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import type { getExpeditionPreparation } from '../../utils/adventureGuide';
import type { getTownActionPresentation } from '../../utils/townActionPresentation';

const townPrimaryIcons: Record<string, LucideIcon> = {
  claim_quest: ScrollText,
  explore: MapIcon,
  open_class: GraduationCap,
  open_inventory: Backpack,
  open_move: Route,
  open_quest_board: ScrollText,
  rest: Moon,
};

interface ExpeditionPrepStripProps {
  preparation: ReturnType<typeof getExpeditionPreparation>;
  primary: ReturnType<typeof getTownActionPresentation>['primary'];
  onPrimaryAction: () => void;
  onEditFocus: () => void;
  onOpenArchive?: () => void;
}

/**
 * 마을의 원정 준비 카드(2026-10 에테르 유리) — 마을 화면의 금빛 주 행동은 이 카드의 단추 하나다(`townActionPresentation`이 고른다).
 *   목적지 · 목표는 톤만 다른 우물 두 칸, 준비 상태는 칩, 기록 · 원정 임무 구성은 유리 단추다.
 */
const ExpeditionPrepStrip = ({ preparation, primary, onPrimaryAction, onEditFocus, onOpenArchive }: ExpeditionPrepStripProps) => {
  const PrimaryIcon = townPrimaryIcons[primary.kind] || Route;
  const checks = [
    { label: '목적지', value: preparation.destination },
    { label: '목표', value: preparation.goalLabel },
  ];

  return (
    <section
      data-testid="control-expedition-prep"
      data-expedition-readiness={preparation.readinessLabel}
      aria-label="원정 준비"
      className="aether-expedition-prep ae-card ae-prep-card px-3.5 py-3 font-readable"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="ae-eyebrow">원정 준비</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Chip tone={preparation.readinessLabel === '출발 가능' ? 'good' : 'neutral'}>
            {preparation.readinessLabel}
          </Chip>
          {onOpenArchive && (
            <button
              type="button"
              data-testid="mobile-console-open-archive"
              onClick={onOpenArchive}
              className="ae-btn ae-btn-ghost ae-prep-archive min-h-[44px]"
            >
              <span className="ae-btn-icon" aria-hidden="true"><BookOpen size={14} /></span>
              모험 기록
            </button>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div key={check.label} className="aether-expedition-check ae-well min-w-0 rounded-ae-sm px-2.5 py-2">
            <div className="ae-eyebrow">{check.label}</div>
            <div className="mt-0.5 break-words aether-type-body font-semibold text-ae-ink" title={check.value}>
              {check.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div data-testid="control-town-primary" data-town-primary-kind={primary.kind}>
          <ActionButton
            variant="primary"
            data-testid={primary.testId}
            disabled={primary.disabled}
            onClick={onPrimaryAction}
            icon={<PrimaryIcon size={16} />}
            label={primary.label}
            className="w-full"
          />
        </div>
        <ActionButton
          data-testid="control-edit-expedition-focus"
          title="원정 임무 구성"
          onClick={onEditFocus}
          icon={<ScrollText size={18} />}
          label={<span className="sr-only">원정 임무 구성</span>}
          className="ae-prep-focus"
        />
      </div>
    </section>
  );
};

export default ExpeditionPrepStrip;
