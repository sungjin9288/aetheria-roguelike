import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 422: MonsterIcon getMonsterType '골렘' 중복 includes 정리
 *   (cycle 222-421 silent dead config 시리즈 182번째 — duplicate detection lens 회귀,
 *   cycle 385 변형).
 *
 * 발견 (1 redundant duplicate):
 * - src/components/icons/MonsterIcon.tsx getMonsterType
 *   line 35: `name.includes('골렘') || name.includes('골렘') || name.includes('자동인형')`
 * - 동일 문자열 '골렘' includes 2회 — short-circuit `||`라 두 번째 호출은 첫 번째가
 *   false일 때만 평가되지만, 동일 입력에 대해 동일 결과라 절대 추가 매치 0건.
 * - 결과: 두 번째 `name.includes('골렘')` 절대 의미 있는 분기 0건.
 *
 * 패턴 (cycle 222-421 시리즈 182번째):
 * - cycle 385: ELEMENT_TONE_KEY 중복 키 정리 (duplicate detection 변형).
 * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
 * - cycle 422: MonsterIcon '골렘' 동일 문자열 중복 — duplicate detection 회귀.
 *
 * 수정 (src/components/icons/MonsterIcon.tsx):
 * - line 35 두 번째 `name.includes('골렘')` 제거.
 *
 * 회귀 가드:
 * - 활성 매칭 ('골렘' / '자동인형') 보존 → golem type 결정 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 422: getMonsterType 골렘 중복 includes 0건', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnStart = source.indexOf('const getMonsterType');
    const fnEnd = source.indexOf('};', fnStart);
    const block = source.slice(fnStart, fnEnd);
    const golemMatches = block.match(/name\.includes\('골렘'\)/g) || [];
    assert.equal(golemMatches.length, 1, "getMonsterType에서 name.includes('골렘') 1건만 (중복 제거)");
});

test('cycle 422: golem 분기 활성 보존 (자동인형 매칭 그대로)', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnStart = source.indexOf('const getMonsterType');
    const fnEnd = source.indexOf('};', fnStart);
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/name\.includes\('골렘'\)/.test(block), "'골렘' 매칭 보존");
    assert.ok(/name\.includes\('자동인형'\)/.test(block), "'자동인형' 매칭 보존");
    assert.ok(/return 'golem'/.test(block), "golem return 보존");
});

test('cycle 422: getMonsterType 동작 회귀 가드 — 골렘 / 자동인형 모두 golem 반환', async () => {
    const { default: MonsterIcon } = await import('../src/components/icons/MonsterIcon.tsx').catch(() => ({ default: null }));
    // MonsterIcon은 React component라 직접 호출 어려움. 대신 source 정합성 가드.
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    // golem branch 유일 매칭자 = '골렘' 또는 '자동인형'
    assert.ok(/if \(name\.includes\('골렘'\) \|\| name\.includes\('자동인형'\)\) return 'golem';/.test(source),
        "golem 분기 형태: '골렘' || '자동인형' → return 'golem'");
});

test('cycle 421 회귀 가드: SkillTypeIcon TYPE_PATHS / TYPE_COLORS 번개 0건', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const pathsStart = source.indexOf('const TYPE_PATHS');
    const pathsEnd = source.indexOf('};', pathsStart);
    const pathsBlock = source.slice(pathsStart, pathsEnd);
    const colorsStart = source.indexOf('const TYPE_COLORS');
    const colorsEnd = source.indexOf('};', colorsStart);
    const colorsBlock = source.slice(colorsStart, colorsEnd);
    assert.ok(!/'번개'/.test(pathsBlock), "cycle 421 TYPE_PATHS '번개' 0건 보존");
    assert.ok(!/'번개'/.test(colorsBlock), "cycle 421 TYPE_COLORS '번개' 0건 보존");
});
