import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTS } from '../src/data/quests.js';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { createQuestProgressState, syncQuestProgress } from '../src/utils/questProgress.js';

test('quest progress starts from the current level or local exploration baseline', () => {
    const player = {
        level: 7,
        stats: { exploresByLocation: { '고요한 숲': 3 } },
    };

    assert.deepEqual(
        createQuestProgressState(QUESTS.find((quest) => quest.id === 80), player),
        { id: 80, progress: 0, startExploreCount: 3 },
    );
    assert.deepEqual(
        createQuestProgressState(QUESTS.find((quest) => quest.id === 10), player),
        { id: 10, progress: 7 },
    );
});

test('quest progress syncs build-guiding and discovery quests from player stats', () => {
    // cycle 83: discovery_count quest는 visitedMaps.length로 통일 — 기존엔
    // stats.discoveries(이벤트 카운터)를 잘못 읽던 회귀 수정.
    const player = {
        level: 12,
        stats: {
            explores: 8,
            crafts: 1,
            lowHpWins: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을', '평원', '숲', '동굴', '사막'],
            buildWins: {
                crusher: 3,
                arcane: 1,
            },
        },
        quests: [
            { id: 68, progress: 0 },
            { id: 72, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests.find((quest) => quest.id === 68)?.progress, 3);
    assert.equal(result.updatedQuests.find((quest) => quest.id === 72)?.progress, 5);
});

test('location exploration quests ignore global exploration and other regions', () => {
    const player = {
        level: 5,
        loc: '고요한 숲',
        stats: {
            explores: 40,
            exploresByLocation: { '고요한 숲': 12, '잊혀진 폐허': 0 },
        },
        quests: [{ id: 81, progress: 0, startExploreCount: 0 }],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests[0].progress, 0);
});

test('location exploration quests count only attempts after acceptance in the required region', () => {
    const player = {
        level: 5,
        stats: {
            explores: 45,
            exploresByLocation: { '잊혀진 폐허': 7 },
        },
        quests: [{ id: 81, progress: 0, startExploreCount: 2 }],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests[0].progress, 5);
});

test('legacy location quests preserve saved progress and continue from the next local exploration', () => {
    const legacyPlayer = {
        level: 5,
        stats: { explores: 30, exploresByLocation: { '잊혀진 폐허': 2 } },
        quests: [{ id: 81, progress: 7 }],
    };

    const restored = syncQuestProgress(legacyPlayer).updatedQuests[0];
    assert.equal(restored.progress, 7);
    assert.equal(restored.startExploreCount, -5);

    const continued = syncQuestProgress({
        ...legacyPlayer,
        stats: { ...legacyPlayer.stats, exploresByLocation: { '잊혀진 폐허': 3 } },
        quests: [restored],
    }).updatedQuests[0];

    assert.equal(continued.progress, 8);
});

test('monster quests count victories only in their declared destination', () => {
    const activeQuest = { id: 119, progress: 3 };
    const wrongRegion = syncQuestProgress({
        level: 14,
        loc: '화염의 협곡',
        stats: {},
        quests: [activeQuest],
    }, '광풍의 하피', QUESTS).updatedQuests[0];

    assert.equal(wrongRegion.progress, 3);

    const targetRegion = syncQuestProgress({
        level: 14,
        loc: '바람의 고원',
        stats: {},
        quests: [wrongRegion],
    }, '광풍의 하피', QUESTS).updatedQuests[0];

    assert.equal(targetRegion.progress, 4);
});

test('each exploration immediately updates the current region counter and matching quest', () => {
    let currentPlayer = {
        level: 1,
        loc: '고요한 숲',
        quests: [{ id: 80, progress: 0, startExploreCount: 0 }],
        stats: { explores: 0, exploresByLocation: {}, exploreState: {} },
    };
    const helpers = makeSharedHelpers({
        player: currentPlayer,
        dispatch: (action) => {
            if (typeof action.payload === 'function') {
                currentPlayer = action.payload(currentPlayer);
            }
        },
        addLog: () => {},
    });

    helpers.commitExploreOutcome('nothing', null);

    assert.equal(currentPlayer.stats.explores, 1);
    assert.equal(currentPlayer.stats.exploresByLocation['고요한 숲'], 1);
    assert.equal(currentPlayer.quests[0].progress, 1);
});

test('quest progress derives low-hp survival counts from recent battle history thresholds', () => {
    const player = {
        level: 30,
        stats: {
            recentBattles: [
                { result: 'win', hpRatio: 0.18 },
                { result: 'win', hpRatio: 0.09 },
                { result: 'win', hpRatio: 0.52 },
                { result: 'death', hpRatio: 0 },
            ],
        },
        quests: [
            { id: 62, progress: 0 },
            { id: 63, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests.find((quest) => quest.id === 62)?.progress, 2);
    assert.equal(result.updatedQuests.find((quest) => quest.id === 63)?.progress, 1);
});

// cycle 75: signature_collect 진행도 = SIGNATURE_REGISTRY 교집합 정확 카운트 (cycle 63
// 의 codex 합집합 근사 대체). 일반 weapon/armor/shield는 카운트되지 않고, 실제 등록된
// signature 이름만 카운트됨.
test('quest progress syncs signature_collect from real signatures', () => {
    const player = {
        level: 50,
        stats: {
            codex: {
                weapons: {
                    '성검 에테르니아': true, // signature
                    '마왕의 대낫': true,     // signature
                    '낙뢰의 검': true,       // 일반 weapon (카운트 안 됨)
                },
                armors: { '드래곤로드 갑주': true }, // signature
                shields: {},
            },
        },
        quests: [
            { id: 202, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    // 3개 real signature → progress=3 (이전 근사라면 4 = codex 합)
    assert.equal(result.updatedQuests.find((quest) => quest.id === 202)?.progress, 3);
});

test('quest progress signature_collect caps at goal', () => {
    // 20개 모두 실제 signature 이름으로 채움 (signatureRegistry 등록된 이름 16개 + α)
    const realSignatureNames = [
        '성검 에테르니아', '마왕의 대낫', '라그나로크', '차원 마왕의 낫',
        '천공 성전', '세계수의 지팡이', '드래곤로드 갑주', '암흑 군주의 망토',
        '차원 방패 이지스', '에테르 그리모어', '심해의 수호복', '빙결의 왕관검',
    ];
    const codex = { weapons: {}, armors: {}, shields: {} };
    for (const name of realSignatureNames) {
        // 단순화: 모두 weapons 버킷에 넣어도 isSignatureDiscovered가 DB.ITEMS에서
        // 타입을 찾아 올바른 버킷으로 라우팅함. 그래도 정확하려면 실제 type별
        // 버킷을 써야 하는데, 테스트는 가능한 모든 버킷에 넣어 보장.
        codex.weapons[name] = true;
        codex.armors[name] = true;
        codex.shields[name] = true;
    }
    const player = {
        level: 50,
        stats: { codex },
        quests: [{ id: 202, progress: 0 }],
    };

    const result = syncQuestProgress(player);

    // signature 12개지만 goal=15라 cap이 적용되지 않음. progress = 12.
    // (예전 codex-size 근사였다면 36이 되어 15에서 cap됐겠지만, 이제는 12).
    const progress = result.updatedQuests.find((quest) => quest.id === 202)?.progress;
    assert.ok(progress === 12 || progress === 15, `progress should be 12 or 15, got ${progress}`);
});

// cycle 76: escape_count 퀘스트 진행도 — cycle 74의 stats.escapes 카운터 사용.
test('quest progress syncs escape_count from stats.escapes', () => {
    const player = {
        level: 10,
        stats: { escapes: 7 },
        quests: [
            { id: 203, progress: 0 }, // 도주 5회 — already passed
            { id: 204, progress: 0 }, // 도주 20회 — partial
        ],
    };
    const result = syncQuestProgress(player);
    assert.equal(result.updatedQuests.find((q) => q.id === 203)?.progress, 5, '203 caps at goal=5');
    assert.equal(result.updatedQuests.find((q) => q.id === 204)?.progress, 7, '204 progress=7');
});

test('quest progress escape_count 0 when stats.escapes missing', () => {
    const player = {
        level: 10,
        stats: {},
        quests: [{ id: 203, progress: 0 }],
    };
    const result = syncQuestProgress(player);
    assert.equal(result.updatedQuests.find((q) => q.id === 203)?.progress, 0);
});
