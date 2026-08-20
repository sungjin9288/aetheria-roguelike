import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    RELICS,
    RELIC_SYNERGIES,
    getActiveRelicSynergies,
    getBaseRelicOfferProbability,
} from '../src/data/relics.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { applyBattleStartRelics } from '../src/utils/exploreUtils.js';
import { migrateData } from '../src/utils/gameUtils.js';
import {
    buildRelicBalanceReport,
    canonicalizeRelicBalanceReport,
    RELIC_RUNTIME_OWNER_PATHS,
} from '../src/systems/relicBalanceAudit.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSources = Object.fromEntries(RELIC_RUNTIME_OWNER_PATHS.map((sourcePath) => [
    sourcePath,
    readFileSync(path.join(ROOT, sourcePath), 'utf8'),
]));

const buildReport = (overrides = {}) => buildRelicBalanceReport({
    relics: RELICS,
    synergies: RELIC_SYNERGIES,
    runtimeSources,
    ...overrides,
});

test('Undying rarity and exact three-choice base offer probability', () => {
    const undying = RELICS.find((relic) => relic.id === 'undying');
    assert.deepEqual(undying, {
        id: 'undying',
        name: '불사의 의지',
        rarity: 'epic',
        desc: '전투마다 한 번, 생명이 1 아래로 내려가지 않음',
        effect: 'death_save',
        val: 1,
    });

    const legacyPool = RELICS.map((relic) => (
        relic.id === 'undying' ? { ...relic, rarity: 'uncommon' } : relic
    ));
    assert.equal(getBaseRelicOfferProbability(legacyPool, 'undying', 3), 0.088781751469444);
    assert.equal(getBaseRelicOfferProbability(RELICS, 'undying', 3), 0.012485766915007135);
    assert.equal(getBaseRelicOfferProbability(RELICS, 'undying', 3, { rarityCap: 'rare' }), 0);
    assert.equal(1 - ((1 - 0.088781751469444) ** 5), 0.3717795886746684);
    assert.equal(1 - ((1 - 0.012485766915007135) ** 5), 0.06088923421699066);
});

test('base relic offer probability returns zero for absent targets and fails closed on invalid inputs', () => {
    assert.equal(getBaseRelicOfferProbability(RELICS, 'not_in_pool', 3), 0);
    for (const invoke of [
        () => getBaseRelicOfferProbability(null, 'undying', 3),
        () => getBaseRelicOfferProbability(RELICS, 'undying', -1),
        () => getBaseRelicOfferProbability([
            { id: 'duplicate', rarity: 'common' },
            { id: 'duplicate', rarity: 'rare' },
        ], 'duplicate', 1),
        () => getBaseRelicOfferProbability([{ id: 'invalid-rarity', rarity: 'mythic' }], 'invalid-rarity', 1),
    ]) {
        assert.throws(invoke, { message: 'INVALID_RELIC_OFFER_POOL' });
    }
});

test('private relic weights, rarity order, and memoization helpers stay private', async () => {
    const relicModule = await import('../src/data/relics.js');
    for (const privateName of [
        'RELIC_WEIGHTS',
        'RARITY_ORDER',
        'filterByRarityCap',
        'drawOneWeighted',
        'findSynergyPityCandidates',
        'probabilityWithoutTarget',
    ]) {
        assert.equal(privateName in relicModule, false, `${privateName} must remain private`);
    }
});

