import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 427: SignatureBadge TONE_COLORS에 rust tone 추가 — silent UI 결손 fix.
 *   (cycle 222-426 silent dead config 시리즈 187번째 — silent UI 결손 lens
 *   회귀, cycle 396/398/426 schema 미스매치 패턴).
 *
 * 발견 (silent UI gap — schema 불일치):
 * - signatureRegistry.json은 8 tones emit: arcane/earth/fire/frost/holy/nature/
 *   rust/shadow. '광기의 갑주' 아이템이 tone='rust'.
 * - 다른 signature surface 모두 rust 보유:
 *     · LegendaryDropOverlay TONE_GLOW.rust ✓
 *     · LegendaryCodex TONE_ACCENT.rust ✓
 *     · ItemIcon SIGNATURE_TONE_RING.rust ✓
 * - 그러나 SignatureBadge TONE_COLORS는 7 tone만 (rust 누락):
 *     holy/fire/frost/shadow/arcane/nature/earth.
 *   cycle 413 정리 당시 rust 추가도 같이 처리됐어야 했으나 paired completion 누락.
 * - 결과: 광기의 갑주 등 rust signature 아이템 획득 시 SignatureBadge
 *   `TONE_COLORS[meta.tone]` lookup이 undefined → DEFAULT_TONE_COLOR(holy gold)
 *   fallback. 다른 surface는 rust orange로 표시되는데 badge만 gold 표시.
 *
 * 패턴 (cycle 222-426 시리즈 187번째):
 * - cycle 396: StatsPanel syn.name → syn.label schema 미스매치 fix.
 * - cycle 398: DashboardMobileSummary trait.label → trait.title fix.
 * - cycle 426: signatureSetBonus.activeSet 3 필드 schema 정합 복원.
 * - cycle 427: SignatureBadge TONE_COLORS rust tone 정합 — 동일 lens 회귀.
 *
 * 수정 (src/components/icons/SignatureBadge.tsx):
 * - TONE_COLORS에 rust 엔트리 추가:
 *     rust: { fill: '#d9a56c', glow: 'rgba(217,165,108,0.6)', stroke: '#4a2e16' }
 *   (ItemIcon SIGNATURE_TONE_RING.rust + 다른 entry stroke 패턴 동기).
 *
 * 회귀 가드:
 * - holy/fire/frost/shadow/arcane/nature/earth 7 tone 그대로.
 * - DEFAULT_TONE_COLOR fallback (holy) 동작 그대로 (unmapped tone).
 * - cycle 413 회귀 가드: steel 0건 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 427: SignatureBadge TONE_COLORS에 rust 엔트리 존재', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(/^\s+rust:/m.test(block), 'TONE_COLORS에 rust 엔트리 존재');
});

test('cycle 427: rust 엔트리에 fill/glow/stroke 3 필드 모두 정의', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const rustLineMatch = block.match(/^\s+rust:\s*\{[^}]+\}/m);
    assert.ok(rustLineMatch, 'rust 라인 매칭');
    const rustLine = rustLineMatch[0];
    assert.ok(/fill:/.test(rustLine), 'rust.fill 정의');
    assert.ok(/glow:/.test(rustLine), 'rust.glow 정의');
    assert.ok(/stroke:/.test(rustLine), 'rust.stroke 정의');
});

test('cycle 427: 활성 7 tone 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth']) {
        const re = new RegExp(`^\\s+${tone}:`, 'm');
        assert.ok(re.test(block), `${tone} tone 보존`);
    }
});

test('cycle 427: 정합성 가드 — signatureRegistry rust tone 아이템 존재', async () => {
    const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
    const rustItems = Object.entries(reg.entries).filter(([, m]) => m.tone === 'rust');
    assert.ok(rustItems.length >= 1, 'rust tone 아이템 1개 이상');
});

test('cycle 427: 다른 signature surface와 일관성 — 8 tone 모두 정의 (rust 포함)', async () => {
    const sources = await Promise.all([
        readSrc('src/components/icons/SignatureBadge.tsx'),
        readSrc('src/components/icons/ItemIcon.tsx'),
        readSrc('src/components/LegendaryDropOverlay.tsx'),
        readSrc('src/components/codex/LegendaryCodex.tsx'),
    ]);
    for (const src of sources) {
        // 각 surface는 'rust' 키를 lookup table에 포함해야 함
        assert.ok(/rust:/.test(src), 'surface에 rust 키 존재');
    }
});

test('cycle 413 회귀 가드: SignatureBadge TONE_COLORS에서 steel 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+steel:/m.test(block), 'cycle 413 steel 0건 보존');
});

test('cycle 426 회귀 가드: signatureSetBonus.activeSet에 atkMult 노출', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
    const equip = {
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    };
    const result = computeSignatureSetBonus(equip);
    assert.equal(typeof result.activeSet?.atkMult, 'number', 'cycle 426 activeSet.atkMult 보존');
});
