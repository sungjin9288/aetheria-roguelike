import React from 'react';
import { motion as Motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { DB } from '../../data/db';
import { formatRewardParts, getActiveQuestEntries } from '../../utils/gameUtils';

const getQuestObjectiveText = (quest) => (
  quest?.target === 'Level'
    ? `레벨 ${quest.goal} 달성`
    : `${quest.target} ${quest.goal}회 달성`
);

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
const QuestBoardPanel = ({ player, actions, setGameState }) => {
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const activeQuestEntries = getActiveQuestEntries(player);
  const activeRegularQuestIds = new Set(activeQuestEntries.filter((e) => !e.isBounty).map((e) => e.id));
  const availableQuestEntries = DB.QUESTS
    .filter((q) => !activeRegularQuestIds.has(q.id) && player.level >= (q.minLv || 1))
    .sort((a, b) => Math.abs((a.minLv || 1) - player.level) - Math.abs((b.minLv || 1) - player.level));
  const lockedQuestEntries = DB.QUESTS
    .filter((q) => !activeRegularQuestIds.has(q.id) && player.level < (q.minLv || 1))
    .sort((a, b) => (a.minLv || 1) - (b.minLv || 1))
    .slice(0, 6);
  const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;

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
      className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-6 rounded-lg border border-cyber-blue/50 flex flex-col shadow-[0_0_30px_rgba(0,204,255,0.2)] backdrop-blur-xl`}
    >
      <h2 className="text-2xl text-cyber-blue font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
        <ScrollText /> Mission Terminal
      </h2>
      {/* 통계 헤더 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyber-blue/20 bg-cyber-dark/40 px-3 py-2 text-[11px] font-fira">
        <span className="text-cyber-blue/80">현재 레벨 Lv.{player.level}</span>
        <span className="text-cyber-green">진행 중 {activeQuestEntries.length}</span>
        <span className="text-cyber-purple">수락 가능 {availableQuestEntries.length}</span>
        <span className="text-amber-400">보상 대기 {claimableQuestCount}</span>
      </div>
      {/* 현상수배 */}
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-bold text-amber-300 font-rajdhani tracking-[0.16em]">현상수배 게시판</div>
            <div className="mt-1 text-[11px] text-slate-400 font-fira">{bountyHelperText}</div>
          </div>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => actions.requestBounty()}
            disabled={!canRequestBounty}
            className="min-h-[44px] shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs font-bold text-amber-300 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bountyButtonLabel}
          </Motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-2">
        {/* 진행 중 임무 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-cyber-green/20 pb-2">
            <h3 className="text-sm font-bold text-cyber-green font-rajdhani tracking-[0.18em]">진행 중 임무</h3>
          </div>
          {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry) => (
            <div key={`active_${entry.id}`} className={`rounded-lg border p-4 ${entry.isComplete ? 'border-cyber-green/40 bg-cyber-green/10' : entry.isBounty ? 'border-amber-500/30 bg-amber-500/10' : 'border-cyber-blue/20 bg-cyber-dark/60'}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`font-bold font-rajdhani text-lg ${entry.isComplete ? 'text-cyber-green' : 'text-white'}`}>{entry.quest.title}</div>
                    {entry.isBounty && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-fira text-amber-300">현상수배</span>}
                    {entry.isComplete && <span className="rounded border border-cyber-green/30 bg-cyber-green/10 px-2 py-0.5 text-[10px] font-fira text-cyber-green">보상 수령 가능</span>}
                  </div>
                  <div className="mt-1 text-xs text-cyber-blue/60 font-fira leading-relaxed">{entry.quest.desc}</div>
                  <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(entry.quest)}</div>
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
          <h3 className="text-sm font-bold text-cyber-blue font-rajdhani tracking-[0.18em] border-b border-cyber-blue/20 pb-2">수락 가능 임무</h3>
          {availableQuestEntries.length > 0 ? availableQuestEntries.map((quest) => (
            <div key={`available_${quest.id}`} className="rounded-lg border border-cyber-blue/20 bg-cyber-dark/60 p-4 transition-colors hover:border-cyber-blue/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-white font-rajdhani text-lg">{quest.title}</div>
                    <span className="rounded border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-0.5 text-[10px] font-fira text-cyber-purple">Lv.{quest.minLv}+</span>
                  </div>
                  <div className="mt-1 text-xs text-cyber-blue/60 font-fira leading-relaxed">{quest.desc}</div>
                  <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(quest)}</div>
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
                <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.acceptQuest(quest.id)} className="min-h-[44px] shrink-0 rounded-lg border border-cyber-blue/40 bg-cyber-blue/10 px-5 py-3 text-xs font-bold text-cyber-blue transition-all hover:bg-cyber-blue/20">
                  ACCEPT MISSION
                </Motion.button>
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-cyber-blue/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-cyber-blue/40">ACCEPTABLE QUESTS: NONE</div>
          )}
        </section>

        {/* 잠긴 임무 */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-purple-300 font-rajdhani tracking-[0.18em] border-b border-purple-500/20 pb-2">곧 열릴 임무</h3>
          {lockedQuestEntries.length > 0 ? lockedQuestEntries.map((quest) => (
            <div key={`locked_${quest.id}`} className="rounded-lg border border-purple-500/20 bg-slate-900/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-slate-200 font-rajdhani text-lg">{quest.title}</div>
                    <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-fira text-purple-300">Lv.{quest.minLv} 필요</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 font-fira leading-relaxed">{quest.desc}</div>
                  <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(quest)}</div>
                  <RewardChips reward={quest.reward} accent="blue" />
                </div>
                <div className="shrink-0 rounded-lg border border-slate-700 bg-cyber-black/40 px-4 py-3 text-[11px] font-fira text-slate-400">Lv.{quest.minLv - player.level} 더 필요</div>
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-purple-500/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-purple-300/40">LOCKED QUESTS: NONE</div>
          )}
        </section>
      </div>

      <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-cyber-blue/60 hover:text-cyber-blue py-4 rounded-sm border border-cyber-blue/20 hover:border-cyber-blue/50 font-rajdhani text-lg font-bold tracking-[0.2em] transition-all hover:bg-cyber-blue/5 min-h-[44px]">
        EXIT TERMINAL
      </button>
    </Motion.div>
  );
};

export default QuestBoardPanel;
