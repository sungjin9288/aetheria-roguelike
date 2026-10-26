import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
    BarChart3,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Eye,
    Map,
    Package,
    RotateCcw,
    Scroll,
    Settings,
    Shield,
    Skull,
    Star,
    Trophy,
    X,
} from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getSignatureDiscoveryProgress } from '../utils/signatureDiscovery';
import { getClaimableQuestEntries } from '../utils/questProgress';
import type { FullStats, Player } from '../types/index.js';
import ArchiveTabButton from './ArchiveTabButton';
import EquipmentPanel from './EquipmentPanel';
import OverlayCloseButton from './OverlayCloseButton';
import Chip from './ui/Chip';
import SmartInventory from './SmartInventory';
import type { GameActions } from '../hooks/actionDeps';
import type { GameState } from '../reducers/gameReducer';
import type { SystemTabRuntime } from './tabs/SystemTab';
import { getJourneySurfaceText } from '../utils/journeyScope';
import { getPreferredScrollBehavior } from '../utils/scrollBehavior';

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
    <div role="status" className="flex items-center justify-center py-8 text-[12px] font-readable text-ae-ink-3">
        {MSG.ARCHIVE_TAB_LOADING}
    </div>
);

interface DashboardProps {
    player: Player;
    grave?: GameState['grave'];
    sideTab?: string;
    setSideTab?: (tab: string) => void;
    /** 각 탭 컴포넌트로 그대로 pass-through — 소비 지점마다 필요한 부분집합을 스스로 좁힌다. */
    actions?: GameActions;
    stats?: FullStats | null;
    quickSlots?: GameState['quickSlots'];
    runtime?: SystemTabRuntime;
    onReturnToLog?: () => void;
    /**
     * 'sheet'(기본) — 모바일 기록 콘솔: 제목 한 줄 + 가로 탭 레일(넘침 표시) + 닫기.
     * 'column' — 데스크톱(≥1024px) 기록 열: 같은 탭을 4열 타일로 펼치고 닫기 · 넘침 표시를 그리지 않는다.
     */
    layout?: 'sheet' | 'column';
}

const TAB_ITEMS = [
    { id: 'equipment', icon: Shield, label: '장비' },
    { id: 'inventory', icon: Package, label: '가방' },
    { id: 'quest', icon: Scroll, label: '임무' },
    { id: 'achievements', icon: Trophy, label: '업적' },
    { id: 'skills', icon: BookOpen, label: '기술' },
    { id: 'map', icon: Map, label: '지도' },
    { id: 'stats', icon: BarChart3, label: '상태' },
    { id: 'codex', icon: Eye, label: '도감' },
    { id: 'pass', icon: Star, label: '시즌' },
    { id: 'graves', icon: Skull, label: '묘비' },
    // 2026-10 감사 UX-14: 번개(Zap)는 전투 '기술' 단추의 아이콘이다 — 설정 탭은 톱니바퀴다.
    { id: 'system', icon: Settings, label: '설정' },
];

// 2026-10 통합 감사(UX-08): 11개 탭 레일은 390px에서 넷만 보이고 넘친다는 표시가 없었다.
//   레일이 넘치면 끝을 흐리고(mask) 다음 · 처음으로 넘기는 단추와 위치 막대를 그린다 — 탭 순서 · 묶음은 그대로다.
interface ArchiveRailScroll {
    overflows: boolean;
    atStart: boolean;
    atEnd: boolean;
    /** 보이는 폭 / 전체 폭(%) — 위치 막대의 길이. */
    thumb: number;
    /** 스크롤 위치 / 전체 폭(%) — 위치 막대의 시작. */
    offset: number;
}

const ARCHIVE_RAIL_IDLE: ArchiveRailScroll = { overflows: false, atStart: true, atEnd: false, thumb: 100, offset: 0 };
const ARCHIVE_RAIL_EDGE_PX = 1;
const ARCHIVE_RAIL_FADE = '28px';
const ARCHIVE_RAIL_PAGE_RATIO = 0.7;

const readArchiveRailScroll = (rail: HTMLElement): ArchiveRailScroll => {
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxScroll <= ARCHIVE_RAIL_EDGE_PX || rail.scrollWidth <= 0) return ARCHIVE_RAIL_IDLE;
    return {
        overflows: true,
        atStart: rail.scrollLeft <= ARCHIVE_RAIL_EDGE_PX,
        atEnd: rail.scrollLeft >= maxScroll - ARCHIVE_RAIL_EDGE_PX,
        thumb: Math.round((rail.clientWidth / rail.scrollWidth) * 100),
        offset: Math.round((rail.scrollLeft / rail.scrollWidth) * 100),
    };
};

const isSameArchiveRailScroll = (a: ArchiveRailScroll, b: ArchiveRailScroll) => (
    a.overflows === b.overflows && a.atStart === b.atStart && a.atEnd === b.atEnd && a.thumb === b.thumb && a.offset === b.offset
);

