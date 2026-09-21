import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronDown, ScrollText, Target } from 'lucide-react';
import { formatRewardParts } from '../../utils/gameUtils';
import { getTraitQuestResonance } from '../../utils/runProfileUtils';
import { getQuestBoardRecommendations } from '../../utils/questOperations.js';
import SignalBadge from '../SignalBadge';
import FocusPanelHeader from '../FocusPanelHeader';
import { getPreparedExpeditionFocusQuestIds, MAX_EXPEDITION_FOCUS_QUESTS } from '../../utils/expeditionMissionFocus.js';
import { getProtocolDayKey } from '../../utils/protocolCycle.js';
import type { GameActions } from '../../hooks/actionDeps';
import type { Player, Quest, QuestReward } from '../../types/index.js';
import type { GameMode } from '../../reducers/gameStates';

/** `getQuestBoardRecommendations()`의 반환 형태 — 이 파일의 카드 타입은 모두 여기서 인덱스 접근으로 뽑는다. */
type QuestBoardRecommendations = ReturnType<typeof getQuestBoardRecommendations>;
/** 추천/백로그 임무 카드 1건 (`.featured`/`.backlog` 원소 — `quest`/`meta`/`resonance`/`brief`/`reason` 포함). */
type FeaturedQuestEntry = QuestBoardRecommendations['featured'][number];
/** 진행 중 임무 1건 (`.activeEntries` 원소). */
type ActiveBoardQuestEntry = QuestBoardRecommendations['activeEntries'][number];
/** 잠긴 임무 1건 — `Quest` + 잠금 안내 필드(`.locked` 원소). */
type LockedBoardQuestEntry = QuestBoardRecommendations['locked'][number];

/**
 * 잠긴 임무를 추천 레인에 미리보기로 끼워 넣을 때 쓰는 합성 카드.
 * `FeaturedQuestEntry`와 같은 자리(`quest`/`meta`/`reason`/`resonance`/`brief`)를 채우지만
 * 출처가 달라 구조가 다르다 — `isLockedPreview: true`가 판별자.
 */
interface LockedPreviewOperation {
    quest: LockedBoardQuestEntry;
    isLockedPreview: true;
    meta: { label: string; emphasis: string };
    reason: string;
    resonance: { label: string | null; score: number };
    brief: {
        label: string;
        route: string;
        riskLabel: string;
        riskTone?: string;
        riskDetail: string;
        payoff: string;
        extraction: string;
    };
}

/** 추천 레인에 렌더링되는 카드 — 실제 추천 임무 또는 잠긴 임무 미리보기(판별자: `isLockedPreview`). */
type FeaturedDisplayOperation = (FeaturedQuestEntry & { isLockedPreview?: false }) | LockedPreviewOperation;

const getQuestObjectiveText = (quest: Quest) => {
  if (quest?.objective) return quest.objective;
  if (quest?.desc) return quest.desc;
  return quest?.target === 'level'
    ? `레벨 ${quest.goal} 달성`
    : `${quest.target} ${quest.goal}회 달성`;
};

// cycle 541: progress / goal defaults 제거 — QuestTab/QuestBoardPanel 양쪽
//   helper duplication. 호출자가 모두 명시 전달이라 default 도달 불가.
//   default 청소 메가 시리즈 36번째 cross-file 4-default batch.
const getQuestProgressText = (quest: Quest, progress: number) => (
  quest?.target === 'level'
    ? `레벨 ${progress}/${quest.goal}`
    : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress: number, goal: number) => Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

const getRewardSummary = (reward: QuestReward | undefined) => formatRewardParts(reward ?? {}).join(' · ') || '보상 확인';

/** `OperationBriefRows`가 실제로 읽는 브리핑 필드 — `getQuestBoardRecommendations().*.brief`와
 *  `LockedPreviewOperation.brief` 양쪽 모두 구조적으로 호환된다(`riskTone`/`tags`는 후자에 없어 optional). */
