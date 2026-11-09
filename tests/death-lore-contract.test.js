import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { DEATH_LORE } from '../src/data/deathLore.js';
import { MAPS } from '../src/data/maps.js';
import { BOSS_BRIEFS } from '../src/data/monsters.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import {
    DEATH_LORE_TOTAL,
    getDeathLoreGroup,
    getDeathLoreKind,
    readDeathLoreLedger,
    recordDeathLore,
} from '../src/utils/deathLore.js';
import { getChapterOf } from '../src/utils/chapters.js';
import { renderStatic } from './helpers/render.ts';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import { createElement } from 'react';

/**
 * 2026-11 B6 돌기둥의 증언 (소유자 결정 2026-11-09 — 명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §2):
 * 전투 패배 한 번 = 증언 한 줄. 장부 `stats.deathLore`는 계정 범위이고 패배 전이 한 곳이 쓴다. 난수 · 기록 줄을 쓰지 않는다.
 */

const clone = (value) => structuredClone(value);
const NOW = 1_700_000_000_000;
const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const dyingState = ({ loc = '고요한 숲', ledger, deaths = 0, enemy = {} } = {}) => ({
    ...clone(INITIAL_STATE),
    bootStage: 'ready',
    gameState: GS.COMBAT,
    player: {
        ...clone(INITIAL_STATE.player),
        name: '증언자',
        level: 4,
        loc,
        hp: 1,
        maxHp: 500,
        stats: { ...clone(INITIAL_STATE.player.stats), deaths, ...(ledger ? { deathLore: ledger } : {}) },
    },
    enemy: {
        name: '훈련용 정령', baseName: '훈련용 정령', level: 1, hp: 100000, maxHp: 100000,
        atk: 9999, def: 0, exp: 1, gold: 1, pattern: { guardChance: 0, heavyChance: 0 },
        ...enemy,
    },
});

const defeat = (state) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: 0, seed: 1, now: NOW },
});

const withThrowingRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('증언 판정이 Math.random을 불렀다'); };
    try { return fn(); } finally { Math.random = original; }
};

test('데이터: 46줄 · id 유일 · 묶음마다 강적 줄 하나 이하 · id 집합 골든(늘기만 한다)', () => {
    assert.equal(DEATH_LORE.length, 46);
    assert.equal(DEATH_LORE_TOTAL, 46);
    const ids = DEATH_LORE.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    const GOLDEN = [
        ...Array.from({ length: 8 }, (_, i) => [`c${i + 1}-f1`, `c${i + 1}-f2`, `c${i + 1}-f3`, `c${i + 1}-s`]).flat(),
        ...[9, 10, 11].flatMap((n) => [`c${n}-f1`, `c${n}-f2`, `c${n}-s`]),
        'abyss-1', 'abyss-2', 'abyss-3', 'wild-1', 'wild-2',
    ];
    for (const id of GOLDEN) assert.ok(ids.includes(id), `${id}가 사라졌다 — 들은 기록의 모은 수가 줄어든다`);
    const groups = new Map();
    for (const entry of DEATH_LORE) groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
    for (const [group, lines] of groups) {
        assert.ok(lines.filter((entry) => entry.strong).length <= 1, `${group} 강적 줄`);
        assert.ok(lines.some((entry) => !entry.strong), `${group} 일반 줄`);
    }
    for (let chapter = 1; chapter <= 11; chapter += 1) assert.ok(groups.has(`c${chapter}`), `${chapter}장 증언`);
});

