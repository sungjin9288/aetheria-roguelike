import React, { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';
import OnboardingGuide from '../OnboardingGuide';
import { soundManager } from '../../systems/SoundManager';

const Dashboard = lazy(() => import('../Dashboard'));

const DashboardFallback = ({ summary = false }) => (
    <div
        aria-hidden="true"
        className={`panel-noise aether-surface animate-pulse border border-white/8 ${
            summary
                ? 'rounded-[1.2rem] px-3 py-3 min-h-[5.75rem]'
                : 'fixed bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 z-30 w-[min(calc(100%-1.5rem),22rem)] -translate-x-1/2 rounded-full px-3 py-2.5'
        }`}
    />
);

const MobileGameLayout = ({
    engine, fullStats,
    isMobileFocusState, mobileArchiveDockVisible,
    inventorySpotlight,
    isMuted, setIsMuted,
    handleQuickSlotUse,
    showOnboarding, handleOnboardingDismiss,
    damageFlash, healFlash,
}) => (
    <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative z-10 flex min-h-0 flex-1 w-full flex-col overflow-hidden gap-2 ${damageFlash ? 'ring-2 ring-red-500/30 rounded-[1.5rem]' : ''} ${healFlash ? 'ring-2 ring-green-500/30 rounded-[1.5rem]' : ''}`}
    >
        {showOnboarding && !isMobileFocusState && (
            <OnboardingGuide player={engine.player} onDismiss={handleOnboardingDismiss} mobile />
        )}
        {!isMobileFocusState && (
            <TerminalView
                logs={engine.logs}
                gameState={engine.gameState}
                onCommand={engine.handleCommand}
                autoFocusInput={false}
                mobile
                player={engine.player}
                stats={fullStats}
                quickSlots={engine.quickSlots}
                onQuickSlotUse={handleQuickSlotUse}
                showInput={false}
                syncStatus={engine.syncStatus}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(soundManager.toggleMute())}
            />
        )}
        {!isMobileFocusState && (
            <Suspense fallback={<DashboardFallback summary />}>
                <Dashboard
                    mobile
                    mobileSection="summary"
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
        )}
        <div className={`min-h-0 ${isMobileFocusState ? 'flex-1 flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
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
                mobile
                mobileFocused={isMobileFocusState}
            />
        </div>
        {!isMobileFocusState && (
            <Suspense fallback={mobileArchiveDockVisible ? <DashboardFallback /> : null}>
                <Dashboard
                    mobile
                    mobileSection="archive"
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
        )}
        {!isMobileFocusState && mobileArchiveDockVisible && (
            <div className="h-[4.1rem] shrink-0 md:hidden" aria-hidden="true" />
        )}
    </Motion.div>
);

export default MobileGameLayout;
