import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeClassJourneyEncounterDiscoveries,
    normalizeClassJourneyLedger,
    recordClassJourneyExpedition,
} from '../src/utils/classJourney.js';

const rootContinue = {
    encounterId: 'forest-root-resonance',
    encounterVersion: 1,
    choiceId: 'anchor-root-ward',
    family: '뿌리 아래 공명 결계',
    choiceLabel: '결계의 흐름을 이어 둔다',
};

const rootCrystal = {
    encounterId: 'forest-root-resonance',
    encounterVersion: 1,
    choiceId: 'gather-root-crystal',
    family: '뿌리 아래 공명 결계',
    choiceLabel: '굳은 결정 조각을 거둔다',
};

const oldPillars = {
    encounterId: 'forest-old-pillars',
    encounterVersion: 1,
    choiceId: 'read-runes',
    family: '돌기둥의 속삭임',
    choiceLabel: '돌기둥의 문장을 읽는다',
};

const firstExpedition = {
    job: '전사',
    expeditionId: 'expedition-1000',
    skillBranches: ['철벽', '철벽'],
    signatureItems: ['라그나로크'],
    bossNames: ['숲의 군주'],
    regions: ['고요한 숲'],
    endedAt: 2_000,
};

test('첫 원정은 해당 직업의 여정을 만들고 sequence를 한 번 올린다', () => {
    const player = { job: '전사' };
    const recorded = recordClassJourneyExpedition(player, firstExpedition);

    assert.equal(recorded.classJourney.version, 2);
    assert.equal(recorded.classJourney.sequence, 1);
    assert.deepEqual(recorded.classJourney.byJob['전사'], {
        expeditionIds: ['expedition-1000'],
        skillBranches: ['철벽'],
        signatureItems: ['라그나로크'],
        bossNames: ['숲의 군주'],
        regions: ['고요한 숲'],
        encounterDiscoveries: [],
        representativeExpeditionId: 'expedition-1000',
        lastPlayedAt: 2_000,
    });
});

test('같은 원정 ID replay는 player와 ledger 객체를 그대로 돌려준다', () => {
    const recorded = recordClassJourneyExpedition({ job: '전사' }, firstExpedition);
    const replayed = recordClassJourneyExpedition(recorded, {
        ...firstExpedition,
        skillBranches: ['새 분기'],
        endedAt: 9_999,
    });

    assert.equal(replayed, recorded);
    assert.equal(replayed.classJourney, recorded.classJourney);
    assert.equal(replayed.classJourney.sequence, 1);
});

test('다른 원정은 한 번 추가하고 최신 대표 원정과 시각을 갱신한다', () => {
    const first = recordClassJourneyExpedition({ job: '전사' }, firstExpedition);
    const second = recordClassJourneyExpedition(first, {
        job: '전사',
        expeditionId: 'expedition-3000',
        skillBranches: ['철벽', '반격'],
        signatureItems: ['라그나로크', '용의 화염'],
        bossNames: ['숲의 군주', '호수의 수호자'],
        regions: ['고요한 숲', '신성한 호수'],
        endedAt: 4_000,
    });

    assert.equal(second.classJourney.sequence, 2);
    assert.deepEqual(second.classJourney.byJob['전사'].expeditionIds, [
        'expedition-1000',
        'expedition-3000',
    ]);
    assert.equal(second.classJourney.byJob['전사'].representativeExpeditionId, 'expedition-3000');
    assert.equal(second.classJourney.byJob['전사'].lastPlayedAt, 4_000);
});

test('분기·signature·보스·지역은 첫 발견 순서로 한 번만 남긴다', () => {
    const first = recordClassJourneyExpedition({ job: '전사' }, firstExpedition);
    const second = recordClassJourneyExpedition(first, {
        job: '전사',
        expeditionId: 'expedition-3000',
        skillBranches: ['반격', '철벽', '분노'],
        signatureItems: ['용의 화염', '라그나로크', '용의 화염'],
        bossNames: ['호수의 수호자', '숲의 군주'],
        regions: ['신성한 호수', '고요한 숲'],
        endedAt: 4_000,
    });
    const journey = second.classJourney.byJob['전사'];

    assert.deepEqual(journey.skillBranches, ['철벽', '반격', '분노']);
    assert.deepEqual(journey.signatureItems, ['라그나로크', '용의 화염']);
    assert.deepEqual(journey.bossNames, ['숲의 군주', '호수의 수호자']);
    assert.deepEqual(journey.regions, ['고요한 숲', '신성한 호수']);
});

test('손상된 구세이브는 유효한 발견을 잃지 않고 정규화한다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 9,
        sequence: -4,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000', '', 'expedition-1000', 7],
                skillBranches: ['철벽', null, '철벽', '반격'],
                signatureItems: '라그나로크',
                bossNames: ['숲의 군주', ''],
                regions: ['고요한 숲', '고요한 숲'],
                representativeExpeditionId: '없는 원정',
                lastPlayedAt: '알 수 없음',
            },
            '': { expeditionIds: ['버려질 원정'] },
        },
    });

    assert.deepEqual(normalized, {
        version: 2,
        sequence: 1,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                skillBranches: ['철벽', '반격'],
                signatureItems: [],
                bossNames: ['숲의 군주'],
                regions: ['고요한 숲'],
                encounterDiscoveries: [],
                representativeExpeditionId: 'expedition-1000',
                lastPlayedAt: null,
            },
        },
    });
});

