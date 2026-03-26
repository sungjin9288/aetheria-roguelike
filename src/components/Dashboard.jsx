import React, { useEffect, useState } from 'react';
import { Package, Scroll, Zap, Map, Trophy, BookOpen, BarChart3, Eye, ChevronUp, Star, Skull } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { MOTION } from '../utils/animationConfig';
import { DB } from '../data/db';
import SmartInventory from './SmartInventory';
import AchievementPanel from './AchievementPanel';
import SkillTreePreview from './SkillTreePreview';
import MapNavigator from './MapNavigator';
import BuildAdvicePanel from './BuildAdvicePanel';
import StatsPanel from './StatsPanel';
import Codex from './Codex';
import GravePanel from './GravePanel';
import QuestTab from './tabs/QuestTab';
import SystemTab from './tabs/SystemTab';
import SeasonPassPanel from './tabs/SeasonPassPanel';
import SignalBadge from './SignalBadge';

const TAB_ITEMS = [
    { id: 'inventory', icon: Package, label: 'Inventory', mobileLabel: 'INV' },
    { id: 'quest', icon: Scroll, label: 'Quest', mobileLabel: 'QUEST' },
    { id: 'achievements', icon: Trophy, label: 'Achievements', mobileLabel: 'ACHV' },
    { id: 'skills', icon: BookOpen, label: 'Skills', mobileLabel: 'SKILL' },
    { id: 'map', icon: Map, label: 'Map', mobileLabel: 'MAP' },
    { id: 'stats', icon: BarChart3, label: 'Stats', mobileLabel: 'STAT' },
    { id: 'codex', icon: Eye, label: 'Codex', mobileLabel: 'CODEX' },
    { id: 'pass', icon: Star, label: 'Pass', mobileLabel: 'PASS' },
    { id: 'graves', icon: Skull, label: 'Graves', mobileLabel: 'GRAVE' },
    { id: 'system', icon: Zap, label: 'System', mobileLabel: 'SYS' }
];

const MOBILE_PRIMARY_TABS = ['inventory', 'quest', 'map', 'stats'];
const MOBILE_SECONDARY_TABS = ['achievements', 'skills', 'codex', 'pass', 'graves', 'system'];
const DESKTOP_PRIMARY_TABS = ['inventory', 'quest', 'map'];
const DESKTOP_SECONDARY_TABS = ['achievements', 'skills', 'stats', 'codex', 'pass', 'graves', 'system'];
const ArchiveTabButton = ({ icon, label, active = false, onClick, compact = false, rail = false, dense = false, iconOnly = false, testId = null }) => {
    const Icon = icon;
    const frameClass = rail
        ? 'flex min-h-[32px] shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1'
        : dense
            ? iconOnly
                ? 'flex min-h-[27px] items-center justify-center gap-0 rounded-[0.72rem] px-0.5 py-0.5'
                : 'flex min-h-[30px] items-center justify-center gap-0.5 rounded-[0.8rem] px-0.75 py-0.75 flex-col'
            : 'flex flex-col items-center justify-center gap-1 rounded-[1rem]';
    const heightClass = rail || dense ? '' : compact ? 'min-h-[40px]' : 'min-h-[52px]';

    return (
        <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            data-testid={testId}
            title={label}
            className={`border ${dense ? 'px-1 py-1' : 'px-2 py-1.5'} transition-all backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${
                active
                    ? 'border-[#7dd4d8]/26 bg-[linear-gradient(180deg,rgba(125,212,216,0.18)_0%,rgba(125,212,216,0.08)_100%)] text-[#e4f7f5] shadow-[0_16px_30px_rgba(125,212,216,0.12)]'
                    : 'text-slate-300/65 border-white/8 hover:border-[#d5b180]/18 bg-black/18'
            } ${frameClass} ${heightClass}`}
        >
            <Icon size={rail ? 11 : dense ? (iconOnly ? 11 : 12) : 14} />
            {iconOnly ? (
                <span className="sr-only">{label}</span>
            ) : (
                <span className={`${rail ? 'text-[8px] tracking-[0.1em]' : dense ? 'text-[7px] tracking-[0.12em]' : 'text-[8px] tracking-[0.14em]'} font-fira uppercase`}>
                    {label}
                </span>
            )}
        </Motion.button>
    );
};

