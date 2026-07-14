import { useEffect, useState, lazy, Suspense } from 'react';
import { Package, Scroll, Zap, Map, Trophy, BookOpen, BarChart3, Eye, ChevronUp, Star, Skull, Moon, GraduationCap, Hammer, RotateCcw, X, Shield } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { GS } from '../reducers/gameStates';
import ArchiveTabButton from './ArchiveTabButton';
import { getSignatureDiscoveryProgress } from '../data/signatureItems.js';
import DashboardMobileSummary from './DashboardMobileSummary';
// Default 탭(inventory/equipment)은 즉시 import — 사용자가 가장 먼저 보는 화면.
import EquipmentPanel from './EquipmentPanel';
import SmartInventory from './SmartInventory';
import SignalBadge from './SignalBadge';
import type { Player } from '../types/index.js';

// 비-default 탭은 lazy import — 사용자가 탭을 클릭해야 로드 (cycle 61 perf).
const AchievementPanel = lazy(() => import('./AchievementPanel'));
const SkillTreePreview = lazy(() => import('./SkillTreePreview'));
const MapNavigator = lazy(() => import('./MapNavigator'));
const BuildAdvicePanel = lazy(() => import('./BuildAdvicePanel'));
const StatsPanel = lazy(() => import('./StatsPanel'));
const Codex = lazy(() => import('./Codex'));
const GravePanel = lazy(() => import('./GravePanel'));
const QuestTab = lazy(() => import('./tabs/QuestTab'));
const SystemTab = lazy(() => import('./tabs/SystemTab'));
const SeasonPassPanel = lazy(() => import('./tabs/SeasonPassPanel'));

const TabSpinner = () => (
    <div className="flex items-center justify-center py-8 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
        불러오는 중…
    </div>
);

// cycle 401: `mobile?: boolean;` 제거 — Dashboard 본체 destructure 미사용 +
//   변수 read 0건. MobileGameLayout이 prop pass했으나 silent dropped (paired remove).
//   mobileSection / mobileLabel / mobileFocused는 별개 식별자로 보존.
interface DashboardProps {
    player: Player;
    grave?: any;
    sideTab?: string;
    setSideTab?: (tab: string) => void;
    actions?: any;
    stats?: any;
    mobileSection?: string;
    quickSlots?: any[];
    runtime?: any;
    inventorySpotlight?: any;
    onClearInventorySpotlight?: any;
    consoleExpanded?: boolean;
    onReturnToLog?: any;
}

const TAB_ITEMS: any = [
    { id: 'equipment', icon: Shield, label: '장비', mobileLabel: '장비' },
    { id: 'inventory', icon: Package, label: '가방', mobileLabel: '가방' },
    { id: 'quest', icon: Scroll, label: '임무', mobileLabel: '임무' },
    { id: 'achievements', icon: Trophy, label: '업적', mobileLabel: '업적' },
    { id: 'skills', icon: BookOpen, label: '기술', mobileLabel: '기술' },
    { id: 'map', icon: Map, label: '지도', mobileLabel: '지도' },
    { id: 'stats', icon: BarChart3, label: '상태', mobileLabel: '상태' },
    { id: 'codex', icon: Eye, label: '도감', mobileLabel: '도감' },
    { id: 'pass', icon: Star, label: '시즌', mobileLabel: '시즌' },
    { id: 'graves', icon: Skull, label: '무덤', mobileLabel: '무덤' },
    { id: 'system', icon: Zap, label: '설정', mobileLabel: '설정' }
];

const MOBILE_PRIMARY_TABS: any = ['equipment', 'inventory', 'quest', 'map', 'stats'];
const MOBILE_SECONDARY_TABS: any = ['achievements', 'skills', 'codex', 'pass', 'graves', 'system'];
const TOWN_MENU_ACTIONS: any = [
    { id: 'rest', label: '휴식', icon: Moon },
    { id: 'class', label: '전직', icon: GraduationCap },
    { id: 'quest', label: '임무', icon: Scroll },
    { id: 'craft', label: '제작', icon: Hammer },
];

