import { BALANCE, CONSTANTS } from '../data/constants.js';
import { DB } from '../data/db.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { EVENT_CHAINS } from '../data/eventChains.js';
import { LOOT_TABLE } from '../data/loot.js';
import { getAllSignatureDropSourceIndex } from '../utils/signatureDropSources.js';
import { getShopCatalog } from '../utils/shopRotation.js';
import {
    MODEL_TIME_POLICY,
    PROGRESSION_EXP_LADDER_AUTHORITY,
    cumulativeExpToLevel,
    simulateProgression,
    toModeledHours,
} from './progressionSimulator.js';
import { canInvestigateTown } from '../utils/townInvestigation';

export type AcquisitionRouteKind =
    | 'shop'
    | 'drop_table'
    | 'legacy_loot'
    | 'quest_reward'
    | 'high_level_bonus';

/**
 * Wave 12 D1 — 비용 축의 출처 표기.
 * `anchored`    : progression 체크포인트(또는 시뮬레이션 시작점)에서 그대로 읽은 모델 산출값.
 * `interpolated`: 체크포인트가 없는 레벨 — 앞뒤 앵커 사이를 누적 EXP 비율로 보간한 값(모델 직접 산출이 아니다).
 * `beyond-anchors`: 앵커 범위 밖 레벨 — 외삽하지 않고 비용을 비워 둔다.
 * `unavailable` : progression 권위가 없는 소스(테스트 목업) — 비용을 계산하지 않는다.
 */
export type ModeledCostBasis = 'anchored' | 'interpolated' | 'beyond-anchors' | 'unavailable';

export interface ModeledCostInterpolation {
    lowerLevel: number;
    upperLevel: number;
    lowerModeledActions: number;
    upperModeledActions: number;
    lowerCumulativeExp: number;
    upperCumulativeExp: number;
    expFraction: number;
}

export interface ModeledCost {
    level: number;
    basis: ModeledCostBasis;
    modeledActions: number | null;
    modeledSeconds: number | null;
    modeledHours: number | null;
    cumulativeExp: number;
    interpolation: ModeledCostInterpolation | null;
}

export interface CostAnchor {
    level: number;
    source: 'simulation-origin' | 'checkpoint';
    modeledActions: number;
    modeledSeconds: number;
    modeledHours: number;
    cumulativeExp: number;
}

export interface CostBucket {
    gateLevel: number;
    count: number;
    members: Array<string | number>;
    cost: ModeledCost;
}

export interface EquipmentTierCost {
    tier: number;
    gateLevel: number;
    count: number;
    cost: ModeledCost;
}

export interface MapGateDivergence {
    map: string;
    declaredLevel: number | string | null;
    routeGateLevel: number;
}

export interface CostBehindRow {
    level: number;
    basis: ModeledCostBasis;
    modeledActions: number | null;
    modeledHours: number | null;
    maps: number;
    quests: number;
    equipment: number;
    jobs: number;
    eventChainTerminalSteps: number;
}

export interface ContentCostReport {
    policy: {
        modelAuthority: string | null;
        anchorSeed: number | null;
        anchorStatistic: 'single-seed';
        actionUnit: string | null;
        secondsPerAction: number | null;
        secondsPerHour: number;
        actualPlayClaim: false;
        cumulativeExpAuthority: string;
        mapGateAuthority: string;
        interpolationRule: string;
        limitations: string[];
    };
    anchors: CostAnchor[];
    summary: {
        eventChains: number;
        eventChainSteps: number;
        eventChainTerminalSteps: number;
    };
    gates: {
        maps: CostBucket[];
        quests: CostBucket[];
        equipmentTiers: EquipmentTierCost[];
        jobs: CostBucket[];
        eventChainTerminals: CostBucket[];
    };
    mapGateDivergence: MapGateDivergence[];
    unresolvedEventChainTerminals: string[];
    malformedGates: string[];
    behind: CostBehindRow[];
}

export interface ContentReachabilityReport {
    schemaVersion: 2;
    catalog: {
        maps: number;
        monsters: number;
        quests: number;
        jobs: number;
        equipment: number;
        signatures: number;
    };
    maps: {
        start: string;
        reachable: string[];
        unreachable: string[];
        invalidExits: string[];
    };
    monsters: {
        reachable: string[];
        missingRoutes: string[];
        routes: Array<{ name: string; regions: string[] }>;
    };
    quests: {
        reachable: Array<string | number>;
        invalidPrerequisites: Array<string | number>;
        prerequisiteCycles: Array<Array<string | number>>;
        unreachableTargets: Array<string | number>;
        invalidRewards: Array<string | number>;
    };
    jobs: {
        reachable: string[];
        unreachable: string[];
        terminalLineages: string[][];
        checkpointLevels: number[];
        checkpointSnapshots: Array<{
            targetLevel: number;
            reachedLevel: number;
            reachableJobCount: number;
            reachableJobs: string[];
        }>;
        jobSnapshotCount: number;
    };
    equipment: {
        routes: Array<{
            name: string;
            tier: number;
            kinds: AcquisitionRouteKind[];
            sources: string[];
        }>;
        missingRoutes: string[];
        prematureEquipCount: number;
    };
    signatures: {
        routes: Array<{ name: string; monsters: string[] }>;
        missingDropRoutes: string[];
        invalidDropRoutes: string[];
    };
    cost: ContentCostReport;
    errors: string[];
}

