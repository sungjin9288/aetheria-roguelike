import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import {
    BASELINE_PROGRESSION_PROFILE,
    resolveProgressionProfile,
    scaleProgressionExpReward,
    validateProgressionProfileTransition,
} from '../src/data/progressionProfiles.ts';
import {
    finishExpedition,
    normalizeActiveExpedition,
    normalizeExpeditionSummary,
    resolvePlayerProgressionProfile,
    startExpedition,
    trackExpeditionVitals,
} from '../src/utils/expeditionLedger.ts';

const candidate = (overrides = {}) => ({
    id: 'exp-tune',
    version: 2,
    expMultiplier: 1.1,
    lootMultiplier: 1,
    eventMultiplier: 1,
    ...overrides,
});

test('baseline profile is immutable and invalid remote refs fail closed', () => {
    assert.deepEqual(BASELINE_PROGRESSION_PROFILE, {
        id: 'baseline', version: 1, expMultiplier: 1, lootMultiplier: 1, eventMultiplier: 1,
    });
    assert.equal(Object.isFrozen(BASELINE_PROGRESSION_PROFILE), true);
    assert.strictEqual(resolveProgressionProfile({ id: 'missing', version: 99 }), BASELINE_PROGRESSION_PROFILE);
    assert.strictEqual(resolveProgressionProfile({ id: '__proto__', version: 1 }), BASELINE_PROGRESSION_PROFILE);
    assert.deepEqual(INITIAL_STATE.liveConfig.progressionProfile, { id: 'baseline', version: 1 });
    assert.equal(INITIAL_STATE.liveConfig.eventMultiplier, 1);
    assert.equal(scaleProgressionExpReward(INITIAL_STATE.player, 101), 101);
});

test('release transition allows one bounded axis and rejects zero or multiple axes', () => {
    assert.deepEqual(validateProgressionProfileTransition(
        BASELINE_PROGRESSION_PROFILE,
        candidate(),
        'exp',
    ), { ok: true, changedAxis: 'exp' });
    assert.equal(validateProgressionProfileTransition(
        BASELINE_PROGRESSION_PROFILE,
        candidate({ expMultiplier: 1 }),
        'exp',
    ).ok, false);
    assert.equal(validateProgressionProfileTransition(
        BASELINE_PROGRESSION_PROFILE,
        candidate({ lootMultiplier: 1.1 }),
        'exp',
    ).ok, false);
    assert.equal(validateProgressionProfileTransition(
        BASELINE_PROGRESSION_PROFILE,
        candidate({ expMultiplier: 1.3 }),
        'exp',
    ).ok, false);
});

test('active expedition snapshots the full profile and ignores a mid-expedition pointer flip', () => {
    const profile = candidate();
    const started = startExpedition(
        { ...structuredClone(INITIAL_STATE.player), activeExpedition: null },
        '고요한 숲',
        1_000,
        [],
        profile,
    );
    assert.deepEqual(started.activeExpedition.progressionProfile, profile);
    assert.notStrictEqual(started.activeExpedition.progressionProfile, profile);
    assert.deepEqual(resolvePlayerProgressionProfile(started, { id: 'baseline', version: 1 }), profile);
    assert.equal(scaleProgressionExpReward(started, 101), 111);

    const tracked = trackExpeditionVitals(started, { ...started, hp: started.hp - 1 });
    assert.deepEqual(tracked.activeExpedition.progressionProfile, profile);
    const { summary } = finishExpedition(tracked, '시작의 마을', 2_000, []);
    assert.deepEqual(summary.progressionProfile, profile);
});

test('legacy active and summary records normalize to baseline without losing the field later', () => {
    const started = startExpedition(
        { ...structuredClone(INITIAL_STATE.player), activeExpedition: null },
        '고요한 숲',
        1_000,
        [],
    );
    const legacyActive = structuredClone(started.activeExpedition);
    delete legacyActive.progressionProfile;
    assert.deepEqual(normalizeActiveExpedition(legacyActive).progressionProfile, BASELINE_PROGRESSION_PROFILE);

    const { summary } = finishExpedition(started, '시작의 마을', 2_000, []);
    const legacySummary = structuredClone(summary);
    delete legacySummary.progressionProfile;
    assert.deepEqual(normalizeExpeditionSummary(legacySummary).progressionProfile, BASELINE_PROGRESSION_PROFILE);
});
