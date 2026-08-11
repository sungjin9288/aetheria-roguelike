import { BALANCE, CONSTANTS } from '../data/constants.js';
import { DB } from '../data/db.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { LOOT_TABLE } from '../data/loot.js';
import { getAllSignatureDropSourceIndex } from '../utils/signatureDropSources.js';
import { getShopCatalog } from '../utils/shopRotation.js';
import { simulateProgression } from './progressionSimulator.js';

export type AcquisitionRouteKind =
    | 'shop'
    | 'drop_table'
    | 'legacy_loot'
    | 'quest_reward'
    | 'high_level_bonus';

export interface ContentReachabilityReport {
    schemaVersion: 1;
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
    errors: string[];
}

type ContentSource = {
    MAPS: Record<string, any>;
    MONSTERS: Record<string, any>;
    QUESTS: any[];
    CLASSES: Record<string, any>;
    ITEMS: Record<string, any[]>;
};

const START_LOCATION = '시작의 마을';
const CHECKPOINT_LEVELS = [2, 5, 10, 20, 45, 60, 75];
const EXPECTED_CATALOG_COUNTS = Object.freeze({
    maps: 52,
    monsters: 254,
    quests: 143,
    jobs: 18,
    equipment: 229,
    signatures: 25,
});
const SYSTEM_QUEST_TARGETS = new Set([
    'Level', 'explores', 'kills', 'bossKills', 'crafts', 'discoveries',
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

const mapMonsterNames = (map: any) => [
    ...(Array.isArray(map?.monsters) ? map.monsters : []),
    ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
    ...(typeof map?.boss === 'string' ? [map.boss] : []),
].filter((name): name is string => typeof name === 'string');

const mapMonsterRoutes = (maps: Record<string, any>) => {
    const routes = new Map<string, Set<string>>();
    for (const [region, map] of Object.entries(maps)) {
        for (const monster of mapMonsterNames(map)) {
            if (!routes.has(monster)) routes.set(monster, new Set());
            routes.get(monster)?.add(region);
        }
    }
    return routes;
};

const reachableFrom = (start: string, maps: Record<string, any>) => {
    const reachable = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || reachable.has(current) || !Object.hasOwn(maps, current)) continue;
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

const findInvalidExits = (maps: Record<string, any>) => Object.entries(maps)
    .flatMap(([region, map]) => (Array.isArray(map?.exits) ? map.exits : [])
        .filter((exit: unknown) => typeof exit !== 'string' || !Object.hasOwn(maps, exit))
        .map((exit: unknown) => `${region}→${String(exit)}`))
    .sort(codePointCompare);

const classGraph = (classes: Record<string, any>) => {
    const reachable = new Set<string>();
    const queue = ['모험가'];
    while (queue.length > 0) {
        const job = queue.shift();
        if (!job || reachable.has(job)) continue;
        if (!Object.hasOwn(classes, job)) continue;
        reachable.add(job);
        queue.push(...(Array.isArray(classes[job].next) ? classes[job].next : []));
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

const prerequisiteCycles = (quests: any[]) => {
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

const maxShopTier = (map: any) => {
    const level = typeof map?.level === 'number' ? map.level : 1;
    const tier = level < 10 ? 1 : level < 20 ? 2 : level < 30 ? 3 : level < 40 ? 4 : level < 50 ? 5 : 6;
    return Math.min(6, tier + (map?.type === 'safe' && level > 1 ? 1 : 0) + (map?.shopBonus ? 1 : 0));
};

const shopCatalogFor = (source: ContentSource, region: string, map: any) => (
    source === DB
        ? getShopCatalog(region)
        : itemCatalog(source).filter((item) => Number(item?.tier || 1) <= maxShopTier(map))
);

const equipmentRouteReport = (source: ContentSource, maps: Record<string, any>, quests: any[]) => {
    const names = allItemNames(source);
    const equipment = itemCatalog(source);
    const shops = new Map<string, string[]>();
    for (const [region, map] of Object.entries(maps)) {
        if (map?.type !== 'safe') continue;
        shops.set(region, shopCatalogFor(source, region, map)
            .filter((item) => equipment.some((entry) => entry.name === item.name))
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

const questReport = (source: ContentSource, maps: Record<string, any>, quests: any[]) => {
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
    monsters: Record<string, any>,
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

const classSchemaErrors = (classes: Record<string, any>) => Object.entries(classes).flatMap(([job, value]) => {
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

export const buildContentReachabilityReport = (
    source: ContentSource = DB as ContentSource,
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
    if (source === DB) {
        try {
            progression = simulateProgression({ seed: 20_260_810 });
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
        schemaVersion: 1,
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

const reportErrorKeys = ({ catalog, maps, monsters, questsResult, graph, equipment, signatures }: any) => [
    ...Object.entries(EXPECTED_CATALOG_COUNTS).flatMap(([key, expected]) => (
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
