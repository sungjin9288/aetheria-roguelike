import { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Trophy, Star, Skull, Swords, Crown, Gift, Footprints, Shield, BookOpen, Compass, Hammer, Sparkles, Coins, RefreshCcw, Flame, Link2 } from 'lucide-react';
import { DB } from '../data/db';
import type { Player } from '../types/index.js';
import { formatRewardParts, getAchievementCurrentValue, isAchievementUnlocked } from '../utils/gameUtils';
import SignalBadge from './SignalBadge';

// cycle 473: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 / 요약 useMemo / className ternary
//   까지 일괄 정리 (cycle 472 paired).
interface AchievementPanelProps {
    player: Player;
    actions?: any;
}

const THEME_BY_TARGET: any = {
    kills: { icon: Swords, titleClass: 'text-rose-100', iconTone: 'text-rose-200', card: 'border-rose-300/18 bg-rose-400/10' },
    bossKills: { icon: Trophy, titleClass: 'text-[#e3dcff]', iconTone: 'text-[#e3dcff]', card: 'border-[#9a8ac0]/24 bg-[#9a8ac0]/10' },
    deaths: { icon: Skull, titleClass: 'text-slate-200', iconTone: 'text-slate-300', card: 'border-white/8 bg-white/[0.04]' },
    total_gold: { icon: Crown, titleClass: 'text-[#f6e7c8]', iconTone: 'text-[#f6e7c8]', card: 'border-[#d5b180]/22 bg-[#d5b180]/10' },
    level: { icon: Star, titleClass: 'text-[#dff7f5]', iconTone: 'text-[#dff7f5]', card: 'border-[#7dd4d8]/22 bg-[#7dd4d8]/10' },
    // cycle 79: 신규 target별 시각 톤. 기존엔 모두 kills(붉은) 폴백이라
    // escape/discoveries/relics 등이 공격적 분위기로 보였음.
    escapes:           { icon: Footprints, titleClass: 'text-sky-100', iconTone: 'text-sky-200', card: 'border-sky-300/22 bg-sky-400/10' },
    explores:          { icon: Compass, titleClass: 'text-teal-100', iconTone: 'text-teal-200', card: 'border-teal-300/22 bg-teal-400/10' },
    discoveries:       { icon: Compass, titleClass: 'text-emerald-100', iconTone: 'text-emerald-200', card: 'border-emerald-300/22 bg-emerald-400/10' },
    relicCount:        { icon: Sparkles, titleClass: 'text-violet-100', iconTone: 'text-violet-200', card: 'border-violet-300/22 bg-violet-400/10' },
    crafts:            { icon: Hammer, titleClass: 'text-orange-100', iconTone: 'text-orange-200', card: 'border-orange-300/22 bg-orange-400/10' },
    rests:             { icon: BookOpen, titleClass: 'text-slate-100', iconTone: 'text-slate-300', card: 'border-white/8 bg-white/[0.04]' },
    bountiesCompleted: { icon: Coins, titleClass: 'text-yellow-100', iconTone: 'text-yellow-200', card: 'border-yellow-300/22 bg-yellow-400/10' },
    // cycle 397: abyssFloor entry 제거 — DB.ACHIEVEMENTS의 6 abyss target은 모두 abyssRecord.
    //   getTheme[achievement.target] lookup은 'abyssFloor'로 hit 0건이라 unreachable.
    abyssRecord:       { icon: Shield, titleClass: 'text-fuchsia-100', iconTone: 'text-fuchsia-200', card: 'border-fuchsia-300/22 bg-fuchsia-400/10' },
    demonKingSlain:    { icon: Trophy, titleClass: 'text-amber-100', iconTone: 'text-amber-200', card: 'border-amber-300/24 bg-amber-400/10' },
    prestige:          { icon: RefreshCcw, titleClass: 'text-cyan-100', iconTone: 'text-cyan-200', card: 'border-cyan-300/22 bg-cyan-400/10' },
    signaturesDiscovered:    { icon: Sparkles, titleClass: 'text-amber-100', iconTone: 'text-amber-200', card: 'border-amber-300/24 bg-amber-400/10' },
    signatureSetsCompleted:  { icon: Trophy, titleClass: 'text-amber-100', iconTone: 'text-amber-200', card: 'border-amber-300/24 bg-amber-400/10' },
    synths:            { icon: Hammer, titleClass: 'text-orange-100', iconTone: 'text-orange-200', card: 'border-orange-300/22 bg-orange-400/10' },
    // cycle 105: cycle 95(maxKillStreak) / cycle 102(discoveryChains)에서 추가된 신규
    // achievement target에 짝을 이루는 테마. 각각 StatsPanel cycle 96(red Flame) /
    // cycle 104(indigo Link2) 톤과 일치.
    maxKillStreak:     { icon: Flame, titleClass: 'text-red-100', iconTone: 'text-red-200', card: 'border-red-300/22 bg-red-400/10' },
    discoveryChains:   { icon: Link2, titleClass: 'text-indigo-100', iconTone: 'text-indigo-200', card: 'border-indigo-300/22 bg-indigo-400/10' },
};

const getTheme = (achievement: any) => {
    const base = THEME_BY_TARGET[achievement?.target] || THEME_BY_TARGET.kills;
    if (achievement?.goal >= 100) {
        return { ...base, icon: Crown, titleClass: 'text-[#f6e7c8]', iconTone: 'text-[#f6e7c8]', card: 'border-[#d5b180]/22 bg-[#d5b180]/10' };
    }
    if (achievement?.goal >= 50) {
        return { ...base, icon: Skull, titleClass: 'text-orange-100', iconTone: 'text-orange-200', card: 'border-orange-300/20 bg-orange-400/10' };
    }
    return base;
};

// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const AchievementPanel = ({ player, actions }: AchievementPanelProps) => {
    const achievements = useMemo(() => {
        const claimed = player?.stats?.claimedAchievements || [];
        return (DB.ACHIEVEMENTS || []).map((achievement: any) => {
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

    const unlocked = achievements.filter((a: any) => a.unlocked);
    const locked = achievements.filter((a: any) => !a.unlocked);
    const claimableCount = unlocked.filter((a: any) => !a.claimed).length;
    const completionRatio = (unlocked.length / Math.max(1, achievements.length)) * 100;

    const handleClaim = (ach: any) => {
        if (ach.claimed) return;
        if (actions?.claimAchievement) actions.claimAchievement(ach.id);
    };

    return (
        <div data-testid="achievement-panel" className="space-y-3">
            <div className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-3.5">
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

            {unlocked.length > 0 && (
                <div className="space-y-2">
                    {unlocked.map((a: any, i: any) => {
                        const Icon = a.icon;
                        return (
                            <Motion.div
                                key={a.id}
                                data-testid={`achievement-card-${a.id}`}
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
                                            data-testid={`achievement-claim-${a.id}`}
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

            {locked.length > 0 && (
                <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                    <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                        Locked Records
                    </div>
                    <div className="mt-3 space-y-2">
                        {locked.map((a: any) => {
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
