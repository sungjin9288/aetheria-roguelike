import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
    BarChart3,
    BookOpen,
    Eye,
    Map,
    Package,
    RotateCcw,
    Scroll,
    Shield,
    Skull,
    Star,
    Trophy,
    X,
    Zap,
} from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getSignatureDiscoveryProgress } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';
import ArchiveTabButton from './ArchiveTabButton';
import EquipmentPanel from './EquipmentPanel';
import SignalBadge from './SignalBadge';
import SmartInventory from './SmartInventory';

const AchievementPanel = lazy(() => import('./AchievementPanel'));
const BuildAdvicePanel = lazy(() => import('./BuildAdvicePanel'));
const Codex = lazy(() => import('./Codex'));
const GravePanel = lazy(() => import('./GravePanel'));
const MapNavigator = lazy(() => import('./MapNavigator'));
const SkillTreePreview = lazy(() => import('./SkillTreePreview'));
const StatsPanel = lazy(() => import('./StatsPanel'));
const QuestTab = lazy(() => import('./tabs/QuestTab'));
const SeasonPassPanel = lazy(() => import('./tabs/SeasonPassPanel'));
const SystemTab = lazy(() => import('./tabs/SystemTab'));

const TabSpinner = () => (
    <div className="flex items-center justify-center py-8 text-[10px] font-readable text-slate-500">
        불러오는 중…
    </div>
);

interface DashboardProps {
    player: Player;
    grave?: any;
    sideTab?: string;
    setSideTab?: (tab: string) => void;
    actions?: any;
    stats?: any;
    quickSlots?: any[];
    runtime?: any;
    inventorySpotlight?: any;
    onClearInventorySpotlight?: any;
    onReturnToLog?: any;
}

const TAB_ITEMS: any[] = [
    { id: 'equipment', icon: Shield, label: '장비' },
    { id: 'inventory', icon: Package, label: '가방' },
    { id: 'quest', icon: Scroll, label: '임무' },
    { id: 'achievements', icon: Trophy, label: '업적' },
    { id: 'skills', icon: BookOpen, label: '기술' },
    { id: 'map', icon: Map, label: '지도' },
    { id: 'stats', icon: BarChart3, label: '상태' },
    { id: 'codex', icon: Eye, label: '도감' },
    { id: 'pass', icon: Star, label: '시즌' },
    { id: 'graves', icon: Skull, label: '무덤' },
    { id: 'system', icon: Zap, label: '설정' },
];

