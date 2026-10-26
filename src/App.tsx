import { useState, useRef, useCallback, useEffect } from 'react';
import type { Item } from './types';
import { MotionConfig, useReducedMotion } from 'framer-motion';

import { GS } from './reducers/gameStates';
import { useGameEngine } from './hooks/useGameEngine';
import { useDamageFlash } from './hooks/useDamageFlash';
import { useGameFeedbackHaptics } from './hooks/useHapticFeedback';
import { isHapticsEnabled } from './utils/playerSettings';
import { useGameTestApi } from './hooks/useGameTestApi';
import { markPerfOnce, measurePerfOnce, markPerf } from './utils/performanceMarks';
import { getCounterStagger } from './utils/combatPresentation';
import { getPendingMilestoneStoryBeat } from './utils/milestoneStory';
import { bindLifecycleBridge } from './platform/lifecycleBridge';
import { resolvePlatformBackAction } from './platform/platformBack';
import { getRuntimeEnvironment } from './platform/runtimeEnvironment';
import {
    createPlatformBackRegistry,
    PlatformBackProvider,
} from './platform/platformBackRegistry';

import MainLayout from './components/MainLayout';
import IntroScreen from './components/IntroScreen';
import BootScreen from './components/app/BootScreen';
import GameRoot from './components/app/GameRootLoader';
import DeathScreen, { preloadDeathScreen } from './components/app/DeathScreen';

const TEST_API_BUILD = import.meta.env.VITE_ENABLE_TEST_API === '1'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'item-investment'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'grave-recovery'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'ascension-journey'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'mirror-journey'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'crystal-exchange'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'system-settings'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'progression-acceptance'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'true-ending-journey'
    || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'toss-first-five';
const useRuntimeGameTestApi = TEST_API_BUILD ? useGameTestApi : () => undefined;

// 2026-09 Wave 19 K1: `EVENT_PENDING`도 포커스 상태다 — 준비 중 패널이 결정 영역을
//   차지하는 동안 터미널을 마운트하면 오늘의 UX가 바뀐다(예전 `EVENT && isAiThinking`
//   창에서도 터미널은 없었다).
const FOCUS_PANEL_STATES = new Set<string>([GS.EVENT, GS.EVENT_PENDING, GS.SHOP, GS.QUEST_BOARD, GS.JOB_CHANGE, GS.CRAFTING]);

