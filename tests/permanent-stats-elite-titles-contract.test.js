import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getBakedMetaVitals, getMetaBonusRamp, snapshotMetaVitals } from '../src/systems/metaBonusRamp.ts';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.ts';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import { applyChallengeMaxHp } from '../src/utils/challengeRules.ts';
import {
    ELITE_TITLE_MAPS,
    getEliteTitleBonus,
    getEliteTitleId,
    getRampedEliteTitleBonus,
    recordEliteEncounter,
    splitEliteTitles,
    sumEliteTitleBonus,
} from '../src/utils/eliteTitles.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getTitleLabel, getTitlePassive, getTitlePassiveLabel } from '../src/utils/gameUtils.ts';
import { applyStoryStatGrant, readStoryStatBonus } from '../src/utils/permanentStatSources.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import StatsPanel from '../src/components/StatsPanel.tsx';
import SystemTab from '../src/components/tabs/SystemTab.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 72 — 소유자 결정 세 가지(원장 §75).
 *
 * 1. "죽음의 비용은 크다. 대신 수집 · 칭호 등으로 얻은 영구 능력치는 유지" — 감사 결과 도감 · 칭호 · 계승 보너스는 이미 사망 · 계승을
 *    넘었고, 이야기 체인 능력치 보상(10종)만 런 범위라 한 번 죽으면 영원히 잃었다(체인은 계정당 한 번).
 * 2. 이야기 체인 능력치 보상 → 영구(Wave 62 C2 "이번 여정 범위"를 대체).
 * 3. "정예를 조우했다는 칭호 — 지역별 47개 · 모은 만큼 합산": 사냥 지역에서 정예를 처음 만나면 그 지역의 칭호, 효과는 장착과
 *    상관없이 합산된다.
 * 새 영구 원천 둘은 기존 영구 능력치(Wave 40)처럼 Lv30까지 레벨에 비례한다.
 */

const NOW = 1_790_000_000_000;
const clone = (value) => structuredClone(value);
const basePlayer = (extra = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '수집가', job: '전사', loc: '수정 동굴', level: 30, exp: 0, nextExp: 9_999_999,
    hp: 500, maxHp: 500, mp: 200, maxMp: 200, atk: 40, def: 20, gold: 0,
    equip: { weapon: null, armor: null, offhand: null }, relics: [], status: [], quests: [], titles: [], activeTitle: null,
    ...extra,
});
const idleState = (player) => ({ ...clone(INITIAL_STATE), gameState: GS.IDLE, player, bootStage: 'ready', logs: [] });
const harness = (initial) => {
    let state = initial;
    return { get state() { return state; }, dispatch(action) { state = gameReducer(state, action); } };
};
const eliteEnemy = (extra = {}) => ({ name: '재앙의 광물 지네', baseName: '광물 지네', hp: 100, maxHp: 100, atk: 10, def: 0, exp: 1, gold: 1, isElite: true, ...extra });

// ── 정예 목격 칭호: 데이터 ───────────────────────────────────────────────────

test('정예 목격 칭호는 조우 몬스터가 있는 사냥 지역 전부(47곳)에 하나씩이고, 효과는 지역 레벨 단계표를 따른다', () => {
    const huntingMaps = Object.entries(DB.MAPS).filter(([, map]) => (map.monsters || []).length > 0).map(([name]) => name);
    assert.deepEqual([...ELITE_TITLE_MAPS], huntingMaps);
    assert.equal(ELITE_TITLE_MAPS.length, 47);
    assert.equal(new Set(ELITE_TITLE_MAPS.map(getEliteTitleId)).size, 47);

    assert.deepEqual(getEliteTitleBonus('고요한 숲'), { atk: 0, def: 0, hp: 5, mp: 0 }, 'Lv1');
    assert.deepEqual(getEliteTitleBonus('화염의 협곡'), { atk: 1, def: 0, hp: 5, mp: 0 }, 'Lv15');
    assert.deepEqual(getEliteTitleBonus('폐기된 연구소'), { atk: 1, def: 1, hp: 5, mp: 0 }, 'Lv32');
    assert.deepEqual(getEliteTitleBonus('마왕성'), { atk: 2, def: 1, hp: 10, mp: 0 }, 'Lv48');
    assert.deepEqual(getEliteTitleBonus('에테르 관문'), { atk: 2, def: 1, hp: 10, mp: 5 }, 'Lv68');
    assert.deepEqual(getEliteTitleBonus('혼돈의 심연'), { atk: 2, def: 1, hp: 10, mp: 5 }, '심연(infinite)은 마지막 단계');
    assert.deepEqual(getEliteTitleBonus('봄의 정원'), { atk: 0, def: 0, hp: 5, mp: 0 }, '계절 "5,15"는 앞 숫자');

    const all = sumEliteTitleBonus(ELITE_TITLE_MAPS.map(getEliteTitleId));
    assert.deepEqual(all, { atk: 51, def: 25, hp: 310, mp: 40, count: 47 }, 'constants.ts 주석의 전부 모은 합');
});