/**
 * 이 파일은 `DB`(프로덕션)와 테스트 목업 소스를 동일한 함수로 받는다(ContentSource가
 * 그 공통 계약) — 그래서 필드는 실제 도메인 타입(GameMap/Quest/ClassDef)이 아니라 이
 * 파일이 실제로 읽는 필드만의 최소 형태로 선언한다.
 */
interface MapLike {
    type?: string;
    exits?: unknown[];
    seasonOnly?: boolean;
    /** MAPS 실측: 숫자 / [최소, 최대] 범위 / 'infinite'(무한 심연) 세 모양이 모두 존재한다. */
    level?: number | number[] | string;
    shopBonus?: unknown;
    monsters?: string[];
    bossMonsters?: string[];
    boss?: string;
}

interface QuestRewardLike {
    item?: string;
    exp?: unknown;
    gold?: unknown;
}

interface QuestLike {
    /** 실측 DB.QUESTS는 항상 id를 채운다 — 이 파일도 quest.id를 방어 없이 직접 읽는다. */
    id: string | number;
    prerequisiteQuestId?: string | number | null;
    location?: string;
    target?: string;
    minLv?: unknown;
    reward?: QuestRewardLike | null;
}

interface ClassLike {
    reqLv?: unknown;
    tier?: unknown;
    next?: unknown[];
}

/** ITEMS 카테고리(weapons/armors/.../recipes) 원소 — 카테고리마다 모양이 달라
 *  이 파일이 실제로 읽는 필드만 연다. itemCatalog()가 다루는 weapons/armors는
 *  항상 name을 채우므로(장비 카탈로그 불변) 이 파일도 방어 없이 직접 읽는다
 *  (QuestLike.id와 동일 패턴) — allItemNames()는 다른 카테고리(sets 등 name 없음)도
 *  훑으므로 typeof 방어를 유지한다. */
interface ItemLike {
    name: string;
    tier?: unknown;
    reqLevel?: unknown;
}

type ContentSource = {
    MAPS: Record<string, MapLike>;
    MONSTERS: Record<string, unknown>;
    QUESTS: QuestLike[];
    CLASSES: Record<string, ClassLike>;
    ITEMS: Record<string, ItemLike[]>;
};

/**
 * 병합(2026-09): `DB.ITEMS`(ItemDatabase)는 고정 카테고리 인터페이스(인덱스 시그니처 0)라
 * `ContentSource.ITEMS`(Record<string, any[]>)와 구조적으로 겹치지 않는다. 기본 소스 비교와
 * 기본값 주입은 이 단일 별칭을 통해서만 한다 — 캐스팅 지점을 한 곳으로 고정한다.
 */
const DB_SOURCE = DB as unknown as ContentSource;

const START_LOCATION = '시작의 마을';
const CHECKPOINT_LEVELS = [2, 5, 10, 20, 45, 60, 75];
const PROGRESSION_ANCHOR_SEED = 20_260_810;
const ORIGIN_LEVEL = 1;
const COST_INTERPOLATION_RULE = 'modeledActions(L) = round(lower.modeledActions + expFraction × (upper.modeledActions − lower.modeledActions)), '
    + 'expFraction = (cumulativeExp(L) − cumulativeExp(lower)) / (cumulativeExp(upper) − cumulativeExp(lower)); '
    + 'lower/upper are the nearest anchors below and above L. Anchored rows carry interpolation: null.';
const MAP_GATE_AUTHORITY = 'getMapAccess level rule: range levels use level[0]; a non-finite level (infinite abyss) is ungated; '
    + 'routeGateLevel is the lowest player level at which the map enters the report’s own reachability walk from the start location.';
const EXPECTED_CATALOG_COUNTS = Object.freeze({
    maps: 52,
    monsters: 254,
    quests: 143,
    jobs: 18,
    equipment: 229,
    signatures: 25,
});
// 병합(2026-09): 퀘스트 target 표기는 H5에서 소문자 'level'로 통일됐다(업적 계통과 동일).
//   구 표기 'Level'은 데이터에 남아 있지 않지만 외부 소스를 받는 함수라 둘 다 허용한다.
const SYSTEM_QUEST_TARGETS = new Set([
    'level', 'Level', 'explores', 'kills', 'bossKills', 'crafts', 'discoveries',
    'escapes', 'bountiesCompleted', 'signaturesDiscovered', 'lowHpWins',
    'crusher', 'dual', 'fortress', 'arcane',
]);

const codePointCompare = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const sorted = (values: Iterable<string>) => [...new Set(values)].sort(codePointCompare);

const itemCatalog = (source: ContentSource) => [
    ...(Array.isArray(source.ITEMS.weapons) ? source.ITEMS.weapons : []),
    ...(Array.isArray(source.ITEMS.armors) ? source.ITEMS.armors : []),
];

const allItemNames = (source: ContentSource) => new Set(
    Object.values(source.ITEMS).flatMap((group) => Array.isArray(group)
        ? group.flatMap((item) => typeof item?.name === 'string' ? [item.name] : [])
        : []),
);

const mapMonsterNames = (map: MapLike | undefined) => [
    ...(Array.isArray(map?.monsters) ? map.monsters : []),
    ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
    ...(typeof map?.boss === 'string' ? [map.boss] : []),
].filter((name): name is string => typeof name === 'string');

const mapMonsterRoutes = (maps: Record<string, MapLike>) => {
    const routes = new Map<string, Set<string>>();
    for (const [region, map] of Object.entries(maps)) {
        if (map.type === 'safe' && !canInvestigateTown(region, map)) continue;
        for (const monster of mapMonsterNames(map)) {
            if (!routes.has(monster)) routes.set(monster, new Set());
            routes.get(monster)?.add(region);
        }
    }
    return routes;
};

