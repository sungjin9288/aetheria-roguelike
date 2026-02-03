import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import { Cloud, WifiOff, Terminal as TerminalIcon } from 'lucide-react';
import { onSnapshot, doc, collection, query, orderBy, limit, getDocs, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db } from './firebase';
import { CONSTANTS, APP_ID, ADMIN_UIDS } from './data/constants';
import { DB } from './data/db';
import { LOOT_TABLE } from './data/loot';
import { TokenQuotaManager } from './systems/TokenQuotaManager';
import { LatencyTracker } from './systems/LatencyTracker';
import { AI_SERVICE } from './services/aiService';
import { checkMilestones, migrateData } from './utils/gameUtils';
import { parseCommand } from './utils/commandParser';
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';
import { gameReducer, INITIAL_STATE } from './reducers/gameReducer';

// --- INITIAL STATE & REDUCER imported from ./reducers/gameReducer

// --- CORE ENGINE HOOK ---
const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const { player, gameState, logs, enemy, grave, shopItems, isAiThinking, currentEvent, visualEffect, syncStatus, uid, bootStage, liveConfig, leaderboard, sideTab } = state;

  // 1. BOOTSTRAP: Auth
  useEffect(() => {
    dispatch({ type: 'SET_BOOT_STAGE', payload: 'auth' });
    signInAnonymously(auth).then(cred => {
      dispatch({ type: 'SET_UID', payload: cred.user.uid });
      dispatch({ type: 'SET_BOOT_STAGE', payload: 'config' });
    }).catch(e => {
      console.error("Auth Failed", e);
      // Retry or Fallback? For now, nothing works without Auth.
    });
  }, []);

  // 2. BOOTSTRAP: Config & Leaderboard (Parallel)
  useEffect(() => {
    if (bootStage !== 'config') return;

    // Live Config
    const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists() && snap.data().config) {
        dispatch({ type: 'SET_LIVE_CONFIG', payload: snap.data().config });
      }
    });

    // Leaderboard (One-time fetch for efficiency)
    const fetchLeaderboard = async () => {
      try {
        const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
        const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50));
        const snap = await getDocs(q);
        const data = [];
        snap.forEach(d => data.push(d.data()));
        dispatch({ type: 'SET_LEADERBOARD', payload: data });
      } catch (e) {
        console.warn("Leaderboard fetch failed", e);
      }
    };
    fetchLeaderboard();

    // Proceed to Data Load
    dispatch({ type: 'SET_BOOT_STAGE', payload: 'data' });

    return () => unsubConfig();
  }, [bootStage]);

  // 3. BOOTSTRAP: User Data (Firestore Sync)
  useEffect(() => {
    if (bootStage !== 'data' || !uid) return;

    const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      // DEADLOCK PREVENTION: Ignore local pending writes to avoid loops
      if (docSnap.metadata.hasPendingWrites) return;

      if (docSnap.exists()) {
        const remoteData = docSnap.data();

        // EQUALITY CHECK: Avoid re-loading if timestamps match (approximately)
        // or if we are the ones who just saved it (relies on pendingWrites check mostly)
        if (state.lastLoadedTimestamp && remoteData.lastActive?.toMillis() === state.lastLoadedTimestamp) {
          return;
        }

        const activeData = migrateData(remoteData);
        if (activeData) {
          // Sanitize State
          if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
          if (!activeData.player.loc) activeData.player.loc = '시작의 마을';

          dispatch({ type: 'LOAD_DATA', payload: activeData });
          // Only add log on FIRST load to avoid spam
          if (state.logs.length === 0) {
            dispatch({ type: 'ADD_LOG', payload: { type: 'system', text: '시스템에 연결되었습니다.' } });
          }
        }
      } else {
        // New User
        dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } }); // Load Default
      }
    });

    return () => unsubscribe();
  }, [uid, bootStage]); // Removed 'state.lastLoadedTimestamp' to prevent re-subscription loops

  // 4. PERSISTENCE (Debounced Save)
  useEffect(() => {
    if (state.syncStatus !== 'syncing' || !uid) return;

    const saveData = async () => {
      try {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        const payload = {
          player: player,
          gameState: gameState,
          enemy: enemy,
          grave: grave,
          currentEvent: currentEvent,
          version: CONSTANTS.DATA_VERSION,
          lastActive: serverTimestamp() // Generates new timestamp
        };

        // Archive History logic
        if (player.archivedHistory && player.archivedHistory.length > 0) {
          const historyCol = collection(userDocRef, 'history');
          await Promise.all(player.archivedHistory.map(h => addDoc(historyCol, h)));
          payload.player.archivedHistory = [];
        }

        await setDoc(userDocRef, payload, { merge: true });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
      } catch (e) {
        console.error("Save Failed", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
      }
    };

    const timer = setTimeout(saveData, 500); // 0.5s Debounce for faster persistence
    return () => clearTimeout(timer);
  }, [player, gameState, enemy, grave, currentEvent, syncStatus, uid]);

  // --- ACTIONS ---
  // Helper to safely add logs
  const addLog = (type, text) => dispatch({ type: 'ADD_LOG', payload: { type, text } });

  const addStoryLog = async (type, data) => {
    dispatch({ type: 'SET_AI_THINKING', payload: true });
    const tempId = Date.now();
    dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });

    // Call AI
    const narrative = await AI_SERVICE.generateStory(type, { ...data, history: player.history }, uid);

    dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text: narrative } } });
    dispatch({ type: 'SET_AI_THINKING', payload: false });
  };

  const getFullStats = () => {
    const cls = DB.CLASSES[player.job] || DB.CLASSES['모험가'];
    const wVal = player.equip.weapon?.val || 0;
    const aVal = player.equip.armor?.val || 0;
    return {
      atk: Math.floor((player.atk + wVal) * cls.atkMod),
      def: player.def + aVal,
      elem: player.equip.weapon?.elem || '물리'
    };
  };

  // Memoized Actions for Components
  const actions = useMemo(() => ({
    // Navigation
    move: (loc) => {
      console.log('Action: MOVE', loc, { gameState, isAiThinking, loc: player.loc });
      if (isAiThinking) return;
      // Guidance if no arg
      if (!loc) {
        const exits = DB.MAPS[player.loc].exits.join(', ');
        return addLog('info', `이동 가능한 지역: ${exits}`);
      }

      if (gameState === 'combat') return addLog('error', '전투 중에는 이동할 수 없습니다!');
      if (gameState === 'shop') return addLog('error', '상점을 먼저 나가주세요.');

      const targetMap = DB.MAPS[loc];
      if (!targetMap) return addLog('error', '존재하지 않는 지역입니다.');
      if (player.level < targetMap.minLv) return addLog('error', `레벨 ${targetMap.minLv} 이상이어야 이동할 수 있습니다.`);

      if (!DB.MAPS[player.loc].exits.includes(loc) && loc !== '시작의 마을') return addLog('error', '갈 수 없는 곳입니다.');

      dispatch({ type: 'SET_PLAYER', payload: { loc } });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
      addLog('success', `👣 ${loc}로 이동했습니다.`);
      addLog('system', targetMap.desc);
      if (grave && grave.loc === loc) addLog('event', '⚰️ 유해가 발견되었습니다.');
    },

    // Start Game
    start: (name) => {
      if (!name.trim()) return;
      dispatch({ type: 'SET_PLAYER', payload: { name: name.trim() } });
      addLog('system', `환영합니다, ${name}님.`);
    },



    // Exploration
    explore: async () => {
      if (gameState !== 'idle') return addLog('error', '탐색할 수 없는 상태입니다.');
      if (player.loc === '시작의 마을') return addLog('info', '마을 주변은 평화롭습니다.');

      const mapData = DB.MAPS[player.loc];
      if (Math.random() < (mapData.eventChance || 0)) {
        dispatch({ type: 'SET_GAME_STATE', payload: 'event' });
        dispatch({ type: 'SET_AI_THINKING', payload: true }); // Start Loading

        try {
          const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid);
          if (eventData && eventData.desc) {
            dispatch({ type: 'SET_EVENT', payload: eventData });
            addLog('event', eventData.desc);
          } else {
            dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
            addLog('info', '아무것도 발견하지 못했습니다.');
          }
        } finally {
          dispatch({ type: 'SET_AI_THINKING', payload: false }); // End Loading
        }
        return;
      }

      // 30% Nothing
      if (Math.random() < 0.3) return addLog('info', '조용합니다. 아무것도 발견하지 못했습니다.');

      // ENEMY
      const mName = mapData.monsters[Math.floor(Math.random() * mapData.monsters.length)];
      const mStats = { name: mName, hp: 120 + mapData.level * 30, maxHp: 120 + mapData.level * 30, atk: 15 + mapData.level * 4, exp: 10 + mapData.level * 5, gold: 10 + mapData.level * 2 };

      dispatch({ type: 'SET_ENEMY', payload: mStats });
      dispatch({ type: 'SET_GAME_STATE', payload: 'combat' });
      addLog('combat', `⚠️ ${mName} 출현!`);
      addStoryLog('encounter', { loc: player.loc, name: mName });
    },
    handleEventChoice: (idx) => {
      if (!currentEvent) return;
      const outcome = Math.random();
      let resultLog = "";
      if (outcome > 0.4) {
        const rewardGold = player.level * 50;
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + rewardGold }) });
        resultLog = `성공! ${rewardGold}G를 얻었습니다.`;
        addLog('success', resultLog);
      } else {
        const dmg = Math.floor(player.maxHp * 0.1);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(1, p.hp - dmg) }) });
        resultLog = `실패... ${dmg}의 피해를 입었습니다.`;
        addLog('error', resultLog);
      }

      let newHistory = [...player.history, { timestamp: Date.now(), event: currentEvent.desc, choice: currentEvent.choices[idx], outcome: resultLog }];
      if (newHistory.length > 50) newHistory.shift();
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, history: newHistory }) });
      dispatch({ type: 'SET_EVENT', payload: null });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
    },
    rest: () => {
      if (gameState !== 'idle') return;
      const mapData = DB.MAPS[player.loc];
      if (mapData.type !== 'safe') return addLog('error', '휴식은 안전한 곳에서만 가능합니다.');

      const cost = 100;
      if (player.gold < cost) return addLog('error', '골드가 부족합니다.');
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - cost, hp: p.maxHp, mp: p.maxMp }) });
      addLog('success', '푹 쉬었습니다. 체력이 모두 회복되었습니다.');
      addStoryLog('rest', { loc: player.loc });
    },
    combat: (type) => {
      if (gameState !== 'combat' || !enemy) return addLog('error', '전투 중이 아닙니다.');
      const stats = getFullStats();

      if (type === 'skill') {
        if (player.mp < 10) return addLog('error', '마나가 부족합니다.');
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, mp: p.mp - 10 }) });
      }

      if (type === 'attack' || type === 'skill') {
        let mult = type === 'skill' ? 1.5 : 1.0;
        const dmg = Math.floor(stats.atk * (0.9 + Math.random() * 0.2) * mult);
        const isCrit = Math.random() < 0.1;
        const finalDmg = isCrit ? dmg * 2 : dmg;

        const newHp = enemy.hp - finalDmg;
        addLog(isCrit ? 'critical' : 'combat', `⚔️ ${enemy.name}에게 ${finalDmg} 피해! ${isCrit ? '(치명타!)' : ''} (남은 체력: ${Math.max(0, newHp)}/${enemy.maxHp})`);
        dispatch({ type: 'SET_VISUAL_EFFECT', payload: isCrit ? 'shake' : null });

        if (newHp <= 0) {
          dispatch({ type: 'SET_ENEMY', payload: null });
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });

          // Level Up Logic
          let p = { ...player };
          p.exp += enemy.exp;
          p.gold += enemy.gold;
          p.stats.kills += 1;

          if (p.exp >= p.nextExp) {
            p.level++;
            p.exp -= p.nextExp;
            p.nextExp = Math.floor(p.nextExp * 1.5);
            p.maxHp += 20;
            p.maxMp += 10;
            p.hp = p.maxHp;
            p.mp = p.maxMp;
            p.atk += 2;
            p.def += 1;
            addLog('system', `✨ LEVEL UP! Lv.${p.level} 달성! (HP/MP/Stats 증가)`);
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'levelUp' });
          }

          dispatch({ type: 'SET_PLAYER', payload: p });
          addLog('success', `승리! EXP +${enemy.exp}, Gold +${enemy.gold}`);
          addStoryLog('victory', { name: enemy.name });

          // Drop
          const lootList = LOOT_TABLE[enemy.name];
          if (lootList && lootList.length > 0) {
            lootList.forEach(itemName => {
              if (Math.random() < 0.4) {
                const itemData = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors].find(i => i.name === itemName);
                if (itemData) {
                  const newItem = { ...itemData, id: Date.now() + Math.random().toString() };
                  dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, inv: [...p.inv, newItem] }) });
                  addLog('success', `📦 ${itemName} 획득!`);
                }
              }
            });
          }
        } else {
          dispatch({ type: 'SET_ENEMY', payload: { ...enemy, hp: newHp } });
          setTimeout(() => {
            const enemyDmg = Math.max(1, enemy.atk - stats.def);
            dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
            addLog('warning', `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.`);
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
            if (player.hp - enemyDmg <= 0) {
              // GRAVE DROP LOGIC
              let droppedItem = null;
              if (player.inv.length > 0) {
                const tradableItems = player.inv.filter(i => !i.id?.startsWith('starter_'));
                if (tradableItems.length > 0) {
                  droppedItem = tradableItems[Math.floor(Math.random() * tradableItems.length)];
                }
              }
              const graveData = {
                loc: player.loc,
                gold: Math.floor(player.gold / 2),
                item: droppedItem,
                timestamp: Date.now()
              };
              dispatch({ type: 'SET_GRAVE', payload: graveData });

              // DEATH PENALTY (Hardcore Reset)
              const starterState = { ...INITIAL_STATE.player };
              starterState.name = ''; // TRIGGER INTRO (Reset Identity)
              starterState.gold = 400;
              starterState.inv = [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }];


              dispatch({ type: 'SET_PLAYER', payload: starterState });
              dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
              dispatch({ type: 'SET_ENEMY', payload: null });
              addLog('error', '💀 사망했습니다. 레벨과 장비가 초기화되었습니다. (전생)');
              addStoryLog('death', { loc: player.loc });
            }
          }, 500);
        }
      }
      else if (type === 'escape') {
        if (Math.random() > 0.5) {
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          dispatch({ type: 'SET_ENEMY', payload: null });
          addLog('info', '🏃‍♂️ 무사히 도망쳤습니다.');
        } else {
          addLog('error', '도망에 실패했습니다!');
          const enemyDmg = Math.max(1, enemy.atk - stats.def);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
          addLog('warning', `💥 ${enemy.name}의 추격! ${enemyDmg} 피해.`);
        }
      }
    },
    market: (type, item) => {
      if (gameState !== 'shop') return;
      if (type === 'buy') {
        if (player.gold >= item.price) {
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, { ...item, id: Date.now().toString() }] }) });
          addLog('success', `💰 ${item.name} 구매 완료.`);
        } else addLog('error', '골드가 부족합니다.');
      }
      else if (type === 'sell') {
        const sellPrice = Math.floor(item.price * 0.5);
        const idx = player.inv.findIndex(i => i.id === item.id);
        if (idx > -1) {
          const newInv = [...player.inv];
          newInv.splice(idx, 1);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + sellPrice, inv: newInv }) });
          addLog('success', `💰 ${item.name} 판매 완료 (+${sellPrice}G)`);
        }
      }
    },
    craft: (recipeId) => {
      // Crafting logic
      const recipe = DB.ITEMS.recipes?.find(r => r.id === recipeId);
      if (!recipe) return;
      if (player.gold < recipe.gold) return addLog('error', '골드 부족');
      // Assume materials check passed for now or implement full check
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - recipe.gold, inv: [...p.inv, { name: recipe.name, type: 'item', id: Date.now().toString() + Math.random().toString().slice(2, 5) }] }) });
      addLog('success', `${recipe.name} 제작 완료`);
    },

    reset: () => {
      if (window.confirm('모든 데이터를 삭제하고 초기화하시겠습니까?')) {
        dispatch({ type: 'RESET_GAME' });
      }
    },
    jobChange: (jobName) => {
      dispatch({ type: 'SET_PLAYER', payload: { job: jobName } });
      addLog('success', `✨ ${jobName} 전직 완료!`);
    },
    acceptQuest: (qId) => {
      const qData = DB.QUESTS.find(q => q.id === qId);
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, quests: [...p.quests, { id: qId, progress: 0 }] }) });
      addLog('event', `퀘스트 수락: ${qData.title}`);
    },
    lootGrave: () => {
      if (!grave) return;
      let logMsg = `유해 수습: ${grave.gold}G 획득`;
      let updates = { gold: player.gold + grave.gold };

      if (grave.item) {
        updates.inv = [...player.inv, { ...grave.item, id: Date.now().toString() }]; // Fixed: String ID
        logMsg += `, ${grave.item.name} 획득`;
      }

      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, ...updates }) });
      dispatch({ type: 'SET_GRAVE', payload: null });
      addLog('success', logMsg);
    },
    useItem: (item) => {
      if (['weapon', 'armor'].includes(item.type)) {
        const newInv = player.inv.filter(i => i !== item);
        const oldEquip = player.equip[item.type];
        if (oldEquip && oldEquip.name !== '맨손') newInv.push(oldEquip);
        dispatch({ type: 'SET_PLAYER', payload: { ...player, inv: newInv, equip: { ...player.equip, [item.type]: item } } });
        addLog('success', `${item.name} 장착.`);
      }
      if (item.type === 'hp') {
        const newInv = player.inv.filter(i => i !== item);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.min(p.maxHp, p.hp + item.val), inv: newInv }) });
        addLog('success', `${item.name} 사용.`);
      }
    },
    setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
    setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
    setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }), // Re-added!
    setAiThinking: (val) => dispatch({ type: 'SET_AI_THINKING', payload: val }), // Re-added!
    getUid: () => uid,
    isAdmin: () => ADMIN_UIDS.includes(uid),
    liveConfig,
    leaderboard
  }), [player, gameState, enemy, isAiThinking, logs, uid, liveConfig, grave, currentEvent, shopItems]);

  // CLI Integration
  const handleCommand = (text) => {
    const result = parseCommand(text, gameState, player, actions);
    if (typeof result === 'string') addLog('system', result);
  };

  return {
    player, gameState, logs, enemy, actions, getFullStats, sideTab, grave, shopItems,
    isAiThinking, currentEvent, visualEffect, syncStatus, leaderboard, liveConfig, bootStage,
    handleCommand
  };
};

