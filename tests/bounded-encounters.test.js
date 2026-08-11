import test from 'node:test';
import assert from 'node:assert/strict';

import { BOUNDED_ENCOUNTERS, BOUNDED_ENCOUNTER_PACK_ENABLED } from '../src/data/boundedEncounters.ts';
import {
    applyBoundedEncounterChoice,
    buildBoundedEncounterContext,
    buildBoundedEncounterReceiptKey,
    isBoundedEncounterEligible,
    selectBoundedEncounter,
    validateBoundedEncounterPack,
} from '../src/utils/boundedEncounterSelector.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { RELICS } from '../src/data/relics.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

const choice = (id, overrides = {}) => ({
    id,
    label: '흔적을 따라간다',
    tradeoff: '생명 5를 지불하고 단서를 얻습니다.',
    cost: { hp: 5 },
    outcome: { gold: 20, result: '숨겨진 보급품을 찾아냈습니다.' },
    ...overrides,
});

const encounter = (id, region, family, overrides = {}) => ({
    id,
    version: 1,
    region,
    family,
    situation: '낡은 표식이 두 갈래 길을 가리킵니다.',
    eligibility: {},
    choices: [
        choice(`${id}:trace`),
        choice(`${id}:rest`, {
            label: '숨을 고른다',
            tradeoff: '위험을 피하지만 작은 회복만 얻습니다.',
            cost: {},
            outcome: { hp: 4, result: '잠시 숨을 고르고 다시 길을 나섭니다.' },
        }),
    ],
    ...overrides,
});

const validPack = () => ([
    encounter('forest-lineage', '고요한 숲', 'old-pillars', {
        eligibility: {},
    }),
    encounter('forest-signature', '고요한 숲', 'moon-trail', {
        eligibility: { requiresSignature: true },
    }),
    encounter('plain-boss', '서쪽 평원', 'broken-banner', {
        eligibility: {},
    }),
    encounter('plain-strained', '서쪽 평원', 'dust-well', {
        eligibility: { hpBand: 'strained' },
    }),
]);

const context = (overrides = {}) => ({
    region: '고요한 숲',
    jobLineage: ['모험가', '전사'],
    hp: 90,
    maxHp: 100,
    signatureNames: ['성검 에테르니아'],
    bossNames: ['고대 호수의 수호신'],
    receiptKeys: [],
    ...overrides,
});

test('production encounter pack contains exactly the approved early-region families', () => {
    assert.equal(BOUNDED_ENCOUNTER_PACK_ENABLED, true);
    assert.equal(BOUNDED_ENCOUNTERS.length, 4);
    assert.deepEqual([...new Set(BOUNDED_ENCOUNTERS.map((entry) => entry.region))], ['고요한 숲', '서쪽 평원']);
    assert.deepEqual(validateBoundedEncounterPack(BOUNDED_ENCOUNTERS, ['고요한 숲', '서쪽 평원']), { ok: true, errors: [] });
});

test('pack validator requires exactly two canonical families per selected region', () => {
    assert.deepEqual(
        validateBoundedEncounterPack(validPack(), ['고요한 숲', '서쪽 평원']),
        { ok: true, errors: [] },
    );

    const missing = validPack().slice(0, 3);
    const result = validateBoundedEncounterPack(missing, ['고요한 숲', '서쪽 평원']);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('REGION_FAMILY_COUNT_INVALID:서쪽 평원'));
});

test('pack validator requires an unconditional family in every selected region', () => {
    const invalid = BOUNDED_ENCOUNTERS.map((entry) => (
        entry.region === '고요한 숲' ? { ...entry, eligibility: { hpBand: 'healthy' } } : entry
    ));
    const result = validateBoundedEncounterPack(invalid, ['고요한 숲', '서쪽 평원']);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('REGION_UNCONDITIONAL_ENCOUNTER_MISSING:고요한 숲'));
});

test('malformed copy, costs and catalog references fail closed', () => {
    const invalid = validPack();
    invalid[0] = encounter('forest-lineage', '없는 지역', 'old-pillars', {
        situation: ' ',
        eligibility: { lineage: ['없는 직업'], previousBoss: '없는 보스' },
        choices: [
            choice('bad', {
                tradeoff: '',
                cost: { gold: -1 },
                outcome: { item: '없는 아이템', result: '' },
            }),
            choice('bad'),
        ],
    });
    const result = validateBoundedEncounterPack(invalid, ['고요한 숲', '서쪽 평원']);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('ENCOUNTER_REGION_INVALID:forest-lineage'));
    assert.ok(result.errors.includes('ENCOUNTER_LINEAGE_INVALID:forest-lineage'));
    assert.ok(result.errors.includes('ENCOUNTER_BOSS_INVALID:forest-lineage'));
    assert.ok(result.errors.includes('CHOICE_COST_INVALID:bad'));
    assert.ok(result.errors.includes('CHOICE_ITEM_INVALID:bad'));
    assert.ok(result.errors.includes('CHOICE_ID_DUPLICATE:bad'));
});

