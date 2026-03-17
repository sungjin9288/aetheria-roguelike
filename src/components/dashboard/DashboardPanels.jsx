import React from 'react';
import { motion as Motion } from 'framer-motion';
import { User, Shield, Sparkles, Sword } from 'lucide-react';
import { DB } from '../../data/db';
import { isFocusOffhand, isShield, isTwoHandWeapon, isWeapon } from '../../utils/equipmentUtils';
import { getTraitPassiveParts, getTraitProfile } from '../../utils/runProfileUtils';
import { getExplorationForecast, getQuestTracker } from '../../utils/adventureGuide';
import SignalBadge from '../SignalBadge';

const BAR_THEMES = {
    hp: {
        border: 'border-red-500/30',
        fill: 'bg-gradient-to-r from-red-500/50 to-red-500',
        shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    },
    mp: {
        border: 'border-blue-500/30',
        fill: 'bg-gradient-to-r from-blue-500/50 to-blue-500',
        shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    },
    exp: {
        border: 'border-purple-500/30',
        fill: 'bg-gradient-to-r from-purple-500/50 to-purple-500',
        shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    },
};

export const ProgressBar = ({ value, max, variant = 'hp', label, showMeta = true }) => {
    const theme = BAR_THEMES[variant] || BAR_THEMES.hp;
    const safeMax = Math.max(1, max || 1);
    const safeValue = Math.max(0, value || 0);
    const percentage = Math.min(100, (safeValue / safeMax) * 100);

    return (
        <div className="relative w-full">
            {showMeta && (
                <div className="mb-0.5 flex justify-between text-[10px] font-bold uppercase text-cyber-blue/70">
                    <span>{label}</span>
                    <span>{safeValue}/{safeMax}</span>
                </div>
            )}
            <div className={`w-full ${showMeta ? 'h-2' : 'h-1.5'} overflow-hidden rounded-sm border ${theme.border} relative bg-cyber-dark/50`}>
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full ${theme.fill} ${theme.shadow}`}
                />
            </div>
        </div>
    );
};

export const InlineMetric = ({ label, value, max, variant }) => (
    <div className="flex min-w-[8.5rem] items-center gap-2">
        <span className="w-9 shrink-0 text-right text-[10px] uppercase tracking-widest text-cyber-blue/45">
            {label}
        </span>
        <div className="min-w-[4.5rem] flex-1">
            <ProgressBar value={value} max={max} variant={variant} label={label} showMeta={false} />
        </div>
        <span className="w-16 shrink-0 text-right text-[10px] font-bold text-cyber-blue">
            {value || 0}/{Math.max(1, max || 1)}
        </span>
    </div>
);

export const MetricTile = ({ label, value, max, variant }) => {
    const theme = BAR_THEMES[variant] || BAR_THEMES.hp;
    const safeMax = Math.max(1, max || 1);
    const safeValue = Math.max(0, value || 0);
    const percentage = Math.min(100, (safeValue / safeMax) * 100);

    return (
        <div className="rounded-[1rem] border border-cyan-400/15 bg-slate-950/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.18em]">
                <span className="text-cyber-blue/50">{label}</span>
                <span className="text-cyber-blue/80">{safeValue}/{safeMax}</span>
            </div>
            <div className={`mt-2 h-1.5 overflow-hidden rounded-full border ${theme.border} bg-cyber-dark/60`}>
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${theme.fill} ${theme.shadow}`}
                />
            </div>
        </div>
    );
};

const getEquipmentTagMeta = (item, slot = 'main') => {
    if (!item) {
        return {
            label: slot === 'armor' ? 'ARM' : 'EMPTY',
            className: 'text-slate-500',
        };
    }

    if (slot === 'armor') {
        return { label: 'ARM', className: 'text-cyan-300' };
    }

    if (isWeapon(item)) {
        return isTwoHandWeapon(item)
            ? { label: '2H · 파쇄', className: 'text-amber-300' }
            : { label: '1H · 연계', className: 'text-cyan-300' };
    }

    if (isFocusOffhand(item)) return { label: 'FOCUS', className: 'text-violet-300' };
    if (isShield(item)) return { label: 'SHD', className: 'text-emerald-300' };
    return { label: 'EQ', className: 'text-slate-300' };
};