test('47곳 모두 정예가 실제로 나온다 — 얻을 수 없는 칭호가 없다', () => {
    const base = clone(INITIAL_STATE.player);
    for (const mapName of ELITE_TITLE_MAPS) {
        const map = DB.MAPS[mapName];
        const level = typeof map.level === 'number' ? map.level : (Number.parseInt(String(map.level), 10) || 60);
        let found = false;
        for (let index = 0; index < 600 && !found; index += 1) {
            const rng = createDomainRandom(20261007, 'wave72-elite', mapName, index);
            const { mStats } = spawnEnemy(map, { ...base, name: 't', loc: mapName, level }, [], { addLog: () => {} }, { rng });
            found = Boolean(mStats?.isElite);
        }
        assert.ok(found, `${mapName}: 600번 안에 정예가 나온다`);
    }
});

// ── 정예 목격 칭호: 기록(SET_ENEMY 전이) ─────────────────────────────────────

test('적이 나타나는 전이(SET_ENEMY)가 정예면 그 지역 칭호를 한 번 기록한다 — 장착은 바꾸지 않고, 로그는 지역마다 한 번', () => {
    const h = harness(idleState(basePlayer({ activeTitle: null })));
    h.dispatch({ type: AT.SET_ENEMY, payload: eliteEnemy() });
    assert.deepEqual(h.state.player.titles, ['elite:수정 동굴']);
    assert.equal(h.state.player.activeTitle, null, '자동 장착하지 않는다(장착 패시브가 없는 칭호)');
    const log = h.state.logs.find((entry) => entry.id === 'elite-title:수정 동굴');
    assert.ok(log, '획득 로그');
    assert.equal(log.text, MSG.ELITE_TITLE_UNLOCKED('수정 동굴의 정예 목격자', '생명 +5'));

    h.dispatch({ type: AT.SET_ENEMY, payload: null });
    h.dispatch({ type: AT.SET_ENEMY, payload: eliteEnemy() });
    assert.deepEqual(h.state.player.titles, ['elite:수정 동굴'], '같은 지역은 한 번');
    assert.equal(h.state.logs.filter((entry) => entry.id === 'elite-title:수정 동굴').length, 1);

    h.dispatch({ type: AT.SET_ENEMY, payload: (enemy) => enemy });
    assert.deepEqual(h.state.player.titles, ['elite:수정 동굴'], '함수형 갱신도 다시 기록하지 않는다');
});

test('정예가 아니면 · 칭호 없는 지역이면 기록하지 않는다 — 정예 보스는 정예다', () => {
    const normal = harness(idleState(basePlayer()));
    normal.dispatch({ type: AT.SET_ENEMY, payload: eliteEnemy({ isElite: false, name: '광물 지네' }) });
    assert.deepEqual(normal.state.player.titles, []);

    const safe = harness(idleState(basePlayer({ loc: '시작의 마을' })));
    safe.dispatch({ type: AT.SET_ENEMY, payload: eliteEnemy() });
    assert.deepEqual(safe.state.player.titles, [], '사냥 지역이 아닌 곳');

    const boss = harness(idleState(basePlayer({ loc: '마왕성' })));
    boss.dispatch({ type: AT.SET_ENEMY, payload: eliteEnemy({ isBoss: true, name: '재앙의 마왕의 사도' }) });
    assert.deepEqual(boss.state.player.titles, ['elite:마왕성']);

    assert.equal(recordEliteEncounter(basePlayer(), null).unlockedMap, null);
});

