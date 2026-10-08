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
 * - 단계: 0 처치(`HUNT_CONTRACT_KILL_GOAL`) → 1 정예 처치(`HUNT_CONTRACT_ELITE_GOAL`, 우두머리 제외) → 2 우두머리 → 3 완수.
 * - 진행은 그 지역에 있을 때의 승리만 센다. 첫 처치가 의뢰를 게시한다.
 * - **난수를 쓰지 않는다** — 우두머리 출현은 단계가 정하고(2단계에서 그 지역의 다음 일반 개체), 보상 장비는 지역 · 탐험 수의
 *   도메인 난수가 고른다. 탐험 · 승리의 난수열이 기능 이전과 같다(Wave 70 · 71 · 75와 같은 원칙).
 * - 진행(`player.huntContracts`)은 런 범위다 — 사망 · 계승에서 비워진다(`pickPermanentPlayerState`에 없다).
 */

export const HUNT_STAGE_KILLS = 0;
export const HUNT_STAGE_ELITES = 1;
export const HUNT_STAGE_CHAMPION = 2;
export const HUNT_STAGE_DONE = 3;

const mapLevelOf = (map: string): number => {
    const level = DB.MAPS[map]?.level;
    return typeof level === 'number' ? level : 1;
};

export const getHuntContractProgress = (player: Player | null | undefined, map: string): HuntContractProgress => {
    const entry = player?.huntContracts?.[map];
    return {
        stage: Math.max(0, Math.min(HUNT_STAGE_DONE, Math.floor(Number(entry?.stage) || 0))),
        progress: Math.max(0, Math.floor(Number(entry?.progress) || 0)),
    };
};

/** 3단계 보상 — 착용할 수 있는 가장 높은 등급(지역 레벨까지)의 이 직업용 장비 중 위력 상위 1/4에서 하나. */
export const pickHuntChampionGear = (player: Player, map: string): Item | null => {
    const tier = getUsableGearTier(Math.min(Number(player.level) || 1, mapLevelOf(map) + BALANCE.HUNT_CONTRACT_PREVIEW_LEVELS));
    const pool = getJobGearPool(player.job, tier)
        .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0) || String(a.name).localeCompare(String(b.name)));
    const top = pool.slice(0, Math.max(1, Math.ceil(pool.length / 4)));
    if (top.length === 0) return null;
    const rng = createDomainRandom(0, 'hunt-contract', map, Number(player.stats?.explores) || 0, String(player.job || ''));
    return top[Math.floor(rng() * top.length)] ?? null;
};

/** 3단계 보상 정수 — 그 지역 레벨 적 한 마리 처치 정수 × `HUNT_CONTRACT_CHAMPION_ESSENCE_KILLS`(같은 공식 · 같은 배율). */
export const getHuntChampionEssence = (player: Player, map: string): number => (
    getEssenceGainFromExp(
        BALANCE.RELIC_ECHO_EXP_BASE + mapLevelOf(map) * BALANCE.RELIC_ECHO_EXP_PER_LEVEL,
        getEssenceRewardMult(player.meta),
    ) * BALANCE.HUNT_CONTRACT_CHAMPION_ESSENCE_KILLS
);

export const getHuntStageGold = (map: string): number => mapLevelOf(map) * BALANCE.HUNT_CONTRACT_GOLD_PER_LEVEL;

export interface HuntContractVictoryResult {
    player: Player;
    logs: Array<{ type: string; text: string }>;
    /** 이번 승리로 받은 보상 아이템(도감 등록용). */
    items: Item[];
    /** 이번 승리로 끝난 단계(없으면 null) — 0 · 1 · 2. */
    completedStage: number | null;
}