const EquipmentSlot = ({ label, item, slot = 'main', fallback, icon, compact = false }) => {
    const SlotIcon = icon;
    const tag = getEquipmentTagMeta(item, slot);

    return (
        <div className={`min-w-0 rounded-xl border border-cyber-blue/15 bg-cyber-dark/35 shadow-[inset_0_0_14px_rgba(0,204,255,0.03)] ${compact ? 'px-2 py-1.5' : 'px-2 py-2'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                    <div className={`${compact ? 'h-6 w-6' : 'h-7 w-7'} shrink-0 rounded border border-cyber-blue/20 bg-cyber-black/70 flex items-center justify-center text-cyber-blue/70`}>
                        <SlotIcon size={compact ? 11 : 13} />
                    </div>
                    <div className="min-w-0">
                        <div className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-fira uppercase tracking-[0.2em] text-cyber-blue/45`}>
                            {label}
                        </div>
                        <div className={`mt-0.5 truncate ${compact ? 'text-[10px]' : 'text-[11px]'} font-fira text-white`}>
                            {item?.name || fallback}
                        </div>
                    </div>
                </div>
                <span className={`shrink-0 ${compact ? 'text-[9px]' : 'text-[10px]'} font-fira ${tag.className}`}>
                    {tag.label}
                </span>
            </div>
        </div>
    );
};

export const EquipmentPanel = ({ player, stats, compact = false }) => (
    <div className={`panel-noise border ${compact ? 'border-cyan-400/18 rounded-[1.2rem] bg-slate-950/72 shadow-[0_16px_36px_rgba(2,8,20,0.28)]' : 'border-cyber-blue/20 rounded-md bg-cyber-dark/30'} ${compact ? 'p-3' : 'p-3.5'} space-y-2`}>
        <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/60">
            <span className="flex items-center gap-1.5">
                <Sword size={10} className="text-cyber-blue/70" />
                {compact ? 'Loadout' : 'Equipped'}
            </span>
            <span className="text-cyber-blue/45">
                ATK {stats?.atk} / DEF {stats?.def}
            </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] font-fira">
            <EquipmentSlot label="Main" item={player?.equip?.weapon} slot="main" fallback="UNARMED" icon={Sword} compact={compact} />
            <EquipmentSlot label="Off" item={player?.equip?.offhand} slot="offhand" fallback="EMPTY" icon={Shield} compact={compact} />
            <EquipmentSlot label="Armor" item={player?.equip?.armor} slot="armor" fallback="CIVILIAN" icon={User} compact={compact} />
        </div>
    </div>
);

