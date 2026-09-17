import assert from 'node:assert/strict';
import test from 'node:test';
import { DB } from '../src/data/db.ts';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.ts';
import { MSG } from '../src/data/messages.ts';
import { getMapAccess, getReachableMaps } from '../src/utils/mapAccess.ts';

test('map access preserves directed exits, level precedence and seasonal entry', () => {
    const maps = {
        start: { level: 1, exits: ['gate'] },
        gate: { level: 62, exits: ['library'] },
        library: { level: 55, exits: [] },
        season: { level: 5, seasonOnly: true, exits: [] },
        // 2026-09 N3: minLv 제거 — 범위형 level의 첫 값이 곧 입장 최소 레벨이다.
        range: { level: [4, 9], exits: [] },
    };
    assert.deepEqual(getMapAccess(maps, 'start', 'gate', 60), { reason: 'level', requiredLevel: 62 });
    assert.equal(getMapAccess(maps, 'library', 'start', 75).reason, 'exit');
    assert.equal(getMapAccess(maps, 'start', 'season', 75).reason, 'season');
    assert.equal(getMapAccess(maps, 'start', 'season', 5, true).reason, null);
    assert.equal(getMapAccess(maps, 'start', 'range', 2).requiredLevel, 4);
    assert.equal(getMapAccess(maps, 'start', 'missing', 75).reason, 'missing');
    assert.deepEqual([...getReachableMaps(maps, 'start', 60)], ['start']);
    assert.deepEqual([...getReachableMaps(maps, 'start', 62)], ['start', 'gate', 'library']);
    assert.ok(getReachableMaps(maps, 'start', 5, true).has('season'));
});

test('canonical library requires its level62 approach and cycles terminate', () => {
    assert.equal(getReachableMaps(DB.MAPS, '시작의 마을', 60).has('금지된 도서관'), false);
    assert.equal(getReachableMaps(DB.MAPS, '시작의 마을', 62).has('금지된 도서관'), true);
    assert.equal(getReachableMaps(DB.MAPS, '시작의 마을', 75).has('봄의 정원'), false);
});

test('production movement preserves rejection logs and makes no dispatch', () => {
    for (const [from, to, level, expected] of [
        ['시작의 마을', '없는 지역', 75, MSG.MAP_NOT_FOUND],
        ['시작의 마을', '봄의 정원', 75, MSG.MOVE_SEASON_ONLY],
        ['고대 신전 도시', '붕괴된 마법 요새', 60, MSG.MOVE_LEVEL_REQUIRED(62)],
        ['시작의 마을', '금지된 도서관', 75, MSG.MOVE_NO_EXIT],
    ]) {
        const logs = [];
        createMoveActions({
            player: { loc: from, level }, gameState: 'idle', liveConfig: {},
            dispatch: () => assert.fail('rejected movement must not dispatch'),
            addLog: (_, message) => logs.push(message),
        }).move(to);
        assert.deepEqual(logs, [expected]);
    }
});
