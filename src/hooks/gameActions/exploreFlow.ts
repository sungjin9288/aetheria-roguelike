/**
 * exploreFlow.ts — 탐험 파이프의 dispatch 소비(부수효과) 구간.
 *
 * Wave 4 N1: `utils/exploreUtils.ts`에 섞여 있던 dispatch/addLog 주입 함수 6개를
 * 그대로(같은 이름·시그니처·본문) 이곳으로 옮겼다. `utils/exploreUtils.ts`는
 * 이제 reducer 계층을 import하지 않는 순수 모듈(selectEncounterMonster / spawnEnemy /
 * getFirstVisitReward)로 남는다 — 계층 역전 해소.
 *
 * AI_SERVICE(firebase 의존)는 여전히 참조하지 않는다. eventActions.ts / exploreActions.ts
 * 양쪽이 같은 파이프를 공유하면서도 firebase import 체인 없이 단위 테스트할 수 있어야 하기
 * 때문(campfire-node.test.js와 동일한 제약).
 *
 * 이동 전/후 동치는 tests/explore-flow-equivalence.test.js가 시드 고정 트레이스로 고정한다.
 */
import type { FullStats, GameMap, Relic } from '../../types/index.js';
import type { Player, StatusId } from '../../types/index.js';
import type { Dispatch } from 'react';
import type { GameAction } from '../../reducers/gameReducer.js';
import type { AddLog, AddStoryLog, GameActionDeps } from '../actionDeps.js';
import type { CommitExploreOutcome } from './_shared.js';

/** 탐험 롤 계열이 공유하는 주입 조각 — 엔진 deps를 그대로 넘겨도 맞는다. */
type ExploreRollDeps = Pick<GameActionDeps, 'dispatch' | 'addLog' | 'getFullStats'> & {
    /** 부정 효과(아노말리) 확률 가중 — 정찰 "이상 신호" 카드만 1 이외의 값을 넘긴다. */
    anomalyMult?: number;
    rng?: () => number;
};

import { DB } from '../../data/db.js';
import { BALANCE } from '../../data/constants.js';
import { RELICS, isRelicReplacementUpgrade, pickWeightedRelics, relicNumber } from '../../data/relics.js';
import { applyEssenceGain, getEssenceGainFromExp } from '../../systems/essenceLedger.js';
import { getEssenceRewardMult } from '../../systems/essenceRewardMult.js';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { AT } from '../../reducers/actionTypes.js';
import { GS } from '../../reducers/gameStates.js';
import { MSG } from '../../data/messages.js';
import { getDiscoveryOdds } from '../../utils/explorationPacing.js';
import { findItemByName, grantGold } from '../../utils/gameUtils.js';
import { getGoldIncome } from '../../utils/challengeRules.js';
import { withCanonicalEquipmentBaseIdentity } from '../../utils/equipmentBaseIdentity.js';
import { applyDynamicDifficulty } from '../../systems/DifficultyManager';
import { CombatEngine } from '../../systems/CombatEngine';
import { scaleProgressionExpReward } from '../../data/progressionProfiles';
import { getBossSignatureDrops } from '../../utils/bossSignatureHint';
import { getSignaturePityMultiplier } from '../../utils/signaturePity';
import { resolveAbyssDailyDive } from '../../utils/abyssDailyDive';
import { activateDevourBonus } from '../../utils/adventureRelicBonuses.js';
import { endCombatScope } from '../../utils/combatScope.js';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals.js';
import { borrowChaosHeartRelic, isBorrowedRelic } from '../../systems/chaosHeart.js';
import { formatSynergyDrawback } from '../../utils/relicSynergyHint.js';
import { calculateFullStats } from '../../utils/statsCalculator.js';
import { applyTempBuffRule } from '../../systems/tempBuffMerge.js';
import { spawnEnemy } from '../../utils/exploreUtils.js';
import { applyHuntChampion, getHuntChampionReadiness } from '../../utils/huntContracts.js';
import { getHuntContract } from '../../data/huntContracts.js';
import {
    createDailyProtocol,
    getCurrentWeeklyProtocol,
    getProtocolDayKey,
} from '../../utils/protocolCycle';


