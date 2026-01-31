import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import { Cloud, WifiOff } from 'lucide-react';
import { onSnapshot, doc, collection, query, orderBy, limit, getDocs, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db } from './firebase';
import { CONSTANTS, APP_ID, ADMIN_UIDS } from './data/constants';
import { DB } from './data/db';
import { TokenQuotaManager } from './systems/TokenQuotaManager';
import { LatencyTracker } from './systems/LatencyTracker'; // Used implicitly if needed, or by AI_SERVICE
import { AI_SERVICE } from './services/aiService';
import { checkMilestones, migrateData } from './utils/gameUtils';
import { parseCommand } from './utils/commandParser'; // CLI Support
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';

// INITIAL STATE
const INITIAL_STATE = {
  player: {
    name: '방랑자', job: '모험가', level: 1, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5, exp: 0, nextExp: 100, gold: 500, loc: '시작의 마을',
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0] },
    quests: [], achievements: [], stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
    tempBuff: { atk: 0, turn: 0 }, status: [],
    history: [], archivedHistory: [] // Telemetry Ledger
  },
  version: 2.7,
  gameState: 'idle',
  logs: [],
  enemy: null,
  currentEvent: null,
  grave: null,
  shopItems: [],
  sideTab: 'inventory',
  isAiThinking: false,
  visualEffect: null, // 'shake', 'flash', etc
  syncStatus: 'offline', // 'offline', 'syncing', 'synced'
  uid: null,
  leaderboard: [],
  liveConfig: { eventMultiplier: 1, announcement: '' } // Live-Ops
};

// REDUCER
const gameReducer = (state, action) => {
  switch (action.type) {
    case 'INIT_PLAYER':
      return { ...state, player: { ...state.player, ...action.payload }, syncStatus: 'synced' };
    case 'SET_UID':
      return { ...state, uid: action.payload };
    case 'SET_LEADERBOARD':
      return { ...state, leaderboard: action.payload };
    case 'SET_LIVE_CONFIG':
      return { ...state, liveConfig: { ...state.liveConfig, ...action.payload } };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload, syncStatus: 'syncing' };
    case 'SET_PLAYER': // Generic updater
      const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
      return { ...state, player: { ...state.player, ...nextPlayer }, syncStatus: 'syncing' };
    case 'SET_EVENT':
      return { ...state, currentEvent: action.payload, syncStatus: 'syncing' };
    case 'SET_SHOP_ITEMS':
      return { ...state, shopItems: action.payload };
    case 'SET_SIDE_TAB':
      return { ...state, sideTab: action.payload };
    case 'SET_AI_THINKING':
      return { ...state, isAiThinking: action.payload };
    case 'SET_VISUAL_EFFECT':
      return { ...state, visualEffect: action.payload };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, { id: Date.now() + Math.random(), ...action.payload }] };
    case 'UPDATE_LOG':
      return { ...state, logs: state.logs.map(l => l.id === action.payload.id ? action.payload.log : l) };
    case 'SET_ENEMY':
      return { ...state, enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload, syncStatus: 'syncing' };
    case 'SET_GRAVE':
      return { ...state, grave: action.payload, syncStatus: 'syncing' };
    case 'RESET_GAME':
      return { ...INITIAL_STATE, logs: [], uid: state.uid, syncStatus: 'synced' }; // Keep UID
    default:
      return state;
  }
};

