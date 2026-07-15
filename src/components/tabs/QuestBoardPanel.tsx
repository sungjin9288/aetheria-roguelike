import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { formatRewardParts } from '../../utils/gameUtils';
import { getTraitQuestResonance } from '../../utils/runProfileUtils';
import { getQuestBoardRecommendations } from '../../utils/questOperations.js';
import SignalBadge from '../SignalBadge';
import FocusPanelHeader from '../FocusPanelHeader';

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
    <span key={`${accent}_${entry}`} className={`rounded-full border px-2 py-1 text-[10px] font-readable ${accentClass}`}>{entry}</span>
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
            <div className="aether-label text-[8px]">{row.label}</div>
            <div className="mt-0.5 break-words font-readable text-[11px] leading-snug text-slate-200/90">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestObjectiveLine = ({ children }: any) => (
  <div className="font-readable text-[13px] leading-[1.42] text-slate-100/92">
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
  const {
    traitProfile,
    activeEntries: activeQuestEntries,
    featured: featuredOperations,
    backlog: backlogQuestEntries,
    locked: lockedQuestEntries,
  } = getQuestBoardRecommendations(player);
  const claimableQuestCount = activeQuestEntries.filter((e: any) => e.isComplete).length;
  const availableQuestCount = featuredOperations.length + backlogQuestEntries.length;

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

  return (
    <Motion.div
      data-testid="quest-board-panel"
      initial={false} animate={{ opacity: 1, y: 0 }}
      className="aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <FocusPanelHeader
        eyebrow="마을 임무 게시판"
        title="임무 선택"
        titleClassName="flex items-center gap-2 text-[1.15rem] leading-none"
        meta="진행 중 임무, 현상수배, 다음 수락 후보를 한 번에 점검합니다."
        onBack={() => setGameState?.('idle')}
        backLabel="복귀"
        backTestId="quest-board-close"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="quest-board-open-archive"
        rightSlot={<ScrollText size={18} className="text-[#f6e7c8]/78" />}
      />
      {/* 통계 헤더 */}
      <div className="mb-3 grid grid-cols-4 overflow-hidden rounded-[1rem] border border-white/8 bg-black/14 text-center">
        <span className="px-2 py-2 font-readable text-[11px] text-slate-200">레벨 {player.level}</span>
        <span className="border-l border-white/8 px-2 py-2 font-readable text-[11px] text-[#dff7f5]">진행 {activeQuestEntries.length}</span>
        <span className="border-l border-white/8 px-2 py-2 font-readable text-[11px] text-[#ece5ff]">수락 {availableQuestCount}</span>
        <span className="border-l border-white/8 px-2 py-2 font-readable text-[11px] text-[#f6e7c8]">보상 {claimableQuestCount}</span>
      </div>
      {/* 현상수배 */}
      <div className="aether-choice-row is-bounty mb-3 rounded-[1.05rem] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-readable text-sm font-semibold text-[#f6e7c8]">현상수배 게시판</div>
            <div className="mt-1 font-readable text-[12px] leading-[1.42] text-slate-200/78">{bountyHelperText}</div>
          </div>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => actions.requestBounty()}
            disabled={!canRequestBounty}
            className="aether-disabled-action min-h-[44px] shrink-0 rounded-[0.85rem] border border-[#d5b180]/28 bg-[#d5b180]/12 px-3 py-2 text-[11px] font-bold text-[#f6e7c8] transition-all hover:bg-[#d5b180]/16"
          >
            {bountyButtonLabel}
          </Motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
        {featuredOperations.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/8 pb-2">
              <h3 className="font-readable text-sm font-semibold text-[#dff7f5]">추천 임무</h3>
              <span className="aether-label">현재 성장 방향</span>
            </div>
            <div className="grid gap-3">
              {featuredOperations.map((entry: any, index: any) => (
                <QuestRowShell key={`featured_${entry.quest.id}`} kind="featured" testId="quest-decision-row">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="aether-label text-[#7dd4d8]/72">
                        {entry.meta.label}
                      </div>
                      <div className="mt-0.5 truncate font-readable text-base font-semibold text-white">{entry.quest.title}</div>
                      <QuestObjectiveLine>{getQuestObjectiveText(entry.quest)}</QuestObjectiveLine>
                    </div>
                    <SignalBadge tone={index === 0 ? 'recommended' : 'resonance'} size="sm">
                      {entry.meta.emphasis}
                    </SignalBadge>
                  </div>
                  <div className="mt-2 line-clamp-2 font-readable text-[12px] leading-[1.45] text-slate-300/86">
                    {entry.reason}
                  </div>
                  <OperationBriefRows brief={entry.brief} />
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <SignalBadge tone="neutral" size="sm">레벨 {entry.quest.minLv || 1}</SignalBadge>
                    {entry.quest.buildTag && (
                      <SignalBadge tone="neutral" size="sm">{entry.quest.buildLabel || entry.quest.buildTag}</SignalBadge>
                    )}
                    {entry.resonance.label && (
                      <SignalBadge tone={entry.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{entry.resonance.label}</SignalBadge>
                    )}
                    {entry.targetMaps[0] && (
                      <SignalBadge tone="upgrade" size="sm">{entry.targetMaps[0]}</SignalBadge>
                    )}
                    <RewardChips reward={entry.quest.reward} accent="blue" inline />
                  </div>
                  <Motion.button
                    data-testid="quest-board-start-operation"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => actions.acceptQuest(entry.quest.id)}
                    className="aether-cta-primary mt-3 min-h-[44px] w-full rounded-[0.9rem] px-4 py-3 text-xs font-bold text-[#dff7f5]"
                  >
                    임무 수락
                  </Motion.button>
                </QuestRowShell>
              ))}
            </div>
          </section>
        )}

        {/* 진행 중 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <h3 className="font-readable text-sm font-semibold text-emerald-100">진행 중 임무</h3>
          </div>
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry: any) => (
            <QuestRowShell key={`active_${entry.id}`} kind={entry.isComplete ? 'reward' : entry.isBounty ? 'bounty' : 'active'} testId="quest-active-row">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`font-readable text-base font-semibold ${entry.isComplete ? 'text-emerald-100' : 'text-white'}`}>{entry.quest.title}</div>
                    {entry.isBounty && <span className="rounded-full border border-[#d5b180]/28 bg-[#d5b180]/10 px-2 py-0.5 text-[10px] font-readable text-[#f6e7c8]">현상수배</span>}
                    {entry.isComplete && <span className="rounded-full border border-emerald-300/24 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-readable text-emerald-100">보상 수령 가능</span>}
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
                    <div className="mb-1 flex items-center justify-between font-readable text-[10px]">
                      <span className={entry.isComplete ? 'text-emerald-100' : 'text-[#dff7f5]/74'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                      <span className="text-slate-400">{entry.progress}/{entry.quest.goal}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/36">
                      <div className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-emerald-300' : entry.isBounty ? 'bg-[#d5b180]' : 'bg-[#7dd4d8]'}`} style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }} />
                    </div>
                  </div>
                </div>
                {entry.isComplete ? (
                  <Motion.button data-testid="quest-board-claim-reward" whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className="min-h-[44px] shrink-0 rounded-[0.9rem] border border-emerald-300/35 bg-emerald-300/16 px-5 py-3 text-xs font-bold text-emerald-100 transition-all hover:bg-emerald-300/22">
                    보상 받기
                  </Motion.button>
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
                    <div className="font-readable text-[11px] text-slate-300">진행 중</div>
                    <Motion.button
                      data-testid="quest-board-abandon-mission"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setConfirmAbandonQuestId(entry.id)}
                      className="min-h-[44px] rounded-[0.85rem] border border-rose-300/20 bg-rose-300/8 px-4 py-2 text-xs font-bold text-rose-100/88"
                    >
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
                    <span className="rounded-full border border-[#9a8ac0]/22 bg-[#9a8ac0]/10 px-2 py-0.5 text-[10px] font-readable text-[#ece5ff]">레벨 {quest.minLv} 필요</span>
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
          {lockedQuestEntries.length > 0 ? lockedQuestEntries.map((quest: any) => (
            <div key={`locked_${quest.id}`} className="aether-locked-row rounded-[1.05rem] px-3 py-3">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-readable text-base font-semibold text-slate-100">{quest.title}</div>
                    <span className="aether-lock-note rounded-full px-2 py-0.5 text-[10px] font-readable">잠금 · {quest.lockLabel}</span>
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
