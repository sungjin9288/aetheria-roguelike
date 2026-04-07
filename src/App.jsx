import React, { useState, useRef, lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';

import { GS } from './reducers/gameStates';
import { useGameEngine } from './hooks/useGameEngine';
import { useDamageFlash } from './hooks/useDamageFlash';
import { useViewportProfile } from './hooks/useViewportProfile';
import { useGameTestApi } from './hooks/useGameTestApi';
import { markPerfOnce, measurePerfOnce, markPerf } from './utils/performanceMarks';

import MainLayout from './components/MainLayout';
import IntroScreen from './components/IntroScreen';
import BootScreen from './components/app/BootScreen';
import GameRoot from './components/app/GameRoot';

const RunSummaryCard = lazy(() => import('./components/RunSummaryCard'));

const MOBILE_FOCUS_PANEL_STATES = new Set([GS.EVENT, GS.SHOP, GS.QUEST_BOARD, GS.JOB_CHANGE, GS.CRAFTING]);

function App() {
    const engine = useGameEngine();
    const [isMuted, setIsMuted] = useState(false);
    const [inventorySpotlight] = useState(null);
    const [premiumShopOpen, setPremiumShopOpen] = useState(false);
    const { isMobile: isMobileViewport, isNarrowDesktop: isNarrowDesktopViewport } = useViewportProfile();
    const fullStats = engine.getFullStats();
    const { damageFlash, healFlash, damageAmount } = useDamageFlash(engine.player?.hp);

    // Smoke test refs — updated synchronously during render so harness always reads fresh state
    const engineRef = useRef(engine);
    engineRef.current = engine;
    const fullStatsRef = useRef(fullStats);
    fullStatsRef.current = fullStats;
    const inventorySpotlightRef = useRef(inventorySpotlight);
    inventorySpotlightRef.current = inventorySpotlight;
    useGameTestApi(engineRef, fullStatsRef, inventorySpotlightRef);

    // Performance marks
    useEffect(() => {
        if (engine.bootStage !== 'ready') return;
        markPerfOnce('aetheria:boot-ready');
        measurePerfOnce('aetheria:boot-ready-ms', 'aetheria:app-mounted', 'aetheria:boot-ready');
    }, [engine.bootStage]);

    useEffect(() => {
        if (engine.bootStage !== 'ready') return;
        if (String(engine.player.name || '').trim()) return;
        void import('./components/Dashboard');
    }, [engine.bootStage, engine.player.name]);

    useEffect(() => {
        if (!String(engine.player.name || '').trim()) return;
        markPerfOnce('aetheria:run-ready');
        measurePerfOnce('aetheria:start-run-from-click-ms', 'aetheria:test-start-run', 'aetheria:run-ready');
    }, [engine.player.name]);

    useEffect(() => {
        if (engine.gameState !== GS.SHOP) return;
        markPerf('aetheria:shop-open');
        measurePerfOnce('aetheria:market-open-from-click-ms', 'aetheria:test-market-open', 'aetheria:shop-open');
    }, [engine.gameState]);

    const isMobileFocusState = isMobileViewport && MOBILE_FOCUS_PANEL_STATES.has(engine.gameState);
    const mobileArchiveDockVisible = (
        [GS.IDLE, GS.MOVING].includes(engine.gameState)
        && !engine.pendingRelics
        && !engine.postCombatResult
        && engine.gameState !== GS.ASCENSION
    );
    const useCompactDesktopRail = !isMobileViewport && isNarrowDesktopViewport;
    const runtimeViewport = isMobileViewport ? 'mobile' : useCompactDesktopRail ? 'desktop-compact' : 'desktop';

    const showOnboarding = !engine.onboardingDismissed && String(engine.player.name || '').trim().length > 0;
    const handleOnboardingDismiss = () => engine.dispatch({ type: 'SET_ONBOARDING_DISMISSED' });
    const handleQuickSlotUse = (item, index) => {
        if (!engine.player.inv.some((entry) => entry.id === item?.id)) {
            if (typeof index === 'number') engine.actions.setQuickSlot?.(index, null);
            return;
        }
        if (engine.gameState === GS.COMBAT && engine.actions.combatUseItem) { engine.actions.combatUseItem(item); return; }
        engine.actions.useItem(item);
    };

    if (engine.bootStage !== 'ready') return <BootScreen bootStage={engine.bootStage} />;

    if (engine.gameState === GS.DEAD && engine.runSummary) {
        return (
            <MotionConfig reducedMotion="user">
                <MainLayout visualEffect={null}>
                    <Suspense fallback={null}>
                        <RunSummaryCard runSummary={engine.runSummary} onRestart={() => engine.actions.reset?.()} />
                    </Suspense>
                </MainLayout>
            </MotionConfig>
        );
    }

    if (!String(engine.player.name || '').trim()) {
        return (
            <MotionConfig reducedMotion="user">
                <MainLayout visualEffect={null}>
                    <div className={`relative z-10 flex w-full flex-col items-center gap-4 md:gap-6 ${isMobileViewport ? 'min-h-full justify-start py-3' : 'h-full justify-center'}`}>
                        <IntroScreen onStart={engine.actions.start} mobile={isMobileViewport} />
                    </div>
                </MainLayout>
            </MotionConfig>
        );
    }

    return (
        <GameRoot
            engine={engine}
            fullStats={fullStats}
            isMobileViewport={isMobileViewport}
            isMobileFocusState={isMobileFocusState}
            mobileArchiveDockVisible={mobileArchiveDockVisible}
            useCompactDesktopRail={useCompactDesktopRail}
            runtimeViewport={runtimeViewport}
            inventorySpotlight={inventorySpotlight}
            premiumShopOpen={premiumShopOpen}
            setPremiumShopOpen={setPremiumShopOpen}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            handleQuickSlotUse={handleQuickSlotUse}
            showOnboarding={showOnboarding}
            handleOnboardingDismiss={handleOnboardingDismiss}
            damageFlash={damageFlash}
            healFlash={healFlash}
            damageAmount={damageAmount}
        />
    );
}

export default App;
