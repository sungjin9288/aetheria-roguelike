import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Volume2, VolumeX, Play, Square } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

import { CONSTANTS } from './data/constants';
import { PRESTIGE_TITLES } from './data/titles';
import { AT } from './reducers/actionTypes';
import { GS } from './reducers/gameStates';
import { soundManager } from './systems/SoundManager';

// 항상 즉시 필요한 컴포넌트 — eager import
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';
import IntroScreen from './components/IntroScreen';
import DamageNumber from './components/DamageNumber';

// 조건부로만 렌더되는 무거운 컴포넌트 — lazy import (청크 분리)
const PostCombatCard   = lazy(() => import('./components/PostCombatCard'));
const RelicChoicePanel = lazy(() => import('./components/RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('./components/AscensionScreen'));
const RunSummaryCard   = lazy(() => import('./components/RunSummaryCard'));

import { useGameEngine } from './hooks/useGameEngine';
import { useAutoExplore } from './hooks/useAutoExplore';
import { useDamageFlash } from './hooks/useDamageFlash';

function App() {
  const engine = useGameEngine();
  const [isMuted, setIsMuted] = useState(false);
  const [inventorySpotlight, setInventorySpotlight] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));

  // Auto-Explore hook
  const autoExplore = useAutoExplore({
    player: engine.player,
    gameState: engine.gameState,
    isAiThinking: engine.isAiThinking,
    actions: engine.actions,
  });

  // Damage Flash hook
  const { damageFlash, healFlash, damageAmount } = useDamageFlash(engine.player?.hp);

  // QuickSlot use handler
  const handleQuickSlotUse = (item, index) => {
    if (!engine.player.inv.some((entry) => entry.id === item?.id)) {
      if (typeof index === 'number') engine.actions.setQuickSlot?.(index, null);
      return;
    }
    engine.actions.useItem(item);
  };

  const handleLootReview = () => {
    const result = engine.postCombatResult;
    const spotlightNames = [
      result?.upgradeHint?.name || null,
      result?.traitHint?.name || null,
      ...(Array.isArray(result?.items) ? result.items.slice(0, 2) : []),
    ].filter(Boolean);

    engine.actions.setSideTab?.('inventory');
    setInventorySpotlight({
      token: Date.now(),
      title: result?.upgradeHint?.name
        ? '장비 갱신 후보'
        : result?.traitHint?.name
          ? '성향 공명 전리품'
          : '이번 전리품',
      detail: result?.upgradeHint?.summary
        || result?.traitHint?.summary
        || '이번 전투에서 획득한 장비와 보상을 먼저 확인하세요.',
      names: [...new Set(spotlightNames)].slice(0, 4),
    });
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
      mode: !engine.player.name ? 'intro' : engine.gameState === GS.DEAD && engine.runSummary ? 'run_summary' : 'game',
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
          className="text-center z-10 p-8 border border-cyber-blue/30 bg-cyber-slate/50 backdrop-blur-md rounded-lg shadow-[0_0_30px_rgba(0,204,255,0.2)]"
        >
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

  if (!engine.player.name || engine.player.name === '방랑자' || !engine.player.name.trim()) {
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#040813_0%,#03060f_48%,#050912_100%)]" />
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <header className={`flex flex-wrap justify-between items-center gap-1.5 md:gap-2 mb-2 pb-1.5 border-b border-cyan-400/15 bg-slate-950/70 backdrop-blur-xl px-3 md:px-4 -mx-2 md:-mx-4 pt-2 shadow-[0_18px_32px_rgba(2,8,20,0.35)] ${isMobileViewport ? 'sticky top-0 z-30' : ''}`}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="text-base md:text-xl font-bold bg-gradient-to-r from-emerald-300 via-cyan-300 to-cyan-500 bg-clip-text text-transparent flex items-center gap-1.5 md:gap-2 font-rajdhani min-w-0 drop-shadow-sm tracking-[0.16em] md:tracking-normal">
            AETHERIA
            <span className="text-[10px] md:text-xs text-cyan-100/50 font-normal border border-cyan-400/20 px-1 rounded backdrop-blur-sm">
              v{CONSTANTS.DATA_VERSION}
            </span>
          </h1>
          {/* v5.0: 프레스티지 칭호 뱃지 */}
          {engine.player.meta?.prestigeRank > 0 && (
            <span className="hidden md:flex items-center gap-1 text-xs text-cyber-purple font-rajdhani border border-cyber-purple/30 px-2 py-0.5 rounded bg-cyber-purple/10 font-bold">
              ⚡ {PRESTIGE_TITLES[Math.min(engine.player.meta.prestigeRank - 1, 9)]}
            </span>
          )}
          {/* v5.0: 일일 프로토콜 진행 뱃지 */}
          {(() => {
            const dp = engine.player.stats?.dailyProtocol;
            const today = new Date().toISOString().slice(0, 10);
            if (!dp || dp.date !== today) return null;
            const done = dp.missions.filter(m => m.done).length;
            const total = dp.missions.length;
            return (
              <span className={`hidden md:flex items-center gap-1 text-xs font-rajdhani border px-2 py-0.5 rounded font-bold
                ${done === total ? 'text-cyber-green border-cyber-green/30 bg-cyber-green/10' : 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'}`}>
                📅 {done}/{total}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => {
              const nowMuted = soundManager.toggleMute();
              setIsMuted(nowMuted);
            }}
            className="text-cyber-blue/50 hover:text-cyber-blue transition-all p-1.5 border border-cyber-blue/20 rounded-md hover:bg-cyber-blue/10 hover:shadow-[0_0_10px_rgba(0,204,255,0.2)]"
            title="Toggle Sound"
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={16} data-mute-icon /> : <Volume2 size={16} data-mute-icon />}
          </button>
          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-fira text-cyber-blue/70 bg-cyber-dark/50 px-2 py-1 rounded-md border border-cyber-blue/20 backdrop-blur-sm shadow-inner">
            <span className={`w-2 h-2 rounded-full ${engine.syncStatus === 'synced' ? 'bg-cyber-green shadow-[0_0_8px_#00ff9d]' : engine.syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-[0_0_8px_#ff00ff]'}`}></span>
            <span className={isMobileViewport ? 'sr-only' : ''}>
              {engine.syncStatus === 'synced' ? 'ONLINE' : engine.syncStatus === 'syncing' ? 'SYNCING...' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>
      {isMobileViewport ? (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`relative z-10 w-full space-y-2 ${damageFlash ? 'ring-2 ring-red-500/30 rounded-[1.5rem]' : ''} ${healFlash ? 'ring-2 ring-green-500/30 rounded-[1.5rem]' : ''}`}
        >
          <Dashboard
            mobile
            player={engine.player}
            sideTab={engine.sideTab}
            setSideTab={engine.actions.setSideTab}
            actions={engine.actions}
            stats={engine.getFullStats()}
            quickSlots={engine.quickSlots}
            inventorySpotlight={inventorySpotlight}
            onClearInventorySpotlight={() => setInventorySpotlight(null)}
            runtime={{
              syncStatus: engine.syncStatus,
              gameState: engine.gameState,
              isAiThinking: engine.isAiThinking,
              viewport: 'mobile',
            }}
          />
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
            stats={engine.getFullStats()}
            mobile
          />
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
          />
        </Motion.div>
      ) : (
        <>
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative z-10 w-full grid grid-cols-1 gap-2 md:gap-4 md:grid-cols-[minmax(0,1fr)_clamp(20rem,40vw,28rem)] md:flex-1 md:min-h-0 md:overflow-hidden transition-all duration-150 ${damageFlash ? 'ring-2 ring-red-500/40' : ''} ${healFlash ? 'ring-2 ring-green-500/40' : ''}`}
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
                onClearInventorySpotlight={() => setInventorySpotlight(null)}
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

      {/* Post-Combat Result Card */}
      <Suspense fallback={null}>
        <PostCombatCard
          result={engine.postCombatResult}
          onClose={() => engine.actions.clearPostCombat?.()}
          onRest={() => engine.actions.rest?.()}
          onSell={handleLootReview}
          mobile={isMobileViewport}
        />
      </Suspense>

      {/* Auto-Explore */}
      {engine.gameState === GS.IDLE && (
        isMobileViewport ? (
          <div className="relative z-20 mt-2 flex flex-col gap-2">
            {autoExplore.autoLog && (
              <div className="text-[11px] font-fira text-cyber-blue/70 bg-cyber-black/80 border border-cyber-blue/20 px-2.5 py-1.5 rounded backdrop-blur-md">
                {autoExplore.autoLog}
              </div>
            )}
            <Motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => autoExplore.isAutoRunning ? autoExplore.stop('수동 정지') : autoExplore.start(10)}
              disabled={engine.isAiThinking}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-rajdhani font-bold text-xs tracking-[0.2em] shadow-lg transition-all backdrop-blur-md
                ${autoExplore.isAutoRunning
                  ? 'bg-red-950/80 border-red-500/50 text-red-400 hover:bg-red-900/80'
                  : 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green hover:bg-cyber-green/20'
                }`}
            >
              {autoExplore.isAutoRunning
                ? <><Square size={14} /> STOP ({autoExplore.runsLeft}회 남음)</>
                : <><Play size={14} /> AUTO EXPLORE</>}
            </Motion.button>
          </div>
        ) : (
          <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
            {autoExplore.autoLog && (
              <div className="text-xs font-fira text-cyber-blue/70 bg-cyber-black/80 border border-cyber-blue/20 px-2 py-1 rounded backdrop-blur-md max-w-[180px] text-right">
                {autoExplore.autoLog}
              </div>
            )}
            <Motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => autoExplore.isAutoRunning ? autoExplore.stop('수동 정지') : autoExplore.start(10)}
              disabled={engine.isAiThinking}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border font-rajdhani font-bold text-xs tracking-wider shadow-lg transition-all backdrop-blur-md
                ${autoExplore.isAutoRunning
                  ? 'bg-red-950/80 border-red-500/50 text-red-400 hover:bg-red-900/80'
                  : 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green hover:bg-cyber-green/20'
                }`}
            >
              {autoExplore.isAutoRunning
                ? <><Square size={14} /> STOP ({autoExplore.runsLeft}회 남음)</>
                : <><Play size={14} /> AUTO EXPLORE</>}
            </Motion.button>
          </div>
        )
      )}
    </MainLayout>
  );
}

export default App;