const Dashboard = ({
    player,
    grave,
    sideTab,
    setSideTab,
    actions,
    stats,
    quickSlots,
    runtime,
    inventorySpotlight,
    onClearInventorySpotlight = null,
    onReturnToLog,
}: DashboardProps) => {
    const [confirmMenuReset, setConfirmMenuReset] = useState(false);
    const archiveRailRef = useRef<HTMLDivElement>(null);
    const isInSafeZone = DB.MAPS[player?.loc as string]?.type === 'safe';
    const hasInventorySpotlight = Boolean(inventorySpotlight?.token) && sideTab === 'inventory';
    const hasCompletableQuest = (player?.quests || []).some((quest: any) => quest.done && !quest.claimed);
    const activeTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];
    const ActiveTabIcon = activeTab.icon;

    const signatureProgress = getSignatureDiscoveryProgress(player);
    const signatureBadge = signatureProgress.discovered > 0
        ? `${signatureProgress.discovered}/${signatureProgress.total}`
        : null;
    const signatureBadgeTitle = signatureProgress.discovered > 0
        ? `전설 각인 ${signatureProgress.discovered}/${signatureProgress.total} 수집 (${signatureProgress.percent}%)`
        : null;

    const getTabExtras = (tabId: string) => {
        if (tabId !== 'codex' || !signatureBadge) return {};
        return { badge: signatureBadge, badgeTitle: signatureBadgeTitle };
    };

    const selectTab = (tabId: string) => {
        setConfirmMenuReset(false);
        setSideTab?.(tabId);
    };

    useEffect(() => {
        const rail = archiveRailRef.current;
        const selectedTab = rail?.querySelector<HTMLElement>(`[data-testid="archive-tab-${sideTab}"]`);
        if (!rail || !selectedTab) return;

        const selectedCenter = selectedTab.offsetLeft + (selectedTab.offsetWidth / 2);
        rail.scrollLeft = Math.max(0, selectedCenter - (rail.clientWidth / 2));
    }, [sideTab]);

    const renderTabContent = () => (
        <div key={typeof sideTab === 'string' ? sideTab : 'inventory'} className="space-y-2 pr-1">
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
                <EquipmentPanel player={player} stats={stats} actions={actions} />
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
                        <MapNavigator player={player} grave={grave} stats={stats} />
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

    return (
        <section
            data-testid="mobile-archive-console"
            className="panel-noise aether-surface-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.55rem] border border-white/10 px-3 py-2.5 shadow-[0_18px_34px_rgba(4,10,18,0.24)]"
        >
            <header className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <ActiveTabIcon size={15} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-readable text-slate-400/70">모험 기록</div>
                        <div className="mt-0.5 flex items-center gap-2">
                            <h2 className="truncate text-[15px] font-readable font-bold text-white/92">
                                {hasInventorySpotlight
                                    ? (inventorySpotlight?.title || MSG.UI_LOOT_REVIEW)
                                    : activeTab.label}
                            </h2>
                            {(hasInventorySpotlight || hasCompletableQuest) && (
                                <SignalBadge tone="spotlight" size="sm">
                                    {hasInventorySpotlight ? MSG.UI_NOTABLE : MSG.UI_REFRESH}
                                </SignalBadge>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    data-testid="mobile-console-return-log"
                    onClick={() => {
                        setConfirmMenuReset(false);
                        onReturnToLog?.();
                    }}
                    className="min-h-[44px] shrink-0 rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-[10px] font-readable text-slate-300/78 transition-colors hover:border-white/14 hover:text-white"
                >
                    {MSG.UI_CLOSE}
                </button>
            </header>

            <nav
                ref={archiveRailRef}
                data-testid="archive-tab-rail"
                aria-label="모험 기록 선택"
                className="custom-scrollbar mt-2 flex shrink-0 gap-2 overflow-x-auto border-y border-white/8 py-1.5"
            >
                {TAB_ITEMS.map((tab) => (
                    <ArchiveTabButton
                        key={tab.id}
                        icon={tab.icon}
                        label={tab.label}
                        active={sideTab === tab.id}
                        onClick={() => selectTab(tab.id)}
                        compact
                        rail
                        testId={`archive-tab-${tab.id}`}
                        {...getTabExtras(tab.id)}
                    />
                ))}
            </nav>

            {hasInventorySpotlight && (
                <div
                    data-testid="inventory-spotlight"
                    className="mt-2 shrink-0 border-b border-[#d5b180]/18 px-1 pb-2"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-readable text-[#f6e7c8]/78">
                            {inventorySpotlight?.title || MSG.UI_LOOT_FOCUS}
                        </span>
                        <SignalBadge tone="spotlight" size="sm">{MSG.UI_REVIEW}</SignalBadge>
                    </div>
                    <p className="mt-1 text-[11px] font-readable leading-snug text-slate-300/80">
                        {inventorySpotlight?.detail || MSG.UI_LOOT_FOCUS_HINT}
                    </p>
                </div>
            )}

            <div
                data-testid="mobile-archive-console-content"
                className="custom-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto"
            >
                {renderTabContent()}

                {sideTab === 'system' && (
                    <section
                        data-testid="system-reset-section"
                        className="mt-3 border-t border-rose-300/14 px-1 pb-2 pt-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[12px] font-readable font-bold text-rose-100/88">진행 초기화</h3>
                                <p className="mt-1 text-[10px] font-readable text-slate-400/78">
                                    현재 모험을 지우고 처음부터 시작합니다.
                                </p>
                            </div>
                            <button
                                type="button"
                                data-testid="menu-reset"
                                onClick={() => setConfirmMenuReset(true)}
                                className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-rose-300/18 bg-rose-950/28 px-3 py-1.5 text-[10px] font-readable text-rose-100/84 transition-colors hover:border-rose-200/28 hover:bg-rose-900/34"
                                title="진행 초기화"
                            >
                                <RotateCcw size={13} />
                                <span>초기화</span>
                            </button>
                        </div>

                        {confirmMenuReset && (
                            <div className="mt-2 border-t border-rose-300/12 pt-2">
                                <p className="text-[11px] font-readable text-rose-100/82">
                                    지금까지의 진행 상황을 정말 지울까요?
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        data-testid="menu-reset-confirm"
                                        onClick={() => {
                                            setConfirmMenuReset(false);
                                            actions.reset?.();
                                        }}
                                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-[0.9rem] border border-rose-300/20 bg-rose-950/48 px-2 py-2 text-[10px] font-readable text-rose-100/88 transition-colors hover:border-rose-200/30 hover:bg-rose-900/54"
                                    >
                                        <RotateCcw size={13} />
                                        <span>초기화</span>
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="menu-reset-cancel"
                                        onClick={() => setConfirmMenuReset(false)}
                                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-[0.9rem] border border-white/8 bg-black/20 px-2 py-2 text-[10px] font-readable text-slate-200/84 transition-colors hover:border-white/14 hover:bg-white/[0.05]"
                                    >
                                        <X size={13} />
                                        <span>취소</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </section>
    );
};

export default Dashboard;
