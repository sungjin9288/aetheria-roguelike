import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    SIGNATURE_PITY,
    getSignaturePityMultiplier,
} from '../src/utils/signaturePity.js';

/**
 * Signature pity counter — "나쁜 RNG" 보호막.
 *
 * 플레이어가 보스를 여러 번 잡아도 signature가 안 나올 때 각 step마다 드롭률을 가속.
 * signature가 하나라도 드랍되면 pity = 0으로 reset.
 *
 * 계약:
 *   1. getSignaturePityMultiplier(pity) — 계단식 배율, 1.0에서 시작해 CAP까지 상승
 *   2. pity < THRESHOLD → 1.0 (효과 없음)
 *   3. pity ≥ THRESHOLD → 1 + floor(pity/THRESHOLD) * STEP_MULT, CAP로 clamp
 *   4. 음수/null/undefined pity는 0으로 취급
 *   5. processLoot(enemy, player, pityMult)가 signature 항목에만 pityMult 적용
 *   6. combatVictory가 boss kill 후 pity를 올바르게 업데이트
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SIGNATURE_PITY constants are frozen and positive', () => {
    assert.ok(Object.isFrozen(SIGNATURE_PITY));
    assert.ok(SIGNATURE_PITY.THRESHOLD > 0);
    assert.ok(SIGNATURE_PITY.STEP_MULT > 0);
    assert.ok(SIGNATURE_PITY.CAP > 1);
});

test('getSignaturePityMultiplier returns 1.0 below threshold', () => {
    assert.equal(getSignaturePityMultiplier(0), 1.0);
    assert.equal(getSignaturePityMultiplier(1), 1.0);
    assert.equal(getSignaturePityMultiplier(SIGNATURE_PITY.THRESHOLD - 1), 1.0);
});

test('getSignaturePityMultiplier steps up past threshold', () => {
    const thr = SIGNATURE_PITY.THRESHOLD;
    const step = SIGNATURE_PITY.STEP_MULT;
    assert.ok(Math.abs(getSignaturePityMultiplier(thr) - (1 + step)) < 1e-9, 'at threshold → 1 + step');
    assert.ok(Math.abs(getSignaturePityMultiplier(thr * 2) - (1 + 2 * step)) < 1e-9, 'at 2×threshold → 1 + 2*step');
});

test('getSignaturePityMultiplier is clamped at CAP', () => {
    assert.equal(getSignaturePityMultiplier(9999), SIGNATURE_PITY.CAP);
});

test('getSignaturePityMultiplier handles bad input safely', () => {
    assert.equal(getSignaturePityMultiplier(null), 1.0);
    assert.equal(getSignaturePityMultiplier(undefined), 1.0);
    assert.equal(getSignaturePityMultiplier(-5), 1.0);
    assert.equal(getSignaturePityMultiplier('abc'), 1.0);
});

// --- CombatEngine.loot processLoot wiring ---

test('CombatEngine.loot processLoot accepts signaturePityMult param', async () => {
    const source = await readSrc('src/systems/CombatEngine.loot.ts');
    assert.ok(
        /export const processLoot\s*=\s*\([^)]*signaturePityMult/.test(source),
        'processLoot signature should include signaturePityMult param'
    );
    // signature만 대상 — SIGNATURE_ITEM_REGISTRY lookup 필요
    assert.ok(
        /SIGNATURE_ITEM_REGISTRY/.test(source),
        'processLoot should reference SIGNATURE_ITEM_REGISTRY to gate pity boost'
    );
});

test('CombatEngine top-level processLoot forwards signaturePityMult', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(
        /processLoot\s*\([^)]*signaturePityMult/.test(source),
        'CombatEngine.processLoot should expose signaturePityMult param'
    );
});

// --- combatVictory pity bookkeeping ---

test('combatVictory imports pity helper and isSignatureItem', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(source.includes('getSignaturePityMultiplier'), 'should import getSignaturePityMultiplier');
    assert.ok(source.includes('isSignatureItem'), 'should import isSignatureItem to detect drop');
});

test('combatVictory passes pityMult to processLoot and updates signaturePity after', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    // pityMult 계산 → processLoot 호출에 전달
    assert.ok(
        /processLoot\([^)]*signaturePityMult|processLoot\([^,]+,[^,]+,\s*\w*[pP]ity/.test(source),
        'processLoot call should forward pity multiplier as 3rd arg'
    );
    // boss kill 이후 pity 갱신 (reset / increment 분기)
    assert.ok(
        /signaturePity:\s*0/.test(source),
        'should reset signaturePity to 0 on signature drop'
    );
    // 증분: "signaturePity: prevPity + 1" 또는 "signaturePity: (pity + 1)" 형태 허용
    assert.ok(
        /signaturePity:\s*[\w\s.?]*\+\s*1/.test(source),
        'should increment signaturePity on boss kill without signature'
    );
    // boss 가드
    assert.ok(
        /deadEnemy\??\.isBoss/.test(source),
        'pity increment should be guarded by deadEnemy.isBoss'
    );
});
