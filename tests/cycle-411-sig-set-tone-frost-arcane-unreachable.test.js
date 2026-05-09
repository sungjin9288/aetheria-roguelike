import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 411: SIG_SET_TONE `frost` / `arcane` unreachable 정리 (StatsPanel + EquipmentPanel batch)
 *   (cycle 222-410 silent dead config 시리즈 172번째 — unreachable lens 회귀).
 *
 * 발견 (2 components × 2 keys = 4 dead lookup entries):
 * - src/components/StatsPanel.tsx + src/components/EquipmentPanel.tsx 의 SIG_SET_TONE:
 *   `holy / fire / frost / shadow / arcane / nature` 6 키.
 * - 두 컴포넌트의 lookup 사이트:
 *   · `SIG_SET_TONE[activeSignatureSet.tone]` — activeSignatureSet은
 *     signatureSetBonus.computeSignatureSetBonus에서 생성, signatureSets.json 데이터 사용.
 *   · `SIG_SET_TONE[setProgress.tone]` — setProgress는 getSignatureSetProgress에서 생성, 동일 데이터.
 * - signatureSets.json sets: 5개(`celestial`/`worldtree`/`dragon-lord`/`dimension`/`shadow-lord`)
 *   tone: `holy/nature/fire/shadow` 4종만 사용 — `frost` / `arcane` 0건.
 * - 결과: SIG_SET_TONE의 `frost` / `arcane` lookup 절대 hit 안 됨.
 * - cycle 358 (steel tone removal) 동일 lens — 데이터 정합성 기반 unreachable tone.
 *
 * 패턴 (cycle 222-410 시리즈 172번째):
 * - cycle 358: LegendaryDropOverlay TONE_GLOW.steel + LegendaryCodex TONE_ACCENT.steel
 *   unreachable batch.
 * - cycle 411: StatsPanel + EquipmentPanel SIG_SET_TONE.frost / arcane unreachable batch.
 *   동일 lens 회귀 — 데이터 정합성 기반 (signatureSets.json은 4 tone만 emit).
 *
 * 수정:
 * 1) src/components/StatsPanel.tsx SIG_SET_TONE에서 frost / arcane 제거.
 * 2) src/components/EquipmentPanel.tsx SIG_SET_TONE에서 frost / arcane 제거.
 *
 * 회귀 가드:
 * - holy / fire / shadow / nature 4 tone 보존.
 * - fallback `|| SIG_SET_TONE.holy` 동작 그대로.
 * - signatureSets.json 데이터 무영향.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 411: StatsPanel SIG_SET_TONE에서 frost / arcane 0건', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const blockStart = source.indexOf('const SIG_SET_TONE');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+frost:/m.test(block),
        'StatsPanel SIG_SET_TONE에서 frost 0건');
    assert.ok(!/^\s+arcane:/m.test(block),
        'StatsPanel SIG_SET_TONE에서 arcane 0건');
});

test('cycle 411: EquipmentPanel SIG_SET_TONE에서 frost / arcane 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const blockStart = source.indexOf('const SIG_SET_TONE');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+frost:/m.test(block),
        'EquipmentPanel SIG_SET_TONE에서 frost 0건');
    assert.ok(!/^\s+arcane:/m.test(block),
        'EquipmentPanel SIG_SET_TONE에서 arcane 0건');
});

test('cycle 411: 활성 tone 4종 보존 (회귀 가드)', async () => {
    for (const f of ['src/components/StatsPanel.tsx', 'src/components/EquipmentPanel.tsx']) {
        const source = await readSrc(f);
        const blockStart = source.indexOf('const SIG_SET_TONE');
        const blockEnd = source.indexOf('});', blockStart);
        const block = source.slice(blockStart, blockEnd);
        for (const tone of ['holy', 'fire', 'shadow', 'nature']) {
            const re = new RegExp(`^\\s+${tone}:`, 'm');
            assert.ok(re.test(block), `${f} ${tone} tone 보존`);
        }
    }
});

test('cycle 411: 정합성 가드 — signatureSets.json은 4 tone만 emit', async () => {
    const sets = JSON.parse(await readSrc('src/data/signatureSets.json'));
    const tones = new Set(Object.values(sets.sets).map((s) => s.tone));
    assert.equal(tones.size, 4, '4 distinct tones');
    for (const tone of tones) {
        assert.ok(['fire', 'holy', 'nature', 'shadow'].includes(tone),
            `tone ${tone}은 4종 활성 set tone 안에`);
    }
});

test('cycle 410 회귀 가드: getTraitItemResonance.reasons 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnStart = source.indexOf('export const getTraitItemResonance');
    const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(!/return \{[^}]*reasons,/.test(fnBlock),
        'cycle 409 reasons 출력 0건 보존');
});