test('데이터: 문장에 지역 이름 · 보스 이름 · 능력치 약어 · 보간 자리가 없다', () => {
    const regionNames = Object.keys(MAPS);
    const bossNames = Object.keys(BOSS_BRIEFS);
    for (const entry of DEATH_LORE) {
        for (const name of regionNames) assert.ok(!entry.text.includes(name), `${entry.id}: 지역 "${name}"`);
        for (const name of bossNames) assert.ok(!entry.text.includes(name), `${entry.id}: 보스 "${name}"`);
        assert.doesNotMatch(entry.text, /\b(HP|MP|ATK|DEF|EXP|Lv)\b|\$\{|\{[a-z]/, entry.id);
    }
});

test('묶음 판정: 장 지역은 그 장, 혼돈의 심연은 abyss, 안전지대 · 계절 · 열쇠 지역 · 모르는 곳은 wild', () => {
    assert.equal(getDeathLoreGroup('고요한 숲'), 'c1');
    assert.equal(getDeathLoreGroup('마왕성'), 'c8');
    assert.equal(getDeathLoreGroup('혼돈의 심연'), 'abyss');
    for (const loc of ['시작의 마을', '황금 왕국', '봄의 정원', '서리 폭풍 유적', '고대 보물고', '없는 곳', undefined]) {
        assert.equal(getDeathLoreGroup(loc), 'wild', String(loc));
    }
    for (const [name] of Object.entries(MAPS)) {
        const chapter = getChapterOf(name);
        if (chapter !== null) assert.equal(getDeathLoreGroup(name), `c${chapter}`, name);
    }
});

test('종류 판정: 보스 · 정예 · 토벌 우두머리는 강적, 그 밖과 적 없음은 일반', () => {
    assert.equal(getDeathLoreKind({ isBoss: true }), 'strong');
    assert.equal(getDeathLoreKind({ isElite: true }), 'strong');
    assert.equal(getDeathLoreKind({ huntChampion: '천공 정원' }), 'strong');
    assert.equal(getDeathLoreKind({ name: '슬라임' }), 'field');
    assert.equal(getDeathLoreKind(null), 'field');
});

test('선택 규칙: 강적 우선 · 일반은 순서 · 일반 소진 뒤 강적 · 묶음 소진 뒤 사망 수로 도는 들은 줄', () => {
    let r = recordDeathLore([], '고요한 숲', { isElite: true }, 1);
    assert.equal(r.view.id, 'c1-s');
    assert.equal(r.view.isNew, true);
    r = recordDeathLore(r.ledger, '고요한 숲', { isElite: true }, 2);
    assert.equal(r.view.id, 'c1-f1', '강적 줄을 들었으면 강적 사망도 다음 일반 줄');

    let ledger = [];
    const seen = [];
    for (let deaths = 1; deaths <= 4; deaths += 1) {
        const step = recordDeathLore(ledger, '서쪽 평원', null, deaths);
        seen.push(step.view.id);
        ledger = step.ledger;
    }
    assert.deepEqual(seen, ['c1-f1', 'c1-f2', 'c1-f3', 'c1-s'], '일반 사망으로도 강적 줄이 결국 열린다');
    assert.equal(ledger.length, 4);

    const exhausted = recordDeathLore(ledger, '서쪽 평원', null, 6);
    assert.equal(exhausted.view.isNew, false);
    assert.equal(exhausted.view.id, ['c1-f1', 'c1-f2', 'c1-f3', 'c1-s'][6 % 4], '사망 수 mod 묶음 크기');
    assert.deepEqual(exhausted.ledger, ledger, '들은 줄은 장부를 늘리지 않는다');
    assert.equal(exhausted.view.collected, 4);
    assert.equal(exhausted.view.total, 46);
});

test('장부 읽기: 모르는 id · 중복 · 문자열 아닌 값을 버리고 순서를 지킨다', () => {
    assert.deepEqual(readDeathLoreLedger(['c2-f1', 'nope', 'c1-f1', 'c2-f1', 3, null]), ['c2-f1', 'c1-f1']);
    assert.deepEqual(readDeathLoreLedger(undefined), []);
    assert.deepEqual(readDeathLoreLedger('c1-f1'), []);
});

test('패배 전이: 증언 한 줄이 새 여정 장부와 런 요약에 남고, 판정은 Math.random을 쓰지 않는다', () => {
    const next = withThrowingRandom(() => defeat(dyingState({ loc: '서쪽 평원', ledger: ['c1-f1'], deaths: 2 })));
    assert.equal(next.gameState, GS.DEAD);
    assert.deepEqual(next.player.stats.deathLore, ['c1-f1', 'c1-f2']);
    assert.equal(next.player.stats.deaths, 3);
    assert.deepEqual(next.runSummary.deathLore, {
        id: 'c1-f2', text: DEATH_LORE.find((e) => e.id === 'c1-f2').text, isNew: true, collected: 2, total: 46,
    });
});

test('패배 전이: 정예에게 쓰러지면 그 장의 강적 줄, 장부가 없던 이전 세이브는 빈 장부에서 시작한다', () => {
    const next = defeat(dyingState({ loc: '버려진 광산', enemy: { isElite: true } }));
    assert.deepEqual(next.player.stats.deathLore, ['c2-s']);
});

test('기록 줄 0: 증언은 전투 기록에 줄을 더하지 않는다(장부가 차 있든 비어 있든 같은 수)', () => {
    const fresh = dyingState();
    const exhausted = dyingState({ ledger: DEATH_LORE.map((e) => e.id) });
    const a = defeat(fresh);
    const b = defeat(exhausted);
    assert.equal(a.logs.length - fresh.logs.length, b.logs.length - exhausted.logs.length);
    for (const entry of a.logs) assert.ok(!DEATH_LORE.some((lore) => entry.text?.includes(lore.text)), '증언 문장이 기록에 있다');
});

test('승리 · 도주 · 다시 시작 · 계승은 장부를 늘리지 않고, 사망 · 다시 시작 · 계승을 넘어 남는다', () => {
    const escaped = actionMap.RESOLVE_COMBAT_ACTION(dyingState({ ledger: ['c1-f1'] }), {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'escape', expectedTurn: 0, seed: 1, now: NOW },
    });
    assert.deepEqual(escaped.player.stats.deathLore, ['c1-f1']);

    const veteran = { ...clone(INITIAL_STATE.player), stats: { ...clone(INITIAL_STATE.player.stats), deathLore: ['c1-f1', 'c3-s'] } };
    const reset = gameReducer({ ...clone(INITIAL_STATE), bootStage: 'ready', player: clone(veteran) }, { type: AT.RESET_GAME });
    assert.deepEqual(reset.player.stats.deathLore, ['c1-f1', 'c3-s']);

    const handled = CombatEngine.handleDefeat(clone(veteran), clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    assert.deepEqual(handled.stats.deathLore, ['c1-f1', 'c3-s'], '운반은 handleDefeat의 영구 상태 선별이 한다');
});

test('부재 불변식: src에서 deathLore 장부를 쓰는 곳은 패배 전이 하나(+ 운반)뿐이다', () => {
    const root = path.resolve('src');
    const offenders = [];
    const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) { walk(full); continue; }
            if (!/\.(ts|tsx)$/.test(name)) continue;
            const text = fs.readFileSync(full, 'utf8');
            if (/deathLore\s*:/.test(text)) offenders.push(path.relative(root, full));
        }
    };
    walk(root);
    assert.deepEqual(offenders.sort(), [
        'data/messages.ts',
        // QA 시드(`injectRunSummary`)는 장부(`stats.deathLore`)가 아니라 사망 요약의 증언 view(`RunSummary.deathLore`)를 싣는다 —
        // 저장되지 않는 표시 값이고 e2e가 새 증언 / 이미 들은 증언 두 상태를 그리게 한다(명세 §4.2).
        'hooks/useGameTestApi.ts',
        'reducers/handlers/combatHandlers.ts',
        'utils/permanentProgress.ts',
    ].sort());
});

test('사망 화면: 증언 칸은 새 증언 / 이미 들은 증언과 모은 수를 그리고, 증언이 없으면 칸이 없다', () => {
    const summary = clone(defeat(dyingState()).runSummary);
    const html = renderStatic(createElement(RunSummaryCard, { runSummary: summary }));
    assert.match(html, /data-testid="run-summary-death-lore"/);
    assert.match(html, /data-lore-new="true"/);
    assert.match(html, /새 증언/);
    assert.match(html, />1\/46</);
    assert.ok(html.includes(DEATH_LORE.find((e) => e.id === 'c1-f1').text));

    const known = renderStatic(createElement(RunSummaryCard, { runSummary: { ...summary, deathLore: { ...summary.deathLore, isNew: false } } }));
    assert.match(known, /이미 들은 증언/);
    const none = renderStatic(createElement(RunSummaryCard, { runSummary: { ...summary, deathLore: null } }));
    assert.doesNotMatch(none, /run-summary-death-lore/);
});
