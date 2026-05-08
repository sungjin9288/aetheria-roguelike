import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 358: signature tone steel 2 entries dead 정리 (LegendaryDropOverlay + LegendaryCodex)
 *   (cycle 222-357 silent dead config 시리즈 125번째 — cleanup lens 연속).
 *
 * 발견 (2 dead tone entries — same key, 2 components):
 * - LegendaryDropOverlay.tsx TONE_GLOW.steel (3 sub-fields).
 * - LegendaryCodex.tsx TONE_ACCENT.steel (3 sub-fields).
 * - signatureRegistry.json / signatureSets.json 어디에도 tone='steel' 0건.
 *   활성 tone: holy / fire / frost / shadow / arcane / nature / earth / rust 8종만 사용.
 *   steel은 두 lookup 테이블에서 정의됐지만 실 데이터에서 0건이라 unreachable.
 *
 * 패턴 (cycle 222-357 silent dead config 시리즈 125번째):
 * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events unreachable dead.
 * - cycle 358: TONE_GLOW.steel / TONE_ACCENT.steel 2 entries unreachable dead.
 *
 * 수정:
 * - src/components/LegendaryDropOverlay.tsx: TONE_GLOW.steel 엔트리 제거.
 * - src/components/codex/LegendaryCodex.tsx: TONE_ACCENT.steel 엔트리 제거.
 *
 * 회귀 가드:
 * - 활성 8 tone (holy/fire/frost/shadow/arcane/nature/earth/rust) 보존.
 * - DEFAULT_GLOW = TONE_GLOW.holy / DEFAULT_TONE_ACCENT = TONE_ACCENT.holy fallback 보존.
 * - meta?.tone lookup의 || fallback 안전망 동일.
 * - equipmentArt.ts TONE_PALETTES.steel (별도 시스템 — 일반 장비) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 358: TONE_GLOW.steel 0건 (LegendaryDropOverlay)', async () => {
    const source = await readSrc('src/components/LegendaryDropOverlay.tsx');
    const fnStart = source.indexOf('const TONE_GLOW');
    const fnEnd = source.indexOf('const DEFAULT_GLOW');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'TONE_GLOW에서 steel entry 0건');
});

test('cycle 358: TONE_ACCENT.steel 0건 (LegendaryCodex)', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    const fnStart = source.indexOf('const TONE_ACCENT');
    const fnEnd = source.indexOf('const CATEGORY_LABEL');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'TONE_ACCENT에서 steel entry 0건');
});

test('cycle 358: 활성 8 tone 보존 (회귀 가드)', async () => {
    const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
    const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
    const activeTones = ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth', 'rust'];
    for (const tone of activeTones) {
        assert.ok(new RegExp(`^\\s+${tone}:`, 'm').test(overlay), `TONE_GLOW.${tone} 보존`);
        assert.ok(new RegExp(`^\\s+${tone}:`, 'm').test(codex), `TONE_ACCENT.${tone} 보존`);
    }
});

test('cycle 358: DEFAULT_GLOW / DEFAULT_TONE_ACCENT fallback 보존', async () => {
    const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
    const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(/DEFAULT_GLOW = TONE_GLOW\.holy/.test(overlay),
        'DEFAULT_GLOW = TONE_GLOW.holy fallback 보존');
    assert.ok(/DEFAULT_TONE_ACCENT = TONE_ACCENT\.holy/.test(codex),
        'DEFAULT_TONE_ACCENT = TONE_ACCENT.holy fallback 보존');
});

test('cycle 357 회귀 가드: FALLBACK_EVENT_POOL \'시작의 마을\' 0건 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
    const fnEnd = source.indexOf('export const pickFallbackEvent');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/'시작의 마을':/.test(block),
        'cycle 357 \'시작의 마을\' 0건 보존');
});