// explorationPacing.ts의 clamp와 동일 구현 (해당 모듈은 export하지 않음) — 소규모 순수
// 헬퍼는 모듈 간 공유보다 지역 복제가 이 코드베이스의 기존 관례(pacing/aiEventUtils 등).
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ─────────────────────────────────────────────────────────────────────────
// 0.5. 주간 프로토콜 리셋
// ─────────────────────────────────────────────────────────────────────────
export const resetWeeklyProtocolIfNeeded = (player: Player, dispatch: Dispatch<GameAction>) => {
    const weeklyProtocol = getCurrentWeeklyProtocol(player.weeklyProtocol, new Date());
    if (player.weeklyProtocol?.lastResetWeek !== weeklyProtocol.lastResetWeek) {
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: Player) => ({
                ...p,
                weeklyProtocol,
            }),
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. 일일 프로토콜 리셋 & 카운트 업 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const resetDailyProtocolIfNeeded = (player: Player, dispatch: Dispatch<GameAction>) => {
    const today = getProtocolDayKey(new Date());
    const dp = player.stats?.dailyProtocol;
    if (!dp || dp.date !== today) {
        dispatch({ type: AT.SET_DAILY_PROTOCOL, payload: createDailyProtocol(player, new Date()) });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// 1.5 칸이 찬 탐험 유물 발견 — 2026-10 Wave 79 (소유자 결정 원장 §82.4 b)
//   칸이 찼고 교체로 나아질 카드(`isRelicReplacementUpgrade`)가 하나도 없으면 선택 화면 대신 '유물의 잔향'을 준다 —
//   같은 레벨 적 한 마리를 처치한 만큼의 계승 정수(처치 정수와 같은 공식 · 같은 배율). Wave 78 측정에서 칸이 찬 제안의
//   약 97%가 이 경우였고(보유 유물이 조합 2 ~ 4개로 묶여 있다), 플레이어는 고를 이유가 없는 화면을 시간당 약 1.8번 넘겼다.
//   후보를 뽑지 않으므로 이 경우에는 후보 추첨 난수를 쓰지 않는다. 나아질 카드가 있으면 이전과 같이 교체 제안이다.
// ─────────────────────────────────────────────────────────────────────────
const hasRelicReplacementUpgrade = (available: Relic[], owned: Relic[]) => (
    available.some((relic) => isRelicReplacementUpgrade(relic, owned))
);

export const getRelicEchoEssence = (player: Player): number => {
    const level = Math.max(1, Number(player.level) || 1);
    return getEssenceGainFromExp(
        BALANCE.RELIC_ECHO_EXP_BASE + level * BALANCE.RELIC_ECHO_EXP_PER_LEVEL,
        getEssenceRewardMult(player.meta),
    );
};

const grantRelicEcho = (player: Player, { dispatch, addLog }: { dispatch: Dispatch<GameAction>; addLog: AddLog }) => {
    const essence = getRelicEchoEssence(player);
    const preview = applyEssenceGain(player.meta || {}, essence);
    dispatch({
        type: AT.SET_PLAYER,
        payload: (p: Player): Player => ({ ...p, meta: applyEssenceGain(p.meta || {}, essence).meta }),
    });
    addLog('event', MSG.EXPLORE_RELIC_ECHO(essence));
    if (preview.rankGain > 0) addLog('system', MSG.LEGACY_RANK(preview.meta.rank));
};

// ─────────────────────────────────────────────────────────────────────────
// 2. 탐색 이벤트 롤 — 아노말리, 열쇠 이벤트, 유물 발견 처리 (Phase 1-B)
// 반환값: 'event_triggered' | 'relic_found' | 'anomaly' | 'nothing' | null (계속 진행)
// ─────────────────────────────────────────────────────────────────────────
// 관대함 하향 (2026-07 밸런스 감사): deps.anomalyMult(기본 1 = 무변경)로 anomalyChance에
//   곱연산 가중을 줄 수 있다. 스카우팅 "이상 신호" 카드(eventActions.ts handleScoutChoice)가
//   BALANCE.SCOUT_SIGNAL_ANOMALY_MULT(1.5)를 전달 — 전투를 회피하는 "안전 버튼"이 부정
//   효과(중독/화상) 확률까지 낮춰주지는 않도록 재조정. 일반 탐험 quiet 롤
//   (runQuietRollAndCombat)은 anomalyMult 미전달 → 기존 확률 분포 완전 불변.
export const rollExplorationEvent = (
    player: Player,
    mapData: GameMap,
    playerRelics: Relic[],
    { dispatch, addLog, getFullStats, anomalyMult, rng = Math.random }: ExploreRollDeps,
) => {
    const discoveryOdds = getDiscoveryOdds(player, mapData);
    const hasKey = (player.inv || []).some((i) => i.name === '잊혀진 열쇠');
    if (hasKey && (typeof mapData.level === 'number' && mapData.level >= 10) && rng() < discoveryOdds.keyEventChance) {
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: Player) => {
                const keyIdx = p.inv!.findIndex((i) => i.name === '잊혀진 열쇠');
                const newInv = [...p.inv!];
                if (keyIdx > -1) newInv.splice(keyIdx, 1);
                return { ...p, inv: newInv, loc: '고대 보물고' };
            }
        });
        addLog('event', MSG.EXPLORE_KEY_EVENT);
        return 'key_event';
    }

    const effectiveAnomalyChance = clamp(
        discoveryOdds.anomalyChance * (anomalyMult ?? 1),
        0,
        BALANCE.ANOMALY_MAX_CHANCE
    );
    if (rng() < effectiveAnomalyChance && player.loc !== '고대 보물고') {
        // W2 (Wave 5): effect를 StatusId | 'mana_regen'으로 닫아 두면 아래 else 분기에서
        //   TS가 'mana_regen'을 제외한 StatusId로 좁혀 주고, 오타는 컴파일 에러가 된다.
        const anomalies: Array<{ effect: StatusId | 'mana_regen'; desc: string }> = [
            { effect: 'poison',     desc: MSG.EXPLORE_ANOMALY_POISON },
            { effect: 'mana_regen', desc: MSG.EXPLORE_ANOMALY_MANA_REGEN },
            { effect: 'burn',       desc: MSG.EXPLORE_ANOMALY_BURN }
        ];
        const anomaly = anomalies[Math.floor(rng() * anomalies.length)];
        addLog('warning', MSG.EXPLORE_ANOMALY(anomaly.desc));
        if (anomaly.effect === 'mana_regen') {
            const stats = getFullStats();
            dispatch({ type: AT.SET_PLAYER, payload: (p: Player) => ({ ...p, mp: Math.min(stats.maxMp, p.mp! + Math.floor(stats.maxMp * BALANCE.ANOMALY_MANA_REGEN_RATIO)) }) });
        } else {
            // 2026-10 Wave 56: 고대의 봉인이 탐험 이상 현상의 상태 이상도 막는다. 유물이 없으면 난수를 쓰지 않는다.
            const resistRelic = playerRelics.find((r) => r.effect === 'status_resist');
            if (resistRelic && rng() < (resistRelic.val || 0)) {
                addLog('success', MSG.ANCIENT_SEAL_RESIST);
                return 'anomaly';
            }
            const anomalyStatus: StatusId = anomaly.effect;
            dispatch({ type: AT.SET_PLAYER, payload: (p: Player): Player => ({ ...p, status: [...new Set([...(p.status || []), anomalyStatus])] }) });
        }
        return 'anomaly';
    }

    // 유물 발견 — PR #8: 프레스티지 rank≥2면 보유 한도 +1(6) · 선택지 4지선다.
    //   2026-10 Wave 77(소유자 결정 1a): 유물 칸이 가득 차도 같은 확률로 굴리고 교체 제안으로 보인다 — 선택 화면이
    //   교체 · 넘기기를 준다(`REPLACE_RELIC` · `DECLINE_RELIC`). 칸이 찬 뒤 추첨을 멈추던 동안 회차의 약 96%(중앙값
    //   Lv9 · 2.5h 이후)에서 유물 선택이 시간당 0.19번이었다(원장 §80.3).
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (rng() < discoveryOdds.relicChance) {
        const available = RELICS.filter((r) => !playerRelics.some((pr) => pr.id === r.id));
        if (available.length > 0) {
            const atCapacity = playerRelics.length >= relicUnlocks.maxRelics;
            if (atCapacity && !hasRelicReplacementUpgrade(available, playerRelics)) {
                grantRelicEcho(player, { dispatch, addLog });
                return 'relic_found';
            }
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, {
                owned: playerRelics, rng, replacing: atCapacity ? playerRelics : undefined,
            });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', atCapacity
                ? MSG.EXPLORE_RELIC_REPLACE_OFFER
                : MSG.EXPLORE_RELIC_DISCOVERED);
            return 'relic_found';
        }
    }

    return 'nothing';
};