const getArchiveRailMask = ({ overflows, atStart, atEnd }: ArchiveRailScroll): string | undefined => {
    if (!overflows) return undefined;
    const start = atStart ? '#000 0' : `transparent 0, #000 ${ARCHIVE_RAIL_FADE}`;
    const end = atEnd ? '#000 100%' : `#000 calc(100% - ${ARCHIVE_RAIL_FADE}), transparent 100%`;
    return `linear-gradient(to right, ${start}, ${end})`;
};

const Dashboard = ({
    player,
    grave,
    sideTab,
    setSideTab,
    actions,
    stats,
    quickSlots,
    runtime,
    onReturnToLog,
    layout = 'sheet',
}: DashboardProps) => {
    const isColumn = layout === 'column';
    const [confirmMenuReset, setConfirmMenuReset] = useState(false);
    const [railScroll, setRailScroll] = useState<ArchiveRailScroll>(ARCHIVE_RAIL_IDLE);
    const archiveRailRef = useRef<HTMLDivElement>(null);
    const resetTriggerRef = useRef<HTMLButtonElement>(null);
    const resetConfirmationRef = useRef<HTMLDivElement>(null);
    const resetConfirmButtonRef = useRef<HTMLButtonElement>(null);
    const isInSafeZone = DB.MAPS[player?.loc as string]?.type === 'safe';
    // W2 (Wave 5): 기존 조건은 `quest.done && !quest.claimed`였는데 QuestProgressState에는
    //   done / claimed 필드를 쓰는 생산자가 없어 배지가 영원히 뜨지 않았다. 청구 가능
    //   판정의 단일 진실 원천(QuestBoardPanel과 동일)인 getClaimableQuestEntries로 교체.
    const hasCompletableQuest = getClaimableQuestEntries(player).length > 0;
    const activeTab = TAB_ITEMS.find((tab) => tab.id === sideTab) || TAB_ITEMS[0];

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

    useEffect(() => {
        const rail = archiveRailRef.current;
        if (!rail) return undefined;
        const sync = () => {
            const next = readArchiveRailScroll(rail);
            setRailScroll((prev) => (isSameArchiveRailScroll(prev, next) ? prev : next));
        };
        const frame = window.requestAnimationFrame(sync);
        rail.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
        observer?.observe(rail);
        return () => {
            window.cancelAnimationFrame(frame);
            rail.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
            observer?.disconnect();
        };
    }, []);

    const pageArchiveRail = () => {
        const rail = archiveRailRef.current;
        if (!rail) return;
        const behavior = getPreferredScrollBehavior();
        if (railScroll.atEnd) {
            rail.scrollTo({ left: 0, behavior });
            return;
        }
        rail.scrollBy({ left: rail.clientWidth * ARCHIVE_RAIL_PAGE_RATIO, behavior });
    };
    const railMask = getArchiveRailMask(railScroll);

    useEffect(() => {
        if (!confirmMenuReset) return;
        resetConfirmationRef.current?.scrollIntoView({ block: 'nearest' });
        resetConfirmButtonRef.current?.focus({ preventScroll: true });
    }, [confirmMenuReset]);

    const cancelMenuReset = () => {
        setConfirmMenuReset(false);
        window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
    };

    const renderTabContent = () => (
        <div key={typeof sideTab === 'string' ? sideTab : 'inventory'} className="space-y-2 pr-1">
            {sideTab === 'inventory' && (
                <SmartInventory
                    player={player}
                    actions={actions}
                    quickSlots={quickSlots}
                    onAssignQuickSlot={(index, item) => actions?.setQuickSlot?.(index, item)}
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
                        <MapNavigator player={player} grave={grave} stats={stats} actions={actions} />
                        <BuildAdvicePanel player={player} stats={stats} />
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
                    <Codex player={player} dispatch={actions?.dispatch ?? (() => {})} />
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
                    <GravePanel
                        player={player}
                        grave={grave}
                        actions={actions}
                        onOpenMap={() => selectTab('map')}
                    />
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
            data-layout={layout}
            className="ae-card flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2"
        >
            {/* 2026-10 에테르 유리(VD-11): 머리는 글자 한 줄(제목) + 탭 레일 한 줄이다 — 아이콘 상자 · 두 줄 제목 · 레일 위아래 선을 걷고
                닫기는 레일 줄 끝으로 옮겨 내용이 더 위에서 시작한다(390px에서 머리 약 128 → 90px). */}
            <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pl-1">
                <h2 className="ae-archive-title font-readable">
                    <span className="ae-eyebrow mr-2">모험 기록</span>
                    {activeTab.label}
                </h2>
                {hasCompletableQuest && (
                    <Chip tone="gold" data-testid="archive-claimable-chip">
                        {MSG.UI_REFRESH}
                    </Chip>
                )}
            </header>

            <div
                data-testid="archive-tab-rail-frame"
                data-overflow={railScroll.overflows ? 'true' : 'false'}
                data-at-start={railScroll.atStart ? 'true' : 'false'}
                data-at-end={railScroll.atEnd ? 'true' : 'false'}
                className="relative mt-1 flex shrink-0 items-center gap-1"
            >
                <div className="relative min-w-0 flex-1">
                    <nav
                        ref={archiveRailRef}
                        id="archive-tab-rail"
                        data-testid="archive-tab-rail"
                        aria-label="모험 기록 선택"
                        className={isColumn
                            ? 'grid min-w-0 flex-1 grid-cols-4 gap-1.5 py-1'
                            : 'custom-scrollbar flex min-w-0 flex-1 shrink-0 gap-1 overflow-x-auto py-1'}
                        style={!isColumn && railMask ? { maskImage: railMask, WebkitMaskImage: railMask } : undefined}
                    >
                        {TAB_ITEMS.map((tab) => (
                            <ArchiveTabButton
                                key={tab.id}
                                icon={tab.icon}
                                label={tab.label}
                                active={sideTab === tab.id}
                                onClick={() => selectTab(tab.id)}
                                compact
                                rail={!isColumn}
                                testId={`archive-tab-${tab.id}`}
                                {...getTabExtras(tab.id)}
                            />
                        ))}
                    </nav>
                    {!isColumn && railScroll.overflows && (
                        <div
                            data-testid="archive-tab-rail-progress"
                            aria-hidden="true"
                            className="ae-archive-progress pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-full"
                        >
                            <div
                                className="ae-archive-progress-thumb h-full rounded-full"
                                style={{ width: `${railScroll.thumb}%`, marginLeft: `${railScroll.offset}%` }}
                            />
                        </div>
                    )}
                </div>
                {!isColumn && railScroll.overflows && (
                    <button
                        type="button"
                        data-testid="archive-tab-rail-more"
                        aria-label={railScroll.atEnd ? MSG.ARCHIVE_RAIL_START_ARIA : MSG.ARCHIVE_RAIL_MORE_ARIA}
                        aria-controls="archive-tab-rail"
                        onClick={pageArchiveRail}
                        className="ae-archive-tab is-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    >
                        {railScroll.atEnd ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    </button>
                )}
                {!isColumn && (
                    <OverlayCloseButton
                        data-testid="mobile-console-return-log"
                        onClick={() => {
                            setConfirmMenuReset(false);
                            onReturnToLog?.();
                        }}
                    />
                )}
            </div>

            <div
                data-testid="mobile-archive-console-content"
                className="custom-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto"
            >
                {renderTabContent()}

                {sideTab === 'system' && (
                    <section
                        data-testid="system-reset-section"
                        className="mt-3 border-t border-ae-threat/20 px-1 pb-2 pt-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[13px] font-readable font-bold text-ae-threat">{MSG.MENU_RESET_TITLE}</h3>
                                <p className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">
                                    {MSG.MENU_RESET_SUMMARY}
                                </p>
                            </div>
                            <button
                                ref={resetTriggerRef}
                                type="button"
                                data-testid="menu-reset"
                                aria-expanded={confirmMenuReset}
                                aria-controls="menu-reset-confirmation"
                                onClick={() => setConfirmMenuReset((open) => !open)}
                                className="ae-btn ae-btn-ghost min-h-[44px] shrink-0 px-3 text-[13px] font-readable"
                                title={MSG.MENU_RESET_TITLE}
                            >
                                <RotateCcw size={15} aria-hidden="true" />
                                <span>다시 시작</span>
                            </button>
                        </div>

                        {confirmMenuReset && (
                            <div
                                ref={resetConfirmationRef}
                                id="menu-reset-confirmation"
                                data-testid="menu-reset-confirmation"
                                role="alertdialog"
                                aria-labelledby="menu-reset-confirm-title"
                                className="ae-well ae-threat-rim mt-2 p-3"
                            >
                                <h4 id="menu-reset-confirm-title" className="text-[14px] font-readable font-bold text-ae-ink">
                                    새 여정을 시작할까요?
                                </h4>
                                <p data-testid="menu-reset-loss" className="mt-1 text-[12px] font-readable leading-relaxed text-ae-threat">
                                    {MSG.MENU_RESET_LOSS(getJourneySurfaceText('death', 'reset'))}
                                </p>
                                <p data-testid="menu-reset-preserved" className="mt-1 text-[12px] font-readable leading-relaxed text-ae-good">
                                    {MSG.MENU_RESET_PRESERVED(getJourneySurfaceText('death', 'kept'))}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        ref={resetConfirmButtonRef}
                                        type="button"
                                        data-testid="menu-reset-confirm"
                                        onClick={() => {
                                            setConfirmMenuReset(false);
                                            actions?.reset?.();
                                        }}
                                        className="ae-btn ae-btn-danger min-h-[44px] px-2 text-[13px] font-readable"
                                    >
                                        <RotateCcw size={15} aria-hidden="true" />
                                        <span>현재 여정 다시 시작</span>
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="menu-reset-cancel"
                                        onClick={cancelMenuReset}
                                        className="ae-btn ae-btn-ghost min-h-[44px] px-2 text-[13px] font-readable"
                                    >
                                        <X size={15} aria-hidden="true" />
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
