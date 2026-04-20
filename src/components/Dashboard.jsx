import React, { useEffect, useState } from 'react';
import { Package, Scroll, Zap, Map, Trophy, BookOpen, BarChart3, Eye, ChevronUp, Star, Skull, Moon, GraduationCap, Hammer, RotateCcw, X, Shield } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { GS } from '../reducers/gameStates';
import ArchiveTabButton from './ArchiveTabButton';
import DashboardMobileSummary from './DashboardMobileSummary';
import EquipmentPanel from './EquipmentPanel';
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
    { id: 'equipment', icon: Shield, label: 'Equipment', mobileLabel: 'GEAR' },
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

const MOBILE_PRIMARY_TABS = ['equipment', 'inventory', 'quest', 'map', 'stats'];
const MOBILE_SECONDARY_TABS = ['achievements', 'skills', 'codex', 'pass', 'graves', 'system'];
const TOWN_MENU_ACTIONS = [
    { id: 'rest', label: 'REST', icon: Moon },
    { id: 'class', label: 'CLASS', icon: GraduationCap },
    { id: 'quest', label: 'QUEST', icon: Scroll },
    { id: 'craft', label: 'CRAFT', icon: Hammer },
];

// NOTE: 이전에 AnimatePresence + tabVariants로 탭 전환 애니메이션을 처리했으나,
// mode="wait"가 key 전환 시 stale 상태로 고착되는 회귀가 있어 (모바일 Menu Console에서
// INV/GEAR/CODEX 클릭 시 탭 콘텐츠가 갱신되지 않는 버그) plain div로 전환.
// 필요 시 framer-motion 업그레이드 후 재도입 검토.