// ─────────────────────────────────────────────────────────────────────────
// 4. 전투 시작 유물 효과 적용 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const applyBattleStartRelics = (
    player: Player,
    playerRelics: Relic[],
    fullStats: FullStats,
    { addLog, rng = Math.random }: { addLog: AddLog; rng?: () => number },
): Player => {
    // 2026-10 Wave 57: 끝나지 않은 채 남은 전투 한정 유물 효과(빌린 유물 · 혼돈의 보석)를 먼저 걷어 낸다.
    //   Wave 66: 기술 재사용 대기도 여기서 새로 시작한다(이전 세이브에 남은 대기 포함).
    let activatedPlayer = activateDevourBonus(endCombatScope(player));
    playerRelics = playerRelics.filter((relic) => !isBorrowedRelic(relic));
    // 2026-10 Wave 57: 혼돈의 심장 — 가지지 않은 유물 하나를 이번 전투 동안 빌린다. 다른 전투 시작 효과보다 먼저 빌려서
    //   빌린 유물의 전투 시작 효과 · 그림자 망토 · 조합(대가 포함)이 이 전투에 그대로 걸린다(소유자 결정 "조합까지 켜지게").
    const borrow = borrowChaosHeartRelic(playerRelics, rng);
    if (borrow.relic) {
        playerRelics = [...playerRelics, borrow.relic];
        // 빌린 유물은 빌드 성향을 바꿔 실효 최대치를 낮출 수 있다(예: 무당 + 마나 수정이 허공의 파편을 빌리면 기력 197 → 187) —
        //   최대치를 낮추는 전이라 현재치를 실효 최대로 내린다(Wave 27 N2 규칙, 올리지는 않는다).
        activatedPlayer = clampVitalsToEffectiveMax({
            ...activatedPlayer,
            relics: [...(activatedPlayer.relics || []).filter((relic) => !isBorrowedRelic(relic)), borrow.relic],
        });
        addLog('event', MSG.CHAOS_HEART_BORROW(borrow.relic.name ?? '', borrow.relic.desc ?? ''));
        borrow.completedSynergies.forEach((synergy) => {
            addLog('event', MSG.CHAOS_HEART_SYNERGY(synergy.label, formatSynergyDrawback(synergy)));
        });
    }
    if (activatedPlayer !== player) fullStats = calculateFullStats(activatedPlayer)!;
    const combatStartPlayer: Player = {
        ...activatedPlayer,
        combatFlags: {
            comboCount: 0,
            deathSaveUsed: false,
            voidHeartUsed: Boolean(player.combatFlags?.voidHeartUsed),
            voidHeartArmed: Boolean(player.combatFlags?.voidHeartArmed),
            // cycle 158: 'phoenix_revive' (cycle 157) — 부활 1회는 매 전투마다 새로 사용 가능.
            phoenixUsed: false,
            // cycle 159: 'entropy_tick' / 'entropy_brand' — turnCount는 매 전투 시작 시 0으로 리셋.
            turnCount: 0,
            // cycle 163: 'cooldown_reduce.firstFree' (시간 군주의 왕관) — 매 전투 첫 스킬 무료 가능.
            firstSkillUsed: false,
            // 2026-10 Wave 56: 그림자 망토 — 이번 전투에서 처음 받는 적 공격을 반드시 피한다.
            ...(playerRelics.some((r) => r.effect === 'first_turn_evade') ? { cloakEvadePending: true } : {}),
        }
    };

    // cycle 158: 'battle_start_buff' (전쟁의 북) — 전투 시작 시 ATK +val.atk (val.turns 턴).
    //   tempBuff.atk는 multiplier (1 + atk) 로 statsCalculator에서 적용.
    // Wave 62 C6: 강화 칸 규칙(더 센 쪽 유지) — 전투 전에 마신 물약 · 모닥불 단련이 더 세면 그것을 남기고 알린다
    //   (이전에는 전쟁의 북이 전투 시작에 덮어써 +30% · 5턴이 +20% · 2턴이 됐다).
    const startBuffRelic = playerRelics.find((r) => r.effect === 'battle_start_buff');
    if (startBuffRelic) {
        const atkBonus = startBuffRelic.val?.atk || 0;
        const turns = startBuffRelic.val?.turns || 1;
        const drum = applyTempBuffRule(combatStartPlayer, {
            atk: atkBonus,
            def: 0,
            turn: turns,
            name: 'battle_start_buff',
        }, MSG.WAR_DRUM_BUFF_LABEL);
        combatStartPlayer.tempBuff = drum.player.tempBuff;
        if (drum.applied) addLog('event', MSG.WAR_DRUM_BUFF_LOG(Math.round(atkBonus * 100), turns));
        else if (drum.notice) addLog('info', drum.notice);
    }

    const startHealRelic = playerRelics.find((r) => r.effect === 'battle_start_heal');
    if (startHealRelic) {
        const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * startHealRelic.val));
        combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp!, (combatStartPlayer.hp || 0) + heal);
        addLog('heal', `[재생 코어] 전투 시작 회복 +${heal} HP`);
    }

    const cursedPowerRelic = playerRelics.find((r) => r.effect === 'cursed_power');
    if (cursedPowerRelic) {
        const selfDamage = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * cursedPowerRelic.val.hp_cost));
        combatStartPlayer.hp = Math.max(1, (combatStartPlayer.hp || 1) - selfDamage);
        addLog('warning', `[저주받은 반지] 전투 시작 대가 -${selfDamage} HP`);
    }

    // 혼돈의 보석 — 2026-10 Wave 57: 고른 능력치가 이번 전투 내내 오른다(전투 플래그 `chaosGemStat`, `statsCalculator`가 더한다).
    //   이전에는 강화 칸(`tempBuff`)에 3턴이었다 — 설명("전투가 시작되면")보다 짧았고 기술 강화가 덮어썼다. 난수는 그대로 한 번이다.
    const chaosBuffRelic = playerRelics.find((r) => r.effect === 'chaos_buff');
    if (chaosBuffRelic) {
        const gemStat = rng() < 0.5 ? 'atk' : 'def';
        combatStartPlayer.combatFlags = { ...combatStartPlayer.combatFlags, chaosGemStat: gemStat };
        addLog('event', MSG.CHAOS_GEM_PROC(gemStat, Math.round(relicNumber(chaosBuffRelic) * 100)));
    }

    return combatStartPlayer;
};

