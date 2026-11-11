import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { formatEventText } from '../src/utils/eventPresentation.js';
import {
    collectStorySceneLedger,
    getStorySceneExcerpt,
    isStorySceneSeen,
    readStorySceneLedger,
} from '../src/utils/storySceneLedger.js';
import ControlPanel from '../src/components/ControlPanel.tsx';
import EventPanel from '../src/components/EventPanel.tsx';
import { makePlayerFixture, renderStatic, sliceElementByTestId } from './helpers/render.ts';

/**
 * 2026-11 재미 분석 G2 (소유자 결정 Q4 "예"): 이야기 체인은 Wave 108부터 사망 · 계승마다 처음부터라 같은 장면의 글을 다시 읽는다.
 * 지난 여정에서 지나간 단계는 이벤트 화면의 '지금 상황'을 첫 문장으로 접고 '다시 읽기'로 편다 — 표시만(선택지 · 결과 · 진행 범위 그대로).
 * 장부 `stats.storySceneLedger`는 `pickPermanentPlayerState` 한 곳이 이번 여정의 체인 진행을 합친다.
 */

const NOW = Date.UTC(2026, 10, 10);
const clone = (value) => structuredClone(value);
const die = (player) => CombatEngine.handleDefeat(player, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
const restart = (player) => gameReducer({ ...clone(INITIAL_STATE), player }, { type: AT.RESET_GAME }).player;
const ascend = (player) => gameReducer(
    { ...clone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey, seed: 1, challengeModifiers: [] } },
).player;

const traveler = (extra = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '나그네', job: '전사', level: 50, loc: '마왕성', hp: 900, maxHp: 900, mp: 200, maxMp: 200,
    meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 1, endgame: { lastEndgameReceiptKey: 'rk-scene' } },
    ...extra,
});

const WIZARD = EVENT_CHAINS.find((chain) => chain.id === 'lost_wizard');
const stepEvent = (chain, step) => ({ ...chain.steps.find((s) => s.step === step).event, _chainId: chain.id, _chainStep: step });
const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} });

for (const [label, reset] of [['사망', die], ['다시 시작', restart], ['계승', ascend]]) {
    test(`G2 ${label}: 이번 여정의 체인 진행이 장부에 남고, 진행은 처음부터다 — 숫자가 아닌 진행 값은 건너뛴다`, () => {
        const player = traveler({
            eventChainProgress: { lost_wizard: 2, last_hero: 'failed', shadow_guild: 0 },
        });
        const after = reset(player);
        assert.deepEqual(after.stats.storySceneLedger, { lost_wizard: 2 });
        assert.equal(after.eventChainProgress?.lost_wizard ?? 0, 0, '진행은 여정 범위 그대로(Wave 108)');
        assert.equal(isStorySceneSeen(after, 'lost_wizard', 1), true);
        assert.equal(isStorySceneSeen(after, 'lost_wizard', 2), false, '닿기만 하고 지나지 않은 단계는 본 장면이 아니다');
        assert.equal(isStorySceneSeen(after, 'last_hero', 0), false, '실패한 체인은 어디까지 봤는지 모른다');
    });
}

test('G2: 장부는 체인마다 큰 값을 지킨다 — 다음 여정이 덜 가서 죽어도 줄지 않는다', () => {
    const first = die(traveler({ eventChainProgress: { lost_wizard: 3 } }));
    const second = die({ ...first, eventChainProgress: { lost_wizard: 1, last_hero: 2 } });
    assert.deepEqual(second.stats.storySceneLedger, { lost_wizard: 3, last_hero: 2 });
});

test('G2: 이야기를 지나지 않은 여정은 장부 칸을 만들지 않는다(세이브 모양 그대로)', () => {
    const after = die(traveler({ eventChainProgress: {} }));
    assert.equal('storySceneLedger' in after.stats, false);
});

test('G2: 모양이 틀린 장부 칸은 버린다', () => {
    assert.deepEqual(readStorySceneLedger({ a: 2, b: -1, c: 1.5, d: 'x', e: 0 }), { a: 2 });
    assert.deepEqual(readStorySceneLedger(['a']), {});
    assert.deepEqual(collectStorySceneLedger({ stats: { storySceneLedger: { a: 4 } }, eventChainProgress: { a: 2, b: 1 } }), { a: 4, b: 1 });
});

