import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { getMirrorEffects } from '../../systems/mirrorUpgrades';
import { AI_SERVICE } from '../../services/aiService';
import { toArray } from '../../utils/gameUtils';
import { runQuietRollAndCombat } from './exploreFlow';
import { canOfferOptionalExploreDecision, getMapPacingProfile, getNarrativeEventChance } from '../../utils/explorationPacing';
import { getRunBuildProfile } from '../../utils/runProfileUtils';
import { enrichSnapshotWithDifficulty } from '../../systems/DifficultyManager';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getChainEventForLoc } from '../../data/eventChains';
import { buildCampfireEvent } from '../../utils/campfireEvent';
import { shouldTriggerScout, buildScoutEvent, getScoutAvailability, consumeScoutCharge } from '../../utils/scoutEvents';
import { isAreaBossUndefeated, isBossGaugeFull, getAreaBossName, buildBossChallengeEvent, advanceBossGauge } from '../../utils/bossGauge';
import { getProgressionEventMultiplier } from '../../data/progressionProfiles';
import type { Player } from '../../types';
import { resolveExploreActionRandom } from '../../utils/exploreActionSeed';
import { BOUNDED_ENCOUNTER_PACK_ENABLED, BOUNDED_ENCOUNTERS } from '../../data/boundedEncounters';
import { buildBoundedEncounterContext, selectBoundedEncounter } from '../../utils/boundedEncounterSelector';
import { buildBoundedEncounterEvent } from '../../utils/boundedEncounterEvent';
import { getAdditiveNumericRelicValue } from '../../utils/relicEffectValues';

const takeHarnessExploreSeed = (): number | undefined => {
    if (import.meta.env?.VITE_ENABLE_TEST_API !== '1' || typeof document === 'undefined') {
        return undefined;
    }
    const raw = document.documentElement.dataset.aetheriaExploreSeed;
    delete document.documentElement.dataset.aetheriaExploreSeed;
    if (raw === undefined || !/^\d{1,10}$/.test(raw)) return undefined;
    const seed = Number(raw);
    return Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff
        ? seed
        : undefined;
};

/**
 * 캠프파이어/스카우팅 이후 AI 랜덤 이벤트 체크 (explore() 전용 — AI_SERVICE는 firebase에
 * 의존하므로 eventActions.ts의 스카우팅 "짙은 안개" 카드는 이 함수를 거치지 않고
 * runQuietRollAndCombat(exploreFlow.ts)만 재사용한다 — firebase-free 단위 테스트 유지).
 * AI 이벤트가 발동하지 않으면 quiet 롤 이하 파이프(runQuietRollAndCombat)로 이어진다.
 */
const runExplorePostDecisionRoll = async (mapData: any, deps: any, { commitExploreOutcome }: any, optionalDecisionAllowed: boolean) => {
    const { player, uid, dispatch, addLog, addStoryLog, getFullStats } = deps;
    const rng = typeof deps.rng === 'function' ? deps.rng : Math.random;
    const playerRelics = player.relics || [];
    const eventChanceBonus = getAdditiveNumericRelicValue(playerRelics, 'event_chance');
    const pacingProfile = getMapPacingProfile(mapData);
    const effectiveEventChance = getNarrativeEventChance(
        mapData.eventChance || 0,
        eventChanceBonus,
        player.stats,
        mapData,
        getProgressionEventMultiplier(player),
    );

    // AI 랜덤 이벤트 체크. 직전 선택 뒤 한 번의 일반 탐험이 없으면 optional roll을 소비하지 않는다.
    if (optionalDecisionAllowed && rng() < effectiveEventChance) {
        const occurrenceSequence = Math.max(1, Number(player.stats?.explores || 0) + 1);
        const expeditionId = player.activeExpedition?.id;
        const receipt = typeof expeditionId === 'string'
            ? { expeditionId, occurrenceSequence }
            : null;
        const context = receipt ? buildBoundedEncounterContext(player, player.loc) : null;
        const encounter = receipt && context && BOUNDED_ENCOUNTER_PACK_ENABLED
            ? selectBoundedEncounter(BOUNDED_ENCOUNTERS, context, receipt, rng)
            : null;

        if (encounter) {
            commitExploreOutcome('narrative_event', null, mapData);
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
            dispatch({ type: AT.SET_EVENT, payload: buildBoundedEncounterEvent(encounter, occurrenceSequence) });
            addLog('event', encounter.situation);
            return;
        }

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
            }, rng);
            // (구) `eventData.exhausted` 분기는 생산자가 없는 죽은 경로였다 — 한도 초과는
            //   aiService가 폴백 이벤트에 fallbackReason:'quota'를 붙여 아래 분기로 들어온다.
            if (eventData && eventData.desc) {
                commitExploreOutcome('narrative_event', null, mapData);
                if (eventData.fallbackReason === 'quota' && eventData.fallbackMessage) addLog('info', eventData.fallbackMessage);
                const normalizedChoices = toArray(eventData.choices)
                    .map((choice: any, idx: any) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || MSG.CHOICE_DEFAULT(idx + 1)))
                    .slice(0, 3);
                const normalized = { ...eventData, choices: normalizedChoices, outcomes: toArray(eventData.outcomes) };
                dispatch({ type: AT.SET_EVENT, payload: normalized });
                addLog('event', normalized.desc);
            } else {
                commitExploreOutcome('nothing', null, mapData);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                addLog('info', MSG.EXPLORE_NOTHING);
            }
        } finally {
            dispatch({ type: AT.SET_AI_THINKING, payload: false });
        }
        return;
    }

    runQuietRollAndCombat(player, mapData, {
        dispatch, addLog, addStoryLog, getFullStats, commitExploreOutcome, rng,
    });
};