/**
 * 지역의 입장 레벨 — `getMapAccess`와 같은 규칙으로 읽는다.
 * 범위(`[min, max]`)는 첫 값이 입장선이고, 유한하지 않은 값('infinite')은 레벨 잠금이 없다
 * (`getMapAccess`의 `level < Number('infinite')`는 항상 false다).
 */
const mapGateLevel = (map: MapLike | undefined) => {
    const declared = Array.isArray(map?.level) ? map.level[0] : map?.level;
    const numeric = Number(declared);
    return Number.isFinite(numeric) ? numeric : ORIGIN_LEVEL;
};

/**
 * `levelCap`을 주면 그 레벨에서 실제로 걸어 들어갈 수 있는 지역만 센다.
 * 기본값(Infinity)에서는 레벨 게이트가 한 번도 걸리지 않으므로 기존 위상 전용 동작과 동일하다.
 * `visited`를 별도로 두는 이유: 레벨로 막힌 노드는 `reachable`에 들어가지 않으므로,
 * 방문 표시가 없으면 seasonOnly/고대 보물고 재투입 루프에서 큐가 무한히 자란다.
 */
const reachableFrom = (
    start: string,
    maps: Record<string, MapLike>,
    levelCap = Number.POSITIVE_INFINITY,
) => {
    const reachable = new Set<string>();
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current) || !Object.hasOwn(maps, current)) continue;
        visited.add(current);
        if (mapGateLevel(maps[current]) > levelCap) continue;
        reachable.add(current);
        const exits = Array.isArray(maps[current]?.exits) ? maps[current].exits : [];
        queue.push(...exits.filter((entry: unknown): entry is string => typeof entry === 'string'));
        for (const [name, map] of Object.entries(maps)) {
            if (!map?.seasonOnly && name !== '고대 보물고') continue;
            const entryExits = Array.isArray(map?.exits) ? map.exits : [];
            if (entryExits.some((exit: unknown) => typeof exit === 'string' && reachable.has(exit))) queue.push(name);
        }
    }
    return sorted(reachable);
};

const findInvalidExits = (maps: Record<string, MapLike>) => Object.entries(maps)
    .flatMap(([region, map]) => (Array.isArray(map?.exits) ? map.exits : [])
        .filter((exit: unknown) => typeof exit !== 'string' || !Object.hasOwn(maps, exit))
        .map((exit: unknown) => `${region}→${String(exit)}`))
    .sort(codePointCompare);

const classGraph = (classes: Record<string, ClassLike>) => {
    const reachable = new Set<string>();
    const queue = ['모험가'];
    while (queue.length > 0) {
        const job = queue.shift();
        if (!job || reachable.has(job)) continue;
        if (!Object.hasOwn(classes, job)) continue;
        reachable.add(job);
        const next: unknown[] = Array.isArray(classes[job].next) ? classes[job].next : [];
        queue.push(...next.filter((entry): entry is string => typeof entry === 'string'));
    }

    const terminalLineages: string[][] = [];
    const walk = (job: string, path: string[]) => {
        const next = Array.isArray(classes[job]?.next)
            ? classes[job].next.filter((entry: unknown): entry is string => Object.hasOwn(classes, String(entry)))
            : [];
        if (next.length === 0) {
            terminalLineages.push(path);
            return;
        }
        for (const child of [...next].sort(codePointCompare)) walk(child, [...path, child]);
    };
    if (Object.hasOwn(classes, '모험가')) walk('모험가', ['모험가']);

    return {
        reachable: sorted(reachable),
        unreachable: sorted(Object.keys(classes).filter((job) => !reachable.has(job))),
        terminalLineages: terminalLineages.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
};

const prerequisiteCycles = (quests: QuestLike[]) => {
    const byId = new Map(quests.map((quest) => [String(quest?.id), quest]));
    const cycles: Array<Array<string | number>> = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];
    const visit = (id: string) => {
        if (visited.has(id)) return;
        if (visiting.has(id)) {
            const start = stack.indexOf(id);
            const cycle = stack.slice(start).concat(id).map((entry) => byId.get(entry)?.id ?? entry);
            if (!cycles.some((existing) => JSON.stringify(existing) === JSON.stringify(cycle))) cycles.push(cycle);
            return;
        }
        const quest = byId.get(id);
        if (!quest) return;
        visiting.add(id);
        stack.push(id);
        if (quest.prerequisiteQuestId !== undefined && quest.prerequisiteQuestId !== null) {
            visit(String(quest.prerequisiteQuestId));
        }
        stack.pop();
        visiting.delete(id);
        visited.add(id);
    };
    for (const quest of quests) visit(String(quest?.id));
    return cycles.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
};

const maxShopTier = (map: MapLike | undefined) => {
    const level = typeof map?.level === 'number' ? map.level : 1;
    const tier = level < 10 ? 1 : level < 20 ? 2 : level < 30 ? 3 : level < 40 ? 4 : level < 50 ? 5 : 6;
    return Math.min(6, tier + (map?.type === 'safe' && level > 1 ? 1 : 0) + (map?.shopBonus ? 1 : 0));
};

const shopCatalogFor = (source: ContentSource, region: string, map: MapLike | undefined) => (
    source === DB_SOURCE
        ? getShopCatalog(region)
        : itemCatalog(source).filter((item) => Number(item?.tier || 1) <= maxShopTier(map))
);

