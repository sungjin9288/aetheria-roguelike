import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Package, Scroll, Shield, Zap, Sword, Map, Trophy, BookOpen, BarChart3, Eye } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import SmartInventory from './SmartInventory';
import AchievementPanel from './AchievementPanel';
import SkillTreePreview from './SkillTreePreview';
import MapNavigator from './MapNavigator';
import StatsPanel from './StatsPanel';
import Bestiary from './Bestiary';
import QuestTab from './tabs/QuestTab';
import SystemTab from './tabs/SystemTab';
import SignalBadge from './SignalBadge';
import FocusPanel from './dashboard/FocusPanel';
import { EquipmentPanel, InlineMetric, MetricTile, ProgressBar, RunProgressPanel, TraitPanel } from './dashboard/DashboardPanels';

const TAB_ITEMS = [
    { id: 'inventory', icon: Package, label: 'Inventory', mobileLabel: 'INV' },
    { id: 'quest', icon: Scroll, label: 'Quest', mobileLabel: 'QUEST' },
    { id: 'achievements', icon: Trophy, label: 'Achievements', mobileLabel: 'ACHV' },
    { id: 'skills', icon: BookOpen, label: 'Skills', mobileLabel: 'SKILL' },
    { id: 'map', icon: Map, label: 'Map', mobileLabel: 'MAP' },
    { id: 'stats', icon: BarChart3, label: 'Stats', mobileLabel: 'STAT' },
    { id: 'bestiary', icon: Eye, label: 'Bestiary', mobileLabel: 'CODEX' },
    { id: 'system', icon: Zap, label: 'System', mobileLabel: 'SYS' }
];

const MOBILE_PRIMARY_TABS = ['inventory', 'quest', 'map', 'stats'];
const MOBILE_SECONDARY_TABS = ['achievements', 'skills', 'bestiary', 'system'];
const ArchiveTabButton = ({ icon, label, active = false, onClick, compact = false, testId = null }) => {
    const Icon = icon;

    return (
        <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            data-testid={testId}
            className={`rounded-[1rem] border px-2 py-1.5 transition-all flex flex-col items-center justify-center gap-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${
                active
                    ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-[0_0_14px_rgba(0,204,255,0.35)]'
                    : 'text-cyber-blue/55 border-cyan-400/18 hover:border-cyber-blue/70 bg-slate-950/72'
            } ${compact ? 'min-h-[44px]' : 'min-h-[52px]'}`}
        >
            <Icon size={14} />
            <span className="text-[8px] font-fira uppercase tracking-[0.14em]">
                {label}
            </span>
        </Motion.button>
    );
};

