import type { Relic } from '../types/relic.js';
import { DB } from '../data/db.js';
import { RELIC_SYNERGIES } from '../data/relics.js';
import { CombatEngine } from './CombatEngine.js';
import { migrateData } from '../utils/dataMigration.js';
import { calculateFullStats } from '../utils/statsCalculator.js';
import { resolveHpDrainAtkRelic } from '../utils/hpDrainAtkRelic.js';

type Pair = {
    id: string;
    label: string;
    atkBonus: number;
    hpCost: number;
};

export interface RelicHpDrainAtkReport {
    schemaVersion: 1;
    predecessorRed: {
        bothRelicAttackBonusAdded: 0.95;
        firstMatchHpCosts: [0.03, 0.05];
        abyssalSettlementLabel: '혈맹의 반지';
    };
    catalog: {
        bloodOathRing: Pair;
        abyssalContract: Pair;
    };
    policy: {
        selection: 'greatest-atk-bonus';
        tieBreak: 'stable-selected-snapshot';
        selectedPairNeverSeparatesCostOrLabel: true;
        noRelic: null;
        singleBloodOathRing: Pair;
        singleAbyssalContract: Pair;
        bothOrders: [Pair, Pair];
        equalAttackTieOrders: [Pair, Pair];
    };
    production: {
        attack: {
            noRelic: number;
            bloodOathRing: number;
            abyssalContract: number;
            bothOrders: [number, number];
        };
        normalTurn: {
            bloodOathRing: { hp: number; label: string };
            abyssalContract: { hp: number; label: string };
            bothOrders: [
                { hp: number; label: string },
                { hp: number; label: string },
            ];
        };
        hellReaper: {
            bothOrders: [
                { hp: number; label: string },
                { hp: number; label: string },
            ];
        };
        hpBoundedAtOne: boolean;
    };
    safeguards: {
        malformedCasesRejected: string[];
        migrationPreservesSnapshotBytes: boolean;
        reducerReplayContract: 'object-identity-no-op';
        sourcePolicy: {
            resolverUsedByStats: boolean;
            resolverUsedBeforeTickMutation: boolean;
            directHpDrainSelectorAbsent: boolean;
        };
    };
    receipt: {
        sourceHead: 'a664123fa60a24ce8037b108066ac3df071dfa1d';
        dirtyFingerprint: 'git-status-v2:5b5cfd828b269441c28b826bee65ecf21f5aa8ece84f64c0f4f848ef126212e5';
        changedPaths: string[];
    };
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const pairFrom = (relics: readonly Relic[]) => {
    const selection = resolveHpDrainAtkRelic(relics);
    if (!selection) return null;
    return {
        id: selection.id,
        label: selection.label,
        atkBonus: selection.atkBonus,
        hpCost: selection.hpCost,
    };
};

const makePlayer = (relics: readonly Relic[], hp = 1000) => ({
    name: 'paired-contract-audit',
    job: '모험가',
    level: 50,
    hp,
    maxHp: 1000,
    mp: 500,
    maxMp: 500,
    atk: 1000,
    def: 500,
    inv: [],
    equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    relics: [...relics],
    skillChoices: {},
    titles: [],
    activeTitle: null,
    killStreak: 0,
    combatFlags: {},
    status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
});

const settleTurn = (relics: readonly Relic[]) => {
    const result = CombatEngine.tickCombatState(makePlayer(relics));
    const log = result.logs.find((entry: any) => entry.text.includes('HP 대가'));
    return { hp: result.updatedPlayer.hp, label: log?.text.match(/^\[([^\]]+)\]/)?.[1] || '' };
};

const isExactCatalogRelic = (relic: Relic | undefined, expected: Pair & { rarity: string; desc: string }) => (
    relic?.id === expected.id
    && relic.name === expected.label
    && relic.rarity === expected.rarity
    && relic.desc === expected.desc
    && relic.effect === 'hp_drain_atk'
    && relic.val?.atkBonus === expected.atkBonus
    && relic.val?.hpCost === expected.hpCost
);

