import { useEffect, useReducer, useMemo, useCallback, useState } from 'react';
import { Terminal as TerminalIcon, Volume2, VolumeX } from 'lucide-react';

import { CONSTANTS, ADMIN_UIDS } from './data/constants';
import { DB } from './data/db';
import { soundManager } from './systems/SoundManager';
import { AI_SERVICE } from './services/aiService';
import { parseCommand } from './utils/commandParser';
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';
import { gameReducer, INITIAL_STATE } from './reducers/gameReducer';

// Extracted hooks
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { createGameActions } from './hooks/useGameActions';
import { createCombatActions } from './hooks/useCombatActions';
import { createInventoryActions } from './hooks/useInventoryActions';


const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const {
    player,
    gameState,
    logs,
    enemy,
    grave,
    shopItems,
    isAiThinking,
    currentEvent,
    visualEffect,
    syncStatus,
    uid,
    bootStage,
    liveConfig,
    leaderboard,
    sideTab
  } = state;

  // --- Firebase Sync ---
  useFirebaseSync(state, dispatch);

  // --- Sound Integration ---
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog) {
      if (lastLog.type === 'combat') soundManager.play('attack');
      if (lastLog.type === 'levelUp') soundManager.play('levelUp');
      if (lastLog.type === 'error') soundManager.play('error');
      if (lastLog.type === 'item') soundManager.play('item');
    }
  }, [logs]);

  // --- Shared Helpers ---
  const addLog = useCallback(
    (type, text) => dispatch({ type: 'ADD_LOG', payload: { type, text, id: `${Date.now()}_${Math.random()}` } }),
    []
  );

  const addStoryLog = useCallback(
    async (type, data) => {
      dispatch({ type: 'SET_AI_THINKING', payload: true });
      const tempId = Date.now();
      dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });

      const narrative = await AI_SERVICE.generateStory(type, { ...data, history: player.history }, uid);

      dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text: narrative } } });
      dispatch({ type: 'SET_AI_THINKING', payload: false });
    },
    [player.history, uid]
  );

  const getFullStats = useCallback(() => {
    const cls = DB.CLASSES[player.job] || DB.CLASSES['모험가'];
    const wVal = player.equip.weapon?.val || 0;
    const aVal = player.equip.armor?.val || 0;
    const oVal = player.equip.offhand?.val || 0;
    const buff = player.tempBuff || {};
    const meta = player.meta || {};

    const isMagic =
      ['마법사', '아크메이지', '흑마법사', '성직자'].includes(player.job) ||
      (player.equip.weapon?.elem && !['물리', 'physical'].includes(player.equip.weapon.elem));

    return {
      atk: Math.floor((player.atk + wVal + (meta.bonusAtk || 0)) * cls.atkMod * (1 + (buff.atk || 0))),
      def: Math.floor((player.def + aVal + oVal) * (1 + (buff.def || 0))),
      elem: player.equip.weapon?.elem || '물리',
      isMagic,
      weaponHands: player.equip.weapon?.hands || 1
    };
  }, [player]);

  // --- Compose Actions from Extracted Hooks ---
  const actions = useMemo(
    () => {
      const deps = { player, gameState, uid, grave, currentEvent, isAiThinking, enemy, dispatch, addLog, addStoryLog, getFullStats };
      const gameActions = createGameActions(deps);
      const combatActions = createCombatActions(deps);
      const inventoryActions = createInventoryActions(deps);

      return {
        ...gameActions,
        ...combatActions,
        ...inventoryActions,

        // UI State setters
        setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
        setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
        setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }),
        setAiThinking: (val) => dispatch({ type: 'SET_AI_THINKING', payload: val }),
        getUid: () => uid,
        isAdmin: () => ADMIN_UIDS.includes(uid),
        liveConfig,
        leaderboard
      };
    },
    [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard]
  );

  const handleCommand = (text) => {
    const result = parseCommand(text, gameState, player, actions);
    if (typeof result === 'string') addLog('system', result);
  };

  return {
    player,
    gameState,
    logs,
    enemy,
    actions,
    getFullStats,
    sideTab,
    grave,
    shopItems,
    isAiThinking,
    currentEvent,
    visualEffect,
    syncStatus,
    leaderboard,
    liveConfig,
    bootStage,
    handleCommand
  };
};

