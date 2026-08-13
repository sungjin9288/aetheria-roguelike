import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CLASSES } from '../src/data/classes.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getStrongestNumericRelicValue } from '../src/systems/CombatEngine.actions.ts';
import {
    buildRelicFreeSkillReport,
    canonicalizeRelicFreeSkillReport,
} from '../src/systems/relicFreeSkillAudit.ts';
import { migrateData } from '../src/utils/gameUtils.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const makeRelic = (id, val) => ({
    id,
    name: id,
    effect: 'free_skill',
    val,
});

const spellEcho = makeRelic('spell_echo', 0.08);
const timeRing = makeRelic('time_ring', 0.15);

const makePlayer = (relics) => ({
    name: 'tester',
    job: '모험가',
    level: 10,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    relics,
    skillChoices: {},
    titles: [],
    activeTitle: null,
    killStreak: 0,
    combatFlags: { firstSkillUsed: true },
    status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
});

const enemy = {
    name: '훈련용 허수아비',
    hp: 10_000,
    maxHp: 10_000,
    atk: 1,
    def: 0,
};

const skill = {
    name: '시험 기술',
    mp: 40,
    mult: 1,
    cooldown: 2,
};

const useSkill = (relics, roll, activeSynergies = []) => CombatEngine.performSkill(
    makePlayer(relics),
    enemy,
    {
        atk: 10,
        def: 0,
        elem: 'physical',
        critChance: 0,
        relics,
        activeSynergies,
    },
    skill,
    () => roll,
);

test('free_skill numeric selector is strongest-only and order independent', () => {
    assert.equal(getStrongestNumericRelicValue([], 'free_skill'), 0);
    assert.equal(getStrongestNumericRelicValue([spellEcho], 'free_skill'), 0.08);
    assert.equal(getStrongestNumericRelicValue([timeRing], 'free_skill'), 0.15);
    assert.equal(getStrongestNumericRelicValue([spellEcho, timeRing], 'free_skill'), 0.15);
    assert.equal(getStrongestNumericRelicValue([timeRing, spellEcho], 'free_skill'), 0.15);
});

test('canonical free_skill catalog presents an uncommon eight-percent step and epic fifteen-percent upgrade', () => {
    const family = RELICS.filter((relic) => relic.effect === 'free_skill');
    assert.deepEqual(
        family.map(({ id, rarity, val }) => ({ id, rarity, val })),
        [
            { id: 'spell_echo', rarity: 'uncommon', val: 0.08 },
            { id: 'time_ring', rarity: 'epic', val: 0.15 },
        ],
    );
    assert.match(family[0].desc, /8%.*기력을 소모하지 않음/);
    assert.match(family[1].desc, /15%.*기력을 소모하지 않음/);
    assert.doesNotMatch(family[1].desc, /재사용 대기/);
});

