import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { MAPS } from '../src/data/maps.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { ELITE_TITLE_MAPS } from '../src/utils/eliteTitles.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { getMapRouteGate } from '../src/utils/mapRouteGate.js';
import { createSeededRandom } from '../src/utils/seededRandom.js';

/**
 * 정예 목격 칭호는 모두 얻을 수 있다 (2026-10 Wave 102, 소유자 원칙 "칭호가 뭘 해야 얻어지는지는 플레이어가 직접 알아내야지").
 *
 * 화면은 칭호를 얻는 방법을 안내하지 않는다(Wave 101 안내는 되돌렸다) — 그래서 칭호마다 실제로 얻을 길이 있다는 것은 계약이 지킨다.
 * 정예 목격 칭호 47곳 모두 그 지역의 진입 레벨에서 실제 스폰(`spawnEnemy`)으로 정예가 나온다. 정예가 나올 수 없는 지역이 생기면
 * 그 칭호는 아무리 찾아도 얻을 수 없다.
 */
test('Wave 102: 정예 목격 칭호 47곳 모두 진입 레벨에서 실제 스폰으로 정예가 나온다', () => {
    assert.equal(ELITE_TITLE_MAPS.length, 47);
    for (const map of ELITE_TITLE_MAPS) {
        const level = getMapRouteGate(MAPS, map)?.routeGateLevel ?? 60;
        const player = { ...structuredClone(INITIAL_STATE.player), level, loc: map };
        const rng = createSeededRandom(map.length * 7919);
        let elite = false;
        for (let i = 0; i < 400 && !elite; i += 1) {
            elite = Boolean(spawnEnemy(DB.MAPS[map], player, [], { addLog: () => {} }, { rng }).mStats?.isElite);
        }
        assert.ok(elite, `${map}: 진입 레벨 ${level}에서 정예가 400번 안에 나온다`);
    }
});
