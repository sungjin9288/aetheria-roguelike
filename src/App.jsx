import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Volume2, VolumeX, Play, Square } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

import { CONSTANTS } from './data/constants';
import { PRESTIGE_TITLES } from './data/titles';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobileViewport(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

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
  if (engine.gameState === 'dead' && engine.runSummary) {
    return (
      <MainLayout visualEffect={null}>
        <Suspense fallback={null}>
          <RunSummaryCard
            runSummary={engine.runSummary}
            onRestart={() => {
              engine.dispatch({ type: 'SET_RUN_SUMMARY', payload: null });
              engine.dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
            }}
          />
        </Suspense>
      </MainLayout>
    );
  }

  if (!engine.player.name || engine.player.name === '방랑자' || !engine.player.name.trim()) {
    return (
      <MainLayout visualEffect={null}>
        <div className="flex flex-col items-center justify-center h-full space-y-6 relative z-10">
          <IntroScreen onStart={engine.actions.start} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout visualEffect={engine.visualEffect}>
      <header className="flex flex-wrap justify-between items-center gap-1.5 md:gap-2 mb-2 pb-1.5 border-b border-cyber-blue/20 bg-cyber-slate/30 backdrop-blur-md px-3 md:px-4 -mx-2 md:-mx-4 pt-1.5 supports-[backdrop-filter]:bg-cyber-slate/10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-cyber-green to-cyber-blue bg-clip-text text-transparent flex items-center gap-2 font-rajdhani min-w-0 drop-shadow-sm">
            AETHERIA <span className="text-xs text-cyber-blue/50 font-normal border border-cyber-blue/30 px-1 rounded backdrop-blur-sm">v{CONSTANTS.DATA_VERSION}</span>
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
          <div className="flex items-center gap-2 text-[11px] font-fira text-cyber-blue/70 bg-cyber-dark/50 px-2 py-1 rounded-md border border-cyber-blue/20 backdrop-blur-sm shadow-inner">
            <span className={`w-2 h-2 rounded-full ${engine.syncStatus === 'synced' ? 'bg-cyber-green shadow-[0_0_8px_#00ff9d]' : engine.syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-[0_0_8px_#ff00ff]'}`}></span>
            {engine.syncStatus === 'synced' ? 'ONLINE' : engine.syncStatus === 'syncing' ? 'SYNCING...' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Grid overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-screen" style={{ backgroundImage: 'linear-gradient(rgba(0, 204, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 204, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* OnboardingGuide removed by user request */}

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
          autoFocusInput={!isMobileViewport}
          mobile={isMobileViewport}
          player={engine.player}
          quickSlots={engine.quickSlots}
          onQuickSlotUse={handleQuickSlotUse}
        />
        {/* Floating Damage/Heal Number */}
        {damageAmount && <DamageNumber amount={damageAmount} />}
        {!isMobileViewport && (
          <Dashboard
            player={engine.player}
            sideTab={engine.sideTab}
            setSideTab={engine.actions.setSideTab}
            actions={engine.actions}
            stats={engine.getFullStats()}
            quickSlots={engine.quickSlots}
          />
        )}
      </Motion.div>

      {isMobileViewport && (
        <ControlPanel
          gameState={engine.gameState}
          player={engine.player}
          actions={engine.actions}
          setGameState={engine.actions.setGameState}
          shopItems={engine.shopItems}
          grave={engine.grave}
          isAiThinking={engine.isAiThinking}
          currentEvent={engine.currentEvent}
        />
      )}

      {isMobileViewport && (
        <Dashboard
          mobile
          player={engine.player}
          sideTab={engine.sideTab}
          setSideTab={engine.actions.setSideTab}
          actions={engine.actions}
          stats={engine.getFullStats()}
          quickSlots={engine.quickSlots}
        />
      )}

      {!isMobileViewport && (
        <ControlPanel
          gameState={engine.gameState}
          player={engine.player}
          actions={engine.actions}
          setGameState={engine.actions.setGameState}
          shopItems={engine.shopItems}
          grave={engine.grave}
          isAiThinking={engine.isAiThinking}
          currentEvent={engine.currentEvent}
        />
      )}

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
      {engine.gameState === 'ascension' && (
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
          onSell={() => engine.actions.setSideTab?.('inventory')}
        />
      </Suspense>

      {/* Auto-Explore Floating Button */}
      {engine.gameState === 'idle' && (
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
      )}
    </MainLayout>
  );
}

export default App;
