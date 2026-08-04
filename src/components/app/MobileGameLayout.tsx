import { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import { GS } from '../../reducers/gameStates';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';

const Dashboard = lazy(() => import('../Dashboard'));

const DashboardFallback = () => (
    <div
        aria-hidden="true"
        className="panel-noise aether-surface animate-pulse border border-white/8 shrink-0 rounded-[1.55rem] px-3 py-2.5 min-h-[4.5rem]"
    />
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
    onOpenCrystalExchange,
}: any) => {
    const isCombat = engine.gameState === GS.COMBAT;
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
            className={`relative z-10 flex min-h-0 min-w-0 flex-1 w-full flex-col ${isPanelFocusState ? 'overflow-hidden gap-1.5' : 'gap-1'} ${damageFlash ? 'ring-2 ring-red-500/30 rounded-[1.5rem]' : ''} ${healFlash ? 'ring-2 ring-green-500/30 rounded-[1.5rem]' : ''}`}
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
                                onOpenCrystalExchange,
                            }}
                        />
                    </Suspense>
                ) : (
                    <div className={`flex min-w-0 flex-1 ${isCombat ? 'order-2 min-h-[132px]' : 'min-h-[240px] min-[740px]:min-h-[280px]'}`}>
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
                <div className={isCombat ? 'order-1 shrink-0' : 'shrink-0'}>
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
