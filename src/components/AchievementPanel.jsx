import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Trophy, Star, Skull, Swords, Crown, Gift } from 'lucide-react';
import { DB } from '../data/db';
import { formatRewardParts, getAchievementCurrentValue, isAchievementUnlocked } from '../utils/gameUtils';

/**
 * AchievementPanel — 업적 시스템 UI (Feature #10)
 * player.stats 기반 + 보상 수령 (claimAchievement)
 */

const THEME_BY_TARGET = {
    kills: { icon: Swords, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-950/20' },
    bossKills: { icon: Trophy, color: 'text-cyber-purple', border: 'border-cyber-purple/30', bg: 'bg-cyber-purple/5' },
    deaths: { icon: Skull, color: 'text-cyber-blue/60', border: 'border-cyber-blue/20', bg: 'bg-cyber-dark/20' },
    total_gold: { icon: Crown, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20' },
    level: { icon: Star, color: 'text-cyber-green', border: 'border-cyber-green/30', bg: 'bg-cyber-green/5' },
};

const getTheme = (achievement) => {
    const base = THEME_BY_TARGET[achievement?.target] || THEME_BY_TARGET.kills;
    if (achievement?.goal >= 100) {
        return { ...base, icon: Crown, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20' };
    }
    if (achievement?.goal >= 50) {
        return { ...base, icon: Skull, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-950/20' };
    }
    return base;
};

const AchievementPanel = ({ player, actions }) => {
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

    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    const handleClaim = (ach) => {
        if (ach.claimed) return;
        if (actions?.claimAchievement) {
            actions.claimAchievement(ach.id);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-cyber-blue/50 text-xs font-fira tracking-widest">
                    ▸ ACHIEVEMENTS
                </div>
                <div className="text-cyber-green text-xs font-fira">
                    {unlocked.length} / {achievements.length}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-cyber-dark/60 rounded-full overflow-hidden">
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(unlocked.length / Math.max(1, achievements.length)) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-cyber-green to-cyber-blue rounded-full"
                />
            </div>

            {/* Unlocked */}
            {unlocked.length > 0 && (
                <div className="space-y-2">
                    {unlocked.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <Motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`flex items-center gap-3 p-3 rounded border ${a.bg} ${a.border}`}
                            >
                                <Icon size={20} className={a.color} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-rajdhani font-bold ${a.color}`}>{a.title}</div>
                                    <div className="text-cyber-blue/40 text-xs font-fira">{a.desc}</div>
                                    <div className="text-[10px] text-cyber-blue/30 font-fira mt-1">{a.rewardText}</div>
                                </div>
                                {a.claimed ? (
                                    <span className="text-[10px] text-cyber-blue/30 font-fira px-2 py-0.5 border border-cyber-blue/10 rounded">수령 완료</span>
                                ) : (
                                    <Motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleClaim(a)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-cyber-green/20 hover:bg-cyber-green/30 text-cyber-green border border-cyber-green/40 rounded animate-pulse"
                                    >
                                        <Gift size={12} /> 수령
                                    </Motion.button>
                                )}
                            </Motion.div>
                        );
                    })}
                </div>
            )}

            {/* Locked */}
            {locked.length > 0 && (
                <div className="space-y-1.5 opacity-40">
                    <div className="text-cyber-blue/30 text-xs font-fira">잠긴 업적</div>
                    {locked.map((a) => {
                        const Icon = a.icon;
                        return (
                            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded border border-cyber-blue/10 bg-cyber-dark/10">
                                <Icon size={16} className="text-cyber-blue/20" />
                                <div>
                                    <div className="text-cyber-blue/30 text-sm font-rajdhani font-bold">{a.title}</div>
                                    <div className="text-cyber-blue/20 text-xs font-fira">{a.desc}</div>
                                    <div className="text-cyber-blue/20 text-[10px] font-fira mt-0.5">{Math.min(a.current, a.goal)}/{a.goal}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AchievementPanel;
