import React from 'react';
import { motion as Motion } from 'framer-motion';
import { ScrollText, X } from 'lucide-react';
import { formatRewardParts } from '../../utils/gameUtils';
import { getTraitQuestResonance } from '../../utils/runProfileUtils';
import { getQuestBoardRecommendations } from '../../utils/questOperations.js';
import SignalBadge from '../SignalBadge';

const getQuestObjectiveText = (quest) => {
  if (quest?.objective) return quest.objective;
  if (quest?.desc) return quest.desc;
  return quest?.target === 'Level'
    ? `레벨 ${quest.goal} 달성`
    : `${quest.target} ${quest.goal}회 달성`;
};

const getQuestProgressText = (quest, progress = 0) => (
  quest?.target === 'Level'
    ? `레벨 ${progress}/${quest.goal}`
    : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress = 0, goal = 1) => Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

const RewardChips = ({ reward, accent = 'blue' }) => {
  const rewards = formatRewardParts(reward);
  if (!rewards.length) return null;
  const accentClass = accent === 'green'
    ? 'border-cyber-green/30 bg-cyber-green/10 text-cyber-green'
    : accent === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-cyber-blue/20 bg-cyber-blue/10 text-cyber-blue';
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-fira">
      {rewards.map((entry) => (
        <span key={`${accent}_${entry}`} className={`px-2 py-1 rounded border ${accentClass}`}>{entry}</span>
      ))}
    </div>
  );
};

/**
 * QuestBoardPanel — 퀘스트 보드 패널 (진행 중 / 수락 가능 / 잠긴 임무)
 */
