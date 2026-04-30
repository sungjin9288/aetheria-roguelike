import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Trophy, Star, Skull, Swords, Crown, Gift } from 'lucide-react';
import { DB } from '../data/db';
import { formatRewardParts, getAchievementCurrentValue, isAchievementUnlocked } from '../utils/gameUtils';
import SignalBadge from './SignalBadge';

const THEME_BY_TARGET = {
    kills: { icon: Swords, titleClass: 'text-rose-100', iconTone: 'text-rose-200', card: 'border-rose-300/18 bg-rose-400/10' },
    bossKills: { icon: Trophy, titleClass: 'text-[#e3dcff]', iconTone: 'text-[#e3dcff]', card: 'border-[#9a8ac0]/24 bg-[#9a8ac0]/10' },
    deaths: { icon: Skull, titleClass: 'text-slate-200', iconTone: 'text-slate-300', card: 'border-white/8 bg-white/[0.04]' },
    total_gold: { icon: Crown, titleClass: 'text-[#f6e7c8]', iconTone: 'text-[#f6e7c8]', card: 'border-[#d5b180]/22 bg-[#d5b180]/10' },
    level: { icon: Star, titleClass: 'text-[#dff7f5]', iconTone: 'text-[#dff7f5]', card: 'border-[#7dd4d8]/22 bg-[#7dd4d8]/10' },
};

const getTheme = (achievement) => {
    const base = THEME_BY_TARGET[achievement?.target] || THEME_BY_TARGET.kills;
    if (achievement?.goal >= 100) {
        return { ...base, icon: Crown, titleClass: 'text-[#f6e7c8]', iconTone: 'text-[#f6e7c8]', card: 'border-[#d5b180]/22 bg-[#d5b180]/10' };
    }
    if (achievement?.goal >= 50) {
        return { ...base, icon: Skull, titleClass: 'text-orange-100', iconTone: 'text-orange-200', card: 'border-orange-300/20 bg-orange-400/10' };
    }
    return base;
};

