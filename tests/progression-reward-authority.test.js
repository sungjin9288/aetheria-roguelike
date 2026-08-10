import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { getNarrativeEventChance } from '../src/utils/explorationPacing.ts';
import { checkDiscoveryChains } from '../src/utils/exploreUtils.ts';

const withProfile = (overrides) => ({
    ...structuredClone(INITIAL_STATE.player),
    activeExpedition: {
        progressionProfile: {
            id: 'candidate',
            version: 2,
            expMultiplier: 1,
            lootMultiplier: 1,
            eventMultiplier: 1,
            ...overrides,
        },
    },
});

test('discovery-chain EXP uses the production level-up authority', () => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        level: 1,
        exp: 0,
        nextExp: 100,
        maxHp: 150,
        maxMp: 50,
        hp: 150,
        mp: 50,
        atk: 10,
        def: 5,
        stats: {
            ...(INITIAL_STATE.player.stats || {}),
            visitedMaps: ['화염의 협곡', '화염의 사원'],
            discoveryChains: [],
        },
    };
    let updated = null;
    checkDiscoveryChains(player, '용의 둥지', {
        addLog: () => {},
        dispatch: (action) => {
            assert.equal(typeof action.payload, 'function');
            updated = action.payload(player);
        },
    });
    assert.ok(updated.level > player.level);
    assert.ok(updated.nextExp > player.nextExp);
    assert.ok(updated.stats.discoveryChains.includes('fire_convergence'));
});

test('event multiplier scales only narrative base chance and leaves pity additive', () => {
    const noPity = { exploreState: { sinceNarrativeEvent: 0 } };
    const withPity = { exploreState: { sinceNarrativeEvent: 3 } };
    const baselineBase = getNarrativeEventChance(0.2, 0, noPity, null, 1);
    const candidateBase = getNarrativeEventChance(0.2, 0, noPity, null, 1.1);
    const baselineWithPity = getNarrativeEventChance(0.2, 0, withPity, null, 1);
    const candidateWithPity = getNarrativeEventChance(0.2, 0, withPity, null, 1.1);

    assert.ok(candidateBase > baselineBase);
    assert.ok(Math.abs(
        (candidateWithPity - baselineWithPity) - (candidateBase - baselineBase),
    ) < 1e-12);
});

test('loot multiplier scales chance paths and compounds with signature pity', () => {
    const slime = { name: '슬라임', baseName: '슬라임', exp: 10, isBoss: false };
    const baseline = processLoot(slime, withProfile({ lootMultiplier: 1 }), 1, () => 0.56, () => 1);
    const boosted = processLoot(slime, withProfile({ lootMultiplier: 1.1 }), 1, () => 0.56, () => 1);
    assert.equal(baseline.items.length, 0);
    assert.ok(boosted.items.some((item) => item.name.includes('슬라임 젤리')));

    const golem = { name: '광석골렘', baseName: '광석골렘', exp: 100, isBoss: false };
    const noPityDrop = processLoot(golem, withProfile({ lootMultiplier: 1.1 }), 1, () => 0.03, () => 1);
    const pityDrop = processLoot(golem, withProfile({ lootMultiplier: 1.1 }), 2, () => 0.03, () => 1);
    assert.equal(noPityDrop.items.some((item) => item.name.includes('대지의 심판')), false);
    assert.equal(pityDrop.items.some((item) => item.name.includes('대지의 심판')), true);
});

test('loot multiplier does not change guaranteed prestige boss drops', () => {
    const boss = { name: '미등록 보스', baseName: '미등록 보스', exp: 600, isBoss: true };
    const result = processLoot(
        boss,
        { ...withProfile({ lootMultiplier: 0.8 }), meta: { prestigeRank: 3 } },
        1,
        () => 0.99,
        () => 1,
    );
    assert.equal(result.items.length, 1);
});
