import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateData } from '../src/utils/gameUtils.js';

/**
 * cycle 189: migrateData가 PremiumShop 구매 자산 4종 default 처리 (cycle 188 follow-up).
 *
 * 발견:
 * - cycle 188이 ASCEND에서 4 premium 자산을 보존하도록 fix.
 * - 그러나 migrateData는 옛 save에 4 필드 미정의 시 default 처리 누락 → undefined.
 * - 코드 fallback(`x || 0`)으로 안전하지만 데이터 형태 inconsistent — cycle 119 영구
 *   카운터 default 처리와 통일 안 됨.
 *
 * 수정 (src/utils/gameUtils.ts migrateData):
 * - target.reviveTokens, stats.synthProtects, stats.cosmeticTitles, maxInv 명시 default.
 * - 모두 0 / [] / undefined fallback (maxInv는 PremiumShop INV_EXPAND 미구매 시 player.maxInv
 *   undefined 그대로 — fallback 코드가 BALANCE.INV_MAX_SIZE로 처리).
 */

test('cycle 189: 옛 save에 premium 자산 누락 → migrate 후 0 / [] 명시 초기화', () => {
    const oldSave = {
        version: 4.0,
        player: {
            name: 'old',
            gender: 'male',
            level: 30,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 50, def: 30,
            // premium 자산 미정의
            stats: { kills: 100, total_gold: 5000, deaths: 0, killRegistry: {}, bossKills: 0 },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(oldSave);
    const player = migrated.player;

    // reviveTokens default 0
    assert.equal(player.reviveTokens, 0);
    // synthProtects default 0
    assert.equal(player.stats.synthProtects, 0);
    // cosmeticTitles default []
    assert.deepEqual(player.stats.cosmeticTitles, []);
    // maxInv 미정의 — PremiumShop 미사용자는 undefined (BALANCE.INV_MAX_SIZE fallback).
    assert.equal(player.maxInv, undefined);
});

test('cycle 189: 기존 보유값 보존 (회귀 가드)', () => {
    const save = {
        version: 5.0,
        player: {
            name: 'rich',
            gender: 'male',
            level: 50,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 50, def: 30,
            reviveTokens: 3,
            maxInv: 30,
            stats: {
                kills: 200, total_gold: 10000, deaths: 0, killRegistry: {}, bossKills: 0,
                synthProtects: 5,
                cosmeticTitles: ['title_stargazer'],
            },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(save);
    const player = migrated.player;

    assert.equal(player.reviveTokens, 3);
    assert.equal(player.maxInv, 30);
    assert.equal(player.stats.synthProtects, 5);
    assert.deepEqual(player.stats.cosmeticTitles, ['title_stargazer']);
});

test('cycle 189: 음수/falsy reviveTokens은 0으로 정규화 (회귀 가드)', () => {
    const save = {
        version: 5.0,
        player: {
            name: 'edge',
            gender: 'male',
            level: 1,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 10, def: 5,
            reviveTokens: -5, // 음수 (이상치)
            stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, synthProtects: -2 },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(save);
    assert.equal(migrated.player.reviveTokens, 0, '음수 reviveTokens은 0으로 정규화');
    assert.equal(migrated.player.stats.synthProtects, 0, '음수 synthProtects도 0으로 정규화');
});
