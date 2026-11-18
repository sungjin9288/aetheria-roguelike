import { Backpack, BookOpen, GraduationCap, ListChecks, Map as MapIcon, MapPin, Moon, Route, ScrollText, Target } from 'lucide-react';
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
  /** 오늘의 임무 한 줄(2026-11 고도화 E2) — 누를 수 없는 정보다. */
  dailyLine: string;
  dailyComplete: boolean;
}

/**
 * 마을의 원정 준비 카드(2026-10 에테르 유리) — 마을 화면의 금빛 주 행동은 이 카드의 단추 하나다(`townActionPresentation`이 고른다).
 *   목적지 · 목표는 톤만 다른 우물 두 칸, 준비 상태는 칩, 기록 · 원정 임무 구성은 유리 단추다.
 */
const ExpeditionPrepStrip = ({
  preparation,
  primary,
  onPrimaryAction,
  onEditFocus,
  onOpenArchive,
  dailyLine,
  dailyComplete,
}: ExpeditionPrepStripProps) => {
  const PrimaryIcon = townPrimaryIcons[primary.kind] || Route;
  // 2026-11 마을 무대: 칸 이름(목적지 · 목표)은 글이 아니라 아이콘이다 — 소유자 2026-11-18 "글자의 나열을 최소로".
  const checks = [
    { key: 'destination', label: '목적지', Icon: MapPin, value: preparation.destination },
    { key: 'goal', label: '목표', Icon: Target, value: preparation.goalLabel },
  ];

  return (
    <section
      data-testid="control-expedition-prep"
      data-expedition-readiness={preparation.readinessLabel}
      aria-label="원정 준비"
      className="aether-expedition-prep ae-card ae-prep-card px-3.5 py-3 font-readable"
    >
      <div className="flex items-center justify-between gap-2">
        {/* 2026-11 고도화 E2: 오늘의 임무 줄은 머리 줄의 왼쪽 칸에 겹쳐 놓는다 — 이 줄은 '모험 기록' 단추로 이미 44px라
            줄을 새로 쓰지 않는다(새 줄이 기록 창을 줄여 이야기 기록이 잘렸다, 원장 §159). */}
        <div className="min-w-0">
          <div
            data-testid="control-town-daily"
            className="flex items-center gap-1 aether-type-meta text-ae-ink-2"
          >
            <ListChecks size={13} aria-hidden="true" className={`shrink-0 ${dailyComplete ? 'text-ae-good' : 'text-ae-gold'}`} />
            <span className="font-fira tabular-nums">{dailyLine}</span>
          </div>
        </div>
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

      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-1.5">
        {checks.map(({ key, label, Icon, value }) => (
          <div key={key} className="aether-expedition-check ae-well flex min-w-0 items-center gap-1.5 rounded-ae-sm px-2.5 py-2">
            <Icon size={14} aria-hidden="true" className="shrink-0 text-ae-gold" />
            <span className="sr-only">{label}</span>
            <span className="min-w-0 break-words aether-type-body font-semibold text-ae-ink" title={value}>
              {value}
            </span>
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
