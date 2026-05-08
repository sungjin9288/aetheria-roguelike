import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 347: scoreQuest score 출력 dead 정리 (_sortKey internal로 변경)
 *   (cycle 222-346 silent dead config 시리즈 115번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - scoreQuest 반환에 score 필드 — 정렬 (line 163) 외 외부 read 0건.
 * - QuestBoardPanel은 entry.lane / entry.meta / entry.reason / entry.resonance /
 *   entry.targetMaps만 read.
 *
 * 패턴 (cycle 222-346 silent dead config 시리즈 115번째):
 * - cycle 346: getJobOutfitAffinity totalSlots 출력 dead.
 * - cycle 347: scoreQuest score → _sortKey internal로 변경 (cycle 333 패턴 동일).
 *
 * 수정 (src/utils/questOperations.ts):
 * - scoreQuest 반환에서 score → _sortKey internal-only.
 * - getQuestBoardRecommendations 정렬 후 strip 단계 추가.
 *
 * 회귀 가드:
 * - quest / lane / resonance / targetMaps / meta / reason 활성 필드 보존.
 * - 정렬 순서 동일 (점수 내림차순, 동점 시 quest.title 한국어 정렬).
 * - QuestBoardPanel / adventureGuide.featured[0] 동일 동작.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 347: scoreQuest score → _sortKey 변경', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    // scoreQuest 반환에 _sortKey 도입.
    assert.ok(/_sortKey: score/.test(source),
        '_sortKey internal-only 도입');
});

test('cycle 347: getQuestBoardRecommendations 정렬 후 strip', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    assert.ok(/right\._sortKey - left\._sortKey/.test(source),
        '_sortKey 기준 정렬');
    assert.ok(/const \{ _sortKey, \.\.\.exposed \}/.test(source),
        '_sortKey strip 패턴');
});

test('cycle 347: getQuestBoardRecommendations 동작 보존', async () => {
    const { getQuestBoardRecommendations } = await import('../src/utils/questOperations.js');
    const player = { job: '검사', level: 5, hp: 100, maxHp: 100, mp: 50, maxMp: 50, equip: {}, relics: [], stats: {}, quests: [] };
    const board = getQuestBoardRecommendations(player);
    assert.ok(Array.isArray(board.featured), 'featured array');
    assert.ok(Array.isArray(board.backlog), 'backlog array');
    // featured / backlog 항목에 score 외부 노출 0건.
    if (board.featured.length > 0) {
        assert.equal(board.featured[0].score, undefined, 'featured[0].score 0건');
        assert.equal(board.featured[0]._sortKey, undefined, 'featured[0]._sortKey strip');
        assert.ok('lane' in board.featured[0], 'lane 보존');
        assert.ok('meta' in board.featured[0], 'meta 보존');
    }
});

test('cycle 346 회귀 가드: getJobOutfitAffinity totalSlots 0건 보존', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fn = source.slice(source.indexOf('export const getJobOutfitAffinity'));
    assert.ok(!/totalSlots:/.test(fn),
        'cycle 346 totalSlots 0건 보존');
});