// ─────────────────────────────────────────────────────────────────────────
// 4.2. quiet 롤 → 유물 보장 → 전투 스폰 (AI 이벤트 제외 파이프)
//   exploreActions.ts의 explore()가 AI 이벤트 롤 실패 후 호출하는 나머지 파이프이자,
//   탐험 스카우팅(2026-07) "짙은 안개" 카드가 그대로 재사용하는 공유 지점이다. AI_SERVICE
//   (firebase 의존)를 참조하지 않도록 이 모듈(exploreFlow.ts)에 둔다 — eventActions.ts 단위 테스트가
//   firebase import 체인 없이 이 함수를 로드할 수 있어야 하기 때문 (campfire-node.test.js와
//   동일한 제약).
//   2026-07 — 원정 보스 접근 게이지: commitExploreOutcome에 mapData를 전달해 게이지를
//   누적하지만, "짙은 안개"(스카우팅 unknown 카드) 경로로 재호출될 때는 이미 스카우팅
//   카드가 뜬 시점(같은 explore() 턴)에 게이지가 1회 누적됐으므로 중복 누적을 막기 위해
//   deps.skipBossGaugeAdvance:true를 전달받으면 mapData를 넘기지 않는다.
// ─────────────────────────────────────────────────────────────────────────
export const runQuietRollAndCombat = (
    player: Player,
    mapData: GameMap,
    {
        dispatch, addLog, addStoryLog, getFullStats, commitExploreOutcome,
        skipBossGaugeAdvance, rng = Math.random,
    }: Pick<GameActionDeps, 'dispatch' | 'addLog' | 'getFullStats'> & {
        addStoryLog?: AddStoryLog;
        commitExploreOutcome: CommitExploreOutcome;
        /** 같은 탐험 턴에서 이미 게이지를 누적했으면 true (정찰 "짙은 안개" 재호출). */
        skipBossGaugeAdvance?: boolean;
        rng?: () => number;
    },
) => {
    const playerRelics = player.relics || [];
    const quietChance = getDiscoveryOdds(player, mapData).quietChance;
    const gaugeMapData = skipBossGaugeAdvance ? null : mapData;

    if (rng() < quietChance) {
        const quietResult = rollExplorationEvent(player, mapData, playerRelics, { dispatch, addLog, getFullStats, rng });
        if (quietResult !== 'nothing') {
            commitExploreOutcome(quietResult, null, gaugeMapData);
            return;
        }
        commitExploreOutcome('nothing', null, gaugeMapData);
        addLog('info', MSG.EXPLORE_QUIET);
        return;
    }

    // 전투 직전 유물 발견 기회 — Wave 77: 칸이 가득 차도 굴리고 교체 제안으로 보인다(위 발견과 같은 규칙).
    const firstRelicPity = playerRelics.length === 0
        && (player.stats?.exploreState?.sinceRelic || 0) >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (firstRelicPity || rng() < BALANCE.RELIC_FIND_CHANCE * 0.5) {
        const available = RELICS.filter((r) => !playerRelics.some((pr) => pr.id === r.id));
        if (available.length > 0) {
            commitExploreOutcome('relic_found', null, gaugeMapData);
            const atCapacity = playerRelics.length >= relicUnlocks.maxRelics;
            if (atCapacity && !hasRelicReplacementUpgrade(available, playerRelics)) {
                grantRelicEcho(player, { dispatch, addLog });
                return;
            }
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, {
                owned: playerRelics, rng, replacing: atCapacity ? playerRelics : undefined,
            });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', atCapacity
                ? MSG.EXPLORE_RELIC_REPLACE_OFFER
                : MSG.EXPLORE_RELIC_FOUND);
            return;
        }
    }

    // 몬스터 생성
    const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog }, { rng });
    // 2026-09 Wave 16 H1: 몬스터 테이블이 빈 지역에서는 조우가 없다. 이전에는
    //   `selectEncounterMonster`가 `undefined`를 돌려주고도 실제 스탯의 적이 만들어져
    //   `'undefined 등장!'`로 전투가 시작됐다(safe 4곳에서 터미널 `탐색`으로 도달 가능).
    if (rawStats === null) {
        commitExploreOutcome('nothing', null, skipBossGaugeAdvance ? undefined : mapData);
        addLog('info', MSG.EXPLORE_QUIET);
        return;
    }
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
        if (BALANCE.ABYSS_BOSS_FLOORS.some((bossFloor) => bossFloor === floor)) {
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
                statusOnHit: bossProfile?.statusOnHit,
            };
            addLog('critical', MSG.ABYSS_BOSS_APPEAR(bossName));
        } else if (floor % 5 === 0) {
            addLog('warning', MSG.ABYSS_FLOOR_WARNING(floor));
        }

        // 리텐션 훅 — 심연 데일리 다이브: 하루 첫 ABYSS_DAILY_DIVE_COMBAT_COUNT(5)전투에
        // EXP/골드 배율 적용 (dailyProtocol과 동일한 날짜 문자열 판정 — 탐험마다 리셋 금지,
        // CLAUDE.md §8-4). multiplierActive일 때만 dispatch — 카운트 소진 후에는 상태 변화가
        // 없어 불필요한 SET_PLAYER(및 Firestore autosave 트리거)를 매 전투마다 반복하지 않는다.
        // 안내 로그는 오늘 첫 버프 전투(isFirstOfDay)에 1회만 (5연속 스팸 방지).
        const today = getProtocolDayKey(new Date());
        const { multiplierActive, isFirstOfDay, nextAbyssDailyDive } = resolveAbyssDailyDive(player, today);
        if (multiplierActive) {
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: Player) => ({ ...p, stats: { ...(p.stats || {}), abyssDailyDive: nextAbyssDailyDive } }),
            });
            mStats = {
                ...mStats,
                exp: Math.floor(mStats.exp * BALANCE.ABYSS_DAILY_DIVE_MULT),
                gold: Math.floor(mStats.gold * BALANCE.ABYSS_DAILY_DIVE_MULT),
            };
            if (isFirstOfDay) {
                addLog('event', MSG.ABYSS_DAILY_DIVE_START(BALANCE.ABYSS_DAILY_DIVE_MULT));
            }
        }
    }

    // 2026-10 Wave 80: 지역 토벌 의뢰 2단계 — 그 지역의 다음 일반 개체가 우두머리다(난수 없음).
    const champion = applyHuntChampion(mStats, player, mapData);
    if (champion.huntChampion) {
        mStats = champion;
        addLog('critical', MSG.HUNT_CHAMPION_APPEAR(getHuntContract(champion.huntChampion)?.champion || champion.name, champion.huntChampion));
        // Wave 86: 준비가 부족한 채 맞으면 한 줄 더 알린다(도주 · 물약 판단은 플레이어 몫).
        const readiness = getHuntChampionReadiness(player);
        if (!readiness.ready) addLog('warning', MSG.HUNT_CHAMPION_UNPREPARED(readiness.hpPct, readiness.mpPct));
    }

    const fullStats = getFullStats();
    commitExploreOutcome('combat', (nextPlayer: Player) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog, rng }), gaugeMapData);
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
            const pityMult = getSignaturePityMultiplier(player.stats?.signaturePity);
            if (pityMult > 1) {
                const pct = Math.round((pityMult - 1) * 100);
                addLog('legendary', MSG.SIGNATURE_PITY_RESONANCE(pct, player.stats?.signaturePity));
            }
        }
    }
    if (typeof addStoryLog === 'function') addStoryLog('encounter', { loc: player.loc, name: baseName });
};

