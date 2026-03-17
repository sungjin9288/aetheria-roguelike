import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity, BarChart3, Coins, Compass, Shield, Skull, Sparkles, Sword, Target, TrendingUp, Zap } from 'lucide-react';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';

/**
 * StatsPanel — 플레이 통계 + 성향 요약
 */
const StatsPanel = ({ player, stats }) => {
    const overview = useMemo(() => {
        const s = player?.stats || {};
        return {
            kills: s.kills || 0,
            deaths: s.deaths || 0,
            totalGold: s.total_gold || 0,
            bossKills: s.bossKills || 0,
            bountiesCompleted: s.bountiesCompleted || 0,
            killRegistry: s.killRegistry || {},
        };
    }, [player]);

    const trait = useMemo(() => stats?.traitProfile || getTraitProfile(player, stats), [player, stats]);
    const passiveParts = useMemo(() => getTraitPassiveParts(trait), [trait]);

    const topKills = useMemo(() => (
        Object.entries(overview.killRegistry)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
    ), [overview.killRegistry]);

    const maxKill = topKills.length > 0 ? topKills[0][1] : 1;
    const kd = overview.deaths > 0 ? (overview.kills / overview.deaths).toFixed(1) : overview.kills > 0 ? '∞' : '0';

    return (
        <div className="space-y-4">
            <div className="text-cyber-blue/50 text-xs font-fira tracking-widest flex items-center gap-1.5">
                <BarChart3 size={12} /> ▸ STATISTICS
            </div>

            <div className="rounded border border-cyber-blue/15 bg-cyber-dark/35 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/60">
                    <span className="flex items-center gap-1.5">
                        <Sparkles size={10} />
                        성향
                    </span>
                    <span className={trait.accent}>{trait.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded border border-cyber-blue/10 bg-cyber-black/40 px-2 py-1.5">
                        <div className="text-[9px] text-cyber-blue/40 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Sparkles size={9} /> 현재 성향
                        </div>
                        <div className={`font-fira font-bold text-xs ${trait.accent}`}>{trait.name}</div>
                    </div>
                    <div className="rounded border border-cyber-blue/10 bg-cyber-black/40 px-2 py-1.5">
                        <div className="text-[9px] text-cyber-blue/40 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Zap size={9} /> 전용 스킬
                        </div>
                        <div className="font-fira font-bold text-xs text-cyber-green">{trait.skill?.name || '없음'}</div>
                    </div>
                    <div className="rounded border border-cyber-blue/10 bg-cyber-black/40 px-2 py-1.5 col-span-2">
                        <div className="text-[9px] text-cyber-blue/40 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Shield size={9} /> 패시브
                        </div>
                        <div className="font-fira font-bold text-xs text-cyber-blue">
                            {passiveParts.length > 0 ? passiveParts.join(' / ') : trait.passiveLabel}
                        </div>
                    </div>
                </div>
                <div className="text-[10px] font-fira text-cyber-blue/55">
                    {trait.desc}
                </div>
                <div className="text-[10px] font-fira text-cyber-blue/45">
                    성향 판단: {trait.reasons.join(' · ')}
                </div>
                <div className="space-y-1 pt-1 border-t border-cyber-blue/10 text-[10px] font-fira text-cyber-blue/70">
                    <div>→ {trait.unlockHint}</div>
                    <div>→ 보상 포커스: {trait.rewardFocus}</div>
                    <div>→ 권장 임무: {trait.questFocus}</div>
                    <div>→ 보스 운영: {trait.bossDirective}</div>
                    {trait.skill?.desc && <div>→ {trait.skill.desc}</div>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                {[
                    { label: 'TOTAL KILLS', value: overview.kills, icon: Sword, color: 'text-red-400' },
                    { label: 'DEATHS', value: overview.deaths, icon: Skull, color: 'text-cyber-blue/60' },
                    { label: 'BOSS KILLS', value: overview.bossKills, icon: Target, color: 'text-cyber-purple' },
                    { label: 'BOUNTIES', value: overview.bountiesCompleted, icon: Target, color: 'text-cyber-blue' },
                    { label: 'K/D RATIO', value: kd, icon: Shield, color: 'text-cyber-green' },
                    { label: 'TOTAL GOLD', value: overview.totalGold.toLocaleString(), icon: Coins, color: 'text-yellow-400' },
                    { label: 'LEVEL', value: player?.level || 1, icon: Activity, color: 'text-cyber-blue' },
                    { label: 'EXPLORES', value: player?.stats?.explores || 0, icon: Compass, color: 'text-teal-300' },
                    { label: 'DISCOVERIES', value: player?.stats?.discoveries || 0, icon: Sparkles, color: 'text-fuchsia-300' },
                    { label: 'RESTS', value: player?.stats?.rests || 0, icon: TrendingUp, color: 'text-emerald-300' },
                ].map((entry) => {
                    const Icon = entry.icon;
                    return (
                        <div key={entry.label} className="bg-cyber-dark/40 border border-cyber-blue/10 rounded p-1.5">
                            <div className="text-[9px] text-cyber-blue/40 font-fira uppercase flex items-center gap-1 mb-0.5">
                                <Icon size={9} /> {entry.label}
                            </div>
                            <div className={`font-fira font-bold text-xs ${entry.color}`}>{entry.value}</div>
                        </div>
                    );
                })}
            </div>

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
