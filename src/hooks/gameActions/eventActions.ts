import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { toArray, grantGold, findItemByName } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { CombatEngine } from '../../systems/CombatEngine';
import { scaleProgressionExpReward } from '../../data/progressionProfiles';
import { spawnEnemy } from '../../utils/exploreUtils';
import { rollExplorationEvent, applyBattleStartRelics, runQuietRollAndCombat } from './exploreFlow';
import { BALANCE } from '../../data/constants';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { resetBossGaugeAfterChallenge } from '../../utils/bossGauge';
import { formatEventText } from '../../utils/eventPresentation';
import type { Player, StatusId } from '../../types';
import type { GameState } from '../../reducers/gameReducer';
import type { AddLog, GameActionDeps, GameActionDepsWithRng } from '../actionDeps';
import type { CommitExploreOutcome, TitleSharedHelpers } from './_shared';

/**
 * 이벤트 카드 1개의 선택 결과(outcome). AI 이벤트·체인·정찰·보스 게이지·구조화 폴백이
 * 같은 배열에 실려 오므로, 각 경로가 읽는 필드를 여기 한 곳에 모아 optional로 선언한다
 * (`currentEvent` 자체는 아직 `GameState['currentEvent']` = any — reducer 핸들러 소유).
 */
interface EventOutcome {
    choiceIndex?: number;
    /** 구조화 조우(boundedEncounter) 전용 선택 식별자. */
    choiceId?: string;
    type?: string;
    log?: string;
    reward?: EventReward;
    gold?: number;
    exp?: number;
    hp?: number;
    mp?: number;
    item?: string;
    buff?: OutcomeBuff;
    status?: OutcomeStatus;
    relic?: OutcomeRelic;
    elite?: boolean;
    /** 정찰 카드 전용 — 'combat' | 'elite' | 'anomaly' | 'unknown'. */
    scoutEffect?: string;
    /** 정찰 "전투의 기척" 전용 — 처치 보상 배율 가산. */
    rewardBonus?: number;
    /** 보스 게이지 카드 전용 — 'avoid' | (도전). */
    gaugeEffect?: string;
}

/**
 * `GameEvent.outcomes`는 생산자(AI/체인/정찰/보스 게이지/한정 조우)마다 원소 모양이 달라
 * 세션 타입(`types/session.ts`)에서는 `unknown[]`로 열어 둔다. 이 훅은 자기 생산자
 * (AI/폴백 이벤트 + 체인 스텝)의 `EventOutcome` 모양만 읽으므로 여기서 한 번 좁힌다.
 */
const eventOutcomes = (event: GameState['currentEvent']): EventOutcome[] =>
    toArray(event?.outcomes) as EventOutcome[];

/** 체인 이벤트 outcome의 보상 블록 (eventChains.ts의 reward 스키마 합집합). */
interface EventReward {
    type?: string;
    amount?: number;
    text?: string;
    name?: string;
    atkMult?: number;
    duration?: number;
    atk?: number;
    def?: number;
    hp?: number;
    mp?: number;
}

/** exploreUtils.spawnEnemy가 만들어 내는 적 인스턴스 스탯. */
type SpawnedEnemyStats = ReturnType<typeof spawnEnemy>['mStats'];

/** 이벤트 outcome이 실어 보내는 버프 — 신규 배율 스키마와 캠프파이어 스키마 양쪽. */
interface OutcomeBuff {
    atkMult?: number;
    defMult?: number;
    turns?: number;
    atk?: number;
    def?: number;
    turn?: number;
    name?: string | null;
}

/** 이벤트 outcome 상태이상 지정자. */
interface OutcomeStatus {
    id?: string;
    turns?: number;
}

/** 이벤트 outcome 유물 보상 지정자. */
interface OutcomeRelic {
    count?: number;
}
import {
    STRUCTURED_FALLBACK_TRANSACTIONS,
    getStructuredFallbackTransaction,
} from '../../data/structuredFallbackEvents';

