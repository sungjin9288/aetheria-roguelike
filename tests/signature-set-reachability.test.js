import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { findItemByName } from '../src/utils/gameUtils.js';
import { isTwoHandWeapon } from '../src/utils/equipmentUtils.js';
import { computeSignatureSetBonus, getSignatureSetDefinitions, getSignatureSetProgress } from '../src/utils/signatureSetBonus.js';

const slots = ['weapon', 'armor', 'offhand'];
const equipItem = (state, item) => gameReducer(state, {
    type: AT.USE_INVENTORY_ITEM,
    payload: { itemId: item.id },
});

const makeState = (job, names) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: 'idle',
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '세트 검증',
        job,
        level: 75,
        equip: { weapon: null, armor: null, offhand: null },
        inv: names.flatMap((name) => {
            const item = findItemByName(name);
            assert.ok(item, `missing set member: ${name}`);
            // 같은 한손무기 두 개를 사용하는 합법적인 dual-wield도 탐색한다.
            const copies = item.type === 'weapon' && !isTwoHandWeapon(item) ? 2 : 1;
            return Array.from({ length: copies }, (_, copy) => ({ ...item, id: `${name}:${copy}` }));
        }),
    },
});

const reachableStates = (job, members) => {
    const initial = makeState(job, members);
    const queue = [initial];
    const visited = new Set([JSON.stringify(slots.map(() => null))]);
    for (let index = 0; index < queue.length; index += 1) {
        const state = queue[index];
        for (const item of state.player.inv) {
            const next = equipItem(state, item);
            if (next.player === state.player) continue;
            const { equip } = next.player;
            assert.ok(!isTwoHandWeapon(equip.weapon) || !equip.offhand, '2H must release offhand');
            const key = JSON.stringify(slots.map((slot) => equip[slot]?.id ?? null));
            if (visited.has(key)) continue;
            visited.add(key);
            queue.push(next);
        }
    }
    return queue;
};

test('every advertised signature tier has a legal inventory-action witness across all 18 jobs', () => {
    const jobs = Object.keys(CLASSES);
    assert.equal(jobs.length, 18);
    const missing = [];
    for (const [key, definition] of Object.entries(getSignatureSetDefinitions())) {
        const witnessed = new Set();
        for (const job of jobs) {
            for (const state of reachableStates(job, definition.members)) {
                const bonus = computeSignatureSetBonus(state.player.equip).activeSet;
                const progress = getSignatureSetProgress(state.player.equip);
                if (!bonus) continue;
                assert.equal(bonus.key, key);
                assert.equal(progress.currentTier, bonus.tier);
                assert.equal(progress.equippedCount, bonus.count);
                witnessed.add(bonus.tier);
            }
        }
        for (const tier of Object.keys(definition.bonuses).map(Number)) {
            if (!witnessed.has(tier)) missing.push(`${key}:${tier}`);
        }
    }
    assert.deepEqual(missing, [], 'advertised tiers without a production equip path');
});

test('celestial 2H completion does not promise an impossible next tier or accept its shield', () => {
    const initial = makeState('아크메이지', ['신전 도시의 지팡이', '천공 성전']);
    const equipped = equipItem(initial, initial.player.inv[0]);
    assert.notEqual(equipped.player, initial.player);
    const progress = getSignatureSetProgress(equipped.player.equip);
    assert.equal(progress.currentTier, 2);
    assert.equal(progress.nextTier, null);
    assert.equal(progress.nextBonus, null);
    const rejected = equipItem(equipped, equipped.player.inv[0]);
    assert.equal(rejected.player, equipped.player);
    assert.match(rejected.logs.at(-1).text, /양손/);
    const replay = equipItem(equipped, initial.player.inv[0]);
    assert.equal(replay, equipped);
});
