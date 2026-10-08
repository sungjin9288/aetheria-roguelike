import { BALANCE, CONSTANTS } from '../data/constants.js';
import { DB } from '../data/db.js';
import { HUNT_CONTRACTS, getHuntContract, type HuntContractDef } from '../data/huntContracts.js';
import { MSG } from '../data/messages.js';
import { getEssenceGainFromExp, applyEssenceGain } from '../systems/essenceLedger.js';
import { getEssenceRewardMult } from '../systems/essenceRewardMult.js';
import type { GameMap, HuntContractProgress, Item, Monster, Player } from '../types/index.js';
import { grantGold, makeItem } from './gameUtils.js';
import type { SpawnedMonster } from './exploreUtils.js';
import { createDomainRandom } from './seededRandom.js';
import { getJobGearPool, getUsableGearTier } from './wanderingMerchant.js';

/**
 * 지역 토벌 의뢰 판정 (2026-10 Wave 80, 소유자 결정 "회차마다 다시 하는 지역 토벌 의뢰").
 *
 * - 단계: 0 처치(`HUNT_CONTRACT_KILL_GOAL`) → 1 정예 추적(정예 10점 · 일반 1점, `getHuntTraceGoal` — Wave 83, 보스 · 우두머리 제외) → 2 우두머리 → 3 완수.
 * - 진행은 그 지역에 있을 때의 승리만 센다. 첫 처치가 의뢰를 게시한다.
 * - **난수를 쓰지 않는다** — 우두머리 출현은 단계가 정하고(2단계에서 그 지역의 다음 일반 개체), 보상 장비는 지역 · 탐험 수의
 *   도메인 난수가 고른다. 탐험 · 승리의 난수열이 기능 이전과 같다(Wave 70 · 71 · 75와 같은 원칙).
 * - 진행(`player.huntContracts`)은 런 범위다 — 사망 · 계승에서 비워진다(`pickPermanentPlayerState`에 없다).
 * - Wave 82: 우두머리를 쓰러뜨리면 같은 지역의 다음 차수 의뢰가 이어진다(`HUNT_CONTRACT_MAX_ROUNDS`까지, Wave 84부터 5차) — 추적 목표가 늘고
 *   (처치 목표는 Wave 84부터 차수마다 같다)
 *   우두머리 · 보상이 차수마다 `HUNT_CONTRACT_ROUND_GROWTH`만큼 커진다. 우두머리는 지역의 상태 이상(`status`)을 강타와 격노로 건다.
 */

export const HUNT_STAGE_KILLS = 0;
export const HUNT_STAGE_ELITES = 1;
export const HUNT_STAGE_CHAMPION = 2;
export const HUNT_STAGE_DONE = 3;

const mapLevelOf = (map: string): number => {
    const level = DB.MAPS[map]?.level;
    return typeof level === 'number' ? level : 1;
};

export const getHuntContractProgress = (player: Player | null | undefined, map: string): Required<HuntContractProgress> => {
    const entry = player?.huntContracts?.[map];
    return {
        stage: Math.max(0, Math.min(HUNT_STAGE_DONE, Math.floor(Number(entry?.stage) || 0))),
        progress: Math.max(0, Math.floor(Number(entry?.progress) || 0)),
        round: Math.max(1, Math.min(BALANCE.HUNT_CONTRACT_MAX_ROUNDS, Math.floor(Number(entry?.round) || 1))),
    };
};