export const createEventActions = (deps: GameActionDeps, shared: TitleSharedHelpers) => {
    const { emitUnlockedTitles } = shared;
    const { player, currentEvent, dispatch, addLog, getFullStats } = deps;
    const rng = typeof deps.rng === 'function' ? deps.rng : Math.random;
    return {
        handleEventChoice: (idx: number) => {
            if (!currentEvent) return;

            if (currentEvent.isBoundedEncounter) {
                const outcome = eventOutcomes(currentEvent)[idx];
                if (!outcome) return;
                dispatch({
                    type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
                    payload: {
                        encounterId: currentEvent.boundedEncounterId,
                        choiceId: outcome.choiceId,
                        expeditionId: player.activeExpedition?.id,
                        occurrenceSequence: currentEvent.boundedOccurrenceSequence,
                    },
                });
                return;
            }

            // 스카우팅 카드 처리 — 같은 탐험 턴 안에서 즉시 해소 (탐험의 나머지 롤 파이프 재호출).
            if (currentEvent.isScout) {
                handleScoutChoice(idx, currentEvent, { ...deps, rng });
                return;
            }

            // 원정 보스 접근 게이지 만충 카드 처리 — 도전/회피 즉시 해소.
            if (currentEvent.isBossGaugeChallenge) {
                handleBossGaugeChoice(idx, currentEvent, { ...deps, rng });
                return;
            }

            const isChainEvent = Boolean(currentEvent._chainId);
            const selectedOutcome: EventOutcome | null = isChainEvent
                ? (eventOutcomes(currentEvent)[idx] || null)
                : (eventOutcomes(currentEvent).find((o) => o.choiceIndex === idx) || null);
            if (isChainEvent && selectedOutcome?.type === 'nothing') {
                dispatch({ type: AT.DEFER_CHAIN_EVENT, payload: {
                    chainId: currentEvent._chainId, step: currentEvent._chainStep, choiceIndex: idx,
                    expectedExploreCount: player.stats?.explores ?? 0,
                } });
                return;
            }
            const reservedFallback = currentEvent.source === 'fallback'
                ? STRUCTURED_FALLBACK_TRANSACTIONS.find((entry) => entry.event.desc === currentEvent.desc) || null
                : null;
            if (reservedFallback) {
                const transaction = getStructuredFallbackTransaction(currentEvent.fallbackTransactionId);
                if (!transaction || transaction.id !== reservedFallback.id) return;
                if (idx === transaction.choiceIndex) {
                    dispatch({
                        type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
                        payload: {
                            transactionId: transaction.id,
                            choiceIndex: idx,
                        },
                    });
                    return;
                }
            }
            if (isChainEvent
                && selectedOutcome?.reward?.type === 'gold'
                && (selectedOutcome.reward.amount ?? 0) < 0) {
                dispatch({
                    type: AT.RESOLVE_CHAIN_GOLD_CHOICE,
                    payload: {
                        chainId: currentEvent._chainId,
                        step: currentEvent._chainStep,
                        choiceIndex: idx,
                    },
                });
                return;
            }
            if (selectedOutcome?.item && !findItemByName(selectedOutcome.item)) {
                addLog('error', MSG.EVENT_REWARD_UNAVAILABLE);
                return;
            }
            const roll = rng();
            let updatedPlayer = player;
            const fullStats = getFullStats();

            // 체인 이벤트 outcome 처리
            if (isChainEvent && selectedOutcome) {
                const outcome = selectedOutcome;
                addLog('event', formatEventText(outcome.log || ''));
                const rwd = outcome.reward;
                if (rwd) {
                    if (rwd.type === 'gold' && rwd.amount) {
                        updatedPlayer = grantGold(updatedPlayer, rwd.amount);
                    }
                    // cycle 178: 'info' reward type 핸들러 추가 — eventChains의 ancient_prophecy
                    // chain에 정의됐으나 처리 분기 누락이라 reward.text 정보가 silent 누락이던 회귀.
                    // 단순히 reward.text를 system log로 출력 (인벤/스탯 변경 없음).
                    if (rwd.type === 'info' && rwd.text) {
                        addLog('system', formatEventText(rwd.text));
                    }
                    if (rwd.type === 'item' && rwd.name) {
                        updatedPlayer = addItemByName(updatedPlayer, rwd.name);
                    }
                    // cycle 139: 'legendary_item' reward 타입 핸들러 추가 — eventChains.ts의
                    // lost_wizard chain에 정의됐으나 처리 분기 누락이라 보상이 silently 누락
                    // 되던 회귀 fix. 'item'과 동일하게 addItemByName 호출 + LOOT_GET 로그.
                    if (rwd.type === 'legendary_item' && rwd.name) {
                        const before = updatedPlayer.inv?.length || 0;
                        updatedPlayer = addItemByName(updatedPlayer, rwd.name);
                        const after = updatedPlayer.inv?.length || 0;
                        if (after > before) {
                            addLog('success', MSG.LOOT_GET(rwd.name));
                        }
                    }
                    if (rwd.type === 'relic') {
                        // 2026-09 감사 G8: pool은 "아직 보유하지 않은 유물"이어야 하고,
                        //   owned를 넘겨야 시너지 소프트 pity가 체인 보상에도 적용된다.
                        //   (기존에는 보유 유물 자체를 pool로 넘겨 중복만 뽑히고 pity도 미적용)
                        const ownedRelics = updatedPlayer.relics || [];
                        const availableRelics = RELICS.filter(
                            (r) => !ownedRelics.some((pr) => pr.id === r.id),
                        );
                        // Wave 4 O2: 체인 보상도 현재 빌드 아키타입에 공명시킨다 (pity 우선은 유지).
                        const pickedRelics = pickWeightedRelics(availableRelics, 1, {
                            owned: ownedRelics,
                            rng,
                            buildId: fullStats?.buildProfile?.primary?.id,
                        });
                        if (pickedRelics.length > 0) {
                            updatedPlayer = { ...updatedPlayer, relics: [...(updatedPlayer.relics || []), pickedRelics[0]] };
                            addLog('success', MSG.CHAIN_REWARD_RELIC(pickedRelics[0].name!));
                        }
                    }
                    if (rwd.type === 'combat_bonus') {
                        updatedPlayer = { ...updatedPlayer, tempBuff: { atk: (rwd.atkMult || 1.3) - 1, def: 0, turn: rwd.duration || 5, name: MSG.CHAIN_REWARD_COMBAT_BONUS_NAME } };
                        addLog('success', MSG.CHAIN_REWARD_COMBAT_BONUS(Math.round(((rwd.atkMult || 1.3) - 1) * 100), rwd.duration || 5));
                    }
                    // cycle 62: stat_bonus는 영구 ATK/DEF/HP 가산 — 기존 chain(rift_secret)에서
                    // 사용 중이지만 핸들러가 없어 silently 무시되던 보상을 정상화.
                    if (rwd.type === 'stat_bonus') {
                        const next: Player = { ...updatedPlayer };
                        if (rwd.atk) next.atk = (next.atk || 0) + rwd.atk;
                        if (rwd.def) next.def = (next.def || 0) + rwd.def;
                        if (rwd.hp) {
                            const nextMaxHp: number = (next.maxHp || 0) + rwd.hp;
                            next.maxHp = nextMaxHp;
                            next.hp = Math.min(nextMaxHp, (next.hp || 0) + rwd.hp);
                        }
                        if (rwd.mp) {
                            const nextMaxMp: number = (next.maxMp || 0) + rwd.mp;
                            next.maxMp = nextMaxMp;
                            next.mp = Math.min(nextMaxMp, (next.mp || 0) + rwd.mp);
                        }
                        updatedPlayer = next;
                        // I4 (2026-09 Wave 3): 하드코딩 한국어 → MSG 단일 원천 (출력 문구는 동일).
                        const statLabels = MSG.CHAIN_REWARD_STAT_LABEL;
                        const parts = (['atk', 'def', 'hp', 'mp'] as const)
                            .filter((key) => rwd[key])
                            .map((key) => `${statLabels[key]} +${rwd[key]}`)
                            .join(' · ');
                        addLog('success', MSG.CHAIN_REWARD_STAT_BONUS(parts));
                    }
                }
                dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
                if (outcome.type === 'chain_advance') {
                    const nextStep = (currentEvent._chainStep ?? 0) + 1;
                    dispatch({ type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: currentEvent._chainId, step: nextStep } });
                }
                if (outcome.type === 'chain_advance_fail') {
                    dispatch({ type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: currentEvent._chainId, step: 'failed' } });
                }
                dispatch({ type: AT.SET_EVENT, payload: null });
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                return;
            }

            // 일반 이벤트 outcome 처리
            let resultText = '';
            if (selectedOutcome) {
                if (selectedOutcome.gold) updatedPlayer = grantGold(updatedPlayer, selectedOutcome.gold);
                if (selectedOutcome.exp) {
                    const expResult = CombatEngine.applyExpGain(
                        updatedPlayer,
                        scaleProgressionExpReward(updatedPlayer, selectedOutcome.exp),
                    );
                    updatedPlayer = expResult.updatedPlayer;
                    expResult.logs.forEach((log: { type: string; text: string }) => addLog(log.type, log.text));
                    if (expResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: expResult.visualEffect });
                }
                if (selectedOutcome.hp) {
                    updatedPlayer = { ...updatedPlayer, hp: Math.max(1, Math.min(fullStats.maxHp, updatedPlayer.hp! + selectedOutcome.hp)) };
                }
                if (selectedOutcome.mp) {
                    updatedPlayer = { ...updatedPlayer, mp: Math.max(0, Math.min(fullStats.maxMp, updatedPlayer.mp! + selectedOutcome.mp)) };
                }
                if (selectedOutcome.item) updatedPlayer = addItemByName(updatedPlayer, selectedOutcome.item);
                // 캠프파이어 "단련" 등 — 다음 전투용 tempBuff 부여 (combatItem 물약과 동일 패턴).
                //   turn-based라 전투 전까지 유지되며 다음 전투에서 소모된다.
                //   2026-09 Wave 3 I1: 이벤트 outcome이 보내는 { atkMult/defMult/turns } 배율
                //   스키마도 같은 tempBuff로 환산한다(캠프파이어의 { atk, def, turn, name }는 불변).
                if (selectedOutcome.buff) {
                    updatedPlayer = applyOutcomeBuff(updatedPlayer, selectedOutcome.buff, addLog);
                }
                // 상태이상 — 기상 이변(exploreFlow)과 동일하게 id 문자열만 중복 없이 누적한다.
                if (selectedOutcome.status) {
                    updatedPlayer = applyOutcomeStatus(updatedPlayer, selectedOutcome.status, addLog);
                }
                resultText = formatEventText(selectedOutcome.log || MSG.EVENT_RESULT_DEFAULT);
                addLog('event', resultText);
            } else if (roll > 0.4) {
                const rewardGold = player.level! * 50;
                updatedPlayer = grantGold(updatedPlayer, rewardGold);
                resultText = MSG.EVENT_SUCCESS_GOLD(rewardGold);
                addLog('success', resultText);
            } else {
                const dmg = Math.floor(Math.max(1, updatedPlayer.maxHp!) * 0.1);
                updatedPlayer = { ...updatedPlayer, hp: Math.max(1, updatedPlayer.hp! - dmg) };
                resultText = MSG.EVENT_FAIL_DAMAGE(dmg);
                addLog('error', resultText);
            }

            const levelQuestSync = CombatEngine.updateQuestProgress(updatedPlayer, '');
            updatedPlayer = { ...updatedPlayer, quests: levelQuestSync.updatedQuests };

            // cycle 439: history record timestamp 출력 dead 제거 — aiEventUtils
            //   summarizeHistory / getRecentEventSet은 event / choice / outcome만 read.
            //   timestamp 필드 어디로도 흐르지 않는 dead (cycle 333-356 시리즈 회귀).
            const newHistory = [
                ...(updatedPlayer.history || []),
                { event: currentEvent.desc, choice: currentEvent.choices?.[idx], outcome: resultText }
            ].slice(-50);
            updatedPlayer = { ...updatedPlayer, history: newHistory };

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            dispatch({ type: AT.SET_EVENT, payload: null });

            // 2026-09 Wave 3 I1: 유물 선택지를 먼저 큐잉하고 전투는 맨 마지막에 연다.
            //   순서를 뒤집으면 전투 전이가 나머지 보상 dispatch를 삼킨다.
            if (selectedOutcome?.relic) {
                queueOutcomeRelics(updatedPlayer, selectedOutcome.relic, {
                    dispatch, addLog, rng, buildId: fullStats?.buildProfile?.primary?.id,
                });
            }

            if (selectedOutcome?.elite) {
                startEliteEncounter(updatedPlayer, { dispatch, addLog, getFullStats, rng });
                return;
            }

            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        },
    };
};

