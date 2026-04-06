import React, { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';
import OnboardingGuide from '../OnboardingGuide';
import { soundManager } from '../../systems/SoundManager';

const Dashboard = lazy(() => import('../Dashboard'));

const DashboardFallback = () => (
    <div
        aria-hidden="true"
        className="panel-noise aether-surface animate-pulse border border-white/8 rounded-[1.2rem] min-h-[12rem]"
    />
);

const DesktopGameLayout = ({
    engine, fullStats,
    isMobileViewport,
    useCompactDesktopRail, runtimeViewport,
    inventorySpotlight,
    isMuted, setIsMuted,
    handleQuickSlotUse,
    showOnboarding, handleOnboardingDismiss,
    damageFlash, healFlash,
}) => (
    <>
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 w-full grid grid-cols-1 gap-1 md:flex-1 md:min-h-0 md:overflow-hidden transition-all duration-150 md:grid-cols-[minmax(0,1fr)_11rem] lg:grid-cols-[minmax(0,1fr)_clamp(11.5rem,16vw,12.75rem)] xl:grid-cols-[minmax(0,1fr)_clamp(12rem,16vw,13.5rem)] ${damageFlash ? 'ring-2 ring-red-500/40' : ''} ${healFlash ? 'ring-2 ring-green-500/40' : ''}`}
        >
            {showOnboarding && (
                <OnboardingGuide player={engine.player} onDismiss={handleOnboardingDismiss} />
            )}
            <TerminalView
                logs={engine.logs}
                gameState={engine.gameState}
                onCommand={engine.handleCommand}
                autoFocusInput
                mobile={false}
                player={engine.player}
                stats={fullStats}
                quickSlots={engine.quickSlots}
                onQuickSlotUse={handleQuickSlotUse}
                showInput
                syncStatus={engine.syncStatus}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(soundManager.toggleMute())}
            />
            {!isMobileViewport && (
                <div className="hidden md:grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1 overflow-hidden">
                    <Suspense fallback={<DashboardFallback />}>
                        <Dashboard
                            player={engine.player}
                            grave={engine.grave}
                            sideTab={engine.sideTab}
                            setSideTab={engine.actions.setSideTab}
                            actions={engine.actions}
                            stats={fullStats}
                            quickSlots={engine.quickSlots}
                            inventorySpotlight={inventorySpotlight}
                            compactDesktop={useCompactDesktopRail}
                            runtime={{
                                syncStatus: engine.syncStatus,
                                gameState: engine.gameState,
                                isAiThinking: engine.isAiThinking,
                                viewport: runtimeViewport,
                            }}
                        />
                    </Suspense>
                    <ControlPanel
                        gameState={engine.gameState}
                        player={engine.player}
                        enemy={engine.enemy}
                        actions={engine.actions}
                        setSideTab={engine.actions.setSideTab}
                        setGameState={engine.actions.setGameState}
                        shopItems={engine.shopItems}
                        grave={engine.grave}
                        isAiThinking={engine.isAiThinking}
                        currentEvent={engine.currentEvent}
                        stats={fullStats}
                        desktopSidebar
                        compactDesktop={useCompactDesktopRail}
                    />
                </div>
            )}
        </Motion.div>
    </>
);

export default DesktopGameLayout;