const equipmentRouteReport = (source: ContentSource, maps: Record<string, MapLike>, quests: QuestLike[]) => {
    const names = allItemNames(source);
    const equipment = itemCatalog(source);
    const shops = new Map<string, string[]>();
    for (const [region, map] of Object.entries(maps)) {
        if (map?.type !== 'safe') continue;
        shops.set(region, shopCatalogFor(source, region, map)
            .filter((item): item is { name: string } => (
                typeof item.name === 'string' && equipment.some((entry) => entry.name === item.name)
            ))
            .map((item) => item.name));
    }
    const dropSources = new Map<string, Set<string>>();
    for (const [monster, drops] of Object.entries(DROP_TABLES)) {
        for (const drop of Array.isArray(drops) ? drops : []) {
            const name = typeof drop?.item === 'string' ? drop.item : '';
            if (!name) continue;
            if (!dropSources.has(name)) dropSources.set(name, new Set());
            dropSources.get(name)?.add(monster);
        }
    }
    const legacySources = new Map<string, Set<string>>();
    for (const [monster, drops] of Object.entries(LOOT_TABLE)) {
        for (const drop of Array.isArray(drops) ? drops : []) {
            if (typeof drop !== 'string') continue;
            if (!legacySources.has(drop)) legacySources.set(drop, new Set());
            legacySources.get(drop)?.add(monster);
        }
    }
    const questSources = new Map<string, Set<string>>();
    for (const quest of quests) {
        const name = quest?.reward?.item;
        if (typeof name !== 'string') continue;
        if (!questSources.has(name)) questSources.set(name, new Set());
        questSources.get(name)?.add(`quest:${String(quest.id)}`);
    }
    const routes = equipment.map((item) => {
        const kinds: AcquisitionRouteKind[] = [];
        const sources: string[] = [];
        const shopSources = [...shops.entries()]
            .filter(([, items]) => items.includes(item.name))
            .map(([region]) => region);
        if (shopSources.length > 0) {
            kinds.push('shop');
            sources.push(...shopSources);
        }
        const drops = [...(dropSources.get(item.name) || [])].sort(codePointCompare);
        if (drops.length > 0) {
            kinds.push('drop_table');
            sources.push(...drops);
        }
        const legacy = [...(legacySources.get(item.name) || [])].sort(codePointCompare);
        if (legacy.length > 0) {
            kinds.push('legacy_loot');
            sources.push(...legacy);
        }
        const questRewards = [...(questSources.get(item.name) || [])].sort(codePointCompare);
        if (questRewards.length > 0) {
            kinds.push('quest_reward');
            sources.push(...questRewards);
        }
        if (Number(item.tier) >= 4) {
            kinds.push('high_level_bonus');
            sources.push(`tier:${item.tier}`);
        }
        return {
            name: String(item.name),
            tier: Number(item.tier || 0),
            kinds,
            sources: sorted(sources),
        };
    }).sort((left, right) => codePointCompare(left.name, right.name));
    const errors: string[] = [];
    for (const item of equipment) {
        const tier = Number(item?.tier);
        const expected = BALANCE.TIER_REQ_LEVEL?.[tier];
        if (!Number.isSafeInteger(tier) || !Number.isSafeInteger(expected) || tier < 1 || tier > 6) {
            errors.push(`INVALID_EQUIPMENT_GATE:${String(item?.name)}`);
        } else if (Object.hasOwn(item, 'reqLevel') && item.reqLevel !== expected) {
            errors.push(`INVALID_EQUIPMENT_GATE:${String(item?.name)}`);
        }
        if (!names.has(item?.name)) errors.push(`INVALID_EQUIPMENT_NAME:${String(item?.name)}`);
    }
    return {
        routes,
        missingRoutes: routes.filter((entry) => entry.kinds.length === 0).map((entry) => entry.name),
        prematureEquipCount: 0,
        errors,
    };
};

const questReport = (source: ContentSource, maps: Record<string, MapLike>, quests: QuestLike[]) => {
    const routes = mapMonsterRoutes(maps);
    const itemNames = allItemNames(source);
    const byId = new Map(quests.map((quest) => [String(quest?.id), quest]));
    const invalidPrerequisites = quests
        .filter((quest) => quest?.prerequisiteQuestId !== undefined && !byId.has(String(quest.prerequisiteQuestId)))
        .map((quest) => quest.id);
    const unreachableTargets = quests.flatMap((quest) => {
        if (quest?.location && !Object.hasOwn(maps, String(quest.location))) return [quest.id];
        if (!quest?.target || SYSTEM_QUEST_TARGETS.has(quest.target)) return [];
        const targetRoutes = routes.get(String(quest.target));
        if (!targetRoutes || (quest.location && !targetRoutes.has(quest.location))) return [quest.id];
        return [];
    });
    const invalidRewards = quests.flatMap((quest) => {
        const minLv = Number(quest?.minLv);
        const reward = quest?.reward;
        const levelInvalid = !Number.isSafeInteger(minLv) || minLv < 1 || minLv > CONSTANTS.MAX_LEVEL;
        const rewardInvalid = !isPlainObject(reward)
            || (reward.exp !== undefined && (!Number.isFinite(reward.exp) || Number(reward.exp) < 0))
            || (reward.gold !== undefined && (!Number.isFinite(reward.gold) || Number(reward.gold) < 0))
            || (reward.item !== undefined && !itemNames.has(String(reward.item)));
        return levelInvalid || rewardInvalid ? [quest.id] : [];
    });
    return {
        reachable: quests.filter((quest) => !unreachableTargets.includes(quest.id)).map((quest) => quest.id),
        invalidPrerequisites: [...new Set(invalidPrerequisites)],
        prerequisiteCycles: prerequisiteCycles(quests),
        unreachableTargets: [...new Set(unreachableTargets)],
        invalidRewards: [...new Set(invalidRewards)],
    };
};

