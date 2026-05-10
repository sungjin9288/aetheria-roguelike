import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 443: getRunBuildProfile tag.score 출력 dead 정리
 *   (cycle 222-442 silent dead config 시리즈 201번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/347 _sortKey strip 패턴).
 *
 * 발견 (1 dead output field — 6 tag entries × score):
 * - src/utils/runProfile.ts getRunBuildProfile (line 130+):
 *     `return { primary, tags: ranked.slice(0, 5) }`
 *   ranked tags 각 entry는 `{ id, name, score, reasons }` (scoreTag 결과).
 * - 호출 사이트 (consumer) 분석:
 *     · useGameEngine.ts:104 + exploreActions.ts:68 — `tags.map((tag) => tag.name)` 만 read.
 *     · runProfile 내부에선 score를 filter (≥3) + sort에 사용 후 외부 미read.
 *     · primary는 ranked[0]이라 동일 score 보유 (외부 read는 .id/.name/.reasons만).
 * - 결과: tag.score는 정렬 후 외부로 흐르지 않는 dead. cycle 347 _sortKey strip
 *   패턴 적용 가능.
 *
 * 패턴 (cycle 222-442 시리즈 201번째):
 * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
 * - cycle 347: scoreQuest _sortKey strip 패턴.
 * - cycle 442: getMapProgressState visited 출력 dead.
 * - cycle 443: getRunBuildProfile tag.score 출력 dead — 동일 lens 회귀.
 *
 * 수정 (src/utils/runProfile.ts):
 * - ranked 정렬 후 `.map(({ score, ...rest }) => rest)`로 score strip.
 * - scoreTag는 그대로 (sort 단계에서 score 필요).
 * - primary = ranked[0]도 score 부재 entry로 변경.
 *
 * 회귀 가드:
 * - tag.id / .name / .reasons 보존 (활성 read 필드).
 * - filter (≥3) / sort (score desc) 동작 그대로.
 * - balanced fallback 'primary'도 score 부재.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 443: getRunBuildProfile 반환 tags entry에 score 0건', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
    const player = {
        equip: {
            weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
            offhand: null,
            armor: null,
        },
        relics: [{ effect: 'execute_bonus' }, { effect: 'armor_pen' }],
        hp: 100,
        maxHp: 100,
        job: '전사',
    };
    const result = getRunBuildProfile(player, { maxHp: 100 });
    for (const tag of result.tags) {
        assert.equal(tag.score, undefined, `tag ${tag.id}/${tag.name} score 부재`);
    }
});

test('cycle 443: primary entry에서도 score 0건', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
    const player = {
        equip: { weapon: null, offhand: null, armor: null },
        relics: [],
        hp: 100, maxHp: 100,
        job: '모험가',
    };
    const result = getRunBuildProfile(player, { maxHp: 100 });
    assert.ok(result.primary, 'primary 노출');
    assert.equal(result.primary.score, undefined, 'primary.score 0건');
    // primary 활성 필드는 보존
    assert.equal(typeof result.primary.id, 'string', 'primary.id 보존');
    assert.equal(typeof result.primary.name, 'string', 'primary.name 보존');
    assert.ok(Array.isArray(result.primary.reasons), 'primary.reasons 보존');
});

test('cycle 443: 활성 필드 (id / name / reasons) 그대로', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
    const player = {
        equip: {
            weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
            offhand: null,
            armor: null,
        },
        relics: [{ effect: 'execute_bonus' }, { effect: 'armor_pen' }, { effect: 'ancient_power' }],
        hp: 100, maxHp: 100,
        job: '전사',
    };
    const result = getRunBuildProfile(player, { maxHp: 100 });
    assert.ok(result.tags.length > 0, 'tags 있음');
    for (const tag of result.tags) {
        assert.equal(typeof tag.id, 'string', 'tag.id 보존');
        assert.equal(typeof tag.name, 'string', 'tag.name 보존');
        assert.ok(Array.isArray(tag.reasons), 'tag.reasons 보존');
    }
});

test('cycle 443: filter / sort 동작 보존 (정렬 순서 회귀 가드)', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
    const player = {
        equip: {
            weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
            offhand: null,
            armor: { type: 'armor' },
        },
        relics: [
            { effect: 'execute_bonus' }, { effect: 'armor_pen' }, { effect: 'ancient_power' },
            { effect: 'reflect' }, { effect: 'fortress' },
        ],
        hp: 100, maxHp: 100,
        job: '전사',
    };
    const result = getRunBuildProfile(player, { maxHp: 100 });
    // crusher가 양손+처형보너스+방어관통+고대분노로 high score → primary 후보
    assert.equal(result.primary.id, 'crusher', 'crusher가 primary');
    // tags 길이 ≤ 5
    assert.ok(result.tags.length <= 5, 'tags 최대 5개');
});

test('cycle 442 회귀 가드: getMapProgressState visited 출력 0건', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    const fnIdx = source.indexOf('export const getMapProgressState');
    const returnIdx = source.indexOf('return {', fnIdx);
    const returnEnd = source.indexOf('};', returnIdx);
    const returnBlock = source.slice(returnIdx, returnEnd);
    assert.ok(!/^\s+visited,?\s*$/m.test(returnBlock),
        'cycle 442 visited 출력 0건 보존');
});
