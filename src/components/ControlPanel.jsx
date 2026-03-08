import React, { useState } from 'react';
import {
  Sword,
  Zap,
  ArrowRight,
  Map as MapIcon,
  ShoppingBag,
  Moon,
  GraduationCap,
  ScrollText,
  Hammer,
  Ghost,
  X,
  RotateCw
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';
import { soundManager } from '../systems/SoundManager';
import { formatRewardParts, getActiveQuestEntries } from '../utils/gameUtils';

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
        <span key={`${accent}_${entry}`} className={`px-2 py-1 rounded border ${accentClass}`}>
          {entry}
        </span>
      ))}
    </div>
  );
};

const ControlPanel = ({ gameState, player, actions, setGameState, shopItems, grave, isAiThinking, currentEvent }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const getItemCount = (name) => player.inv.filter((item) => item.name === name).length;
  const activeQuestEntries = getActiveQuestEntries(player);
  const activeRegularQuestIds = new Set(activeQuestEntries.filter((entry) => !entry.isBounty).map((entry) => entry.id));
  const availableQuestEntries = DB.QUESTS
    .filter((quest) => !activeRegularQuestIds.has(quest.id) && player.level >= (quest.minLv || 1))
    .sort((a, b) => Math.abs((a.minLv || 1) - player.level) - Math.abs((b.minLv || 1) - player.level) || (a.minLv || 1) - (b.minLv || 1));
  const lockedQuestEntries = DB.QUESTS
    .filter((quest) => !activeRegularQuestIds.has(quest.id) && player.level < (quest.minLv || 1))
    .sort((a, b) => (a.minLv || 1) - (b.minLv || 1))
    .slice(0, 6);
  const claimableQuestCount = activeQuestEntries.filter((entry) => entry.isComplete).length;
  const today = new Date().toISOString().slice(0, 10);
  const hasActiveBounty = activeQuestEntries.some((entry) => entry.isBounty);
  const bountyIssuedToday = player?.stats?.bountyDate === today && player?.stats?.bountyIssued;
  const canRequestBounty = !hasActiveBounty && !bountyIssuedToday;
  const bountyButtonLabel = hasActiveBounty
    ? 'DAILY BOUNTY ACTIVE'
    : bountyIssuedToday
      ? 'BOUNTY CLAIMED TODAY'
      : 'REQUEST DAILY BOUNTY';
  const bountyHelperText = hasActiveBounty
    ? '진행 중인 현상수배를 완료해야 다음 수배를 받을 수 있습니다.'
    : bountyIssuedToday
      ? '오늘 현상수배는 이미 발급되었습니다. 다음 초기화 후 다시 수주하세요.'
      : '현재 레벨 기준 토벌 의뢰를 즉시 발급합니다.';

  if (gameState === 'combat') {
    return (
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mt-3 md:mt-4 relative z-10 w-full">
        {/* 스킬 상태 표시 바 */}
        <div className="text-xs text-cyber-blue/60 font-fira text-center uppercase tracking-widest bg-cyber-black/50 py-1.5 rounded border border-cyber-blue/10 backdrop-blur-sm">
          {selectedSkill ? (
            <span>
              Skill: <span className="text-cyber-purple font-bold drop-shadow-sm">{selectedSkill.name}</span> / MP {selectedSkill.mp || 0} / CD {skillCooldown}
            </span>
          ) : (
            <span className="text-slate-500">NO SKILL SELECTED</span>
          )}
        </div>

        {/* #11 모바일: 2행 레이아웃 (PC: 4열 가로) */}
        {/* 모바일에서 ATTACK / ESCAPE 는 위 행, SKILL / SWAP은 아래 행 */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => { soundManager.play('attack'); actions.combat('attack'); }}
            className="min-h-[72px] bg-red-900/20 hover:bg-red-900/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-500/50 p-4 rounded-lg text-red-400 font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <Sword className="group-hover:scale-110 transition-transform mb-1.5" size={24} />
            <span className="font-rajdhani tracking-wider text-base">ATTACK</span>
            <span className="text-[10px] text-red-500/50 font-fira mt-0.5">[1]</span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => actions.combat('escape')}
            className="min-h-[72px] bg-cyber-dark/60 hover:bg-cyber-green/20 border border-cyber-green/40 p-4 rounded-lg text-cyber-green/80 hover:text-cyber-green font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <ArrowRight className="group-hover:translate-x-2 transition-transform mb-1.5" size={24} />
            <span className="font-rajdhani tracking-wider text-base">ESCAPE</span>
            <span className="text-[10px] text-cyber-green/30 font-fira mt-0.5">[3]</span>
          </Motion.button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.combat('skill')}
            className="min-h-[56px] bg-cyber-blue/20 hover:bg-cyber-blue/40 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] border border-cyber-blue/50 p-3 rounded-lg text-cyber-blue font-bold flex flex-row items-center justify-center gap-2 disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <Zap className="group-hover:scale-110 transition-transform" size={18} />
            <span className="font-rajdhani tracking-wider">SKILL <span className="text-[10px] text-cyber-blue/40 font-fira">[2]</span></span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.cycleSkill(1)}
            className="min-h-[56px] bg-cyber-purple/20 hover:bg-cyber-purple/40 hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] border border-cyber-purple/50 p-3 rounded-lg text-cyber-purple font-bold flex flex-row items-center justify-center gap-2 disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <RotateCw className="group-hover:rotate-180 transition-transform duration-500" size={18} />
            <span className="font-rajdhani tracking-wider">SWAP SKILL</span>
          </Motion.button>
        </div>

        {/* PC: 기존 4열 가로 배치 */}
        <div className="hidden md:grid grid-cols-4 gap-3">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => { soundManager.play('attack'); actions.combat('attack'); }}
            className="min-h-[64px] bg-red-900/20 hover:bg-red-900/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-500/50 p-3 sm:p-4 rounded-sm text-red-400 font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <Sword className="group-hover:scale-110 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">ATTACK</span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.combat('skill')}
            className="min-h-[64px] bg-cyber-blue/20 hover:bg-cyber-blue/40 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] border border-cyber-blue/50 p-3 sm:p-4 rounded-sm text-cyber-blue font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <Zap className="group-hover:scale-110 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">SKILL</span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.cycleSkill(1)}
            className="min-h-[64px] bg-cyber-purple/20 hover:bg-cyber-purple/40 hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] border border-cyber-purple/50 p-3 sm:p-4 rounded-sm text-cyber-purple font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <RotateCw className="group-hover:rotate-180 transition-transform duration-500 mb-1" /> <span className="font-rajdhani tracking-wider">SWAP</span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => actions.combat('escape')}
            className="min-h-[64px] bg-cyber-dark/60 hover:bg-cyber-green/20 border border-cyber-green/40 p-3 sm:p-4 rounded-sm text-cyber-green/80 hover:text-cyber-green font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
          >
            <ArrowRight className="group-hover:translate-x-2 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">ESCAPE</span>
          </Motion.button>
        </div>
      </Motion.div>
    );
  }


  if (gameState === 'event' && isAiThinking) {
    return (
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-6 border border-cyber-purple/50 rounded-lg bg-cyber-black/80 text-center animate-pulse text-cyber-purple font-rajdhani tracking-widest shadow-neon-purple backdrop-blur-md z-10 relative">
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </Motion.div>
    );
  }

  if (gameState === 'event' && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} />;
  }

  if (gameState === 'shop') {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} />;
  }

  if (gameState === 'job_change') {
    const current = DB.CLASSES[player.job];
    const avail = current.next || [];
    return (
      <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-8 rounded-xl border border-cyber-purple/50 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(188,19,254,0.3)] backdrop-blur-2xl overflow-y-auto`}>
        <h2 className="text-2xl md:text-4xl text-cyber-purple font-bold mb-6 md:mb-10 font-rajdhani uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(188,19,254,0.6)]">Class Advancement</h2>
        <div className="flex gap-3 md:gap-6 flex-wrap justify-center w-full max-w-2xl">
          {avail.map((job) => (
            <Motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              key={job}
              onClick={() => actions.jobChange(job)}
              disabled={player.level < DB.CLASSES[job].reqLv}
              className="p-6 md:p-8 bg-cyber-dark/80 border border-cyber-purple/30 rounded-lg hover:bg-cyber-purple/10 hover:border-cyber-purple hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] disabled:opacity-30 disabled:hover:shadow-none transition-all w-40 md:w-56 group flex flex-col items-center"
            >
              <div className="text-xl md:text-2xl font-bold text-white group-hover:text-cyber-purple transition-colors font-rajdhani tracking-wider mb-2">{job}</div>
              <div className="text-xs text-cyber-blue font-fira bg-cyber-black/50 px-2 py-1 rounded">REQ: Lv.{DB.CLASSES[job].reqLv}</div>
            </Motion.button>
          ))}
          {avail.length === 0 && <div className="text-cyber-blue/50 font-rajdhani tracking-widest text-lg">MAXIMUM POTENTIAL REACHED</div>}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-12 text-cyber-blue/50 hover:text-cyber-blue font-fira text-sm uppercase tracking-widest hover:underline transition-all">
          [ ABORT SEQUENCE ]
        </button>
      </Motion.div>
    );
  }

  if (gameState === 'quest_board') {
    return (
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-6 rounded-lg border border-cyber-blue/50 flex flex-col shadow-[0_0_30px_rgba(0,204,255,0.2)] backdrop-blur-xl`}>
        <h2 className="text-2xl text-cyber-blue font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
          <ScrollText /> Mission Terminal
        </h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyber-blue/20 bg-cyber-dark/40 px-3 py-2 text-[11px] font-fira">
          <span className="text-cyber-blue/80">현재 레벨 Lv.{player.level}</span>
          <span className="text-cyber-green">진행 중 {activeQuestEntries.length}</span>
          <span className="text-cyber-purple">수락 가능 {availableQuestEntries.length}</span>
          <span className="text-amber-400">보상 대기 {claimableQuestCount}</span>
        </div>
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
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-cyber-green/20 pb-2">
              <div>
                <h3 className="text-sm font-bold text-cyber-green font-rajdhani tracking-[0.18em]">진행 중 임무</h3>
                <p className="text-[11px] text-cyber-green/50 font-fira mt-1">완료된 임무는 여기서 바로 보상을 수령할 수 있습니다.</p>
              </div>
            </div>
            {activeQuestEntries.length > 0 ? activeQuestEntries.map((entry) => (
              <div
                key={`active_${entry.id}`}
                className={`rounded-lg border p-4 ${entry.isComplete ? 'border-cyber-green/40 bg-cyber-green/10' : entry.isBounty ? 'border-amber-500/30 bg-amber-500/10' : 'border-cyber-blue/20 bg-cyber-dark/60'}`}
              >
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
                        <span className={`${entry.isComplete ? 'text-cyber-green' : 'text-cyber-blue/60'}`}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                        <span className="text-slate-500">{entry.progress}/{entry.quest.goal}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-cyber-black/60">
                        <div
                          className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-cyber-green' : entry.isBounty ? 'bg-amber-400' : 'bg-cyber-blue'}`}
                          style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {entry.isComplete ? (
                    <Motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => actions.completeQuest(entry.id)}
                      className="min-h-[44px] shrink-0 rounded-lg border border-cyber-green/40 bg-cyber-green px-5 py-3 text-xs font-bold text-cyber-black shadow-[0_0_15px_rgba(0,255,157,0.25)] transition-all hover:bg-emerald-400"
                    >
                      CLAIM REWARD
                    </Motion.button>
                  ) : (
                    <div className="shrink-0 rounded-lg border border-slate-700 bg-cyber-black/40 px-4 py-3 text-[11px] font-fira text-slate-400">
                      진행 중
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-cyber-green/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-cyber-green/40">
                ACTIVE QUESTS: NONE
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-cyber-blue/20 pb-2">
              <div>
                <h3 className="text-sm font-bold text-cyber-blue font-rajdhani tracking-[0.18em]">수락 가능 임무</h3>
                <p className="text-[11px] text-cyber-blue/50 font-fira mt-1">현재 레벨에서 바로 진행할 수 있는 임무만 모았습니다.</p>
              </div>
            </div>
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
                  <Motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => actions.acceptQuest(quest.id)}
                    className="min-h-[44px] shrink-0 rounded-lg border border-cyber-blue/40 bg-cyber-blue/10 px-5 py-3 text-xs font-bold text-cyber-blue transition-all hover:bg-cyber-blue/20 hover:shadow-[0_0_15px_rgba(0,204,255,0.2)]"
                  >
                    ACCEPT MISSION
                  </Motion.button>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-cyber-blue/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-cyber-blue/40">
                ACCEPTABLE QUESTS: NONE
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
              <div>
                <h3 className="text-sm font-bold text-purple-300 font-rajdhani tracking-[0.18em]">곧 열릴 임무</h3>
                <p className="text-[11px] text-purple-300/50 font-fira mt-1">다음 성장 구간에서 열리는 임무만 우선 보여줍니다.</p>
              </div>
            </div>
            {lockedQuestEntries.length > 0 ? lockedQuestEntries.map((quest) => (
              <div key={`locked_${quest.id}`} className="rounded-lg border border-purple-500/20 bg-slate-900/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-bold text-slate-200 font-rajdhani text-lg">{quest.title}</div>
                      <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-fira text-purple-300">
                        Lv.{quest.minLv} 필요
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 font-fira leading-relaxed">{quest.desc}</div>
                    <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(quest)}</div>
                    <RewardChips reward={quest.reward} accent="blue" />
                  </div>
                  <div className="shrink-0 rounded-lg border border-slate-700 bg-cyber-black/40 px-4 py-3 text-[11px] font-fira text-slate-400">
                    Lv.{quest.minLv - player.level} 더 필요
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-purple-500/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-purple-300/40">
                LOCKED QUESTS: NONE
              </div>
            )}
          </section>
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-cyber-blue/60 hover:text-cyber-blue py-4 rounded-sm border border-cyber-blue/20 hover:border-cyber-blue/50 font-rajdhani text-lg font-bold tracking-[0.2em] transition-all hover:bg-cyber-blue/5 min-h-[44px]">
          EXIT TERMINAL
        </button>
      </Motion.div>
    );
  }

  if (gameState === 'crafting') {
    const recipes = DB.ITEMS.recipes || [];
    return (
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-6 rounded-lg border border-orange-500/40 flex flex-col shadow-[0_0_30px_rgba(249,115,22,0.2)] backdrop-blur-xl`}>
        <h2 className="text-2xl text-orange-400 font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
          <Hammer /> Forge Matrix
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          {recipes.map((recipe) => {
            const hasGold = player.gold >= recipe.gold;
            const hasMaterials = recipe.inputs.every((input) => getItemCount(input.name) >= input.qty);
            const canCraft = hasGold && hasMaterials;
            return (
              <div key={recipe.id} className="bg-cyber-dark/60 p-4 rounded-md border border-orange-500/20 flex flex-col gap-3 hover:border-orange-500/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-white font-rajdhani text-lg">{recipe.name}</div>
                    <div className="text-xs text-orange-300/70 font-fira mt-1">비용: {recipe.gold}G</div>
                  </div>
                  <Motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => actions.craft(recipe.id)}
                    disabled={!canCraft}
                    className="px-5 py-3 bg-orange-500/10 border border-orange-500/50 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-orange-300 text-xs font-bold hover:bg-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.25)] transition-all whitespace-nowrap tracking-wider min-h-[44px]"
                  >
                    {canCraft ? 'CRAFT' : 'LOCKED'}
                  </Motion.button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-fira">
                  {recipe.inputs.map((input) => {
                    const owned = getItemCount(input.name);
                    const enough = owned >= input.qty;
                    return (
                      <span key={`${recipe.id}_${input.name}`} className={`px-2 py-1 rounded border ${enough ? 'border-cyber-green/30 text-cyber-green bg-cyber-green/10' : 'border-red-500/30 text-red-400 bg-red-950/20'}`}>
                        {input.name} {owned}/{input.qty}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-orange-300/70 hover:text-orange-300 py-4 rounded-sm border border-orange-500/20 hover:border-orange-500/50 font-rajdhani text-lg font-bold tracking-[0.2em] transition-all hover:bg-orange-500/5 min-h-[44px]">
          EXIT FORGE
        </button>
      </Motion.div>
    );
  }

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 md:mt-4 relative z-10 w-full">
      {gameState === 'moving' ? (
        <div className="flex flex-wrap gap-2 md:gap-3">
          {mapData.exits.map((exit) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={exit}
              disabled={isAiThinking}
              onClick={() => actions.move(exit)}
              className="flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4 bg-cyber-dark/80 border border-cyber-green/50 rounded-md text-cyber-green hover:bg-cyber-green/10 hover:shadow-[0_0_15px_rgba(0,255,157,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all backdrop-blur-md"
            >
              <MapIcon size={16} /> {exit}
            </Motion.button>
          ))}
          <Motion.button whileTap={{ scale: 0.95 }} onClick={() => setGameState('idle')} className="flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md hover:bg-red-900/40 font-bold tracking-wider transition-all">
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => { soundManager.play('click'); actions.explore(); }}
            className="min-h-[56px] bg-cyber-dark/60 hover:bg-cyber-blue/10 border border-cyber-blue/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(0,204,255,0.2)] hover:border-cyber-blue/50 transition-all group backdrop-blur-sm"
          >
            <MapIcon size={18} className="text-cyber-blue group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-cyber-blue/90">EXPLORE</span>
          </Motion.button>
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => setGameState('moving')}
            className="min-h-[56px] bg-cyber-dark/60 hover:bg-cyber-green/10 border border-cyber-green/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(0,255,157,0.2)] hover:border-cyber-green/50 transition-all group backdrop-blur-sm"
          >
            <ArrowRight size={18} className="text-cyber-green group-hover:translate-x-2 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-cyber-green/90">MOVE</span>
          </Motion.button>
          {mapData.type === 'safe' && (
            <>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => {
                  actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                  actions.setGameState('shop');
                }}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-yellow-900/20 border border-yellow-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:border-yellow-500/50 transition-all group backdrop-blur-sm"
              >
                <ShoppingBag size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-yellow-500/90">MARKET</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={actions.rest}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-emerald-900/20 border border-emerald-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:border-emerald-500/50 transition-all group backdrop-blur-sm"
              >
                <Moon size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-emerald-500/90">REST</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState('job_change')}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-purple-900/20 border border-purple-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:border-purple-500/50 transition-all group backdrop-blur-sm"
              >
                <GraduationCap size={18} className="text-purple-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-purple-500/90">CLASS</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState('quest_board')}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-indigo-900/20 border border-indigo-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:border-indigo-500/50 transition-all group backdrop-blur-sm"
              >
                <ScrollText size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-indigo-500/90">QUESTS</span>
              </Motion.button>

              {/* Omitted Crafting Panel to keep concise, but button remains */}
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState('crafting')}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-orange-900/20 border border-orange-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:border-orange-500/50 transition-all group backdrop-blur-sm"
              >
                <Hammer size={18} className="text-orange-500 group-hover:rotate-12 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-orange-500/90">CRAFT</span>
              </Motion.button>
            </>
          )}
          {grave && grave.loc === player.loc && (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={actions.lootGrave}
              className="min-h-[56px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-500/50 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(148,163,184,0.3)] transition-all group backdrop-blur-sm"
            >
              <Ghost size={18} className="text-slate-400 group-hover:animate-bounce" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-slate-300">RECOVER</span>
            </Motion.button>
          )}
          {!confirmReset ? (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={() => setConfirmReset(true)}
              className="min-h-[56px] sm:col-start-4 bg-red-950/20 hover:bg-red-900/40 border border-red-800/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:border-red-600/50 transition-all group backdrop-blur-sm"
            >
              <X size={18} className="text-red-500/70 group-hover:text-red-500 group-hover:scale-110 transition-all" />
              <span className="text-[10px] sm:text-xs font-rajdhani tracking-widest text-red-600/70 group-hover:text-red-500">FORMAT DRIVE</span>
            </Motion.button>
          ) : (
            <div className="sm:col-start-4 flex flex-col gap-1.5 min-h-[70px] justify-center">
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { actions.reset(); setConfirmReset(false); }}
                className="flex-1 bg-red-900/60 border border-red-500/70 rounded-sm text-red-300 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-red-700/60 transition-all py-1.5"
              >
                CONFIRM RESET
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setConfirmReset(false)}
                className="flex-1 bg-cyber-dark/60 border border-slate-600/50 rounded-sm text-slate-400 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-slate-700/40 transition-all py-1.5"
              >
                CANCEL
              </Motion.button>
            </div>
          )}
        </div>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
