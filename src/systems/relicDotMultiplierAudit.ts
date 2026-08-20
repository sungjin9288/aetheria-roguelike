import { RELICS } from '../data/relics.js';
import { AT } from '../reducers/actionTypes.js';
import { makeCombatActionMap } from '../reducers/handlers/combatHandlers.js';
import { INITIAL_STATE } from '../reducers/gameReducer.js';
import { migrateData } from '../utils/dataMigration.js';
import type { Relic } from '../types/relic.js';
import { CombatEngine } from './CombatEngine.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';

type DotRelic = Pick<Relic, 'id' | 'name' | 'rarity' | 'desc' | 'effect' | 'val'>;

export interface RelicDotMultiplierReport {
    schemaVersion: 1;
    catalog: DotRelic[];
    policy: {
        selector: 'getStrongestNumericRelicValue';
        none: number;
        deathMark: number;
        curseCrystal: number;
        bothOrders: [number, number];
    };
    production: {
        status: Array<ProductionVector>;
        nonStatus: Array<ProductionVector>;
        critical: Array<ProductionVector>;
    };
    malformed: Array<MalformedVector>;
    migration: {
        snapshots: DotRelic[];
        firstReloadPreserved: boolean;
        secondReloadPreserved: boolean;
    };
    replay: {
        receiptKey: string;
        settledOnce: boolean;
        replayIsSameObject: boolean;
        mp: number;
        enemyHp: number | null;
        enemyDots: string[];
        logCount: number;
    };
    errors: string[];
}

interface ProductionVector {
    name: string;
    mp: number;
    enemyHp: number;
    enemyDots: string[];
    cooldown: number;
    isCrit: boolean;
    rngDraws: number;
    logTexts: string[];
}

interface MalformedVector {
    name: string;
    error: string;
    rngDraws: number;
    inputUnchanged: boolean;
}

const EXPECTED_CATALOG: DotRelic[] = [
    {
        id: 'death_mark',
        name: '죽음의 낙인',
        rarity: 'rare',
        desc: '독과 화상으로 주는 피해가 3배로 증가',
        effect: 'dot_mult',
        val: 3.0,
    },
    {
        id: 'curse_crystal',
        name: '저주의 결정',
        rarity: 'rare',
        desc: '상태 이상 피해 50% 증가',
        effect: 'dot_mult',
        val: 1.5,
    },
];

const MALFORMED_VALUES: ReadonlyArray<[string, unknown]> = [
    ['missing', undefined],
    ['string', '1.5'],
    ['nan', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
];

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const asDotRelic = (relic: any): DotRelic => ({
    id: relic?.id,
    name: relic?.name,
    rarity: relic?.rarity,
    desc: relic?.desc,
    effect: relic?.effect,
    val: relic?.val,
});

const makePlayer = (relics: any[]) => ({
    name: 'dot-audit',
    job: '모험가',
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    relics,
    status: [],
    skillChoices: {},
    skillLoadout: { selected: 0, cooldowns: {} },
    combatFlags: { firstSkillUsed: true },
});

const makeEnemy = (def = 50) => ({
    name: 'dot-target',
    hp: 100,
    maxHp: 100,
    atk: 1,
    def,
});

const runProductionSkill = ({
    name,
    relics,
    effect,
    critChance = 0,
    enemyDef = 50,
}: {
    name: string;
    relics: any[];
    effect?: string;
    critChance?: number;
    enemyDef?: number;
}): ProductionVector => {
    const rolls = [0, critChance > 0 ? 0 : 0.99, 0];
    let rngDraws = 0;
    const player = makePlayer(relics);
    const enemy = makeEnemy(enemyDef);
    const result = CombatEngine.performSkill(
        player,
        enemy,
        { atk: 10, def: 0, elem: 'physical', critChance, relics, activeSynergies: [] },
        { name: '화상 시험', mp: 10, mult: 1, cooldown: 1, effect },
        () => rolls[rngDraws++] ?? 0,
    );
    return {
        name,
        mp: result.updatedPlayer.mp,
        enemyHp: result.updatedEnemy.hp,
        enemyDots: Array.isArray(result.updatedEnemy.dots) ? [...result.updatedEnemy.dots] : [],
        cooldown: result.updatedPlayer.skillLoadout.cooldowns['화상 시험'],
        isCrit: result.isCrit,
        rngDraws,
        logTexts: result.logs.map((entry: any) => entry.text),
    };
};

const runMalformedVector = (name: string, val: unknown): MalformedVector => {
    const relic = val === undefined
        ? { id: `malformed-${name}`, effect: 'dot_mult' }
        : { id: `malformed-${name}`, effect: 'dot_mult', val };
    const player = makePlayer([relic]);
    const enemy = makeEnemy();
    const beforePlayer = structuredClone(player);
    const beforeEnemy = structuredClone(enemy);
    let rngDraws = 0;
    let error = '';
    try {
        CombatEngine.performSkill(
            player,
            enemy,
            { atk: 10, def: 0, elem: 'physical', critChance: 0, relics: [relic], activeSynergies: [] },
            { name: '화상 시험', mp: 10, mult: 1, cooldown: 1, effect: 'burn' },
            () => {
                rngDraws += 1;
                return 0;
            },
        );
    } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
    }
    return {
        name,
        error,
        rngDraws,
        inputUnchanged: sameJson(player, beforePlayer) && sameJson(enemy, beforeEnemy),
    };
};

