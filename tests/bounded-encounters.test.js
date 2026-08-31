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
import { DB } from '../src/data/db.ts';
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
    encounter('forest-engraved-echo', '고요한 숲', 'engraved-echo', {
        eligibility: { requiresSignature: true },
    }),
    encounter('forest-root-resonance', '고요한 숲', 'root-resonance', {
        eligibility: {
            lineage: ['전사', '마법사', '도적'],
            anyBuildTags: ['arcane', 'fortress'],
        },
    }),
    encounter('plain-boss', '서쪽 평원', 'broken-banner', {
        eligibility: {},
    }),
    encounter('plain-strained', '서쪽 평원', 'dust-well', {
        eligibility: { hpBand: 'strained' },
    }),
    encounter('plain-guardian-waterway', '서쪽 평원', 'guardian-waterway', {
        eligibility: { previousBoss: '고대 호수의 수호신' },
    }),
    encounter('plain-windpath-stance', '서쪽 평원', 'windpath-stance', {
        eligibility: {
            lineage: ['전사', '마법사', '도적'],
            anyBuildTags: ['crusher', 'dual'],
        },
    }),
]);

const context = (overrides = {}) => ({
    region: '고요한 숲',
    jobLineage: ['모험가', '전사'],
    hp: 90,
    maxHp: 100,
    signatureNames: ['성검 에테르니아'],
    bossNames: ['고대 호수의 수호신'],
    buildTags: [],
    receiptKeys: [],
    ...overrides,
});

test('production encounter pack contains exactly the approved build-reactive early-region families', () => {
    assert.equal(BOUNDED_ENCOUNTER_PACK_ENABLED, true);
    assert.equal(BOUNDED_ENCOUNTERS.length, 8);
    assert.deepEqual([...new Set(BOUNDED_ENCOUNTERS.map((entry) => entry.region))], ['고요한 숲', '서쪽 평원']);
    assert.deepEqual(
        BOUNDED_ENCOUNTERS.reduce((counts, entry) => ({
            ...counts,
            [entry.region]: (counts[entry.region] || 0) + 1,
        }), {}),
        { '고요한 숲': 4, '서쪽 평원': 4 },
    );
    assert.deepEqual(
        BOUNDED_ENCOUNTERS.map((entry) => entry.id),
        [
            'forest-old-pillars',
            'forest-mutated-trail',
            'forest-engraved-echo',
            'forest-root-resonance',
            'plain-supply-cart',
            'plain-bandit-banner',
            'plain-guardian-waterway',
            'plain-windpath-stance',
        ],
    );
    assert.deepEqual(
        [...new Set(BOUNDED_ENCOUNTERS.flatMap((entry) => Object.keys(entry.eligibility)))].sort(),
        ['anyBuildTags', 'hpBand', 'lineage', 'previousBoss', 'requiresSignature'],
    );
    assert.deepEqual(validateBoundedEncounterPack(BOUNDED_ENCOUNTERS, ['고요한 숲', '서쪽 평원']), { ok: true, errors: [] });
});

