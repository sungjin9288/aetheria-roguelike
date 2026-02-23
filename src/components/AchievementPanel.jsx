import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Trophy, Star, Skull, Swords, Crown, Gift } from 'lucide-react';

/**
 * AchievementPanel — 업적 시스템 UI (Feature #10)
 * player.stats 기반 + 보상 수령 (claimAchievement)
 */

const ACHIEVEMENTS = [
    {
        id: 'first_blood', dbId: null,
        title: '첫 번째 피', desc: '첫 전투 승리',
        icon: Swords, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-950/20',
        check: (stats) => (stats.kills || 0) >= 1,
        reward: { gold: 50 },
    },
    {
        id: 'kills_10', dbId: 'ach_kill_10',
        title: '인내의 전사', desc: '총 10마리 처치',
        icon: Swords, color: 'text-cyber-blue', border: 'border-cyber-blue/30', bg: 'bg-cyber-blue/5',
        check: (stats) => (stats.kills || 0) >= 10,
        reward: { gold: 200 },
    },
    {
        id: 'kills_50', dbId: null,
        title: '학살자', desc: '총 50마리 처치',
        icon: Skull, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-950/20',
        check: (stats) => (stats.kills || 0) >= 50,
        reward: { gold: 500 },
    },
    {
        id: 'kills_100', dbId: 'ach_kill_100',
        title: '전장의 신', desc: '총 100마리 처치',
        icon: Crown, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20',
        check: (stats) => (stats.kills || 0) >= 100,
        reward: { gold: 2000, item: '중급 체력 물약' },
    },
    {
        id: 'boss_first', dbId: null,
        title: '용사의 증명', desc: '보스 몬스터 첫 처치',
        icon: Trophy, color: 'text-cyber-purple', border: 'border-cyber-purple/30', bg: 'bg-cyber-purple/5',
        check: (stats) => (stats.bossKills || 0) >= 1,
        reward: { gold: 1000 },
    },
    {
        id: 'death_1', dbId: 'ach_die_1',
        title: '죽음을 맛보다', desc: '처음으로 사망',
        icon: Skull, color: 'text-cyber-blue/60', border: 'border-cyber-blue/20', bg: 'bg-cyber-dark/20',
        check: (stats) => (stats.deaths || 0) >= 1,
        reward: { gold: 100 },
    },
    {
        id: 'death_10', dbId: null,
        title: '불사조의 환생', desc: '10번 부활',
        icon: Star, color: 'text-cyber-green', border: 'border-cyber-green/30', bg: 'bg-cyber-green/5',
        check: (stats) => (stats.deaths || 0) >= 10,
        reward: { gold: 300 },
    },
    {
        id: 'gold_1000', dbId: 'ach_gold_1000',
        title: '신흥 부호', desc: '누적 골드 1000G 획득',
        icon: Star, color: 'text-yellow-300', border: 'border-yellow-400/20', bg: 'bg-yellow-950/10',
        check: (stats) => (stats.total_gold || 0) >= 1000,
        reward: { item: '하급 체력 물약' },
    },
    {
        id: 'gold_10000', dbId: 'ach_gold_10000',
        title: '갑부', desc: '누적 골드 10000G 획득',
        icon: Crown, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20',
        check: (stats) => (stats.total_gold || 0) >= 10000,
        reward: { item: '엘릭서' },
    },
    {
        id: 'lv_10', dbId: 'ach_lv_10',
        title: '성장의 기쁨', desc: '레벨 10 달성',
        icon: Star, color: 'text-cyber-green', border: 'border-cyber-green/30', bg: 'bg-cyber-green/5',
        check: (stats, player) => (player?.level || 0) >= 10,
        reward: { item: '강철 롱소드' },
    },
];

const AchievementPanel = ({ player, actions }) => {
    const achievements = useMemo(() => {
        const stats = player.stats || {};
        const claimed = stats.claimedAchievements || [];
        return ACHIEVEMENTS.map(a => ({
            ...a,
            unlocked: a.check(stats, player),
            claimed: claimed.includes(a.dbId || a.id),
        }));
    }, [player]);

    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    const handleClaim = (ach) => {
        if (ach.claimed) return;
        if (actions?.claimAchievement) {
            actions.claimAchievement(ach.dbId || ach.id);
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
                    animate={{ width: `${(unlocked.length / achievements.length) * 100}%` }}
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
