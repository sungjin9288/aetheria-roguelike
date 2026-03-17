import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';

import { GS } from './reducers/gameStates';
import { soundManager } from './systems/SoundManager';

// 항상 즉시 필요한 컴포넌트 — eager import
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';
import IntroScreen from './components/IntroScreen';
import DamageNumber from './components/DamageNumber';
import AetherMark from './components/AetherMark';

// 조건부로만 렌더되는 무거운 컴포넌트 — lazy import (청크 분리)
const RelicChoicePanel = lazy(() => import('./components/RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('./components/AscensionScreen'));
const RunSummaryCard   = lazy(() => import('./components/RunSummaryCard'));

import { useGameEngine } from './hooks/useGameEngine';
import { useDamageFlash } from './hooks/useDamageFlash';

function App() {
  const engine = useGameEngine();
  const [isMuted, setIsMuted] = useState(false);
  const [inventorySpotlight] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));

  // Damage Flash hook
  const { damageFlash, healFlash, damageAmount } = useDamageFlash(engine.player?.hp);
  const mobileArchiveDockVisible = (
    [GS.IDLE, GS.MOVING].includes(engine.gameState)
    && !engine.pendingRelics
    && engine.gameState !== GS.ASCENSION
  );

  // QuickSlot use handler
  const handleQuickSlotUse = (item, index) => {
    if (!engine.player.inv.some((entry) => entry.id === item?.id)) {
      if (typeof index === 'number') engine.actions.setQuickSlot?.(index, null);
      return;
    }
    engine.actions.useItem(item);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobileViewport(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

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
        maxHp: engine.getFullStats().maxHp,
        mp: engine.player.mp,
        maxMp: engine.getFullStats().maxMp,
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
    engine.getFullStats,
  ]);

  if (engine.bootStage !== 'ready') {
    return (
      <div className="flex h-[100dvh] w-full bg-cyber-black items-center justify-center text-cyber-blue font-rajdhani relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 0.7px, transparent 0.7px)', backgroundSize: '3px 3px' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-transparent to-cyber-black pointer-events-none"></div>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="panel-noise text-center z-10 p-8 border border-cyber-blue/30 bg-cyber-slate/50 backdrop-blur-md rounded-lg shadow-[0_0_30px_rgba(0,204,255,0.2)]"
        >
          <div className="mb-4 flex justify-center">
            <AetherMark size="lg" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyber-blue to-cyber-purple mb-4 animate-pulse">AETHERIA</h1>
          <div className="flex items-center gap-2 text-cyber-green justify-center">
            <span className="w-2 h-2 bg-cyber-green rounded-full animate-ping shadow-[0_0_10px_#00ff9d]"></span>
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
        <div className="absolute inset-0 animate-aurora bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#040813_0%,#03060f_48%,#050912_100%)]" />
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/8 to-transparent" />
        <div className="absolute -left-10 top-28 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl animate-float-slow" />
        <div className="absolute -right-10 bottom-24 h-52 w-52 rounded-full bg-emerald-400/8 blur-3xl animate-float-slow" style={{ animationDelay: '-2.7s' }} />
      </div>
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
            quickSlots={engine.quickSlots}
            onQuickSlotUse={handleQuickSlotUse}
            showInput={false}
            syncStatus={engine.syncStatus}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(soundManager.toggleMute())}
          />
          <Dashboard
            mobile
            mobileSection="summary"
            player={engine.player}
            sideTab={engine.sideTab}
            setSideTab={engine.actions.setSideTab}
            actions={engine.actions}
            stats={engine.getFullStats()}
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
            stats={engine.getFullStats()}
            mobile
          />
          <Dashboard
            mobile
            mobileSection="archive"
            player={engine.player}
            sideTab={engine.sideTab}
            setSideTab={engine.actions.setSideTab}
            actions={engine.actions}
            stats={engine.getFullStats()}
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
          {mobileArchiveDockVisible && <div className="h-[5.25rem] shrink-0 md:hidden" aria-hidden="true" />}
        </Motion.div>
      ) : (
        <>
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 w-full grid grid-cols-1 gap-2 md:gap-3 md:grid-cols-[minmax(0,1fr)_clamp(17rem,31vw,22rem)] md:flex-1 md:min-h-0 md:overflow-hidden transition-all duration-150 ${damageFlash ? 'ring-2 ring-red-500/40' : ''} ${healFlash ? 'ring-2 ring-green-500/40' : ''}`}
          >
            <TerminalView
              logs={engine.logs}
              gameState={engine.gameState}
              onCommand={engine.handleCommand}
              autoFocusInput
              mobile={false}
              player={engine.player}
              quickSlots={engine.quickSlots}
              onQuickSlotUse={handleQuickSlotUse}
              showInput
              syncStatus={engine.syncStatus}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(soundManager.toggleMute())}
            />
            {!isMobileViewport && (
              <Dashboard
                player={engine.player}
                sideTab={engine.sideTab}
                setSideTab={engine.actions.setSideTab}
                actions={engine.actions}
                stats={engine.getFullStats()}
                quickSlots={engine.quickSlots}
                inventorySpotlight={inventorySpotlight}
                runtime={{
                  syncStatus: engine.syncStatus,
                  gameState: engine.gameState,
                  isAiThinking: engine.isAiThinking,
                  viewport: 'desktop',
                }}
              />
            )}
          </Motion.div>

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
            stats={engine.getFullStats()}
          />
        </>
      )}

      {/* Floating Damage/Heal Number */}
      {damageAmount && <DamageNumber amount={damageAmount} />}

      {/* v4.0: 유물 3지선다 오버레이 */}
      {engine.pendingRelics && (
        <Suspense fallback={null}>
          <RelicChoicePanel
            pendingRelics={engine.pendingRelics}
            dispatch={engine.dispatch}
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
