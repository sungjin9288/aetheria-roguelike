import test from 'node:test';
import assert from 'node:assert/strict';

import { getMapEncounterRoster, getMapCodexProgress, getMapProgressState } from '../src/utils/mapProgress.js';

const MAPS = {
    '시작의 마을': { monsters: [], exits: ['숲'] },
    숲: { monsters: ['슬라임', '늑대'], exits: ['시작의 마을'], boss: '숲 지배자' },
};

test('getMapEncounterRoster merges monsters and boss without duplicates', () => {
    const roster = getMapEncounterRoster({
        monsters: ['슬라임', '늑대'],
        bossMonsters: ['늑대', '고블린'],
        boss: '고블린',
    });

    assert.deepEqual(roster, ['슬라임', '늑대', '고블린']);
});

test('getMapCodexProgress counts discovered monsters per map roster', () => {
    const progress = getMapCodexProgress('숲', MAPS, {
        monsters: {
            슬라임: { discovered: true },
            '숲 지배자': { discovered: true },
        },
    });

    assert.deepEqual(progress, {
        total: 3,
        discovered: 2,
        remaining: 1,
    });
});

test('getMapProgressState marks non-combat safe zones completed after visit', () => {
    const state = getMapProgressState('시작의 마을', {
        loc: '숲',
        stats: {
            visitedMaps: ['시작의 마을'],
            codex: { monsters: {} },
        },
    }, MAPS);

    assert.equal(state.state, 'completed');
    // cycle 442: state.visited 출력 dead 제거 — 회귀 가드는 cycle-442 test가 대체.
    assert.equal(state.progress.total, 0);
});

test('getMapProgressState marks combat map completed only after full codex discovery', () => {
    const exploring = getMapProgressState('숲', {
        loc: '숲',
        stats: {
            visitedMaps: ['시작의 마을'],
            codex: { monsters: { 슬라임: { discovered: true } } },
        },
    }, MAPS);

    assert.equal(exploring.state, 'exploring');

    const completed = getMapProgressState('숲', {
        loc: '시작의 마을',
        stats: {
            visitedMaps: ['숲'],
            codex: {
                monsters: {
                    슬라임: { discovered: true },
                    늑대: { discovered: true },
                    '숲 지배자': { discovered: true },
                },
            },
        },
    }, MAPS);

    assert.equal(completed.state, 'completed');
    assert.equal(completed.progress.remaining, 0);
});
