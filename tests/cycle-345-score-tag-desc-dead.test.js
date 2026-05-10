import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 345: scoreTag desc 매개변수 + 출력 dead 정리
 *   (cycle 222-344 silent dead config 시리즈 113번째 — cleanup lens 연속).
 *
 * 발견 (dead parameter + output):
 * - src/utils/runProfile.ts: scoreTag(id, name, desc, score, reasons) — desc 매개변수 + 출력.
 * - tag.desc / primary.desc / build.desc 어디에서도 read 0건.
 * - 8 호출 사이트가 한국어 desc 문자열 인자를 전달하지만 dead.
 *
 * 활성 tag 필드: id (4 reads) / name (5) / score (8) / reasons (10).
 *
 * 패턴 (cycle 222-344 silent dead config 시리즈 113번째):
 * - cycle 344: buildRunSummary buildTags 출력 dead.
 * - cycle 345: scoreTag desc 매개변수 + 출력 dead.
 *
 * 수정 (src/utils/runProfile.ts):
 * - scoreTag 시그니처에서 desc 매개변수 제거.
 * - 8 호출 사이트의 desc 문자열 인자 제거.
 * - 출력 객체에서 desc 필드 제거.
 *
 * 회귀 가드:
 * - tag.id / name / score / reasons 4 활성 필드 보존.
 * - getRunBuildProfile primary / tags 정렬 / score 비교 동일.
 * - getTraitProfile reasons 사용 (line 188) 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 345: scoreTag 시그니처에서 desc 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons/.test(source),
        'scoreTag 시그니처 4-arg (desc 제거)');
    assert.ok(!/const scoreTag = \(id: any, name: any, _?desc/.test(source),
        'desc 매개변수 0건');
});

test('cycle 345: scoreTag 출력에 desc 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('const scoreTag'), source.indexOf('const relicEffectsOf'));
    assert.ok(!/^\s+desc,$/m.test(fn), 'desc 출력 0건');
});

test('cycle 345: 8 호출 사이트에서 desc 문자열 인자 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    // 한국어 desc 문자열을 포함한 호출 0건이어야 함.
    assert.ok(!/scoreTag\([^,]+,\s*'[^']+',\s*'[^']*\.'/.test(source),
        '8 호출 사이트에서 desc 문자열 인자 제거');
});

test('cycle 345: getRunBuildProfile 동작 보존', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.js');
    const player = {
        equip: { weapon: { name: '롱소드', type: 'weapon', hands: 1 } },
        relics: [],
        hp: 100, maxHp: 100,
    };
    // cycle 612: stats 인자 명시 추가 — explicit default-elimination cascade.
    const profile = getRunBuildProfile(player, {});
    assert.ok(profile.primary, 'primary 보존');
    assert.ok('id' in profile.primary, 'primary.id 보존');
    assert.ok('name' in profile.primary, 'primary.name 보존');
    // cycle 443: primary.score 출력 dead strip — 회귀 가드는 cycle-443 test가 대체.
    assert.ok('reasons' in profile.primary, 'primary.reasons 보존');
    assert.equal(profile.primary.desc, undefined, 'primary.desc 0건');
});

test('cycle 344 회귀 가드: buildRunSummary buildTags 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fn = source.slice(source.indexOf('export const buildRunSummary'));
    assert.ok(!/buildTags:\s*buildProfile/.test(fn),
        'cycle 344 buildTags 출력 0건 보존');
});
