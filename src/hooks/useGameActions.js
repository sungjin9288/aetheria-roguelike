import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { CLASSES } from '../data/classes';
import { RELICS, pickWeightedRelics, MAX_RELICS_PER_RUN } from '../data/relics';
import { AI_SERVICE } from '../services/aiService';
import { toArray, getJobSkills, makeItem, findItemByName, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel } from '../utils/gameUtils';
import { resetDailyProtocolIfNeeded, resetWeeklyProtocolIfNeeded, rollExplorationEvent, spawnEnemy, applyBattleStartRelics, getFirstVisitReward, checkDiscoveryChains } from '../utils/exploreUtils';
import { advanceExploreState, getMapPacingProfile, getNarrativeEventChance, getQuietExplorationChance } from '../utils/explorationPacing';
import { getRunBuildProfile } from '../utils/runProfileUtils';
import { getGravesAtLoc, removeGravesAtLoc, resolveGraveRecovery } from '../utils/graveUtils.js';
import { SEASON_XP } from '../data/seasonPass';
import { clearTemporaryAdventureState, hasTemporaryAdventureState } from '../utils/playerStateUtils.js';
import { applyDynamicDifficulty, enrichSnapshotWithDifficulty } from '../systems/DifficultyManager';
import { PRESTIGE_TITLES } from '../data/titles';
import { AT } from '../reducers/actionTypes';
import { MSG } from '../data/messages';
import { GS } from '../reducers/gameStates';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { CombatEngine } from '../systems/CombatEngine';
import { getChainEventForLoc } from '../data/eventChains';

const buildClassVitals = (level, jobId, meta = {}) => {
    const cls = CLASSES[jobId] || CLASSES['모험가'];
    const maxHp = Math.floor(CONSTANTS.START_HP * cls.hpMod) + Math.max(0, level - 1) * 20 + (meta.bonusHp || 0);
    const maxMp = Math.floor(CONSTANTS.START_MP * cls.mpMod) + Math.max(0, level - 1) * 10 + (meta.bonusMp || 0);
    return { maxHp, maxMp };
};

/**
 * useGameActions — 이동, 탐색, 휴식, 이벤트, 직업, 퀘스트 수락, 시작, 리셋
 */
