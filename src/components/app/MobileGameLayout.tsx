import { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { GS } from '../../reducers/gameStates';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';

const Dashboard = lazy(() => import('../Dashboard'));

const DashboardFallback = ({ summary = false }: any) => (
    <div
        aria-hidden="true"
        className={`panel-noise aether-surface animate-pulse border border-white/8 ${
            summary
                ? 'rounded-[1.2rem] px-3 py-3 min-h-[5.75rem]'
                : 'shrink-0 rounded-[1.55rem] px-3 py-2.5 min-h-[4.5rem]'
        }`}
    />
);

const MobileConsoleArchiveButton = ({ active = false, onClick }: any) => (
    <button
        type="button"
        data-testid="mobile-console-open-archive"
        onClick={onClick}
        className={`inline-flex min-h-[30px] items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-fira uppercase tracking-[0.16em] transition-all ${
            active
                ? 'border-[#d5b180]/28 bg-[#d5b180]/12 text-[#f6e7c8]'
                : 'border-white/8 bg-black/18 text-slate-300/74 hover:border-[#d5b180]/18 hover:text-slate-100'
        }`}
    >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/8 bg-white/[0.04]">
            <Package size={10} />
        </span>
        Menu
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
                            mobileSection="console"
                            consoleExpanded
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
                            }}
                        />
                    </Suspense>
                ) : (
                    <TerminalView
                        logs={engine.logs}
                        gameState={engine.gameState}
                        onCommand={engine.handleCommand}
                        autoFocusInput={false}
                        player={engine.player}
                        stats={fullStats}
                        quickSlots={engine.quickSlots}
                        onQuickSlotUse={handleQuickSlotUse}
                        showInput={false}
                    />
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
                    mobileFocused
                    onOpenArchiveConsole={openArchiveConsole}
                />
            ) : (
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
                        mobileFocused
                        onOpenArchiveConsole={openArchiveConsole}
                    />
                </div>
            )}
        </Motion.div>
    );
};

export default MobileGameLayout;