const Dashboard = ({ player, grave, sideTab, setSideTab, actions, stats, mobileSection = 'full', quickSlots = [null, null, null], runtime = null, inventorySpotlight = null, onClearInventorySpotlight = null, consoleExpanded = false, onReturnToLog = null }) => {
    const [mobileArchiveExpanded, setMobileArchiveExpanded] = useState(false);
    const [dockSeen, setDockSeen] = useState(() => sessionStorage.getItem('archiveDockSeen') === '1');
    const [confirmMenuReset, setConfirmMenuReset] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';
    const isInlineArchiveConsole = mobileSection === 'console';
    const hasInventorySpotlight = Boolean(inventorySpotlight?.token) && sideTab === 'inventory';
    const hasCompletableQuest = (player?.quests || []).some(q => q.done && !q.claimed);
    const showNotifDot = hasInventorySpotlight || hasCompletableQuest;
    const showArchiveDock = runtime?.mobileArchiveDockVisible ?? true;
    const archiveOpen = showArchiveDock && (hasInventorySpotlight || mobileArchiveExpanded);
    const primaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_PRIMARY_TABS.includes(tab.id));
    const secondaryMobileTabs = TAB_ITEMS.filter((tab) => MOBILE_SECONDARY_TABS.includes(tab.id));
    const activeMobileTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];
    const ActiveArchiveIcon = activeMobileTab.icon;
    const handleTabSelect = (tabId) => {
        setConfirmMenuReset(false);
        setSideTab(tabId);
        setMobileArchiveExpanded(true);
    };
    const handleMenuAction = (actionId) => {
        if (actionId !== 'reset') {
            setConfirmMenuReset(false);
        }
        if (actionId === 'rest') {
            actions.rest?.();
            return;
        }
        if (actionId === 'class') {
            actions.setGameState?.(GS.JOB_CHANGE);
            return;
        }
        if (actionId === 'quest') {
            handleTabSelect('quest');
            return;
        }
        if (actionId === 'craft') {
            actions.setGameState?.(GS.CRAFTING);
            return;
        }
        if (actionId === 'reset') {
            setConfirmMenuReset(true);
        }
    };

    useEffect(() => {
        if (showArchiveDock) return;
        const closeTimer = window.requestAnimationFrame(() => setMobileArchiveExpanded(false));
        return () => window.cancelAnimationFrame(closeTimer);
    }, [showArchiveDock]);

    const renderTabContent = () => {
        const desktopArchiveCompact = false;
        return (
            <div
                key={typeof sideTab === 'string' ? sideTab : 'inventory'}
                className="space-y-2 pr-1"
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

                    {sideTab === 'equipment' && (
                        <EquipmentPanel
                            player={player}
                            stats={stats}
                            actions={actions}
                            compact={desktopArchiveCompact}
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
            </div>
        );
    };

    const renderMobileArchiveRail = (items) => (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {items.map((tab) => (
                <ArchiveTabButton
                    key={tab.id}
                    icon={tab.icon}
                    label={tab.mobileLabel || tab.label}
                    active={sideTab === tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    compact
                    rail
                    testId={`dashboard-tab-${tab.id}`}
                />
            ))}
        </div>
    );

    const renderResetRailButton = () => (
        <button
            type="button"
            data-testid="menu-reset"
            onClick={() => setConfirmMenuReset(true)}
            className="flex min-h-[32px] shrink-0 items-center justify-center gap-1 rounded-full border border-rose-300/18 bg-[linear-gradient(180deg,rgba(54,18,24,0.58)_0%,rgba(18,9,12,0.92)_100%)] px-2 py-1 text-[8px] font-fira uppercase tracking-[0.1em] text-rose-100/82 transition-colors hover:border-rose-200/26 hover:bg-rose-500/12"
            title="RESET"
        >
            <RotateCcw size={11} />
            <span>RESET</span>
        </button>
    );

    if (mobileSection === 'summary') {
        return <DashboardMobileSummary player={player} />;
    }

    if (isInlineArchiveConsole) {
        if (!showArchiveDock && !consoleExpanded) {
            return null;
        }

        const inlineArchiveOpen = consoleExpanded ? true : archiveOpen;

        return (
            <div
                data-testid="mobile-archive-console"
                className={`panel-noise aether-surface-strong rounded-[1.55rem] border border-white/10 px-3 py-2.5 shadow-[0_18px_34px_rgba(4,10,18,0.24)] ${consoleExpanded ? 'flex min-h-0 flex-1 flex-col' : 'shrink-0'}`}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <ActiveArchiveIcon size={14} />
                        </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/70">Menu Console</div>
                                <div className="mt-0.5 flex items-center gap-2">
                                <span className="truncate text-[14px] font-rajdhani font-bold text-white/92">
                                    {hasInventorySpotlight
                                        ? (inventorySpotlight?.title || MSG.UI_LOOT_REVIEW)
                                        : activeMobileTab.label}
                                </span>
                                {showNotifDot && (
                                    <SignalBadge tone="spotlight" size="sm">
                                        {hasInventorySpotlight ? MSG.UI_NOTABLE : MSG.UI_REFRESH}
                                    </SignalBadge>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        data-testid={onReturnToLog ? 'mobile-console-return-log' : 'mobile-archive-toggle'}
                        onClick={() => {
                            if (onReturnToLog) {
                                setConfirmMenuReset(false);
                                onReturnToLog();
                                return;
                            }

                            setMobileArchiveExpanded((open) => {
                                const nextOpen = !open;
                                if (!nextOpen) {
                                    setConfirmMenuReset(false);
                                }
                                return nextOpen;
                            });
                            if (!dockSeen) {
                                setDockSeen(true);
                                sessionStorage.setItem('archiveDockSeen', '1');
                            }
                        }}
                        className={`shrink-0 rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-300/78 ${
                            !dockSeen && !inlineArchiveOpen && !onReturnToLog ? 'shadow-[0_0_0_1px_rgba(125,212,216,0.16)]' : ''
                        }`}
                    >
                        {onReturnToLog ? MSG.UI_CLOSE : (inlineArchiveOpen ? MSG.UI_CLOSE : MSG.UI_OPEN)}
                    </button>
                </div>

                <AnimatePresence initial={false}>
                    {inlineArchiveOpen && (
                        <Motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={consoleExpanded ? 'mt-2.5 flex min-h-0 flex-1 flex-col gap-2.5' : 'mt-2.5 space-y-2.5'}
                        >
                            {hasInventorySpotlight && (
                                <div
                                    data-testid="inventory-spotlight"
                                    className="shrink-0 rounded-[1.1rem] border border-[#d5b180]/18 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.16),transparent_24%),linear-gradient(180deg,rgba(41,29,14,0.26)_0%,rgba(18,13,8,0.18)_100%)] px-3 py-2.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-fira uppercase tracking-[0.16em] text-[#f6e7c8]/78">
                                            {inventorySpotlight?.title || MSG.UI_LOOT_FOCUS}
                                        </span>
                                        <SignalBadge tone="spotlight" size="sm">{MSG.UI_REVIEW}</SignalBadge>
                                    </div>
                                    <div className="mt-1 text-[11px] font-fira text-slate-300/80 leading-snug">
                                        {inventorySpotlight?.detail || MSG.UI_LOOT_FOCUS_HINT}
                                    </div>
                                </div>
                            )}

                            {isInSafeZone && (
                                <div className="shrink-0 rounded-[1.15rem] border border-[#d5b180]/14 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.12),transparent_22%),linear-gradient(180deg,rgba(26,20,12,0.28)_0%,rgba(12,10,8,0.18)_100%)] px-2 py-2">
                                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/72">Town Ops</div>
                                        <SignalBadge tone="recommended" size="sm">SAFE ZONE</SignalBadge>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TOWN_MENU_ACTIONS.map((action) => {
                                            const Icon = action.icon;
                                            return (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    data-testid={`menu-town-${action.id}`}
                                                    onClick={() => handleMenuAction(action.id)}
                                                    className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-[1rem] border border-white/8 bg-black/20 px-2 py-2 text-[8px] font-fira uppercase tracking-[0.14em] text-slate-200/84 transition-colors hover:border-[#d5b180]/18 hover:bg-white/[0.05]"
                                                >
                                                    <Icon size={13} />
                                                    <span>{action.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="shrink-0 rounded-[1.15rem] border border-white/8 bg-black/18 px-2 py-2">
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    {primaryMobileTabs.map((tab) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            rail
                                            testId={`dashboard-tab-${tab.id}`}
                                        />
                                    ))}
                                    {renderResetRailButton()}
                                </div>
                                <div className="mt-2 border-t border-white/6 pt-2">
                                    {renderMobileArchiveRail(secondaryMobileTabs)}
                                </div>
                            </div>

                            {confirmMenuReset && (
                                <div className="shrink-0 rounded-[1.15rem] border border-rose-300/16 bg-[linear-gradient(180deg,rgba(54,18,24,0.34)_0%,rgba(18,9,12,0.78)_100%)] px-2 py-2">
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-300/16 bg-black/16 text-rose-100/84">
                                            <RotateCcw size={13} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-rose-100/58">Run Reset</div>
                                            <div className="text-[11px] font-fira text-rose-100/84">현재 진행 상황을 초기화합니다.</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            data-testid="menu-reset-confirm"
                                            onClick={() => {
                                                setConfirmMenuReset(false);
                                                actions.reset?.();
                                            }}
                                            className="flex min-h-[42px] items-center justify-center gap-2 rounded-[1rem] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] px-2 py-2 text-[9px] font-fira uppercase tracking-[0.14em] text-rose-100/88 transition-colors hover:border-rose-200/28 hover:bg-rose-500/14"
                                        >
                                            <RotateCcw size={13} />
                                            <span>RESET OK</span>
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="menu-reset-cancel"
                                            onClick={() => setConfirmMenuReset(false)}
                                            className="flex min-h-[42px] items-center justify-center gap-2 rounded-[1rem] border border-white/8 bg-black/20 px-2 py-2 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-200/84 transition-colors hover:border-white/14 hover:bg-white/[0.05]"
                                        >
                                            <X size={13} />
                                            <span>CANCEL</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div
                                data-testid="mobile-archive-console-content"
                                className={`${consoleExpanded ? 'min-h-0 flex-1' : 'max-h-[15.5rem]'} overflow-y-auto custom-scrollbar rounded-[1.2rem] border border-white/8 bg-black/18 px-2 py-2`}
                            >
                                {renderTabContent()}
                            </div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>
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
                        className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 z-30 w-[min(calc(100%-1.5rem),22rem)] -translate-x-1/2"
                    >
                        <button
                            type="button"
                            data-testid="mobile-archive-open"
                            onClick={() => { setMobileArchiveExpanded(true); if (!dockSeen) { setDockSeen(true); sessionStorage.setItem('archiveDockSeen', '1'); } }}
                            className={`panel-noise aether-surface-strong group relative flex w-full items-center justify-between gap-3 rounded-[1.25rem] px-3 py-2.5 overflow-hidden ${!dockSeen ? 'animate-bounce' : ''}`}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(213,177,128,0.12), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%)' }} />
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                    <ActiveArchiveIcon size={14} />
                                </div>
                                <div className="min-w-0 text-left">
                                    <div className="text-[11px] font-fira uppercase tracking-[0.2em] text-slate-400/68">Archive Dock</div>
                                    <div className="mt-0.5 truncate text-[13px] font-rajdhani font-bold text-white/92">
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
                            {showNotifDot && (
                                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#d5b180] shadow-[0_0_6px_rgba(213,177,128,0.6)] animate-pulse" />
                            )}
                        </button>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {archiveOpen && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-[rgba(5,7,10,0.74)] backdrop-blur-md"
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
                                className="panel-noise aether-surface-strong absolute inset-x-0 bottom-0 max-h-[72dvh] rounded-t-[2rem] border-t px-3.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_60px_rgba(2,8,20,0.45)]"
                            >
                                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/12" />
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/68">Archive</div>
                                        <div className="mt-1 text-[16px] font-rajdhani font-bold text-white/92">
                                            {hasInventorySpotlight
                                                ? (inventorySpotlight?.title || MSG.UI_LOOT_REVIEW)
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
                                        {MSG.UI_CLOSE}
                                    </button>
                                </div>

                                {hasInventorySpotlight && (
                                    <div
                                        data-testid="inventory-spotlight"
                                        className="mt-3 rounded-[1.1rem] border border-[#d5b180]/18 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.16),transparent_24%),linear-gradient(180deg,rgba(41,29,14,0.26)_0%,rgba(18,13,8,0.18)_100%)] px-3 py-2.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-fira uppercase tracking-[0.16em] text-[#f6e7c8]/78">
                                                {inventorySpotlight?.title || MSG.UI_LOOT_FOCUS}
                                            </span>
                                            <SignalBadge tone="spotlight" size="sm">{MSG.UI_REVIEW}</SignalBadge>
                                        </div>
                                        <div className="mt-1 text-[11px] font-fira text-slate-300/80 leading-snug">
                                            {inventorySpotlight?.detail || MSG.UI_LOOT_FOCUS_HINT}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-4 gap-2">
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
                                <div className="mt-2 grid grid-cols-4 gap-2">
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

                                <div className="mt-3 max-h-[42dvh] overflow-y-auto custom-scrollbar pr-1 rounded-[1.2rem] border border-white/8 bg-black/18 px-1 py-1">
                                    {renderTabContent()}
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </>
        );
};

export default Dashboard;