test('이야기 전투 · 이벤트 전투처럼 SET_ENEMY를 지나는 실제 경로에서도 기록된다 — 탐험에서 정예가 나오는 씨앗', () => {
    // 실제 spawnEnemy가 만든 정예를 같은 전이에 실어 보낸다(탐험 · 이벤트 · 묘비 경로가 모두 이 전이를 지난다).
    const map = DB.MAPS['고요한 숲'];
    let enemy = null;
    for (let index = 0; index < 400 && !enemy?.isElite; index += 1) {
        const rng = createDomainRandom(20261007, 'wave72-forest', index);
        enemy = spawnEnemy(map, basePlayer({ loc: '고요한 숲', level: 1 }), [], { addLog: () => {} }, { rng }).mStats;
    }
    assert.ok(enemy?.isElite, '초반 정예');
    const h = harness(idleState(basePlayer({ loc: '고요한 숲', level: 1 })));
    h.dispatch({ type: AT.SET_ENEMY, payload: enemy });
    assert.deepEqual(h.state.player.titles, ['elite:고요한 숲']);
});

// ── 정예 목격 칭호: 효과 ─────────────────────────────────────────────────────

test('효과는 장착과 상관없이 모은 만큼 합산되고 Lv30까지 레벨에 비례한다 — 장착해도 두 번 더해지지 않는다', () => {
    const titles = ['elite:마왕성', 'elite:에테르 관문', 'elite:수정 동굴'];
    const total = sumEliteTitleBonus(titles);
    assert.deepEqual(total, { atk: 4, def: 2, hp: 25, mp: 5, count: 3 });

    const at = (level, extra = {}) => calculateFullStats(basePlayer({ level, ...extra }));
    const none30 = at(30);
    const with30 = at(30, { titles });
    assert.equal(with30.atk - none30.atk, 4);
    assert.equal(with30.def - none30.def, 2);
    assert.equal(with30.maxHp - none30.maxHp, 25);
    assert.equal(with30.maxMp - none30.maxMp, 5);

    const ramp15 = getMetaBonusRamp(15);
    assert.equal(ramp15, 0.5);
    assert.deepEqual(getRampedEliteTitleBonus({ titles, level: 15 }), { atk: 2, def: 1, hp: 12, mp: 2 });
    assert.equal(at(15, { titles }).atk - at(15).atk, 2, 'Lv15는 절반');

    const equipped = at(30, { titles, activeTitle: 'elite:마왕성' });
    assert.equal(equipped.atk, with30.atk, '장착 패시브가 없다');
    assert.equal(getTitlePassive('elite:마왕성'), null);
    assert.equal(getTitleLabel('elite:마왕성'), '마왕성의 정예 목격자');
    assert.equal(getTitlePassiveLabel('elite:마왕성'), MSG.ELITE_TITLE_PASSIVE('공격력 +2 · 방어력 +1 · 생명 +10'));
    assert.equal(getTitleLabel('elite:없는 지역'), 'elite:없는 지역', '목록에 없는 지역은 칭호가 아니다');
    assert.deepEqual(sumEliteTitleBonus(['elite:마왕성', 'elite:마왕성']).count, 1, '중복은 한 번');
});

// ── 영구 보존: 사망 · 계승 ───────────────────────────────────────────────────

const collector = (extra = {}) => basePlayer({
    level: 40,
    titles: ['veteran', 'elite:마왕성', 'elite:수정 동굴'],
    activeTitle: 'veteran',
    storyStatBonus: { atk: 15, def: 8, hp: 100, mp: 50 },
    stats: { ...clone(INITIAL_STATE.player.stats), deaths: 1, codexBonusAtk: 6, codexBonusDef: 2, codexBonusHp: 40 },
    meta: { ...clone(INITIAL_STATE.player.meta), bonusAtk: 30, bonusHp: 60, bonusMp: 10, endgame: { lastEndgameReceiptKey: 'rk' } },
    ...extra,
});

/** 영구 원천 — 같은 레벨에서 비교한다(사망 · 계승은 Lv1로 돌아가므로 Lv30 이상으로 맞춘 사본을 쓴다). */
const permanentSources = (player) => ({
    titles: [...(player.titles || [])].sort(),
    activeTitle: player.activeTitle,
    story: readStoryStatBonus(player.storyStatBonus),
    codex: [player.stats?.codexBonusAtk, player.stats?.codexBonusDef, player.stats?.codexBonusHp],
    meta: [player.meta?.bonusAtk, player.meta?.bonusHp, player.meta?.bonusMp],
});