const signatureReport = (
    index: Readonly<Record<string, ReadonlyArray<{ monster: string }>>>,
    monsters: Record<string, unknown>,
) => {
    const invalidDropRoutes: string[] = [];
    const routes: Array<{ name: string; monsters: string[] }> = Object.keys(index)
        .sort(codePointCompare)
        .map((name) => {
            const rawMonsters = ((index[name] as Array<{ monster: string }> | undefined) || [])
                .map((entry) => String(entry.monster));
            for (const monster of rawMonsters) {
                if (!Object.hasOwn(monsters, monster)) invalidDropRoutes.push(`${name}→${monster}`);
            }
            const unique: string[] = [...new Set(rawMonsters.filter((monster) => Object.hasOwn(monsters, monster)))];
            unique.sort(codePointCompare);
            return { name, monsters: unique };
        });
    return {
        routes,
        missingDropRoutes: routes.filter((entry) => entry.monsters.length === 0).map((entry) => entry.name),
        invalidDropRoutes: invalidDropRoutes.sort(codePointCompare),
    };
};

const classSchemaErrors = (classes: Record<string, ClassLike>) => Object.entries(classes).flatMap(([job, value]) => {
    const isRoot = job === '모험가';
    const reqLv = value?.reqLv;
    const tier = value?.tier;
    const next = value?.next;
    const requirementInvalid = isRoot
        ? reqLv !== undefined
        : !Number.isSafeInteger(reqLv) || Number(reqLv) < 1 || Number(reqLv) > CONSTANTS.MAX_LEVEL;
    const tierInvalid = !Number.isSafeInteger(tier)
        || Number(tier) < (isRoot ? 0 : 1)
        || Number(tier) > 3;
    const nextInvalid = !Array.isArray(next)
        || next.some((name: unknown) => typeof name !== 'string' || !Object.hasOwn(classes, name));
    return requirementInvalid || tierInvalid || nextInvalid ? [`INVALID_CLASS_GATE:${job}`] : [];
});

const progressionJobErrors = (
    progression: ReturnType<typeof simulateProgression> | null,
    graph: ReturnType<typeof classGraph>,
) => {
    if (!progression) return ['PROGRESSION_JOB_AUTHORITY_MISSING'];

    const checkpointLevels = progression.checkpoints.map((checkpoint) => checkpoint.targetLevel);
    const finalCheckpoint = progression.checkpoints.at(-1);
    const errors: string[] = [];

    if (JSON.stringify(checkpointLevels) !== JSON.stringify(CHECKPOINT_LEVELS)) {
        errors.push('PROGRESSION_CHECKPOINTS_MISMATCH');
    }
    if (progression.checkpoints.some((checkpoint) => (
        checkpoint.reachedLevel < checkpoint.targetLevel
        || checkpoint.reachableJobCount !== checkpoint.reachableJobs.length
    ))) {
        errors.push('PROGRESSION_CHECKPOINT_INVALID');
    }
    if (!finalCheckpoint
        || JSON.stringify(sorted(finalCheckpoint.reachableJobs)) !== JSON.stringify(sorted(graph.reachable))) {
        errors.push('PROGRESSION_JOB_REACHABILITY_MISMATCH');
    }
    if (progression.jobSnapshots.length !== graph.reachable.length) {
        errors.push('PROGRESSION_JOB_SNAPSHOTS_MISMATCH');
    }
    return errors;
};

/** 각 지역이 열리는 최소 플레이어 레벨 — 이 리포트 자신의 도달성 보행에 레벨 상한을 씌워 구한다. */
const mapRouteGateLevels = (start: string, maps: Record<string, MapLike>) => {
    const gates = new Map<string, number>();
    const total = Object.keys(maps).length;
    for (let level = ORIGIN_LEVEL; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        for (const name of reachableFrom(start, maps, level)) {
            if (!gates.has(name)) gates.set(name, level);
        }
        if (gates.size >= total) break;
    }
    return gates;
};

const isUsableGateLevel = (level: number) => (
    Number.isSafeInteger(level) && level >= ORIGIN_LEVEL && level <= CONSTANTS.MAX_LEVEL
);

const buildCostAnchors = (
    progression: ReturnType<typeof simulateProgression> | null,
): CostAnchor[] => {
    if (!progression) return [];
    const origin: CostAnchor = {
        level: ORIGIN_LEVEL,
        source: 'simulation-origin',
        modeledActions: 0,
        modeledSeconds: 0,
        modeledHours: 0,
        cumulativeExp: cumulativeExpToLevel(ORIGIN_LEVEL),
    };
    const checkpoints: CostAnchor[] = progression.checkpoints.map((checkpoint) => ({
        level: checkpoint.targetLevel,
        source: 'checkpoint',
        modeledActions: checkpoint.modeledActions,
        modeledSeconds: checkpoint.modeledSeconds,
        modeledHours: toModeledHours(checkpoint.modeledSeconds),
        cumulativeExp: cumulativeExpToLevel(checkpoint.targetLevel),
    }));
    return [origin, ...checkpoints.filter((anchor) => anchor.level !== ORIGIN_LEVEL)]
        .sort((left, right) => left.level - right.level);
};