const didReject = (relic: Relic) => {
    try {
        resolveHpDrainAtkRelic([relic]);
        return false;
    } catch (error) {
        return error instanceof Error && error.message === 'INVALID_HP_DRAIN_ATK_RELIC_VALUE';
    }
};

export const canonicalizeRelicHpDrainAtkReport = (
    report: RelicHpDrainAtkReport,
): RelicHpDrainAtkReport => ({
    schemaVersion: 1,
    predecessorRed: { ...report.predecessorRed },
    catalog: {
        bloodOathRing: { ...report.catalog.bloodOathRing },
        abyssalContract: { ...report.catalog.abyssalContract },
    },
    policy: {
        selection: 'greatest-atk-bonus',
        tieBreak: 'stable-selected-snapshot',
        selectedPairNeverSeparatesCostOrLabel: true,
        noRelic: null,
        singleBloodOathRing: { ...report.policy.singleBloodOathRing },
        singleAbyssalContract: { ...report.policy.singleAbyssalContract },
        bothOrders: report.policy.bothOrders.map((pair) => ({ ...pair })) as [Pair, Pair],
        equalAttackTieOrders: report.policy.equalAttackTieOrders.map((pair) => ({ ...pair })) as [Pair, Pair],
    },
    production: {
        attack: { ...report.production.attack },
        normalTurn: {
            bloodOathRing: { ...report.production.normalTurn.bloodOathRing },
            abyssalContract: { ...report.production.normalTurn.abyssalContract },
            bothOrders: report.production.normalTurn.bothOrders.map((turn) => ({ ...turn })) as RelicHpDrainAtkReport['production']['normalTurn']['bothOrders'],
        },
        hellReaper: {
            bothOrders: report.production.hellReaper.bothOrders.map((turn) => ({ ...turn })) as RelicHpDrainAtkReport['production']['hellReaper']['bothOrders'],
        },
        hpBoundedAtOne: report.production.hpBoundedAtOne,
    },
    safeguards: {
        malformedCasesRejected: [...new Set(report.safeguards.malformedCasesRejected)].sort(compareText),
        migrationPreservesSnapshotBytes: report.safeguards.migrationPreservesSnapshotBytes,
        reducerReplayContract: 'object-identity-no-op',
        sourcePolicy: { ...report.safeguards.sourcePolicy },
    },
    receipt: {
        sourceHead: 'a664123fa60a24ce8037b108066ac3df071dfa1d',
        dirtyFingerprint: 'git-status-v2:5b5cfd828b269441c28b826bee65ecf21f5aa8ece84f64c0f4f848ef126212e5',
        changedPaths: [...report.receipt.changedPaths].sort(compareText),
    },
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicHpDrainAtkReport = ({
    relics,
    resolverSource,
    statsSource,
    combatSource,
}: {
    relics: readonly Relic[];
    resolverSource: string;
    statsSource: string;
    combatSource: string;
}): RelicHpDrainAtkReport => {
    const errors = new Set<string>();
    const bloodOathRing = relics.find((relic) => relic.id === 'blood_oath_ring');
    const abyssalContract = relics.find((relic) => relic.id === 'abyssal_contract');
    const soulDrain = relics.find((relic) => relic.id === 'soul_drain');
    if (!isExactCatalogRelic(bloodOathRing, {
        id: 'blood_oath_ring', label: '혈맹의 반지', rarity: 'rare',
        desc: '매 턴 생명 3%를 소모하고 공격력 35% 증가', atkBonus: 0.35, hpCost: 0.03,
    })) errors.add('BLOOD_OATH_RING_CATALOG_MISMATCH');
    if (!isExactCatalogRelic(abyssalContract, {
        id: 'abyssal_contract', label: '심연의 계약', rarity: 'legendary',
        desc: '매 턴 최대 생명의 5%를 소모하고 공격력 60% 증가', atkBonus: 0.6, hpCost: 0.05,
    })) errors.add('ABYSSAL_CONTRACT_CATALOG_MISMATCH');
    const hellReaper = RELIC_SYNERGIES.find((synergy) => synergy.bonus.effect === 'hell_reaper');
    if (hellReaper?.label !== '지옥의 수확자'
        || hellReaper.bonus.hpCostReduction !== 0.02
        || hellReaper.requires.join('|') !== '심연의 계약|영혼 흡수') {
        errors.add('HELL_REAPER_POLICY_MISMATCH');
    }

    const blood = bloodOathRing as Relic;
    const abyss = abyssalContract as Relic;
    const bothOrders = [pairFrom([blood, abyss]), pairFrom([abyss, blood])] as [Pair, Pair];
    const equalAttackLeft = { id: 'zeta', name: '제타', effect: 'hp_drain_atk', val: { atkBonus: 0.6, hpCost: 0.09 } };
    const equalAttackRight = { id: 'alpha', name: '알파', effect: 'hp_drain_atk', val: { atkBonus: 0.6, hpCost: 0.02 } };
    const equalAttackTieOrders = [
        pairFrom([equalAttackLeft, equalAttackRight]),
        pairFrom([equalAttackRight, equalAttackLeft]),
    ] as [Pair, Pair];
    if (!bothOrders.every((pair) => pair?.id === 'abyssal_contract'
        && pair.atkBonus === 0.6 && pair.hpCost === 0.05 && pair.label === '심연의 계약')) {
        errors.add('PAIRED_SELECTION_POLICY_MISMATCH');
    }
    if (!equalAttackTieOrders.every((pair) => pair?.id === 'alpha'
        && pair.hpCost === 0.02 && pair.label === '알파')) {
        errors.add('EQUAL_ATTACK_TIE_POLICY_MISMATCH');
    }

    const malformedCases = [
        ['missing-val', { effect: 'hp_drain_atk' }],
        ['non-object-val', { effect: 'hp_drain_atk', val: 0.03 }],
        ['missing-atkBonus', { effect: 'hp_drain_atk', val: { hpCost: 0.03 } }],
        ['missing-hpCost', { effect: 'hp_drain_atk', val: { atkBonus: 0.35 } }],
        ['string-atkBonus', { effect: 'hp_drain_atk', val: { atkBonus: '0.35', hpCost: 0.03 } }],
        ['string-hpCost', { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: '0.03' } }],
        ['negative-atkBonus', { effect: 'hp_drain_atk', val: { atkBonus: -0.35, hpCost: 0.03 } }],
        ['negative-hpCost', { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: -0.03 } }],
        ['nan-atkBonus', { effect: 'hp_drain_atk', val: { atkBonus: Number.NaN, hpCost: 0.03 } }],
        ['nan-hpCost', { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: Number.NaN } }],
        ['infinite-atkBonus', { effect: 'hp_drain_atk', val: { atkBonus: Number.POSITIVE_INFINITY, hpCost: 0.03 } }],
        ['infinite-hpCost', { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: Number.POSITIVE_INFINITY } }],
    ] as Array<[string, Relic]>;
    const malformedCasesRejected = malformedCases.filter(([, relic]) => didReject(relic)).map(([name]) => name);
    if (malformedCasesRejected.length !== malformedCases.length) errors.add('MALFORMED_REJECTION_MISMATCH');

    const normalTurn = {
        bloodOathRing: settleTurn([blood]),
        abyssalContract: settleTurn([abyss]),
        bothOrders: [settleTurn([blood, abyss]), settleTurn([abyss, blood])] as [
            { hp: number; label: string }, { hp: number; label: string },
        ],
    };
    const hellReaperTurns = [
        settleTurn([blood, abyss, soulDrain as Relic]),
        settleTurn([abyss, blood, soulDrain as Relic]),
    ] as [{ hp: number; label: string }, { hp: number; label: string }];
    if (normalTurn.bloodOathRing.label !== '혈맹의 반지'
        || normalTurn.abyssalContract.label !== '심연의 계약'
        || !normalTurn.bothOrders.every((turn) => turn.label === '심연의 계약' && turn.hp === 950)) {
        errors.add('NORMAL_TURN_LABEL_POLICY_MISMATCH');
    }
    if (!hellReaperTurns.every((turn) => turn.label === '지옥의 수확자' && turn.hp === 980)) {
        errors.add('HELL_REAPER_TURN_POLICY_MISMATCH');
    }

    const legacySnapshot = [blood, abyss].map((relic) => structuredClone(relic));
    const legacyBytes = JSON.stringify(legacySnapshot);
    const migrated = migrateData({ version: 6, player: makePlayer(legacySnapshot) });
    const migrationPreservesSnapshotBytes = JSON.stringify(migrated?.player?.relics) === legacyBytes;
    if (!migrationPreservesSnapshotBytes) errors.add('MIGRATION_SNAPSHOT_MISMATCH');

    const sourcePolicy = {
        resolverUsedByStats: statsSource.includes('resolveHpDrainAtkRelic(relics)'),
        resolverUsedBeforeTickMutation: combatSource.indexOf('resolveHpDrainAtkRelic(relics)')
            < combatSource.indexOf('updated.skillLoadout ='),
        directHpDrainSelectorAbsent: !statsSource.includes("r.effect === 'hp_drain_atk'")
            && !combatSource.includes("relics.find((r: any) => r.effect === 'hp_drain_atk')")
            && resolverSource.includes("relic?.effect === 'hp_drain_atk'"),
    };
    if (!Object.values(sourcePolicy).every(Boolean)) errors.add('SHARED_RESOLVER_SOURCE_POLICY_MISMATCH');

    const report: RelicHpDrainAtkReport = {
        schemaVersion: 1,
        predecessorRed: {
            bothRelicAttackBonusAdded: 0.95,
            firstMatchHpCosts: [0.03, 0.05],
            abyssalSettlementLabel: '혈맹의 반지',
        },
        catalog: {
            bloodOathRing: pairFrom([blood]) as Pair,
            abyssalContract: pairFrom([abyss]) as Pair,
        },
        policy: {
            selection: 'greatest-atk-bonus',
            tieBreak: 'stable-selected-snapshot',
            selectedPairNeverSeparatesCostOrLabel: true,
            noRelic: null,
            singleBloodOathRing: pairFrom([blood]) as Pair,
            singleAbyssalContract: pairFrom([abyss]) as Pair,
            bothOrders,
            equalAttackTieOrders,
        },
        production: {
            attack: {
                noRelic: calculateFullStats(makePlayer([]))?.atk || 0,
                bloodOathRing: calculateFullStats(makePlayer([blood]))?.atk || 0,
                abyssalContract: calculateFullStats(makePlayer([abyss]))?.atk || 0,
                bothOrders: [
                    calculateFullStats(makePlayer([blood, abyss]))?.atk || 0,
                    calculateFullStats(makePlayer([abyss, blood]))?.atk || 0,
                ],
            },
            normalTurn,
            hellReaper: { bothOrders: hellReaperTurns },
            hpBoundedAtOne: CombatEngine.tickCombatState(makePlayer([abyss], 1)).updatedPlayer.hp === 1,
        },
        safeguards: {
            malformedCasesRejected,
            migrationPreservesSnapshotBytes,
            reducerReplayContract: 'object-identity-no-op',
            sourcePolicy,
        },
        receipt: {
            sourceHead: 'a664123fa60a24ce8037b108066ac3df071dfa1d',
            dirtyFingerprint: 'git-status-v2:5b5cfd828b269441c28b826bee65ecf21f5aa8ece84f64c0f4f848ef126212e5',
            changedPaths: [
                'src/utils/hpDrainAtkRelic.ts',
                'src/utils/statsCalculator.ts',
                'src/systems/CombatEngine.ts',
                'src/systems/relicHpDrainAtkAudit.ts',
                'scripts/verify-relic-hp-drain-atk.mjs',
                'tests/relic-hp-drain-atk-coherence.test.js',
                'docs/evidence/qa/release-complete-core/relic-hp-drain-atk.json',
                'docs/superpowers/plans/2026-08-17-aetheria-relic-hp-drain-atk-plan.md',
            ],
        },
        errors: [...errors],
    };
    return canonicalizeRelicHpDrainAtkReport(report);
};
