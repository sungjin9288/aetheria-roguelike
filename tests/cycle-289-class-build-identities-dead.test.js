import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 289: CLASS_BUILD_IDENTITIES dead data 제거 (~145 lines)
 *   (cycle 222-288 silent dead config 시리즈 59번째 — cleanup lens 연속, 가장 큰 단일 cleanup).
 *
 * 발견 (대량 dead data):
 * - src/data/traits.ts: CLASS_BUILD_IDENTITIES (line 147-292) — 18 직업의 빌드 정체성 매핑.
 * - cycle 271에서 consumer 함수 (getClassBuildIdentity / getClassBuildCompatibility /
 *   getClassBuildBonus / getRunDiagnostics) 4개 모두 dead로 cleanup된 후 잔존.
 * - 데이터 정의(~145 lines)만 남고 read 0건. 가장 큰 단일 dead 데이터 블록.
 *
 * 패턴 (cycle 222-288 silent dead config 시리즈 59번째):
 * - cycle 271: getClassBuildIdentity / Compatibility / Bonus / RunDiagnostics 4 dead exports cleanup.
 * - cycle 289: paired data CLASS_BUILD_IDENTITIES cleanup (cycle 271 follow-up — 데이터 정의 잔존).
 *
 * 수정 (src/data/traits.ts):
 * - CLASS_BUILD_IDENTITIES export + 145 lines 데이터 정의 제거.
 *
 * 회귀 가드:
 * - ARCHETYPE_LABELS / TRAIT_DEFINITIONS / ELEMENT_TO_STATUS active exports 유지.
 * - 18 직업의 trait/build 분류는 buildProfile (getRunBuildProfile) + traitProfile (getTraitProfile)
 *   에서 처리 — CLASS_BUILD_IDENTITIES와 별개.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 289: CLASS_BUILD_IDENTITIES export 제거', async () => {
    const source = await readSrc('src/data/traits.ts');
    assert.ok(!/export const CLASS_BUILD_IDENTITIES/.test(source),
        'CLASS_BUILD_IDENTITIES export 제거됨');
});

test('cycle 289: traits.ts 파일 크기 단축 (~145 lines 감소)', async () => {
    const source = await readSrc('src/data/traits.ts');
    const lineCount = source.split('\n').length;
    assert.ok(lineCount < 200,
        `traits.ts ${lineCount} lines (이전 292 → ~145+ 감소)`);
});

test('cycle 289: ARCHETYPE_LABELS / TRAIT_DEFINITIONS / ELEMENT_TO_STATUS active exports 유지', async () => {
    const source = await readSrc('src/data/traits.ts');
    const activeExports = ['ARCHETYPE_LABELS', 'TRAIT_DEFINITIONS', 'ELEMENT_TO_STATUS'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 289: TRAIT_DEFINITIONS 데이터 보존 (회귀 가드)', async () => {
    const { TRAIT_DEFINITIONS } = await import('../src/data/traits.js');
    assert.ok(TRAIT_DEFINITIONS.balanced, 'balanced trait 정의 유지');
    assert.ok(TRAIT_DEFINITIONS.crusher, 'crusher trait 정의 유지');
    assert.ok(TRAIT_DEFINITIONS.arcane, 'arcane trait 정의 유지');
});

test('cycle 271 회귀 가드: 4 dead exports cleanup 유지', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getClassBuildIdentity\b/.test(source),
        'cycle 271 getClassBuildIdentity 0건');
    assert.ok(!/export const getClassBuildCompatibility\b/.test(source),
        'cycle 271 getClassBuildCompatibility 0건');
    assert.ok(!/export const getClassBuildBonus\b/.test(source),
        'cycle 271 getClassBuildBonus 0건');
    assert.ok(!/export const getRunDiagnostics\b/.test(source),
        'cycle 271 getRunDiagnostics 0건');
});

test('cycle 285-288 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const artSrc = await readSrc('src/data/artPalette.ts');
    assert.ok(!/export const ART_GRID/.test(artSrc), 'cycle 288 ART_GRID 0건');
    assert.ok(!/export const REFERENCE_ACCENTS/.test(artSrc), 'cycle 288 REFERENCE_ACCENTS 0건');
});