test('결정 1 감사: 사망 재시작은 도감 · 칭호(정예 포함) · 이야기 보상 · 계승 보너스를 모두 넘긴다', () => {
    const before = collector();
    const dead = CombatEngine.handleDefeat(before, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    assert.equal(dead.level, 1, '죽음의 비용은 그대로 크다 — 레벨 · 장비 · 가방은 리셋');
    assert.deepEqual(permanentSources(dead), permanentSources(before));
    const snapshot = snapshotMetaVitals(dead.meta, dead.storyStatBonus);
    assert.deepEqual(dead.metaVitalsSnapshot, snapshot, '새 런의 영구 생명 스냅숏에 이야기 생명이 실린다');
    assert.equal(snapshot.hp, 160);
});

test('결정 1 감사: 계승도 같은 원천을 모두 넘긴다(계승 정수 사다리는 Wave 32 결정대로 따로 줄어든다)', () => {
    const before = collector({ level: 50 });
    const after = gameReducer({ ...idleState(before), gameState: GS.ASCENSION },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'rk', seed: 7, challengeModifiers: [] } }).player;
    assert.equal(after.level, 1);
    assert.deepEqual(readStoryStatBonus(after.storyStatBonus), readStoryStatBonus(before.storyStatBonus));
    for (const id of before.titles) assert.ok(after.titles.includes(id), id);
    assert.deepEqual([after.stats.codexBonusAtk, after.stats.codexBonusDef, after.stats.codexBonusHp], [6, 2, 40]);
    assert.ok(after.metaVitalsSnapshot.hp >= 100, '이야기 생명이 스냅숏에 실린다');
});

test('영구 상태 선별: 이야기 보상은 원래 양으로 넘어가고, 없으면 필드를 싣지 않는다', () => {
    const carried = pickPermanentPlayerState(basePlayer({ storyStatBonus: { def: 12, hp: 100 } }), clone(INITIAL_STATE.player));
    assert.deepEqual(carried.storyStatBonus, { atk: 0, def: 12, hp: 100, mp: 0 });
    const empty = pickPermanentPlayerState(basePlayer({ storyStatBonus: { atk: 0 } }), clone(INITIAL_STATE.player));
    assert.equal('storyStatBonus' in empty, false);
});

// ── 이야기 보상: 지급 · 레벨 비례 · 재구성 ──────────────────────────────────

test('이야기 보상 지급은 원래 양을 누적하고, 생명은 지금 레벨의 비례만 구운 뒤 레벨업이 나머지를 굽는다', () => {
    const meta = { ...clone(INITIAL_STATE.player.meta), bonusHp: 0, bonusMp: 0 };
    const vitals = buildClassVitals(15, '전사', meta);
    const player = basePlayer({ level: 15, meta, maxHp: vitals.maxHp, hp: vitals.maxHp, metaVitalsSnapshot: vitals.metaVitalsSnapshot });
    const { player: granted, hpGain } = applyStoryStatGrant(player, { def: 12, hp: 100 });
    assert.deepEqual(readStoryStatBonus(granted.storyStatBonus), { atk: 0, def: 12, hp: 100, mp: 0 });
    assert.equal(hpGain, 50, 'Lv15 = 절반');
    assert.equal(granted.maxHp, player.maxHp + 50);
    assert.deepEqual(granted.metaVitalsSnapshot, { hp: 100, mp: 0 });

    // 같은 플레이어를 이야기 보상 없이 Lv30까지 올린 것과 비교한다 — 차이가 정확히 100이면 레벨업이 나머지 50을 구웠다.
    const levelTo30 = (start) => {
        let current = { ...start, exp: 0, nextExp: 1 };
        while (current.level < 30) current = CombatEngine.applyExpGain({ ...current, exp: 0, nextExp: 1 }, 1).updatedPlayer;
        return current;
    };
    const grown = levelTo30(granted);
    const plain = levelTo30(player);
    assert.equal(grown.level, 30);
    assert.equal(grown.maxHp - plain.maxHp, 100, 'Lv30에 전부 구워진다(지급 50 + 레벨업 50)');
    const at30 = buildClassVitals(30, '전사', meta, granted.storyStatBonus);
    const plain30 = buildClassVitals(30, '전사', meta);
    assert.equal(at30.maxHp - plain30.maxHp, 100, '재구성도 같은 총량');
});