interface OperationBriefView {
    label: string;
    route: string;
    riskLabel: string;
    riskTone?: string;
    riskDetail: string;
    payoff: string;
    extraction: string;
}

interface OperationBriefRowsProps {
    brief?: OperationBriefView | null;
    reward?: QuestReward;
    progress?: number;
    goal?: number;
}

const OperationBriefRows = ({ brief, reward, progress, goal }: OperationBriefRowsProps) => {
  if (!brief) return null;
  const hasProgress = Number.isFinite(Number(progress)) && Number.isFinite(Number(goal));

  const rows = [
    { label: '목적지', value: brief.route },
    { label: '위험', value: `${brief.riskLabel} · ${brief.riskDetail}` },
    { label: '보상', value: getRewardSummary(reward) || brief.payoff },
    { label: '귀환 기준', value: brief.extraction, trailing: hasProgress ? `${progress}/${goal}` : null },
  ];

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="aether-label">{brief.label}</div>
        <SignalBadge tone={brief.riskTone || 'neutral'} size="sm">{brief.riskLabel}</SignalBadge>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-[0.95rem] border border-white/8 bg-black/12">
        {rows.map((row) => (
          <div key={`${brief.route}_${row.label}`} className="aether-choice-cell px-2.5 py-2">
            <div className="flex items-center gap-2">
              <div className="aether-label">{row.label}</div>
              {row.trailing && (
                <span data-testid="quest-operation-progress" className="aether-label shrink-0 font-semibold text-[#dff7f5]">
                  {row.trailing}
                </span>
              )}
            </div>
            <div className="aether-type-body mt-0.5 min-w-0 break-words font-readable text-slate-200/90">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestObjectiveLine = ({ children }: { children: ReactNode }) => (
  <div className="aether-type-body font-readable text-slate-100/92">
    {children}
  </div>
);

interface QuestRowShellProps {
    children: ReactNode;
    kind: string;
    testId: string;
}

const QuestRowShell = ({ children, kind, testId }: QuestRowShellProps) => (
  <div
    data-testid={testId}
    data-quest-row-kind={kind}
    className={`aether-choice-row rounded-[1.05rem] px-3 ${kind === 'featured' || kind === 'locked-preview' ? 'py-2' : 'py-3'} transition-colors hover:border-[#7dd4d8]/22 ${kind === 'reward' ? 'is-reward' : kind === 'bounty' ? 'is-bounty' : ''}`}
  >
    {children}
  </div>
);

const isBasicHuntQuest = (quest: Quest) => (
  !quest?.type
  && quest?.target
  && quest.target !== 'level'
  && Number.isFinite(Number(quest.goal))
);

const getRecommendationTitle = (quest: Quest) => (
  isBasicHuntQuest(quest) ? `${quest.title} (0/${quest.goal})` : quest.title
);

const getRecommendationBadge = (entry: FeaturedDisplayOperation, index: number) => (
  entry.isLockedPreview ? '잠금' : index === 0 ? '추천' : '임무'
);

interface CompactMissionRowProps {
    entry: FeaturedDisplayOperation;
    index: number;
    expanded: boolean;
    onToggle: () => void;
    onAccept: () => void;
}

const CompactMissionRow = ({ entry, index, expanded, onToggle, onAccept }: CompactMissionRowProps) => (
  <QuestRowShell kind={entry.isLockedPreview ? 'locked-preview' : 'featured'} testId="quest-decision-row">
    <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
      <button
        type="button"
        data-testid="quest-board-detail-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
        className="min-h-[56px] min-w-0 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <SignalBadge
            tone={index === 0 ? 'recommended' : 'resonance'}
            size="sm"
            title={entry.isLockedPreview ? entry.quest.lockLabel : entry.meta.label}
          >
            {getRecommendationBadge(entry, index)}
          </SignalBadge>
          <span className="aether-type-title min-w-0 font-readable font-semibold text-white">{getRecommendationTitle(entry.quest)}</span>
          <ChevronDown
            size={13}
            className={`ml-auto shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        {!isBasicHuntQuest(entry.quest) && (
          <div className="aether-type-body mt-1 font-readable text-slate-300/84">
            {getQuestObjectiveText(entry.quest)}
          </div>
        )}
        <div className="aether-type-meta mt-1 grid grid-cols-2 gap-1 font-readable">
          <span className="break-words text-[#b9f1ec]">목적지 · {entry.brief?.route || '현재 권역'}</span>
          <span className="break-words text-[#f6e7c8]">위험 · {entry.isLockedPreview ? entry.quest.lockLabel : (entry.brief?.riskLabel || '확인')}</span>
          <span className="col-span-2 break-words text-emerald-100">보상 · {getRewardSummary(entry.quest.reward)}</span>
        </div>
      </button>
      <Motion.button
        data-testid="quest-board-start-operation"
        data-quest-action-state={entry.isLockedPreview ? 'locked' : 'ready'}
        whileTap={{ scale: 0.96 }}
        onClick={onAccept}
        disabled={entry.isLockedPreview}
        className="aether-cta-primary aether-type-body min-h-[56px] px-2 font-readable font-bold text-[#dff7f5] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {entry.isLockedPreview ? <>선행 필요<br />잠금</> : <>임무<br />수락</>}
      </Motion.button>
    </div>
  </QuestRowShell>
);

/**
 * QuestBoardPanel — 퀘스트 보드 패널 (진행 중 / 수락 가능 / 잠긴 임무)
 */
// cycle 487: 모바일 포커스 prop 인터페이스 제거 — cycle 486 paired completion
//   (ControlPanel cascade로 caller 0건이라 항상 truthy 전달이었음).
/** QuestBoardPanel이 실제로 호출하는 액션만 좁힌 부분집합. */
type QuestBoardActions = Pick<GameActions,
    'acceptQuest' | 'toggleExpeditionFocusQuest' | 'completeQuest' | 'abandonQuest' | 'requestBounty'
>;

interface QuestBoardPanelProps {
    player: Player;
    actions?: QuestBoardActions;
    setGameState?: (state: GameMode) => void;
    onOpenArchiveConsole?: () => void;
}

// cycle 589: onOpenArchiveConsole default null 제거 — 1 production caller
//   (ControlPanel:158) 4 props 명시 전달이라 default 도달 불가. 청소 메가
//   시리즈 80번째 cross-file batch.
const QuestBoardPanel = ({ player, actions, setGameState, onOpenArchiveConsole }: QuestBoardPanelProps) => {
  const [confirmAbandonQuestId, setConfirmAbandonQuestId] = useState<string | number | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<string | number | null>(null);
  const {
    traitProfile,
    activeEntries: activeQuestEntries,
    featured: featuredOperations,
    backlog: backlogQuestEntries,
    locked: lockedQuestEntries,
  } = getQuestBoardRecommendations(player);
  const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;
  const focusedQuestIds = getPreparedExpeditionFocusQuestIds(player);
  const isFocusedQuest = (questId: string | number) => focusedQuestIds.some((id) => String(id) === String(questId));
  const focusLimitReached = focusedQuestIds.length >= MAX_EXPEDITION_FOCUS_QUESTS;

  const today = getProtocolDayKey(new Date());
  const hasActiveBounty = activeQuestEntries.some((e) => e.isBounty);
  const bountyIssuedToday = player?.stats?.bountyDate === today && player?.stats?.bountyIssued;
  const canRequestBounty = !hasActiveBounty && !bountyIssuedToday;
  // slice 22: 결정 CTA 한국어화 — 헤더/라벨의 콘솔 무드는 보존하되,
  //   행동을 확정하는 버튼은 즉시 이해되는 한국어로.
  const bountyButtonLabel = hasActiveBounty ? '현상수배 진행 중' : bountyIssuedToday ? '오늘 발급 완료' : '현상수배 발급';
  const bountyHelperText = hasActiveBounty
    ? '진행 중인 현상수배를 완료해야 다음 수배를 받을 수 있습니다.'
    : bountyIssuedToday
      ? '오늘 현상수배는 이미 발급되었습니다.'
      : '현재 레벨 기준 토벌 의뢰를 즉시 발급합니다.';
  const lockedPreviewOperations: LockedPreviewOperation[] = lockedQuestEntries.map((quest) => ({
    quest,
    isLockedPreview: true,
    meta: { label: '곳 열림', emphasis: '잠금' },
    reason: quest.lockDetail,
    resonance: { label: '', score: 0 },
    brief: {
      label: '해금 안내',
      route: quest.location || '선행 임무',
      riskLabel: '잠금',
      riskDetail: quest.lockLabel,
      payoff: getRewardSummary(quest.reward),
      extraction: quest.lockDetail,
    },
  }));
  const featuredDisplayOperations: FeaturedDisplayOperation[] = [...featuredOperations, ...lockedPreviewOperations].slice(0, 3);
  const previewedLockedQuestIds = new Set(
    featuredDisplayOperations.filter((entry) => entry.isLockedPreview).map((entry) => entry.quest.id),
  );
  const remainingLockedQuestEntries = lockedQuestEntries.filter(
    (quest) => !previewedLockedQuestIds.has(quest.id),
  );
  const selectedOperation = featuredDisplayOperations.find((entry) => entry.quest.id === selectedQuestId) || null;

  const acceptFeaturedMission = (questId: string | number) => {
    actions?.acceptQuest(questId);
    setGameState?.('idle');
  };

  return (
    <Motion.div
      data-testid="quest-board-panel"
      initial={false} animate={{ opacity: 1, y: 0 }}
      className="aether-focus-panel aether-quest-board relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <FocusPanelHeader
        eyebrow="마을 임무 게시판"
        title="임무 선택"
        titleClassName="flex items-center gap-2 text-[1.05rem] leading-none"
        meta=""
        onBack={() => setGameState?.('idle')}
        backLabel="복귀"
        backTestId="quest-board-close"
        bleedClassName="-mx-3 px-3"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="quest-board-open-archive"
        rightSlot={<ScrollText size={18} className="text-[#f6e7c8]/78" />}
      />
      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
        {featuredDisplayOperations.length > 0 && (
          <section data-testid="quest-featured-list" className="space-y-2">
            <div className="flex items-end justify-between border-b border-white/8 pb-1.5">
              <div>
                <h3 className="font-readable text-sm font-semibold text-[#dff7f5]">추천 임무</h3>
                <span className="aether-type-meta font-readable text-slate-400">임무 안내 · 목적지 · 위험 · 보상 · 귀환 기준</span>
              </div>
              <span className="aether-label">진행 {activeQuestEntries.length} · 보상 {claimableQuestCount}</span>
            </div>
            <div className="grid gap-1.5">
              {featuredDisplayOperations.map((entry, index) => (
                <CompactMissionRow
                  key={`featured_${entry.quest.id}`}
                  entry={entry}
                  index={index}
                  expanded={selectedQuestId === entry.quest.id}
                  onToggle={() => setSelectedQuestId(selectedQuestId === entry.quest.id ? null : (entry.quest.id ?? null))}
                  onAccept={() => {
                    if (!entry.isLockedPreview) acceptFeaturedMission(entry.quest.id!);
                  }}
                />
              ))}
            </div>
            {selectedOperation && (
              <div data-testid="quest-board-detail-sheet" className="aether-quest-detail px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="aether-label">임무 안내</div>
                    <div className="aether-type-title mt-0.5 font-readable font-semibold text-white">{selectedOperation.quest.title}</div>
                  </div>
                  <SignalBadge tone="neutral" size="sm">레벨 {selectedOperation.quest.minLv || 1}</SignalBadge>
                </div>
                <div className="mt-1.5 font-readable text-[11px] leading-snug text-slate-200/86">
                  {selectedOperation.reason}
                </div>
                <OperationBriefRows brief={selectedOperation.brief} reward={selectedOperation.quest.reward} />
                {selectedOperation.resonance?.label && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <SignalBadge tone={selectedOperation.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">
                      {selectedOperation.resonance.label}
                    </SignalBadge>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 진행 중 임무 */}
        <section className="space-y-3">
          {activeQuestEntries.length > 0 && (
            <div className="flex items-center justify-between border-b border-white/8 pb-2">
              <div>
                <h3 className="font-readable text-sm font-semibold text-emerald-100">이번 원정 임무</h3>
                <div className="aether-type-meta mt-0.5 font-readable text-slate-400">진행 중 임무는 유지되며 최대 3개를 추적</div>
              </div>
              <SignalBadge tone={focusLimitReached ? 'recommended' : 'neutral'} size="sm">
                {focusedQuestIds.length}/{MAX_EXPEDITION_FOCUS_QUESTS}
              </SignalBadge>
            </div>
          )}
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry) => (
            <QuestRowShell key={`active_${entry.id}`} kind={entry.isComplete ? 'reward' : entry.isBounty ? 'bounty' : 'active'} testId="quest-active-row">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`font-readable text-base font-semibold ${entry.isComplete ? 'text-emerald-100' : 'text-white'}`}>{entry.quest.title}</div>
                    {entry.isBounty && <span className="aether-type-meta rounded-full border border-[#d5b180]/28 bg-[#d5b180]/10 px-2 py-0.5 font-readable text-[#f6e7c8]">현상수배</span>}
                    {entry.isComplete && <span className="aether-type-meta rounded-full border border-emerald-300/24 bg-emerald-300/10 px-2 py-0.5 font-readable text-emerald-100">보상 수령 가능</span>}
                    {isFocusedQuest(entry.id) && <SignalBadge tone="recommended" size="sm">이번 원정</SignalBadge>}
                    {entry.quest.buildTag && (
                      <SignalBadge tone="neutral" size="sm">{entry.quest.buildLabel || entry.quest.buildTag}</SignalBadge>
                    )}
                    {(() => {
                      const resonance = getTraitQuestResonance(entry.quest, traitProfile);
                      return resonance.label ? (
                        <SignalBadge tone={resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{resonance.label}</SignalBadge>
                      ) : null;
                    })()}
                  </div>
                  {!entry.isBounty && <div className="mt-1">
                    <QuestObjectiveLine>{getQuestObjectiveText(entry.quest)}</QuestObjectiveLine>
                  </div>}
                  <OperationBriefRows brief={entry.brief} reward={entry.quest.reward} progress={entry.progress} goal={entry.quest.goal} />
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/36">
                      <div className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-emerald-300' : entry.isBounty ? 'bg-[#d5b180]' : 'bg-[#7dd4d8]'}`} style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal!)}%` }} />
                    </div>
                  </div>
                </div>
                {entry.isComplete ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Motion.button
                      type="button"
                      data-testid="quest-board-toggle-expedition-focus"
                      data-focus-selected={isFocusedQuest(entry.id)}
                      title={isFocusedQuest(entry.id) ? '이번 원정에서 제외' : '이번 원정에 추가'}
                      whileTap={{ scale: 0.97 }}
                      disabled={!isFocusedQuest(entry.id) && focusLimitReached}
                      onClick={() => actions?.toggleExpeditionFocusQuest(entry.id)}
                      className="aether-disabled-action flex min-h-[44px] items-center justify-center gap-1.5 border border-[#7dd4d8]/24 bg-[#7dd4d8]/8 px-3 text-xs font-bold text-[#dff7f5]"
                    >
                      <Target size={13} />{isFocusedQuest(entry.id) ? '원정 제외' : '원정 추가'}
                    </Motion.button>
                    <Motion.button data-testid="quest-board-claim-reward" whileTap={{ scale: 0.95 }} onClick={() => actions?.completeQuest(entry.id)} className="min-h-[44px] shrink-0 rounded-[0.9rem] border border-emerald-300/35 bg-emerald-300/16 px-4 py-3 text-xs font-bold text-emerald-100 transition-all hover:bg-emerald-300/22">
                      보상 받기
                    </Motion.button>
                  </div>
                ) : confirmAbandonQuestId === entry.id ? (
                  <div data-testid="quest-board-abandon-warning" className="border-t border-rose-300/18 pt-3">
                    <div className="font-readable text-[12px] leading-[1.45] text-rose-100/88">
                      지금까지의 진행도 {getQuestProgressText(entry.quest, entry.progress)}이 사라집니다.
                      {entry.isBounty && ' 오늘은 새 현상수배를 다시 받을 수 없습니다.'}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Motion.button
                        data-testid="quest-board-abandon-cancel"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setConfirmAbandonQuestId(null)}
                        className="min-h-[44px] rounded-[0.85rem] border border-white/12 bg-black/18 px-3 py-2 text-xs font-bold text-slate-200"
                      >
                        계속 진행
                      </Motion.button>
                      <Motion.button
                        data-testid="quest-board-abandon-confirm"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          actions?.abandonQuest(entry.id);
                          setConfirmAbandonQuestId(null);
                        }}
                        className="min-h-[44px] rounded-[0.85rem] border border-rose-300/28 bg-rose-300/12 px-3 py-2 text-xs font-bold text-rose-100"
                      >
                        포기 확정
                      </Motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-white/8 pt-3">
                    <Motion.button
                      type="button"
                      data-testid="quest-board-toggle-expedition-focus"
                      data-focus-selected={isFocusedQuest(entry.id)}
                      title={isFocusedQuest(entry.id) ? '이번 원정에서 제외' : '이번 원정에 추가'}
                      whileTap={{ scale: 0.97 }}
                      disabled={!isFocusedQuest(entry.id) && focusLimitReached}
                      onClick={() => actions?.toggleExpeditionFocusQuest(entry.id)}
                      className="aether-disabled-action flex min-h-[44px] items-center gap-1.5 border border-[#7dd4d8]/24 bg-[#7dd4d8]/8 px-3 text-xs font-bold text-[#dff7f5]"
                    >
                      <Target size={13} />{isFocusedQuest(entry.id) ? '원정 제외' : '원정 추가'}
                    </Motion.button>
                    <Motion.button data-testid="quest-board-abandon-mission" whileTap={{ scale: 0.97 }} onClick={() => setConfirmAbandonQuestId(entry.id)} className="min-h-[44px] rounded-[0.85rem] border border-rose-300/20 bg-rose-300/8 px-4 py-2 text-xs font-bold text-rose-100/88">
                      임무 포기
                    </Motion.button>
                  </div>
                )}
              </div>
            </QuestRowShell>
          )) : (
            <div
              data-testid="quest-board-empty-active"
              className="flex min-h-[52px] items-center justify-between gap-3 border-y border-white/8 py-2 font-readable"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-emerald-100">이번 원정 임무</h3>
                <div className="aether-type-meta mt-0.5 text-slate-400">아직 없음</div>
              </div>
              <SignalBadge tone="neutral" size="sm">0/{MAX_EXPEDITION_FOCUS_QUESTS}</SignalBadge>
            </div>
          )}
        </section>

        <section data-testid="quest-board-bounty" className="space-y-2">
          <div className="flex items-center justify-between border-b border-white/8 pb-1.5">
            <h3 className="font-readable text-sm font-semibold text-[#f6e7c8]">현상수배</h3>
            <span className="aether-label">레벨 {player.level} 기준</span>
          </div>
          <div className="aether-choice-row is-bounty px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-readable text-[12px] font-semibold text-[#f6e7c8]">현상수배 게시판</div>
                <div className="aether-type-meta mt-0.5 font-readable text-slate-200/78">{bountyHelperText}</div>
              </div>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => actions?.requestBounty()}
                disabled={!canRequestBounty}
                className="aether-disabled-action aether-type-body min-h-[44px] shrink-0 border border-[#d5b180]/28 bg-[#d5b180]/12 px-3 py-2 font-bold text-[#f6e7c8] transition-all hover:bg-[#d5b180]/16"
              >
                {bountyButtonLabel}
              </Motion.button>
            </div>
          </div>
        </section>

        {backlogQuestEntries.length > 0 && (
          <section data-testid="quest-board-backlog" className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/8 pb-2">
              <h3 className="font-readable text-sm font-semibold text-[#dff7f5]">다른 임무</h3>
              <span className="aether-label">추천 목록 제외</span>
            </div>
            {backlogQuestEntries.map((entry) => {
              const quest = entry.quest;
              const resonance = entry.resonance.label ? entry.resonance : getTraitQuestResonance(quest, traitProfile);
              return (
                <QuestRowShell key={`available_${quest.id}`} kind="available" testId="quest-decision-row">
                  <div className="flex flex-col gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-readable text-base font-semibold text-white">{quest.title}</div>
                        <span className="aether-type-meta rounded-full border border-[#9a8ac0]/22 bg-[#9a8ac0]/10 px-2 py-0.5 font-readable text-[#ece5ff]">레벨 {quest.minLv} 필요</span>
                        {quest.buildTag && (
                          <SignalBadge tone="neutral" size="sm">{quest.buildLabel || quest.buildTag}</SignalBadge>
                        )}
                        <SignalBadge tone="neutral" size="sm">{entry.meta.emphasis}</SignalBadge>
                        {resonance.label && (
                          <SignalBadge tone={resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{resonance.label}</SignalBadge>
                        )}
                        {entry.targetMaps[0] && (
                          <SignalBadge tone="upgrade" size="sm">{entry.targetMaps[0]}</SignalBadge>
                        )}
                      </div>
                      <div className="mt-1">
                        <QuestObjectiveLine>{getQuestObjectiveText(quest)}</QuestObjectiveLine>
                      </div>
                      <div className="mt-2 font-readable text-[12px] leading-[1.42] text-slate-300/82">{entry.reason}</div>
                      <OperationBriefRows brief={entry.brief} reward={quest.reward} />
                    </div>
                    <Motion.button data-testid="quest-board-accept-mission" whileTap={{ scale: 0.95 }} onClick={() => actions?.acceptQuest(quest.id!)} className="aether-cta-primary min-h-[44px] shrink-0 rounded-[0.9rem] px-5 py-3 text-xs font-bold text-[#dff7f5]">
                      임무 수락
                    </Motion.button>
                  </div>
                </QuestRowShell>
              );
            })}
          </section>
        )}

        {remainingLockedQuestEntries.length > 0 && (
          <section data-testid="quest-board-locked" className="space-y-3">
            <h3 className="border-b border-white/8 pb-2 font-readable text-sm font-semibold text-[#ece5ff]">곧 열릴 임무</h3>
            {remainingLockedQuestEntries.map((quest) => (
              <div key={`locked_${quest.id}`} className="aether-locked-row rounded-[1.05rem] px-3 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-readable text-base font-semibold text-slate-100">{quest.title}</div>
                      <span className="aether-lock-note aether-type-meta rounded-full px-2 py-0.5 font-readable">잠금 · {quest.lockLabel}</span>
                    </div>
                    <div className="mt-1">
                      <QuestObjectiveLine>{getQuestObjectiveText(quest)}</QuestObjectiveLine>
                    </div>
                    <div className="aether-lock-note mt-2 rounded-[0.7rem] px-2.5 py-1.5 font-readable text-[11px] leading-snug">
                      {quest.lockDetail}
                    </div>
                    <div className="aether-type-meta mt-2 font-readable text-[#dff7f5]">
                      보상 · {getRewardSummary(quest.reward)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

    </Motion.div>
  );
};

export default QuestBoardPanel;