const IntroScreen = ({ onStart }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('male');

  const handleSubmit = () => {
    if (name.trim()) onStart(name, gender);
  };

  return (
    <div className="p-10 border border-cyber-purple/30 bg-cyber-slate/80 backdrop-blur-xl rounded-xl shadow-neon-purple max-w-md w-full text-center relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-purple to-transparent animate-scanline"></div>
      <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink mb-2 font-rajdhani">AETHERIA</h1>
      <p className="text-cyber-blue/70 mb-8 font-fira text-xs tracking-[0.2em] relative z-10">NEURAL LINK ESTABLISHED</p>

      <div className="space-y-6 relative z-10">
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setGender('male')}
            className={`px-6 py-2 rounded-lg font-rajdhani font-bold border ${gender === 'male' ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue shadow-neon-blue' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
          >
            MALE
          </button>
          <button
            onClick={() => setGender('female')}
            className={`px-6 py-2 rounded-lg font-rajdhani font-bold border ${gender === 'female' ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow-neon-pink' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
          >
            FEMALE
          </button>
        </div>

        <div className="relative group">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ENTER AGENT NAME"
            className="w-full bg-cyber-dark/50 border border-cyber-blue/50 p-4 rounded text-cyber-green text-center font-rajdhani text-xl focus:outline-none focus:border-cyber-pink focus:shadow-neon-pink transition-all placeholder:text-cyber-blue/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            autoFocus
          />
          <div className="absolute inset-0 border border-transparent group-hover:border-cyber-blue/20 rounded pointer-events-none transition-all"></div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-3 bg-cyber-blue/10 border border-cyber-blue/50 text-cyber-blue font-rajdhani font-bold hover:bg-cyber-blue/20 hover:shadow-neon-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          INITIALIZE CONNECTION
        </button>
      </div>
    </div>
  );
};

function App() {
  const engine = useGameEngine();
  const [isMuted, setIsMuted] = useState(soundManager.muted);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobileViewport(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  if (engine.bootStage !== 'ready') {
    return (
      <div className="flex h-screen w-full bg-cyber-black items-center justify-center text-cyber-blue font-rajdhani relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-transparent to-cyber-black pointer-events-none"></div>
        <div className="text-center z-10 p-8 border border-cyber-blue/30 bg-cyber-slate/50 backdrop-blur-md rounded-lg shadow-neon-blue">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyber-blue to-cyber-purple mb-4 animate-pulse">AETHERIA</h1>
          <div className="flex items-center gap-2 text-cyber-green">
            <span className="w-2 h-2 bg-cyber-green rounded-full animate-ping"></span>
            <p className="tracking-widest text-sm">SYSTEM INITIALIZING... ({engine.bootStage})</p>
          </div>
        </div>
      </div>
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
      <header className="flex flex-wrap justify-between items-center gap-2 mb-3 md:mb-4 pb-2 border-b border-cyber-blue/20 bg-cyber-slate/30 backdrop-blur-sm px-3 md:px-4 -mx-2 md:-mx-4 pt-2 supports-[backdrop-filter]:bg-cyber-slate/10">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyber-green to-cyber-blue bg-clip-text text-transparent flex items-center gap-2 font-rajdhani min-w-0">
            AETHERIA <span className="text-xs text-cyber-blue/50 font-normal border border-cyber-blue/30 px-1 rounded">v{CONSTANTS.DATA_VERSION}</span>
          </h1>
          <div className="hidden md:flex items-center bg-cyber-dark/80 border border-cyber-blue/30 rounded px-3 py-1 gap-2 w-80 shadow-inner group focus-within:border-cyber-green/50 focus-within:shadow-neon-green transition-all">
            <TerminalIcon size={14} className="text-cyber-green group-focus-within:animate-pulse" />
            <input
              type="text"
              placeholder="ENTER COMMAND (/help)"
              className="bg-transparent text-sm text-cyber-green focus:outline-none w-full font-fira placeholder:text-cyber-green/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  engine.handleCommand(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => {
              const nowMuted = soundManager.toggleMute();
              setIsMuted(nowMuted);
            }}
            className="text-cyber-blue/50 hover:text-cyber-blue transition-colors p-1.5 md:p-1 border border-cyber-blue/20 rounded"
            title="Toggle Sound"
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={16} data-mute-icon /> : <Volume2 size={16} data-mute-icon />}
          </button>
          <div className="flex items-center gap-2 text-xs font-fira text-cyber-blue/70 bg-cyber-dark/50 px-2 py-1 rounded border border-cyber-blue/10">
            <span className={`w-2 h-2 rounded-full ${engine.syncStatus === 'synced' ? 'bg-cyber-green shadow-neon-green' : engine.syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-neon-pink'}`}></span>
            {engine.syncStatus === 'synced' ? 'ONLINE' : engine.syncStatus === 'syncing' ? 'SYNCING...' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Grid overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 157, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 157, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row gap-2 md:gap-4 relative z-10 w-full">
        <TerminalView
          logs={engine.logs}
          gameState={engine.gameState}
          onCommand={engine.handleCommand}
          autoFocusInput={!isMobileViewport}
          mobile={isMobileViewport}
        />
        <Dashboard
          player={engine.player}
          sideTab={engine.sideTab}
          setSideTab={engine.actions.setSideTab}
          actions={engine.actions}
          stats={engine.getFullStats()}
          gameState={engine.gameState}
        />
      </div>

      <Dashboard
        mobile
        player={engine.player}
        sideTab={engine.sideTab}
        setSideTab={engine.actions.setSideTab}
        actions={engine.actions}
        stats={engine.getFullStats()}
        gameState={engine.gameState}
      />

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
    </MainLayout>
  );
}

export default App;