const buildMigrationVector = () => {
    const snapshots: DotRelic[] = [
        {
            id: 'death_mark',
            name: '죽음의 낙인',
            rarity: 'rare',
            desc: 'active-run death_mark description',
            effect: 'dot_mult',
            val: 2.75,
        },
        {
            id: 'curse_crystal',
            name: '저주의 결정',
            rarity: 'rare',
            desc: 'active-run curse_crystal description',
            effect: 'dot_mult',
            val: 1.25,
        },
    ];
    const first = migrateData({ version: 6, player: { name: 'legacy-dot', relics: snapshots } });
    const second = migrateData(first);
    return {
        snapshots,
        firstReloadPreserved: sameJson(first?.player?.relics, snapshots),
        secondReloadPreserved: sameJson(second?.player?.relics, snapshots),
    };
};

const buildReplayVector = () => {
    const state: any = structuredClone(INITIAL_STATE);
    state.player = {
        ...state.player,
        name: 'dot-replay',
        job: '마법사',
        hp: 200,
        maxHp: 200,
        mp: 200,
        maxMp: 200,
        atk: 100,
        relics: [EXPECTED_CATALOG[1], EXPECTED_CATALOG[0]],
        skillLoadout: { selected: 0, cooldowns: {} },
        combatFlags: { firstSkillUsed: true },
    };
    state.gameState = 'combat';
    state.enemy = {
        name: 'replay target',
        baseName: 'replay target',
        hp: 1_000,
        maxHp: 1_000,
        atk: 0,
        def: 0,
        exp: 0,
        gold: 0,
        pattern: { guardChance: 0, heavyChance: 0 },
    };
    state.combatTurn = 0;
    state.combatReceipt = null;
    const action = {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'skill', expectedTurn: 0, seed: 20260817, now: 1_700_000_000_000 },
    };
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(settled, action);
    const settledMp = settled.player.mp ?? 0;
    const settledEnemyHp = typeof settled.enemy?.hp === 'number' ? settled.enemy.hp : null;
    const settledEnemyDots = Array.isArray(settled.enemy?.dots) ? [...settled.enemy.dots] : [];
    return {
        receiptKey: settled.combatReceipt?.key || '',
        settledOnce: settled.combatTurn === 1 && settledMp < (state.player.mp ?? 0)
            && settledEnemyHp !== null && settledEnemyHp < state.enemy.hp
            && settledEnemyDots.includes('burn'),
        replayIsSameObject: replayed === settled,
        mp: settledMp,
        enemyHp: settledEnemyHp,
        enemyDots: settledEnemyDots,
        logCount: settled.logs.length,
    };
};