// ─────────────────────────────────────────────────────────────────────────
// 4.5. 발견 체인 체크 — 지역 조합 방문 시 보상 (Discovery Chains)
// ─────────────────────────────────────────────────────────────────────────
export const checkDiscoveryChains = (
    player: Player,
    loc: string,
    { dispatch, addLog }: Pick<GameActionDeps, 'dispatch' | 'addLog'>,
) => {
    const chains = BALANCE.DISCOVERY_CHAINS;
    if (!chains) return;
    const visited = new Set([...(player.stats?.visitedMaps || []), loc]);
    const completed = player.stats?.discoveryChains || [];

    chains.forEach((chain) => {
        if (completed.includes(chain.id)) return;
        if (!chain.locations.every((l) => visited.has(l))) return;

        // 체인 달성!
        const rewardParts = [];
        // 2026-10 Wave 62 (원장 §61.4 C16): 실제로 받는 골드('빈손의 시작'이면 절반)를 적는다 — 지급은 아래 `grantGold`.
        if (chain.reward.gold) rewardParts.push(`${getGoldIncome(player, chain.reward.gold)}G`);
        if (chain.reward.exp) rewardParts.push(`${chain.reward.exp} EXP`);
        if (chain.reward.item) rewardParts.push(chain.reward.item);
        if (chain.reward.premiumCurrency) rewardParts.push(`${chain.reward.premiumCurrency} 크리스탈`);

        addLog('event', `🔍 ${chain.desc}`);
        addLog('success', `🏆 [발견 체인 완료] ${chain.label}! 보상: ${rewardParts.join(', ')}`);
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: Player) => {
                const updated: Player = grantGold(p, chain.reward.gold || 0);
                const expResult = CombatEngine.applyExpGain(
                    updated,
                    scaleProgressionExpReward(updated, chain.reward.exp || 0),
                );
                Object.assign(updated, expResult.updatedPlayer);
                if (chain.reward.premiumCurrency) {
                    updated.premiumCurrency = (updated.premiumCurrency || 0) + chain.reward.premiumCurrency;
                }
                if (chain.reward.item) {
                    // cycle 180: 이전엔 존재하지 않는 allItems 필드를 lookup해 silent miss — DB.ITEMS는 object
                    //   { weapons, armors, ... }. 기존 lookup이 항상 undefined 반환해 cycle 177
                    //   reward.item fix 후에도 chain reward 아이템이 silent 누락이던 회귀 fix.
                    //   gameUtils.findItemByName(getAllItems() lookup) 사용으로 정합.
                    const itemData = findItemByName(chain.reward.item);
                    // 2026-09 Wave 27 N2 (D2): 보상은 잃지 않는다. cycle 182의 상한 검사는 가방이
                    //   가득 차면 이 아이템을 조용히 버렸고, 체인은 아래에서 완료로 기록돼 다시 받을
                    //   길도 없었다. 상한은 구매·전리품 같은 **증가**만 막고(utils/inventoryCapacity.ts),
                    //   보상 지급은 상한을 넘겨도 들어온다 — 퀘스트·체인·처치 마일스톤 보상과 같은 규칙.
                    if (itemData) {
                        updated.inv = [...(updated.inv || []), withCanonicalEquipmentBaseIdentity({
                            ...itemData,
                            id: `disc_${Date.now()}`,
                        })];
                    }
                }
                updated.stats = {
                    ...updated.stats,
                    discoveryChains: [...(updated.stats?.discoveryChains || []), chain.id],
                };
                return updated;
            },
        });
    });
};
