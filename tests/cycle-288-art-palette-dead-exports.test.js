import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 288: artPalette.ts 6 dead exports cleanup
 *   (cycle 222-287 silent dead config 시리즈 58번째 — cleanup lens 연속, 대량).
 *
 * 발견 (5 dead + 1 private downgrade):
 * - ART_GRID (line 18): 32x48 avatar 그리드 정의 — runtime consumer 0건.
 * - LIGHT_DIRECTION (line 25): 광원 각도 정의 — consumer 0건.
 * - OUTLINE_POLICY (line 30): outline 컬러 정책 — consumer 0건.
 * - SILHOUETTE_RULES (line 37): shade 규칙 — consumer 0건.
 * - REFERENCE_ACCENTS (line 69): 레퍼런스 액센트 — consumer 0건.
 * - DEFAULT_TONE_KEY (line 67): getDefaultToneKey 내부 사용만 — export 불필요.
 *
 * 패턴 (cycle 222-287 silent dead config 시리즈 58번째):
 * - cycle 285-287: 단일 dead export 정리 시리즈.
 * - cycle 288: artPalette 6 dead/private 정리 (대량 cleanup).
 *
 * 수정 (src/data/artPalette.ts):
 * - 5 dead exports 제거 (ART_GRID, LIGHT_DIRECTION, OUTLINE_POLICY, SILHOUETTE_RULES, REFERENCE_ACCENTS).
 * - DEFAULT_TONE_KEY export 제거 (private const로 downgrade).
 *
 * 회귀 가드:
 * - TONE_PALETTES / ELEMENT_TONE_KEY / getTonePalette / getElementToneKey / getDefaultToneKey
 *   active exports 유지.
 * - getDefaultToneKey 내부 DEFAULT_TONE_KEY 사용 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 288: 5 dead exports 제거', async () => {
    const source = await readSrc('src/data/artPalette.ts');
    const deadExports = ['ART_GRID', 'LIGHT_DIRECTION', 'OUTLINE_POLICY', 'SILHOUETTE_RULES', 'REFERENCE_ACCENTS'];
    deadExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(!re.test(source), `${name} export 제거됨`);
    });
});

test('cycle 288: DEFAULT_TONE_KEY export 제거 (private const)', async () => {
    const source = await readSrc('src/data/artPalette.ts');
    assert.ok(!/export const DEFAULT_TONE_KEY/.test(source),
        'DEFAULT_TONE_KEY export 제거됨');
    assert.ok(/const DEFAULT_TONE_KEY/.test(source),
        'DEFAULT_TONE_KEY const 정의 유지 (private)');
});

test('cycle 288: active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/data/artPalette.ts');
    const activeExports = ['TONE_PALETTES', 'ELEMENT_TONE_KEY', 'getTonePalette', 'getElementToneKey', 'getDefaultToneKey'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 288: getTonePalette / getElementToneKey / getDefaultToneKey 동작 유지', async () => {
    const { getTonePalette, getElementToneKey, getDefaultToneKey } = await import('../src/data/artPalette.js');
    assert.ok(getTonePalette('steel'), 'getTonePalette steel 반환');
    assert.equal(typeof getDefaultToneKey('weapon'), 'string', 'getDefaultToneKey 문자열 반환');
    // ELEMENT_TONE_KEY는 elem이 매핑돼있을 때만 정의됨.
    const result = getElementToneKey('alien_test_elem');
    assert.equal(result, null, '미정의 elem 시 null 반환');
});

test('cycle 285-287 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const premiumSrc = await readSrc('src/data/premiumShop.ts');
    const codexSrc = await readSrc('src/data/codexRewards.ts');
    const seasonSrc = await readSrc('src/data/seasonPass.ts');
    assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc), 'cycle 285');
    assert.ok(!/export const CODEX_MILESTONES/.test(codexSrc), 'cycle 286');
    assert.ok(!/export const INITIAL_SEASON_PASS/.test(seasonSrc), 'cycle 287');
});