/**
 * 이벤트 outcome 버프 → tempBuff 환산 (2026-09 Wave 3 I1).
 * - 신규 배율 스키마 { atkMult?, defMult?, turns }: aiEventUtils가 BALANCE 상한으로 잘라 보낸다.
 * - 기존 캠프파이어 스키마 { atk, def, turn, name }: 그대로 spread (동작 불변).
 */
const applyOutcomeBuff = (player: Player, buff: OutcomeBuff, addLog: AddLog) => {
    const isMultSchema = buff.atkMult !== undefined || buff.defMult !== undefined || buff.turns !== undefined;
    if (!isMultSchema) {
        return { ...player, tempBuff: { atk: 0, def: 0, turn: 0, name: null, ...buff } };
    }
    const atk = Math.max(0, (Number(buff.atkMult) || 1) - 1);
    const def = Math.max(0, (Number(buff.defMult) || 1) - 1);
    const turn = Math.max(0, Number(buff.turns) || 0);
    if (turn <= 0 || (atk <= 0 && def <= 0)) return player;
    addLog('success', MSG.EVENT_BUFF_APPLIED(Math.round(atk * 100), Math.round(def * 100), turn));
    return { ...player, tempBuff: { atk, def, turn, name: MSG.EVENT_BUFF_NAME } };
};

