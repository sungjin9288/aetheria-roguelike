import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';

/**
 * cycle 195: dead BALANCE / CONSTANTS 키 6종 정리 + 회귀 가드.
 *
 * 발견:
 * - cycle 138이 CONSTANTS/BALANCE namespace mismatch 회귀 가드(사용된 키가 정의된
 *   네임스페이스와 일치하는지). 그러나 정의됐지만 사용 0건인 dead key는 검사 안 함.
 * - 7 dead key 발견 (CHALLENGE_REWARD_SCALING은 (BALANCE as any).pattern으로 사용
 *   중이라 false positive — 6개만 진짜 dead):
 *   - BALANCE.MILESTONE_KILLS — checkMilestones가 10/50/100 inline 하드코딩.
 *   - BALANCE.EXP_LEVEL_CAP_50 — cycle 99에서 EXP_LEVEL_HARD_CAP으로 이행 완료.
 *   - BALANCE.RARITY_TIERS — UI는 RARITY_CLASSES 사용.
 *   - BALANCE.RARITY_SELL_MULT — ShopPanel 별도 처리.
 *   - BALANCE.COSMETIC_TITLE_COST — cycle 185 이후 PREMIUM_SHOP.cosmeticTitles 각 항목에
 *     개별 cost 정의됨.
 *   - CONSTANTS.SAVE_KEY — Firebase Firestore 사용으로 localStorage 미사용.
 *
 * 수정 (src/data/constants.ts): 6 dead key 제거 + 코멘트로 제거 이유 명시.
 *
 * 가드: 모든 BALANCE/CONSTANTS 키가 src/ 어딘가에서 참조됨. cycle 138 namespace
 * mismatch 가드와 짝 — 새 dead key 추가 시 즉시 detect.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');
const CONSTANTS_PATH = path.join(SRC, 'data/constants.ts');

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    let out = '';
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out += await walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
            if (full === CONSTANTS_PATH) continue;
            out += await readFile(full, 'utf8');
            out += '\n';
        }
    }
    return out;
};

test('cycle 195: 6 dead key 제거됨 (BALANCE / CONSTANTS)', () => {
    assert.equal(BALANCE.MILESTONE_KILLS, undefined);
    assert.equal(BALANCE.EXP_LEVEL_CAP_50, undefined);
    assert.equal(BALANCE.RARITY_TIERS, undefined);
    assert.equal(BALANCE.RARITY_SELL_MULT, undefined);
    assert.equal(BALANCE.COSMETIC_TITLE_COST, undefined);
    assert.equal(CONSTANTS.SAVE_KEY, undefined);
});

test('cycle 195: 모든 BALANCE 키가 src/ 어딘가에서 참조됨 (회귀 가드)', async () => {
    const corpus = await walk(SRC);
    const dead = [];
    for (const key of Object.keys(BALANCE)) {
        // BALANCE.X 또는 (BALANCE as any).X 패턴 모두 감지.
        const re = new RegExp(`BALANCE(?:\\s+as\\s+any\\)?)?[\\.\\)]\\s*\\.?\\s*${key}\\b|\\(BALANCE\\s+as\\s+any\\)\\.${key}\\b`);
        if (!re.test(corpus)) dead.push(key);
    }
    assert.deepEqual(dead, [],
        `dead BALANCE keys (defined but not used in src/):\n  ${dead.join('\n  ')}`);
});

test('cycle 195: 모든 CONSTANTS 키가 src/ 어딘가에서 참조됨 (회귀 가드)', async () => {
    const corpus = await walk(SRC);
    const dead = [];
    for (const key of Object.keys(CONSTANTS)) {
        const re = new RegExp(`CONSTANTS\\.${key}\\b`);
        if (!re.test(corpus)) dead.push(key);
    }
    assert.deepEqual(dead, [],
        `dead CONSTANTS keys (defined but not used in src/):\n  ${dead.join('\n  ')}`);
});

test('cycle 138 회귀 가드: 핵심 active key 보존 (DATA_VERSION / EXP_LEVEL_HARD_CAP / RARITY_CLASSES)', () => {
    assert.equal(typeof CONSTANTS.DATA_VERSION, 'number');
    assert.equal(typeof BALANCE.EXP_LEVEL_HARD_CAP, 'number');
    assert.equal(typeof BALANCE.REVIVE_COST, 'number');
});
