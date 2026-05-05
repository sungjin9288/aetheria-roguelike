import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { TITLES } from '../src/data/titles.js';
import { PREMIUM_SHOP } from '../src/data/premiumShop.js';
import { getTitleDefinition } from '../src/utils/gameUtils.js';

/**
 * cycle 185: PremiumShop cosmeticTitles 정식 TITLES 등록 + 구매 시 player.titles 추가.
 *
 * 발견:
 * - PremiumShop에 4 cosmeticTitles 정의: 별을 보는 자 / 공허를 걷는 자 /
 *   에테르의 아이 / 세계의 끝 (각 100~200 premium currency).
 * - 그러나 purchaseCosmeticTitle이 player.stats.cosmeticTitles에만 저장하고
 *   player.titles에는 추가 안 함 → SystemTab title 디스플레이에서 invisible.
 * - 결과: 플레이어가 100~200 프리미엄 재화를 소비해도 title을 활성화/표시
 *   할 수 없는 "구매했지만 못 쓰는" UX 회귀.
 *
 * 수정:
 * 1. titles.ts에 4 cosmetic title 정식 등록 (cycle 175 시즌 칭호와 동일 패턴 —
 *    Korean name을 id로 사용, cond.type = 'cosmetic').
 * 2. useInventoryActions.purchaseCosmeticTitle 수정 — 구매 시 player.titles에도
 *    titleName push (이미 있으면 dedup). stats.cosmeticTitles는 보존(owned 체크용).
 *
 * cycle 175 (시즌 칭호) 패턴 시리즈에 합류 — premium/season 등 specific cond.type
 * 칭호 모두 정식 TITLES 등록.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const COSMETIC_NAMES = ['별을 보는 자', '공허를 걷는 자', '에테르의 아이', '세계의 끝'];

test('cycle 185: 4 cosmetic title 모두 TITLES에 정식 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    for (const name of COSMETIC_NAMES) {
        assert.ok(ids.has(name), `cosmetic title '${name}' missing from TITLES`);
    }
});

test('cycle 185: getTitleDefinition으로 cosmetic title 정의 lookup 가능', () => {
    const def = getTitleDefinition('별을 보는 자');
    assert.ok(def);
    assert.equal(def.name, '별을 보는 자');
    assert.equal(def.cond?.type, 'cosmetic');
    assert.match(def.color, /text-/);
});

test('cycle 185: PREMIUM_SHOP cosmeticTitles 모두 TITLES에 등록됨 (정합성 가드)', () => {
    const titleNames = new Set(TITLES.map((t) => t.id));
    const missing = [];
    for (const ct of PREMIUM_SHOP.cosmeticTitles || []) {
        if (!titleNames.has(ct.name)) missing.push(`${ct.id} (${ct.name})`);
    }
    assert.deepEqual(missing, [],
        `PREMIUM_SHOP cosmetic title not in TITLES:\n  ${missing.join('\n  ')}`);
});

test('cycle 185: purchaseCosmeticTitle이 player.titles에 push (회귀 가드)', async () => {
    const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
    // 함수 내부에 'titles:' assignment가 있어야 함 — purchaseCosmeticTitle 분기.
    const idx = src.indexOf('purchaseCosmeticTitle');
    assert.ok(idx > -1);
    const fnSlice = src.slice(idx, idx + 2000);
    assert.match(fnSlice, /titles:\s*nextTitles/, 'cycle 185: titles 배열 갱신 명시');
});

test('cycle 174 회귀 가드: TITLES id 유일성 (cosmetic 추가 후에도 0 dup)', () => {
    const counts = new Map();
    for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});
