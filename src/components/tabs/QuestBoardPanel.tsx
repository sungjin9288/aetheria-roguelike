import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronDown, ScrollText, Target } from 'lucide-react';
import { formatRewardParts } from '../../utils/gameUtils';
import { getTraitQuestResonance } from '../../utils/runProfileUtils';
import { getQuestBoardRecommendations } from '../../utils/questOperations.js';
import SignalBadge from '../SignalBadge';
import FocusPanelHeader from '../FocusPanelHeader';
import { getPreparedExpeditionFocusQuestIds, MAX_EXPEDITION_FOCUS_QUESTS } from '../../utils/expeditionMissionFocus.js';

const getQuestObjectiveText = (quest: any) => {
  if (quest?.objective) return quest.objective;
  if (quest?.desc) return quest.desc;
  return quest?.target === 'Level'
    ? `레벨 ${quest.goal} 달성`
    : `${quest.target} ${quest.goal}회 달성`;
};

// cycle 541: progress / goal defaults 제거 — QuestTab/QuestBoardPanel 양쪽
//   helper duplication. 호출자가 모두 명시 전달이라 default 도달 불가.
//   default 청소 메가 시리즈 36번째 cross-file 4-default batch.
const getQuestProgressText = (quest: any, progress: any) => (
  quest?.target === 'Level'
    ? `레벨 ${progress}/${quest.goal}`
    : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress: any, goal: any) => Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

// cycle 428: default accent 값 제거 — 4 호출자 모두 명시 전달이라 default 도달
//   불가. ternary fallback (green/amber/else) 분기는 그대로 활성.
// slice 20: inline 모드 추가 — 추천 임무 카드에서 레벨/성향/지역 칩과
//   보상 칩이 서로 다른 줄에 어색하게 흩어지던
//   문제. inline이면 부모 flex row에 칩만 합류한다.
const RewardChips = ({ reward, accent, inline = false }: any) => {
  const rewards = formatRewardParts(reward);
  if (!rewards.length) return null;
  const accentClass = accent === 'green'
    ? 'border-emerald-300/22 bg-emerald-300/8 text-emerald-100'
    : accent === 'amber'
      ? 'border-[#d5b180]/24 bg-[#d5b180]/8 text-[#f6e7c8]'
      : 'border-[#7dd4d8]/18 bg-[#7dd4d8]/8 text-[#dff7f5]';
  const chips = rewards.map((entry: any) => (
    <span key={`${accent}_${entry}`} className={`aether-type-meta rounded-full border px-2 py-1 font-readable ${accentClass}`}>{entry}</span>
  ));
  if (inline) return <>{chips}</>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips}
    </div>
  );
};