/**
 * 게이트 레벨 하나의 모델 비용. 앵커에 정확히 걸리면 모델 산출값 그대로(`anchored`),
 * 사이면 누적 EXP 비율 보간(`interpolated`), 앵커 밖이면 외삽하지 않고 비운다(`beyond-anchors`).
 */
const buildModeledCost = (
    level: number,
    anchors: CostAnchor[],
    secondsPerAction: number | null,
): ModeledCost => {
    const cumulativeExp = cumulativeExpToLevel(level);
    const empty = {
        level,
        modeledActions: null,
        modeledSeconds: null,
        modeledHours: null,
        cumulativeExp,
        interpolation: null,
    } as const;
    if (anchors.length === 0 || secondsPerAction === null) return { ...empty, basis: 'unavailable' };

    const exact = anchors.find((anchor) => anchor.level === level);
    if (exact) {
        return {
            level,
            basis: 'anchored',
            modeledActions: exact.modeledActions,
            modeledSeconds: exact.modeledSeconds,
            modeledHours: exact.modeledHours,
            cumulativeExp,
            interpolation: null,
        };
    }

    const lower = [...anchors].reverse().find((anchor) => anchor.level < level);
    const upper = anchors.find((anchor) => anchor.level > level);
    const expSpan = lower && upper ? upper.cumulativeExp - lower.cumulativeExp : 0;
    if (!lower || !upper || !(expSpan > 0)) return { ...empty, basis: 'beyond-anchors' };

    const expFraction = (cumulativeExp - lower.cumulativeExp) / expSpan;
    const modeledActions = Math.round(
        lower.modeledActions + expFraction * (upper.modeledActions - lower.modeledActions),
    );
    const modeledSeconds = modeledActions * secondsPerAction;
    return {
        level,
        basis: 'interpolated',
        modeledActions,
        modeledSeconds,
        modeledHours: toModeledHours(modeledSeconds),
        cumulativeExp,
        interpolation: {
            lowerLevel: lower.level,
            upperLevel: upper.level,
            lowerModeledActions: lower.modeledActions,
            upperModeledActions: upper.modeledActions,
            lowerCumulativeExp: lower.cumulativeExp,
            upperCumulativeExp: upper.cumulativeExp,
            expFraction,
        },
    };
};

interface GateEntry {
    member: string | number;
    gateLevel: number;
}

const bucketGates = (
    entries: GateEntry[],
    anchors: CostAnchor[],
    secondsPerAction: number | null,
): CostBucket[] => {
    const byLevel = new Map<number, Array<string | number>>();
    for (const entry of entries) {
        if (!byLevel.has(entry.gateLevel)) byLevel.set(entry.gateLevel, []);
        byLevel.get(entry.gateLevel)?.push(entry.member);
    }
    return [...byLevel.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([gateLevel, members]) => ({
            gateLevel,
            count: members.length,
            members: [...members].sort((left, right) => (
                typeof left === 'number' && typeof right === 'number'
                    ? left - right
                    : codePointCompare(String(left), String(right))
            )),
            cost: buildModeledCost(gateLevel, anchors, secondsPerAction),
        }));
};

const eventChainTerminalSteps = () => EVENT_CHAINS.map((chain) => ({
    chain: chain.id,
    loc: chain.steps.at(-1)?.loc ?? null,
    steps: chain.steps.length,
}));

interface CostReportInput {
    progression: ReturnType<typeof simulateProgression> | null;
    maps: Record<string, MapLike>;
    quests: QuestLike[];
    classes: Record<string, ClassLike>;
    equipment: ItemLike[];
}

