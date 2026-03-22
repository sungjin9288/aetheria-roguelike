import React from 'react';
import { Scroll } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { formatRewardParts, getActiveQuestEntries } from '../../utils/gameUtils';
import { getTraitProfile, getTraitQuestResonance } from '../../utils/runProfileUtils';
import SignalBadge from '../SignalBadge';

// ── 유틸 ──────────────────────────────────────────────
const getQuestObjectiveText = (quest) => (
    quest?.objective
        ? quest.objective
        : (
    quest?.target === 'Level'
        ? `레벨 ${quest.goal} 달성`
        : `${quest.target} ${quest.goal}회 달성`
        )
);

const getQuestProgressText = (quest, progress = 0) => (
    quest?.target === 'Level'
        ? `레벨 ${progress}/${quest.goal}`
        : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress = 0, goal = 1) =>
    Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);
const MAX_COMPACT_QUESTS = 2;

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
const DAILY_TYPE_LABEL = { kills: '처치', explores: '탐험', goldSpend: '골드 소비' };

const getDailyRewardLabel = (reward) => {
    if (reward?.essence) return `에센스 +${reward.essence}`;
    if (reward?.item) return reward.item;
    if (reward?.relicShard) return '유물 파편 +1';
    return '';
};

const QuestTab = ({ player, actions, isInSafeZone, compact = false }) => {
    const traitProfile = getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp });
    const [showAllQuests, setShowAllQuests] = React.useState(false);
    const activeQuestEntries = getActiveQuestEntries(player).map((entry, index) => {
        const resonance = getTraitQuestResonance(entry.quest, traitProfile);
        const progressPercent = getQuestProgressPercent(entry.progress, entry.quest.goal);
        return {
            ...entry,
            resonance,
            progressPercent,
            originalIndex: index,
        };
    });
    const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;
    const dp = player.stats?.dailyProtocol;
    const today = new Date().toISOString().slice(0, 10);
    const isDpToday = dp?.date === today;
    const dpMissions = isDpToday ? (dp.missions || []) : [];
    const dpDoneCount = dpMissions.filter((m) => m.done).length;
    const nextDpMission = dpMissions.find((mission) => !mission.done) || dpMissions[0] || null;
    const visibleQuestEntries = (() => {
        if (!compact || showAllQuests || activeQuestEntries.length <= MAX_COMPACT_QUESTS) return activeQuestEntries;
        return [...activeQuestEntries]
            .sort((a, b) =>
                Number(b.isComplete) - Number(a.isComplete) ||
                Number(b.isBounty) - Number(a.isBounty) ||
                (b.resonance?.score || 0) - (a.resonance?.score || 0) ||
                b.progressPercent - a.progressPercent ||
                a.originalIndex - b.originalIndex
            )
            .slice(0, MAX_COMPACT_QUESTS);
    })();
    const hiddenQuestCount = Math.max(0, activeQuestEntries.length - visibleQuestEntries.length);
    const useQuestSummaryCards = compact && !showAllQuests && activeQuestEntries.length > MAX_COMPACT_QUESTS;

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 바 */}
            <div className={`${compact ? 'mb-2 p-2.5' : 'mb-3 p-3'} rounded-[1rem] border border-white/8 bg-black/18 shrink-0`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    <SignalBadge tone="neutral" size="sm">진행 {activeQuestEntries.length}</SignalBadge>
                    <SignalBadge tone={claimableQuestCount > 0 ? 'success' : 'neutral'} size="sm">보상 대기 {claimableQuestCount}</SignalBadge>
                    <SignalBadge tone={isInSafeZone ? 'upgrade' : 'warning'} size="sm">
                        {isInSafeZone ? '게시판 이용 가능' : '수락은 마을 전용'}
                    </SignalBadge>
                </div>
                <div className={`${compact ? 'mt-1.5 text-[10px]' : 'mt-2 text-[11px]'} text-slate-400/78 font-fira leading-snug`}>
                    {compact
                        ? '수락은 마을 전용, 여기서는 진행과 보상 수령만 확인합니다.'
                        : '새 퀘스트와 현상수배는 마을의 `QUESTS` 게시판에서만 수락할 수 있습니다. 이 탭에서는 진행 현황과 보상 수령만 확인합니다.'}
                </div>
            </div>

            {/* 퀘스트 목록 + Daily Protocol */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* Daily Protocol 섹션 */}
                {dpMissions.length > 0 && (
                    compact && !showAllQuests ? (
                        <div className="mb-2 rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[#e3dcff] text-[10px] font-fira tracking-widest uppercase">Daily Protocol</span>
                                    <span className={`text-[10px] font-fira px-1.5 py-0.5 rounded-full border ${dpDoneCount === dpMissions.length ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/8 bg-black/18 text-slate-300/72'}`}>
                                        {dpDoneCount}/{dpMissions.length}
                                    </span>
                                </div>
                                {dp?.relicShards > 0 && (
                                    <span className="text-[10px] font-fira text-[#f6e7c8] border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 rounded-full">
                                        ◆ {dp.relicShards}
                                    </span>
                                )}
                            </div>
                            {nextDpMission && (
                                <div className="mt-1.5 space-y-1 font-fira text-[10px] leading-snug">
                                    <div className="text-slate-200/84">
                                        다음 임무: {DAILY_TYPE_LABEL[nextDpMission.type] || nextDpMission.type} {nextDpMission.progress}/{nextDpMission.goal}
                                    </div>
                                    <div className="text-slate-500">
                                        보상 {getDailyRewardLabel(nextDpMission.reward) || '기록 갱신'}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`${compact ? 'mb-2 p-2.5' : 'mb-3 p-3'} rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8`}>
                            <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-2'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[#e3dcff] text-[10px] font-fira tracking-widest uppercase">Daily Protocol</span>
                                    <span className={`text-[10px] font-fira px-1.5 py-0.5 rounded-full border ${dpDoneCount === dpMissions.length ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/8 bg-black/18 text-slate-300/72'}`}>
                                        {dpDoneCount}/{dpMissions.length}
                                    </span>
                                </div>
                                {dp.relicShards > 0 && (
                                    <span className="text-[10px] font-fira text-[#f6e7c8] border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 rounded-full">
                                        ◆ 유물 파편 ×{dp.relicShards}
                                    </span>
                                )}
                            </div>
                            <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
                                {dpMissions.map((mission) => {
                                    const pct = Math.min(100, (mission.progress / Math.max(1, mission.goal)) * 100);
                                    const rewardLabel = getDailyRewardLabel(mission.reward);
                                    return (
                                        <Motion.div
                                            key={mission.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className={`rounded-[0.95rem] border transition-all ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${mission.done ? 'border-emerald-300/24 bg-emerald-300/[0.06]' : 'border-white/8 bg-black/18'}`}
                                        >
                                            <div className={`flex items-center justify-between ${compact ? 'mb-0.5' : 'mb-1'}`}>
                                                <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-fira ${mission.done ? 'text-emerald-100' : 'text-slate-200/84'}`}>
                                                    {DAILY_TYPE_LABEL[mission.type] || mission.type} {mission.progress}/{mission.goal}
                                                </span>
                                                <span className={`text-[10px] font-fira ${mission.done ? 'text-emerald-100 font-bold' : 'text-slate-500'}`}>
                                                    {mission.done ? '✓ ' : ''}{rewardLabel}
                                                </span>
                                            </div>
                                            <div className="h-1 overflow-hidden rounded-full bg-black/30">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${mission.done ? 'bg-emerald-300' : 'bg-[#9a8ac0]/70'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </Motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                )}
                {compact && (hiddenQuestCount > 0 || showAllQuests) && (
                    <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                        <span className="text-slate-500">{showAllQuests ? '전체 임무' : '우선 임무'}</span>
                        {hiddenQuestCount > 0 ? (
                            <button
                                type="button"
                                onClick={() => setShowAllQuests(true)}
                                className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                            >
                                +{hiddenQuestCount} 더 보기
                            </button>
                        ) : showAllQuests ? (
                            <button
                                type="button"
                                onClick={() => setShowAllQuests(false)}
                                className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                            >
                                요약 보기
                            </button>
                        ) : null}
                    </div>
                )}
                {activeQuestEntries.length > 0 ? (
                    visibleQuestEntries.map((entry, i) => (
                        <Motion.div
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            key={entry.id}
                            className={`${useQuestSummaryCards ? 'mb-1.5 p-2' : compact ? 'mb-1.5 p-2.5' : 'mb-2 p-3'} rounded-[1rem] border transition-all ${
                                entry.isComplete
                                    ? 'bg-emerald-300/[0.06] border-emerald-300/24 shadow-[0_0_10px_rgba(110,231,183,0.08)]'
                                    : entry.isBounty ? 'bg-[#d5b180]/10 border-[#d5b180]/18' : 'bg-black/18 border-white/8'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className={`font-bold font-rajdhani ${compact ? 'text-[13px]' : 'text-sm'} ${entry.isComplete ? 'text-emerald-100' : entry.isBounty ? 'text-[#f6e7c8]' : 'text-white/88'}`}>
                                            {entry.quest.title}
                                        </div>
                                        {entry.isBounty && <span className="rounded-full border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 text-[10px] font-fira text-[#f6e7c8]">현상수배</span>}
                                        {entry.quest.buildTag && (
                                            <SignalBadge tone="neutral" size="sm">{entry.quest.buildLabel || entry.quest.buildTag}</SignalBadge>
                                        )}
                                        {entry.resonance.label ? (
                                            <SignalBadge tone={entry.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{entry.resonance.label}</SignalBadge>
                                        ) : null}
                                    </div>
                                    {!useQuestSummaryCards && (
                                        <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} text-slate-400/72 leading-snug`}>{entry.quest.desc}</div>
                                    )}
                                    <div className={`${compact ? 'mt-1.5 text-[10px]' : 'mt-2 text-[11px]'} text-slate-300/86 font-fira`}>목표: {getQuestObjectiveText(entry.quest)}</div>
                                    {!useQuestSummaryCards && entry.resonance.summary ? (
                                        <div className={`${compact ? 'mt-1 text-[10px]' : 'mt-2 text-[11px]'} font-fira text-[#d9d0f3]/72`}>{entry.resonance.summary}</div>
                                    ) : null}
                                    {!useQuestSummaryCards && (
                                        <QuestRewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                                    )}
                                    <div className={useQuestSummaryCards ? 'mt-1.5' : compact ? 'mt-2' : 'mt-3'}>
                                        <div className="mb-1 flex justify-between text-[10px] font-fira">
                                            <span className={entry.isComplete ? 'text-emerald-100' : 'text-slate-300/74'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                                            <span className="text-slate-500">{entry.progress}/{entry.quest.goal}</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                                            <div
                                                className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-emerald-300' : entry.isBounty ? 'bg-[#d5b180]' : 'bg-[#7dd4d8]'}`}
                                                style={{ width: `${entry.progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {entry.isComplete ? (
                                    <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className={`bg-emerald-300/12 hover:bg-emerald-300/18 text-emerald-100 font-bold rounded-full border border-emerald-300/24 shrink-0 ${compact ? 'min-h-[32px] px-3 py-1 text-[10px]' : 'min-h-[40px] px-4 py-2 text-[11px]'}`}>
                                        수령
                                    </Motion.button>
                                ) : (
                                    <div className={`text-slate-400/72 font-fira bg-black/18 rounded-full border border-white/8 shrink-0 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}>진행 중</div>
                                )}
                            </div>
                        </Motion.div>
                    ))
                ) : (
                    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-[1rem] border border-white/8 bg-black/16 text-center flex flex-col items-center gap-2 ${compact ? 'py-8' : 'py-10'}`}>
                        <Scroll size={compact ? 20 : 24} className="opacity-20" />
                        <span className={`${compact ? 'text-[13px]' : 'text-sm'} font-rajdhani tracking-widest text-slate-400`}>NO ACTIVE MISSIONS</span>
                        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-500 font-fira`}>
                            {isInSafeZone ? '마을 게시판에서 새 임무를 수락할 수 있습니다.' : '마을로 이동하면 퀘스트 게시판을 이용할 수 있습니다.'}
                        </span>
                    </Motion.div>
                )}
            </div>
        </div>
    );
};

export default QuestTab;
