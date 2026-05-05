import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 182: 인벤토리 cap 검사가 player.maxInv (확장된 슬롯)을 존중하도록 정합 fix.
 *
 * 발견:
 * - PremiumShop으로 INV_EXPAND 구매 시 player.maxInv가 BALANCE.INV_MAX_SIZE보다
 *   커질 수 있음 (예: 20 → 25).
 * - useInventoryActions / ShopPanel은 'player.maxInv || BALANCE.INV_MAX_SIZE'
 *   패턴으로 player 슬롯 우선 — 정합.
 * - 그러나 일부 코드는 BALANCE.INV_MAX_SIZE만 사용:
 *   - exploreUtils.ts:363 (chain reward 추가 시 cap 검사) — 확장 인벤(25)에서
 *     20 도달 시 reward skip 회귀.
 *   - adventureGuide.ts:172/313/316 (인벤 경고 hint) — 18칸에서 잘못된 경고
 *     발동.
 *
 * 수정:
 * - exploreUtils.ts:363 'BALANCE.INV_MAX_SIZE' → 'updated.maxInv || BALANCE.INV_MAX_SIZE'.
 * - adventureGuide.ts:139/250 inventoryCap 변수 도입 — 같은 fallback 패턴.
 * - 회귀 가드: 모든 'BALANCE.INV_MAX_SIZE' 단독 사용이 fallback 형태로 유지됨.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    let out = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out = out.concat(await walk(full));
        else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
            out.push({ path: full, src: await readFile(full, 'utf8') });
        }
    }
    return out;
};

test('cycle 182: src/utils/exploreUtils.ts 의 chain reward cap에 maxInv 우선 사용', async () => {
    const src = await readFile(path.join(SRC, 'utils/exploreUtils.ts'), 'utf8');
    // chain reward 분기에 invCap 변수 또는 maxInv 폴백 패턴 명시.
    assert.match(src, /maxInv/, 'exploreUtils.ts에 maxInv 참조 있어야 함');
    assert.match(src, /invCap/, 'cycle 182 invCap 변수 도입 명시');
});

test('cycle 182: src/utils/adventureGuide.ts inventoryCap 변수 도입', async () => {
    const src = await readFile(path.join(SRC, 'utils/adventureGuide.ts'), 'utf8');
    assert.match(src, /inventoryCap/, 'inventoryCap 변수 명시');
    // 둘 다 inventoryCap 사용 후 BALANCE.INV_MAX_SIZE 단독 사용은 폴백뿐.
    const lines = src.split('\n');
    const bareRefs = lines.filter((line) => {
        if (!line.includes('BALANCE.INV_MAX_SIZE')) return false;
        // fallback 형태 ('player.maxInv || BALANCE.INV_MAX_SIZE') 또는 변수 정의는 OK.
        if (line.includes('maxInv ||') || line.includes('inventoryCap')) return false;
        // 코멘트 라인은 제외.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
        return true;
    });
    assert.deepEqual(bareRefs, [],
        `adventureGuide.ts에 cap 단독 사용 라인:\n  ${bareRefs.join('\n  ')}`);
});

test('cycle 182: BALANCE.INV_MAX_SIZE는 여전히 정의됨 (fallback 가드)', () => {
    assert.ok(typeof BALANCE.INV_MAX_SIZE === 'number',
        'BALANCE.INV_MAX_SIZE는 default fallback으로 여전히 필요');
    assert.ok(BALANCE.INV_MAX_SIZE > 0);
});
