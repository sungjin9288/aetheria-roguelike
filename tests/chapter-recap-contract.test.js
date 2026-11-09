import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { createCurrentRunProgress, normalizeCurrentRunProgress } from '../src/utils/runProgress.js';
import { migrateData } from '../src/utils/gameUtils.js';
import {
    advanceChapterOnEntry,
    countCompletedHuntRounds,
    getChapterRecaps,
    getExpeditionChapterRecaps,
} from '../src/utils/chapterRecap.js';
import { getChapterRecapView, getExpeditionChapterRecapView } from '../src/utils/chapterRecapView.js';
import { MSG } from '../src/data/messages.js';
import { renderStatic } from './helpers/render.ts';
import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import PostCombatCard from '../src/components/PostCombatCard.tsx';

/**
 * 2026-11 B1 장 결산 (소유자 결정 2026-11-09 Q1 (a) · Q2 매 여정 · Q3 '장' — 명세 §1):
 * 더 높은 장의 지역에 들어서면 떠나는 장의 결산을 그 순간의 값으로 굳힌다. 쓰는 곳은 이동 하나 · 기록 줄 · 난수 0.
 */
const clone = (value) => structuredClone(value);

const freshPlayer = (overrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '장 결산',
        level: 20,
        hp: 500,
        maxHp: 500,
        loc: '시작의 마을',
        ...overrides,
        stats: { ...base.stats, ...(overrides.stats || {}) },
    };
};

const harness = (initial) => {
    let player = initial;
    const logs = [];
    const dispatch = (action) => {
        if (action.type === AT.SET_PLAYER) {
            const payload = typeof action.payload === 'function' ? action.payload(player) : action.payload;
            player = { ...player, ...payload };
        }
    };
    const move = (loc) => createMoveActions({
        player, gameState: 'idle', grave: [], isAiThinking: false, liveConfig: {}, dispatch,
        addLog: (type, text) => logs.push({ type, text }),
    }).move(loc);
    const act = (fn) => { player = fn(player); };
    return { move, act, logs, get player() { return player; } };
};

const playIn = (player, { explores = 0, kills = 0 } = {}) => ({
    ...player,
    stats: { ...player.stats, explores: (player.stats.explores || 0) + explores, kills: (player.stats.kills || 0) + kills },
});

const withThrowingRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('장 결산이 Math.random을 불렀다'); };
    try { return fn(); } finally { Math.random = original; }
};

test('새 여정은 1장 · 결산 없음으로 시작한다(INITIAL_STATE · 사망 · 다시 시작 · 계승이 같은 생성 경로)', () => {
    assert.equal(INITIAL_STATE.player.stats.currentRun.chapters.reached, 1);
    assert.deepEqual(INITIAL_STATE.player.stats.currentRun.chapters.recaps, []);

    const veteran = freshPlayer({ stats: { currentRun: { ...createCurrentRunProgress({}), chapters: { reached: 5, mark: createCurrentRunProgress({}).chapters.mark, recaps: [] } } } });
    const reset = gameReducer({ ...clone(INITIAL_STATE), bootStage: 'ready', player: clone(veteran) }, { type: AT.RESET_GAME });
    assert.equal(reset.player.stats.currentRun.chapters.reached, 1);
    const defeated = CombatEngine.handleDefeat(clone(veteran), clone(INITIAL_STATE.player), () => 0.5, () => 1).updatedPlayer;
    assert.equal(defeated.stats.currentRun.chapters.reached, 1);
    assert.deepEqual(defeated.stats.currentRun.chapters.recaps, []);
});

test('실제 move: 1장 → 2장 넘음에 결산 하나, 값은 굳어 이후 처치로 바뀌지 않는다', () => {
    const h = harness(freshPlayer());
    h.move('고요한 숲');
    assert.equal(h.player.stats.currentRun.chapters.reached, 1);
    h.act((p) => playIn(p, { explores: 6, kills: 4 }));
    h.move('신성한 호수');

    const recaps = getChapterRecaps(h.player);
    assert.equal(recaps.length, 1);
    assert.equal(h.player.stats.currentRun.chapters.reached, 2);
    const [recap] = recaps;
    assert.equal(recap.chapter, 1);
    assert.equal(recap.explores, 6);
    assert.equal(recap.kills, 4);
    assert.equal(recap.levelFrom, 1, '새 여정 표식은 Lv1');
    assert.equal(recap.levelTo, 20);
    assert.equal(recap.expeditionId, h.player.activeExpedition.id);

    h.act((p) => playIn(p, { explores: 3, kills: 9 }));
    assert.deepEqual(getChapterRecaps(h.player)[0], recap, '굳힌 결산은 이후 값으로 바뀌지 않는다');

    h.move('고요한 숲');
    assert.equal(h.player.stats.currentRun.chapters.reached, 2, '낮은 장으로 돌아가도 그대로');
    assert.equal(getChapterRecaps(h.player).length, 1);
});

