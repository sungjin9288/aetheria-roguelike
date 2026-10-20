// 2026-10 Wave 117 — 자연 플레이 측정 드라이버(`scripts/naturalPlay/driver.mjs`)는 저장소 안의 도구다.
// 원장의 측정(사망 · 시간 · 루프)이 모두 이 드라이버에서 나오므로, 게임이 바뀌어도 드라이버가 계속 돌고
// 같은 시드에서 같은 결과를 내는지를 지킨다. 측정 자체는 CI에서 돌리지 않는다(수십 분) — 여기서는 짧은 예산만.
import test from 'node:test';
import assert from 'node:assert/strict';

import { JOB_PATHS, pickAscensionRuleId, runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';
import { getAscensionRule, getAscensionRuleOffer } from '../src/systems/ascensionRule.js';

const SHORT = { seed: 7, maxSteps: 800 };

test('같은 시드는 같은 결과다 — 전역 난수 · 시계를 시드로 바꾸고 기록 id도 카운터다', async () => {
    const first = await runNaturalPlay(SHORT);
    const second = await runNaturalPlay(SHORT);
    assert.deepEqual(second, first);
    const other = await runNaturalPlay({ ...SHORT, seed: 8 });
    assert.notDeepEqual(other.runs, first.runs, '다른 시드는 다른 회차를 걷는다');
});

test('짧은 예산에서도 실제로 성장한다 — 막힘 감시가 비어 있고 전투 · 레벨이 오른다', async () => {
    const result = await runNaturalPlay(SHORT);
    assert.equal(result.stalled, null, JSON.stringify(result.stalled));
    assert.equal(result.steps, SHORT.maxSteps);
    const [run] = result.runs;
    assert.ok(run.combats >= 30, `전투 ${run.combats}`);
    // 그 회차에 닿은 최고 레벨이다 — 사망하면 여정이 처음부터라(Wave 108) 마지막 레벨은 성장의 척도가 아니다
    //   (Wave 127: 전투 후 회복이 없어진 뒤 시드 7은 Lv11에서 한 번 죽고 Lv3에서 예산이 끝난다).
    const reached = Math.max(...Object.keys(run.levelAt).map(Number));
    assert.ok(reached >= 10, `레벨 ${reached}`);
    assert.ok(run.levelAt[2] > 0, '레벨 도달 시각을 기록한다');
    // Wave 120: 큰 순간(원장 §80 정의 + 토벌 의뢰)을 시각과 함께 남긴다 — 리듬(최장 공백) 측정의 입력이다.
    const kinds = new Set(run.moments.map(([, kind]) => kind));
    assert.ok(run.moments.length >= 10, `큰 순간 ${run.moments.length}`);
    assert.ok(kinds.has('region') && kinds.has('relic'), [...kinds].join(','));
    assert.ok(run.moments.every(([at], index) => at >= 0 && at <= run.hours && (index === 0 || at >= run.moments[index - 1][0])));
});

test('돌린 뒤 전역 Math.random · Date를 되돌린다', async () => {
    const realRandom = Math.random;
    const RealDate = Date;
    await runNaturalPlay({ seed: 3, maxSteps: 50 });
    assert.equal(Math.random, realRandom);
    assert.equal(Date, RealDate);
});

test('직업 경로는 실제 전직 사슬이다', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    for (const [name, path] of Object.entries(JOB_PATHS)) {
        let current = '모험가';
        for (const job of path) {
            assert.ok(CLASSES[current]?.next?.includes(job), `${name}: ${current} → ${job}`);
            current = job;
        }
    }
});

test('고정 순서 카드 모드는 그 규칙이 패에 있을 때만 고르고, 기본 모드는 고르지 않는다 (Wave 121)', () => {
    // 첫 순환 미리보기 값은 고정 순서 단계(`measuredRank`)에서 잰다 — 패에 없으면 기본 카드로 넘어간다(원장 §121.7 · §128).
    let inHand = 0;
    let outOfHand = 0;
    for (let k = 0; k < 40; k += 1) {
        const player = { meta: { prestigeRank: 3, endgame: { lastEndgameReceiptKey: `probe-${k}` } }, stats: {} };
        const fixed = getAscensionRule(4);
        const offered = getAscensionRuleOffer(player, 4).some((rule) => rule.id === fixed.id);
        assert.equal(pickAscensionRuleId(player, 4, 'fixed'), offered ? fixed.id : undefined);
        assert.equal(pickAscensionRuleId(player, 4, 'default'), undefined);
        if (offered) inHand += 1; else outOfHand += 1;
    }
    assert.ok(inHand > 0 && outOfHand > 0, `패에 있음 ${inHand} · 없음 ${outOfHand}`);
});

test('무작위 카드 모드는 패 안의 카드를 시드 · 단계로 결정론적으로 고르고, 패의 카드가 고르게 나온다 (Wave 122)', () => {
    // 기본 카드 무게표를 잴 때 무게로 고른 카드만 담기는 선택 편향을 없앤다(원장 §129). 게임 난수를 쓰지 않는다.
    const counts = new Map();
    const realRandom = Math.random;
    Math.random = () => { throw new Error('게임 난수를 쓰면 안 된다'); };
    try {
        for (let k = 0; k < 300; k += 1) {
            const player = { meta: { prestigeRank: 3, endgame: { lastEndgameReceiptKey: 'probe-fixed' } }, stats: {} };
            const offer = getAscensionRuleOffer(player, 4).map((rule) => rule.id);
            const picked = pickAscensionRuleId(player, 4, 'random', k);
            assert.ok(offer.includes(picked), picked);
            assert.equal(pickAscensionRuleId(player, 4, 'random', k), picked, '같은 시드 · 단계는 같은 카드');
            counts.set(picked, (counts.get(picked) || 0) + 1);
        }
    } finally {
        Math.random = realRandom;
    }
    assert.equal(counts.size, 3, [...counts.keys()].join(','));
    for (const n of counts.values()) assert.ok(n > 60, `고르게 나온다 ${[...counts.values()]}`);
});