const buildCostReport = ({ progression, maps, quests, classes, equipment }: CostReportInput): ContentCostReport => {
    const anchors = buildCostAnchors(progression);
    const secondsPerAction = progression?.modelPolicy.secondsPerAction ?? null;
    const malformedGates: string[] = [];

    const routeGates = mapRouteGateLevels(START_LOCATION, maps);
    const mapEntries: GateEntry[] = [];
    const mapGateDivergence: MapGateDivergence[] = [];
    for (const name of Object.keys(maps).sort(codePointCompare)) {
        const routeGateLevel = routeGates.get(name);
        if (routeGateLevel === undefined || !isUsableGateLevel(routeGateLevel)) {
            malformedGates.push(`map:${name}`);
            continue;
        }
        mapEntries.push({ member: name, gateLevel: routeGateLevel });
        const declared = maps[name]?.level;
        if (mapGateLevel(maps[name]) !== routeGateLevel) {
            mapGateDivergence.push({
                map: name,
                declaredLevel: Array.isArray(declared) ? Number(declared[0]) : declared ?? null,
                routeGateLevel,
            });
        }
    }

    const questEntries: GateEntry[] = [];
    for (const quest of quests) {
        const gateLevel = Number(quest?.minLv);
        if (!isUsableGateLevel(gateLevel)) {
            malformedGates.push(`quest:${String(quest?.id)}`);
            continue;
        }
        questEntries.push({ member: quest.id, gateLevel });
    }

    const jobEntries: GateEntry[] = [];
    for (const [job, definition] of Object.entries(classes).sort(([left], [right]) => codePointCompare(left, right))) {
        const gateLevel = definition?.reqLv === undefined || definition.reqLv === null
            ? ORIGIN_LEVEL
            : Number(definition.reqLv);
        if (!isUsableGateLevel(gateLevel)) {
            malformedGates.push(`job:${job}`);
            continue;
        }
        jobEntries.push({ member: job, gateLevel });
    }

    const tierCounts = new Map<number, number>();
    for (const item of equipment) {
        const tier = Number(item?.tier);
        const gateLevel = Number(BALANCE.TIER_REQ_LEVEL?.[tier as keyof typeof BALANCE.TIER_REQ_LEVEL]);
        if (!Number.isSafeInteger(tier) || !isUsableGateLevel(gateLevel)) {
            malformedGates.push(`equipment:${String(item?.name)}`);
            continue;
        }
        tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
    }
    const equipmentTiers: EquipmentTierCost[] = [...tierCounts.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([tier, count]) => {
            const gateLevel = Number(BALANCE.TIER_REQ_LEVEL?.[tier as keyof typeof BALANCE.TIER_REQ_LEVEL]);
            return { tier, gateLevel, count, cost: buildModeledCost(gateLevel, anchors, secondsPerAction) };
        });

    const terminals = eventChainTerminalSteps();
    const terminalEntries: GateEntry[] = [];
    const unresolvedEventChainTerminals: string[] = [];
    for (const terminal of terminals) {
        const gateLevel = terminal.loc === null ? undefined : routeGates.get(terminal.loc);
        if (gateLevel === undefined || !isUsableGateLevel(gateLevel)) {
            unresolvedEventChainTerminals.push(terminal.chain);
            continue;
        }
        terminalEntries.push({ member: terminal.chain, gateLevel });
    }

    const gates = {
        maps: bucketGates(mapEntries, anchors, secondsPerAction),
        quests: bucketGates(questEntries, anchors, secondsPerAction),
        equipmentTiers,
        jobs: bucketGates(jobEntries, anchors, secondsPerAction),
        eventChainTerminals: bucketGates(terminalEntries, anchors, secondsPerAction),
    };

    const behindLevels = [...new Set([
        ...anchors.map((anchor) => anchor.level),
        ...mapEntries.map((entry) => entry.gateLevel),
        ...questEntries.map((entry) => entry.gateLevel),
        ...jobEntries.map((entry) => entry.gateLevel),
        ...equipmentTiers.map((entry) => entry.gateLevel),
        ...terminalEntries.map((entry) => entry.gateLevel),
    ])].sort((left, right) => left - right);
    const countAtOrAbove = (entries: GateEntry[], level: number) => (
        entries.filter((entry) => entry.gateLevel >= level).length
    );
    const behind: CostBehindRow[] = behindLevels.map((level) => {
        const cost = buildModeledCost(level, anchors, secondsPerAction);
        return {
            level,
            basis: cost.basis,
            modeledActions: cost.modeledActions,
            modeledHours: cost.modeledHours,
            maps: countAtOrAbove(mapEntries, level),
            quests: countAtOrAbove(questEntries, level),
            equipment: equipmentTiers
                .filter((tier) => tier.gateLevel >= level)
                .reduce((sum, tier) => sum + tier.count, 0),
            jobs: countAtOrAbove(jobEntries, level),
            eventChainTerminalSteps: countAtOrAbove(terminalEntries, level),
        };
    });

    return {
        policy: {
            modelAuthority: progression ? 'simulateProgression' : null,
            anchorSeed: progression ? PROGRESSION_ANCHOR_SEED : null,
            anchorStatistic: 'single-seed',
            actionUnit: progression?.modelPolicy.actionUnit ?? null,
            secondsPerAction,
            secondsPerHour: MODEL_TIME_POLICY.secondsPerHour,
            actualPlayClaim: false,
            cumulativeExpAuthority: PROGRESSION_EXP_LADDER_AUTHORITY,
            mapGateAuthority: MAP_GATE_AUTHORITY,
            interpolationRule: COST_INTERPOLATION_RULE,
            limitations: [
                'Modeled actions and seconds are policy arithmetic over modeled reward settlements, not observed play time.',
                'Anchors come from one deterministic seed; the p10/p50/p90 band across 1000 seeds lives in progression-diagnostic-v2.json.',
                'Rows with basis "interpolated" are not model outputs — they are cumulative-EXP interpolations between the two named anchors.',
                'Rows with basis "beyond-anchors" carry no modeled cost; the simulation stops at the highest checkpoint level.',
            ],
        },
        anchors,
        summary: {
            eventChains: EVENT_CHAINS.length,
            eventChainSteps: terminals.reduce((sum, terminal) => sum + terminal.steps, 0),
            eventChainTerminalSteps: terminals.length,
        },
        gates,
        mapGateDivergence,
        unresolvedEventChainTerminals: unresolvedEventChainTerminals.sort(codePointCompare),
        malformedGates: malformedGates.sort(codePointCompare),
        behind,
    };
};