const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const { player, gameState, logs, enemy, grave, shopItems, sideTab, isAiThinking, currentEvent, visualEffect, syncStatus, uid, leaderboard, liveConfig } = state;
  const logIdCounter = useRef(0);

  // 1. Auth & Init
  useEffect(() => {
    signInAnonymously(auth).then(cred => {
      dispatch({ type: 'SET_UID', payload: cred.user.uid });
    }).catch(e => console.error("Auth Fail", e));
  }, []);

  // --- LIVE CONFIG (Remote Config) ---
  useEffect(() => {
    // FIX: Corrected Firestore path to have even number of segments
    const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.config) {
          dispatch({ type: 'SET_LIVE_CONFIG', payload: data.config });
        }
      }
    }, (err) => console.error("LiveConfig Error", err));
    return () => unsubscribe();
  }, []);

  // 2. Load/Sync Logic
  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.metadata.hasPendingWrites) return; // Skip local writes

      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        // Conflict Resolution: If remote version is newer or differing?
        // Simple strategy: If we are 'offline' or just started, trust remote.
        // If we are 'syncing', trust local (prevent overwrite).

        // Actually for this MVP, we load once on start, then push.
        // But to support multi-device, we should check timestamps.

        // For now: Load only if we haven't loaded yet? Or just merge 'safe' fields?
        // Let's rely on migrateData for structure.

        // MVP: Only load if our local state is 'fresh' (e.g. on load)
        // But strict React Effect triggers on uid change.
        if (state.syncStatus === 'offline' || state.player.exp === 0) { // Naive check for 'initial load'
          const activeData = migrateData(remoteData);
          if (activeData) {
            // FIX: Reset transient states to prevent getting stuck (e.g. Shop with empty items)
            if (['shop', 'moving', 'job_change', 'crafting', 'quest_board'].includes(activeData.gameState)) {
              activeData.gameState = 'idle';
            }
            // Preserve combat only if enemy data exists
            if (activeData.gameState === 'combat' && !activeData.enemy) {
              activeData.gameState = 'idle';
            }

            dispatch({ type: 'INIT_PLAYER', payload: activeData.player });
            if (activeData.gameState) dispatch({ type: 'SET_GAME_STATE', payload: activeData.gameState });
            if (activeData.enemy) dispatch({ type: 'SET_ENEMY', payload: activeData.enemy });
          }
        }

        // Sync Quota
        TokenQuotaManager.syncToFirestore(uid, db);
      } else {
        // New User
        saveData(); // Create doc
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // 3. Save (Debounced)
  useEffect(() => {
    if (!uid || syncStatus !== 'syncing') return;

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
          lastActive: serverTimestamp()
        };

        if (player.archivedHistory && player.archivedHistory.length > 0) {
          const historyCol = collection(userDocRef, 'history');
          const batchPromises = player.archivedHistory.map(h => addDoc(historyCol, h));
          await Promise.all(batchPromises);
          payload.player.archivedHistory = [];
        }

        await setDoc(userDocRef, payload, { merge: true });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
      } catch (e) {
        console.error("Save Error", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
      }
    };

    const timer = setTimeout(saveData, 1000);
    return () => clearTimeout(timer);
  }, [uid, player, gameState, enemy, grave, currentEvent, syncStatus]);

  // Helper to trigger save manually (internal usage)
  const saveData = () => {
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
  };

  // 4. Leaderboard Fetching
  const fetchLeaderboard = async () => {
    try {
      const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
      const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const lbData = [];
      querySnapshot.forEach((doc) => {
        lbData.push(doc.data());
      });
      dispatch({ type: 'SET_LEADERBOARD', payload: lbData });
    } catch (e) {
      console.error("Leaderboard Fetch Error", e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // --- CORE MECHANICS ---
  const addLog = (type, text) => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_LOG', payload: { type, text, id, timestamp: Date.now() } });
    return id;
  };

  const addStoryLog = async (type, data) => {
    dispatch({ type: 'SET_AI_THINKING', payload: true });
    const tempId = Date.now();
    dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });
    const enrichedData = { ...data, history: player.history };
    const text = await AI_SERVICE.generateStory(type, enrichedData, uid);
    dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text } } });
    dispatch({ type: 'SET_AI_THINKING', payload: false });
  };

  const getFullStats = () => {
    const cls = DB.CLASSES[player.job];
    const wVal = player.equip.weapon?.val || 0;
    const aVal = player.equip.armor?.val || 0;
    const buff = player.tempBuff.turn > 0 ? (player.atk * 0.5) : 0;
    return {
      atk: Math.floor((player.atk + wVal + buff) * cls.atkMod),
      def: player.def + aVal,
      elem: player.equip.weapon?.elem || '물리'
    };
  };

  const generateDrop = (baseName) => {
    const allItems = [...DB.ITEMS.weapons, ...DB.ITEMS.armors, ...DB.ITEMS.consumables, ...DB.ITEMS.materials];
    const base = allItems.find(i => i.name === baseName);
    if (!base) return null;

    if ((base.type === 'weapon' || base.type === 'armor') && Math.random() < 0.2) {
      const validPrefixes = DB.ITEMS.prefixes.filter(p => p.type === 'all' || p.type === base.type);
      if (validPrefixes.length > 0) {
        const prefix = validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
        return {
          ...base,
          name: `${prefix.name} ${base.name}`,
          val: base.val + prefix.val,
          price: Math.floor(base.price * prefix.price),
          desc_stat: `${base.desc_stat.split('+')[0]}+${base.val + prefix.val}`,
          elem: prefix.elem || base.elem
        };
      }
    }
    return { ...base };
  };

  // --- ACTIONS ---
  const actions = useMemo(() => ({
    start: (name) => {
      dispatch({ type: 'SET_PLAYER', payload: { name: name.trim() || '방랑자' } });
      addLog('system', `환영합니다, ${name}님.`);
    },
    reset: () => {
      if (!window.confirm("초기화 하시겠습니까?")) return;
      localStorage.removeItem(CONSTANTS.SAVE_KEY);
      dispatch({ type: 'RESET_GAME' });
    },
    move: (loc) => {
      if (gameState === 'combat') return addLog('error', '⚠️ 전투 중에는 이동할 수 없습니다!');
      if (gameState === 'shop') return addLog('error', '⚠️ 상점을 먼저 나가주세요.');
      if (!DB.MAPS[player.loc].exits.includes(loc) && loc !== '시작의 마을') return addLog('error', '🚫 갈 수 없는 곳입니다.');

      dispatch({ type: 'SET_PLAYER', payload: { loc } });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
      addLog('success', `👣 ${loc} 도착.`);
      addLog('system', DB.MAPS[loc].desc);
      if (grave && grave.loc === loc) addLog('event', '⚰️ 유해가 발견되었습니다.');
    },
    explore: async () => {
      if (gameState !== 'idle') return addLog('error', '🚫 지금은 탐색할 수 없습니다.');
      if (player.loc === '시작의 마을') return addLog('info', '마을에서는 탐색할 수 없습니다.');

      const mapData = DB.MAPS[player.loc];
      if (Math.random() < (mapData.eventChance || 0)) {
        dispatch({ type: 'SET_GAME_STATE', payload: 'event' });
        dispatch({ type: 'SET_AI_THINKING', payload: true });
        addLog('loading', '❓ 기이한 기운이 느껴집니다...');
        const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid);
        dispatch({ type: 'SET_AI_THINKING', payload: false });

        if (eventData && eventData.desc && eventData.choices) {
          dispatch({ type: 'SET_EVENT', payload: eventData });
          addLog('event', eventData.desc);
        } else {
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          addLog('info', '아무것도 발견하지 못했습니다.');
        }
        return;
      }

      if (Math.random() < 0.3) {
        addLog('info', '아무것도 발견하지 못했습니다.');
      } else {
        const mName = mapData.monsters[Math.floor(Math.random() * mapData.monsters.length)];
        const monStats = { name: mName, hp: 100 + (mapData.level * 20), maxHp: 100 + (mapData.level * 20), atk: 10 + (mapData.level * 2), exp: 10 + mapData.level * 5, gold: 10 + mapData.level * 2, turn: 0 };

        dispatch({ type: 'SET_ENEMY', payload: monStats });
        dispatch({ type: 'SET_GAME_STATE', payload: 'combat' });
        addLog('combat', `⚠️ [${mName}] 출현!`);
        addStoryLog('encounter', { loc: player.loc, name: mName });
      }
    },
    handleEventChoice: (idx) => {
      if (!currentEvent) return;
      const outcome = Math.random();
      let resultLog = "";
      let resultType = "success";

      if (outcome > 0.4) {
        const rewardGold = player.level * 50;
        const rewardExp = player.level * 20;
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + rewardGold, exp: p.exp + rewardExp }) });
        resultLog = `성공! ${rewardGold}G와 ${rewardExp}EXP를 얻었습니다.`;
        resultType = "success";
        addLog('success', resultLog);
      } else {
        const dmg = Math.floor(player.maxHp * 0.1);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(1, p.hp - dmg) }) });
        resultLog = `실패... ${dmg}의 피해를 입었습니다.`;
        resultType = "error";
        addLog('error', resultLog);
      }

      let newHistory = [...player.history, { timestamp: Date.now(), event: currentEvent.desc, choice: currentEvent.choices[idx], outcome: resultLog, type: resultType }];
      let newArchived = player.archivedHistory || [];
      if (newHistory.length > 50) {
        const overflow = newHistory.shift();
        newArchived = [...newArchived, overflow];
      }
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, history: newHistory, archivedHistory: newArchived }) });
      dispatch({ type: 'SET_EVENT', payload: null });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
    },
    rest: () => {
      if (gameState !== 'idle') return;
      const cost = player.level * 10;
      const mapData = DB.MAPS[player.loc];
      if (mapData.type !== 'safe') return addLog('error', '⚠️ 휴식은 안전한 지역(마을)에서만 가능합니다.');
      if (player.gold < cost) return addLog('error', `🚫 골드가 부족합니다! (필요: ${cost}G)`);

      dispatch({
        type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - cost, hp: p.maxHp, mp: p.maxMp, })
      });
      addLog('success', `💤 푹 쉬었습니다. 체력과 마력이 모두 회복되었습니다. (-${cost}G)`);
      addStoryLog('rest', { loc: player.loc });
    },
    combat: (type) => {
      if (gameState !== 'combat' || !enemy) return addLog('error', '전투 중이 아닙니다.');
      const stats = getFullStats();
      if (type === 'skill') {
        const mpCost = 10;
        if (player.mp < mpCost) return addLog('error', `🚫 마나가 부족합니다! (필요: ${mpCost})`);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, mp: p.mp - mpCost }) });
      }

      if (type === 'escape') {
        if (Math.random() < 0.5) {
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          dispatch({ type: 'SET_ENEMY', payload: null });
          addLog('info', '🏃‍♂️ 도망쳤습니다!');
        } else {
          addLog('error', '🚫 도망 실패!');
          const enemyDmg = Math.max(1, enemy.atk - stats.def);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
          addLog('warning', `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.`);
          dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
          setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 500);
        }
        return;
      }

      if (type === 'attack' || type === 'skill') {
        let mult = type === 'skill' ? 1.5 : 1.0;
        let isCrit = Math.random() < 0.1;
        if (isCrit) {
          mult *= 2.0;
          dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
          setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 500);
        }
        const dmg = Math.floor(stats.atk * (0.9 + Math.random() * 0.2) * mult);
        const newHp = enemy.hp - dmg;
        let logText = `⚔️ ${enemy.name}에게 ${dmg} 피해!`;
        if (isCrit) logText = `⚡ 치명타! ${enemy.name}에게 ${dmg} 피해!`;
        addLog(isCrit ? 'critical' : 'combat', logText);

        if (newHp <= 0) {
          dispatch({ type: 'SET_ENEMY', payload: null });
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, exp: p.exp + Math.floor(enemy.exp * (liveConfig?.eventMultiplier || 1)), gold: p.gold + enemy.gold }) });
          addLog('success', `🎉 승리! EXP +${enemy.exp}, Gold +${enemy.gold}`);
          addStoryLog('victory', { name: enemy.name });

          const currentRegistry = player.stats.killRegistry || {};
          const newCount = (currentRegistry[enemy.name] || 0) + 1;
          const newRegistry = { ...currentRegistry, [enemy.name]: newCount };
          const milestones = checkMilestones(newRegistry, enemy.name, player);
          milestones.forEach(m => {
            addLog('event', m.msg);
            if (m.type === 'item') {
              const item = generateDrop(m.val);
              if (item) dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, inv: [...p.inv, item] }) });
            }
            if (m.type === 'gold') dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + m.val }) });
          });

          dispatch({
            type: 'SET_PLAYER', payload: p => ({
              ...p,
              stats: {
                ...p.stats,
                kills: p.stats.kills + 1,
                killRegistry: newRegistry,
                bossKills: (['화염의 군주', '마왕'].includes(enemy.name)) ? (p.stats.bossKills || 0) + 1 : (p.stats.bossKills || 0)
              }
            })
          });

          if (uid) {
            const lbDoc = doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', uid);
            setDoc(lbDoc, {
              nickname: player.name,
              job: player.job,
              level: player.level,
              totalKills: player.stats.kills + 1,
              bossKills: (['화염의 군주', '마왕'].includes(enemy.name)) ? (player.stats.bossKills || 0) + 1 : (player.stats.bossKills || 0),
              lastUpdate: serverTimestamp()
            }, { merge: true }).catch(e => console.error("LB Update Failed", e));
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'ranking_update' });
            setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' }), 2000);
            if (Math.random() < 0.2) fetchLeaderboard();
          }

          const dropTable = DB.LOOT_TABLE[enemy.name];
          if (dropTable && Math.random() < 0.4) {
            const dropName = dropTable[Math.floor(Math.random() * dropTable.length)];
            const item = generateDrop(dropName);
            if (item) dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, inv: [...p.inv, item] }) });
          }
        } else {
          dispatch({ type: 'SET_ENEMY', payload: prev => ({ ...prev, hp: newHp }) });
          const enemyDmg = Math.max(1, enemy.atk - stats.def);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
          addLog('warning', `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.`);
          if ((player.hp - enemyDmg) <= 0) {
            dispatch({ type: 'SET_PLAYER', payload: { hp: player.maxHp, gold: Math.floor(player.gold * 0.9), loc: '시작의 마을', exp: 0 } });
            dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
            dispatch({ type: 'SET_ENEMY', payload: null });
            addLog('error', '💀 사망했습니다. 마을에서 부활합니다.');
            addStoryLog('death', {});
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
            setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 1000);
          }
        }
      }
    },
    market: (type, item) => {
      if (gameState !== 'shop') return addLog('error', '상점을 이용할 수 없는 상태입니다.');
      if (type === 'buy') {
        if (player.gold >= item.price) {
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, generateDrop(item.name)] }) });
          addLog('success', `💰 ${item.name} 구매 완료.`);
        } else addLog('error', '골드가 부족합니다.');
      } else if (type === 'sell') {
        const idx = player.inv.findIndex(i => i === item);
        if (idx > -1) {
          const newInv = [...player.inv];
          newInv.splice(idx, 1);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + Math.floor(item.price / 2), inv: newInv }) });
          addLog('success', `💰 ${item.name} 판매 완료.`);
        }
      }
    },
    useItem: (item) => {
      if (gameState === 'combat') return addLog('error', '전투 중에는 장비를 변경하거나 사용할 수 없습니다.');
      const idx = player.inv.findIndex(i => i === item);
      if (idx === -1) return;

      if (item.type === 'hp') {
        const newInv = [...player.inv];
        newInv.splice(idx, 1);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.min(p.maxHp, p.hp + item.val), inv: newInv }) });
        addLog('success', `🧪 ${item.name} 사용.`);
      } else if (item.type === 'weapon' || item.type === 'armor') {
        if (item.jobs && !item.jobs.includes(player.job)) return addLog('error', `🚫 [${player.job}] 직업은 착용할 수 없습니다.`);

        const newInv = [...player.inv];
        newInv.splice(idx, 1);
        if (player.equip[item.type]) newInv.push(player.equip[item.type]);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, equip: { ...p.equip, [item.type]: item }, inv: newInv }) });
        addLog('success', `🛡️ ${item.name} 장착.`);
      }
    },
    jobChange: (jobName) => {
      if (gameState !== 'job_change') return;
      dispatch({ type: 'SET_PLAYER', payload: { job: jobName } });
      addLog('success', `✨ ${jobName} 전직 완료!`);
      addStoryLog('jobChange', { job: jobName });
    },
    acceptQuest: (qId) => {
      if (gameState !== 'quest_board') return;
      const qData = DB.QUESTS.find(q => q.id === qId);
      if (!qData) return;
      if (player.quests.some(q => q.id === qId)) return addLog('error', '이미 수락한 퀘스트입니다.');
      if (player.level < qData.minLv) return addLog('error', '레벨이 부족합니다.');

      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, quests: [...p.quests, { id: qId, progress: 0, completed: false }] }) });
      addLog('event', `📜 퀘스트 수락: ${qData.title}`);
      dispatch({ type: 'SET_SIDE_TAB', payload: 'quest' });
    },
    lootGrave: () => {
      if (gameState === 'combat') return addLog('error', '전투 중에는 할 수 없습니다.');
      if (!grave || grave.loc !== player.loc) return addLog('info', '회수할 유해가 없습니다.');
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + grave.gold, inv: grave.item ? [...p.inv, grave.item] : p.inv }) });
      addLog('success', `유해를 수습했습니다. (${grave.gold}G${grave.item ? ', ' + grave.item.name : ''})`);
      dispatch({ type: 'SET_GRAVE', payload: null });
    },
    craft: (recipeId) => {
      if (gameState !== 'crafting') return addLog('error', '제작소를 먼저 열어주세요.');
      const recipe = DB.ITEMS.recipes?.find(r => r.id === recipeId);
      if (!recipe) return addLog('error', '잘못된 레시피입니다.');
      if (player.gold < recipe.gold) return addLog('error', `골드가 부족합니다. (필요: ${recipe.gold}G)`);
      for (const input of recipe.inputs) {
        const count = player.inv.filter(i => i.name === input.name).length;
        if (count < input.qty) return addLog('error', `재료 부족: ${input.name} ${input.qty}개 필요 (보유: ${count}개)`);
      }

      let newInv = [...player.inv];
      for (const input of recipe.inputs) {
        let remaining = input.qty;
        newInv = newInv.filter(item => {
          if (item.name === input.name && remaining > 0) {
            remaining--;
            return false;
          }
          return true;
        });
      }

      const outputItem = generateDrop(recipe.name);
      if (outputItem) newInv.push(outputItem);
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - recipe.gold, inv: newInv }) });
      addLog('success', `🔨 ${recipe.name} 제작 완료!`);
      dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'flash' });
      setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 300);
    },
    setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
    setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
    setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }),
    setAiThinking: (val) => dispatch({ type: 'SET_AI_THINKING', payload: val }),
    getUid: () => uid,
    isAdmin: () => ADMIN_UIDS.includes(uid),
    leaderboard,
    liveConfig
  }), [player, gameState, logs, enemy, grave, shopItems, sideTab, isAiThinking, currentEvent, visualEffect, syncStatus, uid, leaderboard, liveConfig]);

  // CLI Handler
  const handleCommand = (text) => {
    const result = parseCommand(text, gameState, player, actions);
    if (result) addLog('system', result);
  };


  return {
    player, gameState, logs, enemy, actions, getFullStats, sideTab, grave, shopItems, isAiThinking, currentEvent, visualEffect, syncStatus, leaderboard, liveConfig, uid
  };
};

function App() {
  const engine = useGameEngine();

  // Intro UI
  if (!engine.player.name || engine.player.name === '방랑자') {
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
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout visualEffect={engine.visualEffect}>
      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
          AETHERIA <span className="text-xs text-slate-500 font-normal">v{CONSTANTS.DATA_VERSION}</span>
        </h1>
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

        {/* RIGHT: DASHBOARD (Inventory/Stats) */}
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