test('canonical relic balance report is deterministic, complete, and owner-quoted', () => {
    const report = buildReport();
    assert.deepEqual(Object.keys(report).sort(), ['catalog', 'effects', 'errors', 'schemaVersion', 'synergies']);
    assert.deepEqual(report.catalog, {
        relicCount: 67,
        uniqueIdCount: 67,
        uniqueNameCount: 67,
        effectCount: 61,
        synergyCount: 20,
        rarityCounts: {
            common: 7,
            uncommon: 10,
            rare: 17,
            epic: 17,
            legendary: 16,
        },
    });
    assert.deepEqual(report.errors, []);
    assert.equal(report.effects.length, 61);
    const effectsByCategory = Object.fromEntries([
        'abyss-only', 'baseline-stat', 'combat-scaling', 'conditional-combat',
        'exploration-pacing', 'failure-rule', 'resource-economy', 'run-scaling',
    ].map((category) => [
        category,
        report.effects.filter((row) => row.category === category).map((row) => row.effect),
    ]));
    assert.deepEqual(effectsByCategory, {
        'abyss-only': ['abyss_atk_scale', 'abyss_crit_scale', 'abyss_floor_power'],
        'baseline-stat': [
            'ancient_power', 'armor_pen', 'battle_start_atk', 'crit_dmg', 'dual_crit',
            'elem_boost', 'fortress', 'genesis', 'glass_cannon', 'mp_mult', 'omega',
            'reflect_crit', 'skill_mult', 'stone_skin', 'titan', 'triple_up',
        ],
        'combat-scaling': ['combo_stack', 'entropy_tick', 'kill_stack_atk', 'spell_stack'],
        'conditional-combat': [
            'battle_start_buff', 'battle_start_heal', 'cd_minus', 'chaos_buff',
            'cooldown_reduce', 'crit_block', 'crit_mp_regen', 'cursed_power', 'dot_mult',
            'double_strike', 'echo_atk', 'execute_atk', 'execute_bonus', 'first_turn_evade',
            'free_skill', 'hp_drain_atk', 'low_hp_atk', 'low_hp_dmg', 'mp_regen_turn',
            'mp_restore_battle', 'on_hit_freeze', 'on_kill_heal', 'reflect', 'regen',
            'skill_lifesteal', 'status_resist',
        ],
        'exploration-pacing': ['boss_hunter', 'chaos_relic', 'event_chance'],
        'failure-rule': ['death_save', 'phoenix_revive', 'void_heart'],
        'resource-economy': ['drop_rate', 'exp_mult', 'gold_mult', 'kill_bonus'],
        'run-scaling': ['devour_hp', 'kill_stack'],
    });
    assert.deepEqual(
        [...new Set(report.effects.flatMap(({ runtimeOwners }) => runtimeOwners))].sort(),
        [...RELIC_RUNTIME_OWNER_PATHS].sort(),
    );
    for (const { effect, relicIds, runtimeOwners: ownerPaths } of report.effects) {
        assert.ok(relicIds.length > 0, `${effect} must map to a relic`);
        assert.deepEqual(relicIds, [...relicIds].sort());
        assert.ok(ownerPaths.length > 0, `${effect} must have at least one runtime owner`);
        assert.deepEqual(ownerPaths, [...new Set(ownerPaths)].sort());
        for (const sourcePath of ownerPaths) {
            const source = runtimeSources[sourcePath];
            assert.ok(
                source.includes(`'${effect}'`) || source.includes(`"${effect}"`),
                `${effect} owner must contain an exact quoted literal`,
            );
        }
    }
    assert.deepEqual(
        report.effects.find(({ effect }) => effect === 'hp_drain_atk')?.runtimeOwners,
        ['src/utils/hpDrainAtkRelic.ts'],
    );
    assert.equal(typeof canonicalizeRelicBalanceReport(report), 'object');
    assert.deepEqual(report, canonicalizeRelicBalanceReport(report));
    assert.deepEqual(report, buildReport());
});

test('relic balance audit fails closed with sorted stable validation errors', () => {
    const mutatedRelics = RELICS.map((relic) => ({ ...relic }));
    mutatedRelics[0].id = 'INVALID ID';
    mutatedRelics[1].id = mutatedRelics[2].id;
    mutatedRelics[3].name = mutatedRelics[4].name;
    mutatedRelics[5].rarity = 'mythic';
    mutatedRelics[6].effect = 'Invalid Effect';
    mutatedRelics[7].effect = 'unmapped_effect';

    const missingOwnerSources = { ...runtimeSources };
    delete missingOwnerSources['src/systems/CombatEngine.relics.ts'];
    const mutatedSynergies = RELIC_SYNERGIES.map((synergy, index) => (
        index === 0 ? { ...synergy, requires: [...synergy.requires, '없는 유물'] } : synergy
    ));
    const report = buildRelicBalanceReport({
        relics: mutatedRelics,
        synergies: mutatedSynergies,
        runtimeSources: missingOwnerSources,
    });

    assert.ok(report.errors.includes('RELIC_ID_INVALID:INVALID ID'));
    assert.ok(report.errors.some((error) => error.startsWith('RELIC_ID_DUPLICATE:')));
    assert.ok(report.errors.some((error) => error.startsWith('RELIC_NAME_DUPLICATE:')));
    assert.ok(report.errors.some((error) => error.startsWith('RELIC_RARITY_INVALID:')));
    assert.ok(report.errors.some((error) => error.startsWith('RELIC_EFFECT_INVALID:')));
    assert.ok(report.errors.includes('RELIC_EFFECT_POLICY_MISSING:unmapped_effect'));
    assert.ok(report.errors.some((error) => error.startsWith('RELIC_RUNTIME_OWNER_MISSING:')));
    assert.ok(report.errors.includes('SYNERGY_REFERENCE_INVALID:흡혈 군주:없는 유물'));
    assert.deepEqual(report.errors, [...report.errors].sort());
});

