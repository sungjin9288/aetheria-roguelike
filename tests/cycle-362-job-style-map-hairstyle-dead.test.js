import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 362: JOB_STYLE_MAP / DEFAULT_JOB_STYLE hairStyle 15회 dead 정리
 *   (cycle 222-361 silent dead config 시리즈 128번째 — cleanup lens 연속).
 *
 * 발견 (15 dead config field — 1 default + 14 jobs):
 * - characterAppearance.ts DEFAULT_JOB_STYLE + JOB_STYLE_MAP 14 entries 모두
 *   hairStyle 필드 보유 (bob / spike / crest / short / bangs / ponytail / long).
 * - cycle 342에서 deriveCharacterAppearance 반환 객체의 hairStyle 출력 필드 제거됨.
 *   그러나 JOB_STYLE_MAP 정의에는 hairStyle 키가 잔존 — read 0건이라 unreachable.
 * - 활성 baseStyle 필드: armorStyle / accessoryStyle / hairColor / outfitColor /
 *   accentColor 5종만 deriveCharacterAppearance에서 read.
 *
 * 패턴 (cycle 222-361 silent dead config 시리즈 128번째):
 * - cycle 361: JOB_AFFINITY_NAMES 그림자주군 unreachable duplicate.
 * - cycle 362: JOB_STYLE_MAP hairStyle 15 dead config (cycle 342 cleanup의 cascade).
 *
 * 수정 (src/utils/characterAppearance.ts):
 * - DEFAULT_JOB_STYLE + JOB_STYLE_MAP 14 entries에서 hairStyle 필드 일괄 제거.
 *
 * 회귀 가드:
 * - 활성 5 필드 (armorStyle / accessoryStyle / hairColor / outfitColor / accentColor) 보존.
 * - 14 직업 키 보존.
 * - deriveCharacterAppearance 반환 shape 동일 (cycle 342 hairStyle 제거 그대로).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 362: JOB_STYLE_MAP hairStyle 0건 (15회 모두 제거)', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
    const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/hairStyle:/g) || [];
    assert.equal(matches.length, 0,
        `JOB_STYLE_MAP / DEFAULT_JOB_STYLE에서 hairStyle 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 362: 활성 5 필드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
    const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
    const block = source.slice(fnStart, fnEnd);
    const expected = ['hairColor', 'outfitColor', 'accentColor', 'armorStyle', 'accessoryStyle'];
    for (const field of expected) {
        const matches = block.match(new RegExp(`${field}:`, 'g')) || [];
        assert.ok(matches.length >= 14, `${field} 14+ entries 보존 (${matches.length})`);
    }
});

test('cycle 362: deriveCharacterAppearance 동작 보존', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.js');
    const player = {
        job: '전사',
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon', val: 12, hands: 1 },
            armor: { name: '판금 갑주', type: 'armor', val: 30 },
            offhand: null,
        },
    };
    const appearance = deriveCharacterAppearance(player);
    assert.equal(appearance.job, '전사', 'job 보존');
    assert.ok(appearance.palette, 'palette 객체 노출');
    assert.equal(typeof appearance.palette.hair, 'string', 'palette.hair 보존 (hairColor 매핑)');
    assert.equal(typeof appearance.armorStyle, 'string', 'armorStyle 보존');
    assert.equal(typeof appearance.accessoryStyle, 'string', 'accessoryStyle 보존');
    assert.equal(appearance.hairStyle, undefined, 'hairStyle 출력 0건 (cycle 342 회귀 가드)');
});

test('cycle 361 회귀 가드: JOB_AFFINITY_NAMES 그림자주군 0건 보존', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
    const fnEnd = source.indexOf('const buildAffinityLabel');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+그림자주군:/m.test(block),
        'cycle 361 그림자주군 (공백 제거) 0건 보존');
});
