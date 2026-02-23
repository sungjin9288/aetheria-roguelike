import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { BarChart3, Sword, Skull, Clock, Coins, Target, Shield } from 'lucide-react';

/**
 * StatsPanel — 플레이 통계 대시보드
 * player.stats 기반 킬/사망/골드/보스 통계 + 직업별 킬 분포
 */
const StatsPanel = ({ player }) => {
    const stats = useMemo(() => {
        const s = player?.stats || {};
        return {
            kills: s.kills || 0,
            deaths: s.deaths || 0,
            totalGold: s.total_gold || 0,
            bossKills: s.bossKills || 0,
            killRegistry: s.killRegistry || {},
        };
    }, [player]);

    const topKills = useMemo(() => {
        return Object.entries(stats.killRegistry)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);
    }, [stats.killRegistry]);

    const maxKill = topKills.length > 0 ? topKills[0][1] : 1;

    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '0';

    return (
        <div className="space-y-4">
            <div className="text-cyber-blue/50 text-xs font-fira tracking-widest flex items-center gap-1.5">
                <BarChart3 size={12} /> ▸ STATISTICS
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: 'TOTAL KILLS', value: stats.kills, icon: Sword, color: 'text-red-400' },
                    { label: 'DEATHS', value: stats.deaths, icon: Skull, color: 'text-cyber-blue/60' },
                    { label: 'BOSS KILLS', value: stats.bossKills, icon: Target, color: 'text-cyber-purple' },
                    { label: 'K/D RATIO', value: kd, icon: Shield, color: 'text-cyber-green' },
                    { label: 'TOTAL GOLD', value: stats.totalGold.toLocaleString(), icon: Coins, color: 'text-yellow-400' },
                    { label: 'LEVEL', value: player?.level || 1, icon: Clock, color: 'text-cyber-blue' },
                ].map((entry) => {
                    const Icon = entry.icon;
                    return (
                    <div key={entry.label} className="bg-cyber-dark/40 border border-cyber-blue/10 rounded p-2">
                        <div className="text-[10px] text-cyber-blue/40 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Icon size={9} /> {entry.label}
                        </div>
                        <div className={`font-fira font-bold text-sm ${entry.color}`}>{entry.value}</div>
                    </div>
                )})}
            </div>

            {/* Kill Distribution */}
            {topKills.length > 0 && (
                <div className="space-y-2">
                    <div className="text-[10px] text-cyber-blue/40 font-fira uppercase">처치 분포 (TOP 8)</div>
                    {topKills.map(([name, count], i) => (
                        <Motion.div
                            key={name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center gap-2"
                        >
                            <span className="text-xs text-cyber-blue/60 font-fira w-20 truncate">{name}</span>
                            <div className="flex-1 h-2 bg-cyber-dark/40 rounded-full overflow-hidden">
                                <Motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(count / maxKill) * 100}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.03 }}
                                    className="h-full bg-gradient-to-r from-red-500/60 to-orange-400/60 rounded-full"
                                />
                            </div>
                            <span className="text-[10px] text-cyber-blue/50 font-fira w-8 text-right">{count}</span>
                        </Motion.div>
                    ))}
                </div>
            )}

            {/* Playtime / Meta */}
            {player?.meta && (
                <div className="border-t border-cyber-blue/10 pt-2 space-y-1 text-[10px] font-fira text-cyber-blue/40">
                    <div className="flex justify-between"><span>LEGACY ESSENCE:</span><span className="text-cyber-purple">{player.meta.essence || 0}</span></div>
                    <div className="flex justify-between"><span>LEGACY RANK:</span><span className="text-yellow-400">{player.meta.rank || 0}</span></div>
                    <div className="flex justify-between"><span>BONUS ATK:</span><span className="text-red-400">+{player.meta.bonusAtk || 0}</span></div>
                    <div className="flex justify-between"><span>BONUS HP:</span><span className="text-cyber-green">+{player.meta.bonusHp || 0}</span></div>
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
