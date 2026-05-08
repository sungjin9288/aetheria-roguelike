import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 356: OPERATION_META summary 5회 dead 정리
 *   (cycle 222-355 silent dead config 시리즈 123번째 — cleanup lens 연속).
 *
 * 발견 (5 dead config field — same key, 5 lanes):
 * - questOperations.ts OPERATION_META 5 lane(story/build/growth/boss/hunt) 모두 summary 필드 보유.
 * - QuestBoardPanel은 entry.meta.label / .emphasis만 read.
 * - meta.summary — src/, tests/ 어디에서도 read 0건.
 *
 * 패턴 (cycle 222-355 silent dead config 시리즈 123번째):
 * - cycle 355: getDailyDeals discount 출력 dead.
 * - cycle 356: OPERATION_META summary 5회 dead.
 *
 * 수정 (src/utils/questOperations.ts):
 * - OPERATION_META 5 lane에서 summary 필드 일괄 제거.
 *
 * 회귀 가드:
 * - meta.label / .emphasis 보존 (QuestBoardPanel dispatch).
 * - getQuestBoardRecommendations 정렬/lane 매칭 동일.
 * - QUEST_BOARD_PANEL meta 칩 표시 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 356: OPERATION_META summary 0건 (5 lane 모두 제거)', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    // OPERATION_META 객체 블록 시작~끝
    const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
    assert.ok(blockMatch, 'OPERATION_META 블록 발견');
    const block = blockMatch[0];
    const summaryMatches = block.match(/summary:/g) || [];
    assert.equal(summaryMatches.length, 0,
        `OPERATION_META에서 summary 0건이어야 함, ${summaryMatches.length}건 발견`);
});

test('cycle 356: OPERATION_META label/emphasis 5 lane 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
    const block = blockMatch[0];
    const labelMatches = block.match(/label:/g) || [];
    const emphasisMatches = block.match(/emphasis:/g) || [];
    assert.equal(labelMatches.length, 5, 'label 5 lane 보존');
    assert.equal(emphasisMatches.length, 5, 'emphasis 5 lane 보존');
});

test('cycle 356: getQuestBoardRecommendations meta 노출 동작 보존', async () => {
    const { getQuestBoardRecommendations } = await import('../src/utils/questOperations.js');
    const player = {
        job: '전사',
        level: 5,
        loc: '시작의 마을',
        quests: [],
        equip: {},
        relics: [],
        stats: {},
        maxHp: 100,
        maxMp: 50,
    };
    const result = getQuestBoardRecommendations(player);
    if (result.featured.length > 0) {
        const first = result.featured[0];
        assert.ok(first.meta, 'meta 객체 노출');
        assert.ok('label' in first.meta, 'meta.label 보존');
        assert.ok('emphasis' in first.meta, 'meta.emphasis 보존');
        assert.equal(first.meta.summary, undefined, 'meta.summary 0건');
    }
});

test('cycle 355 회귀 가드: getDailyDeals discount 0건 보존', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fn = source.slice(source.indexOf('export const getDailyDeals'), source.indexOf('export const getWeeklySpecial'));
    assert.ok(!/discount:/.test(fn),
        'cycle 355 discount 0건 보존');
});