/**
 * 이벤트 outcome 상태이상 적용 (2026-09 Wave 3 I1).
 * exploreFlow의 기상 이변 경로와 같은 표현(문자열 id 중복 없는 누적)을 쓴다.
 * 화이트리스트는 aiEventUtils에서 이미 통과했지만, dispatch 직전에 한 번 더 확인한다.
 */
/** BALANCE.EVENT_STATUS_IDS(= StatusId 화이트리스트) 통과 여부를 타입으로 옮긴다. */
const isEventStatusId = (value: string): value is StatusId => BALANCE.EVENT_STATUS_IDS.some((id) => id === value);

const applyOutcomeStatus = (player: Player, status: OutcomeStatus, addLog: AddLog): Player => {
    const id = String(status?.id || '');
    if (!isEventStatusId(id)) return player;
    const turns = Math.max(1, Number(status?.turns) || 1);
    addLog('warning', MSG.EVENT_STATUS_APPLIED(id, turns));
    // H1 연동: 전투 중 tickPlayerStatusDurations가 읽는 statusTurns에 지속 턴을 기록한다.
    //   이미 같은 상태가 더 길게 남아 있으면 줄이지 않는다(중첩 부여는 연장만 한다).
    const prevTurns = (player.statusTurns || {}) as Record<string, number>;
    const statusTurns = { ...prevTurns, [id]: Math.max(prevTurns[id] || 0, turns) };
    return { ...player, status: [...new Set([...(player.status || []), id])], statusTurns };
};