// Animation variants for tab content
const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false, mobileSection = 'full', quickSlots = [null, null, null], runtime = null, inventorySpotlight = null, onClearInventorySpotlight = null }) => {
    const [statusCollapsed, setStatusCollapsed] = useState(false);
    const [mobileArchiveExpanded, setMobileArchiveExpanded] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';
    const hasInventorySpotlight = Boolean(inventorySpotlight?.token) && sideTab === 'inventory';
    const showArchiveDock = runtime?.mobileArchiveDockVisible ?? true;
    const archiveOpen = showArchiveDock && (hasInventorySpotlight || mobileArchiveExpanded);
    const primaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_PRIMARY_TABS.includes(tab.id));
    const secondaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_SECONDARY_TABS.includes(tab.id));
    const activeMobileTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];
    const mapData = DB.MAPS[player?.loc];
    const loadoutEntries = [
        { label: 'LEFT', item: player?.equip?.offhand, slot: 'offhand', fallback: 'EMPTY' },
        { label: 'RIGHT', item: player?.equip?.weapon, slot: 'main', fallback: 'EMPTY' },
        { label: 'ARMOR', item: player?.equip?.armor, slot: 'armor', fallback: 'EMPTY' },
    ];
    const handleTabSelect = (tabId) => {
        setSideTab(tabId);
        if (mobile) setMobileArchiveExpanded(true);
    };

    useEffect(() => {
        if (showArchiveDock) return;
        const closeTimer = window.requestAnimationFrame(() => setMobileArchiveExpanded(false));
        return () => window.cancelAnimationFrame(closeTimer);
    }, [showArchiveDock]);

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
        if (mobileSection === 'summary') {
            return (
                <Motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:hidden panel-noise rounded-[1.5rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(7,13,25,0.95)_0%,rgba(4,9,18,0.96)_100%)] px-3 py-2.5 shadow-[0_18px_42px_rgba(2,8,20,0.3)] backdrop-blur-2xl"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-white">
                                <span className="truncate text-[14px] font-rajdhani font-bold">{player?.name}</span>
                                <SignalBadge tone="neutral" size="sm">{player?.job}</SignalBadge>
                                <SignalBadge tone="resonance" size="sm">Lv.{player?.level}</SignalBadge>
                            </div>
                            <div className="mt-1 text-[10px] font-fira text-cyber-blue/68 truncate">
                                {player?.loc} · {mapData?.boss ? '보스 권역' : mapData?.type === 'safe' ? '안전 지대' : '탐험 구역'}
                            </div>
                        </div>
                        <div className="shrink-0 rounded-[0.95rem] border border-yellow-500/18 bg-yellow-500/10 px-2.5 py-1.5 text-right">
                            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-cyber-blue/45">Gold</div>
                            <div className="text-[15px] font-rajdhani font-bold leading-none text-yellow-300">{player?.gold}</div>
                        </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                        <MetricTile label="HP" value={player?.hp} max={stats?.maxHp} variant="hp" />
                        <MetricTile label="NRG" value={player?.mp} max={stats?.maxMp} variant="mp" />
                        <MetricTile label="EXP" value={player?.exp} max={player?.nextExp} variant="exp" />
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[0.95rem] border border-cyan-400/10 bg-slate-950/52 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        {loadoutEntries.map((entry) => (
                            <div
                                key={entry.label}
                                className="min-w-0 rounded-[0.8rem] border border-cyan-400/10 bg-cyber-black/34 px-2 py-1.5"
                            >
                                <div className="text-[8px] font-fira uppercase tracking-[0.16em] text-cyber-blue/40">
                                    {entry.label}
                                </div>
                                <div className="mt-1 truncate text-[10px] font-fira leading-none text-slate-200">
                                    {entry.item?.name || entry.fallback}
                                </div>
                            </div>
                        ))}
                    </div>
                </Motion.div>
            );
        }

        if (!showArchiveDock && !archiveOpen) {
            return null;
        }

        return (
            <>
                {showArchiveDock && (
                    <div
                        data-testid="mobile-archive-dock"
                        className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.85rem)] z-30"
                    >
                        <div className="panel-noise rounded-[1.2rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(7,13,25,0.96)_0%,rgba(4,9,18,0.98)_100%)] px-3 py-2 shadow-[0_24px_60px_rgba(2,8,20,0.45)] backdrop-blur-2xl">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">Archive</div>
                                    <div className="mt-0.5 text-[12px] font-rajdhani font-bold text-white truncate">
                                        {hasInventorySpotlight
                                            ? (inventorySpotlight?.title || '전리품 검토')
                                            : activeMobileTab.label}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasInventorySpotlight && (
                                        <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>
                                    )}
                                    <button
                                        data-testid="mobile-archive-open"
                                        onClick={() => setMobileArchiveExpanded(true)}
                                        className="min-h-[34px] rounded-full border border-cyan-400/18 bg-slate-950/78 px-3 text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-blue/78"
                                    >
                                        열기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {archiveOpen && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 z-40 bg-cyber-black/70 backdrop-blur-sm"
                            onClick={() => {
                                setMobileArchiveExpanded(false);
                                onClearInventorySpotlight?.();
                            }}
                        >
                            <Motion.div
                                data-testid="mobile-archive-sheet"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                onClick={(e) => e.stopPropagation()}
                                className="panel-noise absolute inset-x-0 bottom-0 max-h-[72dvh] rounded-t-[1.75rem] border-t border-cyan-400/18 bg-[linear-gradient(180deg,rgba(8,14,28,0.98)_0%,rgba(4,9,18,0.99)_100%)] px-3.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_60px_rgba(2,8,20,0.45)]"
                            >
                                <div className="mx-auto h-1.5 w-12 rounded-full bg-cyber-blue/20" />
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">Archive</div>
                                        <div className="mt-1 text-[15px] font-rajdhani font-bold text-white">
                                            {hasInventorySpotlight
                                                ? (inventorySpotlight?.title || '전리품 검토')
                                                : activeMobileTab.label}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setMobileArchiveExpanded(false);
                                            onClearInventorySpotlight?.();
                                        }}
                                        className="min-h-[38px] rounded-full border border-cyan-400/18 bg-slate-950/78 px-3 text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-blue/78"
                                    >
                                        닫기
                                    </button>
                                </div>

                                {hasInventorySpotlight && (
                                    <div
                                        data-testid="inventory-spotlight"
                                        className="mt-3 rounded-[1rem] border border-cyber-purple/22 bg-cyber-purple/10 px-3 py-2.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-purple/75">
                                                {inventorySpotlight?.title || '전리품 주목'}
                                            </span>
                                            <SignalBadge tone="spotlight" size="sm">검토</SignalBadge>
                                        </div>
                                        <div className="mt-1 text-[11px] font-fira text-cyber-purple/90 leading-snug">
                                            {inventorySpotlight?.detail || '이번 전투에서 얻은 장비를 우선 확인하세요.'}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-4 gap-1.5">
                                    {primaryMobileTabs.map((tab) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            testId={`dashboard-tab-${tab.id}`}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 grid grid-cols-4 gap-1.5">
                                    {secondaryMobileTabs.map((tab) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            testId={`dashboard-tab-${tab.id}`}
                                        />
                                    ))}
                                </div>

                                <div className="mt-3 max-h-[42dvh] overflow-y-auto custom-scrollbar pr-1 rounded-[1.1rem] border border-cyan-400/12 bg-slate-950/52 px-1 py-1">
                                    {renderTabContent()}
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Desktop
    return (
        <aside className="hidden md:flex flex-col gap-3 h-full min-h-0 w-full transition-all duration-300">
            {/* STATUS PANEL — Collapsible */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg shadow-[0_0_20px_rgba(0,204,255,0.15)] relative overflow-hidden transition-all duration-300 shrink-0 ${statusCollapsed ? 'p-3' : 'p-3 max-h-[clamp(7.25rem,19dvh,11.75rem)] overflow-y-auto custom-scrollbar'
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
                className="panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <FocusPanel
                    player={player}
                    stats={stats}
                    runtime={{ ...(runtime || {}), mapData }}
                    actions={actions}
                    setGameState={actions.setGameState}
                    setSideTab={setSideTab}
                />
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <RunProgressPanel player={player} />
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <EquipmentPanel player={player} stats={stats} />
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
                className="panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,204,255,0.1)] shrink-0"
            >
                <TraitPanel player={player} stats={stats} />
            </Motion.div>

            {/* TABS */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="panel-noise bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-4 rounded-lg flex-1 min-h-[200px] overflow-hidden flex flex-col shadow-[0_0_20px_rgba(0,204,255,0.1)]"
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
