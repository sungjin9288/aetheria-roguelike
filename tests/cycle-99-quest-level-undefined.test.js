import test from 'node:test';
import assert from 'node:assert/strict';

import { syncQuestProgress } from '../src/utils/questProgress.js';

/**
 * cycle 99: Player.level이 undefined일 때 Level 퀘스트 진행도가 NaN이 되거나
 * Math.max에 undefined가 들어가 TypeScript 에러를 일으키던 회귀 fix.
 *
 * 발견 경로:
 * - npm run verify의 type-check 단계에서 cycle 94 latch refactor 이후 잔존하던
 *   TS2345 에러 발견. `Math.max(quest.progress || 0, player.level)` 인자에
 *   undefined가 들어갈 수 있음 (Player 타입에서 level이 optional).
 * - Player.level이 undefined인 케이스는 손상된 save / 부분 mock 객체에서 발생
 *   가능. 런타임에 NaN progress가 만들어지면 quest 청구가 영구 잠김.
 *
 * fix:
 *   `Math.max(quest.progress || 0, player.level || 0)` — undefined → 0 fallback.
 *
 * verify:full 통합 명령(cycle 73)이 type-check를 포함하므로 이 가드는 cycle 78+
 * 사이클들이 npm run test:unit + lint + build-guard만으로 잠시 type 회귀를
 * 놓쳤던 부분을 후행 보강.
 */

test('Level 퀘스트 진행도: player.level undefined → progress 0 (NaN 회피)', () => {
    const player = {
        // level intentionally omitted
        job: '모험가',
        quests: [{ id: 10, progress: 0 }],
        stats: { kills: 0 },
    };
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 10);
    assert.ok(quest, 'quest 10 should exist after sync');
    assert.equal(Number.isNaN(quest.progress), false, 'progress should not be NaN');
    assert.equal(quest.progress, 0, 'progress should be 0 when level is undefined');
});

test('Level 퀘스트 진행도: player.level=7 → progress 7 (정상)', () => {
    const player = {
        level: 7,
        job: '모험가',
        quests: [{ id: 10, progress: 0 }],
        stats: { kills: 0 },
    };
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 10);
    assert.equal(quest.progress, 7);
});

test('Level 퀘스트 진행도: latch 동작 — 이미 progress 12에서 player.level=7 → progress 12 유지', () => {
    const player = {
        level: 7,
        job: '모험가',
        quests: [{ id: 10, progress: 12 }],
        stats: { kills: 0 },
    };
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 10);
    assert.equal(quest.progress, 12, 'cycle 94 latch should still work');
});