test('null 시각은 epoch 0으로 바꾸지 않고 기록 없음으로 보존한다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 1,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                lastPlayedAt: null,
            },
        },
    });
    const recorded = recordClassJourneyExpedition({ classJourney: normalized }, {
        ...firstExpedition,
        expeditionId: 'expedition-2000',
        endedAt: null,
    });

    assert.equal(normalized.byJob['전사'].lastPlayedAt, null);
    assert.equal(recorded.classJourney.byJob['전사'].lastPlayedAt, null);
});

test('손상된 대표 원정은 가장 최근의 유효한 원정으로 복구한다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 2,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000', 'expedition-2000'],
                representativeExpeditionId: '없는 원정',
            },
        },
    });

    assert.equal(normalized.byJob['전사'].representativeExpeditionId, 'expedition-2000');
});

test('같은 원정 ID를 다른 직업으로 replay해도 전역에서 한 번만 기록한다', () => {
    const recorded = recordClassJourneyExpedition({ job: '전사' }, firstExpedition);
    const replayed = recordClassJourneyExpedition(recorded, {
        ...firstExpedition,
        job: '마법사',
    });

    assert.equal(replayed, recorded);
    assert.equal(replayed.classJourney.sequence, 1);
    assert.equal(replayed.classJourney.byJob['마법사'], undefined);
});

test('직업과 발견 identity의 바깥 공백은 제거한 뒤 중복을 판단한다', () => {
    const first = recordClassJourneyExpedition({ job: '전사' }, {
        ...firstExpedition,
        job: ' 전사 ',
        bossNames: [' 숲의 군주 ', '숲의 군주'],
    });
    const second = recordClassJourneyExpedition(first, {
        ...firstExpedition,
        job: '전사',
        expeditionId: 'expedition-2000',
        bossNames: ['숲의 군주'],
    });

    assert.deepEqual(Object.keys(second.classJourney.byJob), ['전사']);
    assert.deepEqual(second.classJourney.byJob['전사'].bossNames, ['숲의 군주']);
});

test('손상 저장의 전역 중복 원정과 빈 직업 기록을 제거한다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 0,
        byJob: {
            '전사': {
                expeditionIds: ['shared-expedition', 'warrior-expedition'],
                representativeExpeditionId: 'warrior-expedition',
            },
            '마법사': {
                expeditionIds: ['shared-expedition', 'mage-expedition'],
                representativeExpeditionId: 'shared-expedition',
            },
            '도적': { expeditionIds: [] },
        },
    });

    assert.equal(normalized.sequence, 3);
    assert.deepEqual(Object.keys(normalized.byJob), ['전사', '마법사']);
    assert.deepEqual(normalized.byJob['전사'].expeditionIds, ['shared-expedition', 'warrior-expedition']);
    assert.deepEqual(normalized.byJob['마법사'].expeditionIds, ['mage-expedition']);
    assert.equal(normalized.byJob['마법사'].representativeExpeditionId, 'mage-expedition');
});

test('공백 직업 기록을 합칠 때 최신 시각과 그 대표 원정이 역행하지 않는다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 2,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-3000'],
                representativeExpeditionId: 'expedition-3000',
                lastPlayedAt: 3_000,
            },
            ' 전사 ': {
                expeditionIds: ['expedition-1000'],
                representativeExpeditionId: 'expedition-1000',
                lastPlayedAt: 1_000,
            },
        },
    });

    assert.equal(normalized.byJob['전사'].lastPlayedAt, 3_000);
    assert.equal(normalized.byJob['전사'].representativeExpeditionId, 'expedition-3000');
});

test('시각이 없는 공백 직업 기록은 마지막 발견 원정을 대표로 삼는다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 2,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                representativeExpeditionId: 'expedition-1000',
                lastPlayedAt: null,
            },
            ' 전사 ': {
                expeditionIds: ['expedition-2000'],
                representativeExpeditionId: 'expedition-2000',
                lastPlayedAt: null,
            },
        },
    });

    assert.deepEqual(normalized.byJob['전사'].expeditionIds, ['expedition-1000', 'expedition-2000']);
    assert.equal(normalized.byJob['전사'].representativeExpeditionId, 'expedition-2000');
    assert.equal(normalized.byJob['전사'].lastPlayedAt, null);
});

test('prototype special key는 손상 저장과 신규 기록 모두 안전하게 거부한다', () => {
    const malformed = JSON.parse('{"version":1,"sequence":1,"byJob":{"__proto__":{"expeditionIds":["bad"]}}}');
    const normalized = normalizeClassJourneyLedger(malformed);
    const recorded = recordClassJourneyExpedition({}, {
        ...firstExpedition,
        job: '__proto__',
    });

    assert.deepEqual(normalized, { version: 2, sequence: 1, byJob: {} });
    assert.deepEqual(recorded, {});
});

