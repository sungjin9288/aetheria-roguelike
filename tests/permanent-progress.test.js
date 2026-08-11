import assert from 'node:assert/strict';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

const buildClassJourney = () => ({
    version: 1,
    sequence: 7,
    byJob: {
        전사: {
            expeditionIds: ['expedition-permanent-7'],
            skillBranches: ['파워배시:A'],
            signatureItems: ['성검 에테르니아'],
            bossNames: ['고대 호수의 수호신'],
            regions: ['고요한 숲', '신성한 호수'],
            representativeExpeditionId: 'expedition-permanent-7',
            lastPlayedAt: 7_000,
        },
    },
});

const buildPlayer = () => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '영구 기록 검증',
    job: '전사',
    level: 20,
    hp: 17,
    mp: 9,
    gold: 9_999,
    loc: '신성한 호수',
    inv: [{ name: '런 전용 전리품', id: 'run-item', type: 'material' }],
    equip: {
        weapon: { name: '런 전용 무기', id: 'run-weapon', type: 'weapon' },
        armor: null,
        offhand: null,
    },
    quests: [{ id: 'run-quest', progress: 2 }],
    relics: [{ id: 'run-relic', name: '런 전용 유물' }],
    activeExpedition: {
        id: 'active-run',
        startedAt: 1,
        origin: '시작의 마을',
        destination: '신성한 호수',
        startLevel: 20,
        startExp: 0,
        startNextExp: 1,
        startGold: 0,
        startHp: 100,
        maxHpAtStart: 100,
        lowestHp: 17,
        kills: 0,
        bossKills: 0,
        explores: 0,
        inventory: [],
        quests: [],
        focusQuestIds: [],
        progressionProfile: { id: 'baseline', version: 1, expMultiplier: 1, lootMultiplier: 1, eventMultiplier: 1 },
    },
    settings: { readabilityMode: 'high', equipmentDetailMode: 'full' },
    classJourney: buildClassJourney(),
    expeditionSequence: 41,
    returnSupplyRewards: {
        version: 1,
        receipts: {
            'expedition-reward': { status: 'pending' },
        },
    },
    premiumCurrency: 77,
    reviveTokens: 3,
    maxInv: 27,
    titles: ['영구 칭호'],
    activeTitle: '영구 칭호',
    meta: {
        ...INITIAL_STATE.player.meta,
        essence: 777,
        prestigeRank: 2,
        mirror: { power: 2 },
        storyMilestones: { seen: ['first_death'], pending: [] },
    },
    weeklyProtocol: { kills: 8, explores: 5, bossKills: 1, lastResetWeek: 22, claimed: ['weekly'] },
    combatFlags: { comboCount: 9, deathSaveUsed: true, areaAura: true },
    stats: {
        ...INITIAL_STATE.player.stats,
        kills: 88,
        bossKills: 7,
        deaths: 4,
        total_gold: 123_456,
        areaBossDefeated: { '고대 호수의 수호신': true },
        claimedAchievements: ['ach-permanent'],
        claimedQuestIds: ['quest-permanent'],
        codexClaimed: ['codex-permanent'],
        signaturePity: 5,
    },
});

const resetWith = (kind, player) => {
    if (kind === 'defeat') {
        return CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.9, () => 10_000).updatedPlayer;
    }
    const state = { ...structuredClone(INITIAL_STATE), player, gameState: 'ascension' };
    if (kind === 'manual_reset') {
        return gameReducer(state, { type: AT.RESET_GAME }).player;
    }
    return gameReducer(state, {
        type: AT.ASCEND,
        payload: {
            expectedPrestigeRank: player.meta?.prestigeRank || 0,
            sourceReceiptKey: player.meta?.endgame?.lastEndgameReceiptKey ?? null,
        },
    }).player;
};

for (const kind of ['defeat', 'manual_reset', 'ascend']) {
    test(`${kind} preserves class journey, accessibility settings, and permanent receipts`, () => {
        const player = buildPlayer();
        const result = resetWith(kind, player);

        assert.deepEqual(result.classJourney, player.classJourney);
        assert.notEqual(result.classJourney, player.classJourney);
        assert.deepEqual(result.settings, player.settings);
        assert.notEqual(result.settings, player.settings);
        assert.equal(result.expeditionSequence, 41);
        assert.deepEqual(result.returnSupplyRewards, {
            version: 1,
            receipts: {
                'expedition-reward': {
                    status: kind === 'defeat' ? 'pending' : 'delivered',
                },
            },
        });
        assert.notEqual(result.returnSupplyRewards, player.returnSupplyRewards);
        if (kind !== 'defeat') {
            assert.equal(
                result.inv.some((item) => item.id === 'return-supply:expedition-reward'),
                true,
            );
        }
        assert.equal(result.premiumCurrency, 77);
        assert.equal(result.reviveTokens, 3);
        assert.equal(result.maxInv, 27);
        assert.equal(result.stats.signaturePity, 5);
        assert.deepEqual(result.stats.claimedAchievements, ['ach-permanent']);
        assert.deepEqual(result.stats.claimedQuestIds, ['quest-permanent']);
    });

    test(`${kind} resets run-bound combat, expedition, inventory, equipment, quest, and relic state`, () => {
        const result = resetWith(kind, buildPlayer());

        assert.equal(result.activeExpedition, null);
        assert.deepEqual(result.combatFlags, INITIAL_STATE.player.combatFlags);
        assert.deepEqual(result.stats.areaBossDefeated || {}, {});
        assert.deepEqual(result.quests, []);
        assert.deepEqual(result.relics, []);
        assert.notDeepEqual(result.inv, [{ name: '런 전용 전리품', id: 'run-item', type: 'material' }]);
        assert.notEqual(result.equip?.weapon?.id, 'run-weapon');
    });
}
