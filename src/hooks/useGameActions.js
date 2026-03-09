import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { CLASSES } from '../data/classes';
import { AI_SERVICE } from '../services/aiService';
import { toArray, getJobSkills, makeItem, findItemByName, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel } from '../utils/gameUtils';
import { BOSS_MONSTERS } from '../data/monsters';
import { RELICS, pickWeightedRelics, MAX_RELICS_PER_RUN } from '../data/relics';
import { PRESTIGE_TITLES } from '../data/titles';
import { AT } from '../reducers/actionTypes';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { CombatEngine } from '../systems/CombatEngine';

const buildClassVitals = (level, jobId, meta = {}) => {
    const cls = CLASSES[jobId] || CLASSES['모험가'];
    const maxHp = Math.floor(CONSTANTS.START_HP * cls.hpMod) + Math.max(0, level - 1) * 20 + (meta.bonusHp || 0);
    const maxMp = Math.floor(CONSTANTS.START_MP * cls.mpMod) + Math.max(0, level - 1) * 10 + (meta.bonusMp || 0);
    return { maxHp, maxMp };
};

/**
 * useGameActions — 이동, 탐색, 휴식, 이벤트, 직업, 퀘스트 수락, 시작, 리셋
 */
export const createGameActions = ({ player, gameState, uid, grave, currentEvent, isAiThinking, dispatch, addLog, addStoryLog, getFullStats }) => {
    const emitUnlockedTitles = (updatedPlayer) => {
        const newTitles = checkTitles(updatedPlayer);
        if (newTitles.length > 0) {
            dispatch({ type: AT.UNLOCK_TITLES, payload: newTitles });
            newTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
        }
    };

    const emitDailyProtocolLogs = (type, amount = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };

    return ({

    move: (loc) => {
        if (isAiThinking) return;
        if (!loc) {
            const exits = DB.MAPS[player.loc].exits.join(', ');
            return addLog('info', `이동 가능한 지역: ${exits}`);
        }
        if (!['idle', 'moving'].includes(gameState)) return addLog('error', '지금은 이동할 수 없는 상태입니다.');

        const targetMap = DB.MAPS[loc];
        if (!targetMap) return addLog('error', '존재하지 않는 지역입니다.');
        const requiredLevel = targetMap.minLv ?? targetMap.level ?? 1;
        if (player.level < requiredLevel) return addLog('error', `레벨 ${requiredLevel} 이상이어야 이동 가능합니다.`);
        if (!DB.MAPS[player.loc].exits.includes(loc)) return addLog('error', '갈 수 없는 곳입니다.');
        const firstVisit = !(player.stats?.visitedMaps || []).includes(loc);
        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({
                ...p,
                loc,
                stats: {
                    ...(p.stats || {}),
                    visitedMaps: Array.from(new Set([...(p.stats?.visitedMaps || []), loc]))
                }
            })
        });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
        addLog('success', `${loc}로 이동했습니다.`);
        if (firstVisit) addLog('event', `🗺️ 새 지역 발견: ${loc}`);
        addLog('system', targetMap.desc);
        if (grave && grave.loc === loc) addLog('event', '근처에서 당신의 유해를 발견했습니다.');
    },

    start: (name, gender = 'male', jobId = '모험가') => {
        if (!name.trim()) return;
        const cls = CLASSES[jobId] || CLASSES['모험가'];
        const vitals = buildClassVitals(player.level || 1, jobId, player.meta || {});
        dispatch({ type: 'SET_PLAYER', payload: {
            name: name.trim(),
            gender,
            job: jobId,
            maxHp: vitals.maxHp,
            hp: vitals.maxHp,
            maxMp: vitals.maxMp,
            mp: vitals.maxMp,
            stats: {
                ...(player.stats || {}),
                visitedMaps: ['시작의 마을']
            }
        }});
        addLog('system', `[${jobId}] ${name.trim()} 에이전트 — 에테리아 접속 완료.`);
        addLog('event', `직업 "${jobId}" 선택됨. 첫 스킬: ${cls.skills[0]?.name || '강타'}`);
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
        const playerRelics = player.relics || [];
        const eventChanceBonus = playerRelics.reduce((acc, relic) => (
            relic.effect === 'event_chance' ? acc + relic.val : acc
        ), 0);
        const effectiveEventChance = Math.min(
            BALANCE.SPECIAL_EVENT_MAX_CHANCE,
            (mapData.eventChance || 0) * BALANCE.SPECIAL_EVENT_BASE_MULT * (1 + eventChanceBonus)
        );
        if (Math.random() < effectiveEventChance) {
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

        // v4.0: 일일 프로토콜 리셋 체크
        const today = new Date().toISOString().slice(0, 10);
        const dp = player.stats?.dailyProtocol;
        if (!dp || dp.date !== today) {
            const lvl = player.level;
            const missions = [
                { id: 'kill_n',    type: 'kills',    goal: Math.max(10, lvl * 2),    reward: { essence: Math.floor(lvl * 5) }, progress: 0, done: false },
                { id: 'explore_n', type: 'explores', goal: 10,                        reward: { item: '중급 체력 물약' },          progress: 0, done: false },
                { id: 'gold_n',    type: 'goldSpend', goal: Math.max(300, lvl * 20), reward: { relicShard: 1 },                  progress: 0, done: false },
            ];
            dispatch({ type: AT.SET_DAILY_PROTOCOL, payload: { date: today, missions, relicShards: dp?.relicShards || 0 } });
        }
        // 일일 프로토콜 — 탐색 카운트 업데이트
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'explores' } });
        emitDailyProtocolLogs('explores', 1);
        // 탐색 횟수 통계 추적 (퀘스트 타입 explore_count용)
        dispatch({ type: 'SET_PLAYER', payload: (p) => ({
            ...p,
            stats: { ...p.stats, explores: (p.stats?.explores || 0) + 1 }
        }) });


        if (Math.random() < BALANCE.EVENT_CHANCE_NOTHING) {
            const hasKey = player.inv.some(i => i.name === '잊혀진 열쇠');
            if (hasKey && mapData.level >= 10 && Math.random() < 0.2) {
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => {
                        const keyIdx = p.inv.findIndex(i => i.name === '잊혀진 열쇠');
                        const newInv = [...p.inv];
                        if (keyIdx > -1) newInv.splice(keyIdx, 1);
                        return { ...p, inv: newInv, loc: '고대 보물고' };
                    }
                });
                return addLog('event', '💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!');
            }

            if (Math.random() < 0.2 && player.loc !== '고대 보물고') {
                const anomalies = [
                    { effect: 'poison', desc: '자욱한 독안개가 밀려옵니다! (중독)' },
                    { effect: 'mana_regen', desc: '강력한 마력의 폭풍이 붑니다. (MP 30% 회복)' },
                    { effect: 'burn', desc: '피부를 찌르는 산성비가 내립니다. (화상)' }
                ];
                const anomaly = anomalies[Math.floor(Math.random() * anomalies.length)];
                addLog('warning', `[기상 이변] ${anomaly.desc}`);
                if (anomaly.effect === 'mana_regen') {
                    const stats = getFullStats();
                    dispatch({
                        type: 'SET_PLAYER',
                        payload: (p) => ({ ...p, mp: Math.min(stats.maxMp, p.mp + Math.floor(stats.maxMp * 0.3)) })
                    });
                } else {
                    dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, status: [...new Set([...(p.status || []), anomaly.effect])] }) });
                }
                return;
            }

            // v4.0: 유물 발견 (조용한 탐색 중 8% 확률)
            if (playerRelics.length < MAX_RELICS_PER_RUN && Math.random() < BALANCE.RELIC_FIND_CHANCE) {
                const available = RELICS.filter(r => !playerRelics.some(pr => pr.id === r.id));
                if (available.length > 0) {
                    const candidates = pickWeightedRelics(available, 3);
                    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
                    addLog('event', '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.');
                    return;
                }
            }

            return addLog('info', '주변이 조용합니다.');
        }

        // v4.0: 유물 발견 (전투 직전에도 기회)
        if (playerRelics.length < MAX_RELICS_PER_RUN && Math.random() < BALANCE.RELIC_FIND_CHANCE * 0.5) {
            const available = RELICS.filter(r => !playerRelics.some(pr => pr.id === r.id));
            if (available.length > 0) {
                const candidates = pickWeightedRelics(available, 3);
                dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
                addLog('event', '✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!');
                return;
            }
        }

        const mapBossMonsters = Array.isArray(mapData.bossMonsters) ? mapData.bossMonsters : [];
        let encounterPool = [...(mapData.monsters || [])];
        const bossHunterRelic = playerRelics.find((relic) => relic.effect === 'boss_hunter');
        if (bossHunterRelic && mapBossMonsters.length > 0) {
            for (let i = 1; i < Math.max(1, Math.floor(bossHunterRelic.val.spawn || 1)); i += 1) {
                encounterPool = [...encounterPool, ...mapBossMonsters];
            }
        }

        const baseName = encounterPool[Math.floor(Math.random() * encounterPool.length)];
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
        const profile = DB.MONSTERS?.[baseName];
        if (profile) {
            const hpMult = profile.hpMult || 1;
            const atkMult = profile.atkMult || 1;
            const expMult = profile.expMult || 1;
            const goldMult = profile.goldMult || 1;
            mStats.hp = Math.floor(mStats.hp * hpMult);
            mStats.maxHp = Math.floor(mStats.maxHp * hpMult);
            mStats.atk = Math.floor(mStats.atk * atkMult);
            mStats.exp = Math.floor(mStats.exp * expMult);
            mStats.gold = Math.floor(mStats.gold * goldMult);
            if (profile.dropMod) mStats.dropMod = profile.dropMod;
            if (profile.weakness) mStats.weakness = profile.weakness;
            if (profile.resistance) mStats.resistance = profile.resistance;
            if (profile.pattern) {
                mStats.pattern = {
                    ...mStats.pattern,
                    ...profile.pattern
                };
            }
            // v4.0: 보스 Phase2 데이터 전달
            if (profile.phase2) mStats.phase2 = profile.phase2;
        }
        mStats.isBoss = Boolean(
            profile?.isBoss
            || mapBossMonsters.includes(baseName)
            || (mapData.boss && mapBossMonsters.length === 0)
            || BOSS_MONSTERS.includes(baseName)
        );

        if (Math.random() < BALANCE.PREFIX_CHANCE && CONSTANTS.MONSTER_PREFIXES) {
            const prefix = CONSTANTS.MONSTER_PREFIXES[Math.floor(Math.random() * CONSTANTS.MONSTER_PREFIXES.length)];
            mStats.name = `${prefix.name} ${baseName}`;
            mStats.hp = Math.floor(mStats.hp * prefix.mod);
            mStats.maxHp = Math.floor(mStats.maxHp * prefix.mod);
            mStats.atk = Math.floor(mStats.atk * prefix.mod);
            mStats.exp = Math.floor(mStats.exp * prefix.expMod);
            mStats.gold = Math.floor(mStats.gold * prefix.expMod);
            mStats.dropMod = (mStats.dropMod || 1.0) * (prefix.dropMod || 1.0);
            mStats.isElite = !!prefix.isElite;

            if (mStats.isElite) {
                addLog('critical', `⚠️ 엘리트 몬스터 [${prefix.name}] 개체가 등장했습니다!`);
            } else if (prefix.name !== '일반적인') {
                addLog('warning', `[${prefix.name}] 개체가 나타났습니다.`);
            }
        }

        const fullStats = getFullStats();
        let combatStartPlayer = {
            ...player,
            combatFlags: {
                comboCount: 0,
                deathSaveUsed: false,
                voidHeartUsed: Boolean(player.combatFlags?.voidHeartUsed),
                voidHeartArmed: Boolean(player.combatFlags?.voidHeartArmed),
            }
        };

        const startHealRelic = playerRelics.find((relic) => relic.effect === 'battle_start_heal');
        if (startHealRelic) {
            const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * startHealRelic.val));
            combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp, (combatStartPlayer.hp || 0) + heal);
            addLog('heal', `[재생 코어] 전투 시작 회복 +${heal} HP`);
        }

        const cursedPowerRelic = playerRelics.find((relic) => relic.effect === 'cursed_power');
        if (cursedPowerRelic) {
            const selfDamage = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * cursedPowerRelic.val.hp_cost));
            combatStartPlayer.hp = Math.max(1, (combatStartPlayer.hp || 1) - selfDamage);
            addLog('warning', `[저주받은 반지] 전투 시작 대가 -${selfDamage} HP`);
        }

        const chaosBuffRelic = playerRelics.find((relic) => relic.effect === 'chaos_buff');
        if (chaosBuffRelic) {
            const existingBuff = { atk: 0, def: 0, turn: 0, name: null, ...(combatStartPlayer.tempBuff || {}) };
            const rollAtk = Math.random() < 0.5;
            const baseAtk = existingBuff.name === '혼돈의 보석' ? 0 : existingBuff.atk;
            const baseDef = existingBuff.name === '혼돈의 보석' ? 0 : existingBuff.def;
            combatStartPlayer.tempBuff = {
                atk: baseAtk + (rollAtk ? chaosBuffRelic.val : 0),
                def: baseDef + (rollAtk ? 0 : chaosBuffRelic.val),
                turn: Math.max(existingBuff.turn || 0, 3),
                name: '혼돈의 보석'
            };
            addLog('event', `[혼돈의 보석] ${rollAtk ? 'ATK' : 'DEF'} +${Math.round(chaosBuffRelic.val * 100)}% 버프`);
        }

        dispatch({ type: 'SET_PLAYER', payload: combatStartPlayer });
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
        let updatedPlayer = player;

        if (selectedOutcome) {
            if (selectedOutcome.gold) updatedPlayer = grantGold(updatedPlayer, selectedOutcome.gold);
            if (selectedOutcome.exp) {
                const expResult = CombatEngine.applyExpGain(updatedPlayer, selectedOutcome.exp);
                updatedPlayer = expResult.updatedPlayer;
                expResult.logs.forEach((log) => addLog(log.type, log.text));
                if (expResult.visualEffect) dispatch({ type: 'SET_VISUAL_EFFECT', payload: expResult.visualEffect });
            }
            if (selectedOutcome.hp) {
                updatedPlayer = {
                    ...updatedPlayer,
                    hp: Math.max(1, Math.min(updatedPlayer.maxHp, updatedPlayer.hp + selectedOutcome.hp))
                };
            }
            if (selectedOutcome.mp) {
                updatedPlayer = {
                    ...updatedPlayer,
                    mp: Math.max(0, Math.min(updatedPlayer.maxMp, updatedPlayer.mp + selectedOutcome.mp))
                };
            }
            if (selectedOutcome.item) {
                const itemDef = findItemByName(selectedOutcome.item);
                if (itemDef) updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemDef)] };
            }
            resultText = selectedOutcome.log || '선택의 결과가 반영되었습니다.';
            addLog('event', resultText);
        } else if (roll > 0.4) {
            const rewardGold = player.level * 50;
            updatedPlayer = grantGold(updatedPlayer, rewardGold);
            resultText = `성공! ${rewardGold}G를 획득했습니다.`;
            addLog('success', resultText);
        } else {
            const dmg = Math.floor(Math.max(1, updatedPlayer.maxHp) * 0.1);
            updatedPlayer = { ...updatedPlayer, hp: Math.max(1, updatedPlayer.hp - dmg) };
            resultText = `실패... ${dmg} 피해를 입었습니다.`;
            addLog('error', resultText);
        }

        const levelQuestSync = CombatEngine.updateQuestProgress(updatedPlayer, '');
        updatedPlayer = { ...updatedPlayer, quests: levelQuestSync.updatedQuests };

        const newHistory = [
            ...updatedPlayer.history,
            {
                timestamp: Date.now(),
                event: currentEvent.desc,
                choice: currentEvent.choices?.[idx],
                outcome: resultText
            }
        ].slice(-50);

        updatedPlayer = { ...updatedPlayer, history: newHistory };
        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        emitUnlockedTitles(updatedPlayer);
        dispatch({ type: 'SET_EVENT', payload: null });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
    },

    rest: () => {
        if (gameState !== 'idle') return;
        const mapData = DB.MAPS[player.loc];
        if (mapData.type !== 'safe') return addLog('error', '휴식은 안전한 지역에서만 가능합니다.');
        if (player.gold < BALANCE.REST_COST) return addLog('error', '골드가 부족합니다.');

        const stats = getFullStats();
        const updatedPlayer = {
            ...player,
            gold: player.gold - BALANCE.REST_COST,
            hp: stats.maxHp,
            mp: stats.maxMp,
            stats: {
                ...(player.stats || {}),
                rests: (player.stats?.rests || 0) + 1
            }
        };
        dispatch({
            type: 'SET_PLAYER',
            payload: updatedPlayer
        });
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: BALANCE.REST_COST } });
        emitDailyProtocolLogs('goldSpend', BALANCE.REST_COST);
        emitUnlockedTitles(updatedPlayer);
        addLog('success', '휴식 완료. HP/MP가 회복되었습니다.');
        addStoryLog('rest', { loc: player.loc });
    },

    // ControlPanel에서 확인 UI를 거친 뒤 호출됩니다 (window.confirm 제거)
    reset: () => {
        dispatch({ type: 'RESET_GAME' });
        addLog('system', '초기 시작 설정이 적용되었습니다. 새 에이전트 정보를 입력해 주세요.');
    },

    jobChange: (jobName) => {
        const current = DB.CLASSES[player.job];
        if (!current?.next?.includes(jobName)) return addLog('error', '전직 가능한 직업이 아닙니다.');
        if (player.level < (DB.CLASSES[jobName]?.reqLv || 1)) return addLog('error', '전직 레벨이 부족합니다.');

        const vitals = buildClassVitals(player.level, jobName, player.meta || {});
        dispatch({
            type: 'SET_PLAYER',
            payload: {
                job: jobName,
                maxHp: vitals.maxHp,
                hp: vitals.maxHp,
                maxMp: vitals.maxMp,
                mp: vitals.maxMp,
                skillLoadout: { selected: 0, cooldowns: {} }
            }
        });
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
        addLog('success', `${jobName} 전직 완료!`);
    },

    acceptQuest: (qId) => {
        if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', '퀘스트 수락은 마을 게시판에서만 가능합니다.');
        if (player.quests.some((q) => q.id === qId)) return addLog('error', '이미 수락한 퀘스트입니다.');
        const qData = DB.QUESTS.find((q) => q.id === qId);
        if (!qData) return;
        if (player.level < (qData.minLv || 1)) return addLog('error', `레벨 ${qData.minLv} 이상이어야 수락 가능합니다.`);
        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({
                ...p,
                quests: [...p.quests, { id: qId, progress: qData.target === 'Level' ? p.level : 0 }]
            })
        });
        addLog('event', `퀘스트 수락: ${qData.title}`);
    },

    lootGrave: () => {
        if (!grave) return;
        let logMsg = `유해 회수: ${grave.gold}G 획득`;
        let updatedPlayer = grantGold(player, grave.gold);
        if (grave.item) {
            updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(grave.item)] };
            logMsg += `, ${grave.item.name} 획득`;
        }
        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        emitUnlockedTitles(updatedPlayer);
        dispatch({ type: 'SET_GRAVE', payload: null });
        addLog('success', logMsg);
    },

    requestBounty: () => {
        if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', '현상수배 수주는 마을 게시판에서만 가능합니다.');
        if (player.quests.some(q => q.isBounty)) return addLog('error', '이미 진행 중인 현상수배가 있습니다. (퀘스트 완료 후 수주 가능)');
        const today = new Date().toISOString().slice(0, 10);
        if (player.stats?.bountyDate === today && player.stats?.bountyIssued) {
            return addLog('error', '오늘 현상수배는 이미 발급되었습니다. 내일 다시 요청하세요.');
        }

        const validMonsters = [];
        Object.values(DB.MAPS).forEach(m => {
            if (m.level !== 'infinite' && m.level <= player.level + 5 && m.level >= Math.max(1, player.level - 10) && !m.boss) {
                validMonsters.push(...(m.monsters || []));
            }
        });
        if (!validMonsters.length) validMonsters.push('슬라임');
        const target = validMonsters[Math.floor(Math.random() * validMonsters.length)];
        const count = 5 + Math.floor(Math.random() * 6); // 5~10
        const bId = `bounty_${Date.now()}`;

        const newBounty = {
            id: bId,
            title: `[현상수배] ${target} 토벌`,
            desc: `${target} ${count}마리를 처치하라.`,
            target,
            goal: count,
            progress: 0,
            isBounty: true,
            // v4.0: 레벨 스케일 보상
            reward: {
                exp: Math.floor(count * player.level * BALANCE.BOUNTY_EXP_MULT),
                gold: Math.floor(count * player.level * BALANCE.BOUNTY_GOLD_MULT),
            }
        };

        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({
                ...p,
                quests: [...p.quests, newBounty],
                stats: {
                    ...(p.stats || {}),
                    bountyDate: today,
                    bountyIssued: true
                }
            })
        });
        addLog('event', `새로운 현상수배 수락: ${target} ${count}마리`);
    },

    // v4.0: 에테르 환생 확인
    confirmAscension: () => {
        const meta = player.meta || {};
        const rank = (meta.prestigeRank || 0) + 1;
        const newMeta = {
            ...meta,
            prestigeRank: rank,
            essence: (meta.essence || 0) + 200,
            bonusAtk:  (meta.bonusAtk  || 0) + BALANCE.PRESTIGE_ATK_BONUS,
            bonusHp:   (meta.bonusHp   || 0) + BALANCE.PRESTIGE_HP_BONUS,
            bonusMp:   (meta.bonusMp   || 0) + BALANCE.PRESTIGE_MP_BONUS,
            totalPrestigeAtk: (meta.totalPrestigeAtk || 0) + BALANCE.PRESTIGE_ATK_BONUS,
            totalPrestigeHp:  (meta.totalPrestigeHp  || 0) + BALANCE.PRESTIGE_HP_BONUS,
            totalPrestigeMp:  (meta.totalPrestigeMp  || 0) + BALANCE.PRESTIGE_MP_BONUS,
        };
        const title = PRESTIGE_TITLES[Math.min(rank - 1, PRESTIGE_TITLES.length - 1)];
        const projectedPlayer = {
            ...INITIAL_STATE.player,
            name: player.name,
            gender: player.gender,
            meta: newMeta,
            titles: [...new Set([...(player.titles || []), title])],
            activeTitle: title,
            stats: {
                ...INITIAL_STATE.player.stats,
                kills: player.stats.kills,
                bossKills: player.stats.bossKills,
                deaths: player.stats.deaths,
                total_gold: player.stats.total_gold,
                relicCount: player.stats.relicCount,
                abyssFloor: player.stats.abyssFloor,
                demonKingSlain: (player.stats.demonKingSlain || 0) + 1,
                bountiesCompleted: player.stats.bountiesCompleted,
                crafts: player.stats.crafts,
            }
        };
        const ascensionTitles = checkTitles(projectedPlayer);
        dispatch({ type: AT.ASCEND, payload: { meta: newMeta, newTitle: title } });
        if (ascensionTitles.length > 0) {
            dispatch({ type: AT.UNLOCK_TITLES, payload: ascensionTitles });
            ascensionTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
        }
        addLog('system', `⚡ [에테르 환생 ${rank}회] ${title} 칭호 획득! 영구 보너스 적용됨.`);
    },

    // v4.0: 환생 취소 — idle 복귀
    cancelAscension: () => {
        dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
        addLog('info', '환생을 취소했습니다. 여정을 계속합니다.');
    },
    });
};