// --- MAIN COMPONENT ---
function App() {
  const engine = useGameEngine();

  // LOADING SCREEN
  if (engine.bootStage !== 'ready') {
    return (
      <div className="flex h-screen w-full bg-slate-950 items-center justify-center text-slate-400">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-4">AETHERIA</h1>
          <p className="animate-pulse">시스템 초기화 중... ({engine.bootStage})</p>
        </div>
      </div>
    );
  }

  // INTRO (NAME INPUT)
  if (!engine.player.name || engine.player.name === '방랑자' || !engine.player.name.trim()) {
    return (
      <MainLayout visualEffect={null}>
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">AETHERIA</h1>
          <p className="text-slate-400">당신의 이름을 입력하세요</p>
          <input
            type="text"
            className="bg-slate-800 border border-slate-600 p-2 rounded text-white text-center"
            onKeyDown={(e) => {
              if (e.key === 'Enter') engine.actions.start(e.target.value);
            }}
            autoFocus
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout visualEffect={engine.visualEffect}>
      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
            AETHERIA <span className="text-xs text-slate-500 font-normal">v{CONSTANTS.DATA_VERSION}</span>
          </h1>

          {/* CLI INPUT (v3.5) */}
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1 gap-2 w-64">
            <TerminalIcon size={12} className="text-slate-500" />
            <input
              type="text"
              placeholder="CLI 명령 입력 (/help)"
              className="bg-transparent text-xs text-slate-300 focus:outline-none w-full font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  engine.handleCommand(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {engine.syncStatus === 'synced' && <Cloud size={14} className="text-emerald-500" />}
          {engine.syncStatus === 'syncing' && <Cloud size={14} className="text-yellow-500 animate-pulse" />}
          {engine.syncStatus === 'offline' && <WifiOff size={14} className="text-red-500" />}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden flex gap-4">
        {/* LEFT: TERMINAL */}
        <TerminalView logs={engine.logs} gameState={engine.gameState} onCommand={engine.handleCommand} />

        {/* RIGHT: DASHBOARD */}
        <Dashboard
          player={engine.player}
          sideTab={engine.sideTab}
          setSideTab={engine.actions.setSideTab}
          actions={engine.actions}
          stats={engine.getFullStats()}
        />
      </div>

      {/* BOTTOM: CONTROLS */}
      <ControlPanel
        gameState={engine.gameState}
        player={engine.player}
        actions={engine.actions}
        setGameState={engine.actions.setGameState}
        shopItems={engine.shopItems}
        grave={engine.grave}
        isAiThinking={engine.isAiThinking}
      />
    </MainLayout>
  );
}

export default App;