const AchievementPanel = ({ player, actions, compact = false }) => {
    const [showAllAchievements, setShowAllAchievements] = useState(false);
    const achievements = useMemo(() => {
        const claimed = player?.stats?.claimedAchievements || [];
        return (DB.ACHIEVEMENTS || []).map((achievement) => {
            const current = getAchievementCurrentValue(achievement, player);
            return {
                ...achievement,
                ...getTheme(achievement),
                current,
                rewardText: formatRewardParts(achievement.reward || {}).join(' · '),
                unlocked: isAchievementUnlocked(achievement, player),
                claimed: claimed.includes(achievement.id),
            };
        });
    }, [player]);

    const unlocked = achievements.filter((a) => a.unlocked);
    const locked = achievements.filter((a) => !a.unlocked);
    const claimableCount = unlocked.filter((a) => !a.claimed).length;
    const completionRatio = (unlocked.length / Math.max(1, achievements.length)) * 100;
    const summaryAchievements = useMemo(() => {
        const rankedLocked = [...locked].sort((a, b) => (
            (b.current / Math.max(1, b.goal)) - (a.current / Math.max(1, a.goal)) || a.goal - b.goal
        ));
        return [
            ...unlocked.filter((entry) => !entry.claimed),
            ...rankedLocked,
            ...unlocked.filter((entry) => entry.claimed),
        ].slice(0, 3);
    }, [locked, unlocked]);
    const hiddenAchievementCount = Math.max(0, achievements.length - summaryAchievements.length);
    const showSummaryView = compact && !showAllAchievements;

    const handleClaim = (ach) => {
        if (ach.claimed) return;
        if (actions?.claimAchievement) actions.claimAchievement(ach.id);
    };

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className={`rounded-[1.2rem] border border-white/8 bg-black/18 ${compact ? 'px-3 py-3' : 'px-4 py-3.5'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            Achievement Ledger
                        </div>
                        <div className="mt-1 text-[1.05rem] font-rajdhani font-bold text-slate-100">
                            누적 기록과 보상
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SignalBadge tone="neutral" size="sm">{unlocked.length}/{achievements.length} unlocked</SignalBadge>
                        {claimableCount > 0 && <SignalBadge tone="upgrade" size="sm">수령 대기 {claimableCount}</SignalBadge>}
                        {compact && (hiddenAchievementCount > 0 || showAllAchievements) && (
                            <button
                                type="button"
                                onClick={() => setShowAllAchievements((prev) => !prev)}
                                className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/78 hover:bg-white/[0.04]"
                            >
                                {showAllAchievements ? '요약 보기' : '기록 더 보기'}
                            </button>
                        )}
                    </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <Motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionRatio}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(213,177,128,0.9)_0%,rgba(125,212,216,0.92)_100%)]"
                    />
                </div>
            </div>

            {showSummaryView ? (
                <div className="space-y-2">
                    {summaryAchievements.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <Motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className={`rounded-[1rem] border px-3 py-2 ${a.unlocked ? a.card : 'border-white/8 bg-black/16'}`}
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className="mt-0.5 rounded-full border border-white/8 bg-black/20 p-1.5">
                                        <Icon size={13} className={a.unlocked ? a.iconTone : 'text-slate-500'} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <div className={`text-[13px] font-rajdhani font-bold ${a.unlocked ? a.titleClass : 'text-slate-200/84'}`}>{a.title}</div>
                                            {a.unlocked
                                                ? <SignalBadge tone={a.claimed ? 'neutral' : 'upgrade'} size="sm">{a.claimed ? '완료' : '수령 가능'}</SignalBadge>
                                                : <SignalBadge tone="neutral" size="sm">{Math.min(a.current, a.goal)}/{a.goal}</SignalBadge>}
                                        </div>
                                        <div className="mt-1 text-[10px] font-fira text-slate-300/74 leading-snug">
                                            {a.unlocked ? (a.rewardText || a.desc) : a.desc}
                                        </div>
                                    </div>
                                    {a.unlocked && !a.claimed && (
                                        <Motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={() => handleClaim(a)}
                                            className="shrink-0 rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 px-2.5 py-1.5 text-[10px] font-rajdhani font-bold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/14"
                                        >
                                            수령
                                        </Motion.button>
                                    )}
                                </div>
                            </Motion.div>
                        );
                    })}
                    {locked.length > 0 && (
                        <div className="rounded-[0.95rem] border border-white/8 bg-black/16 px-3 py-2 text-[10px] font-fira text-slate-400/76">
                            잠금 기록 {locked.length}개는 `기록 더 보기`에서 확인합니다.
                        </div>
                    )}
                </div>
            ) : unlocked.length > 0 && (
                <div className="space-y-2">
                    {unlocked.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <Motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className={`rounded-[1.15rem] border px-3.5 py-3 ${a.card}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-full border border-white/8 bg-black/20 p-2">
                                        <Icon size={16} className={a.iconTone} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className={`text-[1rem] font-rajdhani font-bold ${a.titleClass}`}>{a.title}</div>
                                            {a.claimed
                                                ? <SignalBadge tone="neutral" size="sm">수령 완료</SignalBadge>
                                                : <SignalBadge tone="upgrade" size="sm">claim</SignalBadge>}
                                        </div>
                                        <div className="mt-1 text-[11px] font-fira text-slate-200/80">{a.desc}</div>
                                        <div className="mt-2 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-500">Reward</div>
                                        <div className="mt-1 text-[11px] font-fira text-slate-300/76">{a.rewardText}</div>
                                    </div>
                                    {a.claimed ? (
                                        <div className="shrink-0 rounded-full border border-white/8 bg-black/16 px-3 py-2 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400/70">
                                            Claimed
                                        </div>
                                    ) : (
                                        <Motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={() => handleClaim(a)}
                                            className="shrink-0 rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-2 text-[10px] font-rajdhani font-bold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/14"
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                <Gift size={12} />
                                                수령
                                            </span>
                                        </Motion.button>
                                    )}
                                </div>
                            </Motion.div>
                        );
                    })}
                </div>
            )}

            {!showSummaryView && locked.length > 0 && (
                <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                    <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                        Locked Records
                    </div>
                    <div className="mt-3 space-y-2">
                        {locked.map((a) => {
                            const Icon = a.icon;
                            return (
                                <div key={a.id} className="flex items-center gap-3 rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2.5 opacity-72">
                                    <div className="rounded-full border border-white/8 bg-black/18 p-2">
                                        <Icon size={14} className="text-slate-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-rajdhani font-bold text-slate-300">{a.title}</div>
                                        <div className="mt-0.5 text-[10px] font-fira text-slate-500">{a.desc}</div>
                                    </div>
                                    <div className="shrink-0 text-[10px] font-fira text-slate-400">
                                        {Math.min(a.current, a.goal)}/{a.goal}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AchievementPanel;
