import test from 'node:test';
import assert from 'node:assert/strict';

import { getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';
import { ACHIEVEMENTS } from '../src/data/quests.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import { getSignatureSetDefinitions } from '../src/utils/signatureSetBonus.js';

const mockCodexForSignatures = (signatureNames) => {
    const codex = { weapons: {}, armors: {}, shields: {} };
    // ITEMS already tested for containing all signatures; bucket assignment:
    // (using simplified mapping — tests verify the full path via isAchievementUnlocked)
    for (const name of signatureNames) {
        const meta = SIGNATURE_ITEM_REGISTRY[name];
        if (!meta) continue;
        // spriteKey 전두사로 bucket 추정 — weapon/shield/armor
        if (meta.spriteKey.startsWith('signature-weapon-')) {
            codex.weapons[name] = { discovered: true, obtainedAt: Date.now() };
        } else if (meta.spriteKey.startsWith('signature-shield-')) {
            codex.shields[name] = { discovered: true, obtainedAt: Date.now() };
        } else if (meta.spriteKey.startsWith('signature-armor-')) {
            codex.armors[name] = { discovered: true, obtainedAt: Date.now() };
        }
    }
    return codex;
};

test('signaturesDiscovered target returns 0 for player without codex', () => {
    const player = { stats: {} };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_first');
    assert.ok(achievement);
    assert.equal(getAchievementCurrentValue(achievement, player), 0);
    assert.equal(isAchievementUnlocked(achievement, player), false);
});

test('signaturesDiscovered target counts 1 after first discovery', () => {
    const codex = mockCodexForSignatures(['성검 에테르니아']);
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_first');
    assert.equal(getAchievementCurrentValue(achievement, player), 1);
    assert.equal(isAchievementUnlocked(achievement, player), true);
});

test('signaturesDiscovered target counts 5 after 5 discoveries', () => {
    const codex = mockCodexForSignatures([
        '성검 에테르니아', '마왕의 대낫', '라그나로크', '차원 마왕의 낫', '천공 성전',
    ]);
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_5');
    assert.equal(getAchievementCurrentValue(achievement, player), 5);
    assert.equal(isAchievementUnlocked(achievement, player), true);
});

test('signaturesDiscovered target returns full registry size when all discovered; ach_sig_20 unlocks at goal', () => {
    const allNames = Object.keys(SIGNATURE_ITEM_REGISTRY);
    const codex = mockCodexForSignatures(allNames);
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_20');
    // registry가 goal(20)보다 커져도 count는 실제 등록 수 — achievement는 goal 이상이면 unlock
    assert.equal(getAchievementCurrentValue(achievement, player), allNames.length);
    assert.ok(allNames.length >= achievement.goal, `registry size ${allNames.length} must meet goal ${achievement.goal}`);
    assert.equal(isAchievementUnlocked(achievement, player), true);
});

test('signatureSetsCompleted = 0 when no set is fully collected', () => {
    const codex = mockCodexForSignatures(['성검 에테르니아', '천공 성전']); // celestial 2/4
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_set_1');
    assert.equal(getAchievementCurrentValue(achievement, player), 0);
});

test('signatureSetsCompleted = 1 when worldtree (3 pieces) fully collected', () => {
    const codex = mockCodexForSignatures(['세계수의 지팡이', '세계수의 검', '세계수의 로브']);
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_set_1');
    assert.equal(getAchievementCurrentValue(achievement, player), 1);
    assert.equal(isAchievementUnlocked(achievement, player), true);
});

test('signatureSetsCompleted = 5 when all sets fully collected', () => {
    // 모든 세트 멤버 + 여분 = 전체 registry 수집
    const codex = mockCodexForSignatures(Object.keys(SIGNATURE_ITEM_REGISTRY));
    const player = { stats: { codex } };
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_sig_set_all');
    assert.ok(achievement);
    const value = getAchievementCurrentValue(achievement, player);
    const totalSets = Object.keys(getSignatureSetDefinitions()).length;
    assert.equal(value, totalSets);
    assert.equal(isAchievementUnlocked(achievement, player), true);
});

test('all 6 new signature achievements exist in ACHIEVEMENTS', () => {
    const ids = [
        'ach_sig_first', 'ach_sig_5', 'ach_sig_10', 'ach_sig_20',
        'ach_sig_set_1', 'ach_sig_set_all',
    ];
    for (const id of ids) {
        const found = ACHIEVEMENTS.find((a) => a.id === id);
        assert.ok(found, `${id} should be registered`);
        assert.ok(found.reward.gold || found.reward.item || found.reward.premiumCurrency);
    }
});