test('legacy uncommon Undying snapshot is preserved byte-for-byte by migration', () => {
    const legacyUndying = {
        id: 'undying',
        name: '불사의 의지',
        rarity: 'uncommon',
        desc: '전투마다 한 번, 생명이 1 아래로 내려가지 않음',
        effect: 'death_save',
        val: 1,
    };
    const migrated = migrateData({
        version: 5,
        player: {
            name: '구원정대',
            stats: {},
            equip: {},
            relics: [legacyUndying],
        },
    });
    assert.deepEqual(migrated.player.relics, [legacyUndying]);
});

test('death_save protects at one HP once per combat and combat start resets it', () => {
    const undying = RELICS.find((relic) => relic.id === 'undying');
    const player = { hp: 10, maxHp: 100, combatFlags: {}, meta: {}, relics: [undying] };
    const first = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);
    assert.equal(first.updatedPlayer.hp, 1);
    assert.equal(first.updatedPlayer.combatFlags.deathSaveUsedCount, 1);

    const second = CombatEngine.applyFatalProtection(first.updatedPlayer, player.relics, 100, [], []);
    assert.equal(second.updatedPlayer.hp, 0);

    const nextCombat = applyBattleStartRelics(
        { ...second.updatedPlayer, hp: 10 },
        player.relics,
        { maxHp: 100 },
        { addLog: () => {}, rng: () => 0 },
    );
    assert.equal(nextCombat.combatFlags.deathSaveUsed, false);
    assert.equal(nextCombat.combatFlags.deathSaveUsedCount, undefined);
    const nextFatal = CombatEngine.applyFatalProtection(nextCombat, player.relics, 100, [], []);
    assert.equal(nextFatal.updatedPlayer.hp, 1);
});

test('Absolute Immortality still requires Phoenix Feather and Undying Will', () => {
    const undying = RELICS.find((relic) => relic.id === 'undying');
    const phoenix = RELICS.find((relic) => relic.id === 'phoenix_feather');
    assert.equal(getActiveRelicSynergies([undying]).some((synergy) => synergy.label === '절대 불사'), false);
    assert.equal(getActiveRelicSynergies([phoenix]).some((synergy) => synergy.label === '절대 불사'), false);
    const absoluteImmortality = getActiveRelicSynergies([phoenix, undying])
        .find((synergy) => synergy.label === '절대 불사');
    assert.deepEqual(absoluteImmortality.requires, ['불사조의 깃털', '불사의 의지']);
    assert.deepEqual(absoluteImmortality.bonus, {
        effect: 'absolute_immortal',
        reviveCount: 2,
        reviveHeal: 0.5,
    });
});

test('strict relic evidence CLI rejects unsafe modes and paths and compares complete bytes', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-balance.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-balance.json';
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    assert.equal(run('--verify', outputRelative).status, 0);
    for (const args of [
        [],
        ['--unknown', outputRelative],
        ['--verify', outputRelative, '--verify', outputRelative],
        ['--verify', '../relic-balance.json'],
        ['--verify', '/tmp/relic-balance.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-balance.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-balance.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const suffix = randomUUID();
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const mismatchName = `relic-balance-mismatch-${suffix}.json`;
    const mismatchPath = path.join(evidenceDir, mismatchName);
    const symlinkName = `relic-balance-symlink-${suffix}.json`;
    const symlinkPath = path.join(evidenceDir, symlinkName);
    try {
        writeFileSync(mismatchPath, `${readFileSync(path.join(ROOT, outputRelative), 'utf8')} `);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${mismatchName}`).stderr,
            /EVIDENCE_BYTE_MISMATCH/,
        );
        symlinkSync('relic-balance.json', symlinkPath);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${symlinkName}`).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        if (existsSync(mismatchPath)) unlinkSync(mismatchPath);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
    }
});

test('canonical relic evidence binds canonical report bytes to SHA-256', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-balance.json'),
        'utf8',
    ));
    assert.deepEqual(Object.keys(evidence).sort(), ['hashAlgorithm', 'report', 'reportHash']);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    const canonicalReport = canonicalizeRelicBalanceReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
    assert.match(evidence.reportHash, /^[a-f0-9]{64}$/);
});