test('eligibility covers region, lineage, HP band, signature, boss and replay receipt', () => {
    const [baseLineage, signature] = validPack();
    const lineage = { ...baseLineage, eligibility: { lineage: ['전사'], hpBand: 'healthy' } };
    assert.equal(isBoundedEncounterEligible(lineage, context()), true);
    assert.equal(isBoundedEncounterEligible(lineage, context({ region: '서쪽 평원' })), false);
    assert.equal(isBoundedEncounterEligible(lineage, context({ jobLineage: ['모험가'] })), false);
    assert.equal(isBoundedEncounterEligible(lineage, context({ hp: 50 })), false);
    assert.equal(isBoundedEncounterEligible(signature, context({ signatureNames: [] })), false);

    const receiptKey = buildBoundedEncounterReceiptKey('expedition-4-9', lineage.id, 1);
    assert.equal(isBoundedEncounterEligible(lineage, context({ receiptKeys: [receiptKey] }), {
        expeditionId: 'expedition-4-9',
        occurrenceSequence: 1,
    }), false);

    const bossEncounter = { ...validPack()[2], eligibility: { previousBoss: '고대 호수의 수호신' } };
    assert.equal(isBoundedEncounterEligible(bossEncounter, context({ region: '서쪽 평원' })), true);
    assert.equal(isBoundedEncounterEligible(
        bossEncounter,
        context({ region: '서쪽 평원', bossNames: [] }),
    ), false);
});

test('same seed selects the same eligible encounter without global randomness', () => {
    const pack = validPack();
    const first = selectBoundedEncounter(pack, context(), createDomainRandom(20260811, 'bounded'));
    const second = selectBoundedEncounter(pack, context(), createDomainRandom(20260811, 'bounded'));
    assert.equal(first?.id, second?.id);
    assert.ok(['forest-lineage', 'forest-signature'].includes(first?.id));
});

test('choice settlement is atomic, receipt-backed and replay is exact no-op', () => {
    const selected = validPack()[0];
    const player = {
        hp: 90,
        maxHp: 100,
        mp: 30,
        maxMp: 50,
        gold: 100,
        inv: [],
        eventChainProgress: { existing: { step: 1 } },
    };
    const settlement = applyBoundedEncounterChoice(player, selected, `${selected.id}:trace`, {
        expeditionId: 'expedition-4-9',
        occurrenceSequence: 1,
    });
    assert.equal(settlement.applied, true);
    assert.equal(settlement.player.hp, 85);
    assert.equal(settlement.player.gold, 120);
    assert.deepEqual(settlement.player.eventChainProgress.existing, { step: 1 });
    assert.equal(settlement.player.eventChainProgress.boundedEncounterReceipts[settlement.receiptKey].choiceId, `${selected.id}:trace`);

    const replay = applyBoundedEncounterChoice(
        settlement.player,
        selected,
        `${selected.id}:trace`,
        { expeditionId: 'expedition-4-9', occurrenceSequence: 1 },
    );
    assert.equal(replay.applied, false);
    assert.equal(replay.reason, 'already_applied');
    assert.strictEqual(replay.player, settlement.player);
});

test('resource, lethal HP and inventory constraints reject without partial mutation', () => {
    const selected = encounter('inventory-test', '고요한 숲', 'inventory', {
        choices: [
            choice('item-choice', {
                cost: { hp: 10, mp: 20, gold: 50 },
                outcome: { item: '하급 체력 물약', result: '물약을 챙겼습니다.' },
            }),
            choice('safe-choice'),
        ],
    });
    const base = { hp: 10, maxHp: 100, mp: 10, maxMp: 50, gold: 40, inv: [], maxInv: 20 };
    const lacking = applyBoundedEncounterChoice(base, selected, 'item-choice', {
        expeditionId: 'expedition-1-1', occurrenceSequence: 1,
    });
    assert.equal(lacking.applied, false);
    assert.strictEqual(lacking.player, base);

    const full = { ...base, hp: 100, mp: 50, gold: 100, maxInv: 1, inv: [{ id: 'existing', name: '하급 체력 물약' }] };
    const overflow = applyBoundedEncounterChoice(full, selected, 'item-choice', {
        expeditionId: 'expedition-1-2', occurrenceSequence: 1,
    });
    assert.equal(overflow.applied, false);
    assert.equal(overflow.reason, 'inventory_full');
    assert.strictEqual(overflow.player, full);
});

test('unknown or malformed encounter data is never eligible or applied', () => {
    const malformed = { ...validPack()[0], version: 2 };
    assert.equal(isBoundedEncounterEligible(malformed, context()), false);
    const player = { hp: 100, maxHp: 100, mp: 20, maxMp: 20, gold: 10, inv: [] };
    const result = applyBoundedEncounterChoice(player, malformed, 'anything', {
        expeditionId: 'expedition-1-1', occurrenceSequence: 1,
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'invalid_encounter');
    assert.strictEqual(result.player, player);
});

test('malformed persisted receipt ledger suppresses bounded selection instead of trapping settlement', () => {
    const player = {
        job: '모험가',
        hp: 100,
        maxHp: 100,
        inv: [],
        equip: {},
        eventChainProgress: { boundedEncounterReceipts: [] },
    };
    assert.equal(buildBoundedEncounterContext(player, '고요한 숲'), null);
});

test('HP eligibility and healing use the effective combat maximum', () => {
    const titanBelt = RELICS.find((entry) => entry.id === 'titan_belt');
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        hp: 70,
        maxHp: 100,
        relics: [titanBelt],
    };
    const effectiveMaxHp = calculateFullStats(player).maxHp;
    const built = buildBoundedEncounterContext(player, '고요한 숲');
    assert.equal(built?.maxHp, effectiveMaxHp);

    const strained = encounter('effective-hp', '고요한 숲', 'effective-hp', {
        eligibility: { hpBand: 'strained' },
        choices: [
            choice('heal', { cost: {}, outcome: { hp: effectiveMaxHp, result: '회복합니다.' } }),
            choice('leave'),
        ],
    });
    assert.equal(isBoundedEncounterEligible(strained, built), true);
    const healed = applyBoundedEncounterChoice(player, strained, 'heal', {
        expeditionId: 'expedition-effective-hp', occurrenceSequence: 1,
    });
    assert.equal(healed.applied, true);
    assert.equal(healed.player.hp, effectiveMaxHp);
});
