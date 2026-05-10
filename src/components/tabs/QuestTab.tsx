import React from 'react';
import { Scroll } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { formatRewardParts, getActiveQuestEntries } from '../../utils/gameUtils';
import { getTraitProfile, getTraitQuestResonance } from '../../utils/runProfileUtils';
import SignalBadge from '../SignalBadge';
import { BALANCE } from '../../data/constants';

// ── 유틸 ──────────────────────────────────────────────
const getQuestObjectiveText = (quest: any) => (
    quest?.objective
        ? quest.objective
        : (
    quest?.target === 'Level'
        ? `레벨 ${quest.goal} 달성`
        : `${quest.target} ${quest.goal}회 달성`
        )
);

// cycle 541: progress / goal defaults 제거 — QuestTab/QuestBoardPanel 양쪽
//   helper duplication. 호출자가 모두 명시 전달이라 default 도달 불가.
//   default 청소 메가 시리즈 36번째 cross-file 4-default batch.
const getQuestProgressText = (quest: any, progress: any) => (
    quest?.target === 'Level'
        ? `레벨 ${progress}/${quest.goal}`
        : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress: any, goal: any) =>
    Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

// cycle 313: export 제거 — QuestTab 내부 1회 사용만, 외부 import 0건.
// cycle 429: default accent 값 제거 — 호출자가 ternary로 명시 전달이라 default
//   도달 불가 (cycle 428 QuestBoardPanel RewardChips paired completion).
const QuestRewardChips = ({ reward, accent }: any) => {
    const rewards = formatRewardParts(reward);
    if (!rewards.length) return null;
    const accentClass = accent === 'green'
        ? 'border-cyber-green/30 bg-cyber-green/10 text-cyber-green'
        : accent === 'amber'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-cyber-blue/20 bg-cyber-blue/10 text-cyber-blue';
    return (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-fira">
            {rewards.map((entry: any) => (
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
const DAILY_TYPE_LABEL: any = { kills: '처치', explores: '탐험', goldSpend: '골드 소비' };

const getDailyRewardLabel = (reward: any) => {
    if (reward?.essence) return `에센스 +${reward.essence}`;
    if (reward?.item) return reward.item;
    if (reward?.relicShard) return '유물 파편 +1';
    return '';
};

// cycle 481: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 + 33 ternary + summary 분기 일괄 정리
//   (cycle 472-479 paired 9사이클 cascade의 마지막 panel).
interface QuestTabProps {
    player: any;
    actions?: any;
    isInSafeZone?: boolean;
}

const QuestTab = ({ player, actions, isInSafeZone }: QuestTabProps) => {
    const traitProfile = getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp });
    const activeQuestEntries = getActiveQuestEntries(player).map((entry: any, index: any) => {
        const resonance = getTraitQuestResonance(entry.quest, traitProfile);
        const progressPercent = getQuestProgressPercent(entry.progress, entry.quest.goal);
        return {
            ...entry,
            resonance,
            progressPercent,
            originalIndex: index,
        };
    });
    const claimableQuestCount = activeQuestEntries.filter((e: any) => e.isComplete).length;
    const dp = player.stats?.dailyProtocol;
    const today = new Date().toISOString().slice(0, 10);
    const isDpToday = dp?.date === today;
    const dpMissions = isDpToday ? (dp.missions || []) : [];
    const dpDoneCount = dpMissions.filter((m: any) => m.done).length;

    // Weekly Protocol
    const wp = player.weeklyProtocol || { kills: 0, explores: 0, bossKills: 0, claimed: [] };
    const weeklyMissions = BALANCE.WEEKLY_MISSIONS.map((m: any) => {
        const current = m.id === 'weeklyKills' ? (wp.kills || 0) : m.id === 'weeklyExplore' ? (wp.explores || 0) : (wp.bossKills || 0);
        return { ...m, current, done: current >= m.target, claimed: (wp.claimed || []).includes(m.id) };
    });

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 바 */}
            <div className="mb-3 p-3 rounded-[1rem] border border-white/8 bg-black/18 rounded-[1rem] shrink-0">
                <div className="flex flex-wrap items-center gap-1.5">
                    <SignalBadge tone="neutral" size="sm">진행 {activeQuestEntries.length}</SignalBadge>
                    <SignalBadge tone={claimableQuestCount > 0 ? 'success' : 'neutral'} size="sm">보상 대기 {claimableQuestCount}</SignalBadge>
                    <SignalBadge tone={isInSafeZone ? 'upgrade' : 'warning'} size="sm">
                        {isInSafeZone ? '게시판 이용 가능' : '수락은 마을 전용'}
                    </SignalBadge>
                </div>
                <div className="mt-2 text-sm text-slate-400/78 font-fira leading-snug">
                    새 퀘스트와 현상수배는 마을의 `QUESTS` 게시판에서만 수락할 수 있습니다. 이 탭에서는 진행 현황과 보상 수령만 확인합니다.
                </div>
            </div>

            {/* 퀘스트 목록 + Daily Protocol */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* Daily Protocol 섹션 */}
                {dpMissions.length > 0 && (
                    <div className="mb-3 p-3 rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[#e3dcff] text-xs font-fira tracking-widest uppercase">Daily Protocol</span>
                                <span className={`text-xs font-fira px-1.5 py-0.5 rounded-full border ${dpDoneCount === dpMissions.length ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/8 bg-black/18 text-slate-300/72'}`}>
                                    {dpDoneCount}/{dpMissions.length}
                                </span>
                            </div>
                            {dp.relicShards > 0 && (
                                <span className="text-xs font-fira text-[#f6e7c8] border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 rounded-full">
                                    ◆ 유물 파편 ×{dp.relicShards}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {dpMissions.map((mission: any) => {
                                const pct = Math.min(100, (mission.progress / Math.max(1, mission.goal)) * 100);
                                const rewardLabel = getDailyRewardLabel(mission.reward);
                                return (
                                    <Motion.div
                                        key={mission.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`rounded-[0.95rem] border transition-all px-3 py-2 ${mission.done ? 'border-emerald-300/24 bg-emerald-300/[0.06]' : 'border-white/8 bg-black/18'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-sm font-fira ${mission.done ? 'text-emerald-100' : 'text-slate-200/84'}`}>
                                                {DAILY_TYPE_LABEL[mission.type] || mission.type} {mission.progress}/{mission.goal}
                                            </span>
                                            <span className={`text-xs font-fira ${mission.done ? 'text-emerald-100 font-bold' : 'text-slate-500'}`}>
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
                )}
                {/* 발견 체인 섹션 */}
                {(() => {
                    const chains = BALANCE.DISCOVERY_CHAINS || [];
                    if (!chains.length) return null;
                    const visitedMaps = new Set(player.stats?.visitedMaps || []);
                    const completedChains = player.stats?.discoveryChains || [];
                    return (
                        <div className="rounded-[1rem] border border-[#7dd4d8]/18 bg-[radial-gradient(circle_at_top_right,rgba(125,212,216,0.12),transparent_24%),linear-gradient(180deg,rgba(14,33,37,0.18)_0%,rgba(8,15,18,0.08)_100%)] mb-3 px-3 py-2.5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[#dff7f5] text-xs font-fira tracking-widest uppercase">Discovery Chains</span>
                                <span className={`text-xs font-fira px-1.5 py-0.5 rounded-full border ${completedChains.length === chains.length ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 text-[#dff7f5]'}`}>
                                    {completedChains.length}/{chains.length}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {chains.map((chain: any) => {
                                    const done = completedChains.includes(chain.id);
                                    const visitedCount = chain.locations.filter((l: any) => visitedMaps.has(l)).length;
                                    const pct = Math.min(100, (visitedCount / chain.locations.length) * 100);
                                    return (
                                        <div key={chain.id} className={`rounded-[0.9rem] border px-2.5 py-1.5 ${done ? 'border-emerald-300/24 bg-emerald-300/[0.06]' : 'border-white/8 bg-black/18'}`}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className={`text-xs font-fira ${done ? 'text-emerald-100' : 'text-slate-200/84'}`}>
                                                    {chain.label}
                                                </span>
                                                {done ? (
                                                    <span className="text-[11px] font-fira text-emerald-100 border border-emerald-300/24 bg-emerald-300/8 px-1.5 py-0.5 rounded-full">✓ 완료</span>
                                                ) : (
                                                    <span className="text-[11px] font-fira text-slate-400/72">{visitedCount}/{chain.locations.length} 방문</span>
                                                )}
                                            </div>
                                            <div className="h-[2px] overflow-hidden rounded-full bg-black/30">
                                                <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-300' : 'bg-[#7dd4d8]/50'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Weekly Protocol 섹션 */}
                {weeklyMissions.length > 0 && (
                    <div className="rounded-[1rem] border border-[#d5b180]/20 bg-[#d5b180]/6 mb-3 px-3 py-2.5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[#f6e7c8] text-xs font-fira tracking-widest uppercase">Weekly Mission</span>
                            <span className={`text-xs font-fira px-1.5 py-0.5 rounded-full border ${weeklyMissions.every((m: any) => m.claimed) ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#d5b180]/22 bg-[#d5b180]/10 text-[#f6e7c8]'}`}>
                                {weeklyMissions.filter((m: any) => m.claimed).length}/{weeklyMissions.length}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {weeklyMissions.map((mission: any) => {
                                const pct = Math.min(100, (mission.current / Math.max(1, mission.target)) * 100);
                                return (
                                    <div
                                        key={mission.id}
                                        className={`rounded-[0.9rem] border px-2.5 py-1.5 transition-all ${mission.claimed ? 'border-emerald-300/24 bg-emerald-300/[0.06]' : mission.done ? 'border-[#d5b180]/28 bg-[#d5b180]/10' : 'border-white/8 bg-black/18'}`}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={`text-xs font-fira ${mission.claimed ? 'text-emerald-100' : mission.done ? 'text-[#f6e7c8]' : 'text-slate-300/82'}`}>
                                                {mission.label} ({mission.current}/{mission.target})
                                            </span>
                                            {mission.done && !mission.claimed ? (
                                                <button
                                                    onClick={() => actions.claimWeeklyMission?.(mission.id, mission.reward)}
                                                    className="text-[11px] font-fira font-bold text-[#f6e7c8] bg-[#d5b180]/18 border border-[#d5b180]/30 rounded-full px-2 py-0.5 hover:bg-[#d5b180]/28 transition-colors"
                                                >
                                                    수령
                                                </button>
                                            ) : (
                                                <span className={`text-[11px] font-fira ${mission.claimed ? 'text-emerald-100' : 'text-slate-500'}`}>
                                                    {mission.claimed ? '✓ 수령됨' : `+${mission.reward.gold}G${mission.reward.premiumCurrency ? ` +${mission.reward.premiumCurrency}💎` : ''}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-[2px] overflow-hidden rounded-full bg-black/30">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${mission.claimed ? 'bg-emerald-300' : mission.done ? 'bg-[#d5b180]/70' : 'bg-[#d5b180]/40'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeQuestEntries.length > 0 ? (
                    activeQuestEntries.map((entry: any, i: any) => (
                        <Motion.div
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            key={entry.id}
                            className={`mb-2 p-3 rounded-[1rem] border transition-all ${
                                entry.isComplete
                                    ? 'bg-emerald-300/[0.06] border-emerald-300/24 shadow-[0_0_10px_rgba(110,231,183,0.08)]'
                                    : entry.isBounty ? 'bg-[#d5b180]/10 border-[#d5b180]/18' : 'bg-black/18 border-white/8'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className={`font-bold font-rajdhani text-sm ${entry.isComplete ? 'text-emerald-100' : entry.isBounty ? 'text-[#f6e7c8]' : 'text-white/88'}`}>
                                            {entry.quest.title}
                                        </div>
                                        {entry.isBounty && <span className="rounded-full border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 text-xs font-fira text-[#f6e7c8]">현상수배</span>}
                                        {entry.quest.buildTag && (
                                            <SignalBadge tone="neutral" size="sm">{entry.quest.buildLabel || entry.quest.buildTag}</SignalBadge>
                                        )}
                                        {entry.resonance.label ? (
                                            <SignalBadge tone={entry.resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{entry.resonance.label}</SignalBadge>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400/72 leading-snug">{entry.quest.desc}</div>
                                    <div className="mt-2 text-sm text-slate-300/86 font-fira">목표: {getQuestObjectiveText(entry.quest)}</div>
                                    {entry.resonance.summary && (
                                        <div className="mt-2 text-sm font-fira text-[#d9d0f3]/72">{entry.resonance.summary}</div>
                                    )}
                                    <QuestRewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                                    <div className="mt-3">
                                        <div className="mb-1 flex justify-between text-xs font-fira">
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
                                    <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className="bg-emerald-300/12 hover:bg-emerald-300/18 text-emerald-100 font-bold rounded-full border border-emerald-300/24 shrink-0 min-h-[40px] px-4 py-2 text-sm">
                                        수령
                                    </Motion.button>
                                ) : (
                                    <div className="text-slate-400/72 font-fira bg-black/18 rounded-full border border-white/8 shrink-0 px-2.5 py-1 text-sm">진행 중</div>
                                )}
                            </div>
                        </Motion.div>
                    ))
                ) : (
                    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[1rem] border border-white/8 bg-black/16 text-center flex flex-col items-center gap-2 py-10">
                        <Scroll size={24} className="opacity-20" />
                        <span className="text-sm font-rajdhani tracking-widest text-slate-400">NO ACTIVE MISSIONS</span>
                        <span className="text-sm text-slate-500 font-fira">
                            {isInSafeZone ? '마을 게시판에서 새 임무를 수락할 수 있습니다.' : '마을로 이동하면 퀘스트 게시판을 이용할 수 있습니다.'}
                        </span>
                    </Motion.div>
                )}
            </div>
        </div>
    );
};

export default QuestTab;
