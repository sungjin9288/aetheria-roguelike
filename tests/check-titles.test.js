import test from 'node:test';
import assert from 'node:assert/strict';

import { checkTitles } from '../src/utils/gameUtils.js';

// cycle 61: 신규 칭호 (wanderer / pathfinder / cartographer / legend_seeker /
// legend_chronicler) cond.type 핸들러가 정상 동작함을 회귀 가드.

test('checkTitles unlocks wanderer at explores >= 100', () => {
    const player = { titles: [], stats: { explores: 100 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('wanderer'), 'wanderer should be unlocked');
});

test('checkTitles unlocks pathfinder at explores >= 500', () => {
    const player = { titles: [], stats: { explores: 500 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('pathfinder'), 'pathfinder should be unlocked');
    assert.ok(unlocked.includes('wanderer'), 'wanderer also unlocked at 500');
});

test('checkTitles does not unlock wanderer below threshold', () => {
    const player = { titles: [], stats: { explores: 50 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('wanderer'), 'wanderer locked at 50 explores');
});

test('checkTitles unlocks cartographer at discoveries >= 10', () => {
    // cycle 83: discoveries 시맨틱 = visitedMaps.length(맵 발견 수).
    // 기존엔 stats.discoveries(이벤트 카운터)를 읽어 cartographer("지도 제작자")가
    // 의도와 어긋나게 풀리던 회귀 수정.
    const player = {
        titles: [],
        stats: { visitedMaps: Array.from({ length: 10 }, (_, i) => `map-${i}`) },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('cartographer'), 'cartographer unlocked');
});

// cycle 75: codex 합집합 근사 → SIGNATURE_REGISTRY 교집합 정확 카운트로 교체.
// 테스트는 실제 등록된 signature 5종으로 카운트를 채워 legend_seeker(5종) 트리거.
test('checkTitles unlocks legend_seeker via 5 real signatures discovered', () => {
    // isSignatureDiscovered가 DB.ITEMS에서 type을 조회 후 적절한 codex 버킷으로
    // 라우팅하므로, 테스트는 모든 버킷에 동일 이름을 넣어 어떤 type이든 매칭되게 함.
    const realSignatures = [
        '성검 에테르니아',
        '마왕의 대낫',
        '라그나로크',
        '세계수의 지팡이',
        '천공 성전',
    ];
    const codex = { weapons: {}, armors: {}, shields: {} };
    for (const name of realSignatures) {
        codex.weapons[name] = true;
        codex.armors[name] = true;
        codex.shields[name] = true;
    }
    const player = { titles: [], stats: { codex } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('legend_seeker'), 'legend_seeker unlocked at 5 real signatures');
});

test('checkTitles does not re-unlock owned titles', () => {
    const player = {
        titles: ['wanderer'],
        stats: { explores: 200 },
    };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('wanderer'), 'wanderer not re-unlocked');
});

// cycle 62 phase 3: retroactive 칭호 부여 시나리오 — 기존 save가 신규 칭호 조건을
// 이미 만족한 상태로 로드되는 경우를 모사. 단일 호출에 여러 칭호가 한 번에 풀려야 함.
test('checkTitles unlocks multiple new titles in a single call (retroactive load)', () => {
    // cycle 83: discoveries → visitedMaps.length 시맨틱 통일.
    const player = {
        titles: [], // 신규 칭호 미보유 상태
        stats: {
            explores: 600, // wanderer + pathfinder 동시 충족
            visitedMaps: Array.from({ length: 12 }, (_, i) => `m${i}`), // cartographer
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('wanderer'));
    assert.ok(unlocked.includes('pathfinder'));
    assert.ok(unlocked.includes('cartographer'));
    assert.equal(unlocked.length >= 3, true, 'at least 3 new titles unlocked');
});

test('checkTitles partial retroactive (일부만 충족)', () => {
    const player = {
        titles: ['wanderer'], // 이미 wanderer는 보유
        stats: {
            explores: 600, // pathfinder 신규 부여
            discoveries: 5, // cartographer 미달
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('pathfinder'), 'pathfinder unlocked');
    assert.ok(!unlocked.includes('wanderer'), 'wanderer 유지 (재해금 안 됨)');
    assert.ok(!unlocked.includes('cartographer'), 'cartographer 미달');
});

// cycle 77: 도주 카운터 기반 칭호 (cycle 74의 stats.escapes 활용).
test('checkTitles unlocks cautious_explorer at escapes >= 10', () => {
    const player = { titles: [], stats: { escapes: 10 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('cautious_explorer'));
});

test('checkTitles unlocks survivor_instinct at escapes >= 50', () => {
    const player = { titles: [], stats: { escapes: 50 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('cautious_explorer'), '10도 함께 풀림');
    assert.ok(unlocked.includes('survivor_instinct'));
});

test('checkTitles does not unlock survival titles below threshold', () => {
    const player = { titles: [], stats: { escapes: 5 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('cautious_explorer'));
    assert.ok(!unlocked.includes('survivor_instinct'));
});

// ─── Wave 13 E3: seasonTier 폴백을 lifetime max(live ⋁ archive[].tier)로 ───────
//
// Wave 12 D2의 완주 회전은 live seasonPass.tier를 0으로 되돌린다. checkTitles가
// 그 live 값만 읽는 동안은 회전 뒤 titles가 다시 비워지는 두 번째 저장 손실에서
// 시즌 칭호 3종(시즌 선구자/정복자/마스터, val 10/20/30)이 영구 복구 불가였다.

test('checkTitles unlocks seasonTier titles from live tier when there is no archive yet (season 1)', () => {
    const player = {
        titles: [],
        seasonPass: { xp: 4000, tier: 20, claimed: [], isPremium: false, seasonId: 'S1' },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('시즌 선구자'), 'val 10 — live tier 20으로 충족');
    assert.ok(unlocked.includes('시즌 정복자'), 'val 20 — live tier 20으로 충족');
    assert.ok(!unlocked.includes('시즌 마스터'), 'val 30 — 아직 미달');
});

test('checkTitles re-derives all three seasonTier titles from archive after rotation zeroed live tier', () => {
    // 회전 후 live tier=0이고 titles도 비워진 복구 시나리오 — 아카이브만이 유일한 증거.
    const player = {
        titles: [],
        seasonPass: {
            xp: 0,
            tier: 0,
            claimed: [],
            isPremium: false,
            seasonId: 'S2',
            archive: [{ seasonId: 'S1', ordinal: 1, tier: 30, xp: 6000, claimed: [1] }],
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('시즌 선구자'));
    assert.ok(unlocked.includes('시즌 정복자'));
    assert.ok(unlocked.includes('시즌 마스터'));
});

test('checkTitles takes the max of live tier and archive — archive-only would regress current-season progress', () => {
    // 현재 시즌(live tier 20)이 지난 아카이브 기록(tier 10)보다 앞서 있다.
    // archive-only 구현이었다면 시즌 정복자(val 20)를 놓친다.
    const player = {
        titles: [],
        seasonPass: {
            xp: 4000,
            tier: 20,
            claimed: [],
            isPremium: false,
            seasonId: 'S2',
            archive: [{ seasonId: 'S1', ordinal: 1, tier: 10, xp: 2000, claimed: [1] }],
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('시즌 선구자'));
    assert.ok(unlocked.includes('시즌 정복자'), 'archive(10)만 봤다면 놓쳤을 값 — live(20)가 max를 이긴다');
    assert.ok(!unlocked.includes('시즌 마스터'));
});

test('checkTitles ignores corrupted archive entries when computing the seasonTier lifetime max', () => {
    const player = {
        titles: [],
        seasonPass: {
            tier: 0,
            archive: [null, 'S2', { seasonId: 'S3', ordinal: 3 }, { seasonId: 'S1', ordinal: 1, tier: 30, xp: 6000, claimed: [1] }],
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('시즌 마스터'), '온전한 항목(tier 30)은 그대로 반영된다');
});

test('checkTitles handles missing seasonPass without crashing (legacy save)', () => {
    const player = { titles: [] };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('시즌 선구자'));
    assert.ok(!unlocked.includes('시즌 정복자'));
    assert.ok(!unlocked.includes('시즌 마스터'));
});