/**
 * 이벤트 outcome 유물 선택지 큐잉 (2026-09 Wave 3 I1).
 * 체인 보상(위 handleEventChoice)과 같은 pickWeightedRelics(available, n, { owned, rng }) 경로를
 * 그대로 쓰고, 보유 한도를 넘는 경우에는 조용히 건너뛴다(탐험 중 유물 발견과 동일 규칙).
 */
const queueOutcomeRelics = (
    player: Player,
    relic: OutcomeRelic,
    { dispatch, addLog, rng, buildId }: Pick<GameActionDeps, 'dispatch' | 'addLog'> & {
        rng: () => number;
        buildId?: string;
    },
) => {
    const ownedRelics = player.relics || [];
    if (ownedRelics.length >= getPrestigeUnlocks(player.meta?.prestigeRank).maxRelics) return;
    const count = Math.max(1, Math.min(BALANCE.EVENT_RELIC_MAX_COUNT, Number(relic?.count) || 1));
    const available = RELICS.filter((r) => !ownedRelics.some((pr) => pr.id === r.id));
    if (available.length === 0) return;
    // Wave 4 O2: 이벤트 outcome 유물 3택도 체인 보상과 같은 빌드 공명 규칙을 쓴다.
    const candidates = pickWeightedRelics(available, count, { owned: ownedRelics, rng, buildId });
    if (candidates.length === 0) return;
    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
    addLog('event', MSG.EVENT_RELIC_CHOICE(candidates.length));
};

/**
 * 정예 조우 스탯 — 정찰 "정예의 흔적" 카드와 동일한 산출(신규 스폰 로직 없음).
 * 확정 유물 보상(scoutGuaranteedRelic)은 "골라서 들어간" 정찰 카드에만 붙인다.
 */
