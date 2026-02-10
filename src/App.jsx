import { useEffect, useReducer, useMemo, useRef, useCallback } from 'react';
import { Cloud, WifiOff, Terminal as TerminalIcon } from 'lucide-react';
import {
  onSnapshot,
  doc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db } from './firebase';
import { CONSTANTS, APP_ID, ADMIN_UIDS, BALANCE } from './data/constants';
import { DB } from './data/db';
import { CombatEngine } from './systems/CombatEngine';
import { AI_SERVICE } from './services/aiService';
import { migrateData } from './utils/gameUtils';
import { parseCommand } from './utils/commandParser';
import MainLayout from './components/MainLayout';
import TerminalView from './components/TerminalView';
import Dashboard from './components/Dashboard';
import ControlPanel from './components/ControlPanel';
import { gameReducer, INITIAL_STATE } from './reducers/gameReducer';

const toArray = (v) => (Array.isArray(v) ? v : []);

const allItems = [
  ...toArray(DB.ITEMS?.consumables),
  ...toArray(DB.ITEMS?.weapons),
  ...toArray(DB.ITEMS?.armors),
  ...toArray(DB.ITEMS?.materials)
];

const findItemByName = (name) => allItems.find((i) => i.name === name);

const makeItem = (template) => ({
  ...template,
  id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

const getJobSkills = (player) => toArray(DB.CLASSES[player.job]?.skills);

const getSelectedSkill = (player) => {
  const skills = getJobSkills(player);
  if (!skills.length) return null;
  const selected = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
  const index = ((selected % skills.length) + skills.length) % skills.length;
  return { skill: skills[index], index, total: skills.length };
};

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
  const lastLoadedTimestampRef = useRef(state.lastLoadedTimestamp);
  const hasBootLogRef = useRef(state.logs.length > 0);

  useEffect(() => {
    dispatch({ type: 'SET_BOOT_STAGE', payload: 'auth' });
    signInAnonymously(auth)
      .then((cred) => {
        dispatch({ type: 'SET_UID', payload: cred.user.uid });
        dispatch({ type: 'SET_BOOT_STAGE', payload: 'config' });
      })
      .catch((e) => {
        console.error('Auth Failed', e);
      });
  }, []);

  useEffect(() => {
    lastLoadedTimestampRef.current = state.lastLoadedTimestamp;
  }, [state.lastLoadedTimestamp]);

  useEffect(() => {
    hasBootLogRef.current = state.logs.length > 0;
  }, [state.logs.length]);

  useEffect(() => {
    if (bootStage !== 'config') return;

    const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists() && snap.data().config) {
        dispatch({ type: 'SET_LIVE_CONFIG', payload: snap.data().config });
      }
    });

    const fetchLeaderboard = async () => {
      try {
        const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
        const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50));
        const snap = await getDocs(q);
        const data = [];
        snap.forEach((d) => data.push(d.data()));
        dispatch({ type: 'SET_LEADERBOARD', payload: data });
      } catch (e) {
        console.warn('Leaderboard fetch failed', e);
      }
    };

    fetchLeaderboard();
    dispatch({ type: 'SET_BOOT_STAGE', payload: 'data' });
    return () => unsubConfig();
  }, [bootStage]);

  useEffect(() => {
    if (bootStage !== 'data' || !uid) return;

    const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.metadata.hasPendingWrites) return;

      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (lastLoadedTimestampRef.current && remoteData.lastActive?.toMillis() === lastLoadedTimestampRef.current) {
          return;
        }

        const activeData = migrateData(remoteData);
        if (activeData) {
          if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
          if (!activeData.player.loc) activeData.player.loc = '시작의 마을';

          dispatch({ type: 'LOAD_DATA', payload: activeData });
          lastLoadedTimestampRef.current = remoteData.lastActive?.toMillis() || Date.now();
          if (!hasBootLogRef.current) {
            hasBootLogRef.current = true;
            dispatch({ type: 'ADD_LOG', payload: { type: 'system', text: '서버 데이터와 동기화되었습니다.' } });
          }
        }
      } else {
        dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
      }
    });

    return () => unsubscribe();
  }, [uid, bootStage]);

  useEffect(() => {
    if (syncStatus !== 'syncing' || !uid) return;

    const saveData = async () => {
      try {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        const playerPayload = { ...player, archivedHistory: [] };
        const payload = {
          player: playerPayload,
          gameState,
          enemy,
          grave,
          currentEvent,
          version: CONSTANTS.DATA_VERSION,
          lastActive: serverTimestamp()
        };

        if (player.archivedHistory && player.archivedHistory.length > 0) {
          const historyCol = collection(userDocRef, 'history');
          await Promise.all(player.archivedHistory.map((h) => addDoc(historyCol, h)));
        }

        await setDoc(userDocRef, payload, { merge: true });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
      } catch (e) {
        console.error('Save Failed', e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
      }
    };

    const timer = setTimeout(saveData, BALANCE.DEBOUNCE_SAVE_MS);
    return () => clearTimeout(timer);
  }, [player, gameState, enemy, grave, currentEvent, syncStatus, uid]);

  const addLog = (type, text) => dispatch({ type: 'ADD_LOG', payload: { type, text } });

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

  const actions = useMemo(
    () => ({
      move: (loc) => {
        if (isAiThinking) return;
        if (!loc) {
          const exits = DB.MAPS[player.loc].exits.join(', ');
          return addLog('info', `이동 가능한 지역: ${exits}`);
        }
        if (gameState === 'combat') return addLog('error', '전투 중에는 이동할 수 없습니다.');
        if (gameState === 'shop') return addLog('error', '상점을 닫고 이동하세요.');

        const targetMap = DB.MAPS[loc];
        if (!targetMap) return addLog('error', '존재하지 않는 지역입니다.');
        const requiredLevel = targetMap.minLv ?? targetMap.level ?? 1;
        if (player.level < requiredLevel) return addLog('error', `레벨 ${requiredLevel} 이상이어야 이동 가능합니다.`);
        if (!DB.MAPS[player.loc].exits.includes(loc) && loc !== '시작의 마을') return addLog('error', '갈 수 없는 곳입니다.');

        dispatch({ type: 'SET_PLAYER', payload: { loc } });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
        addLog('success', `${loc}로 이동했습니다.`);
        addLog('system', targetMap.desc);
        if (grave && grave.loc === loc) addLog('event', '근처에서 당신의 유해를 발견했습니다.');
      },

      start: (name) => {
        if (!name.trim()) return;
        dispatch({ type: 'SET_PLAYER', payload: { name: name.trim() } });
        addLog('system', `환영합니다, ${name}!`);
      },

      cycleSkill: (dir = 1) => {
        const skills = getJobSkills(player);
        if (!skills.length) return;
        const current = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
        const next = ((current + dir) % skills.length + skills.length) % skills.length;
        dispatch({
          type: 'SET_PLAYER',
          payload: {
            skillLoadout: {
              selected: next,
              cooldowns: { ...(player.skillLoadout?.cooldowns || {}) }
            }
          }
        });
      },

      explore: async () => {
        if (gameState !== 'idle') return addLog('error', '탐색할 수 없는 상태입니다.');
        if (player.loc === '시작의 마을') return addLog('info', '마을 주변은 평화롭습니다.');

        const mapData = DB.MAPS[player.loc];
        if (Math.random() < (mapData.eventChance || 0)) {
          dispatch({ type: 'SET_GAME_STATE', payload: 'event' });
          dispatch({ type: 'SET_AI_THINKING', payload: true });
          try {
            const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid);
            if (eventData && eventData.desc) {
              const normalized = {
                ...eventData,
                choices: toArray(eventData.choices).slice(0, 3),
                outcomes: toArray(eventData.outcomes)
              };
              dispatch({ type: 'SET_EVENT', payload: normalized });
              addLog('event', normalized.desc);
            } else {
              dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
              addLog('info', '아무 일도 일어나지 않았습니다.');
            }
          } finally {
            dispatch({ type: 'SET_AI_THINKING', payload: false });
          }
          return;
        }

        if (Math.random() < BALANCE.EVENT_CHANCE_NOTHING) return addLog('info', '주변이 조용합니다.');

        const baseName = mapData.monsters[Math.floor(Math.random() * mapData.monsters.length)];
        const level = mapData.level || 1;
        const mStats = {
          name: baseName,
          baseName,
          hp: 120 + level * 30,
          maxHp: 120 + level * 30,
          atk: 15 + level * 4,
          exp: 10 + level * 5,
          gold: 10 + level * 2,
          pattern: {
            guardChance: Math.min(0.35, 0.12 + level * 0.01),
            heavyChance: Math.min(0.4, 0.15 + level * 0.01)
          }
        };

        if (Math.random() < BALANCE.PREFIX_CHANCE && CONSTANTS.MONSTER_PREFIXES) {
          const prefix = CONSTANTS.MONSTER_PREFIXES[Math.floor(Math.random() * CONSTANTS.MONSTER_PREFIXES.length)];
          mStats.name = `${prefix.name} ${baseName}`;
          mStats.hp = Math.floor(mStats.hp * prefix.mod);
          mStats.maxHp = Math.floor(mStats.maxHp * prefix.mod);
          mStats.atk = Math.floor(mStats.atk * prefix.mod);
          mStats.exp = Math.floor(mStats.exp * prefix.expMod);
          mStats.gold = Math.floor(mStats.gold * prefix.expMod);
          addLog('warning', `[${prefix.name}] 개체가 나타났습니다.`);
        }

        dispatch({ type: 'SET_ENEMY', payload: mStats });
        dispatch({ type: 'SET_GAME_STATE', payload: 'combat' });
        addLog('combat', `${mStats.name} 등장!`);
        addStoryLog('encounter', { loc: player.loc, name: baseName });
      },

      handleEventChoice: (idx) => {
        if (!currentEvent) return;

        let resultText = '';
        const selectedOutcome = toArray(currentEvent.outcomes).find((o) => o.choiceIndex === idx) || null;
        const roll = Math.random();

        if (selectedOutcome) {
          dispatch({
            type: 'SET_PLAYER',
            payload: (p) => {
              const next = { ...p };
              if (selectedOutcome.gold) next.gold += selectedOutcome.gold;
              if (selectedOutcome.exp) next.exp += selectedOutcome.exp;
              if (selectedOutcome.hp) next.hp = Math.max(1, Math.min(next.maxHp, next.hp + selectedOutcome.hp));
              if (selectedOutcome.mp) next.mp = Math.max(0, Math.min(next.maxMp, next.mp + selectedOutcome.mp));
              if (selectedOutcome.item) {
                const itemDef = findItemByName(selectedOutcome.item);
                if (itemDef) next.inv = [...next.inv, makeItem(itemDef)];
              }
              return next;
            }
          });
          resultText = selectedOutcome.log || '선택의 결과가 반영되었습니다.';
          addLog('event', resultText);
        } else if (roll > 0.4) {
          const rewardGold = player.level * 50;
          dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, gold: p.gold + rewardGold }) });
          resultText = `성공! ${rewardGold}G를 획득했습니다.`;
          addLog('success', resultText);
        } else {
          const dmg = Math.floor(player.maxHp * 0.1);
          dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, hp: Math.max(1, p.hp - dmg) }) });
          resultText = `실패... ${dmg} 피해를 입었습니다.`;
          addLog('error', resultText);
        }

        const newHistory = [
          ...player.history,
          {
            timestamp: Date.now(),
            event: currentEvent.desc,
            choice: currentEvent.choices?.[idx],
            outcome: resultText
          }
        ].slice(-50);

        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, history: newHistory }) });
        dispatch({ type: 'SET_EVENT', payload: null });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
      },

      rest: () => {
        if (gameState !== 'idle') return;
        const mapData = DB.MAPS[player.loc];
        if (mapData.type !== 'safe') return addLog('error', '휴식은 안전한 지역에서만 가능합니다.');
        if (player.gold < BALANCE.REST_COST) return addLog('error', '골드가 부족합니다.');

        dispatch({
          type: 'SET_PLAYER',
          payload: (p) => ({ ...p, gold: p.gold - BALANCE.REST_COST, hp: p.maxHp, mp: p.maxMp })
        });
        addLog('success', '휴식 완료. HP/MP가 회복되었습니다.');
        addStoryLog('rest', { loc: player.loc });
      },

      combat: (type) => {
        if (gameState !== 'combat' || !enemy) return addLog('error', '전투 상태가 아닙니다.');
        const stats = getFullStats();
        const playerAtActionStart = player;
        const enemyAtActionStart = enemy;

        if (type === 'attack' || type === 'skill') {
          let result;
          let playerAfterAction = playerAtActionStart;

          if (type === 'skill') {
            const selected = getSelectedSkill(playerAtActionStart);
            result = CombatEngine.performSkill(playerAtActionStart, enemyAtActionStart, stats, selected?.skill);
            if (!result.success) return addLog('error', result.logs[0]?.text || '스킬 사용 실패');
            playerAfterAction = result.updatedPlayer;
            dispatch({ type: 'SET_PLAYER', payload: result.updatedPlayer });
          } else {
            result = CombatEngine.attack(playerAtActionStart, enemyAtActionStart, stats);
          }

          result.logs.forEach((log) => addLog(log.type, log.text));
          dispatch({ type: 'SET_VISUAL_EFFECT', payload: result.isCrit ? 'shake' : null });

          if (result.isVictory) {
            dispatch({ type: 'SET_ENEMY', payload: null });
            dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });

            const victoryResult = CombatEngine.handleVictory(playerAfterAction, enemyAtActionStart);
            let updatedPlayer = victoryResult.updatedPlayer;
            victoryResult.logs.forEach((log) => addLog(log.type, log.text));
            if (victoryResult.visualEffect) dispatch({ type: 'SET_VISUAL_EFFECT', payload: victoryResult.visualEffect });

            const questResult = CombatEngine.updateQuestProgress(updatedPlayer, enemyAtActionStart.baseName || enemyAtActionStart.name);
            updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
            if (questResult.completedCount > 0) {
              addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
            }

            const lootResult = CombatEngine.processLoot(enemyAtActionStart);
            lootResult.logs.forEach((log) => addLog(log.type, log.text));
            if (lootResult.items.length > 0) {
              updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
            }

            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            addStoryLog('victory', { name: enemyAtActionStart.name });
            return;
          }

          dispatch({ type: 'SET_ENEMY', payload: result.updatedEnemy });

          setTimeout(() => {
            const turnTick = CombatEngine.tickCombatState(playerAfterAction);
            turnTick.logs.forEach((log) => addLog(log.type, log.text));
            const playerForEnemyTurn = turnTick.updatedPlayer;
            dispatch({ type: 'SET_PLAYER', payload: playerForEnemyTurn });

            const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, result.updatedEnemy, stats);
            counterResult.logs.forEach((log) => addLog(log.type, log.text));
            dispatch({ type: 'SET_ENEMY', payload: counterResult.updatedEnemy });
            dispatch({ type: 'SET_PLAYER', payload: counterResult.updatedPlayer });
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });

            if (counterResult.isDead) {
              const defeatResult = CombatEngine.handleDefeat(counterResult.updatedPlayer, INITIAL_STATE.player);
              dispatch({ type: 'SET_GRAVE', payload: defeatResult.graveData });
              dispatch({ type: 'SET_PLAYER', payload: defeatResult.updatedPlayer });
              dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
              dispatch({ type: 'SET_ENEMY', payload: null });
              defeatResult.logs.forEach((log) => addLog(log.type, log.text));
              addStoryLog('death', { loc: playerForEnemyTurn.loc });
            }
          }, 450);
          return;
        }

        if (type === 'escape') {
          const escapeResult = CombatEngine.attemptEscape(enemy, stats);
          escapeResult.logs.forEach((log) => addLog(log.type, log.text));
          if (escapeResult.success) {
            dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
            dispatch({ type: 'SET_ENEMY', payload: null });
          } else {
            dispatch({
              type: 'SET_PLAYER',
              payload: (p) => ({ ...p, hp: Math.max(0, p.hp - (escapeResult.damage || 0)) })
            });
          }
        }
      },

      market: (type, item) => {
        if (gameState !== 'shop') return;
        if (type === 'buy') {
          if (player.gold >= item.price) {
            dispatch({
              type: 'SET_PLAYER',
              payload: (p) => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, makeItem(item)] })
            });
            addLog('success', `${item.name} 구매 완료.`);
          } else {
            addLog('error', '골드가 부족합니다.');
          }
        } else if (type === 'sell') {
          const sellPrice = Math.floor(item.price * 0.5);
          const idx = player.inv.findIndex((i) => i.id === item.id);
          if (idx > -1) {
            const newInv = [...player.inv];
            newInv.splice(idx, 1);
            dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, gold: p.gold + sellPrice, inv: newInv }) });
            addLog('success', `${item.name} 판매 완료 (+${sellPrice}G)`);
          }
        }
      },

      craft: (recipeId) => {
        const recipe = DB.ITEMS.recipes?.find((r) => r.id === recipeId);
        if (!recipe) return;
        if (player.gold < recipe.gold) return addLog('error', '골드가 부족합니다.');

        for (const input of recipe.inputs) {
          const count = player.inv.filter((i) => i.name === input.name).length;
          if (count < input.qty) return addLog('error', `재료 부족: ${input.name}`);
        }

        let newInv = [...player.inv];
        for (const input of recipe.inputs) {
          let removed = 0;
          newInv = newInv.filter((item) => {
            if (item.name === input.name && removed < input.qty) {
              removed += 1;
              return false;
            }
            return true;
          });
        }

        const craftedTemplate = findItemByName(recipe.name);
        const craftedItem = craftedTemplate
          ? makeItem(craftedTemplate)
          : makeItem({ name: recipe.name, type: 'mat', price: 0, desc: 'Crafted item', desc_stat: 'CRAFTED' });

        dispatch({
          type: 'SET_PLAYER',
          payload: (p) => ({ ...p, gold: p.gold - recipe.gold, inv: [...newInv, craftedItem] })
        });
        addLog('success', `${recipe.name} 제작 완료`);
      },

      completeQuest: (qId) => {
        const qData = DB.QUESTS.find((q) => q.id === qId);
        if (!qData) return;

        const pQuest = player.quests.find((q) => q.id === qId);
        if (!pQuest || pQuest.progress < qData.goal) return addLog('error', '아직 완료 조건을 만족하지 못했습니다.');

        const updates = {
          gold: player.gold + (qData.reward.gold || 0),
          exp: player.exp + (qData.reward.exp || 0),
          quests: player.quests.filter((q) => q.id !== qId)
        };

        if (qData.reward.item) {
          const itemData = findItemByName(qData.reward.item);
          if (itemData) {
            updates.inv = [...player.inv, makeItem(itemData)];
            addLog('success', `보상 아이템: ${itemData.name}`);
          }
        }

        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, ...updates }) });
        addLog('success', `퀘스트 완료: ${qData.title}`);
      },

      reset: () => {
        if (window.confirm('모든 데이터를 초기화하시겠습니까?')) {
          dispatch({ type: 'RESET_GAME' });
        }
      },

      jobChange: (jobName) => {
        dispatch({ type: 'SET_PLAYER', payload: { job: jobName } });
        addLog('success', `${jobName} 전직 완료!`);
      },

      acceptQuest: (qId) => {
        if (player.quests.some((q) => q.id === qId)) return addLog('error', '이미 수락한 퀘스트입니다.');
        const qData = DB.QUESTS.find((q) => q.id === qId);
        if (!qData) return;
        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, quests: [...p.quests, { id: qId, progress: 0 }] }) });
        addLog('event', `퀘스트 수락: ${qData.title}`);
      },

      lootGrave: () => {
        if (!grave) return;
        let logMsg = `유해 회수: ${grave.gold}G 획득`;
        const updates = { gold: player.gold + grave.gold };
        if (grave.item) {
          updates.inv = [...player.inv, makeItem(grave.item)];
          logMsg += `, ${grave.item.name} 획득`;
        }
        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, ...updates }) });
        dispatch({ type: 'SET_GRAVE', payload: null });
        addLog('success', logMsg);
      },

      useItem: (item) => {
        if (['weapon', 'armor', 'shield'].includes(item.type)) {
          let newInv = player.inv.filter((i) => i.id !== item.id);
          const currentEquip = { ...player.equip };

          if (item.type === 'armor') {
            if (currentEquip.armor && currentEquip.armor.name !== '천옷') newInv.push(currentEquip.armor);
            currentEquip.armor = item;
          } else if (item.type === 'weapon') {
            if (currentEquip.weapon && currentEquip.weapon.name !== '맨손') newInv.push(currentEquip.weapon);
            if (item.hands === 2 && currentEquip.offhand) {
              newInv.push(currentEquip.offhand);
              currentEquip.offhand = null;
              addLog('info', '양손 무기 장착으로 보조 장비를 해제했습니다.');
            }
            currentEquip.weapon = item;
          } else if (item.type === 'shield') {
            if (currentEquip.offhand) newInv.push(currentEquip.offhand);
            if (currentEquip.weapon?.hands === 2) {
              newInv.push(currentEquip.weapon);
              currentEquip.weapon = DB.ITEMS.weapons[0];
              addLog('info', '방패 장착으로 양손 무기를 해제했습니다.');
            }
            currentEquip.offhand = item;
          }

          dispatch({ type: 'SET_PLAYER', payload: { ...player, inv: newInv, equip: currentEquip } });
          addLog('success', `${item.name} 장착.`);
          return;
        }

        const removeOne = () => player.inv.filter((i) => i.id !== item.id);
        if (item.type === 'hp') {
          dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({ ...p, hp: Math.min(p.maxHp, p.hp + (item.val || 0)), inv: removeOne() })
          });
          addLog('success', `${item.name} 사용.`);
          return;
        }
        if (item.type === 'mp') {
          dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({ ...p, mp: Math.min(p.maxMp, p.mp + (item.val || 0)), inv: removeOne() })
          });
          addLog('success', `${item.name} 사용.`);
          return;
        }
        if (item.type === 'cure') {
          dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({
              ...p,
              status: toArray(p.status).filter((s) => s !== item.effect),
              inv: removeOne()
            })
          });
          addLog('success', `${item.name} 사용: 상태이상 해제`);
          return;
        }
        if (item.type === 'buff') {
          dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({
              ...p,
              tempBuff: {
                atk: item.effect === 'atk_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                def: item.effect === 'def_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                turn: item.turn || 3,
                name: item.name
              },
              inv: removeOne()
            })
          });
          addLog('success', `${item.name} 사용: 버프 활성화`);
        }
      },

      setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
      setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
      setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }),
      setAiThinking: (val) => dispatch({ type: 'SET_AI_THINKING', payload: val }),
      getUid: () => uid,
      isAdmin: () => ADMIN_UIDS.includes(uid),
      getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
      liveConfig,
      leaderboard
    }),
    [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addStoryLog, getFullStats, leaderboard]
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

function App() {
  const engine = useGameEngine();

  if (engine.bootStage !== 'ready') {
    return (
      <div className="flex h-screen w-full bg-slate-950 items-center justify-center text-slate-400">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-4">AETHERIA</h1>
          <p className="animate-pulse">초기화 중... ({engine.bootStage})</p>
        </div>
      </div>
    );
  }

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
      <header className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
            AETHERIA <span className="text-xs text-slate-500 font-normal">v{CONSTANTS.DATA_VERSION}</span>
          </h1>
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1 gap-2 w-64">
            <TerminalIcon size={12} className="text-slate-500" />
            <input
              type="text"
              placeholder="CLI command (/help)"
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

      <div className="flex-1 overflow-hidden flex gap-4">
        <TerminalView logs={engine.logs} gameState={engine.gameState} onCommand={engine.handleCommand} />
        <Dashboard
          player={engine.player}
          sideTab={engine.sideTab}
          setSideTab={engine.actions.setSideTab}
          actions={engine.actions}
          stats={engine.getFullStats()}
        />
      </div>

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