test('G2: 첫 문장 — 문장이 하나뿐이면 접을 것이 없다', () => {
    assert.equal(getStorySceneExcerpt('하나. 둘.'), '하나.');
    assert.equal(getStorySceneExcerpt('한 문장뿐입니다.'), null);
    assert.equal(getStorySceneExcerpt(''), null);
    const diary = formatEventText(stepEvent(WIZARD, 1).desc);
    assert.equal(getStorySceneExcerpt(diary), '수정에 끼인 낡은 일기장을 발견했습니다.');
});

test('G2: 모든 체인 이벤트 단계의 첫 문장은 전문보다 짧은 앞부분이다(접으면 실제로 줄어든다)', () => {
    for (const chain of EVENT_CHAINS) {
        for (const step of chain.steps) {
            if (!step.event?.desc) continue;
            const text = formatEventText(step.event.desc);
            const excerpt = getStorySceneExcerpt(text);
            if (excerpt === null) continue;
            assert.ok(text.startsWith(excerpt) && excerpt.length < text.length, `${chain.id}:${step.step}`);
        }
    }
});

test('G2 화면: 본 장면은 첫 문장으로 접히고 다시 읽기 단추가 있다 · 선택지는 그대로다', () => {
    const event = stepEvent(WIZARD, 1);
    const folded = renderStatic(createElement(EventPanel, { currentEvent: event, actions: NOOP_ACTIONS, sceneSeen: true }));
    const situation = sliceElementByTestId(folded, 'event-situation');
    assert.match(folded, /data-testid="event-situation" data-scene-folded="true"/);
    assert.match(situation, /수정에 끼인 낡은 일기장을 발견했습니다\./);
    assert.doesNotMatch(situation, /천공 정원에 있다/, '접힌 상태에서는 뒤 문장을 그리지 않는다');
    assert.match(folded, new RegExp(MSG.STORY_SCENE_SEEN));
    assert.match(sliceElementByTestId(folded, 'event-scene-reread'), new RegExp(MSG.STORY_SCENE_REREAD));
    assert.match(folded, /data-testid="event-scene-reread" aria-expanded="false"/);
    assert.match(folded, /data-testid="event-choice-0"/);
    assert.match(folded, /data-testid="event-choice-1"/);

    const fresh = renderStatic(createElement(EventPanel, { currentEvent: event, actions: NOOP_ACTIONS, sceneSeen: false }));
    assert.match(fresh, /data-testid="event-situation" data-scene-folded="false"/);
    assert.match(fresh, /천공 정원에 있다/);
    assert.doesNotMatch(fresh, /event-scene-reread/);
});

test('G2 화면: 이야기가 아닌 이벤트 · 한 문장 장면은 본 장면이어도 접지 않는다', () => {
    const plain = { title: '샘', desc: '맑은 샘이 있습니다. 물이 차갑습니다.', choices: ['마신다'], outcomes: [{ type: 'nothing', log: '...' }] };
    const html = renderStatic(createElement(EventPanel, { currentEvent: plain, actions: NOOP_ACTIONS, sceneSeen: true }));
    assert.doesNotMatch(html, /event-scene-reread/);
    const single = { ...stepEvent(WIZARD, 1), desc: '한 문장뿐입니다.' };
    assert.doesNotMatch(renderStatic(createElement(EventPanel, { currentEvent: single, actions: NOOP_ACTIONS, sceneSeen: true })), /event-scene-reread/);
});

test('G2 배선: 조작판은 장부로 접기를 정한다 — 지난 여정에서 지난 단계만', () => {
    const render = (ledger) => renderStatic(createElement(ControlPanel, {
        gameState: GS.EVENT,
        player: makePlayerFixture({ loc: '수정 동굴', stats: { ...makePlayerFixture().stats, storySceneLedger: ledger } }),
        enemy: null,
        actions: NOOP_ACTIONS,
        setGameState: () => {},
        shopItems: [],
        grave: null,
        isAiThinking: false,
        currentEvent: stepEvent(WIZARD, 1),
        stats: null,
        onOpenArchiveConsole: () => {},
    }));
    assert.match(render({ lost_wizard: 2 }), /data-scene-folded="true"/);
    assert.match(render({ lost_wizard: 1 }), /data-scene-folded="false"/);
    assert.match(render(undefined), /data-scene-folded="false"/);
});
