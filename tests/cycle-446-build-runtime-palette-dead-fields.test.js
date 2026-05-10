import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 446: artPalette buildRuntimePalette 4 출력 dead 정리
 *   (cycle 222-445 silent dead config 시리즈 204번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/443/445 패턴).
 *
 * 발견 (4 dead output fields):
 * - src/data/artPalette.ts buildRuntimePalette (line 23+):
 *     return `{ outline, shade, mid, hi, trim, material, base, accent }`
 * - 호출 사이트 (consumer) 분석:
 *     · equipmentArt.ts tintPalette — `palette.base / .shade / .accent / .trim` 만 read.
 *     · production .outline / .mid / .hi / .material read 0건 (정합성 가드 검증).
 *     · tests에서도 0건 (character-appearance 테스트는 별개 appearance.palette).
 * - 결과: outline / mid / hi / material 4 필드는 buildRuntimePalette가 set하지만
 *   어디로도 흐르지 않는 dead. base / accent는 mid / hi의 alias로 활성.
 *
 * 패턴 (cycle 222-445 시리즈 204번째):
 * - cycle 333-356/443: 함수 출력 dead 필드 cleanup.
 * - cycle 445: SIGNATURE_PITY.STEP_MULT exposed property dead.
 * - cycle 446: buildRuntimePalette 4 출력 dead — 동일 lens 회귀 (4 필드 batch).
 *
 * 수정 (src/data/artPalette.ts):
 * - buildRuntimePalette return에서 outline / mid / hi / material 4 필드 제거.
 * - base / shade / accent / trim 4 활성 필드만 노출.
 *
 * 회귀 가드:
 * - base / shade / accent / trim 보존 (활성 read 필드).
 * - tintPalette 동작 그대로.
 * - getEquipmentArtProfile palette 산출 동작 그대로.
 * - paletteSource (artPalette.json) 자체는 무영향 (내부 raw도 그대로 유지).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 446: buildRuntimePalette return에서 4 dead 필드 0건', async () => {
    const source = await readSrc('src/data/artPalette.ts');
    const fnIdx = source.indexOf('const buildRuntimePalette');
    const fnEnd = source.indexOf('});', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/outline:/.test(block), 'outline 필드 0건');
    assert.ok(!/^\s+mid:/m.test(block), 'mid 필드 0건');
    assert.ok(!/^\s+hi:/m.test(block), 'hi 필드 0건');
    assert.ok(!/material:/.test(block), 'material 필드 0건');
});

test('cycle 446: 활성 필드 (base / shade / accent / trim) 보존', async () => {
    const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
    const tones = Object.keys(TONE_PALETTES);
    assert.ok(tones.length > 0, 'TONE_PALETTES 노출');
    const sample = TONE_PALETTES[tones[0]];
    assert.equal(typeof sample.base, 'string', 'base 보존');
    assert.equal(typeof sample.shade, 'string', 'shade 보존');
    assert.equal(typeof sample.accent, 'string', 'accent 보존');
    assert.equal(typeof sample.trim, 'string', 'trim 보존');
});

test('cycle 446: dead 필드 부재 runtime 검증 (outline / mid / hi / material)', async () => {
    const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
    const tones = Object.keys(TONE_PALETTES);
    const sample = TONE_PALETTES[tones[0]];
    assert.equal(sample.outline, undefined, 'outline 부재');
    assert.equal(sample.mid, undefined, 'mid 부재');
    assert.equal(sample.hi, undefined, 'hi 부재');
    assert.equal(sample.material, undefined, 'material 부재');
});

test('cycle 446: getEquipmentArtProfile palette 동작 보존', async () => {
    const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.ts');
    const profile = getEquipmentArtProfile({ name: '롱소드', type: 'weapon', tier: 1 }, 'weapon');
    assert.ok(profile.palette, 'palette 노출 보존');
    assert.equal(typeof profile.palette.base, 'string', 'palette.base string');
    assert.equal(typeof profile.palette.shade, 'string', 'palette.shade string');
    assert.equal(typeof profile.palette.accent, 'string', 'palette.accent string');
    assert.equal(typeof profile.palette.trim, 'string', 'palette.trim string');
});

test('cycle 445 회귀 가드: SIGNATURE_PITY.STEP_MULT 미노출', async () => {
    const { SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
    assert.equal(SIGNATURE_PITY.STEP_MULT, undefined, 'cycle 445 STEP_MULT 미노출 보존');
});
