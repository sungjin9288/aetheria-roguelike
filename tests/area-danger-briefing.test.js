import test from 'node:test';
import assert from 'node:assert/strict';

import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { MSG } from '../src/data/messages.js';

/**
 * C-2 (B+ 2026-06): 첫 방문 던전 위험 브리핑.
 * 하드 레벨 락으로 과진입은 불가하나, 권장 레벨에 갓 도달해 진입한 지역(gap≤1)은
 * 정예/구역 보스 위협이 실재 → 명확히 경고해 "후퇴" 선택을 readable하게.
 */

const makeDeps = (playerOverrides = {}) => {
    const logs = [];
    const deps = {
        player: { level: 3, loc: '시작의 마을', gold: 200, stats: { visitedMaps: ['시작의 마을'] }, ...playerOverrides },
        gameState: 'idle',
        grave: [],
        isAiThinking: false,
        liveConfig: {},
        dispatch: () => {},
        addLog: (type, text) => logs.push({ type, text }),
    };
    return { deps, logs };
};

test('C-2: 갓 진입한 위험 던전(gap≤1) 첫 방문 시 위험 경고', () => {
    const { deps, logs } = makeDeps({ level: 3 }); // 서쪽 평원 권장 Lv3, gap 0
    createMoveActions(deps).move('서쪽 평원');
    assert.ok(logs.some((l) => l.text === MSG.MOVE_AREA_DANGER(3)), '위험 경고 로그 존재');
});

test('C-2: 충분히 레벨이 높으면(gap>1) 위험 경고 없음', () => {
    const { deps, logs } = makeDeps({ level: 10 });
    createMoveActions(deps).move('서쪽 평원');
    assert.ok(!logs.some((l) => l.text.includes('벅찹니다')), '과레벨 지역 → 경고 없음');
});
