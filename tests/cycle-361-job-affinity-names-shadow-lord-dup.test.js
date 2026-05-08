import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 361: JOB_AFFINITY_NAMES '그림자주군' (공백 제거) 중복 키 unreachable 정리
 *   (cycle 222-360 silent dead config 시리즈 127번째 — cleanup lens 연속).
 *
 * 발견 (1 dead duplicate key):
 * - jobOutfitAffinity.ts JOB_AFFINITY_NAMES에 '그림자 주군' (공백) + 그림자주군
 *   (공백 제거) 두 키 존재.
 * - buildAffinityLabel(job, tier) 호출 사이트가 player.job (= '그림자 주군' 정식 표기)
 *   을 그대로 lookup. CLASSES.ts의 직업 키도 '그림자 주군'.
 * - 공백 제거된 '그림자주군' 키는 JOB_SPRITE_SLUG_MAP에서만 normalize 대응으로 필요했고
 *   (avatarSpriteCandidates: `replace(/\s+/g, '')` 후 lookup), JOB_AFFINITY_NAMES는
 *   normalize 없이 직접 lookup이라 unreachable.
 *
 * 패턴 (cycle 222-360 silent dead config 시리즈 127번째):
 * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
 * - cycle 361: JOB_AFFINITY_NAMES 그림자주군 unreachable duplicate.
 *
 * 수정 (src/utils/jobOutfitAffinity.ts):
 * - JOB_AFFINITY_NAMES에서 그림자주군 (공백 제거) 키 제거.
 *
 * 회귀 가드:
 * - '그림자 주군' (공백) 키 보존 (정식 직업 표기).
 * - 14 다른 직업 키 보존.
 * - buildAffinityLabel 동작 그대로 (`${job}의 정점` 등 fallback 안전망).
 * - JOB_SPRITE_SLUG_MAP 그림자주군 entry는 별도 normalize 패턴으로 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 361: JOB_AFFINITY_NAMES 그림자주군 (공백 제거) 0건', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
    const fnEnd = source.indexOf('const buildAffinityLabel');
    const block = source.slice(fnStart, fnEnd);
    // 공백 없는 단일 단어 그림자주군이 키로 존재하지 않아야 함.
    assert.ok(!/^\s+그림자주군:/m.test(block),
        'JOB_AFFINITY_NAMES에서 그림자주군 (공백 제거) 키 0건');
});

test('cycle 361: JOB_AFFINITY_NAMES \'그림자 주군\' (정식) 키 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
    const fnEnd = source.indexOf('const buildAffinityLabel');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/'그림자 주군':/.test(block),
        '\'그림자 주군\' (정식 표기) 키 보존');
});

test('cycle 361: JOB_AFFINITY_NAMES 14 활성 직업 키 보존', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
    const fnEnd = source.indexOf('const buildAffinityLabel');
    const block = source.slice(fnStart, fnEnd);
    const activeJobs = ['모험가', '전사', '나이트', '버서커', '도적', '어쌔신',
                        '레인저', '마법사', '아크메이지', '흑마법사', '팔라딘',
                        '시간술사', '대마법사'];
    for (const job of activeJobs) {
        assert.ok(new RegExp(`^\\s+${job}:`, 'm').test(block), `${job} 키 보존`);
    }
});

test('cycle 361: getJobOutfitAffinity 동작 보존 (그림자 주군)', async () => {
    const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
    const player = {
        job: '그림자 주군',
        equip: {
            weapon: { jobs: ['그림자 주군'], type: 'weapon' },
            armor: null,
            offhand: null,
        },
    };
    const aff = getJobOutfitAffinity(player);
    assert.equal(aff.matchCount, 1, 'matchCount 정확');
    assert.ok(aff.label && /어둠의 결|결$/.test(aff.label),
        '\'그림자 주군\' 직업의 partial1 label 보존');
});

test('cycle 359 회귀 가드: ELEMENT_FILTERS 불/얼음/화염속성 0건 보존', async () => {
    const source = await readSrc('src/utils/equipmentTint.ts');
    const fnStart = source.indexOf('const ELEMENT_FILTERS');
    const fnEnd = source.indexOf('const matchHint');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+불:/m.test(block), 'cycle 359 불 0건 보존');
    assert.ok(!/^\s+얼음:/m.test(block), 'cycle 359 얼음 0건 보존');
    assert.ok(!/^\s+화염속성:/m.test(block), 'cycle 359 화염속성 0건 보존');
});
