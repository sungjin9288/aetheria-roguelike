// 2026-10 Wave 117 — 자연 플레이 측정 드라이버(`scripts/naturalPlay/driver.mjs`)는 저장소 안의 도구다.
// 원장의 측정(사망 · 시간 · 루프)이 모두 이 드라이버에서 나오므로, 게임이 바뀌어도 드라이버가 계속 돌고
// 같은 시드에서 같은 결과를 내는지를 지킨다. 측정 자체는 CI에서 돌리지 않는다(수십 분) — 여기서는 짧은 예산만.
import test from 'node:test';
import assert from 'node:assert/strict';

import { JOB_PATHS, classifyEventFrame, pickAscensionRuleId, pickChapterPickCardId, runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';
import { CHAPTER_PICK_SKIP_ID } from '../src/utils/chapterPick.js';
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

test('v3 (Wave 128): 받은 곁가지 이야기 임무는 그 이야기가 시작되는 지역에서 끝내고, 회차마다 이야기별 단계를 남긴다', async () => {
    const { DRIVER_VERSION } = await import('../scripts/naturalPlay/driver.mjs');
    assert.equal(DRIVER_VERSION, 3);
    const result = await runNaturalPlay(SHORT);
    assert.equal(result.driverVersion, 3);
    const [run] = result.runs;
    // 본편 장이 여는 이야기(사라진 마법사 · 잊혀진 사령관)와, 게시판에서 받은 곁가지 이야기 임무가 여는 이야기가 함께 열린다.
    for (const chainId of ['lost_wizard', 'forgotten_commander', 'last_hero', 'water_apostle']) {
        assert.ok((run.chainSteps[chainId] ?? 0) >= 1, `${chainId}: ${JSON.stringify(run.chainSteps)}`);
    }
    assert.ok(Object.values(run.chainSteps).every((value) => Number.isInteger(value) && value >= 1 && value <= 3));
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

test('경제 정책(E9)은 옵션이다 — 끄면 결과에 흔적이 없고, 켜면 결정론적으로 장비를 팔고 사며 강화를 막은 것을 센다', async () => {
    const off = await runNaturalPlay(SHORT);
    assert.equal(off.economy, undefined, '기본(none) 결과에는 경제 필드가 없다');
    assert.ok(off.runs.every((run) => run.economy === undefined));
    const on = await runNaturalPlay({ ...SHORT, economy: 'basic' });
    assert.deepEqual(await runNaturalPlay({ ...SHORT, economy: 'basic' }), on);
    assert.equal(on.economy, 'basic');
    assert.equal(on.stalled, null, JSON.stringify(on.stalled));
    const [run] = on.runs;
    assert.ok(run.economy.sold >= 1, `판매 ${run.economy.sold}`);
    assert.ok(run.economy.gearBought >= 1, `장비 구매 ${run.economy.gearBought}`);
    // 강화는 대기 차례마다 판정한다 — 짧은 예산에서는 재료가 막는다(무엇이 막았는지가 E9의 측정값이다).
    const blocked = run.economy.blockedGold + run.economy.blockedMaterial + run.economy.blockedReserve;
    assert.ok(blocked + run.economy.enhanceTries > 0, '강화를 판정한다');
    assert.equal(run.economy.materialBought, undefined, 'basic은 강화 재료를 사지 않는다');
    // materials = basic + 상점 강화 재료 구매(원장 §164) — 같은 시드에서 결정론적이고 구매 수를 센다.
    const mat = await runNaturalPlay({ ...SHORT, economy: 'materials' });
    assert.deepEqual(await runNaturalPlay({ ...SHORT, economy: 'materials' }), mat);
    assert.equal(mat.economy, 'materials');
    assert.ok(Number.isInteger(mat.runs[0].economy.materialBought), JSON.stringify(mat.runs[0].economy));
    await assert.rejects(() => runNaturalPlay({ ...SHORT, economy: 'all' }), /unknown economy/);
});

test('장의 선물 정책(H3)은 카드 종류를 고르고, 그 종류가 패에 없으면 유물 카드 · 무작위는 시드로 결정론적이다', () => {
    const full = { chapter: 4, cards: [{ id: 'relic', kind: 'relic' }, { id: 'prefix', kind: 'prefix' }, { id: 'enhance', kind: 'enhance' }] };
    const noGear = { chapter: 5, cards: [{ id: 'relic', kind: 'relic' }, { id: 'relic-2', kind: 'relic' }, { id: 'relic-3', kind: 'relic' }] };
    assert.equal(pickChapterPickCardId(full, 'skip'), CHAPTER_PICK_SKIP_ID);
    for (const kind of ['relic', 'prefix', 'enhance']) {
        assert.equal(pickChapterPickCardId(full, kind), kind);
        assert.equal(pickChapterPickCardId(noGear, kind), 'relic', `${kind}가 없으면 첫 유물 카드`);
    }
    assert.equal(pickChapterPickCardId({ chapter: 7, cards: [] }, 'relic'), CHAPTER_PICK_SKIP_ID, '패가 비면 넘긴다');
    const counts = new Map();
    for (let pickSeed = 0; pickSeed < 300; pickSeed += 1) {
        const id = pickChapterPickCardId(full, 'random', pickSeed);
        assert.equal(id, pickChapterPickCardId(full, 'random', pickSeed));
        counts.set(id, (counts.get(id) || 0) + 1);
    }
    assert.deepEqual([...counts.keys()].sort(), ['enhance', 'prefix', 'relic']);
    for (const n of counts.values()) assert.ok(n > 60, `고르게 나온다 ${[...counts.values()]}`);
});

test('장의 선물(H3): 기본 none은 흔적이 없고, skip은 고르기만 기록해 결과가 none과 같다 — 고르기는 행동 · 난수를 쓰지 않는다', async () => {
    // 한 회차(마왕 처치 → 계승)가 약 5,400행동이라 4 · 5 · 7장을 지나간다.
    const options = { seed: 7, maxSteps: 6000 };
    const none = await runNaturalPlay(options);
    assert.equal(none.chapterPick, undefined);
    assert.ok(none.runs.every((run) => run.chapterPicks === undefined));
    const skip = await runNaturalPlay({ ...options, chapterPick: 'skip' });
    assert.equal(skip.chapterPick, 'skip');
    const picks = skip.runs.flatMap((run) => run.chapterPicks);
    assert.ok(picks.length >= 3, JSON.stringify(picks));
    assert.ok(picks.every(([, chapter, kind]) => [4, 5, 7].includes(chapter) && kind === 'skip'), JSON.stringify(picks));
    const strip = ({ chapterPick: _policy, ...rest }) => ({ ...rest, runs: rest.runs.map(({ chapterPicks: _picks, ...run }) => run) });
    assert.deepEqual(strip(skip), strip(none));
    await assert.rejects(() => runNaturalPlay({ ...SHORT, chapterPick: 'best' }), /unknown chapterPick/);
});

test('이벤트 화면 관찰(H7): 틀을 가르고 숫자만 다른 글은 같은 정체다 — 회차 기록의 합이 맞는다', async () => {
    assert.equal(classifyEventFrame(null), null);
    assert.deepEqual(classifyEventFrame({ _chainId: 'lost_mage', _chainStep: 1, desc: 'x', choices: [] }), { kind: 'chain', key: 'chain:lost_mage:1' });
    assert.equal(classifyEventFrame({ isBoundedEncounter: true, boundedEncounterId: 'forest.a', desc: 'x', choices: [] }).key, 'bounded:forest.a');
    assert.equal(classifyEventFrame({ isCampfire: true, desc: 'd', choices: ['a', 'b'] }).kind, 'campfire');
    assert.equal(classifyEventFrame({ isScout: true, desc: 'd', choices: ['a'] }).kind, 'scout');
    assert.equal(classifyEventFrame({ isWanderingMerchant: true, desc: 'd', choices: [] }).key, 'merchant');
    const fallback = (gold) => classifyEventFrame({ source: 'cave', desc: `골드 ${gold}을 줍는다`, choices: ['줍는다'] });
    assert.equal(fallback(120).kind, 'fallback');
    assert.equal(fallback(120).key, fallback(4500).key, '레벨 비례 수치만 다른 같은 글');

    const result = await runNaturalPlay({ seed: 3, maxSteps: 3000 });
    const events = result.runs[0].events;
    const sum = (obj) => Object.values(obj).reduce((total, n) => total + n, 0);
    assert.ok(events.total > 0, JSON.stringify(events));
    assert.equal(sum(events.byKind), events.total);
    assert.equal(sum(events.firstByKind), events.firstAt.length);
    assert.ok(events.firstAt.length <= events.total);
    for (const [kind, n] of Object.entries(events.firstByKind)) assert.ok(n <= events.byKind[kind], kind);
    assert.ok(events.firstAt.every(([at], i, all) => i === 0 || at >= all[i - 1][0]), '시각 순서');
    assert.equal(result.runs[0].eventSeen, undefined, '내부 집합은 기록에 남기지 않는다');
});