export const createGameActions = ({ player, gameState, uid, grave, currentEvent, isAiThinking, liveConfig, dispatch, addLog, addStoryLog, getFullStats }) => {
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

    const commitExploreOutcome = (outcome, transformPlayer = null) => {
        resetDailyProtocolIfNeeded(player, dispatch);
        resetWeeklyProtocolIfNeeded(player, dispatch);
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'explores' } });
        dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'explores' } });
        emitDailyProtocolLogs('explores', 1);
        dispatch({ type: 'ADD_SEASON_XP', payload: SEASON_XP.explore });
        dispatch({
            type: 'SET_PLAYER',
            payload: (currentPlayer) => {
                let nextPlayer = {
                    ...currentPlayer,
                    stats: {
                        ...(currentPlayer.stats || {}),
                        explores: (currentPlayer.stats?.explores || 0) + 1,
                        discoveries: ['narrative_event', 'relic_found', 'anomaly', 'key_event'].includes(outcome)
                            ? (currentPlayer.stats?.discoveries || 0) + 1
                            : (currentPlayer.stats?.discoveries || 0),
                        exploreState: advanceExploreState(currentPlayer.stats, outcome),
                    }
                };
                if (typeof transformPlayer === 'function') {
                    nextPlayer = transformPlayer(nextPlayer) || nextPlayer;
                }
                return nextPlayer;
            }
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
        // 시즌 전용 맵: seasonEvent 활성 시에만 접근 가능
        if (targetMap.seasonOnly && !liveConfig?.seasonEvent?.active) {
            return addLog('warn', '⚡ 시즌 이벤트 기간에만 접근할 수 있는 지역입니다.');
        }
        const requiredLevel = targetMap.minLv ?? (Array.isArray(targetMap.level) ? targetMap.level[0] : targetMap.level) ?? 1;
        if (player.level < requiredLevel) return addLog('error', `레벨 ${requiredLevel} 이상이어야 이동 가능합니다.`);
        // 시즌 맵은 exits 체크 없이 직접 접근 허용
        if (!targetMap.seasonOnly && !DB.MAPS[player.loc].exits.includes(loc)) return addLog('error', '갈 수 없는 곳입니다.');
        const firstVisit = !(player.stats?.visitedMaps || []).includes(loc);
        const isSafeDestination = targetMap.type === 'safe';
        const shouldClearTemporaryState = isSafeDestination && hasTemporaryAdventureState(player);
        const gravesAtDestination = getGravesAtLoc(grave, loc);
        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => {
                const nextPlayer = isSafeDestination ? clearTemporaryAdventureState(p) : { ...p };
                return {
                    ...nextPlayer,
                    loc,
                    stats: {
                        ...(nextPlayer.stats || {}),
                        visitedMaps: Array.from(new Set([...(p.stats?.visitedMaps || []), loc]))
                    }
                };
            }
        });
        dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
        addLog('success', `${loc}로 이동했습니다.`);
        if (firstVisit) {
            addLog('event', `🗺️ 새 지역 발견: ${loc}`);
            // Phase 2-C: 지역 최초 방문 보상 지급
            const visitReward = getFirstVisitReward(loc, player);
            if (visitReward) {
                addLog('system', visitReward.msg);
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => {
                        let updated = isSafeDestination ? clearTemporaryAdventureState(p) : { ...p };
                        updated = { ...updated, gold: (updated.gold || 0) + visitReward.gold };
                        const expResult = CombatEngine.applyExpGain(updated, visitReward.exp);
                        return expResult.updatedPlayer;
                    }
                });
            }
        }
        addLog('system', targetMap.desc);
        if (firstVisit && targetMap.lore) {
            addLog('event', `📖 ${targetMap.lore}`);
        }
        // 발견 체인 체크
        checkDiscoveryChains(player, loc, { dispatch, addLog });
        if (shouldClearTemporaryState) addLog('info', '마을에 복귀하며 임시 버프와 상태이상이 정리되었습니다.');
        if (gravesAtDestination.length > 0) {
            addLog('event', gravesAtDestination.length > 1 ? `근처에서 당신의 유해 ${gravesAtDestination.length}구를 발견했습니다.` : '근처에서 당신의 유해를 발견했습니다.');
        }
    },

    start: (name, gender = 'male', jobId = '모험가', challengeModifiers = []) => {
        const trimmedName = String(name || '').trim().slice(0, 16);
        if (!trimmedName) return;
        const cls = CLASSES[jobId] || CLASSES['모험가'];
        const vitals = buildClassVitals(player.level || 1, jobId, player.meta || {});
        let maxHp = vitals.maxHp;
        let startGold = CONSTANTS.START_GOLD;
        const mods = Array.isArray(challengeModifiers) ? challengeModifiers : [];
        if (mods.includes('halfHp')) maxHp = Math.max(50, Math.floor(maxHp * 0.5));
        if (mods.includes('noGold')) startGold = 0;
        dispatch({ type: 'SET_PLAYER', payload: {
            name: trimmedName,
            gender,
            job: jobId,
            maxHp,
            hp: maxHp,
            maxMp: vitals.maxMp,
            mp: vitals.maxMp,
            gold: startGold,
            challengeModifiers: mods,
            stats: {
                ...(player.stats || {}),
                visitedMaps: ['시작의 마을']
            }
        }});
        addLog('system', `[콜사인] ${trimmedName} — 에테리아 기록이 열렸습니다.`);
        addLog('event', `초기 스킬: ${cls.skills[0]?.name || '강타'}`);
        if (mods.length > 0) {
            const labels = mods.map(id => BALANCE.CHALLENGE_MODIFIERS.find(m => m.id === id)?.label || id);
            addLog('warn', MSG.CHALLENGE_START(labels));
        }
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
        if (gameState !== GS.IDLE) return addLog('error', '탐색할 수 없는 상태입니다.');
        if (player.loc === '시작의 마을') return addLog('info', '마을 주변은 평화롭습니다.');

        const mapData = DB.MAPS[player.loc];
        const playerRelics = player.relics || [];
        const eventChanceBonus = playerRelics.reduce((acc, relic) => (
            relic.effect === 'event_chance' ? acc + relic.val : acc
        ), 0);
        const pacingProfile = getMapPacingProfile(mapData);
        const effectiveEventChance = getNarrativeEventChance(mapData.eventChance || 0, eventChanceBonus, player.stats, mapData);
        const quietChance = getQuietExplorationChance(player.stats, mapData);

        // Sprint 17: 내러티브 이벤트 체인 체크 (AI 이벤트보다 우선)
        const chainTrigger = getChainEventForLoc(player.loc, player.eventChainProgress);
        if (chainTrigger) {
            commitExploreOutcome('narrative_event');
            const { chain, step } = chainTrigger;
            dispatch({ type: 'SET_GAME_STATE', payload: GS.EVENT });
            dispatch({ type: 'SET_EVENT', payload: {
                ...step.event,
                _chainId: chain.id,
                _chainStep: step.step,
            }});
            addLog('event', `📜 [${chain.label}] ${step.event.desc}`);
            return;
        }

        // AI 랜덤 이벤트 체크
        if (Math.random() < effectiveEventChance) {
            dispatch({ type: 'SET_GAME_STATE', payload: GS.EVENT });
            dispatch({ type: 'SET_AI_THINKING', payload: true });
            try {
                const fullStats = getFullStats();
                const baseSnapshot = {
                    name: player.name, job: player.job, level: player.level,
                    hp: player.hp, maxHp: fullStats.maxHp, mp: player.mp, maxMp: fullStats.maxMp,
                    gold: player.gold, title: player.activeTitle || null,
                    relicCount: playerRelics.length,
                    status: toArray(player.status).slice(0, 4),
                    activeQuests: toArray(player.quests).filter(q => !q.done).slice(0, 3).map(q => q.title),
                    buildProfile: getRunBuildProfile(player, fullStats).tags.map((tag) => tag.name).slice(0, 4)
                };
                // Stage 3: AI 이벤트에 동적 난이도 정보 주입
                const playerSnapshot = enrichSnapshotWithDifficulty(baseSnapshot, player);
                const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid, {
                    playerSnapshot,
                    mapSnapshot: {
                        name: player.loc, type: mapData.type, level: mapData.level,
                        exits: toArray(mapData.exits).slice(0, 3), boss: Boolean(mapData.boss),
                        rhythm: pacingProfile.label
                    }
                });
                if (eventData?.exhausted) {
                    commitExploreOutcome('nothing');
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
                    addLog('warning', eventData.message || '오늘 AI 호출 한도에 도달했습니다.');
                } else if (eventData && eventData.desc) {
                    commitExploreOutcome('narrative_event');
                    if (eventData.fallbackReason === 'quota' && eventData.fallbackMessage) addLog('info', eventData.fallbackMessage);
                    const normalizedChoices = toArray(eventData.choices)
                        .map((choice, idx) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`))
                        .slice(0, 3);
                    const normalized = { ...eventData, choices: normalizedChoices, outcomes: toArray(eventData.outcomes) };
                    dispatch({ type: 'SET_EVENT', payload: normalized });
                    addLog('event', normalized.desc);
                } else {
                    commitExploreOutcome('nothing');
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
                    addLog('info', '아무 일도 일어나지 않았습니다.');
                }
            } finally {
                dispatch({ type: 'SET_AI_THINKING', payload: false });
            }
            return;
        }

        if (Math.random() < quietChance) {
            // 조용한 탐색: 아노말리/유물 발견 처리 (Phase 1-B)
            const quietResult = rollExplorationEvent(player, mapData, playerRelics, { dispatch, addLog, getFullStats });
            if (quietResult !== 'nothing') {
                commitExploreOutcome(quietResult);
                return;
            }
            commitExploreOutcome('nothing');
            return addLog('info', '주변이 조용합니다.');
        }

        // 전투 직전 유물 발견 기회 (Phase 1-B)
        if (playerRelics.length < MAX_RELICS_PER_RUN && Math.random() < BALANCE.RELIC_FIND_CHANCE * 0.5) {
            const available = RELICS.filter(r => !playerRelics.some(pr => pr.id === r.id));
            if (available.length > 0) {
                commitExploreOutcome('relic_found');
                const candidates = pickWeightedRelics(available, 3);
                dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
                addLog('event', '✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!');
                return;
            }
        }

        // 몬스터 생성 (Phase 1-B)
        const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog });

        // Stage 3: 동적 난이도 조절 적용
        let { mStats } = applyDynamicDifficulty(rawStats, player, addLog);

        // 무한 심연 모드: 혼돈의 심연에서 abyssFloor 기반 스케일링
        if (mapData.level === 'infinite') {
            const floor = (player.stats?.abyssFloor || 0) + 1;
            const abyssScale = 1 + (floor - 1) * 0.08; // 층당 8% 스탯 증가
            mStats = {
                ...mStats,
                hp: Math.floor(mStats.hp * abyssScale),
                maxHp: Math.floor(mStats.maxHp * abyssScale),
                atk: Math.floor(mStats.atk * abyssScale),
                exp: Math.floor(mStats.exp * (1 + (floor - 1) * 0.12)),
                gold: Math.floor(mStats.gold * (1 + (floor - 1) * 0.1)),
                level: 50 + floor,
            };
            // 보스 층: 지정 심연 보스 강제 소환
            if (BALANCE.ABYSS_BOSS_FLOORS.includes(floor)) {
                const bossName = BALANCE.ABYSS_BOSS_NAMES[floor] || '혼돈의 수호자';
                const bossProfile = DB.MONSTERS?.[bossName];
                mStats = {
                    ...mStats,
                    name: `[${floor}층 보스] ${bossName}`,
                    baseName: bossName,
                    isBoss: true,
                    hp: Math.floor(mStats.hp * (bossProfile?.hpMult || 2.0)),
                    maxHp: Math.floor(mStats.maxHp * (bossProfile?.hpMult || 2.0)),
                    atk: Math.floor(mStats.atk * (bossProfile?.atkMult || 1.5)),
                    exp: Math.floor(mStats.exp * (bossProfile?.expMult || 2.5)),
                    gold: Math.floor(mStats.gold * (bossProfile?.goldMult || 2.5)),
                    dropMod: bossProfile?.dropMod || 2.5,
                    weakness: bossProfile?.weakness,
                    resistance: bossProfile?.resistance,
                    phase2: bossProfile?.phase2,
                };
                addLog('critical', MSG.ABYSS_BOSS_APPEAR(bossName));
            } else if (floor % 5 === 0) {
                addLog('warning', `🌀 심연 ${floor}층 — 강대한 적들이 기다립니다...`);
            }
        }

        // 전투 시작 유물 효과 적용 (Phase 1-B)
        const fullStats = getFullStats();
        commitExploreOutcome('combat', (nextPlayer) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog }));
        dispatch({ type: 'SET_ENEMY', payload: mStats });
        dispatch({ type: 'SET_GAME_STATE', payload: GS.COMBAT });
        addLog('combat', `${mStats.name} 등장!`);
        addStoryLog('encounter', { loc: player.loc, name: baseName });
    },

    handleEventChoice: (idx) => {
        if (!currentEvent) return;

        let resultText = '';
        // 체인 이벤트: outcomes는 배열 인덱스로 매칭 (choiceIndex 없이)
        const isChainEvent = Boolean(currentEvent._chainId);
        const selectedOutcome = isChainEvent
            ? (toArray(currentEvent.outcomes)[idx] || null)
            : (toArray(currentEvent.outcomes).find((o) => o.choiceIndex === idx) || null);
        const roll = Math.random();
        let updatedPlayer = player;
        const fullStats = getFullStats();

        // Sprint 17: 체인 이벤트 outcome 처리
        if (isChainEvent && selectedOutcome) {
            const outcome = selectedOutcome;
            addLog('event', outcome.log || '');
            // 보상 처리
            const rwd = outcome.reward;
            if (rwd) {
                if (rwd.type === 'gold' && rwd.amount) {
                    updatedPlayer = grantGold(updatedPlayer, rwd.amount);
                }
                if (rwd.type === 'item' && rwd.name) {
                    const itemDef = findItemByName(rwd.name);
                    if (itemDef) updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemDef)] };
                }
                if (rwd.type === 'relic') {
                    const pickedRelics = pickWeightedRelics(updatedPlayer.relics || [], 1);
                    if (pickedRelics.length > 0) {
                        updatedPlayer = { ...updatedPlayer, relics: [...(updatedPlayer.relics || []), pickedRelics[0]] };
                        addLog('success', `✨ [체인 보상] 유물 [${pickedRelics[0].name}] 획득!`);
                    }
                }
                if (rwd.type === 'combat_bonus') {
                    updatedPlayer = { ...updatedPlayer, tempBuff: { atk: (rwd.atkMult || 1.3) - 1, def: 0, turn: rwd.duration || 5, name: '기사의 혼령' } };
                    addLog('success', `⚔ [최후의 영웅] 기사의 혼령 합류! ATK +${Math.round(((rwd.atkMult || 1.3) - 1) * 100)}% ${rwd.duration || 5}턴`);
                }
            }
            // SET_PLAYER를 먼저 dispatch한 후 UPDATE_EVENT_CHAIN을 dispatch해야
            // SET_PLAYER가 eventChainProgress를 덮어쓰지 않음
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            if (outcome.type === 'chain_advance' || outcome.type === 'chain_advance_fail') {
                const nextStep = (currentEvent._chainStep ?? 0) + 1;
                dispatch({ type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: currentEvent._chainId, step: nextStep } });
            }
            dispatch({ type: 'SET_EVENT', payload: null });
            dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
            return;
        }

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
                    hp: Math.max(1, Math.min(fullStats.maxHp, updatedPlayer.hp + selectedOutcome.hp))
                };
            }
            if (selectedOutcome.mp) {
                updatedPlayer = {
                    ...updatedPlayer,
                    mp: Math.max(0, Math.min(fullStats.maxMp, updatedPlayer.mp + selectedOutcome.mp))
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
        dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
    },

    rest: () => {
        if (gameState !== 'idle') return;
        const mapData = DB.MAPS[player.loc];
        if (mapData.type !== 'safe') return addLog('error', '휴식은 안전한 지역에서만 가능합니다.');
        // 휴식 비용: 레벨 기반 스케일링 (100G * (1 + lv/20))
        const restCost = Math.floor(BALANCE.REST_COST * (1 + (player.level || 1) / 20));
        if (player.gold < restCost) return addLog('error', `골드가 부족합니다. (필요: ${restCost}G)`);

        const stats = getFullStats();
        const updatedPlayer = {
            ...player,
            gold: player.gold - restCost,
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
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: restCost } });
        emitDailyProtocolLogs('goldSpend', restCost);
        emitUnlockedTitles(updatedPlayer);
        addLog('success', `휴식 완료. HP/MP가 회복되었습니다. (-${restCost}G)`);
        addStoryLog('rest', { loc: player.loc });
    },

    // 안전지대 스킬 분기 교체 (50골드)
    swapSkillChoice: (skillName, newChoice) => {
        if (gameState !== 'idle') return;
        const mapData = DB.MAPS[player.loc];
        if (!mapData || mapData.type !== 'safe') return addLog('error', '스킬 교체는 안전한 지역에서만 가능합니다.');
        const cost = BALANCE.SKILL_SWAP_COST || 50;
        if ((player.gold || 0) < cost) return addLog('error', `골드가 부족합니다. (필요: ${cost}G)`);
        const classData = CLASSES[player.job];
        const branches = classData?.skillBranches?.[skillName];
        if (!branches) return addLog('error', '해당 스킬에 분기가 없습니다.');
        const branch = branches.find(b => b.choice === newChoice);
        if (!branch) return addLog('error', '유효하지 않은 분기입니다.');
        const oldChoice = player.skillChoices?.[skillName] || '기본';
        dispatch({
            type: AT.SET_PLAYER,
            payload: p => ({
                ...p,
                gold: (p.gold || 0) - cost,
                skillChoices: { ...(p.skillChoices || {}), [skillName]: newChoice },
            }),
        });
        addLog('success', MSG.SKILL_SWAP(oldChoice, newChoice));
        addLog('info', MSG.SKILL_SWAP_COST(cost));
    },

    // ControlPanel에서 확인 UI를 거친 뒤 호출됩니다 (window.confirm 제거)
    reset: () => {
        dispatch({ type: 'RESET_GAME' });
        addLog('system', '초기 기록이 적용되었습니다. 이름을 정하고 다시 시작해 주세요.');
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
        dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
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
        const gravesAtLoc = getGravesAtLoc(grave, player.loc);
        if (gravesAtLoc.length === 0) return;
        const { updatedPlayer, logMsg } = resolveGraveRecovery(player, gravesAtLoc);
        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        emitUnlockedTitles(updatedPlayer);
        dispatch({ type: 'SET_GRAVE', payload: removeGravesAtLoc(grave, player.loc) });
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
        dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
        addLog('info', '환생을 취소했습니다. 여정을 계속합니다.');
    },
    });
};
