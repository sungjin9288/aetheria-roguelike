import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronDown, Gift, ScrollText, Target } from 'lucide-react';
import { formatRewardParts } from '../../utils/gameUtils';
import type { ChallengeHolder } from '../../utils/challengeRules';
import { getTraitQuestResonance } from '../../utils/runProfileUtils';
import { getQuestBoardRecommendations, isBasicHuntQuest, isSelfDescribingHuntQuest } from '../../utils/questOperations.js';
import ActionButton from '../ui/ActionButton';
import Chip, { type ChipTone } from '../ui/Chip';
import FocusPanelHeader from '../FocusPanelHeader';
import { getPreparedExpeditionFocusQuestIds, MAX_EXPEDITION_FOCUS_QUESTS } from '../../utils/expeditionMissionFocus.js';
import { getQuestObjectiveGateNotice, type QuestObjectiveGate } from '../../utils/questObjectiveGate';
import { isLifetimeCounterQuest } from '../../utils/cumulativeQuestProgress';
import { MSG } from '../../data/messages';
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

// 2026-10 Wave 62 (원장 §61.4 C16): 골드는 받을 플레이어가 실제로 받는 금액이다('빈손의 시작'이면 절반) — 수령과 같은 규칙.
const getRewardSummary = (reward: QuestReward | undefined, player: ChallengeHolder) => formatRewardParts(reward ?? {}, player).join(' · ') || '보상 확인';

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
    /** 받을 플레이어 — 보상 줄의 골드는 실제로 받는 금액이다. */
    player: ChallengeHolder;
    progress?: number;
    goal?: number;
}

/** 위험 어조 → 칩 색. 위험 칩은 추천을 말하지 않는다 — 색은 무게만 알린다. */
const RISK_CHIP_TONE: Readonly<Record<string, ChipTone>> = Object.freeze({
    danger: 'threat',
    warning: 'gold',
    upgrade: 'ether',
    resonance: 'ether',
    recommended: 'ether',
});

const getRiskChipTone = (tone: string | undefined): ChipTone => RISK_CHIP_TONE[tone ?? ''] || 'neutral';

const getResonanceChipTone = (score: number): ChipTone => (score >= 6 ? 'ether' : 'neutral');

