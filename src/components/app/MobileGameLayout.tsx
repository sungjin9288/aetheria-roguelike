import { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { GS } from '../../reducers/gameStates';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';

const Dashboard = lazy(() => import('../Dashboard'));

// cycle 484: 2 internal helper props 제거 — DashboardFallback summary / Mobile
//   ConsoleArchiveButton 활성 상태 prop 모두 1 callsite에서 전달 0건이라 ternary
//   첫 가지 unreachable. cycle 458-459 같은 파일 paired 패턴 회귀.
const DashboardFallback = () => (
    <div
        aria-hidden="true"
        className="panel-noise aether-surface animate-pulse border border-white/8 shrink-0 rounded-[1.55rem] px-3 py-2.5 min-h-[4.5rem]"
    />
);

const MobileConsoleArchiveButton = ({ onClick }: any) => (
    <button
        type="button"
        data-testid="mobile-console-open-archive"
        onClick={onClick}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/8 bg-black/18 px-3 py-1.5 text-[10px] font-readable text-slate-300/78 transition-all hover:border-[#d5b180]/18 hover:text-slate-100"
    >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/8 bg-white/[0.04]">
            <BookOpen size={11} />
        </span>
        모험 기록
    </button>
);

const MobileGameLayout = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    inventorySpotlight,
    handleQuickSlotUse,
    damageFlash, healFlash,
    mobileConsoleMode,
    setMobileConsoleMode,
    onOpenMirror,
}: any) => {
    const archiveAvailable = !isPanelFocusState && mobileArchiveDockVisible;
    const showArchiveConsole = archiveAvailable && mobileConsoleMode === 'archive';
    const openArchiveConsole = (tab: any) => {
        // onClick 등에서 이벤트 객체를 그대로 전달하는 것을 방지 (기본값이 event 객체로 덮이면 안 됨)
        const target = typeof tab === 'string' ? tab : 'inventory';
        engine.actions.setSideTab?.(target);
        engine.actions.setGameState?.(GS.IDLE);
        setMobileConsoleMode('archive');
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 flex min-h-0 flex-1 w-full flex-col ${isPanelFocusState ? 'overflow-hidden gap-1.5' : 'gap-1'} ${damageFlash ? 'ring-2 ring-red-500/30 rounded-[1.5rem]' : ''} ${healFlash ? 'ring-2 ring-green-500/30 rounded-[1.5rem]' : ''}`}
        >
            {!isPanelFocusState && (
                showArchiveConsole ? (
                    <Suspense fallback={archiveAvailable ? <DashboardFallback /> : null}>
                        <Dashboard
                            onReturnToLog={() => setMobileConsoleMode('log')}
                            player={engine.player}
                            grave={engine.grave}
                            sideTab={engine.sideTab}
                            setSideTab={engine.actions.setSideTab}
                            actions={engine.actions}
                            stats={fullStats}
                            quickSlots={engine.quickSlots}
                            inventorySpotlight={inventorySpotlight}
                            runtime={{
                                syncStatus: engine.syncStatus,
                                gameState: engine.gameState,
                                isAiThinking: engine.isAiThinking,
                                viewport: 'mobile',
                                mobileArchiveDockVisible,
                                onOpenMirror,
                            }}
                        />
                    </Suspense>
                ) : (
                    <div className="flex min-h-[240px] min-w-0 flex-1">
                        <TerminalView
                            logs={engine.logs}
                            gameState={engine.gameState}
                            onCommand={engine.handleCommand}
                            player={engine.player}
                            quickSlots={engine.quickSlots}
                            onQuickSlotUse={handleQuickSlotUse}
                        />
                    </div>
                )
            )}
            {!isPanelFocusState && !showArchiveConsole && archiveAvailable && (
                <div className="shrink-0 px-1">
                    <div className="flex items-center justify-start">
                        <MobileConsoleArchiveButton onClick={openArchiveConsole} />
                    </div>
                </div>
            )}
        {/* Focus state (SHOP/EVENT/etc.): ControlPanel fills all remaining space via flex-1
            on its returned panel (ShopPanel/EventPanel). Normal state: shrink-0 prevents
            action buttons from being pushed off-screen on small phones. */}
            {isPanelFocusState ? (
                <ControlPanel
                    gameState={engine.gameState}
                    player={engine.player}
                    enemy={engine.enemy}
                    actions={engine.actions}
                    setGameState={engine.actions.setGameState}
                    shopItems={engine.shopItems}
                    grave={engine.grave}
                    isAiThinking={engine.isAiThinking}
                    currentEvent={engine.currentEvent}
                    stats={fullStats}
                    onOpenArchiveConsole={openArchiveConsole}
                />
            ) : !showArchiveConsole ? (
                <div className="shrink-0">
                    <ControlPanel
                        gameState={engine.gameState}
                        player={engine.player}
                        enemy={engine.enemy}
                        actions={engine.actions}
                        setGameState={engine.actions.setGameState}
                        shopItems={engine.shopItems}
                        grave={engine.grave}
                        isAiThinking={engine.isAiThinking}
                        currentEvent={engine.currentEvent}
                        stats={fullStats}
                        onOpenArchiveConsole={openArchiveConsole}
                    />
                </div>
            ) : null}
        </Motion.div>
    );
};

export default MobileGameLayout;