// Animation variants for tab content
const tabVariants = {
    ...MOTION.variants.tab,
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const Dashboard = ({ player, grave, sideTab, setSideTab, actions, stats, mobile = false, mobileSection = 'full', quickSlots = [null, null, null], runtime = null, inventorySpotlight = null, onClearInventorySpotlight = null, compactDesktop = false }) => {
    const [mobileArchiveExpanded, setMobileArchiveExpanded] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';
    const useCompactDesktopRail = compactDesktop || runtime?.viewport === 'desktop-compact';
    const hasInventorySpotlight = Boolean(inventorySpotlight?.token) && sideTab === 'inventory';
    const showArchiveDock = runtime?.mobileArchiveDockVisible ?? true;
    const archiveOpen = showArchiveDock && (hasInventorySpotlight || mobileArchiveExpanded);
    const primaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_PRIMARY_TABS.includes(tab.id));
    const secondaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_SECONDARY_TABS.includes(tab.id));
    const primaryDesktopTabs = TAB_ITEMS.filter((tab) => DESKTOP_PRIMARY_TABS.includes(tab.id));
    const secondaryDesktopTabs = TAB_ITEMS.filter((tab) => DESKTOP_SECONDARY_TABS.includes(tab.id));
    const activeMobileTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];
    const ActiveArchiveIcon = activeMobileTab.icon;
    const activeDesktopTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];
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
        const desktopArchiveCompact = !mobile;
        return (
            <AnimatePresence mode="wait">
                <Motion.div
                    key={sideTab}
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={useCompactDesktopRail ? 'space-y-1 pr-0.5' : 'space-y-2 pr-1'}
                >
                    {sideTab === 'inventory' && (
                        <SmartInventory
                            player={player}
                            actions={actions}
                            quickSlots={quickSlots}
                            compact={desktopArchiveCompact}
                            onAssignQuickSlot={(index, item) => actions.setQuickSlot?.(index, item)}
                            spotlight={inventorySpotlight}
                            onClearSpotlight={onClearInventorySpotlight}
                        />
                    )}

                    {sideTab === 'quest' && (
                        <QuestTab player={player} actions={actions} isInSafeZone={isInSafeZone} compact={desktopArchiveCompact} />
                    )}

                    {sideTab === 'achievements' && (
                        <AchievementPanel player={player} actions={actions} compact={desktopArchiveCompact} />
                    )}

                    {sideTab === 'skills' && (
                        <SkillTreePreview player={player} compact={desktopArchiveCompact} actions={actions} />
                    )}

                    {sideTab === 'map' && (
                        <div className="space-y-3">
                            <MapNavigator
                                player={player}
                                grave={grave}
                                stats={stats}
                                compact={desktopArchiveCompact}
                            />
                            <BuildAdvicePanel player={player} compact={desktopArchiveCompact} />
                        </div>
                    )}

                    {sideTab === 'stats' && (
                        <StatsPanel player={player} stats={stats} compact={desktopArchiveCompact} />
                    )}

                    {sideTab === 'codex' && (
                        <Codex player={player} compact={desktopArchiveCompact} dispatch={actions?.dispatch} />
                    )}

                    {sideTab === 'pass' && (
                        <SeasonPassPanel player={player} dispatch={actions?.dispatch} />
                    )}

                    {sideTab === 'graves' && (
                        <GravePanel player={player} actions={actions} compact={desktopArchiveCompact} />
                    )}

                    {sideTab === 'system' && (
                        <SystemTab player={player} actions={actions} stats={stats} runtime={runtime} compact={desktopArchiveCompact} />
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
                    className="md:hidden panel-noise aether-surface rounded-[1.55rem] px-3 py-2.5"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-slate-500">
                                Field Snapshot
                            </div>
                            <div className="mt-1 truncate text-[14px] font-rajdhani font-bold text-white/92">
                                {player?.loc}
                            </div>
                            <div className="mt-1 text-[10px] font-fira text-slate-400/76 truncate">
                                {mapData?.boss ? '보스 권역' : mapData?.type === 'safe' ? '안전 지대' : '탐험 구역'}
                            </div>
                        </div>
                        <SignalBadge
                            tone={mapData?.boss ? 'danger' : mapData?.type === 'safe' ? 'upgrade' : 'neutral'}
                            size="sm"
                        >
                            {mapData?.boss ? '보스' : mapData?.type === 'safe' ? '안전' : '탐험'}
                        </SignalBadge>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[1.05rem] border border-white/8 bg-black/18 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        {loadoutEntries.map((entry) => (
                            <div
                                key={entry.label}
                                className="min-w-0 rounded-[0.9rem] border border-white/8 bg-white/[0.02] px-2 py-1.5"
                            >
                                <div className="text-[8px] font-fira uppercase tracking-[0.16em] text-slate-500">
                                    {entry.label}
                                </div>
                                <div className="mt-1 flex items-center gap-1 min-w-0">
                                    <span className="truncate text-[10px] font-fira leading-none text-slate-200/88">
                                        {entry.item?.name || entry.fallback}
                                    </span>
                                    {(entry.item?.enhance || 0) > 0 && (
                                        <span className="shrink-0 text-[9px] font-bold font-fira text-[#d5b180]">+{entry.item.enhance}</span>
                                    )}
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
                        className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 z-30 w-[min(calc(100%-1.5rem),22rem)] -translate-x-1/2"
                    >
                        <button
                            type="button"
                            data-testid="mobile-archive-open"
                            onClick={() => setMobileArchiveExpanded(true)}
                            className="panel-noise aether-surface group flex w-full items-center justify-between gap-3 rounded-full px-3 py-2"
                        >
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                    <ActiveArchiveIcon size={14} />
                                </div>
                                <div className="min-w-0 text-left">
                                    <div className="text-[9px] font-fira uppercase tracking-[0.2em] text-slate-500">Archive</div>
                                    <div className="mt-0.5 truncate text-[12px] font-rajdhani font-bold text-white/92">
                                        {hasInventorySpotlight
                                            ? (inventorySpotlight?.title || '전리품 검토')
                                            : activeMobileTab.label}
                                    </div>
                                </div>
                                {hasInventorySpotlight && (
                                    <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>
                                )}
                            </div>
                            <div className="shrink-0 rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-300/72 transition-colors group-hover:text-white">
                                <span className="inline-flex items-center gap-1">
                                    Open
                                    <ChevronUp size={12} />
                                </span>
                            </div>
                        </button>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {archiveOpen && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 z-40 bg-[rgba(5,7,10,0.74)] backdrop-blur-md"
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
                                className="panel-noise aether-surface-strong absolute inset-x-0 bottom-0 max-h-[72dvh] rounded-t-[1.9rem] border-t px-3.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_60px_rgba(2,8,20,0.45)]"
                            >
                                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/12" />
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">Archive</div>
                                        <div className="mt-1 text-[15px] font-rajdhani font-bold text-white/92">
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
                                        className="min-h-[38px] rounded-full border border-white/8 bg-black/20 px-3 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-300/78"
                                    >
                                        닫기
                                    </button>
                                </div>

                                {hasInventorySpotlight && (
                                    <div
                                        data-testid="inventory-spotlight"
                                        className="mt-3 rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/8 px-3 py-2.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-fira uppercase tracking-[0.16em] text-[#f6e7c8]/78">
                                                {inventorySpotlight?.title || '전리품 주목'}
                                            </span>
                                            <SignalBadge tone="spotlight" size="sm">검토</SignalBadge>
                                        </div>
                                        <div className="mt-1 text-[11px] font-fira text-slate-300/80 leading-snug">
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

                                <div className="mt-3 max-h-[42dvh] overflow-y-auto custom-scrollbar pr-1 rounded-[1.15rem] border border-white/8 bg-black/18 px-1 py-1">
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
        <aside className="hidden md:flex h-full min-h-0 w-full">
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
            className={`panel-noise aether-surface flex min-h-0 flex-1 flex-col overflow-hidden ${useCompactDesktopRail ? 'rounded-[1.05rem] p-1.25' : 'rounded-[1.25rem] p-2'}`}
        >
                <div className={`${useCompactDesktopRail ? 'mb-0.25' : 'mb-1.5'} flex items-center justify-between gap-2`}>
                    <div className="min-w-0 flex items-center gap-1.5">
                        <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            Archive
                        </div>
                        <div className={`${useCompactDesktopRail ? 'text-[11px]' : 'text-[13px]'} truncate font-rajdhani font-bold text-white/92`}>
                            {activeDesktopTab.label || 'Inventory'}
                        </div>
                    </div>
                    {hasInventorySpotlight && (
                        <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>
                    )}
                </div>

                {useCompactDesktopRail ? (
                    <div className="grid grid-cols-4 gap-[3px]">
                        {TAB_ITEMS.map((tab) => (
                            <ArchiveTabButton
                                key={tab.id}
                                icon={tab.icon}
                                label={tab.label}
                                active={sideTab === tab.id}
                                onClick={() => handleTabSelect(tab.id)}
                                compact
                                dense
                                iconOnly
                                testId={`dashboard-tab-${tab.id}`}
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-1">
                            {primaryDesktopTabs.map((tab) => (
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
                        <div className="mt-1 grid grid-cols-5 gap-1">
                            {secondaryDesktopTabs.map((tab) => (
                                <ArchiveTabButton
                                    key={tab.id}
                                    icon={tab.icon}
                                    label={tab.label}
                                    active={sideTab === tab.id}
                                    onClick={() => handleTabSelect(tab.id)}
                                    compact
                                    dense
                                    iconOnly
                                    testId={`dashboard-tab-${tab.id}`}
                                />
                            ))}
                        </div>
                    </>
                )}

                {hasInventorySpotlight && (
                    <div className={`${useCompactDesktopRail ? 'mt-0.75 rounded-[0.8rem] px-1.75 py-0.75' : 'mt-1.5 rounded-[0.9rem] px-2 py-1.5'} border border-[#d5b180]/18 bg-[#d5b180]/8`}>
                        <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-[#f6e7c8]/76">
                            {inventorySpotlight?.title || '전리품 주목'}
                        </div>
                        <div className={`${useCompactDesktopRail ? 'mt-0.5 text-[9px]' : 'mt-1 text-[10px]'} font-fira leading-relaxed text-slate-300/82`}>
                            {inventorySpotlight?.detail || '획득한 장비와 소모품을 바로 확인하세요.'}
                        </div>
                    </div>
                )}

                <div className={`${useCompactDesktopRail ? 'mt-0.5 rounded-[0.8rem] p-[3px]' : 'mt-1.5 rounded-[0.95rem] p-1'} min-h-0 flex-1 overflow-hidden border border-white/8 bg-black/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
                    <div className={`h-full overflow-y-auto custom-scrollbar ${useCompactDesktopRail ? 'px-[3px] pr-0' : 'px-0.5 pr-0.5'}`}>
                        {renderTabContent()}
                    </div>
                </div>
            </Motion.div>
        </aside>
    );
};

export default Dashboard;