test('free_skill numeric selector rejects malformed matching values', () => {
    for (const val of [undefined, '0.15', Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
        assert.throws(
            () => getStrongestNumericRelicValue([makeRelic('malformed', val)], 'free_skill'),
            /INVALID_RELIC_EFFECT_VALUE/,
        );
    }

    assert.equal(
        getStrongestNumericRelicValue([{ effect: 'another_effect', val: Number.NaN }], 'free_skill'),
        0,
    );
});

test('spell echo uses its exact eight-percent threshold', () => {
    assert.equal(useSkill([spellEcho], 0.079999).updatedPlayer.mp, 100);
    assert.equal(useSkill([spellEcho], 0.080001).updatedPlayer.mp, 60);
});

test('time ring and both ownership orders use the exact fifteen-percent threshold', () => {
    assert.equal(useSkill([timeRing], 0.149999).updatedPlayer.mp, 100);
    assert.equal(useSkill([timeRing], 0.150001).updatedPlayer.mp, 60);

    for (const relics of [[spellEcho, timeRing], [timeRing, spellEcho]]) {
        assert.equal(useSkill(relics, 0.149999).updatedPlayer.mp, 100);
        assert.equal(useSkill(relics, 0.150001).updatedPlayer.mp, 60);
    }
});

test('arcane singularity adds after the strongest base chance without duplicate stacking', () => {
    const arcaneSingularity = [{
        id: 'arcane-singularity',
        bonus: { effect: 'arcane_singularity', freeSkillChance: 0.35 },
    }];

    assert.equal(useSkill([spellEcho], 0.429999, arcaneSingularity).updatedPlayer.mp, 100);
    assert.equal(useSkill([spellEcho], 0.430001, arcaneSingularity).updatedPlayer.mp, 60);
    assert.equal(useSkill([spellEcho, timeRing], 0.499999, arcaneSingularity).updatedPlayer.mp, 100);
    assert.equal(useSkill([timeRing, spellEcho], 0.500001, arcaneSingularity).updatedPlayer.mp, 60);
});

test('legacy active-run free_skill values remain authoritative snapshots', () => {
    const legacySpellEcho = {
        id: 'spell_echo',
        name: '주문 메아리',
        rarity: 'uncommon',
        desc: '기술을 사용할 때 15% 확률로 기력을 소모하지 않음',
        effect: 'free_skill',
        val: 0.15,
    };

    assert.equal(useSkill([legacySpellEcho], 0.149999).updatedPlayer.mp, 100);
    assert.equal(useSkill([legacySpellEcho], 0.150001).updatedPlayer.mp, 60);
    assert.equal(legacySpellEcho.val, 0.15);
});

test('production migration preserves legacy free_skill snapshots byte-for-byte', () => {
    const legacyRelics = [
        {
            id: 'spell_echo',
            name: '주문 메아리',
            rarity: 'uncommon',
            desc: '기술을 사용할 때 15% 확률로 기력을 소모하지 않음',
            effect: 'free_skill',
            val: 0.15,
        },
        {
            id: 'time_ring',
            name: '시공의 반지',
            rarity: 'epic',
            desc: '기술을 사용할 때 15% 확률로 재사용 대기가 늘지 않음',
            effect: 'free_skill',
            val: 0.15,
        },
    ];
    const migrated = migrateData({ version: 6, player: { name: 'legacy', relics: legacyRelics } });

    assert.deepEqual(migrated.player.relics, legacyRelics);
});

test('cooldown first-free remains higher priority than free_skill probability', () => {
    const firstFree = {
        id: 'time-crown',
        effect: 'cooldown_reduce',
        val: { cdReduction: 1, firstFree: true },
    };
    const player = makePlayer([spellEcho, firstFree]);
    player.combatFlags.firstSkillUsed = false;

    const result = CombatEngine.performSkill(
        player,
        enemy,
        { atk: 10, def: 0, elem: 'physical', critChance: 0, relics: player.relics, activeSynergies: [] },
        skill,
        () => 0.99,
    );

    assert.equal(result.updatedPlayer.mp, 100);
    assert.equal(result.updatedPlayer.skillLoadout.cooldowns[skill.name], 1);
    assert.ok(result.logs.some((entry) => entry.text.includes('시간 군주의 왕관')));
});

test('free_skill audit binds the candidate policy to all eighteen canonical jobs', () => {
    const report = buildRelicFreeSkillReport({
        relics: RELICS,
        synergies: RELIC_SYNERGIES,
        classes: CLASSES,
    });

    assert.deepEqual(report.predecessor, {
        spellEchoChance: 0.15,
        timeRingChance: 0.15,
    });
    assert.deepEqual(report.candidate, {
        spellEchoChance: 0.08,
        timeRingChance: 0.15,
        bothOrdersChance: [0.15, 0.15],
    });
    assert.deepEqual(report.synergy, {
        addedChance: 0.35,
        spellEchoCombined: 0.43,
        timeRingCombined: 0.5,
    });
    assert.equal(report.jobMatrix.length, 18);
    assert.equal(new Set(report.jobMatrix.map((row) => row.job)).size, 18);
    assert.deepEqual(report.errors, []);
    for (const row of report.jobMatrix) {
        assert.ok(row.representativeSkill.length > 0);
        assert.ok(Number.isFinite(row.mpCost) && row.mpCost > 0);
        assert.deepEqual(row.expectedMpSavedPerUse, {
            predecessorUncommon: row.mpCost * 0.15,
            candidateUncommon: row.mpCost * 0.08,
            epic: row.mpCost * 0.15,
        });
    }
    assert.deepEqual(report, canonicalizeRelicFreeSkillReport(report));
    assert.deepEqual(report, buildRelicFreeSkillReport({
        relics: RELICS,
        synergies: RELIC_SYNERGIES,
        classes: CLASSES,
    }));
    assert.deepEqual(
        buildRelicFreeSkillReport({
            relics: [...RELICS].reverse(),
            synergies: RELIC_SYNERGIES,
            classes: CLASSES,
        }).errors,
        [],
    );
});

test('free_skill audit fails closed on catalog, synergy, and job-skill drift', () => {
    const relics = RELICS.map((relic) => ({ ...relic }));
    relics.find((relic) => relic.id === 'spell_echo').val = Number.NaN;
    relics.find((relic) => relic.id === 'time_ring').desc = '재사용 대기 15%';
    const synergies = RELIC_SYNERGIES.map((synergy) => ({
        ...synergy,
        bonus: { ...synergy.bonus },
    }));
    synergies.find((synergy) => synergy.bonus.effect === 'arcane_singularity')
        .bonus.freeSkillChance = 0.5;
    const classes = Object.fromEntries(Object.entries(CLASSES).map(([job, classData]) => [
        job,
        { ...classData, skills: classData.skills.map((entry) => ({ ...entry })) },
    ]));
    classes['전사'].skills[0].mp = Number.NaN;
    classes['없는 직업'] = classes['도적'];
    delete classes['도적'];

    const report = buildRelicFreeSkillReport({ relics, synergies, classes });
    assert.ok(report.errors.includes('SPELL_ECHO_POLICY_MISMATCH'));
    assert.ok(report.errors.includes('TIME_RING_POLICY_MISMATCH'));
    assert.ok(report.errors.includes('ARCANE_SINGULARITY_MISMATCH'));
    assert.ok(report.errors.includes('JOB_SKILL_MP_INVALID:전사'));
    assert.ok(report.errors.includes('JOB_MISSING:도적'));
    assert.ok(report.errors.includes('JOB_UNKNOWN:없는 직업'));
    assert.deepEqual(report.errors, [...report.errors].sort());
});

test('strict free_skill evidence CLI rejects unsafe arguments and stale bytes', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-free-skill.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-free-skill.json';
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    assert.equal(run('--verify', outputRelative).status, 0);
    for (const args of [
        [],
        ['--unknown', outputRelative],
        ['--verify', outputRelative, '--verify', outputRelative],
        ['--write', outputRelative, '--verify', outputRelative],
        ['--verify', '../relic-free-skill.json'],
        ['--verify', '/tmp/relic-free-skill.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-free-skill.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-free-skill.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const suffix = randomUUID();
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const mismatchName = `relic-free-skill-mismatch-${suffix}.json`;
    const mismatchPath = path.join(evidenceDir, mismatchName);
    const symlinkName = `relic-free-skill-symlink-${suffix}.json`;
    const symlinkPath = path.join(evidenceDir, symlinkName);
    try {
        writeFileSync(mismatchPath, `${readFileSync(path.join(ROOT, outputRelative), 'utf8')} `);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${mismatchName}`).stderr,
            /EVIDENCE_BYTE_MISMATCH/,
        );
        symlinkSync('relic-free-skill.json', symlinkPath);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${symlinkName}`).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        if (existsSync(mismatchPath)) unlinkSync(mismatchPath);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
    }
});

test('canonical free_skill evidence binds complete report bytes to SHA-256', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-free-skill.json'),
        'utf8',
    ));
    assert.deepEqual(Object.keys(evidence).sort(), ['hashAlgorithm', 'report', 'reportHash']);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    const canonicalReport = canonicalizeRelicFreeSkillReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
});
