import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';

import { GS } from './reducers/gameStates';
import { soundManager } from './systems/SoundManager';

// 항상 즉시 필요한 컴포넌트 — eager import
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import ControlPanel from './components/ControlPanel';
import IntroScreen from './components/IntroScreen';
import DamageNumber from './components/DamageNumber';
import AetherMark from './components/AetherMark';
import StatusBar from './components/StatusBar';
import { getPerfSnapshot, markPerf, markPerfOnce, measurePerfOnce } from './utils/performanceMarks';

// 조건부로만 렌더되는 무거운 컴포넌트 — lazy import (청크 분리)
const loadDashboard = () => import('./components/Dashboard');
const Dashboard = lazy(loadDashboard);
const RelicChoicePanel = lazy(() => import('./components/RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('./components/AscensionScreen'));
const RunSummaryCard   = lazy(() => import('./components/RunSummaryCard'));
const PostCombatCard   = lazy(() => import('./components/PostCombatCard'));

import { useGameEngine } from './hooks/useGameEngine';
import { useDamageFlash } from './hooks/useDamageFlash';

const getViewportProfile = () => {
  if (typeof window === 'undefined') {
    return { isMobile: false, isNarrowDesktop: false };
  }

  const width = window.innerWidth;
  return {
    isMobile: width <= 767,
    isNarrowDesktop: width >= 768 && width <= 1099,
  };
};

const DashboardFallback = ({ mobile = false, summary = false }) => (
  <div
    aria-hidden="true"
    className={`panel-noise aether-surface animate-pulse border border-white/8 ${
      mobile
        ? summary
          ? 'rounded-[1.2rem] px-3 py-3 min-h-[5.75rem]'
          : 'fixed bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 z-30 w-[min(calc(100%-1.5rem),22rem)] -translate-x-1/2 rounded-full px-3 py-2.5'
        : 'rounded-[1.2rem] min-h-[12rem]'
    }`}
  />
);

function App() {
  const engine = useGameEngine();
  const [isMuted, setIsMuted] = useState(false);
  const [inventorySpotlight] = useState(null);
  const [viewportProfile, setViewportProfile] = useState(getViewportProfile);
  const { isMobile: isMobileViewport, isNarrowDesktop: isNarrowDesktopViewport } = viewportProfile;
  const fullStats = engine.getFullStats();

  // Damage Flash hook
  const { damageFlash, healFlash, damageAmount } = useDamageFlash(engine.player?.hp);
  const mobileArchiveDockVisible = (
    [GS.IDLE, GS.MOVING].includes(engine.gameState)
    && !engine.pendingRelics
    && !engine.postCombatResult
    && engine.gameState !== GS.ASCENSION
  );
  const useCompactDesktopRail = !isMobileViewport && isNarrowDesktopViewport;
  const runtimeViewport = isMobileViewport
    ? 'mobile'
    : useCompactDesktopRail
      ? 'desktop-compact'
      : 'desktop';

  // QuickSlot use handler
  const handleQuickSlotUse = (item, index) => {
    if (!engine.player.inv.some((entry) => entry.id === item?.id)) {
      if (typeof index === 'number') engine.actions.setQuickSlot?.(index, null);
      return;
    }
    if (engine.gameState === GS.COMBAT && engine.actions.combatUseItem) {
      engine.actions.combatUseItem(item);
      return;
    }
    engine.actions.useItem(item);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    markPerfOnce('aetheria:app-mounted');
    const onResize = () => setViewportProfile(getViewportProfile());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (engine.bootStage !== 'ready') return;
    markPerfOnce('aetheria:boot-ready');
    measurePerfOnce('aetheria:boot-ready-ms', 'aetheria:app-mounted', 'aetheria:boot-ready');
  }, [engine.bootStage]);

  useEffect(() => {
    if (engine.bootStage !== 'ready') return;
    if (String(engine.player.name || '').trim()) return;
    void loadDashboard();
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.render_game_to_text = () => JSON.stringify({
      bootStage: engine.bootStage,
      mode: engine.gameState === GS.DEAD && engine.runSummary
        ? 'run_summary'
        : !engine.player.name
          ? 'intro'
          : 'game',
      gameState: engine.gameState,
      isAiThinking: engine.isAiThinking,
      syncStatus: engine.syncStatus,
      player: {
        name: engine.player.name || '',
        job: engine.player.job,
        level: engine.player.level,
        loc: engine.player.loc,
        hp: engine.player.hp,
        maxHp: fullStats.maxHp,
        mp: engine.player.mp,
        maxMp: fullStats.maxMp,
        gold: engine.player.gold,
      },
      enemy: engine.enemy
        ? {
            name: engine.enemy.name,
            baseName: engine.enemy.baseName || engine.enemy.name,
            hp: engine.enemy.hp,
            maxHp: engine.enemy.maxHp,
            isBoss: Boolean(engine.enemy.isBoss),
            phase2Triggered: Boolean(engine.enemy.phase2Triggered),
          }
        : null,
      currentEvent: engine.currentEvent
        ? {
            desc: engine.currentEvent.desc || '',
            choices: Array.isArray(engine.currentEvent.choices) ? engine.currentEvent.choices : [],
          }
        : null,
      pendingRelics: Array.isArray(engine.pendingRelics) ? engine.pendingRelics.map((relic) => relic.name) : null,
      postCombatResult: engine.postCombatResult
        ? {
            enemy: engine.postCombatResult.enemy,
            exp: engine.postCombatResult.exp,
            gold: engine.postCombatResult.gold,
            items: engine.postCombatResult.items || [],
          }
        : null,
      inventorySpotlight: inventorySpotlight
        ? {
            token: inventorySpotlight.token,
            title: inventorySpotlight.title,
            names: inventorySpotlight.names || [],
          }
        : null,
      runSummary: engine.runSummary
        ? {
            level: engine.runSummary.level,
            job: engine.runSummary.job,
            loc: engine.runSummary.loc,
          }
        : null,
      sideTab: engine.sideTab,
      logTail: engine.logs.slice(-6).map((log) => ({ type: log.type, text: log.text })),
    });

    window.advanceTime = (ms = 0) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
    window.__AETHERIA_TEST_API__ = {
      getState: () => JSON.parse(window.render_game_to_text()),
      getPerfSnapshot: () => getPerfSnapshot(),
      markPerf: (name) => markPerf(name),
      resetGame: () => engine.actions.reset?.(),
      sendCommand: (command) => engine.handleCommand(command),
      clearPostCombat: () => engine.actions.clearPostCombat?.(),
      setSideTab: (tab) => engine.actions.setSideTab?.(tab),
      injectPostCombatResult: () => {
        engine.dispatch({
          type: 'SET_POST_COMBAT_RESULT',
          payload: {
            enemy: '테스트 골렘',
            exp: 22,
            gold: 18,
            items: ['룬 마도서', '강철 롱소드'],
            leveledUp: false,
            hpLow: false,
            mpLow: false,
            invFull: false,
            upgradeHint: {
              name: '강철 롱소드',
              summary: 'ATK +4 / DEF +1',
            },
            traitHint: {
              name: '룬 마도서',
              summary: '비전 성향과 잘 맞는 전리품입니다.',
            },
          }
        });
      },
      injectRelicChoice: () => {
        engine.dispatch({
          type: 'SET_PENDING_RELICS',
          payload: [
            {
              id: 'test_relic_amber',
              name: '황혼의 파편',
              desc: '치명타 확률 +3%, 휴식 비용 -10%',
              rarity: 'epic',
              effect: 'crit_mp_regen',
            },
            {
              id: 'test_relic_cyan',
              name: '심해의 매듭',
              desc: '전투 시작 시 MP 12 회복',
              rarity: 'uncommon',
              effect: 'mp_regen_turn',
            },
            {
              id: 'test_relic_violet',
              name: '균열의 서판',
              desc: '스킬 피해 18% 증가',
              rarity: 'rare',
              effect: 'skill_mult',
            },
          ],
        });
      },
      injectRunSummary: () => {
        engine.dispatch({
          type: 'SET_RUN_SUMMARY',
          payload: {
            level: 17,
            job: '모험가',
            loc: '북부 요새',
            kills: 142,
            bossKills: 3,
            relicsFound: 5,
            totalGold: 1842,
            prestigeRank: 2,
            activeTitle: 'veteran',
          },
        });
        engine.dispatch({ type: 'SET_GAME_STATE', payload: GS.DEAD });
      },
      injectAscensionPreview: () => {
        engine.dispatch({
          type: 'SET_PLAYER',
          payload: {
            meta: {
              ...(engine.player.meta || {}),
              prestigeRank: 1,
              bonusAtk: 4,
              bonusHp: 20,
              bonusMp: 10,
              essence: 320,
            },
          },
        });
        engine.dispatch({ type: 'SET_GAME_STATE', payload: GS.ASCENSION });
      },
      injectEvent: () => {
        engine.dispatch({
          type: 'SET_EVENT',
          payload: {
            desc: '[TEST EVENT] 낡은 봉인이 흔들립니다. 어떻게 대응하시겠습니까?',
            choices: ['봉인을 조사한다', '안전하게 후퇴한다'],
            outcomes: [
              { choiceIndex: 0, gold: 40, log: '[TEST EVENT] 봉인 조각에서 40G를 회수했습니다.' },
              { choiceIndex: 1, hp: 10, log: '[TEST EVENT] 안전하게 후퇴하며 호흡을 가다듬었습니다.' }
            ]
          }
        });
        engine.dispatch({ type: 'SET_GAME_STATE', payload: GS.EVENT });
      },
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__AETHERIA_TEST_API__;
    };
  // Test harness exposure only: rebind when referenced runtime snapshots change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    engine.bootStage,
    engine.gameState,
    engine.isAiThinking,
    engine.player,
    engine.enemy,
    engine.currentEvent,
    engine.pendingRelics,
    engine.postCombatResult,
    inventorySpotlight,
    engine.runSummary,
    engine.sideTab,
    engine.logs,
    engine.syncStatus,
    fullStats,
  ]);

  if (engine.bootStage !== 'ready') {
    return (
      <div className="flex h-[100dvh] w-full bg-cyber-black items-center justify-center text-cyber-blue font-rajdhani relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 0.7px, transparent 0.7px)', backgroundSize: '3px 3px' }}
        ></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(213,177,128,0.12),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(125,212,216,0.12),transparent_24%),linear-gradient(180deg,rgba(6,9,14,0.94)_0%,rgba(4,7,10,0.98)_100%)] pointer-events-none"></div>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="panel-noise aether-surface-strong text-center z-10 rounded-[2rem] p-8"
        >
          <div className="mb-4 flex justify-center">
            <AetherMark size="lg" />
          </div>
          <h1 className="mb-3 bg-gradient-to-r from-[#f3e6c9] via-[#a4e6e2] to-[#82c7d4] bg-clip-text text-4xl font-bold tracking-[0.18em] text-transparent">AETHERIA</h1>
          <div className="mx-auto mb-4 h-px w-40 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="flex items-center justify-center gap-2 text-[#d9ecec]">
            <span className="h-2 w-2 rounded-full bg-[#7dd4d8] animate-ping shadow-[0_0_12px_rgba(125,212,216,0.5)]"></span>
            <p className="tracking-widest text-sm">SYSTEM INITIALIZING... ({engine.bootStage})</p>
          </div>
        </Motion.div>
      </div>
    );
  }

  // v5.0: 런 요약(사망) 화면 — IntroScreen보다 먼저 체크해야 함
  // handleDefeat가 player.name을 ''로 리셋하므로 IntroScreen 조건에 걸리기 전에 처리
  if (engine.gameState === GS.DEAD && engine.runSummary) {
    return (
      <MainLayout visualEffect={null}>
        <Suspense fallback={null}>
          <RunSummaryCard
            runSummary={engine.runSummary}
            onRestart={() => engine.actions.reset?.()}
          />
        </Suspense>
      </MainLayout>
    );
  }

  if (!String(engine.player.name || '').trim()) {
    return (
      <MainLayout visualEffect={null}>
        <div className="flex flex-col items-center justify-center h-full space-y-6 relative z-10">
          <IntroScreen onStart={engine.actions.start} mobile={isMobileViewport} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout visualEffect={engine.visualEffect}>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className={`absolute inset-0 ${isMobileViewport ? 'animate-aurora' : ''} bg-[radial-gradient(circle_at_top_left,rgba(213,177,128,0.09),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(125,212,216,0.1),transparent_22%),linear-gradient(180deg,rgba(7,11,17,0.42)_0%,rgba(3,5,8,0.74)_100%)]`} />
        <div className={`absolute inset-0 ${isMobileViewport ? 'opacity-[0.18]' : 'opacity-[0.12]'} aether-soft-grid`} />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />
        <div className={`absolute -left-12 top-24 rounded-full blur-3xl ${isMobileViewport ? 'h-48 w-48 bg-[#d5b180]/10 animate-float-slow' : 'h-40 w-40 bg-[#d5b180]/7'}`} />
        <div className={`absolute -right-12 bottom-20 rounded-full blur-3xl ${isMobileViewport ? 'h-56 w-56 bg-[#7dd4d8]/10 animate-float-slow' : 'h-44 w-44 bg-[#7dd4d8]/6'}`} style={isMobileViewport ? { animationDelay: '-2.7s' } : undefined} />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 md:gap-3">
        <StatusBar
          player={engine.player}
          stats={fullStats}
          enemy={engine.gameState === GS.COMBAT ? engine.enemy : null}
          mobile={isMobileViewport}
          compactDesktop={!isMobileViewport}
          className={!isMobileViewport ? 'px-1 py-0.5 rounded-[1rem]' : ''}
        />

        {isMobileViewport ? (
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 flex min-h-0 flex-1 w-full flex-col gap-2 ${damageFlash ? 'ring-2 ring-red-500/30 rounded-[1.5rem]' : ''} ${healFlash ? 'ring-2 ring-green-500/30 rounded-[1.5rem]' : ''}`}
          >
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
            <Suspense fallback={<DashboardFallback mobile summary />}>
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
            />
            <Suspense fallback={mobileArchiveDockVisible ? <DashboardFallback mobile /> : null}>
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
            {mobileArchiveDockVisible && <div className="h-[4.1rem] shrink-0 md:hidden" aria-hidden="true" />}
          </Motion.div>
        ) : (
          <>
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 w-full grid grid-cols-1 gap-1 md:flex-1 md:min-h-0 md:overflow-hidden transition-all duration-150 md:grid-cols-[minmax(0,1fr)_11rem] lg:grid-cols-[minmax(0,1fr)_clamp(11.5rem,16vw,12.75rem)] xl:grid-cols-[minmax(0,1fr)_clamp(12rem,16vw,13.5rem)] ${damageFlash ? 'ring-2 ring-red-500/40' : ''} ${healFlash ? 'ring-2 ring-green-500/40' : ''}`}
          >
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
        )}
      </div>

      {/* Floating Damage/Heal Number */}
      {damageAmount && <DamageNumber amount={damageAmount} />}

      {/* v4.0: 유물 3지선다 오버레이 */}
      {engine.pendingRelics && (
        <Suspense fallback={null}>
          <RelicChoicePanel
            pendingRelics={engine.pendingRelics}
            dispatch={engine.dispatch}
            player={engine.player}
          />
        </Suspense>
      )}

      {engine.postCombatResult && (
        <Suspense fallback={null}>
          <PostCombatCard
            result={engine.postCombatResult}
            onClose={() => engine.actions.clearPostCombat?.()}
            onRest={() => engine.actions.rest?.()}
            onSell={() => engine.actions.setSideTab?.('inventory')}
            mobile={isMobileViewport}
          />
        </Suspense>
      )}

      {/* v4.0: 에테르 환생 풀스크린 */}
      {engine.gameState === GS.ASCENSION && (
        <Suspense fallback={null}>
          <AscensionScreen
            player={engine.player}
            actions={engine.actions}
          />
        </Suspense>
      )}

    </MainLayout>
  );
}

export default App;