const withProgress = (player: Player, map: string, next: HuntContractProgress): Player => ({
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
    const { stage, progress } = getHuntContractProgress(player, map);
    const logs: HuntContractVictoryResult['logs'] = [];

    if (stage === HUNT_STAGE_KILLS) {
        const next = progress + 1;
        if (progress === 0 && player.huntContracts?.[map] === undefined) {
            logs.push({ type: 'event', text: MSG.HUNT_CONTRACT_POSTED(map, BALANCE.HUNT_CONTRACT_KILL_GOAL) });
        }
        if (next < BALANCE.HUNT_CONTRACT_KILL_GOAL) {
            return { player: withProgress(player, map, { stage, progress: next }), logs, items: [], completedStage: null };
        }
        const gold = getHuntStageGold(map);
        const paid = grantGold(withProgress(player, map, { stage: HUNT_STAGE_ELITES, progress: 0 }), gold);
        logs.push({ type: 'event', text: MSG.HUNT_CONTRACT_STAGE_KILLS_DONE(map, gold, BALANCE.HUNT_CONTRACT_ELITE_GOAL) });
        return { player: paid, logs, items: [], completedStage: HUNT_STAGE_KILLS };
    }

    if (stage === HUNT_STAGE_ELITES) {
        if (!deadEnemy.isElite || deadEnemy.isBoss || deadEnemy.huntChampion) return unchanged;
        const next = progress + 1;
        if (next < BALANCE.HUNT_CONTRACT_ELITE_GOAL) {
            return { player: withProgress(player, map, { stage, progress: next }), logs, items: [], completedStage: null };
        }
        const materialName = CONSTANTS.ENHANCE_MATERIAL_NAME;
        const template = DB.ITEMS.materials.find((item) => item.name === materialName) || null;
        const rng = createDomainRandom(0, 'hunt-contract-material', map, Number(player.stats?.explores) || 0);
        const items = template
            ? Array.from({ length: BALANCE.HUNT_CONTRACT_ENHANCE_MATERIALS }, () => makeItem(template, rng, now))
            : [];
        const advanced = withProgress(player, map, { stage: HUNT_STAGE_CHAMPION, progress: 0 });
        logs.push({
            type: 'event',
            text: MSG.HUNT_CONTRACT_STAGE_ELITES_DONE(map, items.length, materialName, contract.champion),
        });
        return { player: { ...advanced, inv: [...(advanced.inv || []), ...items] }, logs, items, completedStage: HUNT_STAGE_ELITES };
    }

    if (stage === HUNT_STAGE_CHAMPION) {
        if (deadEnemy.huntChampion !== map) return unchanged;
        const template = pickHuntChampionGear(player, map);
        const rng = createDomainRandom(0, 'hunt-contract-gear', map, Number(player.stats?.explores) || 0);
        const items = template ? [makeItem(template, rng, now)] : [];
        const essence = getHuntChampionEssence(player, map);
        const advanced = withProgress(player, map, { stage: HUNT_STAGE_DONE, progress: 0 });
        const granted = applyEssenceGain(advanced.meta || {}, essence);
        logs.push({
            type: 'legendary',
            text: MSG.HUNT_CONTRACT_COMPLETE(map, contract.champion, items[0]?.name ? String(items[0].name) : '-', essence),
        });
        if (granted.rankGain > 0) logs.push({ type: 'system', text: MSG.LEGACY_RANK(granted.meta.rank) });
        return {
            player: { ...advanced, meta: granted.meta, inv: [...(advanced.inv || []), ...items] },
            logs, items, completedStage: HUNT_STAGE_CHAMPION,
        };
    }
    return unchanged;
};

/**
 * 우두머리 출현 — 2단계 의뢰가 있는 지역에서 다음 일반 개체(보스 · 정예 · 접두어 없는 개체)가 우두머리가 된다. 난수를 쓰지 않는다.
 * 종(`baseName`)은 그대로라 임무 목표 판정 · 도감 · 초상은 그 종을 본다.
 */
export type HuntChampionCandidate = SpawnedMonster & { huntChampion?: string };

export const applyHuntChampion = (
    enemy: SpawnedMonster,
    player: Player,
    mapData: GameMap | null | undefined,
): HuntChampionCandidate => {
    const map = String(player.loc || '');
    const contract = getHuntContract(map);
    if (!contract || !mapData || mapData.level === 'infinite') return enemy;
    if (getHuntContractProgress(player, map).stage !== HUNT_STAGE_CHAMPION) return enemy;
    if (enemy.isBoss || enemy.isElite || !enemy.baseName || enemy.name !== enemy.baseName) return enemy;
    return {
        ...enemy,
        name: MSG.HUNT_CHAMPION_NAME(contract.champion, enemy.baseName),
        isElite: true,
        huntChampion: map,
        hp: Math.floor(enemy.hp * BALANCE.HUNT_CHAMPION_HP_MULT),
        maxHp: Math.floor(enemy.maxHp * BALANCE.HUNT_CHAMPION_HP_MULT),
        atk: Math.floor(enemy.atk * BALANCE.HUNT_CHAMPION_ATK_MULT),
        exp: Math.floor(enemy.exp * BALANCE.HUNT_CHAMPION_REWARD_MULT),
        gold: Math.floor(enemy.gold * BALANCE.HUNT_CHAMPION_REWARD_MULT),
    };
};

export interface HuntContractRow {
    map: string;
    champion: string;
    mapLevel: number;
    stage: number;
    progress: number;
    goal: number;
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
            const { stage, progress } = getHuntContractProgress(player, contract.map);
            const reachable = level >= mapLevel;
            const goal = stage === HUNT_STAGE_KILLS ? BALANCE.HUNT_CONTRACT_KILL_GOAL
                : stage === HUNT_STAGE_ELITES ? BALANCE.HUNT_CONTRACT_ELITE_GOAL : 1;
            const status = stage >= HUNT_STAGE_DONE ? MSG.HUNT_CONTRACT_STATUS_DONE
                : !reachable && stage === HUNT_STAGE_KILLS && progress === 0 ? MSG.HUNT_CONTRACT_STATUS_LOCKED(mapLevel)
                    : stage === HUNT_STAGE_CHAMPION ? MSG.HUNT_CONTRACT_STATUS_CHAMPION(contract.champion)
                        : MSG.HUNT_CONTRACT_STATUS_STAGE(stage + 1, MSG.HUNT_CONTRACT_STAGE_LABELS[stage], progress, goal);
            return {
                map: contract.map, champion: contract.champion, mapLevel, stage,
                progress: stage >= HUNT_STAGE_DONE ? 1 : stage === HUNT_STAGE_CHAMPION ? 0 : progress,
                goal, status, done: stage >= HUNT_STAGE_DONE, reachable,
            };
        });
};