/** 차수 배율 — 1차 1, 차수마다 `HUNT_CONTRACT_ROUND_GROWTH`씩. 우두머리 생명 · 공격력 · 보상(골드 · 정수 · 경험치)에 곱한다. */
export const getHuntRoundMult = (round: number = 1): number => 1 + BALANCE.HUNT_CONTRACT_ROUND_GROWTH * (Math.max(1, round) - 1);
/** 차수의 1단계 처치 목표 · 2단계 정예 목표. */
export const getHuntKillGoal = (round: number = 1): number => BALANCE.HUNT_CONTRACT_KILL_GOAL + BALANCE.HUNT_CONTRACT_KILL_GOAL_PER_ROUND * (Math.max(1, round) - 1);
export const getHuntEliteGoal = (round: number = 1): number => BALANCE.HUNT_CONTRACT_ELITE_GOAL + BALANCE.HUNT_CONTRACT_ELITE_GOAL_PER_ROUND * (Math.max(1, round) - 1);
/**
 * Wave 83: 2단계는 정예 추적 점수다 — 정예 처치 `HUNT_CONTRACT_ELITE_TRACE`점, 일반 처치 1점, 목표 = 정예 목표 × 그 점수(30 · 40 · 50).
 * 정예만 세던 동안 이 단계가 지역마다 중앙값 1.6 ~ 2.6시간(p90 3 ~ 4.4시간)이라 2회차 긴 공백의 시작점이었다(원장 §87).
 */
export const getHuntTraceGoal = (round: number = 1): number => getHuntEliteGoal(round) * BALANCE.HUNT_CONTRACT_ELITE_TRACE;

/** 3단계 보상 — 착용할 수 있는 가장 높은 등급(지역 레벨까지)의 이 직업용 장비 중 위력 상위 1/4에서 하나. */
export const pickHuntChampionGear = (player: Player, map: string, round: number = 1): Item | null => {
    const tier = getUsableGearTier(Math.min(Number(player.level) || 1, mapLevelOf(map) + BALANCE.HUNT_CONTRACT_PREVIEW_LEVELS));
    const pool = getJobGearPool(player.job, tier)
        .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0) || String(a.name).localeCompare(String(b.name)));
    const top = pool.slice(0, Math.max(1, Math.ceil(pool.length / 4)));
    if (top.length === 0) return null;
    const rng = createDomainRandom(0, 'hunt-contract', map, Number(player.stats?.explores) || 0, String(player.job || ''), round);
    return top[Math.floor(rng() * top.length)] ?? null;
};

/** 3단계 보상 정수 — 그 지역 레벨 적 한 마리 처치 정수 × `HUNT_CONTRACT_CHAMPION_ESSENCE_KILLS`(같은 공식 · 같은 배율). */
export const getHuntChampionEssence = (player: Player, map: string, round: number = 1): number => Math.floor(
    getEssenceGainFromExp(
        BALANCE.RELIC_ECHO_EXP_BASE + mapLevelOf(map) * BALANCE.RELIC_ECHO_EXP_PER_LEVEL,
        getEssenceRewardMult(player.meta),
    ) * BALANCE.HUNT_CONTRACT_CHAMPION_ESSENCE_KILLS * getHuntRoundMult(round),
);

export const getHuntStageGold = (map: string, round: number = 1): number => Math.floor(
    mapLevelOf(map) * BALANCE.HUNT_CONTRACT_GOLD_PER_LEVEL * getHuntRoundMult(round),
);
/** 2단계 보상 강화 재료 수 — 차수마다 하나씩 는다. */
export const getHuntEliteMaterials = (round: number = 1): number => BALANCE.HUNT_CONTRACT_ENHANCE_MATERIALS + (Math.max(1, round) - 1);

export interface HuntContractVictoryResult {
    player: Player;
    logs: Array<{ type: string; text: string }>;
    /** 이번 승리로 받은 보상 아이템(도감 등록용). */
    items: Item[];
    /** 이번 승리로 끝난 단계(없으면 null) — 0 · 1 · 2. */
    completedStage: number | null;
}

const withProgress = (player: Player, map: string, next: Required<HuntContractProgress>): Player => ({
    ...player,
    huntContracts: { ...(player.huntContracts || {}), [map]: next },
});

/**
 * 승리 한 번을 의뢰에 반영한다(순수). 진행은 승리 순간 플레이어가 있는 지역의 의뢰만 움직인다.
 * `now`는 보상 아이템 id에만 쓴다.
 */
