import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { User, Package, Scroll, Shield, Zap, Sword, Map, Trophy, BookOpen, BarChart3, Eye, Sparkles, Crosshair, Compass } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import { isFocusOffhand, isShield, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';
import { getAdventureGuidance, getExplorationForecast, getQuestTracker } from '../utils/adventureGuide';
import { GS } from '../reducers/gameStates';
import SmartInventory from './SmartInventory';
import AchievementPanel from './AchievementPanel';
import SkillTreePreview from './SkillTreePreview';
import MapNavigator from './MapNavigator';
import StatsPanel from './StatsPanel';
import Bestiary from './Bestiary';
import QuestTab from './tabs/QuestTab';
import SystemTab from './tabs/SystemTab';

const BAR_THEMES = {
    hp: {
        border: 'border-red-500/30',
        fill: 'bg-gradient-to-r from-red-500/50 to-red-500',
        shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]'
    },
    mp: {
        border: 'border-blue-500/30',
        fill: 'bg-gradient-to-r from-blue-500/50 to-blue-500',
        shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]'
    },
    exp: {
        border: 'border-purple-500/30',
        fill: 'bg-gradient-to-r from-purple-500/50 to-purple-500',
        shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]'
    }
};

const TAB_ITEMS = [
    { id: 'inventory', icon: Package, label: 'Inventory' },
    { id: 'quest', icon: Scroll, label: 'Quest' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
    { id: 'skills', icon: BookOpen, label: 'Skills' },
    { id: 'map', icon: Map, label: 'Map' },
    { id: 'stats', icon: BarChart3, label: 'Stats' },
    { id: 'bestiary', icon: Eye, label: 'Bestiary' },
    { id: 'system', icon: Zap, label: 'System' }
];

const ProgressBar = ({ value, max, variant = 'hp', label, showMeta = true }) => {
    const theme = BAR_THEMES[variant] || BAR_THEMES.hp;
    const safeMax = Math.max(1, max || 1);
    const safeValue = Math.max(0, value || 0);
    const percentage = Math.min(100, (safeValue / safeMax) * 100);

    return (
        <div className="relative w-full">
            {showMeta && (
                <div className="flex justify-between text-[10px] uppercase font-bold mb-0.5 text-cyber-blue/70">
                    <span>{label}</span>
                    <span>{safeValue}/{safeMax}</span>
                </div>
            )}
            <div className={`w-full ${showMeta ? 'h-2' : 'h-1.5'} bg-cyber-dark/50 rounded-sm overflow-hidden border ${theme.border} relative`}>
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full ${theme.fill} ${theme.shadow}`}
                ></Motion.div>
            </div>
        </div>
    );
};

const InlineMetric = ({ label, value, max, variant }) => (
    <div className="flex items-center gap-2 min-w-[8.5rem]">
        <span className="w-9 shrink-0 text-[10px] text-cyber-blue/45 uppercase tracking-widest text-right">
            {label}
        </span>
        <div className="flex-1 min-w-[4.5rem]">
            <ProgressBar value={value} max={max} variant={variant} label={label} showMeta={false} />
        </div>
        <span className="w-16 shrink-0 text-[10px] text-cyber-blue font-bold text-right">
            {value || 0}/{Math.max(1, max || 1)}
        </span>
    </div>
);

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

const EquipmentSlot = ({ label, item, slot = 'main', fallback, icon }) => {
    const SlotIcon = icon;
    const tag = getEquipmentTagMeta(item, slot);

    return (
        <div className="rounded-md border border-cyber-blue/15 bg-cyber-dark/35 px-2 py-2 min-w-0 shadow-[inset_0_0_14px_rgba(0,204,255,0.03)]">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                    <div className="w-7 h-7 shrink-0 rounded border border-cyber-blue/20 bg-cyber-black/70 flex items-center justify-center text-cyber-blue/70">
                        <SlotIcon size={13} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-fira text-cyber-blue/45 uppercase tracking-[0.2em]">
                            {label}
                        </div>
                        <div className="truncate text-[11px] font-fira text-white mt-0.5">
                            {item?.name || fallback}
                        </div>
                    </div>
                </div>
                <span className={`shrink-0 text-[10px] font-fira ${tag.className}`}>
                    {tag.label}
                </span>
            </div>
        </div>
    );
};

const EquipmentPanel = ({ player, stats, compact = false }) => (
    <div className={`border border-cyber-blue/20 rounded-md bg-cyber-dark/30 ${compact ? 'p-3' : 'p-3.5'} space-y-2`}>
        <div className="flex items-center justify-between gap-3 text-[10px] font-fira text-cyber-blue/60 uppercase tracking-[0.2em]">
            <span className="flex items-center gap-1.5">
                <Sword size={10} className="text-cyber-blue/70" />
                Equipped
            </span>
            <span className="text-cyber-blue/45">
                ATK {stats?.atk} / DEF {stats?.def}
            </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] font-fira">
            <EquipmentSlot
                label="Main"
                item={player?.equip?.weapon}
                slot="main"
                fallback="UNARMED"
                icon={Sword}
            />
            <EquipmentSlot
                label="Off"
                item={player?.equip?.offhand}
                slot="offhand"
                fallback="EMPTY"
                icon={Shield}
            />
            <EquipmentSlot
                label="Armor"
                item={player?.equip?.armor}
                slot="armor"
                fallback="CIVILIAN"
                icon={User}
            />
        </div>
    </div>
);

const TraitStrip = ({ player, stats }) => {
    const trait = stats?.traitProfile || getTraitProfile(player, stats);
    const passiveParts = getTraitPassiveParts(trait);

    return (
        <div className="border border-cyber-blue/20 rounded-md bg-cyber-dark/30 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px] font-fira text-cyber-blue/60 uppercase tracking-[0.18em]">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={10} className="text-cyber-blue/70" />
                    성향
                </span>
                <span className={`truncate max-w-[10rem] text-right ${trait.accent}`}>
                    {trait.name}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira">
                <span className={`rounded border px-2 py-1 ${trait.chipClass}`}>
                    {trait.title}
                </span>
                {passiveParts.slice(0, 2).map((part) => (
                    <span key={part} className="rounded border border-cyber-blue/15 bg-cyber-black/60 px-2 py-1 text-cyber-blue/75">
                        {part}
                    </span>
                ))}
            </div>
        </div>
    );
};

const TraitPanel = ({ player, stats, compact = false }) => {
    const trait = stats?.traitProfile || getTraitProfile(player, stats);
    const passiveParts = getTraitPassiveParts(trait);

    return (
        <div className={`border border-cyber-blue/20 rounded-md bg-cyber-dark/30 ${compact ? 'p-3' : 'p-3.5'} space-y-2`}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-fira text-cyber-blue/60 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={10} className="text-cyber-blue/70" />
                    성향
                </span>
                <span className={trait.accent}>
                    {trait.name}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira">
                <span className={`rounded border px-2 py-1 ${trait.chipClass}`}>
                    {trait.title}
                </span>
                <span className="rounded border border-cyber-blue/15 bg-cyber-black/60 px-2 py-1 text-cyber-blue/80">
                    {player?.job}
                </span>
            </div>
            <p className="text-[11px] font-fira text-cyber-blue/60">
                {trait.desc}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {passiveParts.length > 0 ? passiveParts.slice(0, compact ? 2 : 4).map((tag) => (
                    <span
                        key={tag}
                        className="rounded border border-cyber-blue/15 bg-cyber-black/60 px-2 py-1 text-[10px] font-fira text-cyber-blue/80"
                    >
                        {tag}
                    </span>
                )) : (
                    <span className="rounded border border-cyber-blue/15 bg-cyber-black/60 px-2 py-1 text-[10px] font-fira text-cyber-blue/50">
                        아직 성향 보너스가 없습니다.
                    </span>
                )}
            </div>
            <div className="text-[10px] font-fira text-cyber-blue/45">
                성향 판단: {trait.reasons.join(' · ')}
            </div>
            <div className="text-[10px] font-fira text-cyber-blue/50">
                전용 스킬: {trait.skillLabel}
            </div>
            <div className="rounded border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-1.5 text-[10px] font-fira text-cyber-purple/90">
                {trait.unlockHint}
            </div>
        </div>
    );
};

const FocusPanel = ({ player, stats, runtime, actions, setSideTab, mobile = false, onMobileOpenDetails }) => {
    const [detailsOpen, setDetailsOpen] = useState(!mobile);
    const mapData = DB.MAPS[player?.loc];
    const guidance = useMemo(
        () => getAdventureGuidance(player, stats, mapData, runtime?.gameState || GS.IDLE),
        [mapData, player, runtime?.gameState, stats]
    );
    const forecast = useMemo(
        () => getExplorationForecast(player, mapData),
        [mapData, player]
    );
    const questTracker = useMemo(
        () => getQuestTracker(player),
        [player]
    );

    const runAction = (action) => {
        if (!action) return;

        switch (action.kind) {
            case 'claim_quest':
                actions.completeQuest?.(action.questId);
                break;
            case 'rest':
                actions.rest?.();
                break;
            case 'open_class':
                actions.setGameState?.(GS.JOB_CHANGE);
                break;
            case 'open_quest_board':
                actions.setGameState?.(GS.QUEST_BOARD);
                break;
            case 'open_move':
                actions.setGameState?.(GS.MOVING);
                break;
            case 'explore':
                actions.explore?.();
                break;
            case 'open_inventory':
                setSideTab('inventory');
                onMobileOpenDetails?.();
                break;
            case 'open_shop':
                actions.setShopItems?.([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                actions.setGameState?.(GS.SHOP);
                break;
            case 'open_quest':
                setSideTab('quest');
                onMobileOpenDetails?.();
                break;
            default:
                break;
        }
    };

    const buttonClass = mobile
        ? 'min-h-[38px] rounded-xl border px-3 py-2 text-[11px] font-rajdhani font-bold tracking-[0.16em]'
        : 'min-h-[36px] rounded-lg border px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.16em]';

    return (
        <div className={`border border-cyber-blue/20 rounded-md bg-cyber-dark/30 ${mobile ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'}`}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-fira text-cyber-blue/60 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-1.5">
                    <Crosshair size={10} className="text-cyber-blue/70" />
                    현재 목표
                </span>
                <div className="flex items-center gap-2">
                    <span className={`rounded border px-2 py-1 ${
                    guidance.emphasis === '위험'
                        ? 'border-red-500/25 bg-red-950/25 text-red-300'
                        : guidance.emphasis === '즉시 이득'
                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                            : 'border-cyber-blue/15 bg-cyber-black/60 text-cyber-blue/80'
                }`}>
                        {guidance.emphasis}
                    </span>
                    {mobile && (
                        <button
                            onClick={() => setDetailsOpen((open) => !open)}
                            className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-2 py-1 text-cyber-blue/70"
                            aria-label={detailsOpen ? '목표 상세 닫기' : '목표 상세 열기'}
                        >
                            {detailsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-sm font-rajdhani font-bold text-white">{guidance.title}</div>
                <div className="text-[11px] font-fira text-cyber-blue/60">{guidance.detail}</div>
            </div>

            {(guidance.primaryAction || guidance.secondaryAction) && (
                <div className="grid grid-cols-2 gap-2">
                    {guidance.primaryAction ? (
                        <button
                            onClick={() => runAction(guidance.primaryAction)}
                            className={`${buttonClass} border-cyber-green/30 bg-cyber-green/10 text-cyber-green hover:bg-cyber-green/15`}
                        >
                            {guidance.primaryAction.label}
                        </button>
                    ) : (
                        <div />
                    )}
                    {guidance.secondaryAction ? (
                        <button
                            onClick={() => runAction(guidance.secondaryAction)}
                            className={`${buttonClass} border-cyber-blue/20 bg-cyber-black/60 text-cyber-blue/80 hover:bg-cyber-blue/10`}
                        >
                            {guidance.secondaryAction.label}
                        </button>
                    ) : (
                        <div />
                    )}
                </div>
            )}

            <AnimatePresence initial={false}>
                {detailsOpen && (
                    <Motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-3"
                    >
                        {questTracker && (
                            <div className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2">
                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                    <span className="text-cyber-blue/50 uppercase tracking-[0.16em]">Quest Pulse</span>
                                    <span className={`${
                                        questTracker.kind === 'claimable' ? 'text-cyber-green' : questTracker.kind === 'bounty' ? 'text-amber-300' : 'text-cyber-purple'
                                    }`}>
                                        {questTracker.progressLabel}
                                    </span>
                                </div>
                                <div className="mt-1 text-[11px] font-fira text-slate-200">{questTracker.title}</div>
                            </div>
                        )}

                        <div className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                <span className="flex items-center gap-1 text-cyber-blue/50 uppercase tracking-[0.16em]">
                                    <Compass size={10} />
                                    탐험 예보
                                </span>
                                <span className="text-cyber-green">{forecast.mood}</span>
                            </div>
                            <div className="mt-1 text-[11px] font-fira text-cyber-blue/65">{forecast.description}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {forecast.chips.map((chip) => (
                                    <span key={`${chip.label}_${chip.value}`} className="rounded border border-cyber-blue/15 bg-cyber-dark/35 px-2 py-1 text-[10px] font-fira text-cyber-blue/80">
                                        {chip.label} {chip.value}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Animation variants for tab content
const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false, quickSlots = [null, null, null], runtime = null, inventorySpotlight = null, onClearInventorySpotlight = null }) => {
    const [statusCollapsed, setStatusCollapsed] = useState(false);
    const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';
    const showMobileDetails = mobileDetailsOpen || (mobile && sideTab === 'inventory' && Boolean(inventorySpotlight?.token));

    const handleTabSelect = (tabId) => {
        setSideTab(tabId);
        if (mobile) setMobileDetailsOpen(true);
    };

    const renderTabContent = () => {
        return (
            <AnimatePresence mode="wait">
                <Motion.div
                    key={sideTab}
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-2 pr-1"
                >
                    {sideTab === 'inventory' && (
                        <SmartInventory
                            player={player}
                            actions={actions}
                            quickSlots={quickSlots}
                            onAssignQuickSlot={(index, item) => actions.setQuickSlot?.(index, item)}
                            spotlight={inventorySpotlight}
                            onClearSpotlight={onClearInventorySpotlight}
                        />
                    )}

                    {sideTab === 'quest' && (
                        <QuestTab player={player} actions={actions} isInSafeZone={isInSafeZone} />
                    )}

                    {sideTab === 'achievements' && (
                        <AchievementPanel player={player} actions={actions} />
                    )}

                    {sideTab === 'skills' && (
                        <SkillTreePreview player={player} />
                    )}

                    {sideTab === 'map' && (
                        <MapNavigator
                            player={player}
                            stats={stats}
                        />
                    )}

                    {sideTab === 'stats' && (
                        <StatsPanel player={player} stats={stats} />
                    )}

                    {sideTab === 'bestiary' && (
                        <Bestiary player={player} />
                    )}

                    {sideTab === 'system' && (
                        <SystemTab player={player} actions={actions} stats={stats} runtime={runtime} />
                    )}
                </Motion.div>
            </AnimatePresence>
        );
    };

    if (mobile) {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:hidden mt-2 space-y-3 rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/85 p-3 backdrop-blur-2xl shadow-[0_24px_60px_rgba(2,8,20,0.45)] relative z-10"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-emerald-300 font-rajdhani font-bold text-sm tracking-[0.24em] uppercase">
                            <User size={14} />
                            <span className="truncate">{player?.name}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-fira text-cyber-blue/75">
                            <span className="text-cyber-purple">{player?.job}</span>
                            <span>Lv.{player?.level}</span>
                            <span className="text-cyber-blue/40">•</span>
                            <span className="truncate max-w-[8.5rem]">{player?.loc}</span>
                        </div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">Gold</div>
                        <div className="text-yellow-400 font-rajdhani text-lg font-bold leading-none">{player?.gold}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <InlineMetric label="HP" value={player?.hp} max={stats?.maxHp} variant="hp" />
                    <InlineMetric label="NRG" value={player?.mp} max={stats?.maxMp} variant="mp" />
                    <InlineMetric label="EXP" value={player?.exp} max={player?.nextExp} variant="exp" />
                </div>

                <FocusPanel
                    player={player}
                    stats={stats}
                    runtime={runtime}
                    actions={actions}
                    setSideTab={setSideTab}
                    mobile
                    onMobileOpenDetails={() => setMobileDetailsOpen(true)}
                />

                <EquipmentPanel player={player} stats={stats} compact />
                <TraitStrip player={player} stats={stats} />

                <div className="border-t border-cyber-blue/20 pt-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/50">
                            Archive
                        </div>
                        <button
                            onClick={() => {
                                if (showMobileDetails) {
                                    setMobileDetailsOpen(false);
                                    onClearInventorySpotlight?.();
                                } else {
                                    setMobileDetailsOpen(true);
                                }
                            }}
                            className="min-h-[36px] rounded border border-cyber-blue/25 bg-cyber-dark/40 px-3 text-[11px] font-fira text-cyber-blue/75"
                        >
                            {showMobileDetails ? '상세 닫기' : '상세 열기'}
                        </button>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                        {TAB_ITEMS.map(tab => (
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                key={tab.id}
                                onClick={() => handleTabSelect(tab.id)}
                                title={tab.label}
                                aria-label={tab.label}
                                data-testid={`dashboard-tab-${tab.id}`}
                                className={`min-h-[42px] min-w-[42px] flex-shrink-0 px-2 py-2 rounded border transition-all flex items-center justify-center
                                    ${sideTab === tab.id
                                        ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-[0_0_10px_rgba(0,204,255,0.4)]'
                                        : 'text-cyber-blue/50 border-cyber-blue/30 hover:border-cyber-blue/70 bg-cyber-dark/40'}`}
                            >
                                <tab.icon size={14} />
                            </Motion.button>
                        ))}
                    </div>

                    <AnimatePresence initial={false}>
                        {showMobileDetails && (
                            <Motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="max-h-[34dvh] overflow-y-auto custom-scrollbar pr-1">
                                    {renderTabContent()}
                                </div>
                            </Motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Motion.div>
        );
    }

    // Desktop
    return (
        <aside className="hidden md:flex flex-col gap-3 h-full min-h-0 w-full transition-all duration-300">
            {/* STATUS PANEL — Collapsible */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg shadow-[0_0_20px_rgba(0,204,255,0.15)] relative overflow-hidden transition-all duration-300 shrink-0 ${statusCollapsed ? 'p-3' : 'p-3 max-h-[clamp(7.25rem,19dvh,11.75rem)] overflow-y-auto custom-scrollbar'
                    }`}
            >
                {/* Collapse toggle */}
                <button
                    onClick={() => setStatusCollapsed(prev => !prev)}
                    className="absolute top-2 right-2 z-10 text-cyber-blue/40 hover:text-cyber-blue transition-colors p-1 rounded hover:bg-cyber-blue/10"
                    title={statusCollapsed ? '펼치기' : '접기'}
                >
                    {statusCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {statusCollapsed ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 font-rajdhani min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse shrink-0"></span>
                                <span className="text-white font-bold text-sm truncate">{player?.name}</span>
                            </div>
                            <span className="text-cyber-purple text-[10px] font-fira uppercase bg-cyber-purple/10 px-1.5 py-0.5 rounded border border-cyber-purple/30">
                                {player?.job}
                            </span>
                            <span className="text-cyber-blue text-[10px] font-fira uppercase">Lv.{player?.level}</span>
                            <span className="text-yellow-400 text-[10px] font-fira font-bold">{player?.gold} CR</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <ProgressBar value={player?.hp} max={stats?.maxHp} variant="hp" label="HP" showMeta={false} />
                            <ProgressBar value={player?.mp} max={stats?.maxMp} variant="mp" label="ENERGY" showMeta={false} />
                            <ProgressBar value={player?.exp} max={player?.nextExp} variant="exp" label="EXP" showMeta={false} />
                        </div>
                        </div>
                ) : (
                    <>
                        <h3 className="text-cyber-green font-rajdhani font-bold text-sm mb-2 flex items-center gap-2 tracking-[0.2em] border-b border-cyber-green/20 pb-2">
                            <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]"></span>
                            STATUS
                        </h3>

                        <div className="space-y-2">
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(9rem,11.5rem)] items-center gap-x-3 gap-y-1.5 text-[11px] font-fira">
                                <span className="text-cyber-blue/45 uppercase tracking-widest">닉네임</span>
                                <span className="text-white font-rajdhani text-lg font-bold truncate">{player?.name}</span>
                                <InlineMetric label="HP" value={player?.hp} max={stats?.maxHp} variant="hp" />

                                <span className="text-cyber-blue/45 uppercase tracking-widest">직업</span>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-cyber-purple uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/30 truncate">
                                        {player?.job}
                                    </span>
                                    <span className="text-cyber-blue uppercase shrink-0">Lv.{player?.level}</span>
                                </div>
                                <InlineMetric label="NRG" value={player?.mp} max={stats?.maxMp} variant="mp" />

                                <span className="text-cyber-blue/45 uppercase tracking-widest">Gold</span>
                                <span className="text-yellow-400 font-bold tracking-wide">{player?.gold} CR</span>
                                <InlineMetric label="EXP" value={player?.exp} max={player?.nextExp} variant="exp" />
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-cyber-blue/10 text-[10px] font-fira">
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase flex items-center gap-1">
                                        <Sword size={9} /> {stats?.isMagic ? 'M.ATK' : 'ATK'}
                                    </span>
                                    <span className="text-white font-bold">
                                        {stats?.atk} <span className="text-cyber-purple font-normal">({stats?.elem})</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase flex items-center gap-1">
                                        <Shield size={9} /> DEF
                                    </span>
                                    <span className="text-white font-bold">{stats?.def}</span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase">CRIT</span>
                                    <span className="text-white font-bold">{Math.round((stats?.critChance || 0) * 100)}%</span>
                                </div>
                            </div>

                            {stats?.activeSet && (
                                <div className="p-1.5 bg-cyber-green/10 border border-cyber-green/30 rounded text-cyber-green text-center text-[10px] font-fira">
                                    <span className="font-bold">{stats.activeSet.desc}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <FocusPanel
                    player={player}
                    stats={stats}
                    runtime={runtime}
                    actions={actions}
                    setSideTab={setSideTab}
                />
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <EquipmentPanel player={player} stats={stats} />
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <TraitPanel player={player} stats={stats} />
            </Motion.div>

            {/* TABS */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-4 rounded-lg flex-1 min-h-[200px] overflow-hidden flex flex-col shadow-[0_0_20px_rgba(0,204,255,0.1)]"
            >
                <div className="flex gap-2 mb-4 border-b border-cyber-blue/20 pb-3">
                    {TAB_ITEMS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabSelect(tab.id)}
                            title={tab.label}
                            aria-label={tab.label}
                            data-testid={`dashboard-tab-${tab.id}`}
                            className={`h-10 flex-1 flex items-center justify-center rounded-sm transition-all min-h-[36px]
                                ${sideTab === tab.id
                                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 shadow-[0_0_10px_rgba(0,204,255,0.3)]'
                                    : 'text-cyber-blue/30 hover:text-cyber-blue/70 hover:bg-cyber-blue/5'}`}
                        >
                            <tab.icon size={12} />
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {renderTabContent()}
                </div>
            </Motion.div>
        </aside>
    );
};

export default Dashboard;