const buildEliteStats = (rawStats: SpawnedEnemyStats, baseName: string) => ({
    ...rawStats,
    name: rawStats.name?.startsWith(MSG.ELITE_ENEMY_PREFIX) ? rawStats.name : MSG.ELITE_ENEMY_NAME(baseName),
    baseName,
    isElite: true,
    hp: Math.floor(rawStats.hp * BALANCE.SCOUT_ELITE_HP_MULT),
    maxHp: Math.floor(rawStats.maxHp * BALANCE.SCOUT_ELITE_HP_MULT),
    atk: Math.floor(rawStats.atk * BALANCE.SCOUT_ELITE_HP_MULT),
});

/**
 * 이벤트 outcome의 정예 조우 (2026-09 Wave 3 I1).
 * 정찰 elite 카드 / 보스 게이지 도전과 동일한 파이프(spawnEnemy → applyBattleStartRelics →
 * SET_ENEMY → GS.COMBAT)를 재사용한다. 탐험 카운터는 이벤트가 열릴 때 이미 커밋됐으므로
 * commitExploreOutcome은 호출하지 않는다(중복 누적 방지).
 */
const startEliteEncounter = (
    player: Player,
    { dispatch, addLog, getFullStats, rng }: Pick<GameActionDeps, 'dispatch' | 'addLog' | 'getFullStats'> & {
        rng: () => number;
    },
) => {
    const mapData = DB.MAPS[player.loc!];
    if (!mapData) {
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }
    const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, player.relics || [], { addLog }, { rng });
    const fullStats = getFullStats();
    dispatch({
        type: AT.SET_PLAYER,
        payload: (p: Player) => applyBattleStartRelics(p, p.relics || [], fullStats, { addLog, rng }),
    });
    const mStats = buildEliteStats(rawStats, baseName);
    dispatch({ type: AT.SET_ENEMY, payload: mStats });
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    addLog('warning', MSG.EVENT_ELITE_AMBUSH);
    addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
};

/**
 * 스카우팅 카드 선택 처리 — 카드 4종(combat/anomaly/unknown/elite)을 같은 탐험 턴 안에서
 * 즉시 해소한다. 기존 파이프 함수들(exploreUtils.spawnEnemy / exploreFlow의 rollExplorationEvent/
 * applyBattleStartRelics/runQuietRollAndCombat)을 재호출/재배치하는 방식 — 신규 스폰
 * 로직을 만들지 않는다.
 */
