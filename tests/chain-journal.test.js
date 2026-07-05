import test from 'node:test';
import assert from 'node:assert/strict';

import { buildChainJournal } from '../src/utils/chainJournal.js';

const CHAINS = [
    {
        id: 'ancient_prophecy',
        label: '고대의 예언',
        steps: [
            { step: 0, loc: '어둠의 동굴', event: { title: '예언의 돌판' } },
            { step: 1, loc: '고대 마법 탑', event: { title: '예언 해독사' } },
            { step: 2, loc: '에테르 관문', event: { title: '원시의 문' } },
        ],
    },
    {
        id: 'lost_wizard',
        label: '사라진 마법사',
        steps: [
            { step: 0, loc: '고요한 숲', event: { title: '마법의 흔적' } },
            { step: 1, loc: '수정 동굴', event: { title: '마법사의 일기장' } },
            { step: 2, loc: '천공 정원', event: { title: '마법사의 환영' } },
        ],
    },
];

test('buildChainJournal returns an entry for a chain that has started but not finished', () => {
    const progress = { ancient_prophecy: 1 };
    const entries = buildChainJournal(progress, CHAINS);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].chainId, 'ancient_prophecy');
    assert.equal(entries[0].label, '고대의 예언');
    assert.equal(entries[0].currentStep, 1);
    assert.equal(entries[0].totalSteps, 3);
    assert.equal(entries[0].nextLoc, '고대 마법 탑');
});

test('buildChainJournal excludes chains that have not started (progress 0 or missing)', () => {
    const progress = { ancient_prophecy: 0 };
    const entries = buildChainJournal(progress, CHAINS);
    assert.equal(entries.length, 0);

    const emptyEntries = buildChainJournal({}, CHAINS);
    assert.equal(emptyEntries.length, 0);
});

test('buildChainJournal excludes chains that are already completed', () => {
    const progress = { ancient_prophecy: 3 };
    const entries = buildChainJournal(progress, CHAINS);
    assert.equal(entries.length, 0);
});

test('buildChainJournal excludes chains marked as failed', () => {
    const progress = { ancient_prophecy: 'failed' };
    const entries = buildChainJournal(progress, CHAINS);
    assert.equal(entries.length, 0);
});

test('buildChainJournal returns multiple in-progress chains and omits nextLoc when chain is on its last step boundary', () => {
    const progress = { ancient_prophecy: 1, lost_wizard: 2 };
    const entries = buildChainJournal(progress, CHAINS);

    assert.equal(entries.length, 2);
    const wizardEntry = entries.find((e) => e.chainId === 'lost_wizard');
    assert.ok(wizardEntry);
    assert.equal(wizardEntry.currentStep, 2);
    assert.equal(wizardEntry.totalSteps, 3);
    assert.equal(wizardEntry.nextLoc, '천공 정원');
});

test('buildChainJournal returns empty array for empty/undefined progress or chains', () => {
    assert.deepEqual(buildChainJournal({}, []), []);
    assert.deepEqual(buildChainJournal({}, CHAINS), []);
});
