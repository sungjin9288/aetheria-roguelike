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

/** BALANCE.DISCOVERY_CHAINS 원소 (constants.ts는 인덱스 시그니처라 여기서 모양을 고정한다). */
interface DiscoveryChain {
    id: string;
    label: string;
    desc: string;
    locations: string[];
    reward: { gold?: number; exp?: number; item?: string; premiumCurrency?: number };
}
import { DB } from '../../data/db.js';
import { BALANCE } from '../../data/constants.js';
import { RELICS, pickWeightedRelics } from '../../data/relics.js';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { AT } from '../../reducers/actionTypes.js';
import { GS } from '../../reducers/gameStates.js';
import { MSG } from '../../data/messages.js';
import { getDiscoveryOdds } from '../../utils/explorationPacing.js';
import { findItemByName } from '../../utils/gameUtils.js';
import { withCanonicalEquipmentBaseIdentity } from '../../utils/equipmentBaseIdentity.js';
import { applyDynamicDifficulty } from '../../systems/DifficultyManager';
import { CombatEngine } from '../../systems/CombatEngine';
import { scaleProgressionExpReward } from '../../data/progressionProfiles';
import { getBossSignatureDrops } from '../../utils/bossSignatureHint';
import { getSignaturePityMultiplier } from '../../utils/signaturePity';
import { resolveAbyssDailyDive } from '../../utils/abyssDailyDive';
import { activateDevourBonus } from '../../utils/adventureRelicBonuses.js';
import { calculateFullStats } from '../../utils/statsCalculator.js';
import { spawnEnemy } from '../../utils/exploreUtils.js';
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
            const anomalyStatus: StatusId = anomaly.effect;
            dispatch({ type: AT.SET_PLAYER, payload: (p: Player): Player => ({ ...p, status: [...new Set([...(p.status || []), anomalyStatus])] }) });
        }
        return 'anomaly';
    }

    // 유물 발견 — PR #8: 프레스티지 rank≥2면 보유 한도 +1(6) · 선택지 4지선다.
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (playerRelics.length < relicUnlocks.maxRelics && rng() < discoveryOdds.relicChance) {
        const available = RELICS.filter((r) => !playerRelics.some((pr) => pr.id === r.id));
        if (available.length > 0) {
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, { owned: playerRelics, rng });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', MSG.EXPLORE_RELIC_DISCOVERED);
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
    const activatedPlayer = activateDevourBonus(player);
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
        }
    };

    // cycle 158: 'battle_start_buff' (전쟁의 북) — 전투 시작 시 ATK +val.atk (val.turns 턴).
    //   tempBuff.atk는 multiplier (1 + atk) 로 statsCalculator에서 적용.
    const startBuffRelic = playerRelics.find((r) => r.effect === 'battle_start_buff');
    if (startBuffRelic) {
        const atkBonus = startBuffRelic.val?.atk || 0;
        const turns = startBuffRelic.val?.turns || 1;
        combatStartPlayer.tempBuff = {
            atk: atkBonus,
            def: 0,
            turn: turns,
            name: 'battle_start_buff',
        };
        addLog('event', `[전쟁의 북] 전투 시작 ATK +${Math.round(atkBonus * 100)}% (${turns}턴)`);
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

    // 유물: 혼돈의 심장 (chaos_relic) — 전투 시작 시 랜덤 효과 발동
    const chaosRelic = playerRelics.find((r) => r.effect === 'chaos_relic');
    if (chaosRelic) {
        const roll = Math.floor(rng() * 3);
        if (roll === 0) {
            const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * 0.1));
            combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp!, (combatStartPlayer.hp || 0) + heal);
            addLog('heal', `[혼돈의 심장] 혼돈의 기운 — HP +${heal} 회복!`);
        } else if (roll === 1) {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, atk: (existing.atk ?? 0) + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — ATK +25% (3턴)!`);
        } else {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, def: (existing.def ?? 0) + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — DEF +25% (3턴)!`);
        }
    }

    const chaosBuffRelic = playerRelics.find((r) => r.effect === 'chaos_buff');
    if (chaosBuffRelic) {
        const existingBuff = { atk: 0, def: 0, turn: 0, name: null, ...(combatStartPlayer.tempBuff || {}) };
        const rollAtk = rng() < 0.5;
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

    // 전투 직전 유물 발견 기회
    const firstRelicPity = playerRelics.length === 0
        && (player.stats?.exploreState?.sinceRelic || 0) >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (playerRelics.length < relicUnlocks.maxRelics
        && (firstRelicPity || rng() < BALANCE.RELIC_FIND_CHANCE * 0.5)) {
        const available = RELICS.filter((r) => !playerRelics.some((pr) => pr.id === r.id));
        if (available.length > 0) {
            commitExploreOutcome('relic_found', null, gaugeMapData);
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, { owned: playerRelics, rng });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', MSG.EXPLORE_RELIC_FOUND);
            return;
        }
    }

    // 몬스터 생성
    const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog }, { rng });
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

    chains.forEach((chain: DiscoveryChain) => {
        if (completed.includes(chain.id)) return;
        if (!chain.locations.every((l) => visited.has(l))) return;

        // 체인 달성!
        const rewardParts = [];
        if (chain.reward.gold) rewardParts.push(`${chain.reward.gold}G`);
        if (chain.reward.exp) rewardParts.push(`${chain.reward.exp} EXP`);
        if (chain.reward.item) rewardParts.push(chain.reward.item);
        if (chain.reward.premiumCurrency) rewardParts.push(`${chain.reward.premiumCurrency} 크리스탈`);

        addLog('event', `🔍 ${chain.desc}`);
        addLog('success', `🏆 [발견 체인 완료] ${chain.label}! 보상: ${rewardParts.join(', ')}`);
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: Player) => {
                const updated: Player = { ...p };
                updated.gold = (updated.gold || 0) + (chain.reward.gold || 0);
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
                    // cycle 182: player.maxInv (PremiumShop 확장)을 우선 — 기존엔 BALANCE.INV_MAX_SIZE
                    // 만 사용해 확장된 인벤(25칸)에서도 20칸 기준으로 reward skip 가능했음.
                    const invCap = (updated.maxInv as number) || (BALANCE.INV_MAX_SIZE || 20);
                    if (itemData && (updated.inv || []).length < invCap) {
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