const handleScoutChoice = (idx: number, currentEvent: GameState['currentEvent'], deps: GameActionDepsWithRng) => {
    const { player, dispatch, addLog, getFullStats, rng = Math.random } = deps;
    const outcome = eventOutcomes(currentEvent).find((o) => o.choiceIndex === idx) || null;
    if (!outcome) {
        dispatch({ type: AT.SET_EVENT, payload: null });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    addLog('event', outcome.log || '');
    const mapData = DB.MAPS[player.loc!];
    const playerRelics = player.relics || [];

    // 이벤트 패널을 닫고(현재 스카우팅 카드) 아래 분기에서 필요한 다음 상태를 dispatch한다.
    dispatch({ type: AT.SET_EVENT, payload: null });

    // Scout 카드가 열린 시점에 exploreActions.ts가 이미 shared settlement를 완료한다.
    // 선택 해소는 branch effect만 적용하고, 전투 시작 유물 transform만 reducer에 전달한다.
    const dispatchScoutPlayerTransform = (transformPlayer: ((p: Player) => Player) | null) => {
        if (typeof transformPlayer !== 'function') return;
        dispatch({ type: AT.SET_PLAYER, payload: transformPlayer });
    };

    if (outcome.scoutEffect === 'combat' || outcome.scoutEffect === 'elite') {
        const { mStats: rawStats, baseName } = spawnEnemy(
            mapData,
            player,
            playerRelics,
            { addLog },
            { rng },
        );
        const isEliteCard = outcome.scoutEffect === 'elite';
        const mStats = isEliteCard
            ? { ...buildEliteStats(rawStats, baseName), scoutGuaranteedRelic: true }
            : { ...rawStats, scoutRewardBonus: outcome.rewardBonus ?? BALANCE.SCOUT_COMBAT_REWARD_BONUS };

        const fullStats = getFullStats();
        dispatchScoutPlayerTransform((nextPlayer: Player) => applyBattleStartRelics(
            nextPlayer,
            nextPlayer.relics || [],
            fullStats,
            { addLog, rng },
        ));
        dispatch({ type: AT.SET_ENEMY, payload: mStats });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
        addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
        return;
    }

    if (outcome.scoutEffect === 'anomaly') {
        // 관대함 하향 (2026-07 밸런스 감사): "이상 신호"는 전투를 확정 회피하고 quiet 롤만
        //   굴리는 사실상 "안전 버튼"이었다. anomaly(부정 효과) 확률에만 ×1.5를 가중해
        //   위험을 소폭 되돌린다 — 유물/이벤트 확률은 그대로.
        const quietResult = rollExplorationEvent(player, mapData, playerRelics, {
            dispatch,
            addLog,
            getFullStats,
            anomalyMult: BALANCE.SCOUT_SIGNAL_ANOMALY_MULT,
            rng,
        });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        if (quietResult === 'nothing') addLog('info', MSG.EXPLORE_QUIET);
        return;
    }

    // 'unknown' — 짙은 안개: 기존 explore() 롤(quiet 롤 → 유물 보장 → 전투)로 그대로 위임.
    // 같은 탐험 턴 안에서 결과가 나와야 하므로 runQuietRollAndCombat을 즉시 재호출 —
    // "무슨 일이 일어날지 모른다"는 컨셉대로 신규 로직 없이 원래 파이프를 탄다. AI 서사
    // 이벤트 단계는 건너뛴다(이미 스카우팅 카드로 결정 지점을 소비했으므로 즉시 해소 우선).
    // skipBossGaugeAdvance: 이 explore() 턴의 게이지는 스카우팅 카드가 처음 뜬 시점에
    // 이미 1회 누적됐으므로(exploreActions.ts) 여기서 재호출 시 중복 누적 방지.
    const { addStoryLog } = deps;
    const applyScoutTransformOnly: CommitExploreOutcome = (_outcome, transformPlayer) => {
        dispatchScoutPlayerTransform(transformPlayer);
    };
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
    runQuietRollAndCombat(player, mapData, {
        dispatch,
        addLog,
        addStoryLog,
        getFullStats,
        commitExploreOutcome: applyScoutTransformOnly,
        skipBossGaugeAdvance: true,
        rng,
    });
};

/**
 * 원정 보스 접근 게이지 만충 카드("도전 vs 회피") 선택 처리.
 * - 도전: exploreUtils.spawnEnemy를 forceAreaBoss:true로 재호출해 구역 보스를 결정론적으로
 *   스폰(기존 15% 랜덤 스폰과 동일한 스탯 산출 경로 재사용, 신규 스폰 로직 없음) + 게이지 리셋.
 * - 회피: 게이지를 만충 상태로 유지(다음 탐험에서 재선택 가능) — 리셋하지 않는다.
 */
const handleBossGaugeChoice = (idx: number, currentEvent: GameState['currentEvent'], deps: GameActionDepsWithRng) => {
    const { player, dispatch, addLog, getFullStats, rng = Math.random } = deps;
    const outcome = eventOutcomes(currentEvent).find((o) => o.choiceIndex === idx) || null;
    dispatch({ type: AT.SET_EVENT, payload: null });

    if (!outcome) {
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    addLog('event', outcome.log || '');

    if (outcome.gaugeEffect === 'avoid') {
        // 회피 — 게이지는 만충 유지, 다음 탐험에서 다시 선택지가 뜬다.
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    // 도전 — 게이지 리셋 + 구역 보스 결정론적 스폰.
    const mapData = DB.MAPS[player.loc!];
    const playerRelics = player.relics || [];
    const { mStats } = spawnEnemy(
        mapData,
        player,
        playerRelics,
        { addLog },
        { forceAreaBoss: true, rng },
    );

    const fullStats = getFullStats();
    dispatch({
        type: AT.SET_PLAYER,
        payload: (p: Player) => {
            const nextPlayer = { ...p, stats: resetBossGaugeAfterChallenge(p, p.loc!) };
            return applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog, rng });
        },
    });
    dispatch({ type: AT.SET_ENEMY, payload: mStats });
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
};