test('production pack keeps the approved signature and previous-boss encounter contracts', () => {
    const engraved = BOUNDED_ENCOUNTERS.find((entry) => entry.id === 'forest-engraved-echo');
    assert.deepEqual(engraved, {
        id: 'forest-engraved-echo',
        version: 1,
        region: '고요한 숲',
        family: '각인의 메아리',
        situation: '한 번 발견한 고유 장비의 각인이 고요한 숲의 오래된 문양에 반응합니다. 공명을 받아들일지, 흩어진 조각을 거둘지 선택해야 합니다.',
        eligibility: { requiresSignature: true },
        choices: [
            {
                id: 'align-engraving',
                label: '문양과 각인을 맞춘다',
                tradeoff: '기력 10을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: { mp: 10 },
                outcome: {
                    result: '각인의 공명이 이어져 다음 전투의 공격과 방어가 함께 강해집니다.',
                    buff: { name: '각인의 공명', atk: 0.10, def: 0.10, turn: 3 },
                },
            },
            {
                id: 'gather-engraving-shards',
                label: '흩어진 각인 조각을 거둔다',
                tradeoff: '생명 8을 감수하고 강화 재료 1개를 확보합니다.',
                cost: { hp: 8 },
                outcome: {
                    item: '강화 재료',
                    result: '흩어진 문양 조각을 다듬어 강화 재료 1개를 챙겼습니다.',
                },
            },
        ],
    });

    const waterway = BOUNDED_ENCOUNTERS.find((entry) => entry.id === 'plain-guardian-waterway');
    assert.deepEqual(waterway, {
        id: 'plain-guardian-waterway',
        version: 1,
        region: '서쪽 평원',
        family: '메마른 수로의 잔향',
        situation: '고대 호수의 수호신을 넘어선 기억에 메마른 평원의 수로가 잠시 물빛으로 흔들립니다. 남은 힘을 깨울지, 퇴적층을 걷어 낼지 선택해야 합니다.',
        eligibility: { previousBoss: '고대 호수의 수호신' },
        choices: [
            {
                id: 'awaken-water-memory',
                label: '수로의 물빛을 깨운다',
                tradeoff: '기력 10을 들여 생명 18을 회복합니다.',
                cost: { mp: 10 },
                outcome: {
                    hp: 18,
                    result: '수호신의 잔향이 상처를 감싸 생명 18을 회복했습니다.',
                },
            },
            {
                id: 'clear-channel-silt',
                label: '굳은 퇴적층을 걷어 낸다',
                tradeoff: '생명 8을 감수하고 골드 70을 찾아냅니다.',
                cost: { hp: 8 },
                outcome: {
                    gold: 70,
                    result: '메마른 수로 아래에서 골드 70을 찾아냈습니다.',
                },
            },
        ],
    });
});

test('pack validator requires exactly four canonical families per selected region', () => {
    assert.deepEqual(
        validateBoundedEncounterPack(validPack(), ['고요한 숲', '서쪽 평원']),
        { ok: true, errors: [] },
    );

    const missing = validPack().filter((entry) => entry.id !== 'plain-windpath-stance');
    const result = validateBoundedEncounterPack(missing, ['고요한 숲', '서쪽 평원']);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('REGION_FAMILY_COUNT_INVALID:서쪽 평원'));
});

test('pack validator rejects empty, duplicate, and unknown build tags', () => {
    for (const anyBuildTags of [[], ['arcane', 'arcane'], ['arcane', 'unknown']]) {
        const invalid = validPack();
        invalid[3] = {
            ...invalid[3],
            eligibility: { ...invalid[3].eligibility, anyBuildTags },
        };
        const result = validateBoundedEncounterPack(invalid, ['고요한 숲', '서쪽 평원']);
        assert.equal(result.ok, false);
        assert.ok(result.errors.includes('ENCOUNTER_BUILD_TAGS_INVALID:forest-root-resonance'));
    }
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
    const [baseLineage, , signature] = validPack();
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

    const bossEncounter = validPack().find((entry) => entry.id === 'plain-guardian-waterway');
    assert.equal(isBoundedEncounterEligible(bossEncounter, context({ region: '서쪽 평원' })), true);
    assert.equal(isBoundedEncounterEligible(
        bossEncounter,
        context({ region: '서쪽 평원', bossNames: [] }),
    ), false);
});

test('build eligibility is OR within build tags and AND across lineage', () => {
    const forestBuild = validPack().find((entry) => entry.id === 'forest-root-resonance');
    assert.equal(isBoundedEncounterEligible(forestBuild, context({
        jobLineage: ['모험가', '전사'],
        buildTags: ['arcane'],
    })), true);
    assert.equal(isBoundedEncounterEligible(forestBuild, context({
        jobLineage: ['모험가', '전사'],
        buildTags: ['fortress'],
    })), true);
    assert.equal(isBoundedEncounterEligible(forestBuild, context({
        jobLineage: ['모험가', '전사'],
        buildTags: ['crusher'],
    })), false);
    assert.equal(isBoundedEncounterEligible(forestBuild, context({
        jobLineage: ['모험가'],
        buildTags: ['arcane', 'fortress'],
    })), false);
});

