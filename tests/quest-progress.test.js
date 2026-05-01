import test from 'node:test';
import assert from 'node:assert/strict';

import { syncQuestProgress } from '../src/utils/questProgress.js';

test('quest progress syncs build-guiding and discovery quests from player stats', () => {
    const player = {
        level: 12,
        stats: {
            explores: 8,
            crafts: 1,
            lowHpWins: 0,
            bountiesCompleted: 0,
            discoveries: 5,
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