export const canonicalizeRelicDotMultiplierReport = (
    report: RelicDotMultiplierReport,
): RelicDotMultiplierReport => ({
    schemaVersion: 1,
    catalog: report.catalog.map((relic) => ({ ...relic })),
    policy: {
        selector: 'getStrongestNumericRelicValue',
        none: report.policy.none,
        deathMark: report.policy.deathMark,
        curseCrystal: report.policy.curseCrystal,
        bothOrders: [...report.policy.bothOrders] as [number, number],
    },
    production: {
        status: report.production.status.map((vector) => ({ ...vector, enemyDots: [...vector.enemyDots], logTexts: [...vector.logTexts] })),
        nonStatus: report.production.nonStatus.map((vector) => ({ ...vector, enemyDots: [...vector.enemyDots], logTexts: [...vector.logTexts] })),
        critical: report.production.critical.map((vector) => ({ ...vector, enemyDots: [...vector.enemyDots], logTexts: [...vector.logTexts] })),
    },
    malformed: report.malformed.map((vector) => ({ ...vector })),
    migration: {
        snapshots: report.migration.snapshots.map((relic) => ({ ...relic })),
        firstReloadPreserved: report.migration.firstReloadPreserved,
        secondReloadPreserved: report.migration.secondReloadPreserved,
    },
    replay: { ...report.replay, enemyDots: [...report.replay.enemyDots] },
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicDotMultiplierReport = ({
    relics = RELICS,
}: {
    relics?: readonly Relic[];
} = {}): RelicDotMultiplierReport => {
    const errors = new Set<string>();
    const catalog = relics.filter((relic) => relic.effect === 'dot_mult').map(asDotRelic);
    const deathMark = catalog.find((relic) => relic.id === 'death_mark');
    const curseCrystal = catalog.find((relic) => relic.id === 'curse_crystal');
    if (!sameJson(catalog, EXPECTED_CATALOG)) errors.add('DOT_MULT_CATALOG_POLICY_MISMATCH');

    const safeValue = (relic: DotRelic | undefined) => (
        typeof relic?.val === 'number' && Number.isFinite(relic.val) && relic.val >= 0
            ? relic.val
            : 0
    );
    const policy = {
        selector: 'getStrongestNumericRelicValue' as const,
        none: getStrongestNumericRelicValue([], 'dot_mult'),
        deathMark: deathMark ? getStrongestNumericRelicValue([deathMark], 'dot_mult') : 0,
        curseCrystal: curseCrystal ? getStrongestNumericRelicValue([curseCrystal], 'dot_mult') : 0,
        bothOrders: deathMark && curseCrystal
            ? [
                getStrongestNumericRelicValue([deathMark, curseCrystal], 'dot_mult'),
                getStrongestNumericRelicValue([curseCrystal, deathMark], 'dot_mult'),
            ] as [number, number]
            : [0, 0] as [number, number],
    };
    if (policy.none !== 0
        || policy.deathMark !== 3
        || policy.curseCrystal !== 1.5
        || policy.bothOrders[0] !== 3
        || policy.bothOrders[1] !== 3) {
        errors.add('DOT_MULT_SELECTOR_POLICY_MISMATCH');
    }

    const status = [
        runProductionSkill({ name: 'no_relic_zero_def', relics: [], effect: 'burn', enemyDef: 0 }),
        runProductionSkill({ name: 'none', relics: [], effect: 'burn' }),
        runProductionSkill({ name: 'death_mark', relics: [EXPECTED_CATALOG[0]], effect: 'burn' }),
        runProductionSkill({ name: 'curse_crystal', relics: [EXPECTED_CATALOG[1]], effect: 'burn' }),
        runProductionSkill({ name: 'death_then_curse', relics: [EXPECTED_CATALOG[0], EXPECTED_CATALOG[1]], effect: 'burn' }),
        runProductionSkill({ name: 'curse_then_death', relics: [EXPECTED_CATALOG[1], EXPECTED_CATALOG[0]], effect: 'burn' }),
    ];
    const nonStatus = [
        runProductionSkill({ name: 'none', relics: [] }),
        runProductionSkill({ name: 'both', relics: [EXPECTED_CATALOG[1], EXPECTED_CATALOG[0]] }),
    ];
    const critical = [
        runProductionSkill({ name: 'death_then_curse', relics: [EXPECTED_CATALOG[0], EXPECTED_CATALOG[1]], effect: 'burn', critChance: 1 }),
        runProductionSkill({ name: 'curse_then_death', relics: [EXPECTED_CATALOG[1], EXPECTED_CATALOG[0]], effect: 'burn', critChance: 1 }),
    ];
    const malformed = MALFORMED_VALUES.map(([name, val]) => runMalformedVector(name, val));
    const migration = buildMigrationVector();
    const replay = buildReplayVector();

    const statusHp = status.map((vector) => vector.enemyHp);
    if (!sameJson(statusHp, [90, 94, 91, 93, 91, 91])
        || status.some((vector) => vector.mp !== 90 || vector.cooldown !== 1 || !sameJson(vector.enemyDots, ['burn']) || vector.rngDraws !== 3)) {
        errors.add('DOT_MULT_PRODUCTION_ORDER_MISMATCH');
    }
    if (!status[0].logTexts.some((text) => text.includes('[burn] 추가 피해 +1'))) {
        errors.add('DOT_MULT_NO_RELIC_BASELINE_REGRESSION');
    }
    if (!sameJson(nonStatus.map((vector) => vector.enemyHp), [94, 94])
        || nonStatus.some((vector) => vector.enemyDots.length !== 0 || vector.rngDraws !== 2)) {
        errors.add('DOT_MULT_NON_STATUS_REGRESSION');
    }
    if (!sameJson(critical.map((vector) => vector.enemyHp), [82, 82])
        || critical.some((vector) => !vector.isCrit || vector.rngDraws !== 3)) {
        errors.add('DOT_MULT_CRIT_MITIGATION_REGRESSION');
    }
    if (malformed.some((vector) => !vector.error.startsWith('INVALID_RELIC_EFFECT_VALUE:')
        || vector.rngDraws !== 0
        || !vector.inputUnchanged)) {
        errors.add('DOT_MULT_MALFORMED_FAIL_OPEN');
    }
    if (!migration.firstReloadPreserved || !migration.secondReloadPreserved) {
        errors.add('DOT_MULT_MIGRATION_REWRITE');
    }
    if (!replay.settledOnce || !replay.replayIsSameObject || replay.receiptKey !== '1:1700000000000:20260817') {
        errors.add('DOT_MULT_REPLAY_REGRESSION');
    }
    if (deathMark && safeValue(deathMark) !== policy.deathMark) errors.add('DOT_MULT_DEATH_MARK_VALUE_MISMATCH');
    if (curseCrystal && safeValue(curseCrystal) !== policy.curseCrystal) errors.add('DOT_MULT_CURSE_CRYSTAL_VALUE_MISMATCH');

    return canonicalizeRelicDotMultiplierReport({
        schemaVersion: 1,
        catalog,
        policy,
        production: { status, nonStatus, critical },
        malformed,
        migration,
        replay,
        errors: [...errors],
    });
};
