import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { AI_SERVICE } from '../../services/aiService';
import { toArray } from '../../utils/gameUtils';
import { rollExplorationEvent, spawnEnemy, applyBattleStartRelics } from '../../utils/exploreUtils';
import { getBossSignatureDrops } from '../../utils/bossSignatureHint';
import { getSignaturePityMultiplier } from '../../utils/signaturePity';
import { getMapPacingProfile, getNarrativeEventChance, getQuietExplorationChance } from '../../utils/explorationPacing';
import { getRunBuildProfile } from '../../utils/runProfileUtils';
import { applyDynamicDifficulty, enrichSnapshotWithDifficulty } from '../../systems/DifficultyManager';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getChainEventForLoc } from '../../data/eventChains';
import { buildCampfireEvent } from '../../utils/campfireEvent';
import { soundManager } from '../../systems/SoundManager';

export const createExploreActions = (deps: any, { commitExploreOutcome }: any) => {
    const { player, gameState, uid, dispatch, addLog, addStoryLog, getFullStats } = deps;
    return {
        explore: async () => {
            if (gameState !== GS.IDLE) return addLog('error', MSG.EXPLORE_BLOCKED);
            if (player.loc === CONSTANTS.START_LOCATION) return addLog('info', MSG.TOWN_PEACEFUL);

            const mapData = DB.MAPS[player.loc];
            if (!mapData) return addLog('error', MSG.MAP_UNKNOWN);
            // cycle 220: 탐험 tick sensory cue — sine wave 800→1200→800Hz arc, 0.16s 짧은 cue
            //   (gain 0.04 subtle). 정의 있으나 dispatch 0건이던 dead path. 탐험 트리거 시점에
            //   1회 — narrative event / combat / nothing 분기 전 사용자 입력 confirmation.
            //   cycle 217-219 sensory cue 시리즈 마지막 합류.
            soundManager.play('explore');
            const playerRelics = player.relics || [];
            const eventChanceBonus = playerRelics.reduce((acc: any, relic: any) => (
                relic.effect === 'event_chance' ? acc + relic.val : acc
            ), 0);
            const pacingProfile = getMapPacingProfile(mapData);
            const effectiveEventChance = getNarrativeEventChance(mapData.eventChance || 0, eventChanceBonus, player.stats, mapData);
            const quietChance = getQuietExplorationChance(player.stats, mapData);

            // 내러티브 이벤트 체인 체크 (AI 이벤트보다 우선)
            const chainTrigger = getChainEventForLoc(player.loc, player.eventChainProgress);
            if (chainTrigger) {
                commitExploreOutcome('narrative_event', null);
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

            // 캠프파이어 노드 (Phase 2, B+): 던전에서 낮은 확률로 "휴식 vs 단련" 결정.
            //   위협(A-1/A-4)이 강해진 만큼 회복은 실질 선택 — 결정 밀도를 높인다 (StS 캠프파이어).
            if (mapData.type === 'dungeon' && Math.random() < BALANCE.CAMPFIRE_CHANCE) {
                commitExploreOutcome('narrative_event', null);
                const campfireEvent = buildCampfireEvent(getFullStats());
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: campfireEvent });
                addLog('event', campfireEvent.desc);
                soundManager.play('new_area');
                return;
            }

            // AI 랜덤 이벤트 체크
            if (Math.random() < effectiveEventChance) {
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_AI_THINKING, payload: true });
                try {
                    const fullStats = getFullStats();
                    const baseSnapshot: Record<string, any> = {
                        name: player.name, job: player.job, level: player.level,
                        hp: player.hp, maxHp: fullStats.maxHp, mp: player.mp, maxMp: fullStats.maxMp,
                        gold: player.gold, title: player.activeTitle || null,
                        relicCount: playerRelics.length,
                        status: toArray(player.status).slice(0, 4),
                        activeQuests: toArray(player.quests).filter((q: any) => !q.done).slice(0, 3).map((q: any) => q.title),
                        buildProfile: getRunBuildProfile(player, fullStats).tags.map((tag: any) => tag.name).slice(0, 4)
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
                        commitExploreOutcome('nothing', null);
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        addLog('warning', eventData.message || MSG.AI_QUOTA_REACHED);
                    } else if (eventData && eventData.desc) {
                        commitExploreOutcome('narrative_event', null);
                        if (eventData.fallbackReason === 'quota' && eventData.fallbackMessage) addLog('info', eventData.fallbackMessage);
                        const normalizedChoices = toArray(eventData.choices)
                            .map((choice: any, idx: any) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || MSG.CHOICE_DEFAULT(idx + 1)))
                            .slice(0, 3);
                        const normalized = { ...eventData, choices: normalizedChoices, outcomes: toArray(eventData.outcomes) };
                        dispatch({ type: AT.SET_EVENT, payload: normalized });
                        addLog('event', normalized.desc);
                    } else {
                        commitExploreOutcome('nothing', null);
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
                    commitExploreOutcome(quietResult, null);
                    return;
                }
                commitExploreOutcome('nothing', null);
                return addLog('info', MSG.EXPLORE_QUIET);
            }

            // 전투 직전 유물 발견 기회
            // slice 19: 첫 유물 보장 — 유물 0개 상태로 FIRST_RELIC_PITY_EXPLORES(6)탐험
            //   경과 시 확률 roll 없이 보장. 첫 빌드 선택("와" 모먼트)을 첫 10분 내 제공.
            const firstRelicPity = playerRelics.length === 0
                && (player.stats?.exploreState?.sinceRelic || 0) >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
            // PR #8: 프레스티지 rank≥2 해금 — 보유 한도 +1 · 선택지 4지선다.
            const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
            if (playerRelics.length < relicUnlocks.maxRelics
                && (firstRelicPity || Math.random() < BALANCE.RELIC_FIND_CHANCE * 0.5)) {
                const available = RELICS.filter((r: any) => !playerRelics.some((pr: any) => pr.id === r.id));
                if (available.length > 0) {
                    commitExploreOutcome('relic_found', null);
                    const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices);
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
            commitExploreOutcome('combat', (nextPlayer: any) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog }));
            dispatch({ type: AT.SET_ENEMY, payload: mStats });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
            addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
            // anticipate 레이어: boss가 signature를 드롭 가능한 경우 pre-combat 예고
            if (mStats.isBoss) {
                const sigDrops = getBossSignatureDrops(mStats.baseName);
                if (sigDrops.length > 0) {
                    const top = sigDrops[0];
                    const topPct = Math.max(1, Math.round(top.rate * 100));
                    addLog('legendary', MSG.SIGNATURE_BOSS_HINT(mStats.baseName, sigDrops.length, top.name, topPct));
                    // pity 공명 피드백 — 보스 연속 무획득 누적 시 배율 표기
                    const pityMult = getSignaturePityMultiplier(player.stats?.signaturePity);
                    if (pityMult > 1) {
                        const pct = Math.round((pityMult - 1) * 100);
                        addLog('legendary', MSG.SIGNATURE_PITY_RESONANCE(pct, player.stats.signaturePity));
                    }
                }
            }
            addStoryLog('encounter', { loc: player.loc, name: baseName });
        },
    };
};