test('전직은 이야기 생명을 두 번 더하지 않는다 — 재구성 스냅숏이 레벨 비례로 한 번 굽는다', () => {
    const meta = { ...clone(INITIAL_STATE.player.meta), bonusHp: 0, bonusMp: 0 };
    const story = { hp: 100, mp: 40 };
    const with30 = buildClassVitals(30, '나이트', meta, story);
    const without30 = buildClassVitals(30, '나이트', meta);
    assert.equal(with30.maxHp - without30.maxHp, 100);
    assert.equal(with30.maxMp - without30.maxMp, 40);
    const with15 = buildClassVitals(15, '나이트', meta, story);
    const without15 = buildClassVitals(15, '나이트', meta);
    assert.equal(with15.maxHp - without15.maxHp, getBakedMetaVitals({ hp: 100, mp: 40 }, 15).hp);

    const player = basePlayer({ job: '전사', level: 30, meta, storyStatBonus: { atk: 0, def: 0, ...story } });
    const h = harness(idleState(player));
    createCharacterActions({ player, gameState: GS.IDLE, dispatch: h.dispatch, addLog: () => {}, addStoryLog: () => {},
        getFullStats: (p = h.state.player) => calculateFullStats(p) }, { emitUnlockedTitles: () => {} }).jobChange('나이트');
    assert.equal(h.state.player.job, '나이트');
    assert.equal(h.state.player.maxHp, with30.maxHp, '전직 결과 = 스냅숏 재구성 한 번');
    assert.equal(h.state.player.maxMp, with30.maxMp);
});

test('이야기 공격력 · 방어력은 배율 뒤 고정값이고 Lv30까지 비례한다 — 사망 뒤 Lv1에서도 1/30이 남는다', () => {
    const story = { atk: 30, def: 15 };
    const diff = (level) => {
        const a = calculateFullStats(basePlayer({ level, storyStatBonus: story }));
        const b = calculateFullStats(basePlayer({ level }));
        return [a.atk - b.atk, a.def - b.def];
    };
    assert.deepEqual(diff(30), [30, 15]);
    assert.deepEqual(diff(15), [15, 7]);
    assert.deepEqual(diff(1), [1, 0]);
});

test("'약한 생명력'이면 굽는 생명만 절반이고 누적은 원래 양이다 — 다음 여정(도전 없음)은 전부 받는다", () => {
    const meta = { ...clone(INITIAL_STATE.player.meta), bonusHp: 0 };
    const vitals = buildClassVitals(30, '전사', meta);
    const half = basePlayer({ level: 30, meta, challengeModifiers: ['halfHp'], maxHp: applyChallengeMaxHp(vitals.maxHp, ['halfHp']), metaVitalsSnapshot: vitals.metaVitalsSnapshot });
    const { player, hpGain } = applyStoryStatGrant(half, { hp: 100 });
    assert.equal(hpGain, 50);
    assert.equal(readStoryStatBonus(player.storyStatBonus).hp, 100, '원래 양');
});

test('스냅숏이 없는 예전 세이브는 예전처럼 전부 굽는다(다음 재구성부터 스냅숏 규칙)', () => {
    const legacy = basePlayer({ level: 10, metaVitalsSnapshot: undefined });
    const { player, hpGain } = applyStoryStatGrant(legacy, { hp: 80, mp: 20 });
    assert.equal(hpGain, 80);
    assert.equal(player.maxHp, legacy.maxHp + 80);
    assert.equal(player.maxMp, legacy.maxMp + 20);
    assert.equal(player.metaVitalsSnapshot, undefined);
});

