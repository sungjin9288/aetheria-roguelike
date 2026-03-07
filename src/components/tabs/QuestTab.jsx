import React from 'react';
import { Sword, Scroll } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../../data/db';
import { formatRewardParts, getActiveQuestEntries } from '../../utils/gameUtils';

// ── 유틸 ──────────────────────────────────────────────
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

const getQuestProgressPercent = (progress = 0, goal = 1) =>
    Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

export const QuestRewardChips = ({ reward, accent = 'blue' }) => {
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
                <span key={`${accent}_${entry}`} className={`rounded border px-2 py-1 ${accentClass}`}>{entry}</span>
            ))}
        </div>
    );
};

// ── 컴포넌트 ──────────────────────────────────────────
/**
 * QuestTab — Dashboard의 quest 탭 콘텐츠 (#4 분리)
 * props: player, actions, isInSafeZone
 */
const QuestTab = ({ player, actions, isInSafeZone }) => {
    const today = new Date().toISOString().slice(0, 10);
    const activeQuestEntries = getActiveQuestEntries(player);
    const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;
    const hasActiveBounty = activeQuestEntries.some((e) => e.isBounty);
    const bountyIssuedToday = player?.stats?.bountyDate === today && player?.stats?.bountyIssued;
    const canRequestBounty = !hasActiveBounty && !bountyIssuedToday;

    const bountyButtonLabel = hasActiveBounty
        ? 'DAILY BOUNTY ACTIVE'
        : bountyIssuedToday ? 'BOUNTY CLAIMED TODAY' : 'REQUEST DAILY BOUNTY';

    const bountyHelperText = hasActiveBounty
        ? '진행 중인 현상수배를 완료하면 다음 의뢰를 받을 수 있습니다.'
        : bountyIssuedToday
            ? '오늘은 이미 현상수배를 발급했습니다. 내일 다시 요청하세요.'
            : '현재 레벨 기준 토벌 의뢰를 자동 생성합니다.';

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 바 */}
            <div className="mb-3 rounded-lg border border-cyber-blue/20 bg-cyber-dark/30 p-3 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-fira">
                    <span className="text-cyber-blue/80">진행 중 {activeQuestEntries.length}</span>
                    <span className="text-cyber-green">보상 대기 {claimableQuestCount}</span>
                    <span className="text-cyber-purple">{isInSafeZone ? '안전 지대' : '필드 지역'}</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => actions.requestBounty()}
                        disabled={!canRequestBounty}
                        className="min-h-[44px] w-full rounded border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-rajdhani font-bold text-amber-400 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                        <Sword size={14} /> {bountyButtonLabel}
                    </Motion.button>
                    <Motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => actions.setGameState?.('quest_board')}
                        disabled={!isInSafeZone}
                        className="min-h-[44px] w-full rounded border border-cyber-blue/30 bg-cyber-blue/10 py-2 text-xs font-rajdhani font-bold text-cyber-blue transition-all hover:bg-cyber-blue/20 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                        <Scroll size={14} /> {isInSafeZone ? 'OPEN QUEST BOARD' : 'SAFE ZONE ONLY'}
                    </Motion.button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 font-fira">{bountyHelperText}</div>
            </div>

            {/* 퀘스트 목록 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {activeQuestEntries.length > 0 ? (
                    activeQuestEntries.map((entry, i) => (
                        <Motion.div
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            key={entry.id}
                            className={`p-3 rounded-sm border mb-2 transition-all ${
                                entry.isComplete
                                    ? 'bg-cyber-green/10 border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,157,0.1)]'
                                    : entry.isBounty ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyber-dark/40 border-cyber-blue/10'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className={`font-bold text-sm font-rajdhani ${entry.isComplete ? 'text-cyber-green' : entry.isBounty ? 'text-amber-300' : 'text-cyber-blue'}`}>
                                            {entry.quest.title}
                                        </div>
                                        {entry.isBounty && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-fira text-amber-300">현상수배</span>}
                                    </div>
                                    <div className="text-xs text-cyber-blue/50 mt-1">{entry.quest.desc}</div>
                                    <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(entry.quest)}</div>
                                    <QuestRewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                                    <div className="mt-3">
                                        <div className="mb-1 flex justify-between text-[10px] font-fira">
                                            <span className={entry.isComplete ? 'text-cyber-green' : 'text-cyber-blue/60'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                                            <span className="text-slate-500">{entry.progress}/{entry.quest.goal}</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-cyber-black/50">
                                            <div
                                                className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-cyber-green' : entry.isBounty ? 'bg-amber-400' : 'bg-cyber-blue'}`}
                                                style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {entry.isComplete ? (
                                    <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className="px-4 py-2 bg-cyber-green hover:bg-emerald-400 text-cyber-black font-bold text-xs rounded-sm animate-pulse shadow-neon-green min-h-[44px] shrink-0">
                                        CLAIM REWARD
                                    </Motion.button>
                                ) : (
                                    <div className="text-xs text-cyber-blue/50 font-fira bg-cyber-black/50 px-2 py-1 rounded border border-cyber-blue/10 shrink-0">진행 중</div>
                                )}
                            </div>
                        </Motion.div>
                    ))
                ) : (
                    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyber-blue/30 text-center py-10 flex flex-col items-center gap-2">
                        <Scroll size={24} className="opacity-20" />
                        <span className="text-sm font-rajdhani tracking-widest">NO ACTIVE MISSIONS</span>
                        <span className="text-[11px] text-cyber-blue/40 font-fira">
                            {isInSafeZone ? 'QUEST BOARD를 열어 새 임무를 수락하세요.' : '안전 지대로 이동하면 퀘스트를 수락할 수 있습니다.'}
                        </span>
                    </Motion.div>
                )}
            </div>
        </div>
    );
};

export default QuestTab;