test('유효한 높은 sequence는 정규화와 다음 원정에서도 단조 증가를 유지한다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 42,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                representativeExpeditionId: 'expedition-1000',
            },
        },
    });
    const recorded = recordClassJourneyExpedition({ classJourney: normalized }, {
        ...firstExpedition,
        expeditionId: 'expedition-2000',
    });

    assert.equal(normalized.sequence, 42);
    assert.equal(recorded.classJourney.sequence, 43);
});

test('사건 발견 normalizer는 유효한 copy를 정리하고 identity의 첫 기록만 보존한다', () => {
    assert.deepEqual(normalizeClassJourneyEncounterDiscoveries([
        {
            ...rootContinue,
            family: ' 뿌리 아래 공명 결계 ',
            choiceLabel: ' 결계의 흐름을 이어 둔다 ',
        },
        { ...rootContinue, family: '중복 copy', choiceLabel: '중복 선택' },
        rootCrystal,
    ]), [rootContinue, rootCrystal]);
});

test('사건 발견 normalizer는 잘못된 ID, version, copy와 비평범 객체를 버린다', () => {
    const inherited = Object.create({ encounterId: 'forest-old-pillars' });
    Object.assign(inherited, oldPillars);
    const overlongId = `a${'b'.repeat(128)}`;
    const invalid = [
        null,
        [],
        inherited,
        { ...oldPillars, encounterId: ' Forest-old-pillars' },
        { ...oldPillars, encounterId: 'FOREST-OLD-PILLARS' },
        { ...oldPillars, encounterId: overlongId },
        { ...oldPillars, choiceId: 'bad choice' },
        { ...oldPillars, encounterVersion: 0 },
        { ...oldPillars, encounterVersion: 1.5 },
        { ...oldPillars, encounterVersion: Number.MAX_SAFE_INTEGER + 1 },
        { ...oldPillars, encounterVersion: '1' },
        { ...oldPillars, family: '  ' },
        { ...oldPillars, choiceLabel: '' },
        oldPillars,
    ];

    assert.deepEqual(normalizeClassJourneyEncounterDiscoveries(invalid), [oldPillars]);
});

test('v1 직업 기록은 v2의 빈 사건 발견 목록으로 additive migration된다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 1,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                regions: ['고요한 숲'],
            },
        },
    });

    assert.equal(normalized.version, 2);
    assert.deepEqual(normalized.byJob['전사'].encounterDiscoveries, []);
});

test('한 귀환의 여러 사건 발견은 sequence를 한 번만 올리고 identity별로 저장한다', () => {
    const recorded = recordClassJourneyExpedition({ job: '전사' }, {
        ...firstExpedition,
        encounterDiscoveries: [rootContinue, rootContinue, rootCrystal],
    });

    assert.equal(recorded.classJourney.sequence, 1);
    assert.deepEqual(recorded.classJourney.byJob['전사'].encounterDiscoveries, [
        rootContinue,
        rootCrystal,
    ]);
});

test('같은 원정 replay의 추가 사건 발견은 exact player no-op이다', () => {
    const recorded = recordClassJourneyExpedition({ job: '전사' }, {
        ...firstExpedition,
        encounterDiscoveries: [rootContinue],
    });
    const replayed = recordClassJourneyExpedition(recorded, {
        ...firstExpedition,
        encounterDiscoveries: [rootContinue, rootCrystal],
    });

    assert.equal(replayed, recorded);
    assert.equal(replayed.classJourney, recorded.classJourney);
    assert.deepEqual(replayed.classJourney.byJob['전사'].encounterDiscoveries, [rootContinue]);
});

test('같은 사건 발견은 서로 다른 직업 여정에 독립적으로 남는다', () => {
    const warrior = recordClassJourneyExpedition({}, {
        ...firstExpedition,
        encounterDiscoveries: [rootContinue],
    });
    const mage = recordClassJourneyExpedition(warrior, {
        ...firstExpedition,
        job: '마법사',
        expeditionId: 'expedition-2000',
        encounterDiscoveries: [rootContinue],
    });

    assert.deepEqual(mage.classJourney.byJob['전사'].encounterDiscoveries, [rootContinue]);
    assert.deepEqual(mage.classJourney.byJob['마법사'].encounterDiscoveries, [rootContinue]);
});

test('중복 직업 기록은 사건 발견의 첫 copy와 첫 발견 순서를 보존해 합친다', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 2,
        sequence: 2,
        byJob: {
            '전사': {
                expeditionIds: ['expedition-1000'],
                encounterDiscoveries: [rootContinue, rootCrystal],
            },
            ' 전사 ': {
                expeditionIds: ['expedition-2000'],
                encounterDiscoveries: [
                    { ...rootCrystal, family: '뒤늦게 바뀐 copy' },
                    oldPillars,
                ],
            },
        },
    });

    assert.deepEqual(normalized.byJob['전사'].encounterDiscoveries, [
        rootContinue,
        rootCrystal,
        oldPillars,
    ]);
});
