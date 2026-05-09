import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 413: SignatureBadge TONE_COLORS `steel` unreachable 정리
 *   (cycle 222-412 silent dead config 시리즈 174번째 — unreachable lens 회귀,
 *   cycle 358 / 412 paired completion).
 *
 * 발견 (1 dead lookup entry):
 * - src/components/icons/SignatureBadge.tsx TONE_COLORS:
 *   8 키 (holy/fire/frost/shadow/arcane/nature/earth/steel).
 * - lookup 사이트: `TONE_COLORS[meta?.tone] || DEFAULT_TONE_COLOR`.
 * - signatureRegistry.json tones: arcane/earth/fire/frost/holy/nature/rust/shadow
 *   8종 emit — `steel` 0건 (정합성 가드).
 * - 결과: TONE_COLORS.steel lookup 절대 hit 안 됨.
 * - cycle 358 / 412 paired completion — TONE_GLOW(LegendaryDropOverlay) /
 *   TONE_ACCENT(LegendaryCodex) / SIGNATURE_TONE_RING(ItemIcon) 모두 steel 정리,
 *   SignatureBadge만 누락분.
 *
 * 패턴 (cycle 222-412 시리즈 174번째):
 * - cycle 358: TONE_GLOW.steel + TONE_ACCENT.steel batch.
 * - cycle 411: SIG_SET_TONE.frost / arcane batch.
 * - cycle 412: SIGNATURE_TONE_RING.steel.
 * - cycle 413: SignatureBadge TONE_COLORS.steel — cycle 358/412 paired completion.
 *
 * 수정 (src/components/icons/SignatureBadge.tsx):
 * - TONE_COLORS에서 `steel` 라인 제거.
 *
 * 회귀 가드:
 * - holy/fire/frost/shadow/arcane/nature/earth 7 tone 보존.
 * - DEFAULT_TONE_COLOR fallback (holy) 동작 그대로.
 * - signatureRegistry.json 데이터 무영향.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 413: SignatureBadge TONE_COLORS에서 steel 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'TONE_COLORS에서 steel 0건');
});

test('cycle 413: 활성 tone 7종 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth']) {
        const re = new RegExp(`^\\s+${tone}:`, 'm');
        assert.ok(re.test(block), `${tone} tone 보존`);
    }
});

test('cycle 413: 정합성 가드 — signatureRegistry.json은 steel tone 0건', async () => {
    const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
    const tones = new Set(Object.values(reg.entries).map((e) => e.tone).filter(Boolean));
    assert.ok(!tones.has('steel'), 'steel tone 0건');
});

test('cycle 412 회귀 가드: ItemIcon SIGNATURE_TONE_RING.steel 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'cycle 412 SIGNATURE_TONE_RING.steel 0건 보존');
});
