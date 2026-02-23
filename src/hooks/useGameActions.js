import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { AI_SERVICE } from '../services/aiService';
import { toArray, getJobSkills } from '../utils/gameUtils';

/**
 * useGameActions — 이동, 탐색, 휴식, 이벤트, 직업, 퀘스트 수락, 시작, 리셋
 */
export const createGameActions = ({ player, gameState, uid, grave, currentEvent, isAiThinking, dispatch, addLog, addStoryLog }) => ({

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
        if (!DB.MAPS[player.loc].exits.includes(loc)) return addLog('error', '갈 수 없는 곳입니다.');

        dispatch({ type: 'SET_PLAYER', payload: { loc } });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
        addLog('success', `${loc}로 이동했습니다.`);
        addLog('system', targetMap.desc);
        if (grave && grave.loc === loc) addLog('event', '근처에서 당신의 유해를 발견했습니다.');
    },

    start: (name, gender = 'male') => {
        if (!name.trim()) return;
        dispatch({ type: 'SET_PLAYER', payload: { name: name.trim(), gender } });
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
                if (eventData?.exhausted) {
                    dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
                    addLog('warning', eventData.message || '오늘 AI 호출 한도에 도달했습니다.');
                } else if (eventData && eventData.desc) {
                    const normalizedChoices = toArray(eventData.choices)
                        .map((choice, idx) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`))
                        .slice(0, 3);
                    const normalized = {
                        ...eventData,
                        choices: normalizedChoices,
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
        let level = mapData.level || 1;
        let isInfinite = false;
        let depth = 0;

        if (level === 'infinite') {
            isInfinite = true;
            depth = player.stats?.abyssFloor || 1;
            level = 45 + Math.floor(depth / 2);
        }

        const mStats = {
            name: isInfinite ? `[${depth}층] ${baseName}` : baseName,
            baseName,
            hp: 120 + level * 30 + (depth * 25),
            maxHp: 120 + level * 30 + (depth * 25),
            atk: 15 + level * 4 + (depth * 3),
            exp: 10 + level * 5 + (depth * 4),
            gold: 10 + level * 2 + (depth * 3),
            pattern: {
                guardChance: Math.min(0.4, 0.12 + level * 0.01 + (depth * 0.005)),
                heavyChance: Math.min(0.45, 0.15 + level * 0.01 + (depth * 0.005))
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

    reset: () => {
        if (window.confirm('초기 시작 설정으로 되돌리시겠습니까? 진행 중 데이터는 초기화됩니다.')) {
            dispatch({ type: 'RESET_GAME' });
            addLog('system', '초기 시작 설정이 적용되었습니다. 새 에이전트 정보를 입력해 주세요.');
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
        const makeItem = (template) => ({
            ...template,
            id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
        });
        let logMsg = `유해 회수: ${grave.gold}G 획득`;
        const updates = { gold: player.gold + grave.gold };
        if (grave.item) {
            updates.inv = [...player.inv, makeItem(grave.item)];
            logMsg += `, ${grave.item.name} 획득`;
        }
        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, ...updates }) });
        dispatch({ type: 'SET_GRAVE', payload: null });
        addLog('success', logMsg);
    }
});