export const createExploreActions = (deps: any, shared: any) => {
    const { commitExploreOutcome } = shared;
    const { player, gameState, dispatch, addLog, getFullStats } = deps;
    const rng = typeof deps.rng === 'function' ? deps.rng : Math.random;
    return {
        explore: async () => {
            if (gameState !== GS.IDLE) return addLog('error', MSG.EXPLORE_BLOCKED);
            if (player.loc === CONSTANTS.START_LOCATION) return addLog('info', MSG.TOWN_PEACEFUL);

            const actionRng = resolveExploreActionRandom(rng, takeHarnessExploreSeed());

            const mapData = DB.MAPS[player.loc];
            if (!mapData) return addLog('error', MSG.MAP_UNKNOWN);
            // 내러티브 이벤트 체인 체크 (AI 이벤트보다 우선)
            const chainTrigger = getChainEventForLoc(player.loc, player.eventChainProgress, player.deferredEventChainSteps);
            if (chainTrigger) {
                commitExploreOutcome('narrative_event', null, mapData);
                const { chain, step } = chainTrigger;
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: {
                    ...step.event,
                    _chainId: chain.id,
                    _chainStep: step.step,
                }});
                addLog('event', MSG.EXPLORE_CHAIN_EVENT(chain.label, step.event.desc));
                return;
            }

            // 캠프파이어 노드 (Phase 2, B+): 던전에서 낮은 확률로 "휴식 vs 단련" 결정.
            //   위협(A-1/A-4)이 강해진 만큼 회복은 실질 선택 — 결정 밀도를 높인다 (StS 캠프파이어).
            // feat/prestige-rank-ladder: rank≥4 "재의 인장" — 캠프파이어 발견율 +4%p.
            // 2026-07 — 에테르 거울: campfire_rate 노드(레벨당 +2%p)를 동일 지점에 가산.
            const campfireChance = BALANCE.CAMPFIRE_CHANCE
                + getPrestigeUnlocks(player.meta?.prestigeRank).campfireChanceBonus
                + getMirrorEffects(player.meta).campfireChanceBonus;
            const optionalDecisionAllowed = canOfferOptionalExploreDecision(
                player.stats,
                player.activeExpedition,
            );
            // 2026-09 D2 — "밀어붙인다"를 고른 직후 1회는 모닥불이 나타나지 않는다.
            //   플래그는 이번 탐험에서 소비되며(성공/실패 무관), 아래 롤을 건너뛴다.
            const campfireBlocked = Boolean(player.stats?.nextExploreCampfireBlocked);
            if (campfireBlocked) {
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: (p: Player) => ({
                        ...p,
                        stats: { ...(p.stats || {}), nextExploreCampfireBlocked: false },
                    }),
                });
            }
            if (!campfireBlocked && optionalDecisionAllowed && mapData.type === 'dungeon' && actionRng() < campfireChance) {
                commitExploreOutcome('narrative_event', null, mapData);
                const campfireEvent = buildCampfireEvent(getFullStats());
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: campfireEvent });
                addLog('event', campfireEvent.desc);
                return;
            }

            // 원정 보스 접근 게이지 (2026-07 감사 축4): 미격파 구역 보스가 있는 던전에서
            //   게이지가 만충되면 "도전 vs 회피" 선택 카드를 제시한다. 체인 > 캠프파이어 >
            //   보스 도전 선택 > 스카우팅 > 나머지 롤 순 — 만충 상태는 스카우팅보다
            //   우선한다(이미 결정된 "위험이 눈앞에 있다"는 사실이 사전 정찰 카드보다
            //   서사적으로 앞서야 하고, 게이지가 만충인데 스카우팅 카드에 밀려 계속
            //   미뤄지면 "접근했는데 아무 일도 안 일어남"이 반복돼 게이지 시스템의
            //   존재감이 사라짐).
            if (isAreaBossUndefeated(mapData, player) && isBossGaugeFull(player, player.loc)) {
                commitExploreOutcome('narrative_event', null, mapData);
                const bossName = getAreaBossName(mapData) as string;
                const challengeEvent = buildBossChallengeEvent(bossName);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: challengeEvent });
                addLog('event', challengeEvent.desc);
                return;
            }

            // 탐험 스카우팅 (2026-07 감사 (b)): "정보 없는 단일 버튼 탐험" 갭 대응 — 던전(비안전지대)
            //   탐험 시 낮은 확률로 사전 정찰 카드 2~3장을 제시한다. 체인 > 캠프파이어 > 보스 도전 선택 >
            //   스카우팅 > 나머지 롤(AI 이벤트/quiet/전투) 순 우선순위. 선택은 eventActions.ts가 같은 턴에 해소.
            if (optionalDecisionAllowed && shouldTriggerScout(mapData, actionRng)) {
                commitExploreOutcome('narrative_event', null, mapData);
                const scoutEvent = buildScoutEvent(player, mapData, actionRng);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: scoutEvent });
                addLog('event', scoutEvent.desc);
                return;
            }

            await runExplorePostDecisionRoll(mapData, { ...deps, rng: actionRng }, shared, optionalDecisionAllowed);
        },

        /**
         * 2026-09 D1 — 플레이어가 직접 부르는 정찰.
         *  - 안전지대/마을과 전투·이벤트 중에는 제공하지 않는다 (getScoutAvailability 단일 판정).
         *  - 비용: 골드(지역 레벨에 따라 완만 상승) 또는 에테르 거울 scout_charges 무료 횟수.
         *  - 정찰하는 동안에도 시간은 흐른다 — 보스 접근 게이지를 1칸 올린다(advanceBossGauge 재사용).
         *  - 카드 자체와 선택 해소는 랜덤 발동과 완전히 같은 경로(buildScoutEvent →
         *    eventActions.handleScoutChoice)를 탄다 — 신규 스폰/해소 로직 없음.
         */
        scout: () => {
            const mapData = DB.MAPS[player.loc];
            const availability = getScoutAvailability(player, mapData, gameState === GS.IDLE);
            if (!availability.available) return addLog('error', availability.reason || MSG.SCOUT_BUSY);

            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: Player) => {
                    const chargedStats = availability.isFree ? consumeScoutCharge(p) : (p.stats || {});
                    const withGauge = advanceBossGauge({ ...p, stats: chargedStats }, mapData);
                    return {
                        ...p,
                        gold: Math.max(0, (p.gold || 0) - availability.cost),
                        stats: withGauge,
                    };
                },
            });

            addLog(
                'system',
                availability.isFree
                    ? MSG.SCOUT_FREE_LOG(Math.max(0, availability.remainingFree - 1))
                    : MSG.SCOUT_PAID_LOG(availability.cost),
            );

            // 게이지가 실제로 오르는 지역에서만 "시간이 흐른다"는 대가를 함께 알린다 (lessons R26).
            if (isAreaBossUndefeated(mapData, player)) addLog('info', MSG.SCOUT_TIME_PASSES);

            const scoutEvent = buildScoutEvent(player, mapData, rng);
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
            dispatch({ type: AT.SET_EVENT, payload: scoutEvent });
            addLog('event', scoutEvent.desc);
        },
    };
};