function App() {
    const engine = useGameEngine();
    const [premiumShopOpen, setPremiumShopOpen] = useState(
        import.meta.env.VITE_DEVICE_QA_SCENARIO === 'crystal-exchange',
    );
    const [mirrorPanelOpen, setMirrorPanelOpen] = useState(
        import.meta.env.VITE_DEVICE_QA_SCENARIO === 'mirror-journey',
    );
    const fullStats = engine.getFullStats();
    // GF-06: 적 반격의 내 피격 연출은 내 타격 뒤 박자에 보인다(판정은 이미 끝났다 — 표시만 늦춘다).
    const reducedMotion = Boolean(useReducedMotion());
    const { damageFlash, healFlash, damageAmount } = useDamageFlash(
        engine.player?.hp,
        engine.presentationEpoch,
        getCounterStagger(engine.combatFeedback, reducedMotion),
    );
    // 2026-10-26 소유자 결정 D3: 진동(맞음 · 치명타 · 레벨 상승 · 사망) — 사망 화면에서도 살아 있는 여기서 부른다.
    //   전설 획득 진동은 그 화면을 띄우는 GameRoot가 부른다. 설정의 '진동'이 꺼져 있으면 울리지 않는다.
    useGameFeedbackHaptics({
        enabled: isHapticsEnabled(engine.player),
        epoch: engine.presentationEpoch,
        combatFeedback: engine.combatFeedback,
        level: engine.player?.level,
        dead: engine.gameState === GS.DEAD,
    });

    // Smoke test refs — updated synchronously during render so harness always reads fresh state.
    // cycle 100: react-hooks/refs 룰은 일반 컴포넌트엔 옳지만 여기선 의도적인 패턴이라 명시 disable.
    // smoke-gameplay.mjs / playwright e2e에서 window.__aetheriaTestApi__를 통해 외부에서
    // 최신 engine/stats를 읽어야 하므로 render마다 동기 갱신 필요.
    const engineRef = useRef(engine);
    /* eslint-disable-next-line react-hooks/refs */
    engineRef.current = engine;
    const fullStatsRef = useRef(fullStats);
    /* eslint-disable-next-line react-hooks/refs */
    fullStatsRef.current = fullStats;
    const premiumShopOpenRef = useRef(premiumShopOpen);
    /* eslint-disable-next-line react-hooks/refs */
    premiumShopOpenRef.current = premiumShopOpen;
    const mirrorPanelOpenRef = useRef(mirrorPanelOpen);
    /* eslint-disable-next-line react-hooks/refs */
    mirrorPanelOpenRef.current = mirrorPanelOpen;
    const [platformBackRegistry] = useState(createPlatformBackRegistry);

    const handlePlatformBack = useCallback(() => {
        if (platformBackRegistry.handleBack()) return true;
        const currentEngine = engineRef.current;
        const summary = currentEngine.player?.lastExpeditionSummary;
        const action = resolvePlatformBackAction({
            premiumShopOpen: premiumShopOpenRef.current,
            mirrorPanelOpen: mirrorPanelOpenRef.current,
            expeditionDebriefOpen: Boolean(
                summary && (currentEngine.expeditionDebriefOpen || !summary.reviewedAt),
            ),
            postCombatOpen: Boolean(currentEngine.postCombatResult),
            gameState: currentEngine.gameState,
        });
        switch (action) {
            case 'close-premium':
                setPremiumShopOpen(false);
                return true;
            case 'close-mirror':
                setMirrorPanelOpen(false);
                return true;
            case 'close-debrief':
                currentEngine.actions.closeExpeditionDebrief?.();
                return true;
            case 'close-post-combat':
                currentEngine.actions.clearPostCombat?.();
                return true;
            case 'dismiss-event':
                currentEngine.actions.dismissEvent?.();
                return true;
            case 'close-focus-panel':
                currentEngine.actions.setGameState?.(GS.IDLE);
                return true;
            case 'close-app':
                return false;
        }
    }, [platformBackRegistry]);

    useRuntimeGameTestApi(engineRef, fullStatsRef, handlePlatformBack);

    useEffect(() => bindLifecycleBridge({
        environment: getRuntimeEnvironment(),
        callbacks: {
            onBackground: () => {
                void engineRef.current.flushLocalSave();
            },
            onBack: handlePlatformBack,
            onError: (error) => console.warn('Platform lifecycle bridge unavailable', error),
        },
    }), [handlePlatformBack]);

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

    // 전투가 시작되면 사망 기록 카드를 미리 받아 둔다 — 쓰러진 순간 카드가 늦게 뜨지 않게.
    useEffect(() => {
        if (engine.gameState === GS.COMBAT) preloadDeathScreen();
    }, [engine.gameState]);

    useEffect(() => {
        if (engine.gameState !== GS.SHOP) return;
        markPerf('aetheria:shop-open');
        measurePerfOnce('aetheria:market-open-from-click-ms', 'aetheria:test-market-open', 'aetheria:shop-open');
    }, [engine.gameState]);

    const isPanelFocusState = FOCUS_PANEL_STATES.has(engine.gameState);
    const mobileArchiveDockVisible = (
        ([GS.IDLE, GS.MOVING] as string[]).includes(engine.gameState)
        && !engine.pendingRelics
        && !engine.postCombatResult
        && engine.gameState !== GS.ASCENSION
    );
    const handleQuickSlotUse = (item: Item, index: number) => {
        if (!(engine.player.inv || []).some((entry) => entry.id === item?.id)) {
            if (typeof index === 'number') engine.actions.setQuickSlot?.(index, null);
            return;
        }
        if (engine.gameState === GS.COMBAT && engine.actions.combatUseItem) { engine.actions.combatUseItem(item); return; }
        engine.actions.useItem(item);
    };

    if (engine.bootStage !== 'ready') return <BootScreen bootStage={engine.bootStage} />;

    if (engine.gameState === GS.DEAD && engine.runSummary) {
        const firstDeathStory = getPendingMilestoneStoryBeat(engine.player, ['first_death']);
        // 사망 화면에서도 에테르 거울을 연다 — 게임 화면(GameRoot)이 마운트되지 않으므로 거울 · 뒤로가기 등록을 여기서 준다.
        return (
            <PlatformBackProvider registry={platformBackRegistry}>
                <MotionConfig reducedMotion="user">
                    <MainLayout visualEffect={null}>
                        <DeathScreen
                            runSummary={engine.runSummary}
                            storyBeat={firstDeathStory?.id === 'first_death' ? firstDeathStory : null}
                            player={engine.player}
                            mirrorOpen={mirrorPanelOpen}
                            onOpenMirror={() => setMirrorPanelOpen(true)}
                            onCloseMirror={() => setMirrorPanelOpen(false)}
                            onPurchaseMirror={(nodeId) => { engine.actions.purchaseMirrorNode?.(nodeId); }}
                            onRestart={() => {
                                setMirrorPanelOpen(false);
                                if (firstDeathStory?.id === 'first_death') {
                                    engine.actions.acknowledgeMilestoneStoryBeat?.(firstDeathStory.id);
                                }
                                engine.actions.reset?.();
                            }}
                        />
                    </MainLayout>
                </MotionConfig>
            </PlatformBackProvider>
        );
    }

    if (!String(engine.player.name || '').trim()) {
        return (
            <MotionConfig reducedMotion="user">
                <MainLayout visualEffect={null} immersive>
                    <IntroScreen onStart={engine.actions.start} prestigeRank={engine.player.meta?.prestigeRank} meta={engine.player.meta} />
                </MainLayout>
            </MotionConfig>
        );
    }

    return (
        <PlatformBackProvider registry={platformBackRegistry}>
            <GameRoot
            engine={engine}
            fullStats={fullStats}
            isPanelFocusState={isPanelFocusState}
            mobileArchiveDockVisible={mobileArchiveDockVisible}
            premiumShopOpen={premiumShopOpen}
            setPremiumShopOpen={setPremiumShopOpen}
            mirrorPanelOpen={mirrorPanelOpen}
            setMirrorPanelOpen={setMirrorPanelOpen}
            handleQuickSlotUse={handleQuickSlotUse}
            damageFlash={damageFlash}
            healFlash={healFlash}
            damageAmount={damageAmount}
            />
        </PlatformBackProvider>
    );
}

export default App;