// NOTE: 이전에 AnimatePresence + tabVariants로 탭 전환 애니메이션을 처리했으나,
// mode="wait"가 key 전환 시 stale 상태로 고착되는 회귀가 있어 (모바일 메뉴 화면에서
// INV/GEAR/CODEX 클릭 시 탭 콘텐츠가 갱신되지 않는 버그) plain div로 전환.
// 필요 시 framer-motion 업그레이드 후 재도입 검토.

// cycle 572: 6 defaults partial batch 제거 (mobileSection/quickSlots/runtime/
//   inventorySpotlight/consoleExpanded/onReturnToLog) — 1 production caller
//   (MobileGameLayout:63) 모두 명시 전달이라 도달 불가. onClearInventorySpotlight
//   default null은 MobileGameLayout 미전달이라 reachable 보존. 가장 큰
//   single-cycle batch (6 default), partial cleanup 5번째. 청소 메가 시리즈
//   64번째.
const Dashboard = ({ player, grave, sideTab, setSideTab, actions, stats, mobileSection, quickSlots, runtime, inventorySpotlight, onClearInventorySpotlight = null, consoleExpanded, onReturnToLog }: DashboardProps) => {
    const [mobileArchiveExpanded, setMobileArchiveExpanded] = useState(false);
    const [dockSeen, setDockSeen] = useState(() => sessionStorage.getItem('archiveDockSeen') === '1');
    const [confirmMenuReset, setConfirmMenuReset] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc as string]?.type === 'safe';
    const isInlineArchiveConsole = mobileSection === 'console';
    const hasInventorySpotlight = Boolean(inventorySpotlight?.token) && sideTab === 'inventory';
    const hasCompletableQuest = (player?.quests || []).some((q: any) => q.done && !q.claimed);
    const showNotifDot = hasInventorySpotlight || hasCompletableQuest;
    const showArchiveDock = runtime?.mobileArchiveDockVisible ?? true;
    const archiveOpen = showArchiveDock && (hasInventorySpotlight || mobileArchiveExpanded);
    const primaryMobileTabs = TAB_ITEMS.filter((tab: any) => MOBILE_PRIMARY_TABS.includes(tab.id));
    const secondaryMobileTabs = TAB_ITEMS.filter((tab: any) => MOBILE_SECONDARY_TABS.includes(tab.id));
    const activeMobileTab = TAB_ITEMS.find((tab: any) => tab.id === sideTab) || TAB_ITEMS[0];
    const ActiveArchiveIcon = activeMobileTab.icon;
    const handleTabSelect = (tabId: any) => {
        setConfirmMenuReset(false);
        setSideTab?.(tabId);
        setMobileArchiveExpanded(true);
    };

    // Signature 도감 진행도 — Codex 탭 뱃지로 "X/Y" 표시해 at-a-glance 컬렉션 진행도 제공.
    // 전설 각인을 하나도 수집하지 못한 상태에서는 뱃지를 숨겨 UI 노이즈 방지.
    const signatureProgress = getSignatureDiscoveryProgress(player);
    const signatureBadge = signatureProgress.discovered > 0
        ? `${signatureProgress.discovered}/${signatureProgress.total}`
        : null;
    const signatureBadgeTitle = signatureProgress.discovered > 0
        ? `전설 각인 ${signatureProgress.discovered}/${signatureProgress.total} 수집 (${signatureProgress.percent}%)`
        : null;
    /** 탭 id에 따라 추가 badge prop을 반환 (Codex만 signature 진행도 뱃지 부착). */
    const getTabExtras = (tabId: any) => {
        if (tabId === 'codex' && signatureBadge) {
            return { badge: signatureBadge, badgeTitle: signatureBadgeTitle };
        }
        return {};
    };
    // cycle 444: 'reset' actionId 가드 / 분기 제거 — TOWN_MENU_ACTIONS는 rest /
    //   class / quest / craft 4 entries만 emit. 'reset' actionId 전달 caller 0건.
    //   confirmMenuReset state는 별도 caller (직접 button onClick)가 set.
    const handleMenuAction = (actionId: any) => {
        setConfirmMenuReset(false);
        if (actionId === 'rest') {
            actions.rest?.();
            return;
        }
        if (actionId === 'class') {
            actions.setGameState?.(GS.JOB_CHANGE);
            return;
        }
        if (actionId === 'quest') {
            actions.setGameState?.(GS.QUEST_BOARD);
            return;
        }
        if (actionId === 'craft') {
            actions.setGameState?.(GS.CRAFTING);
        }
    };

    useEffect(() => {
        if (showArchiveDock) return;
        const closeTimer = window.requestAnimationFrame(() => setMobileArchiveExpanded(false));
        return () => window.cancelAnimationFrame(closeTimer);
    }, [showArchiveDock]);

    // cycle 471: 데스크탑 컴팩트 플래그 const 제거 — reassign 0건의 unchanging
    //   false flag. 10 callsite의 compact prop 전달도 함께 제거 (cycle 452 정리한
    //   panel default 부재 + caller false 전달이라 undefined 수용 가능).
    const renderTabContent = () => {
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
                            onAssignQuickSlot={(index: any, item: any) => actions.setQuickSlot?.(index, item)}
                            spotlight={inventorySpotlight}
                            onClearSpotlight={onClearInventorySpotlight}
                        />
                    )}

                    {sideTab === 'equipment' && (
                        <EquipmentPanel
                            player={player}
                            stats={stats}
                            actions={actions}
                        />
                    )}

                    {sideTab === 'quest' && (
                        <Suspense fallback={<TabSpinner />}>
                            <QuestTab player={player} actions={actions} isInSafeZone={isInSafeZone} />
                        </Suspense>
                    )}

                    {sideTab === 'achievements' && (
                        <Suspense fallback={<TabSpinner />}>
                            <AchievementPanel player={player} actions={actions} />
                        </Suspense>
                    )}

                    {sideTab === 'skills' && (
                        <Suspense fallback={<TabSpinner />}>
                            <SkillTreePreview player={player} actions={actions} />
                        </Suspense>
                    )}

                    {sideTab === 'map' && (
                        <Suspense fallback={<TabSpinner />}>
                            <div className="space-y-3">
                                <MapNavigator
                                    player={player}
                                    grave={grave}
                                    stats={stats}
                                />
                                <BuildAdvicePanel player={player} />
                            </div>
                        </Suspense>
                    )}

                    {sideTab === 'stats' && (
                        <Suspense fallback={<TabSpinner />}>
                            <StatsPanel player={player} stats={stats} />
                        </Suspense>
                    )}

                    {sideTab === 'codex' && (
                        <Suspense fallback={<TabSpinner />}>
                            <Codex player={player} dispatch={actions?.dispatch} />
                        </Suspense>
                    )}

                    {sideTab === 'pass' && (
                        <Suspense fallback={<TabSpinner />}>
                            <SeasonPassPanel
                                player={player}
                                dispatch={actions?.dispatch}
                                onClaimSeasonReward={actions?.claimSeasonReward}
                            />
                        </Suspense>
                    )}

                    {sideTab === 'graves' && (
                        <Suspense fallback={<TabSpinner />}>
                            <GravePanel player={player} actions={actions} />
                        </Suspense>
                    )}

                    {sideTab === 'system' && (
                        <Suspense fallback={<TabSpinner />}>
                            <SystemTab player={player} actions={actions} stats={stats} runtime={runtime} />
                        </Suspense>
                    )}
            </div>
        );
    };

    const renderMobileArchiveRail = (items: any) => (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {items.map((tab: any) => (
                <ArchiveTabButton
                    key={tab.id}
                    icon={tab.icon}
                    label={tab.mobileLabel || tab.label}
                    active={sideTab === tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    compact
                    rail
                    testId={`dashboard-tab-${tab.id}`}
                    {...getTabExtras(tab.id)}
                />
            ))}
        </div>
    );

    const renderResetRailButton = () => (
        <button
            type="button"
            data-testid="menu-reset"
            onClick={() => setConfirmMenuReset(true)}
            className="flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-full border border-rose-300/18 bg-[linear-gradient(180deg,rgba(54,18,24,0.58)_0%,rgba(18,9,12,0.92)_100%)] px-3 py-1 text-[8px] font-fira uppercase tracking-[0.1em] text-rose-100/82 transition-colors hover:border-rose-200/26 hover:bg-rose-500/12"
            title="진행 초기화"
        >
            <RotateCcw size={11} />
            <span>초기화</span>
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
                                <div className="text-[10px] font-readable tracking-normal text-slate-400/70">모험 기록</div>
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

                            setMobileArchiveExpanded((open: any) => {
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
                        className={`min-h-[44px] shrink-0 rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-300/78 ${
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
                                        <div className="text-[10px] font-readable tracking-normal text-slate-400/72">마을에서 할 일</div>
                                        <SignalBadge tone="recommended" size="sm">안전지대</SignalBadge>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TOWN_MENU_ACTIONS.map((action: any) => {
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
                                    {primaryMobileTabs.map((tab: any) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            testId={`archive-tab-${tab.id}`}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            rail
                                            {...getTabExtras(tab.id)}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 border-t border-white/6 pt-2">
                                    {renderMobileArchiveRail(secondaryMobileTabs)}
                                </div>
                                <div className="mt-2 flex justify-end border-t border-white/6 pt-2">
                                    {renderResetRailButton()}
                                </div>
                            </div>

                            {confirmMenuReset && (
                                <div className="shrink-0 rounded-[1.15rem] border border-rose-300/16 bg-[linear-gradient(180deg,rgba(54,18,24,0.34)_0%,rgba(18,9,12,0.78)_100%)] px-2 py-2">
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-300/16 bg-black/16 text-rose-100/84">
                                            <RotateCcw size={13} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-readable tracking-normal text-rose-100/58">진행 초기화</div>
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
                                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-[1rem] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] px-2 py-2 text-[9px] font-fira uppercase tracking-[0.14em] text-rose-100/88 transition-colors hover:border-rose-200/28 hover:bg-rose-500/14"
                                        >
                                            <RotateCcw size={13} />
                                            <span>초기화</span>
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="menu-reset-cancel"
                                            onClick={() => setConfirmMenuReset(false)}
                                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-[1rem] border border-white/8 bg-black/20 px-2 py-2 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-200/84 transition-colors hover:border-white/14 hover:bg-white/[0.05]"
                                        >
                                            <X size={13} />
                                            <span>취소</span>
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
                                    <div className="text-[11px] font-readable tracking-normal text-slate-400/68">모험 기록</div>
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
                                    열기
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
                                onClick={(e: any) => e.stopPropagation()}
                                className="panel-noise aether-surface-strong absolute inset-x-0 bottom-0 max-h-[72dvh] rounded-t-[2rem] border-t px-3.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_60px_rgba(2,8,20,0.45)]"
                            >
                                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/12" />
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-readable tracking-normal text-slate-400/68">모험 기록</div>
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
                                    {primaryMobileTabs.map((tab: any) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            testId={`dashboard-tab-${tab.id}`}
                                            {...getTabExtras(tab.id)}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {secondaryMobileTabs.map((tab: any) => (
                                        <ArchiveTabButton
                                            key={tab.id}
                                            icon={tab.icon}
                                            label={tab.mobileLabel || tab.label}
                                            active={sideTab === tab.id}
                                            onClick={() => handleTabSelect(tab.id)}
                                            compact
                                            testId={`dashboard-tab-${tab.id}`}
                                            {...getTabExtras(tab.id)}
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