const OperationBriefRows = ({ brief, reward, player, progress, goal }: OperationBriefRowsProps) => {
  if (!brief) return null;
  const hasProgress = Number.isFinite(Number(progress)) && Number.isFinite(Number(goal));

  const rows = [
    { label: '목적지', value: brief.route },
    { label: '위험', value: `${brief.riskLabel} · ${brief.riskDetail}` },
    { label: '보상', value: getRewardSummary(reward, player) || brief.payoff },
    { label: '귀환 기준', value: brief.extraction, trailing: hasProgress ? `${progress}/${goal}` : null },
  ];

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="ae-eyebrow font-readable">{brief.label}</div>
        <Chip tone={getRiskChipTone(brief.riskTone)}>{brief.riskLabel}</Chip>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-ae-sm bg-[var(--aether-hairline)]">
        {rows.map((row) => (
          <div key={`${brief.route}_${row.label}`} className="bg-ae-sunk/85 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <div className="ae-eyebrow font-readable">{row.label}</div>
              {row.trailing && (
                <span data-testid="quest-operation-progress" className="shrink-0 font-fira text-[12px] font-semibold tabular-nums text-ae-ether-hi">
                  {row.trailing}
                </span>
              )}
            </div>
            <div className="aether-type-body mt-0.5 min-w-0 break-words font-readable text-ae-ink">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestObjectiveLine = ({ children }: { children: ReactNode }) => (
  <div className="aether-type-body font-readable text-ae-ink">
    {children}
  </div>
);

/** Wave 28: 목표 지역에 아직 걸어 들어갈 수 없을 때만 실제 진입 레벨을 말한다(수락 규칙은 그대로). */
const QuestObjectiveGateLine = ({ gate }: { gate: QuestObjectiveGate | null }) => (gate ? (
  <div data-testid="quest-objective-gate" className="aether-type-meta mt-1 font-readable text-ae-gold-text">
    {MSG.QUEST_OBJECTIVE_GATE_NOTICE(gate.map, gate.routeGateLevel)}
  </div>
) : null);

/** 진행도를 평생 누적 기록에서 읽는 임무 표시 — 판정은 진행도와 같은 표(`isLifetimeCounterQuest`)가 소유한다. */
const LifetimeCounterChip = ({ quest }: { quest: Quest }) => (isLifetimeCounterQuest(quest) ? (
  <Chip title={MSG.QUEST_LIFETIME_COUNTER_HINT} data-testid="quest-lifetime-counter-chip">
    {MSG.QUEST_LIFETIME_COUNTER_CHIP}
  </Chip>
) : null);

interface QuestRowShellProps {
    children: ReactNode;
    kind: string;
    testId: string;
    /** 이야기 임무(본편 장 · 곁가지 이야기를 여는 임무)는 같은 카드에 에테르 결만 더한다. */
    story?: boolean;
}

// 2026-10 에테르 유리: 임무 카드는 호박빛 유리(`.ae-town-mission`) — 보상 수령 가능은 초록 결, 이야기는 에테르 결.
const QuestRowShell = ({ children, kind, testId, story = false }: QuestRowShellProps) => (
  <div
    data-testid={testId}
    data-quest-row-kind={kind}
    className={`ae-town-mission px-3 ${kind === 'featured' || kind === 'locked-preview' ? 'py-1.5' : 'py-3'} ${kind === 'reward' ? 'is-reward' : story ? 'is-story' : kind === 'locked-preview' ? 'is-quiet' : ''}`.trim()}
  >
    {children}
  </div>
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
    objectiveGate: QuestObjectiveGate | null;
    player: ChallengeHolder;
    /** 이 화면의 금빛 주 행동 — 첫 번째로 받을 수 있는 추천 임무 하나뿐이다. */
    primary: boolean;
}

const CompactMissionRow = ({ entry, index, expanded, onToggle, onAccept, objectiveGate, player, primary }: CompactMissionRowProps) => (
  <QuestRowShell
    kind={entry.isLockedPreview ? 'locked-preview' : 'featured'}
    testId="quest-decision-row"
    story={!entry.isLockedPreview && entry.lane === 'story'}
  >
    <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
      <button
        type="button"
        data-testid="quest-board-detail-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
        className="min-h-[56px] min-w-0 rounded-ae-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-ether"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Chip
            tone={entry.isLockedPreview ? 'neutral' : index === 0 ? 'gold' : 'ether'}
            className="shrink-0 font-bold"
            title={entry.isLockedPreview ? entry.quest.lockLabel : entry.meta.label}
          >
            {getRecommendationBadge(entry, index)}
          </Chip>
          <span className="aether-type-title min-w-0 font-display font-bold text-ae-ink">{getRecommendationTitle(entry.quest)}</span>
          <LifetimeCounterChip quest={entry.quest} />
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`ml-auto shrink-0 text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        {!isSelfDescribingHuntQuest(entry.quest) && (
          <div data-testid="quest-featured-objective" className="aether-type-body mt-1 font-readable text-ae-ink-2">
            {getQuestObjectiveText(entry.quest)}
          </div>
        )}
        {!entry.isLockedPreview && entry.storyHook && (
          <div data-testid="quest-story-hook" className="aether-type-body mt-1 font-readable text-ae-ether-hi">
            {entry.storyHook}
          </div>
        )}
        <div className="aether-type-meta mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-readable text-ae-ink-2">
          <span className="break-words">목적지 · <b className="font-semibold text-ae-ink">{entry.brief?.route || '현재 권역'}</b></span>
          <span className="break-words">위험 · <b className="font-semibold text-ae-ink">{entry.isLockedPreview ? entry.quest.lockLabel : (entry.brief?.riskLabel || '확인')}</b></span>
          <span className="col-span-2 break-words">보상 · <b className="font-semibold text-ae-gold-text">{getRewardSummary(entry.quest.reward, player)}</b></span>
        </div>
        <QuestObjectiveGateLine gate={objectiveGate} />
      </button>
      <ActionButton
        variant={primary ? 'primary' : 'glass'}
        data-testid="quest-board-start-operation"
        data-quest-action-state={entry.isLockedPreview ? 'locked' : 'ready'}
        onClick={onAccept}
        disabled={entry.isLockedPreview}
        label={entry.isLockedPreview ? <>선행 필요<br />잠금</> : <>임무<br />수락</>}
        className="aether-disabled-action aether-type-body min-h-[56px] px-2 font-readable font-bold"
      />
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

/** 묶음 머리 — 제목 · 보조 설명 · 오른쪽 값 한 줄. 상자 대신 머리카락 선 하나로 나눈다. */
const SectionHead = ({ title, note, aside }: { title: ReactNode; note?: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-end justify-between gap-3 pb-1.5 shadow-[inset_0_-1px_0_var(--aether-hairline)]">
    <div className="min-w-0">
      <h3 className="font-display text-[14px] font-bold text-ae-ink">{title}</h3>
      {note && <div className="aether-type-meta mt-0.5 font-readable text-ae-ink-2">{note}</div>}
    </div>
    {aside}
  </div>
);

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

  const hasActiveBounty = activeQuestEntries.some((e) => e.isBounty);
  // Wave 32: 하루 1회 제한 없음 — 진행 중인 현상수배가 없으면 언제든 발급한다.
  const canRequestBounty = !hasActiveBounty;
  // slice 22: 결정 CTA 한국어화 — 헤더/라벨의 콘솔 무드는 보존하되,
  //   행동을 확정하는 버튼은 즉시 이해되는 한국어로.
  const bountyButtonLabel = hasActiveBounty ? '현상수배 진행 중' : '현상수배 발급';
  const bountyHelperText = hasActiveBounty
    ? '진행 중인 현상수배를 완료해야 다음 수배를 받을 수 있습니다.'
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
      payoff: getRewardSummary(quest.reward, player),
      extraction: quest.lockDetail,
    },
  }));
  const featuredDisplayOperations: FeaturedDisplayOperation[] = [...featuredOperations, ...lockedPreviewOperations].slice(0, 3);
  const primaryFeaturedIndex = featuredDisplayOperations.findIndex((entry) => !entry.isLockedPreview);
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
      className="ae-town aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <FocusPanelHeader
        eyebrow="마을 임무 게시판"
        title="임무 선택"
        titleClassName="flex items-center gap-2 text-[1.05rem] leading-tight"
        meta=""
        onBack={() => setGameState?.('idle')}
        backLabel={MSG.UI_BACK}
        backTestId="quest-board-close"
        bleedClassName="-mx-3 px-3"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="quest-board-open-archive"
        rightSlot={<ScrollText size={18} aria-hidden="true" className="text-ae-gold-text" />}
      />
      <div className="flex-1 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
        {featuredDisplayOperations.length > 0 && (
          <section data-testid="quest-featured-list" className="space-y-2">
            <SectionHead
              title="추천 임무"
              note="임무 안내 · 목적지 · 위험 · 보상 · 귀환 기준"
              aside={<span className="shrink-0 font-readable text-[12px] text-ae-ink-2">진행 <span className="font-fira tabular-nums text-ae-ink">{activeQuestEntries.length}</span> · 보상 <span className="font-fira tabular-nums text-ae-ink">{claimableQuestCount}</span></span>}
            />
            <div className="grid gap-1.5">
              {featuredDisplayOperations.map((entry, index) => (
                <CompactMissionRow
                  key={`featured_${entry.quest.id}`}
                  player={player}
                  entry={entry}
                  index={index}
                  primary={index === primaryFeaturedIndex}
                  expanded={selectedQuestId === entry.quest.id}
                  onToggle={() => setSelectedQuestId(selectedQuestId === entry.quest.id ? null : (entry.quest.id ?? null))}
                  onAccept={() => {
                    if (!entry.isLockedPreview) acceptFeaturedMission(entry.quest.id!);
                  }}
                  objectiveGate={getQuestObjectiveGateNotice(entry.quest, player.level)}
                />
              ))}
            </div>
            {selectedOperation && (
              <div data-testid="quest-board-detail-sheet" className="ae-well px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="ae-eyebrow font-readable">임무 안내</div>
                    <div className="aether-type-title mt-0.5 font-display font-bold text-ae-ink">{selectedOperation.quest.title}</div>
                  </div>
                  <Chip className="font-fira tabular-nums">레벨 {selectedOperation.quest.minLv || 1}</Chip>
                </div>
                <div className="mt-1.5 font-readable text-[12px] leading-snug text-ae-ink-2">
                  {selectedOperation.reason}
                </div>
                <OperationBriefRows brief={selectedOperation.brief} reward={selectedOperation.quest.reward} player={player} />
                {selectedOperation.resonance?.label && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tone={getResonanceChipTone(selectedOperation.resonance.score)}>
                      {selectedOperation.resonance.label}
                    </Chip>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 진행 중 임무 */}
        <section className="space-y-3">
          {activeQuestEntries.length > 0 && (
            <SectionHead
              title="이번 원정 임무"
              note="진행 중 임무는 유지되며 최대 3개를 추적"
              aside={(
                <Chip tone={focusLimitReached ? 'ether' : 'neutral'} className="shrink-0 font-fira tabular-nums">
                  {focusedQuestIds.length}/{MAX_EXPEDITION_FOCUS_QUESTS}
                </Chip>
              )}
            />
          )}
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry) => (
            <QuestRowShell key={`active_${entry.id}`} kind={entry.isComplete ? 'reward' : entry.isBounty ? 'bounty' : 'active'} testId="quest-active-row">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`font-display text-[15px] font-bold ${entry.isComplete ? 'text-ae-good' : 'text-ae-ink'}`}>{entry.quest.title}</div>
                    {entry.isBounty && <Chip tone="gold">현상수배</Chip>}
                    <LifetimeCounterChip quest={entry.quest} />
                    {entry.isComplete && <Chip tone="good">보상 수령 가능</Chip>}
                    {isFocusedQuest(entry.id) && <Chip tone="ether">이번 원정</Chip>}
                    {entry.quest.buildTag && (
                      <Chip>{entry.quest.buildLabel || entry.quest.buildTag}</Chip>
                    )}
                    {(() => {
                      const resonance = getTraitQuestResonance(entry.quest, traitProfile);
                      return resonance.label ? (
                        <Chip tone={getResonanceChipTone(resonance.score)}>{resonance.label}</Chip>
                      ) : null;
                    })()}
                  </div>
                  {!entry.isBounty && <div className="mt-1">
                    <QuestObjectiveLine>{getQuestObjectiveText(entry.quest)}</QuestObjectiveLine>
                    {!entry.isComplete && <QuestObjectiveGateLine gate={getQuestObjectiveGateNotice(entry.quest, player.level)} />}
                  </div>}
                  <OperationBriefRows brief={entry.brief} reward={entry.quest.reward} player={player} progress={entry.progress} goal={entry.quest.goal} />
                  <div className="mt-2">
                    <div className="h-1 overflow-hidden rounded-full bg-ae-sunk">
                      <div className={`h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${entry.isComplete ? 'bg-ae-good' : entry.isBounty ? 'bg-ae-gold' : 'bg-ae-ether'}`} style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal!)}%` }} />
                    </div>
                  </div>
                </div>
                {entry.isComplete ? (
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton
                      data-testid="quest-board-toggle-expedition-focus"
                      data-focus-selected={isFocusedQuest(entry.id)}
                      title={isFocusedQuest(entry.id) ? '이번 원정에서 제외' : '이번 원정에 추가'}
                      disabled={!isFocusedQuest(entry.id) && focusLimitReached}
                      onClick={() => actions?.toggleExpeditionFocusQuest(entry.id)}
                      icon={<Target size={15} />}
                      label={isFocusedQuest(entry.id) ? '원정 제외' : '원정 추가'}
                      className="aether-disabled-action min-h-[44px] px-3 text-[13px]"
                    />
                    <ActionButton
                      data-testid="quest-board-claim-reward"
                      onClick={() => actions?.completeQuest(entry.id)}
                      icon={<Gift size={15} className="text-ae-good" />}
                      label="보상 받기"
                      className="min-h-[44px] px-3 text-[13px]"
                    />
                  </div>
                ) : confirmAbandonQuestId === entry.id ? (
                  <div data-testid="quest-board-abandon-warning" className="pt-3 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                    <div className="font-readable text-[12px] leading-[1.45] text-ae-threat">
                      {MSG.QUEST_ABANDON_PROGRESS_LOSS(getQuestProgressText(entry.quest, entry.progress))}
                      {entry.isBounty && ` ${MSG.BOUNTY_ABANDON_WARNING}`}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <ActionButton
                        variant="ghost"
                        data-testid="quest-board-abandon-cancel"
                        onClick={() => setConfirmAbandonQuestId(null)}
                        label="계속 진행"
                        className="min-h-[44px] px-3 text-[13px]"
                      />
                      <ActionButton
                        variant="danger"
                        data-testid="quest-board-abandon-confirm"
                        onClick={() => {
                          actions?.abandonQuest(entry.id);
                          setConfirmAbandonQuestId(null);
                        }}
                        label="포기 확정"
                        className="min-h-[44px] px-3 text-[13px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[44px] items-center justify-between gap-3 pt-3 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                    <ActionButton
                      data-testid="quest-board-toggle-expedition-focus"
                      data-focus-selected={isFocusedQuest(entry.id)}
                      title={isFocusedQuest(entry.id) ? '이번 원정에서 제외' : '이번 원정에 추가'}
                      disabled={!isFocusedQuest(entry.id) && focusLimitReached}
                      onClick={() => actions?.toggleExpeditionFocusQuest(entry.id)}
                      icon={<Target size={15} />}
                      label={isFocusedQuest(entry.id) ? '원정 제외' : '원정 추가'}
                      className="aether-disabled-action min-h-[44px] px-3 text-[13px]"
                    />
                    <ActionButton
                      variant="ghost"
                      data-testid="quest-board-abandon-mission"
                      onClick={() => setConfirmAbandonQuestId(entry.id)}
                      label="임무 포기"
                      className="min-h-[44px] px-3.5 text-[13px]"
                    />
                  </div>
                )}
              </div>
            </QuestRowShell>
          )) : (
            <div
              data-testid="quest-board-empty-active"
              className="flex min-h-[52px] items-center justify-between gap-3 py-1.5 font-readable shadow-[inset_0_-1px_0_var(--aether-hairline)]"
            >
              <div className="min-w-0">
                <h3 className="font-display text-[14px] font-bold text-ae-ink">이번 원정 임무</h3>
                <div className="aether-type-meta mt-0.5 text-ae-ink-2">아직 없음</div>
              </div>
              <Chip className="font-fira tabular-nums">0/{MAX_EXPEDITION_FOCUS_QUESTS}</Chip>
            </div>
          )}
        </section>

        <section data-testid="quest-board-bounty" className="space-y-2">
          <SectionHead
            title="현상수배"
            aside={<span className="shrink-0 font-readable text-[12px] text-ae-ink-2">레벨 <span className="font-fira tabular-nums text-ae-ink">{player.level}</span> 기준</span>}
          />
          <div className="ae-town-mission px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-readable text-[13px] font-semibold text-ae-gold-text">현상수배 게시판</div>
                <div className="aether-type-meta mt-0.5 font-readable text-ae-ink-2">{bountyHelperText}</div>
              </div>
              <ActionButton
                onClick={() => actions?.requestBounty()}
                disabled={!canRequestBounty}
                label={bountyButtonLabel}
                className="aether-disabled-action aether-type-body min-h-[44px] shrink-0 px-3 font-bold"
              />
            </div>
          </div>
        </section>

        {backlogQuestEntries.length > 0 && (
          <section data-testid="quest-board-backlog" className="space-y-3">
            <SectionHead title="다른 임무" aside={<span className="shrink-0 font-readable text-[12px] text-ae-ink-2">추천 목록 제외</span>} />
            {backlogQuestEntries.map((entry) => {
              const quest = entry.quest;
              const resonance = entry.resonance.label ? entry.resonance : getTraitQuestResonance(quest, traitProfile);
              return (
                <QuestRowShell key={`available_${quest.id}`} kind="available" testId="quest-decision-row" story={entry.lane === 'story'}>
                  <div className="flex flex-col gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-[15px] font-bold text-ae-ink">{quest.title}</div>
                        <Chip className="font-fira tabular-nums">레벨 {quest.minLv} 필요</Chip>
                        <LifetimeCounterChip quest={quest} />
                        {quest.buildTag && (
                          <Chip>{quest.buildLabel || quest.buildTag}</Chip>
                        )}
                        <Chip>{entry.meta.emphasis}</Chip>
                        {resonance.label && (
                          <Chip tone={getResonanceChipTone(resonance.score)}>{resonance.label}</Chip>
                        )}
                        {entry.targetMaps[0] && (
                          <Chip tone="ether">{entry.targetMaps[0]}</Chip>
                        )}
                      </div>
                      <div className="mt-1">
                        <QuestObjectiveLine>{getQuestObjectiveText(quest)}</QuestObjectiveLine>
                        <QuestObjectiveGateLine gate={getQuestObjectiveGateNotice(quest, player.level)} />
                      </div>
                      <div className="mt-2 font-readable text-[12px] leading-[1.42] text-ae-ink-2">{entry.reason}</div>
                      <OperationBriefRows brief={entry.brief} reward={quest.reward} player={player} />
                    </div>
                    <ActionButton
                      data-testid="quest-board-accept-mission"
                      onClick={() => actions?.acceptQuest(quest.id!)}
                      label="임무 수락"
                      className="min-h-[44px] w-full px-5 text-[13px]"
                    />
                  </div>
                </QuestRowShell>
              );
            })}
          </section>
        )}

        {remainingLockedQuestEntries.length > 0 && (
          <section data-testid="quest-board-locked" className="space-y-3">
            <SectionHead title="곧 열릴 임무" />
            {remainingLockedQuestEntries.map((quest) => (
              <div key={`locked_${quest.id}`} className="aether-locked-row rounded-ae-md px-3 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-display text-[15px] font-bold text-ae-ink-2">{quest.title}</div>
                      <LifetimeCounterChip quest={quest} />
                      <span className="aether-lock-note aether-type-meta rounded-full px-2 py-0.5 font-readable">잠금 · {quest.lockLabel}</span>
                    </div>
                    <div className="mt-1">
                      <QuestObjectiveLine>{getQuestObjectiveText(quest)}</QuestObjectiveLine>
                    </div>
                    <div className="aether-lock-note mt-2 px-2.5 py-1.5 font-readable text-[12px] leading-snug">
                      {quest.lockDetail}
                    </div>
                    <div className="aether-type-meta mt-2 font-readable text-ae-ink-2">
                      보상 · <span className="font-semibold text-ae-gold-text">{getRewardSummary(quest.reward, player)}</span>
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
