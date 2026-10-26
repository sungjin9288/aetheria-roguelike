import { Gift } from 'lucide-react';
import type { QuestTracker } from '../../utils/adventureGuide';
import { MAX_EXPEDITION_FOCUS_QUESTS } from '../../utils/expeditionMissionFocus';

/**
 * 원정 임무 카드 — 호박빛 카드 하나(2026-10 에테르 유리, 시안 mock-expedition).
 *   보상 대기는 금빛 림, 현상수배는 장밋빛 림이 더해진다(`data-tracker-kind`). 진행 막대는 장식이고 숫자는 칩이 말한다.
 *   장소 · 귀환 칸과 보상 단추의 규칙은 그대로다 — 보상은 마을에서만 받는다(`canClaimReward`).
 */
interface MissionTrackerStripProps {
  tracker: QuestTracker;
  canClaimReward: boolean;
  onClaimReward?: () => void;
}

const MissionTrackerStrip = ({ tracker, canClaimReward, onClaimReward }: MissionTrackerStripProps) => {
  const focusQuests = tracker.focusQuests || [];
  const showFocusOverview = tracker.focusQuests?.length > 1;
  const isClaimable = tracker.kind === 'claimable';
  const progress = Math.max(0, Math.min(100, tracker.progressPercent || 0));

  return (
    <section
      data-testid="control-mission-tracker"
      data-tracker-kind={tracker.kind}
      aria-label="현재 임무"
      className="aether-mission-strip ae-mission-card px-3.5 py-3 font-readable"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="ae-eyebrow font-fira tabular-nums">이번 원정 · {tracker.focusCount}/{MAX_EXPEDITION_FOCUS_QUESTS}</div>
          <div className="mt-1 aether-type-title font-extrabold text-ae-ink">
            {tracker.title}
          </div>
          <div className="mt-0.5 aether-type-body text-ae-ink-2">
            {tracker.nextStep}
          </div>
        </div>
        <div className="ae-mission-count shrink-0 font-fira tabular-nums">
          {tracker.progressLabel}
        </div>
      </div>
      <div aria-hidden="true" className="ae-gauge ae-gauge-ether ae-sunk ae-mission-gauge mt-3">
        <div className="ae-gauge-fill" style={{ width: `${progress}%` }} />
      </div>
      {showFocusOverview && (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 min-[401px]:grid-cols-3" data-testid="control-expedition-focus-list">
          {focusQuests.map((quest) => (
            <div key={quest.questId} className="ae-well flex min-h-[40px] min-w-0 items-center justify-between gap-2 rounded-ae-sm px-2.5 py-1.5">
              <div className="min-w-0 break-words aether-type-meta font-semibold text-ae-ink">{quest.title}</div>
              <div className="shrink-0 font-fira aether-type-label tabular-nums text-ae-ink-3">{quest.progressLabel}</div>
            </div>
          ))}
        </div>
      )}
      <div
        data-testid="control-mission-context"
        className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 aether-type-meta text-ae-ink"
      >
        <div className="min-w-0 font-semibold">
          <span className="mr-1 font-normal text-ae-ink-3">장소</span>
          {tracker.routeLabel || '현재 지역'}
        </div>
        <div className="min-w-0 font-semibold">
          <span className="mr-1 font-normal text-ae-ink-3">귀환</span>
          {tracker.returnLabel || '계속 진행'}
        </div>
      </div>
      {isClaimable && (
        <button
          type="button"
          data-testid="control-claim-quest-reward"
          disabled={!canClaimReward || !onClaimReward}
          onClick={onClaimReward}
          className="ae-mission-claim mt-2.5 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-ae-sm px-3 text-left"
        >
          <span className="inline-flex items-center gap-1.5 aether-type-meta font-bold text-ae-gold-text">
            <Gift size={14} aria-hidden="true" />
            임무 완료
          </span>
          <span className="aether-type-body font-bold text-ae-ink">
            {canClaimReward ? '보상 받기' : '마을에서 수령'}
          </span>
        </button>
      )}
    </section>
  );
};

export default MissionTrackerStrip;