export const RunProgressPanel = ({ player, mobile = false }) => {
    const mapData = DB.MAPS[player?.loc];
    const questTracker = getQuestTracker(player);
    const forecast = getExplorationForecast(player, mapData);
    const visitedMaps = Array.isArray(player?.stats?.visitedMaps) ? player.stats.visitedMaps : [];
    const visitedCount = new Set(visitedMaps).size;
    const totalMaps = Object.keys(DB.MAPS || {}).length;
    const nextLevelExp = Math.max(0, (player?.nextExp || 0) - (player?.exp || 0));
    const kills = player?.stats?.kills || 0;
    const relicCount = player?.relics?.length || 0;

    let growthTitle = `다음 Lv까지 EXP ${nextLevelExp}`;
    let growthDetail = `현재 레벨 ${player?.level || 1}`;
    let growthTone = 'recommended';

    if (player?.job === '모험가') {
        if ((player?.level || 0) >= 5) {
            growthTitle = '1차 전직 가능';
            growthDetail = 'CLASS에서 전직을 진행할 수 있습니다.';
            growthTone = 'success';
        } else {
            growthTitle = `전직까지 Lv.${Math.max(0, 5 - (player?.level || 0))}`;
            growthDetail = `목표 레벨 5 / 현재 ${player?.level || 1}`;
            growthTone = 'resonance';
        }
    }

    const progressItems = [
        {
            label: 'Quest',
            title: questTracker?.title || '진행 중 임무 없음',
            detail: questTracker?.progressLabel || '마을 QUEST에서 새 임무를 받을 수 있습니다.',
            tone: questTracker?.kind === 'claimable' ? 'success' : questTracker?.kind === 'bounty' ? 'upgrade' : 'neutral',
            badge: questTracker?.kind === 'claimable' ? '보상' : questTracker?.progressLabel || '대기',
        },
        {
            label: 'Growth',
            title: growthTitle,
            detail: growthDetail,
            tone: growthTone,
            badge: player?.job === '모험가' && (player?.level || 0) >= 5 ? '전직' : '성장',
        },
        {
            label: 'Frontier',
            title: `${visitedCount}/${totalMaps} 구역 개척`,
            detail: `${mapData?.boss ? '보스 권역' : mapData?.type === 'safe' ? '안전 지대' : '탐험 구역'} · 적정 Lv.${mapData?.level === 'infinite' ? '∞' : mapData?.level || 1}`,
            tone: mapData?.boss ? 'danger' : 'neutral',
            badge: mapData?.boss ? '보스' : '개척',
        },
        {
            label: 'Record',
            title: `처치 ${kills} · 유물 ${relicCount}`,
            detail: `${forecast.mood} · ${forecast.description}`,
            tone: forecast.mood === '보스 권역' ? 'danger' : forecast.mood === '발견 상승' ? 'success' : 'neutral',
            badge: forecast.mood,
        },
    ];

    if (mobile) {
        return (
            <div className="panel-noise space-y-2.5 rounded-[1.2rem] border border-cyan-400/18 bg-slate-950/72 px-3 py-3 shadow-[0_16px_36px_rgba(2,8,20,0.25)]">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/45">Progress</div>
                        <div className="mt-1 text-[12px] font-rajdhani font-bold text-white">이번 런 진행</div>
                    </div>
                    <SignalBadge tone="neutral" size="sm">{player?.loc}</SignalBadge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {progressItems.slice(0, 2).map((item) => (
                        <div key={item.label} className="rounded-[1rem] border border-cyan-400/14 bg-cyber-black/45 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">{item.label}</span>
                                <SignalBadge tone={item.tone} size="sm">{item.badge}</SignalBadge>
                            </div>
                            <div className="mt-1 text-[11px] font-fira leading-snug text-white">{item.title}</div>
                            <div className="mt-1 text-[10px] font-fira leading-snug text-cyber-blue/58">
                                {item.label === 'Quest' ? (questTracker?.kind === 'claimable' ? '보상 수령 가능' : item.detail) : item.detail}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <SignalBadge tone={progressItems[2].tone} size="sm">{progressItems[2].title}</SignalBadge>
                    <SignalBadge tone={progressItems[3].tone} size="sm">{progressItems[3].title}</SignalBadge>
                </div>
            </div>
        );
    }

    return (
        <div className={`panel-noise border ${mobile ? 'border-cyan-400/18 rounded-[1.2rem] bg-slate-950/72 shadow-[0_16px_36px_rgba(2,8,20,0.25)] px-3 py-3' : 'border-cyber-blue/20 rounded-md bg-cyber-dark/30 p-3.5'} space-y-2.5`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/45">진행상황</div>
                    <div className="mt-1 text-[12px] font-rajdhani font-bold text-white">이번 런의 흐름을 항상 확인합니다.</div>
                </div>
                <SignalBadge tone="neutral" size="sm">{player?.loc}</SignalBadge>
            </div>

            <div className={`grid ${mobile ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-2.5'}`}>
                {progressItems.map((item) => (
                    <div key={item.label} className="rounded-[1rem] border border-cyan-400/14 bg-cyber-black/45 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">{item.label}</span>
                            <SignalBadge tone={item.tone} size="sm">{item.badge}</SignalBadge>
                        </div>
                        <div className="mt-1 text-[11px] font-fira leading-snug text-white">{item.title}</div>
                        <div className="mt-1 text-[10px] font-fira leading-snug text-cyber-blue/58">
                            {item.label === 'Quest' ? (questTracker?.kind === 'claimable' ? '보상 수령 가능' : item.detail) : item.detail}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const TraitPanel = ({ player, stats, compact = false }) => {
    const trait = stats?.traitProfile || getTraitProfile(player, stats);
    const passiveParts = getTraitPassiveParts(trait);

    return (
        <div className={`panel-noise border border-cyber-blue/20 rounded-md bg-cyber-dark/30 ${compact ? 'p-3' : 'p-3.5'} space-y-2`}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/60">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={10} className="text-cyber-blue/70" />
                    성향
                </span>
                <span className={trait.accent}>{trait.name}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira">
                <SignalBadge tone="resonance" size="md">{trait.title}</SignalBadge>
                <SignalBadge tone="neutral" size="md">{player?.job}</SignalBadge>
            </div>
            <p className="text-[11px] font-fira text-cyber-blue/60">{trait.desc}</p>
            <div className="flex flex-wrap gap-1.5">
                {passiveParts.length > 0 ? passiveParts.slice(0, compact ? 2 : 4).map((tag) => (
                    <SignalBadge key={tag} tone="neutral" size="sm">{tag}</SignalBadge>
                )) : (
                    <SignalBadge tone="neutral" size="sm">아직 성향 보너스가 없습니다.</SignalBadge>
                )}
            </div>
            <div className="text-[10px] font-fira text-cyber-blue/45">성향 판단: {trait.reasons.join(' · ')}</div>
            <div className="text-[10px] font-fira text-cyber-blue/50">전용 스킬: {trait.skillLabel}</div>
            <div className="rounded border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-1.5 text-[10px] font-fira text-cyber-purple/90">
                {trait.unlockHint}
            </div>
        </div>
    );
};