export const advanceHuntContractOnVictory = (
    player: Player,
    deadEnemy: Pick<Monster, 'isElite' | 'isBoss'> & { huntChampion?: string } | null | undefined,
    now: () => number = Date.now,
): HuntContractVictoryResult => {
    const map = String(player.loc || '');
    const contract = getHuntContract(map);
    const unchanged: HuntContractVictoryResult = { player, logs: [], items: [], completedStage: null };
    if (!contract || !deadEnemy) return unchanged;
    const { stage, progress, round } = getHuntContractProgress(player, map);
    const logs: HuntContractVictoryResult['logs'] = [];
    const killGoal = getHuntKillGoal(round);
    const traceGoal = getHuntTraceGoal(round);

    if (stage === HUNT_STAGE_KILLS) {
        const next = progress + 1;
        if (progress === 0 && player.huntContracts?.[map] === undefined) {
            logs.push({ type: 'event', text: MSG.HUNT_CONTRACT_POSTED(map, killGoal) });
        }
        if (next < killGoal) {
            return { player: withProgress(player, map, { stage, progress: next, round }), logs, items: [], completedStage: null };
        }
        const gold = getHuntStageGold(map, round);
        const paid = grantGold(withProgress(player, map, { stage: HUNT_STAGE_ELITES, progress: 0, round }), gold);
        logs.push({ type: 'event', text: MSG.HUNT_CONTRACT_STAGE_KILLS_DONE(map, gold, traceGoal, BALANCE.HUNT_CONTRACT_ELITE_TRACE) });
        return { player: paid, logs, items: [], completedStage: HUNT_STAGE_KILLS };
    }

    if (stage === HUNT_STAGE_ELITES) {
        if (deadEnemy.isBoss || deadEnemy.huntChampion) return unchanged;
        const next = Math.min(traceGoal, progress + (deadEnemy.isElite ? BALANCE.HUNT_CONTRACT_ELITE_TRACE : 1));
        if (next < traceGoal) {
            return { player: withProgress(player, map, { stage, progress: next, round }), logs, items: [], completedStage: null };
        }
        const materialName = CONSTANTS.ENHANCE_MATERIAL_NAME;
        const template = DB.ITEMS.materials.find((item) => item.name === materialName) || null;
        const rng = createDomainRandom(0, 'hunt-contract-material', map, Number(player.stats?.explores) || 0, round);
        const items = template
            ? Array.from({ length: getHuntEliteMaterials(round) }, () => makeItem(template, rng, now))
            : [];
        const advanced = withProgress(player, map, { stage: HUNT_STAGE_CHAMPION, progress: 0, round });
        logs.push({
            type: 'event',
            text: MSG.HUNT_CONTRACT_STAGE_ELITES_DONE(map, items.length, materialName, contract.champion, BALANCE.HUNT_CHAMPION_OMEN_KILLS),
        });
        return { player: { ...advanced, inv: [...(advanced.inv || []), ...items] }, logs, items, completedStage: HUNT_STAGE_ELITES };
    }

    if (stage === HUNT_STAGE_CHAMPION) {
        if (deadEnemy.huntChampion !== map) {
            // Wave 81: 기척 → 접근 — 그 지역의 다른 승리가 `HUNT_CHAMPION_OMEN_KILLS`까지 센다(거기서 멈춘다).
            if (deadEnemy.huntChampion || progress >= BALANCE.HUNT_CHAMPION_OMEN_KILLS) return unchanged;
            const next = progress + 1;
            if (next >= BALANCE.HUNT_CHAMPION_OMEN_KILLS) logs.push({ type: 'critical', text: MSG.HUNT_CHAMPION_NEAR(contract.champion, map) });
            return { player: withProgress(player, map, { stage, progress: next, round }), logs, items: [], completedStage: null };
        }
        const template = pickHuntChampionGear(player, map, round);
        const rng = createDomainRandom(0, 'hunt-contract-gear', map, Number(player.stats?.explores) || 0, round);
        const items = template ? [makeItem(template, rng, now)] : [];
        const essence = getHuntChampionEssence(player, map, round);
        // Wave 82: 마지막 차수가 아니면 같은 지역의 다음 차수 의뢰가 곧바로 이어진다.
        const hasNextRound = round < BALANCE.HUNT_CONTRACT_MAX_ROUNDS;
        const advanced = withProgress(player, map, hasNextRound
            ? { stage: HUNT_STAGE_KILLS, progress: 0, round: round + 1 }
            : { stage: HUNT_STAGE_DONE, progress: 0, round });
        const granted = applyEssenceGain(advanced.meta || {}, essence);
        logs.push({
            type: 'legendary',
            text: MSG.HUNT_CONTRACT_COMPLETE(map, contract.champion, items[0]?.name ? String(items[0].name) : '-', essence),
        });
        if (hasNextRound) {
            logs.push({ type: 'event', text: MSG.HUNT_CONTRACT_NEXT_ROUND(map, round + 1, BALANCE.HUNT_CONTRACT_MAX_ROUNDS, getHuntKillGoal(round + 1)) });
        }
        if (granted.rankGain > 0) logs.push({ type: 'system', text: MSG.LEGACY_RANK(granted.meta.rank) });
        return {
            player: { ...advanced, meta: granted.meta, inv: [...(advanced.inv || []), ...items] },
            logs, items, completedStage: HUNT_STAGE_CHAMPION,
        };
    }
    return unchanged;
};