const QuestBoardPanel = ({ player, actions, setGameState, mobileFocused = false }) => {
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const {
    traitProfile,
    activeEntries: activeQuestEntries,
    featured: featuredOperations,
    backlog: backlogQuestEntries,
    locked: lockedQuestEntries,
  } = getQuestBoardRecommendations(player);
  const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;
  const availableQuestCount = featuredOperations.length + backlogQuestEntries.length;

  const today = new Date().toISOString().slice(0, 10);
  const hasActiveBounty = activeQuestEntries.some((e) => e.isBounty);
  const bountyIssuedToday = player?.stats?.bountyDate === today && player?.stats?.bountyIssued;
  const canRequestBounty = !hasActiveBounty && !bountyIssuedToday;
  const bountyButtonLabel = hasActiveBounty ? 'DAILY BOUNTY ACTIVE' : bountyIssuedToday ? 'BOUNTY CLAIMED TODAY' : 'REQUEST DAILY BOUNTY';
  const bountyHelperText = hasActiveBounty
    ? '진행 중인 현상수배를 완료해야 다음 수배를 받을 수 있습니다.'
    : bountyIssuedToday
      ? '오늘 현상수배는 이미 발급되었습니다.'
      : '현재 레벨 기준 토벌 의뢰를 즉시 발급합니다.';

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`${mobileFocused ? 'panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] p-4' : `${overlayPanelClass} panel-noise aether-surface-strong z-30 flex flex-col rounded-[1.95rem] p-4 md:p-6 overflow-hidden`}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-rajdhani font-bold uppercase tracking-[0.16em] text-[#f6e7c8]">
            <ScrollText /> Mission Terminal
          </h2>
          <div className="mt-1 text-[11px] font-fira text-slate-300/70">
            진행 중 임무, 현상수배, 다음 수락 후보를 한 번에 점검합니다.
          </div>
        </div>
        <button
          onClick={() => setGameState('idle')}
          className="min-h-[40px] rounded-full border border-white/8 bg-black/20 px-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-300/78 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label="미션 터미널 닫기"
        >
          <span className="flex items-center gap-1.5">
            <X size={12} />
            닫기
          </span>
        </button>
      </div>
      {/* 통계 헤더 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] aether-panel-core px-3 py-2.5 text-[11px] font-fira">
        <span className="text-slate-300">현재 레벨 Lv.{player.level}</span>
        <span className="text-[#dff7f5]">진행 중 {activeQuestEntries.length}</span>
        <span className="text-[#ece5ff]">수락 가능 {availableQuestCount}</span>
        <span className="text-[#f6e7c8]">보상 대기 {claimableQuestCount}</span>
      </div>
      {/* 현상수배 */}
      <div className="mb-4 rounded-[1.2rem] border border-[#d5b180]/18 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.16),transparent_24%),linear-gradient(180deg,rgba(41,29,14,0.26)_0%,rgba(18,13,8,0.12)_100%)] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-bold text-[#f6e7c8] font-rajdhani tracking-[0.16em]">현상수배 게시판</div>
            <div className="mt-1 text-[11px] text-slate-300/72 font-fira">{bountyHelperText}</div>
          </div>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => actions.requestBounty()}
            disabled={!canRequestBounty}
            className="min-h-[44px] shrink-0 rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 px-5 py-3 text-xs font-bold text-[#f6e7c8] transition-all hover:bg-[#d5b180]/16 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bountyButtonLabel}
          </Motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-2">
        {featuredOperations.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#7dd4d8]/18 pb-2">
              <h3 className="text-sm font-bold text-[#dff7f5] font-rajdhani tracking-[0.18em]">추천 오퍼레이션</h3>
              <span className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400">Run Composition</span>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {featuredOperations.map((entry, index) => (
                <div key={`featured_${entry.quest.id}`} className="rounded-[1.2rem] border border-[#7dd4d8]/16 bg-[radial-gradient(circle_at_top_right,rgba(125,212,216,0.14),transparent_24%),linear-gradient(180deg,rgba(12,19,29,0.96)_0%,rgba(7,12,18,0.92)_100%)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-[#7dd4d8]/70">
                        {entry.meta.label}
                      </div>
                      <div className="mt-1 text-lg font-rajdhani font-bold text-white">{entry.quest.title}</div>
                    </div>
                    <SignalBadge tone={index === 0 ? 'recommended' : 'resonance'} size="sm">
                      {entry.meta.emphasis}
                    </SignalBadge>
                  </div>
                  <div className="mt-2 text-[12px] font-fira leading-relaxed text-slate-300/86">
                    {entry.reason}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <SignalBadge tone="neutral" size="sm">Lv.{entry.quest.minLv || 1}</SignalBadge>
                    {entry.quest.buildTag && (
                      <SignalBadge tone="neutral" size="sm">{entry.quest.buildLabel || entry.quest.buildTag}</SignalBadge>
                    )}
                    {entry.resonance.label && (
                      <SignalBadge tone={entry.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{entry.resonance.label}</SignalBadge>
                    )}
                    {entry.targetMaps[0] && (
                      <SignalBadge tone="upgrade" size="sm">{entry.targetMaps[0]}</SignalBadge>
                    )}
                  </div>
                  <div className="mt-3 text-[11px] font-fira text-slate-400">
                    목표: {getQuestObjectiveText(entry.quest)}
                  </div>
                  <RewardChips reward={entry.quest.reward} accent="blue" />
                  <Motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => actions.acceptQuest(entry.quest.id)}
                    className="mt-4 min-h-[44px] w-full rounded-[1rem] border border-[#7dd4d8]/28 bg-[#7dd4d8]/10 px-4 py-3 text-xs font-bold text-[#dff7f5] transition-all hover:bg-[#7dd4d8]/16"
                  >
                    START OPERATION
                  </Motion.button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 진행 중 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-cyber-green/20 pb-2">
            <h3 className="text-sm font-bold text-cyber-green font-rajdhani tracking-[0.18em]">진행 중 임무</h3>
          </div>
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry) => (
            <div key={`active_${entry.id}`} className={`rounded-[1.2rem] border p-4 ${entry.isComplete ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10' : entry.isBounty ? 'border-[#d5b180]/22 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.14),transparent_24%),linear-gradient(180deg,rgba(41,29,14,0.22)_0%,rgba(18,13,8,0.1)_100%)]' : 'aether-panel-muted'}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`font-bold font-rajdhani text-lg ${entry.isComplete ? 'text-cyber-green' : 'text-white'}`}>{entry.quest.title}</div>
                    {entry.isBounty && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-fira text-amber-300">현상수배</span>}
                    {entry.isComplete && <span className="rounded border border-cyber-green/30 bg-cyber-green/10 px-2 py-0.5 text-[10px] font-fira text-cyber-green">보상 수령 가능</span>}
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
                  <div className="mt-2 text-[12px] text-slate-300 font-fira">{getQuestObjectiveText(entry.quest)}</div>
                  <RewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-fira">
                      <span className={entry.isComplete ? 'text-cyber-green' : 'text-cyber-blue/60'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                      <span className="text-slate-500">{entry.progress}/{entry.quest.goal}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cyber-black/60">
                      <div className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-cyber-green' : entry.isBounty ? 'bg-amber-400' : 'bg-cyber-blue'}`} style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }} />
                    </div>
                  </div>
                </div>
                {entry.isComplete ? (
                  <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className="min-h-[44px] shrink-0 rounded-lg border border-cyber-green/40 bg-cyber-green px-5 py-3 text-xs font-bold text-cyber-black shadow-[0_0_15px_rgba(0,255,157,0.25)] transition-all hover:bg-emerald-400">
                    CLAIM REWARD
                  </Motion.button>
                ) : (
                  <div className="shrink-0 rounded-lg border border-slate-700 bg-cyber-black/40 px-4 py-3 text-[11px] font-fira text-slate-400">진행 중</div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-cyber-green/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-cyber-green/40">ACTIVE QUESTS: NONE</div>
          )}
        </section>

        {/* 수락 가능 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-cyber-blue/20 pb-2">
            <h3 className="text-sm font-bold text-cyber-blue font-rajdhani tracking-[0.18em]">전체 백로그</h3>
            <span className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400">recommended set 제외</span>
          </div>
          {backlogQuestEntries.length > 0 ? backlogQuestEntries.map((entry) => {
            const quest = entry.quest;
            const resonance = entry.resonance.label ? entry.resonance : getTraitQuestResonance(quest, traitProfile);
            return (
            <div key={`available_${quest.id}`} className="rounded-[1.2rem] border border-white/8 aether-panel-muted p-4 transition-colors hover:border-[#7dd4d8]/18">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-white font-rajdhani text-lg">{quest.title}</div>
                    <span className="rounded border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-0.5 text-[10px] font-fira text-cyber-purple">Lv.{quest.minLv} 필요</span>
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
                  <div className="mt-2 text-[12px] text-slate-300 font-fira">{getQuestObjectiveText(quest)}</div>
                  <div className="mt-2 text-[11px] font-fira text-slate-400">{entry.reason}</div>
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
                <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.acceptQuest(quest.id)} className="min-h-[44px] shrink-0 rounded-lg border border-cyber-blue/40 bg-cyber-blue/10 px-5 py-3 text-xs font-bold text-cyber-blue transition-all hover:bg-cyber-blue/20">
                  ACCEPT MISSION
                </Motion.button>
              </div>
            </div>
          );
          }) : (
            <div className="rounded-lg border border-dashed border-cyber-blue/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-cyber-blue/40">ACCEPTABLE QUESTS: NONE</div>
          )}
        </section>

        {/* 잠긴 임무 */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-purple-300 font-rajdhani tracking-[0.18em] border-b border-purple-500/20 pb-2">곧 열릴 임무</h3>
          {lockedQuestEntries.length > 0 ? lockedQuestEntries.map((quest) => (
            <div key={`locked_${quest.id}`} className="rounded-[1.2rem] border border-white/8 aether-panel-muted p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-slate-200 font-rajdhani text-lg">{quest.title}</div>
                    <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-fira text-purple-300">Lv.{quest.minLv} 필요</span>
                  </div>
                  <div className="mt-2 text-[12px] text-slate-300 font-fira">{getQuestObjectiveText(quest)}</div>
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-purple-500/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-purple-300/40">LOCKED QUESTS: NONE</div>
          )}
        </section>
      </div>

    </Motion.div>
  );
};

export default QuestBoardPanel;
