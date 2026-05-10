import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 447: characterAppearance palette 5 출력 dead 정리
 *   (cycle 222-446 silent dead config 시리즈 205번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/443/445/446 패턴, 5 필드 batch).
 *
 * 발견 (5 dead palette fields):
 * - src/utils/characterAppearance.ts deriveCharacterAppearance.palette:
 *     `{ skin, outline, eye, blush, hair, outfit, accent, armor, weapon, offhand, glow }`
 * - 호출 사이트 (consumer) 분석:
 *     · production: PixelCharacterAvatar.tsx — `palette.glow` / `palette.accent`만 read.
 *     · tests: character-appearance.test.js — `palette.outfit / .weapon / .offhand` read.
 *     · cycle 362 test — `palette.hair` read.
 *     · `palette.skin / .outline / .eye / .blush / .armor` read 0건 (전체 src/ + tests/).
 * - 결과: 5 필드 (skin / outline / eye / blush / armor)는 set하지만 어디로도
 *   흐르지 않는 dead.
 *
 * 패턴 (cycle 222-446 시리즈 205번째):
 * - cycle 333-356/443/445/446: 함수 출력 dead 필드 cleanup.
 * - cycle 447: characterAppearance palette 5 dead 필드 batch — 동일 lens 회귀.
 *
 * 수정 (src/utils/characterAppearance.ts):
 * - palette object에서 skin / outline / eye / blush / armor 5 필드 제거.
 * - hair / outfit / accent / weapon / offhand / glow 6 활성 필드 보존.
 * - getOverlayTone 호출도 'armor' slot 제거 (weapon / offhand만 유지).
 *
 * 회귀 가드:
 * - palette.glow / .accent (production read) 보존.
 * - palette.outfit / .weapon / .offhand / .hair (test read) 보존.
 * - getOverlayTone 함수 자체는 weapon / offhand로 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 447: deriveCharacterAppearance.palette에서 5 dead 필드 0건', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    // palette object 블록 추출
    const paletteIdx = source.indexOf('palette: {');
    const paletteEnd = source.indexOf('},', paletteIdx);
    const block = source.slice(paletteIdx, paletteEnd);
    assert.ok(!/skin:/.test(block), 'palette.skin 0건');
    assert.ok(!/outline:/.test(block), 'palette.outline 0건');
    assert.ok(!/eye:/.test(block), 'palette.eye 0건');
    assert.ok(!/blush:/.test(block), 'palette.blush 0건');
    assert.ok(!/^\s+armor:/m.test(block), 'palette.armor 0건');
});

test('cycle 447: 활성 필드 (glow / accent / outfit / weapon / offhand / hair) 보존', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
    const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
    const appearance = deriveCharacterAppearance(player);
    assert.equal(typeof appearance.palette.glow, 'string', 'glow 보존');
    assert.equal(typeof appearance.palette.accent, 'string', 'accent 보존');
    assert.equal(typeof appearance.palette.outfit, 'string', 'outfit 보존');
    assert.equal(typeof appearance.palette.weapon, 'string', 'weapon 보존');
    assert.equal(typeof appearance.palette.offhand, 'string', 'offhand 보존');
    assert.equal(typeof appearance.palette.hair, 'string', 'hair 보존');
});

test('cycle 447: dead 필드 부재 runtime 검증', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
    const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
    const appearance = deriveCharacterAppearance(player);
    assert.equal(appearance.palette.skin, undefined, 'skin 부재');
    assert.equal(appearance.palette.outline, undefined, 'outline 부재');
    assert.equal(appearance.palette.eye, undefined, 'eye 부재');
    assert.equal(appearance.palette.blush, undefined, 'blush 부재');
    assert.equal(appearance.palette.armor, undefined, 'armor 부재');
});

test('cycle 447: 정합성 가드 — production palette dead 필드 read 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    const deadFields = ['skin', 'outline', 'eye', 'blush'];
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        for (const field of deadFields) {
            const re = new RegExp(`palette\\.${field}\\b`);
            assert.ok(!re.test(content), `${fp}에서 palette.${field} read 0건`);
        }
    }
});

test('cycle 446 회귀 가드: TONE_PALETTES outline / mid / hi / material 0건', async () => {
    const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
    const tones = Object.keys(TONE_PALETTES);
    if (tones.length > 0) {
        const sample = TONE_PALETTES[tones[0]];
        assert.equal(sample.outline, undefined, 'cycle 446 outline 0건 보존');
        assert.equal(sample.mid, undefined, 'cycle 446 mid 0건 보존');
        assert.equal(sample.hi, undefined, 'cycle 446 hi 0건 보존');
        assert.equal(sample.material, undefined, 'cycle 446 material 0건 보존');
    }
});