/**
 * 우두머리 출현 — 2단계 의뢰가 있는 지역에서 기척을 다 채운 뒤(`HUNT_CHAMPION_OMEN_KILLS`) 다음 일반 개체(보스 · 정예 · 접두어
 * 개체 제외)가 우두머리가 된다. 난수를 쓰지 않는다. 종(`baseName`)은 그대로라 임무 목표 판정 · 도감 · 초상은 그 종을 본다.
 * Wave 81: 생명 50%에서 격노한다(정예 격노와 같은 `phase2` 경로 — 공격력 · 강타 확률이 오른다).
 * Wave 82: 지역의 상태 이상을 강타(`statusOnHit` — 다른 적과 같은 확률 · 저항)와 격노 전환(`phase2.statusEffect`)으로 건다.
 *   차수 배율(`getHuntRoundMult`)이 생명 · 공격력 · 보상에 붙는다.
 */
export type HuntChampionCandidate = SpawnedMonster & { huntChampion?: string };

/**
 * Wave 84 (소유자 결정 (b)): 우두머리 공격력 배율 — 지역 상태 이상이 받는 피해를 키우면(저주) 그 증폭으로 나눈다.
 * 저주에 걸린 뒤의 실효 타격이 다른 지역 우두머리와 같다. 지속 피해 · 기절처럼 따로 피해를 내거나 차례를 뺏는 상태는 나누지 않는다.
 */
export const getHuntChampionAtkMult = (status: HuntContractDef['status']): number => (
    status === 'curse' ? BALANCE.HUNT_CHAMPION_ATK_MULT / BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT : BALANCE.HUNT_CHAMPION_ATK_MULT
);

