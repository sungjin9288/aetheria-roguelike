import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { RELICS, pickWeightedRelics, MAX_RELICS_PER_RUN } from '../../data/relics';
import { AI_SERVICE } from '../../services/aiService';
import { toArray } from '../../utils/gameUtils';
import { rollExplorationEvent, spawnEnemy, applyBattleStartRelics } from '../../utils/exploreUtils';
import { getMapPacingProfile, getNarrativeEventChance, getQuietExplorationChance } from '../../utils/explorationPacing';
import { getRunBuildProfile } from '../../utils/runProfileUtils';
import { applyDynamicDifficulty, enrichSnapshotWithDifficulty } from '../../systems/DifficultyManager';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getChainEventForLoc } from '../../data/eventChains';

export const createExploreActions = (deps, { commitExploreOutcome }) => {
    const { player, gameState, uid, isAiThinking, liveConfig, dispatch, addLog, addStoryLog, getFullStats } = deps;
    return {
        explore: async () => {
            if (gameState !== GS.IDLE) return addLog('error', MSG.EXPLORE_BLOCKED);
            if (player.loc === CONSTANTS.START_LOCATION) return addLog('info', MSG.TOWN_PEACEFUL);

            const mapData = DB.MAPS[player.loc];
            if (!mapData) return addLog('error', MSG.MAP_UNKNOWN);
            const playerRelics = player.relics || [];
            const eventChanceBonus = playerRelics.reduce((acc, relic) => (
                relic.effect === 'event_chance' ? acc + relic.val : acc
            ), 0);
            const pacingProfile = getMapPacingProfile(mapData);
            const effectiveEventChance = getNarrativeEventChance(mapData.eventChance || 0, eventChanceBonus, player.stats, mapData);
            const quietChance = getQuietExplorationChance(player.stats, mapData);

            // 내러티브 이벤트 체인 체크 (AI 이벤트보다 우선)
            const chainTrigger = getChainEventForLoc(player.loc, player.eventChainProgress);
            if (chainTrigger) {
                commitExploreOutcome('narrative_event');
                const { chain, step } = chainTrigger;
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: {
                    ...step.event,
                    _chainId: chain.id,
                    _chainStep: step.step,
                }});
                addLog('event', `📜 [${chain.label}] ${step.event.desc}`);
                return;
            }

            // AI 랜덤 이벤트 체크
            if (Math.random() < effectiveEventChance) {
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_AI_THINKING, payload: true });
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
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        addLog('warning', eventData.message || MSG.AI_QUOTA_REACHED);
                    } else if (eventData && eventData.desc) {
                        commitExploreOutcome('narrative_event');
                        if (eventData.fallbackReason === 'quota' && eventData.fallbackMessage) addLog('info', eventData.fallbackMessage);
                        const normalizedChoices = toArray(eventData.choices)
                            .map((choice, idx) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`))
                            .slice(0, 3);
                        const normalized = { ...eventData, choices: normalizedChoices, outcomes: toArray(eventData.outcomes) };
                        dispatch({ type: AT.SET_EVENT, payload: normalized });
                        addLog('event', normalized.desc);
                    } else {
                        commitExploreOutcome('nothing');
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        addLog('info', MSG.EXPLORE_NOTHING);
                    }
                } finally {
                    dispatch({ type: AT.SET_AI_THINKING, payload: false });
                }
                return;
            }

            if (Math.random() < quietChance) {
                const quietResult = rollExplorationEvent(player, mapData, playerRelics, { dispatch, addLog, getFullStats });
                if (quietResult !== 'nothing') {
                    commitExploreOutcome(quietResult);
                    return;
                }
                commitExploreOutcome('nothing');
                return addLog('info', MSG.EXPLORE_QUIET);
            }

            // 전투 직전 유물 발견 기회
            if (playerRelics.length < MAX_RELICS_PER_RUN && Math.random() < BALANCE.RELIC_FIND_CHANCE * 0.5) {
                const available = RELICS.filter(r => !playerRelics.some(pr => pr.id === r.id));
                if (available.length > 0) {
                    commitExploreOutcome('relic_found');
                    const candidates = pickWeightedRelics(available, 3);
                    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
                    addLog('event', MSG.EXPLORE_RELIC_FOUND);
                    return;
                }
            }

            // 몬스터 생성
            const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog });
            let { mStats } = applyDynamicDifficulty(rawStats, player, addLog);

            // 무한 심연 모드
            if (mapData.level === 'infinite') {
                const floor = (player.stats?.abyssFloor || 0) + 1;
                const abyssScale = 1 + (floor - 1) * 0.08;
                mStats = {
                    ...mStats,
                    hp: Math.floor(mStats.hp * abyssScale),
                    maxHp: Math.floor(mStats.maxHp * abyssScale),
                    atk: Math.floor(mStats.atk * abyssScale),
                    exp: Math.floor(mStats.exp * (1 + (floor - 1) * 0.12)),
                    gold: Math.floor(mStats.gold * (1 + (floor - 1) * 0.1)),
                    level: 50 + floor,
                };
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
                        phase3: bossProfile?.phase3,
                    };
                    addLog('critical', MSG.ABYSS_BOSS_APPEAR(bossName));
                } else if (floor % 5 === 0) {
                    addLog('warning', MSG.ABYSS_FLOOR_WARNING(floor));
                }
            }

            const fullStats = getFullStats();
            commitExploreOutcome('combat', (nextPlayer) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog }));
            dispatch({ type: AT.SET_ENEMY, payload: mStats });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
            addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
            addStoryLog('encounter', { loc: player.loc, name: baseName });
        },
    };
};