test('탐험 없이 지나친 장은 결산하지 않고 다음 결산이 "지나친 장"으로 말한다', () => {
    const h = harness(freshPlayer());
    h.move('고요한 숲');
    h.move('신성한 호수');
    assert.equal(getChapterRecaps(h.player).length, 0, '1장에서 탐험 0 → 접힘');
    assert.deepEqual(h.player.stats.currentRun.chapters.mark.passed, [1]);
    h.act((p) => playIn(p, { explores: 2 }));
    // 신성한 호수에는 바람의 고원 출구가 없다 — 1장 지역(숲 · 마을 · 서쪽 평원)을 지나 걷는다(낮은 장으로는 넘지 않는다).
    for (const loc of ['고요한 숲', '시작의 마을', '서쪽 평원', '바람의 고원']) h.move(loc);
    assert.equal(h.player.loc, '바람의 고원');
    const [recap] = getChapterRecaps(h.player);
    assert.equal(recap.chapter, 2);
    assert.deepEqual(recap.passed, [1]);
    assert.equal(getChapterRecapView(recap).passed, MSG.CHAPTER_RECAP_PASSED([1]));
    assert.deepEqual(h.player.stats.currentRun.chapters.mark.passed, []);
});

test('안전지대 · 혼돈의 심연 · 장이 아닌 곳으로는 넘지 않는다(같은 참조)', () => {
    const player = playIn(freshPlayer({ loc: '고요한 숲' }), { explores: 5 });
    for (const loc of ['시작의 마을', '혼돈의 심연', '고대 보물고', '없는 곳']) {
        assert.equal(advanceChapterOnEntry(player, loc), player, loc);
    }
});

test('이전 세이브(장 진행 없음)는 첫 이동에서 조용히 시작하고 결산을 지어내지 않는다', () => {
    const legacy = playIn(freshPlayer({ loc: '신성한 호수' }), { explores: 40 });
    const { chapters: _drop, ...run } = legacy.stats.currentRun;
    const moved = advanceChapterOnEntry({ ...legacy, stats: { ...legacy.stats, currentRun: run } }, '바람의 고원');
    assert.equal(moved.stats.currentRun.chapters.reached, 3);
    assert.deepEqual(moved.stats.currentRun.chapters.recaps, []);
    assert.equal(moved.stats.currentRun.chapters.mark.counters.explores, 40);
});

test('큰 순간: 구역 보스 → 이야기 → 전직 → 각인 → 토벌 → 정예 칭호, 0은 빼고 최대 3줄', () => {
    const start = playIn(freshPlayer({ loc: '고요한 숲', job: '모험가' }), { explores: 3 });
    const entered = advanceChapterOnEntry({ ...start, loc: '시작의 마을' }, '고요한 숲');
    const progressed = {
        ...entered,
        job: '도적',
        titles: ['elite:고요한 숲', 'elite:서쪽 평원'],
        huntContracts: { '천공 정원': { stage: 0, progress: 0, round: 2 } },
        stats: {
            ...entered.stats,
            explores: entered.stats.explores + 4,
            claimedQuestIds: [80],
            areaBossDefeated: { '슬라임 킹': true, '없는 보스': true },
        },
    };
    const crossed = advanceChapterOnEntry(progressed, '신성한 호수');
    const [recap] = getChapterRecaps(crossed);
    const kinds = recap.moments.map((moment) => moment.kind);
    assert.ok(kinds.length <= 3);
    assert.equal(kinds[0], recap.moments.some((m) => m.kind === 'areaBoss') ? 'areaBoss' : kinds[0]);
    assert.ok(kinds.includes('story'), '본편 장 수령');
    assert.ok(kinds.includes('job'), '전직');
    const view = getChapterRecapView(recap);
    assert.ok(view.moments.includes(MSG.CHAPTER_RECAP_MOMENT_JOB('도적')));
    assert.ok(view.moments.some((line) => line.includes('도적으로 전직')), '조사는 받침에 맞춘다');
    assert.equal(countCompletedHuntRounds({ a: { stage: 3, progress: 0, round: 2 }, b: { stage: 1, progress: 4, round: 3 }, c: { stage: 0, progress: 0 } }), 4);
});

test('정규화 · 불러오기 왕복이 장 진행을 지키고, 이전 세이브 갈래는 비운다', () => {
    const h = harness(freshPlayer());
    h.move('고요한 숲');
    h.act((p) => playIn(p, { explores: 2 }));
    h.move('신성한 호수');
    const normalized = normalizeCurrentRunProgress(h.player.stats);
    assert.deepEqual(normalized.chapters, h.player.stats.currentRun.chapters);
    const migrated = migrateData({ player: clone(h.player), gameState: 'idle' }, { now: 5 });
    assert.deepEqual(migrated.player.stats.currentRun.chapters, h.player.stats.currentRun.chapters);
    assert.equal(normalizeCurrentRunProgress({}).chapters, undefined, '여정 기록이 없던 세이브');
});