test('bounded context derives only canonical ranked build tags, never class fallback identity', () => {
    const findItem = (name) => [
        ...DB.ITEMS.weapons,
        ...DB.ITEMS.armors,
    ].find((entry) => entry.name === name);
    const relic = (effect) => RELICS.find((entry) => entry.effect === effect);
    const buildPlayer = (overrides = {}) => ({
        ...structuredClone(INITIAL_STATE.player),
        hp: 120,
        maxHp: 150,
        mp: 40,
        maxMp: 60,
        ...overrides,
    });

    const fallbackOnly = buildPlayer({
        job: '나이트',
        equip: { weapon: null, armor: null, offhand: null },
    });
    assert.equal(calculateFullStats(fallbackOnly).buildProfile.primary.id, 'fortress');
    assert.deepEqual(buildBoundedEncounterContext(fallbackOnly, '고요한 숲')?.buildTags, []);

    const equipped = buildPlayer({
        job: '도적',
        equip: {
            weapon: findItem('녹슨 단검'),
            armor: null,
            offhand: findItem('투척용 단검'),
        },
        relics: ['execute_bonus', 'armor_pen', 'event_chance', 'gold_mult'].map(relic),
    });
    assert.deepEqual(
        calculateFullStats(equipped).buildProfile.tags.map((entry) => entry.id),
        ['dual', 'crusher', 'explorer'],
    );
    assert.deepEqual(buildBoundedEncounterContext(equipped, '서쪽 평원')?.buildTags, ['crusher', 'dual']);
});

test('production selection includes each context-gated encounter only when its axis is satisfied', () => {
    const forestPack = BOUNDED_ENCOUNTERS.filter((entry) => entry.region === '고요한 숲');
    const plainPack = BOUNDED_ENCOUNTERS.filter((entry) => entry.region === '서쪽 평원');
    const receipt = { expeditionId: 'expedition-4-9', occurrenceSequence: 1 };
    const strainedForestContext = context({ hp: 60 });

    assert.deepEqual(
        forestPack.filter((entry) => isBoundedEncounterEligible(entry, context({
            jobLineage: ['모험가'],
            signatureNames: [],
            bossNames: [],
        }))).map((entry) => entry.id),
        ['forest-old-pillars'],
    );
    assert.deepEqual(
        plainPack.filter((entry) => isBoundedEncounterEligible(entry, context({
            region: '서쪽 평원',
            jobLineage: ['모험가'],
            signatureNames: [],
            bossNames: [],
        }))).map((entry) => entry.id),
        ['plain-supply-cart'],
    );

    assert.deepEqual(
        forestPack.filter((entry) => isBoundedEncounterEligible(entry, strainedForestContext)).map((entry) => entry.id),
        ['forest-old-pillars', 'forest-mutated-trail', 'forest-engraved-echo'],
    );
    assert.deepEqual(
        forestPack.filter((entry) => isBoundedEncounterEligible(
            entry,
            { ...strainedForestContext, signatureNames: [] },
        )).map((entry) => entry.id),
        ['forest-old-pillars', 'forest-mutated-trail'],
    );
    assert.deepEqual(
        plainPack.filter((entry) => isBoundedEncounterEligible(entry, context({ region: '서쪽 평원' }))).map((entry) => entry.id),
        ['plain-supply-cart', 'plain-bandit-banner', 'plain-guardian-waterway'],
    );
    assert.deepEqual(
        plainPack.filter((entry) => isBoundedEncounterEligible(
            entry,
            context({ region: '서쪽 평원', bossNames: [] }),
        )).map((entry) => entry.id),
        ['plain-supply-cart', 'plain-bandit-banner'],
    );
    assert.equal(
        selectBoundedEncounter(BOUNDED_ENCOUNTERS, context(), receipt, () => 0)?.id,
        'forest-engraved-echo',
    );
});

test('same seed selects the same eligible encounter without global randomness', () => {
    const pack = validPack();
    const first = selectBoundedEncounter(pack, context(), createDomainRandom(20260811, 'bounded'));
    const second = selectBoundedEncounter(pack, context(), createDomainRandom(20260811, 'bounded'));
    assert.equal(first?.id, second?.id);
    assert.ok(['forest-lineage', 'forest-signature', 'forest-engraved-echo'].includes(first?.id));
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
