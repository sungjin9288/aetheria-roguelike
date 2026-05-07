import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * cycle 249: TITLE_PASSIVES 누락 8건 추가 dead config (cycle 248 follow-up)
 *   (cycle 222-248 silent dead config 시리즈 21번째).
 *
 * 발견 (cycle 248 audit 후 추가 발견 8건):
 * - 시즌 패스 tier 보상 3종 (cond.type='seasonTier'):
 *   '시즌 선구자' (tier 10), '시즌 정복자' (tier 20), '시즌 마스터' (tier 30) — 모두 0 보너스.
 * - 퀘스트 보상 5종 (cond.type='questReward'):
 *   '에테르 탐험가' (152), '공허의 방랑자' (153), '종말의 정복자' (154),
 *   '지도 제작자' (201), '전설의 기록자' (202).
 * - cycle 209에서 Korean-id quest reward TITLES 등록 후 TITLE_PASSIVES 미반영이라 활성 시 0 stat.
 * - cosmetic 4종 ('별을 보는 자' 등)은 의도된 cosmetic-only이라 제외.
 *
 * 패턴 (cycle 222-248 silent dead config 시리즈 21번째):
 * - cycle 248: abyss endgame 3종 TITLE_PASSIVES 추가.
 * - cycle 249: season pass + quest reward 8종 TITLE_PASSIVES 추가 (paired completion).
 *
 * 수정 (src/data/titles.ts TITLE_PASSIVES):
 * - 시즌 선구자/정복자/마스터: tier 10/20/30 점진 강화.
 * - '지도 제작자': cartographer (영문 id 동등) 미러 — { hp: 25, mp: 15 }.
 * - '전설의 기록자': legend_chronicler 미러 — { atk: 4, crit: 0.02, hp: 20 }.
 * - 에테르/공허/종말 quest endings: 각 quest 톤에 맞는 보너스.
 *
 * 회귀 가드:
 * - cycle 248 추가 abyss 3종 그대로.
 * - 기존 32개 TITLE_PASSIVES 변화 없음.
 * - cosmetic 4종은 의도된 0 보너스 유지 (premium 구매 cosmetic).
 */

const REQUIRED_PASSIVES = [
    '시즌 선구자',
    '시즌 정복자',
    '시즌 마스터',
    '에테르 탐험가',
    '공허의 방랑자',
    '종말의 정복자',
    '지도 제작자',
    '전설의 기록자',
];

test('cycle 249: 8개 누락 TITLE_PASSIVES 모두 정의', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    REQUIRED_PASSIVES.forEach((key) => {
        assert.ok(TITLE_PASSIVES[key], `'${key}' TITLE_PASSIVES 정의되어야 함`);
        assert.ok(TITLE_PASSIVES[key].label, `'${key}' label 존재`);
    });
});

test('cycle 249: 시즌 패스 tier 점진 강화 (10 < 20 < 30)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const t10 = TITLE_PASSIVES['시즌 선구자'];
    const t20 = TITLE_PASSIVES['시즌 정복자'];
    const t30 = TITLE_PASSIVES['시즌 마스터'];
    // 가중 합산: atk + def + crit*100 + hp/10 + mp/10 — coarse strength metric.
    const score = (p) => (p.atk || 0) + (p.def || 0) + (p.crit || 0) * 100 + (p.hp || 0) / 10 + (p.mp || 0) / 10;
    assert.ok(score(t10) < score(t20), `시즌 선구자(${score(t10)}) < 시즌 정복자(${score(t20)})`);
    assert.ok(score(t20) < score(t30), `시즌 정복자(${score(t20)}) < 시즌 마스터(${score(t30)})`);
});

test('cycle 249: 지도 제작자 ↔ cartographer 영문-id 동등 보너스 (cycle 209 정합)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const koreanPassive = TITLE_PASSIVES['지도 제작자'];
    const englishPassive = TITLE_PASSIVES['cartographer'];
    assert.deepEqual(
        { atk: koreanPassive.atk || 0, def: koreanPassive.def || 0, hp: koreanPassive.hp || 0, mp: koreanPassive.mp || 0, crit: koreanPassive.crit || 0 },
        { atk: englishPassive.atk || 0, def: englishPassive.def || 0, hp: englishPassive.hp || 0, mp: englishPassive.mp || 0, crit: englishPassive.crit || 0 },
        '지도 제작자 (한글 id) === cartographer (영문 id) 보너스 미러'
    );
});

test('cycle 249: 전설의 기록자 ↔ legend_chronicler 영문-id 동등 보너스', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const koreanPassive = TITLE_PASSIVES['전설의 기록자'];
    const englishPassive = TITLE_PASSIVES['legend_chronicler'];
    assert.deepEqual(
        { atk: koreanPassive.atk || 0, def: koreanPassive.def || 0, hp: koreanPassive.hp || 0, mp: koreanPassive.mp || 0, crit: koreanPassive.crit || 0 },
        { atk: englishPassive.atk || 0, def: englishPassive.def || 0, hp: englishPassive.hp || 0, mp: englishPassive.mp || 0, crit: englishPassive.crit || 0 },
        '전설의 기록자 (한글 id) === legend_chronicler (영문 id) 보너스 미러'
    );
});

test('cycle 249: 종말의 정복자 (questReward 154) endgame top-tier scale', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const passive = TITLE_PASSIVES['종말의 정복자'];
    // cond=questReward 154 — 게임 종반 quest 보상. 최소 atk 3 / def 1.
    assert.ok((passive.atk || 0) >= 3, `종말의 정복자 atk ≥ 3 (실제: ${passive.atk})`);
    assert.ok((passive.def || 0) >= 1, `종말의 정복자 def ≥ 1 (실제: ${passive.def})`);
});

test('cycle 249: 통합 — 시즌 마스터 활성 시 stats 합산 검증', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '전사', level: 50,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: ['시즌 마스터'],
        stats: {}, activeTitle: '시즌 마스터',
    };
    const stats = calculateFullStats(player);
    // base atk + 시즌 마스터 atk 보너스 합산 — atk ≥ 53 (base 50 + 3).
    assert.ok(stats.atk >= 53, `시즌 마스터 활성 atk +3 (실제: ${stats.atk})`);
});

test('cycle 248 회귀 가드: abyss 3종 그대로 유지', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    assert.equal(TITLE_PASSIVES['void_conqueror'].atk, 3, 'cycle 248 void_conqueror 회귀 가드');
    assert.equal(TITLE_PASSIVES['abyss_legend'].atk, 5, 'cycle 248 abyss_legend 회귀 가드');
    assert.equal(TITLE_PASSIVES['void_sovereign'].atk, 7, 'cycle 248 void_sovereign 회귀 가드');
});

test('cycle 249: cosmetic 4종은 의도된 0 보너스 유지 (회귀 가드)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    // premium-구매 cosmetic 칭호는 stat 보너스 X — 의도된 design.
    assert.equal(TITLE_PASSIVES['별을 보는 자'], undefined, 'cosmetic 의도 0 보너스');
    assert.equal(TITLE_PASSIVES['공허를 걷는 자'], undefined, 'cosmetic 의도 0 보너스');
    assert.equal(TITLE_PASSIVES['에테르의 아이'], undefined, 'cosmetic 의도 0 보너스');
    assert.equal(TITLE_PASSIVES['세계의 끝'], undefined, 'cosmetic 의도 0 보너스');
});