export const buildContentReachabilityReport = (
    source: ContentSource = DB_SOURCE,
    signatureIndex: Readonly<Record<string, ReadonlyArray<{ monster: string }>>> = getAllSignatureDropSourceIndex(),
): Readonly<ContentReachabilityReport> => {
    const maps = source.MAPS || {};
    const quests = Array.isArray(source.QUESTS) ? source.QUESTS : [];
    const graph = classGraph(source.CLASSES || {});
    const monsterRoutes = mapMonsterRoutes(maps);
    const monsterNames = Object.keys(source.MONSTERS || {}).sort(codePointCompare);
    const equipment = equipmentRouteReport(source, maps, quests);
    const questsResult = questReport(source, maps, quests);
    const signatures = signatureReport(signatureIndex, source.MONSTERS || {});
    let progression: ReturnType<typeof simulateProgression> | null = null;
    const errors = [...equipment.errors, ...classSchemaErrors(source.CLASSES || {})];
    if (source === DB_SOURCE) {
        try {
            progression = simulateProgression({ seed: PROGRESSION_ANCHOR_SEED });
        } catch (error) {
            errors.push(`PROGRESSION_SIMULATION:${error instanceof Error ? error.message : String(error)}`);
        }
        errors.push(...progressionJobErrors(progression, graph));
    }
    const reachableMaps = reachableFrom(START_LOCATION, maps);
    const catalog = {
        maps: Object.keys(maps).length,
        monsters: monsterNames.length,
        quests: quests.length,
        jobs: Object.keys(source.CLASSES || {}).length,
        equipment: itemCatalog(source).length,
        signatures: signatures.routes.length,
    };
    const report: ContentReachabilityReport = {
        schemaVersion: 2,
        catalog,
        maps: {
            start: START_LOCATION,
            reachable: reachableMaps,
            unreachable: sorted(Object.keys(maps).filter((name) => !reachableMaps.includes(name))),
            invalidExits: findInvalidExits(maps),
        },
        monsters: {
            reachable: sorted(monsterNames.filter((name) => monsterRoutes.has(name))),
            missingRoutes: sorted(monsterNames.filter((name) => !monsterRoutes.has(name))),
            routes: monsterNames.map((name) => ({ name, regions: sorted(monsterRoutes.get(name) || []) })),
        },
        quests: questsResult,
        jobs: {
            reachable: graph.reachable,
            unreachable: graph.unreachable,
            terminalLineages: graph.terminalLineages,
            checkpointLevels: progression?.checkpoints.map((checkpoint) => checkpoint.targetLevel) || [],
            checkpointSnapshots: progression?.checkpoints.map((checkpoint) => ({
                targetLevel: checkpoint.targetLevel,
                reachedLevel: checkpoint.reachedLevel,
                reachableJobCount: checkpoint.reachableJobCount,
                reachableJobs: [...checkpoint.reachableJobs],
            })) || [],
            jobSnapshotCount: progression?.jobSnapshots.length || 0,
        },
        equipment: {
            routes: equipment.routes,
            missingRoutes: equipment.missingRoutes,
            prematureEquipCount: progression?.tierEquip?.prematureEquipCount || 0,
        },
        signatures,
        cost: buildCostReport({
            progression,
            maps,
            quests,
            classes: source.CLASSES || {},
            equipment: itemCatalog(source),
        }),
        errors: [...new Set([
            ...errors,
            ...reportErrorKeys({
                catalog,
                maps: { reachable: reachableMaps, invalidExits: findInvalidExits(maps), total: Object.keys(maps).length },
                monsters: { missingRoutes: sorted(monsterNames.filter((name) => !monsterRoutes.has(name))) },
                questsResult,
                graph,
                equipment,
                signatures,
            }),
        ])].sort(codePointCompare),
    };
    return Object.freeze(report);
};

interface ReportErrorKeysInput {
    catalog: ContentReachabilityReport['catalog'];
    maps: { reachable: string[]; invalidExits: string[]; total: number };
    monsters: { missingRoutes: string[] };
    questsResult: ReturnType<typeof questReport>;
    graph: ReturnType<typeof classGraph>;
    equipment: ReturnType<typeof equipmentRouteReport>;
    signatures: ReturnType<typeof signatureReport>;
}

const reportErrorKeys = ({ catalog, maps, monsters, questsResult, graph, equipment, signatures }: ReportErrorKeysInput) => [
    ...(Object.entries(EXPECTED_CATALOG_COUNTS) as Array<[keyof typeof EXPECTED_CATALOG_COUNTS, number]>).flatMap(([key, expected]) => (
        catalog[key] === expected ? [] : [`CATALOG_COUNT_MISMATCH:${key}:${String(catalog[key])}:${expected}`]
    )),
    ...(maps.invalidExits.length > 0 ? maps.invalidExits.map((entry: string) => `INVALID_MAP_EXIT:${entry}`) : []),
    ...(maps.reachable.length !== maps.total ? ['UNREACHABLE_MAPS'] : []),
    ...(catalog.monsters > 0 ? [] : ['EMPTY_MONSTER_CATALOG']),
    ...monsters.missingRoutes.map((name: string) => `MISSING_MONSTER_ROUTE:${name}`),
    ...questsResult.invalidPrerequisites.map((id: string | number) => `INVALID_PREREQUISITE:${String(id)}`),
    ...questsResult.prerequisiteCycles.map((cycle: Array<string | number>) => `PREREQUISITE_CYCLE:${cycle.join('>')}`),
    ...questsResult.unreachableTargets.map((id: string | number) => `UNREACHABLE_QUEST_TARGET:${String(id)}`),
    ...questsResult.invalidRewards.map((id: string | number) => `INVALID_QUEST_REWARD:${String(id)}`),
    ...graph.unreachable.map((job: string) => `UNREACHABLE_JOB:${job}`),
    ...equipment.missingRoutes.map((name: string) => `MISSING_EQUIPMENT_ROUTE:${name}`),
    ...signatures.missingDropRoutes.map((name: string) => `MISSING_SIGNATURE_ROUTE:${name}`),
    ...signatures.invalidDropRoutes.map((route: string) => `INVALID_SIGNATURE_ROUTE:${route}`),
];

export const canonicalizeContentReachability = (report: ContentReachabilityReport) => report;