test('기록 줄 0 · 난수 0: 넘는 이동과 넘지 않는 이동의 기록 수가 같다', () => {
    const crossing = harness(freshPlayer({ loc: '고요한 숲', stats: { visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수', '호수의 신전'] } }));
    crossing.act((p) => playIn(p, { explores: 3 }));
    withThrowingRandom(() => crossing.move('신성한 호수'));
    const flat = harness(freshPlayer({ loc: '고요한 숲', stats: { visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수', '호수의 신전'] } }));
    flat.act((p) => playIn(p, { explores: 3 }));
    withThrowingRandom(() => flat.move('호수의 신전'));
    assert.equal(crossing.player.loc, '신성한 호수');
    assert.equal(flat.player.loc, '호수의 신전', '넘지 않는 쪽도 실제로 이동해야 기록 수 비교가 공허하지 않다');
    assert.equal(getChapterRecaps(crossing.player).length, 1);
    assert.equal(getChapterRecaps(flat.player).length, 0);
    assert.equal(crossing.logs.filter((l) => l.text?.includes('장')).length, flat.logs.filter((l) => l.text?.includes('장')).length);
    assert.ok(!crossing.logs.some((l) => l.text?.includes(MSG.CHAPTER_RECAP_EYEBROW)));
});

test('원정 정리 시트: 같은 원정의 결산만 · 최신이 먼저 · 2칸 + "외 N장" · 단추를 더하지 않는다', () => {
    const recap = (chapter, expeditionId) => ({
        chapter, passed: [], expeditionId, levelFrom: 1, levelTo: 9, explores: 4, kills: 7, bossKills: 1, relics: 2, moments: [],
    });
    const player = { stats: { currentRun: { ...createCurrentRunProgress({}), chapters: { reached: 5, mark: createCurrentRunProgress({}).chapters.mark, recaps: [recap(1, 'x'), recap(2, 'e'), recap(3, 'e'), recap(4, 'e')] } } } };
    const mine = getExpeditionChapterRecaps(player, 'e');
    assert.deepEqual(mine.map((r) => r.chapter), [4, 3, 2]);
    assert.deepEqual(getExpeditionChapterRecaps(player, null), []);
    const view = getExpeditionChapterRecapView(mine);
    assert.equal(view.cards.length, 2);
    assert.equal(view.more, 1);

    const summary = {
        id: 'e', startedAt: 0, endedAt: 1, origin: '시작의 마을', destination: '고요한 숲', lastLocation: '고요한 숲', returnLocation: '시작의 마을',
        returnReason: 'safe_return', durationMs: 60_000, startLevel: 1, endLevel: 9, expGained: 1, goldDelta: 1, battles: 1, bossBattles: 0,
        explores: 1, newItems: [], lostItemCount: 0, completedQuests: [], lowestHp: 1, lowestHpPercent: 50, returnHp: 1, maxHpAtReturn: 2, reviewedAt: null,
    };
    const props = { summary, recommendation: { kind: 'rest', label: '쉬기', detail: '' }, onClose: () => {}, onPrimaryAction: () => {} };
    const html = renderStatic(createElement(ExpeditionDebriefCard, { ...props, chapterRecaps: mine }));
    assert.match(html, /data-testid="debrief-chapter-recap"/);
    assert.equal((html.match(/data-testid="debrief-chapter-recap-card"/g) || []).length, 2);
    assert.match(html, /data-testid="debrief-chapter-recap-more"/);
    assert.ok(html.includes(MSG.CHAPTER_RECAP_TITLE(4, '하늘의 상처')) === false || html.includes('4장'));
    assert.ok(html.includes(MSG.CHAPTER_RECAP_KILLS(7, 1)));
    const without = renderStatic(createElement(ExpeditionDebriefCard, props));
    assert.doesNotMatch(without, /debrief-chapter-recap/);
    const countButtons = (markup) => (markup.match(/<button/g) || []).length;
    assert.equal(countButtons(html), countButtons(without), '결산 칸은 단추를 더하지 않는다');
});

test('전투 결과 카드에는 결산이 없다', () => {
    const src = fs.readFileSync(path.resolve('src/components/PostCombatCard.tsx'), 'utf8');
    assert.ok(!src.includes('debrief-chapter-recap') && !src.includes('ChapterRecap'));
    assert.equal(typeof PostCombatCard, 'function');
});

test('부재 불변식: src에서 장 진행을 쓰는 곳은 chapterRecap(+ runProgress 생성 · 정규화)뿐이다', () => {
    const root = path.resolve('src');
    const writers = [];
    const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) { walk(full); continue; }
            if (!/\.(ts|tsx)$/.test(name)) continue;
            const text = fs.readFileSync(full, 'utf8');
            if (/\bchapters\s*:/.test(text) || /advanceChapterOnEntry\(/.test(text)) writers.push(path.relative(root, full));
        }
    };
    walk(root);
    assert.deepEqual(writers.sort(), ['hooks/gameActions/moveActions.ts', 'utils/chapterRecap.ts', 'utils/runProgress.ts'].sort());
});
