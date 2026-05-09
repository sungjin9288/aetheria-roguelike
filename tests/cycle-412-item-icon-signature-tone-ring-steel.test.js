import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 412: ItemIcon SIGNATURE_TONE_RING `steel` unreachable 정리
 *   (cycle 222-411 silent dead config 시리즈 173번째 — unreachable lens 회귀, cycle 358 paired completion).
 *
 * 발견 (1 dead lookup entry):
 * - src/components/icons/ItemIcon.tsx SIGNATURE_TONE_RING: 9 키
 *   (holy/fire/frost/shadow/arcane/nature/earth/steel/rust).
 * - lookup 사이트: `SIGNATURE_TONE_RING[getSignatureMetadata(item)?.tone] || SIGNATURE_TONE_RING.holy`.
 * - signatureRegistry.json tones: arcane/earth/fire/frost/holy/nature/rust/shadow 8종 emit —
 *   `steel` 0건.
 * - 결과: SIGNATURE_TONE_RING.steel lookup 절대 hit 안 됨.
 * - cycle 358에서 LegendaryDropOverlay TONE_GLOW.steel + LegendaryCodex
 *   TONE_ACCENT.steel batch 제거 — 이때 ItemIcon 누락. cycle 358 paired completion.
 *
 * 패턴 (cycle 222-411 시리즈 173번째):
 * - cycle 358: TONE_GLOW.steel + TONE_ACCENT.steel batch (2 components).
 * - cycle 411: SIG_SET_TONE.frost / arcane batch (2 components).
 * - cycle 412: SIGNATURE_TONE_RING.steel 정리 — cycle 358 누락분 paired completion.
 *   동일 lens 회귀 — 데이터 정합성 기반.
 *
 * 수정 (src/components/icons/ItemIcon.tsx):
 * - SIGNATURE_TONE_RING에서 `steel` 라인 제거.
 *
 * 회귀 가드:
 * - holy/fire/frost/shadow/arcane/nature/earth/rust 8 tone 보존.
 * - fallback `|| SIGNATURE_TONE_RING.holy` 동작 그대로.
 * - signatureRegistry.json 데이터 무영향.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 412: ItemIcon SIGNATURE_TONE_RING에서 steel 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'SIGNATURE_TONE_RING에서 steel 0건');
});

test('cycle 412: 활성 8 tone 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth', 'rust']) {
        const re = new RegExp(`^\\s+${tone}:`, 'm');
        assert.ok(re.test(block), `${tone} tone 보존`);
    }
});

test('cycle 412: 정합성 가드 — signatureRegistry.json은 8 tone만 emit (no steel)', async () => {
    const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
    const tones = new Set(Object.values(reg.entries).map((e) => e.tone).filter(Boolean));
    assert.ok(!tones.has('steel'), 'steel tone 0건 (정합성)');
    assert.ok(tones.has('holy') && tones.has('fire'), 'holy/fire 활성 보존');
});

test('cycle 411 회귀 가드: SIG_SET_TONE frost/arcane 0건', async () => {
    for (const f of ['src/components/StatsPanel.tsx', 'src/components/EquipmentPanel.tsx']) {
        const source = await readSrc(f);
        const blockStart = source.indexOf('const SIG_SET_TONE');
        const blockEnd = source.indexOf('});', blockStart);
        const block = source.slice(blockStart, blockEnd);
        assert.ok(!/^\s+frost:/m.test(block), `${f} frost 0건 보존`);
        assert.ok(!/^\s+arcane:/m.test(block), `${f} arcane 0건 보존`);
    }
});
