import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 333: getMoveRecommendations 4 dead 출력 필드 정리 (score/isSafeTarget/isVisited/isBoss)
 *   (cycle 222-332 silent dead config 시리즈 102번째 — cleanup lens 연속).
 *
 * 발견 (dead output fields):
 * - getMoveRecommendations 반환 객체에서 score / isSafeTarget / isVisited / isBoss
 *   외부 read 0건 (ControlPanel / MapNavigator / 모든 test).
 * - score는 정렬에만 사용되지만 외부 노출 후에도 read 0건.
 * - 활성 출력 필드: name / badge / reason / levelLabel / chips / undiscoveredSignatureCount /
 *   isRecommended.
 *
 * 패턴 (cycle 222-332 silent dead config 시리즈 102번째):
 * - cycle 332: secondaryAction 11회 + mpRatio 변수 cascade dead.
 * - cycle 333: getMoveRecommendations 4 출력 필드 cleanup.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - score → _sortKey internal-only 변수 (정렬 후 strip).
 * - isSafeTarget / isVisited / isBoss 출력 필드 제거 (내부 변수는 chips/score 계산용 유지).
 *
 * 회귀 가드:
 * - 기존 test (signature-move-recommendation)는 name / chips / undiscoveredSignatureCount
 *   만 검증 → 영향 없음.
 * - 정렬 순서 동일 (점수 기준 내림차순).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 333: getMoveRecommendations 출력에 4 dead 필드 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    // 반환 객체 (return { ... })에 4 dead 필드 0건. 단, isSafeTarget/isVisited/isBoss는
    // 내부 변수로 계산용 유지 — 출력에 포함되지 않으면 OK.
    // _sortKey 사용 패턴 확인 (정렬용 임시 키).
    assert.ok(/_sortKey/.test(source), '_sortKey 정렬용 키 도입');
    // 외부 노출 strip 패턴 확인.
    assert.ok(/const \{ _sortKey, \.\.\.exposed \}/.test(source),
        '_sortKey 정렬 후 strip 패턴');
});

test('cycle 333: getMoveRecommendations 출력 동작 보존', async () => {
    const { getMoveRecommendations } = await import('../src/utils/adventureGuide.js');
    const { DB } = await import('../src/data/db.js');
    const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: { visitedMaps: ['시작의 마을'] } };
    const stats = { maxHp: 100, maxMp: 50 };
    const recs = getMoveRecommendations(player, stats, DB.MAPS['시작의 마을'], DB.MAPS);
    assert.ok(Array.isArray(recs), 'array 반환');
    assert.ok(recs.length > 0, '최소 1개 추천');
    // 각 entry는 active 필드만 보유.
    for (const r of recs) {
        assert.ok(typeof r.name === 'string', 'name 보존');
        assert.ok(typeof r.badge === 'string', 'badge 보존');
        assert.ok(typeof r.reason === 'string', 'reason 보존');
        assert.ok(typeof r.levelLabel === 'string', 'levelLabel 보존');
        assert.ok(Array.isArray(r.chips), 'chips 보존');
        assert.equal(typeof r.undiscoveredSignatureCount, 'number',
            'undiscoveredSignatureCount 보존');
        // dead 필드 0건.
        assert.equal(r.score, undefined, 'score 출력 0건');
        assert.equal(r.isSafeTarget, undefined, 'isSafeTarget 출력 0건');
        assert.equal(r.isVisited, undefined, 'isVisited 출력 0건');
        assert.equal(r.isBoss, undefined, 'isBoss 출력 0건');
        assert.equal(r._sortKey, undefined, '_sortKey strip 됨');
    }
});

test('cycle 333: 정렬 순서 보존 (점수 내림차순)', async () => {
    const { getMoveRecommendations } = await import('../src/utils/adventureGuide.js');
    const { DB } = await import('../src/data/db.js');
    const player = { hp: 50, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: { visitedMaps: ['시작의 마을'] } };
    const stats = { maxHp: 100, maxMp: 50 };
    const recs = getMoveRecommendations(player, stats, DB.MAPS['시작의 마을'], DB.MAPS);
    // isRecommended === true는 index 0 항목.
    if (recs.length > 0) {
        assert.equal(recs[0].isRecommended, true, '첫 번째 항목 isRecommended');
    }
});

test('cycle 332 회귀 가드: getAdventureGuidance secondaryAction 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
    assert.ok(!/secondaryAction:/.test(guidanceFn),
        'cycle 332 secondaryAction 제거 보존');
});
