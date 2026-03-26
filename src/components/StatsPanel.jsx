import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity, BarChart3, Coins, Compass, Shield, Skull, Sparkles, Sword, Target, TrendingUp, Zap } from 'lucide-react';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';
import SignalBadge from './SignalBadge';

/**
 * StatsPanel — 플레이 통계 + 성향 요약
 */
const StatsPanel = ({ player, stats, compact = false }) => {
    const [showAllStats, setShowAllStats] = useState(false);
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
    const statEntries = [
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
    ];
    const visibleStatEntries = compact && !showAllStats ? statEntries.slice(0, 6) : statEntries;
    const hasExpandableSections = compact && (statEntries.length > 6 || topKills.length > 0 || Boolean(player?.meta));
    const topKillPreview = topKills[0] || null;

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
            <div className="flex items-center justify-between gap-2">
                <div className="text-slate-500 text-xs font-fira tracking-[0.18em] flex items-center gap-1.5 uppercase">
                    <BarChart3 size={12} /> Statistics
                </div>
                {hasExpandableSections && (
                    <button
                        type="button"
                        onClick={() => setShowAllStats((prev) => !prev)}
                        className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/78 hover:bg-white/[0.04]"
                    >
                        {showAllStats ? '요약 보기' : '통계 더 보기'}
                    </button>
                )}
            </div>

            <div className={`rounded-[1rem] border border-white/8 bg-black/18 ${compact ? 'p-2.5 space-y-2' : 'p-3 space-y-2.5'}`}>
                <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/72">
                    <span className="flex items-center gap-1.5">
                        <Sparkles size={10} />
                        성향
                    </span>
                    <SignalBadge tone="resonance" size="sm">{trait.title}</SignalBadge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                        <div className="text-[9px] text-slate-500 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Sparkles size={9} /> 현재 성향
                        </div>
                        <div className={`font-fira font-bold text-xs ${trait.accent}`}>{trait.name}</div>
                    </div>
                    <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                        <div className="text-[9px] text-slate-500 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Zap size={9} /> 전용 스킬
                        </div>
                        <div className="font-fira font-bold text-xs text-emerald-100">{trait.skill?.name || '없음'}</div>
                    </div>
                    <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-2 col-span-2">
                        <div className="text-[9px] text-slate-500 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Shield size={9} /> 패시브
                        </div>
                        <div className="font-fira font-bold text-xs text-slate-200/88">
                            {passiveParts.length > 0 ? passiveParts.slice(0, compact && !showAllStats ? 2 : passiveParts.length).join(' / ') : trait.passiveLabel}
                        </div>
                    </div>
                </div>
                {(!compact || showAllStats) ? (
                    <>
                        <div className="text-[10px] font-fira text-slate-300/76 leading-snug">
                            {trait.desc}
                        </div>
                        <div className="text-[10px] font-fira text-slate-500">
                            성향 판단: {trait.reasons.join(' · ')}
                        </div>
                        <div className="space-y-1 pt-2 border-t border-white/8 text-[10px] font-fira text-slate-300/74">
                            <div>→ {trait.unlockHint}</div>
                            <div>→ 보상 포커스: {trait.rewardFocus}</div>
                            <div>→ 권장 임무: {trait.questFocus}</div>
                            <div>→ 보스 운영: {trait.bossDirective}</div>
                            {trait.skill?.desc && <div>→ {trait.skill.desc}</div>}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-fira text-slate-300/76">
                        <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
                            보상 포커스: <span className="text-[#dff7f5]">{trait.rewardFocus}</span>
                        </div>
                        <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
                            권장 임무: <span className="text-[#e3dcff]">{trait.questFocus}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                {visibleStatEntries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                        <div key={entry.label} className="bg-black/18 border border-white/8 rounded-[0.95rem] px-2.5 py-2">
                            <div className="text-[9px] text-slate-500 font-fira uppercase flex items-center gap-1 mb-0.5">
                                <Icon size={9} /> {entry.label}
                            </div>
                            <div className={`font-fira font-bold text-xs ${entry.color}`}>{entry.value}</div>
                        </div>
                    );
                })}
            </div>

            {compact && !showAllStats && topKillPreview && (
                <div className="rounded-[1rem] border border-white/8 bg-black/18 px-2.5 py-2 text-[10px] font-fira text-slate-300/76">
                    TOP HUNT: <span className="text-[#dff7f5]">{topKillPreview[0]}</span> {topKillPreview[1]}회
                </div>
            )}

            {(!compact || showAllStats) && topKills.length > 0 && (
                <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-fira uppercase tracking-[0.16em]">처치 분포 (TOP 8)</div>
                    {topKills.map(([name, count], i) => (
                        <Motion.div
                            key={name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center gap-2"
                        >
                            <span className="text-xs text-slate-300/76 font-fira w-20 truncate">{name}</span>
                            <div className="flex-1 h-2 bg-black/24 rounded-full overflow-hidden">
                                <Motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(count / maxKill) * 100}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.03 }}
                                    className="h-full bg-gradient-to-r from-rose-400/70 to-[#d5b180]/70 rounded-full"
                                />
                            </div>
                            <span className="text-[10px] text-slate-500 font-fira w-8 text-right">{count}</span>
                        </Motion.div>
                    ))}
                </div>
            )}

            {(!compact || showAllStats) && player?.meta && (
                <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2.5 space-y-1 text-[10px] font-fira text-slate-400/76">
                    <div className="flex justify-between"><span>LEGACY ESSENCE:</span><span className="text-[#d9d0f3]">{player.meta.essence || 0}</span></div>
                    <div className="flex justify-between"><span>LEGACY RANK:</span><span className="text-[#f6e7c8]">{player.meta.rank || 0}</span></div>
                    <div className="flex justify-between"><span>BONUS ATK:</span><span className="text-rose-300">+{player.meta.bonusAtk || 0}</span></div>
                    <div className="flex justify-between"><span>BONUS HP:</span><span className="text-emerald-100">+{player.meta.bonusHp || 0}</span></div>
                </div>
            )}

            {stats?.activeSynergies?.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500 font-fira uppercase tracking-[0.16em] flex items-center gap-1.5">
                        <Sparkles size={10} /> 유물 시너지
                    </div>
                    {stats.activeSynergies.map((syn) => (
                        <div key={syn.name} className="rounded-[0.95rem] border border-fuchsia-400/20 bg-fuchsia-900/10 px-2.5 py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-fira text-fuchsia-200/90 font-bold">{syn.name}</span>
                            <span className="text-[8px] font-fira text-fuchsia-300/60">{syn.desc}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