export const applyHuntChampion = (
    enemy: SpawnedMonster,
    player: Player,
    mapData: GameMap | null | undefined,
): HuntChampionCandidate => {
    const map = String(player.loc || '');
    const contract = getHuntContract(map);
    if (!contract || !mapData || mapData.level === 'infinite') return enemy;
    const { stage, progress, round } = getHuntContractProgress(player, map);
    if (stage !== HUNT_STAGE_CHAMPION || progress < BALANCE.HUNT_CHAMPION_OMEN_KILLS) return enemy;
    if (enemy.isBoss || enemy.isElite || !enemy.baseName || enemy.name !== enemy.baseName) return enemy;
    const roundMult = getHuntRoundMult(round);
    return {
        ...enemy,
        name: MSG.HUNT_CHAMPION_NAME(contract.champion, enemy.baseName),
        isElite: true,
        huntChampion: map,
        hp: Math.floor(enemy.hp * BALANCE.HUNT_CHAMPION_HP_MULT * roundMult),
        maxHp: Math.floor(enemy.maxHp * BALANCE.HUNT_CHAMPION_HP_MULT * roundMult),
        atk: Math.floor(enemy.atk * getHuntChampionAtkMult(contract.status) * roundMult),
        exp: Math.floor(enemy.exp * BALANCE.HUNT_CHAMPION_REWARD_MULT * roundMult),
        gold: Math.floor(enemy.gold * BALANCE.HUNT_CHAMPION_REWARD_MULT * roundMult),
        statusOnHit: contract.status,
        phase2: {
            statusEffect: contract.status,
            threshold: BALANCE.HUNT_CHAMPION_PHASE_THRESHOLD,
            name: MSG.HUNT_CHAMPION_ENRAGED_NAME(contract.champion, enemy.baseName),
            atkBonus: BALANCE.HUNT_CHAMPION_PHASE_ATK_BONUS,
            pattern: {
                guardChance: Math.max(0, (enemy.pattern?.guardChance ?? 0.12) - 0.05),
                heavyChance: BALANCE.HUNT_CHAMPION_PHASE_HEAVY_CHANCE,
            },
            log: MSG.HUNT_CHAMPION_ENRAGE_LOG(contract.champion),
        },
    };
};

export interface HuntContractRow {
    map: string;
    champion: string;
    mapLevel: number;
    stage: number;
    progress: number;
    goal: number;
    /** 차수(1부터) — 완수한 지역은 마지막 차수. */
    round: number;
    /** 화면 한 줄 상태. */
    status: string;
    done: boolean;
    reachable: boolean;
}

/** 임무 탭의 의뢰 줄 — 지역 레벨 − `HUNT_CONTRACT_PREVIEW_LEVELS`부터 보인다. */
export const getHuntContractRows = (player: Player | null | undefined): HuntContractRow[] => {
    const level = Number(player?.level) || 1;
    return HUNT_CONTRACTS
        .filter((contract: HuntContractDef) => level >= mapLevelOf(contract.map) - BALANCE.HUNT_CONTRACT_PREVIEW_LEVELS)
        .map((contract: HuntContractDef) => {
            const mapLevel = mapLevelOf(contract.map);
            const { stage, progress, round } = getHuntContractProgress(player, contract.map);
            const reachable = level >= mapLevel;
            const goal = stage === HUNT_STAGE_KILLS ? getHuntKillGoal(round)
                : stage === HUNT_STAGE_ELITES ? getHuntTraceGoal(round)
                    : stage === HUNT_STAGE_CHAMPION ? BALANCE.HUNT_CHAMPION_OMEN_KILLS : 1;
            const omenDone = stage === HUNT_STAGE_CHAMPION && progress >= BALANCE.HUNT_CHAMPION_OMEN_KILLS;
            const stageStatus = omenDone ? MSG.HUNT_CONTRACT_STATUS_CHAMPION(contract.champion)
                : stage === HUNT_STAGE_CHAMPION ? MSG.HUNT_CONTRACT_STATUS_OMEN(contract.champion, progress, goal)
                    : MSG.HUNT_CONTRACT_STATUS_STAGE(stage + 1, MSG.HUNT_CONTRACT_STAGE_LABELS[stage], progress, goal);
            const status = stage >= HUNT_STAGE_DONE ? MSG.HUNT_CONTRACT_STATUS_DONE
                : !reachable && stage === HUNT_STAGE_KILLS && progress === 0 && round === 1 ? MSG.HUNT_CONTRACT_STATUS_LOCKED(mapLevel)
                    : `${MSG.HUNT_CONTRACT_ROUND_TAG(round, BALANCE.HUNT_CONTRACT_MAX_ROUNDS)}${stageStatus}`;
            return {
                map: contract.map, champion: contract.champion, mapLevel, stage,
                progress: stage >= HUNT_STAGE_DONE ? 1 : progress,
                goal, round, status, done: stage >= HUNT_STAGE_DONE, reachable,
            };
        });
};