test('실제 체인 선택(잊혀진 사령관 · 안식)이 영구 누적에 적히고, 미리보기 · 로그는 "영구"라 말한다', () => {
    const chain = EVENT_CHAINS.find((entry) => entry.id === 'forgotten_commander');
    const step = chain.steps.find((entry) => entry.step === 2);
    const event = { ...clone(step.event), _chainId: chain.id, _chainStep: 2 };
    const meta = clone(INITIAL_STATE.player.meta);
    const vitals = buildClassVitals(48, '전사', meta);
    let state = {
        ...idleState(basePlayer({ level: 48, loc: step.loc, meta, maxHp: vitals.maxHp, hp: 100, metaVitalsSnapshot: vitals.metaVitalsSnapshot,
            eventChainProgress: { forgotten_commander: 2 } })),
        gameState: GS.EVENT,
        currentEvent: event,
    };
    const logs = [];
    const before = state.player;
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: (type, text) => logs.push(text),
        getFullStats: () => calculateFullStats(before),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(1);
    assert.deepEqual(readStoryStatBonus(state.player.storyStatBonus), { atk: 0, def: 12, hp: 100, mp: 0 });
    assert.equal(state.player.maxHp, before.maxHp + 100, 'Lv48은 전부 굽는다');
    assert.ok(logs.some((text) => text.includes('영구히')), logs.join(' | '));
    const carried = pickPermanentPlayerState(state.player, clone(INITIAL_STATE.player));
    assert.deepEqual(carried.storyStatBonus, { atk: 0, def: 12, hp: 100, mp: 0 }, '죽어도 남는다');
});

// ── 화면 ────────────────────────────────────────────────────────────────────

test('능력치 화면 "계승 기록"이 이야기 보상과 정예 목격 N/47의 원래 양을 보인다', () => {
    const player = basePlayer({ titles: ['elite:마왕성', 'elite:수정 동굴'], storyStatBonus: { atk: 15, hp: 50 } });
    const html = renderStatic(createElement(StatsPanel, { player, stats: calculateFullStats(player) }));
    const text = (id) => {
        const at = html.indexOf(`data-testid="${id}"`);
        assert.ok(at >= 0, id);
        return html.slice(at, html.indexOf('</div></div>', at)).replace(/<[^>]+>/g, '');
    };
    assert.ok(text('stats-story-bonus').includes('공격력 +15 · 생명 +50'));
    assert.ok(text('stats-elite-titles').includes(MSG.STATS_ELITE_TITLE_LABEL(2, 47)));
    assert.ok(text('stats-elite-titles').includes('공격력 +2 · 방어력 +1 · 생명 +15'));
});

test('칭호 바꾸기: 정예 목격 칭호는 묶음 안에 있고 묶음 제목이 N/47과 합산 효과를 말한다', () => {
    const titles = ['veteran', 'elite:마왕성', 'elite:수정 동굴'];
    assert.deepEqual(splitEliteTitles(titles), { regular: ['veteran'], elite: ['elite:마왕성', 'elite:수정 동굴'] });
    const player = basePlayer({ titles, activeTitle: 'veteran' });
    const html = renderStatic(createElement(SystemTab, {
        player,
        stats: calculateFullStats(player),
        actions: { leaderboard: [], isAdmin: () => false },
        runtime: { viewport: 'mobile', gameState: 'idle', syncStatus: 'synced', isAiThinking: false },
    }));
    const group = html.indexOf('data-testid="system-elite-titles"');
    assert.ok(group >= 0, '정예 칭호 묶음');
    assert.ok(html.indexOf('data-testid="system-title-veteran"') < group, '일반 칭호는 묶음 앞');
    assert.ok(html.indexOf('data-testid="system-title-elite:마왕성"') > group, '정예 칭호는 묶음 안');
    assert.ok(html.includes(MSG.ELITE_TITLE_GROUP(2, 47)));
    assert.ok(html.includes(MSG.ELITE_TITLE_GROUP_TOTAL('공격력 +2 · 방어력 +1 · 생명 +15')));
    assert.ok(html.includes('마왕성의 정예 목격자'));
});

test('단계표 상수는 증가만 한다 — 더 깊은 지역의 칭호가 얕은 지역보다 약하지 않다', () => {
    const bands = BALANCE.ELITE_TITLE_BONUS_BANDS;
    for (let index = 1; index < bands.length; index += 1) {
        assert.ok(bands[index].minLevel > bands[index - 1].minLevel);
        for (const key of ['atk', 'def', 'hp', 'mp']) assert.ok(bands[index][key] >= bands[index - 1][key], `${index}:${key}`);
    }
});