const OperationBriefRows = ({ brief }: any) => {
  if (!brief) return null;

  const rows = [
    { label: '목적지', value: brief.route },
    { label: '위험', value: `${brief.riskLabel} · ${brief.riskDetail}` },
    { label: '보상', value: brief.payoff },
    { label: '귀환 기준', value: brief.extraction },
  ];

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="aether-label">{brief.label}</div>
        <SignalBadge tone={brief.riskTone || 'neutral'} size="sm">{brief.riskLabel}</SignalBadge>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-[0.95rem] border border-white/8 bg-black/12">
        {rows.map((row: any) => (
          <div key={`${brief.route}_${row.label}`} className="aether-choice-cell px-2.5 py-2">
            <div className="aether-label">{row.label}</div>
            <div className="aether-type-body mt-0.5 break-words font-readable text-slate-200/90">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestObjectiveLine = ({ children }: any) => (
  <div className="aether-type-body font-readable text-slate-100/92">
    {children}
  </div>
);

const QuestRowShell = ({ children, kind, testId }: any) => (
  <div
    data-testid={testId}
    data-quest-row-kind={kind}
    className={`aether-choice-row rounded-[1.05rem] px-3 py-3 transition-colors hover:border-[#7dd4d8]/22 ${kind === 'reward' ? 'is-reward' : kind === 'bounty' ? 'is-bounty' : ''}`}
  >
    {children}
  </div>
);

const getRewardSummary = (reward: any) => formatRewardParts(reward).join(' · ') || '보상 확인';

const CompactMissionRow = ({ entry, index, expanded, onToggle, onAccept }: any) => (
  <QuestRowShell kind={entry.isLockedPreview ? 'locked-preview' : 'featured'} testId="quest-decision-row">
    <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
      <button
        type="button"
        data-testid="quest-board-detail-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
        className="min-h-[68px] min-w-0 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <SignalBadge tone={index === 0 ? 'recommended' : 'resonance'} size="sm">
            {entry.isLockedPreview ? '잠금' : index === 0 ? `최우선 · ${entry.meta.label}` : entry.meta.emphasis}
          </SignalBadge>
          <span className="aether-type-title min-w-0 font-readable font-semibold text-white">{entry.quest.title}</span>
          <ChevronDown
            size={13}
            className={`ml-auto shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="aether-type-body mt-1.5 font-readable text-slate-300/84">
          {getQuestObjectiveText(entry.quest)}
        </div>
        <div className="aether-type-meta mt-1.5 grid grid-cols-2 gap-1 font-readable">
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
        className="aether-cta-primary aether-type-body min-h-[68px] px-2 font-readable font-bold text-[#dff7f5] disabled:cursor-not-allowed disabled:opacity-55"
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
interface QuestBoardPanelProps {
    player: any;
    actions?: any;
    setGameState?: (state: string) => void;
    onOpenArchiveConsole?: any;
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
  const claimableQuestCount = activeQuestEntries.filter((e: any) => e.isComplete).length;
  const focusedQuestIds = getPreparedExpeditionFocusQuestIds(player);
  const isFocusedQuest = (questId: string | number) => focusedQuestIds.some((id) => String(id) === String(questId));
  const focusLimitReached = focusedQuestIds.length >= MAX_EXPEDITION_FOCUS_QUESTS;

  const today = new Date().toISOString().slice(0, 10);
  const hasActiveBounty = activeQuestEntries.some((e: any) => e.isBounty);
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
  const lockedPreviewOperations = lockedQuestEntries.map((quest: any) => ({
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
  const featuredDisplayOperations = [...featuredOperations, ...lockedPreviewOperations].slice(0, 3);
  const previewedLockedQuestIds = new Set(
    featuredDisplayOperations.filter((entry: any) => entry.isLockedPreview).map((entry: any) => entry.quest.id),
  );
  const selectedOperation = featuredDisplayOperations.find((entry: any) => entry.quest.id === selectedQuestId) || null;

  const acceptFeaturedMission = (questId: any) => {
    actions.acceptQuest(questId);
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
              {featuredDisplayOperations.map((entry: any, index: any) => (
                <CompactMissionRow
                  key={`featured_${entry.quest.id}`}
                  entry={entry}
                  index={index}
                  expanded={selectedQuestId === entry.quest.id}
                  onToggle={() => setSelectedQuestId(selectedQuestId === entry.quest.id ? null : entry.quest.id)}
                  onAccept={() => {
                    if (!entry.isLockedPreview) acceptFeaturedMission(entry.quest.id);
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
                <OperationBriefRows brief={selectedOperation.brief} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedOperation.resonance?.label && (
                    <SignalBadge tone={selectedOperation.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">
                      {selectedOperation.resonance.label}
                    </SignalBadge>
                  )}
                  <RewardChips reward={selectedOperation.quest.reward} accent="blue" inline />
                </div>
              </div>
            )}
          </section>
        )}

        {/* 진행 중 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <div>
              <h3 className="font-readable text-sm font-semibold text-emerald-100">이번 원정 임무</h3>
              <div className="aether-type-meta mt-0.5 font-readable text-slate-400">진행 중 임무는 유지되며 최대 3개를 추적</div>
            </div>
            <SignalBadge tone={focusLimitReached ? 'recommended' : 'neutral'} size="sm">
              {focusedQuestIds.length}/{MAX_EXPEDITION_FOCUS_QUESTS}
            </SignalBadge>
          </div>
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry: any) => (
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
                  <div className="mt-1">
                    <QuestObjectiveLine>{getQuestObjectiveText(entry.quest)}</QuestObjectiveLine>
                  </div>
                  <OperationBriefRows brief={entry.brief} />
                  <RewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                  <div className="mt-3">
                    <div className="aether-type-meta mb-1 flex items-center justify-between font-readable">
                      <span className={entry.isComplete ? 'text-emerald-100' : 'text-[#dff7f5]/74'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                      <span className="text-slate-400">{entry.progress}/{entry.quest.goal}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/36">
                      <div className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-emerald-300' : entry.isBounty ? 'bg-[#d5b180]' : 'bg-[#7dd4d8]'}`} style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }} />
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
                      onClick={() => actions.toggleExpeditionFocusQuest(entry.id)}
                      className="aether-disabled-action flex min-h-[44px] items-center justify-center gap-1.5 border border-[#7dd4d8]/24 bg-[#7dd4d8]/8 px-3 text-xs font-bold text-[#dff7f5]"
                    >
                      <Target size={13} />{isFocusedQuest(entry.id) ? '원정 제외' : '원정 추가'}
                    </Motion.button>
                    <Motion.button data-testid="quest-board-claim-reward" whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className="min-h-[44px] shrink-0 rounded-[0.9rem] border border-emerald-300/35 bg-emerald-300/16 px-4 py-3 text-xs font-bold text-emerald-100 transition-all hover:bg-emerald-300/22">
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
                          actions.abandonQuest(entry.id);
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
                      onClick={() => actions.toggleExpeditionFocusQuest(entry.id)}
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
            <div className="rounded-[1rem] border border-dashed border-emerald-300/18 bg-black/14 px-4 py-8 text-center font-readable text-sm text-emerald-100/55">진행 중인 임무가 없습니다.</div>
          )}
        </section>

        <section className="space-y-2">
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
                onClick={() => actions.requestBounty()}
                disabled={!canRequestBounty}
                className="aether-disabled-action aether-type-body min-h-[44px] shrink-0 border border-[#d5b180]/28 bg-[#d5b180]/12 px-3 py-2 font-bold text-[#f6e7c8] transition-all hover:bg-[#d5b180]/16"
              >
                {bountyButtonLabel}
              </Motion.button>
            </div>
          </div>
        </section>

        {/* 수락 가능 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <h3 className="font-readable text-sm font-semibold text-[#dff7f5]">다른 임무</h3>
            <span className="aether-label">추천 목록 제외</span>
          </div>
          {backlogQuestEntries.length > 0 ? backlogQuestEntries.map((entry: any) => {
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
                  <OperationBriefRows brief={entry.brief} />
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
                <Motion.button data-testid="quest-board-accept-mission" whileTap={{ scale: 0.95 }} onClick={() => actions.acceptQuest(quest.id)} className="aether-cta-primary min-h-[44px] shrink-0 rounded-[0.9rem] px-5 py-3 text-xs font-bold text-[#dff7f5]">
                  임무 수락
                </Motion.button>
              </div>
            </QuestRowShell>
          );
          }) : (
            <div className="rounded-[1rem] border border-dashed border-[#7dd4d8]/18 bg-black/14 px-4 py-8 text-center font-readable text-sm text-[#dff7f5]/55">지금 받을 수 있는 다른 임무가 없습니다.</div>
          )}
        </section>

        {/* 잠긴 임무 */}
        <section className="space-y-3">
          <h3 className="border-b border-white/8 pb-2 font-readable text-sm font-semibold text-[#ece5ff]">곧 열릴 임무</h3>
          {lockedQuestEntries.some((quest: any) => !previewedLockedQuestIds.has(quest.id)) ? lockedQuestEntries
            .filter((quest: any) => !previewedLockedQuestIds.has(quest.id))
            .map((quest: any) => (
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
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-[1rem] border border-dashed border-[#9a8ac0]/18 bg-black/14 px-4 py-8 text-center font-readable text-sm text-[#ece5ff]/55">앞으로 열릴 임무가 없습니다.</div>
          )}
        </section>
      </div>

    </Motion.div>
  );
};

export default QuestBoardPanel;
