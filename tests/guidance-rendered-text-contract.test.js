import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { getAdventureGuidance, getExpeditionPreparation, getMoveRecommendations, getQuestTracker } from '../src/utils/adventureGuide.js';
import { getTownActionPresentation } from '../src/utils/townActionPresentation.js';
import { SIGNATURE_PITY } from '../src/utils/signaturePity.js';
import { BAG_RECIPES } from '../src/data/bagRecipes.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { GS } from '../src/reducers/gameStates.js';
import ControlPanel from '../src/components/ControlPanel.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 136 (원장 §150, 소유자 결정 "지우기"): 안내가 만드는 글은 화면이 그리는 곳에서만 만든다.
 *
 * 통합 수용 7차(§149.5)가 안전지대 안내의 제목 · 이유가 화면에 한 번도 그려지지 않는다는 것을 찾았다 — 조작판의 안내 줄
 * (`adventure-guidance-strip`)은 대기 상태 · 안전지대 밖 · 임무 추적 없음에서만 그려지고, 마을은 안내의 행동 종류만 쓴다.
 * 그 문장을 Wave 62(첫 출발 금액) · Wave 134(공명 줄의 영어)가 고쳤다. 같은 이유로 그리지 않던 것:
 * 임무 추적이 있을 때의 제목 · 이유, 행동 라벨 전부, 경로 추천 · 탐험 예보의 영어 칩, 원정 준비의 읽는 곳 없는 여섯 칸 · 귀환 조건 문구.
 * 전설 각인 공명 갈래는 이유 없이 단추만 남아, 사망 뒤 Lv1 재시작에서 임무 게시판 대신 시작 지역 출발을 가리켰다
 * (자연 플레이 마을 도착의 0.8%) — 공명 수치는 보스가 나타날 때 기록 줄(`MSG.SIGNATURE_PITY_RESONANCE`)이 말한다.
 */

const TOWN = DB.MAPS['시작의 마을'];
const FIELD = DB.MAPS['고요한 숲'];
const RUNTIMES = [GS.IDLE, GS.COMBAT, GS.MOVING, GS.SHOP, GS.ASCENSION];
const PITY_HIGH = SIGNATURE_PITY.THRESHOLD * 3;

const material = (name, index) => ({ ...structuredClone(DB.ITEMS.materials.find((entry) => entry.name === name)), id: `w136_${name}_${index}` });
const bagRecipe = BAG_RECIPES[0];
const recipeMaterials = bagRecipe.inputs.flatMap((input) => Array.from({ length: input.qty }, (_, index) => material(input.name, index)));
const filler = (count) => Array.from({ length: count }, (_, index) => material('슬라임 젤리', 100 + index));

const player = (overrides = {}) => {
    const base = makePlayerFixture({ name: '안내', job: '전사', level: 10, gold: 5_000, quests: [], status: [], inv: [] });
    return { ...base, hp: base.maxHp, mp: base.maxMp, ...overrides, stats: { ...base.stats, kills: 50, explores: 80, ...overrides.stats } };
};

// 갈래마다 하나 — 마을에서 기대하는 행동 종류와 함께(이전 갈래 순서 그대로, 공명 갈래만 빠졌다).
const CASES = [
    ['첫 원정', player({ job: '모험가', level: 1, stats: { kills: 0, explores: 0 } }), { kind: 'open_move', firstSortie: true }],
    ['전직 준비', player({ job: '모험가', level: 5 }), { kind: 'open_class' }],
    ['낮은 생명', player({ hp: 10 }), { kind: 'rest' }],
    ['낮은 생명 · 휴식 비용 없음', player({ hp: 10, gold: 0 }), { kind: 'open_quest_board' }],
    ['상태이상', player({ status: ['poison'] }), { kind: 'rest' }],
    ['가방 거의 참', player({ inv: filler(19) }), { kind: 'open_inventory' }],
    ['가방 제작 가능', player({ inv: [...recipeMaterials, ...filler(19 - recipeMaterials.length)] }), { kind: 'open_crafting' }],
    ['진행 중인 임무', player({ quests: [{ id: 1, progress: 0 }] }), { kind: 'open_move' }],
    ['받을 임무 보상', player({ quests: [{ id: 1, progress: 3 }] }), { kind: 'claim_quest' }],
    ['임무 없음', player(), { kind: 'open_quest_board' }],
    ['사망 뒤 Lv1 재시작', player({ job: '모험가', level: 1, stats: { kills: 120, explores: 300 } }), { kind: 'open_quest_board' }],
];
const withPity = (p, pity) => ({ ...p, stats: { ...p.stats, signaturePity: pity } });

test('[표면] 제목 · 이유는 안내 줄이 그리는 곳 — 대기 상태 · 안전지대 밖 · 임무 추적 없음 — 에서만 만든다', () => {
    let rendered = 0;
    let silent = 0;
    for (const [label, p] of CASES) {
        for (const pity of [0, PITY_HIGH]) {
            for (const map of [TOWN, FIELD, null]) {
                for (const runtime of RUNTIMES) {
                    const subject = withPity(p, pity);
                    const guidance = getAdventureGuidance(subject, null, map, runtime);
                    const drawn = runtime === GS.IDLE && map?.type !== 'safe' && !getQuestTracker(subject);
                    const where = `${label} · 공명 ${pity} · ${map?.type ?? '지역 없음'} · ${runtime}`;
                    assert.equal('title' in guidance, drawn, `${where}: 제목`);
                    assert.equal('detail' in guidance, drawn, `${where}: 이유`);
                    if (drawn) {
                        assert.ok(guidance.title.length > 0 && guidance.detail.length > 0, where);
                        rendered += 1;
                    } else {
                        silent += 1;
                    }
                    if (guidance.primaryAction) assert.deepEqual(Object.keys(guidance.primaryAction).filter((key) => key !== 'firstSortie'), ['kind'], `${where}: 행동 라벨 없음`);
                }
            }
        }
    }
    // 공허참 방지 — 두 쪽 모두 실제로 지났다.
    assert.ok(rendered >= 10 && silent >= 100, `rendered ${rendered} · silent ${silent}`);
});

test('[마을] 마을의 안내는 행동 종류만이고, 종류는 이전 갈래 그대로다', () => {
    for (const [label, p, expected] of CASES) {
        assert.deepEqual(getAdventureGuidance(p, null, TOWN, GS.IDLE), { primaryAction: expected }, label);
    }
});

test('[공명] 전설 각인 공명은 안내 · 마을 단추를 바꾸지 않는다', () => {
    for (const [label, p] of CASES) {
        for (const map of [TOWN, FIELD]) {
            assert.deepEqual(
                getAdventureGuidance(withPity(p, PITY_HIGH), null, map, GS.IDLE),
                getAdventureGuidance(withPity(p, 0), null, map, GS.IDLE),
                `${label} · ${map.type}`,
            );
        }
    }
    // 측정이 짚은 경우: 공명이 쌓인 채 죽어 Lv1로 다시 시작한 마을 — 공명이 없을 때와 같은 '임무 고르기'다.
    const restart = CASES.find(([label]) => label === '사망 뒤 Lv1 재시작')[1];
    const primary = (subject) => {
        const guidance = getAdventureGuidance(subject, null, TOWN, GS.IDLE);
        const preparation = getExpeditionPreparation(subject, null, TOWN, DB.MAPS);
        return getTownActionPresentation({
            player: subject, mapData: TOWN, stats: { maxHp: subject.maxHp, maxMp: subject.maxMp }, guidance, preparation,
            hasGrave: false, classes: DB.CLASSES, recipes: DB.ITEMS.recipes || [], consumables: DB.ITEMS.consumables || [],
        }).primary;
    };
    assert.deepEqual(primary(withPity(restart, PITY_HIGH)), primary(withPity(restart, 0)));
    assert.equal(primary(withPity(restart, PITY_HIGH)).label, '임무 고르기');
});

test('[칸] 경로 추천 · 원정 준비는 화면이 읽는 칸만 낸다 — 새 칸은 그리는 곳과 함께 더할 것', () => {
    const routeKeys = ['badge', 'isRecommended', 'levelLabel', 'name', 'reason', 'routePlan'];
    let routes = 0;
    for (const [mapName, map] of Object.entries(DB.MAPS)) {
        for (const route of getMoveRecommendations(player({ loc: mapName }), null, map, DB.MAPS)) {
            assert.deepEqual(Object.keys(route).sort(), routeKeys, `${mapName} → ${route.name}`);
            assert.deepEqual(Object.keys(route.routePlan).sort(), ['approach', 'returnLabel'], `${mapName} → ${route.name}`);
            routes += 1;
        }
    }
    assert.ok(routes > 100, `경로 ${routes}개`);
    for (const [label, p] of CASES) {
        const preparation = getExpeditionPreparation({ ...p, loc: '시작의 마을' }, null, TOWN, DB.MAPS);
        assert.deepEqual(Object.keys(preparation).sort(), ['canDepart', 'departure', 'destination', 'goalLabel', 'isClaimable', 'readinessLabel', 'tracker'], label);
    }
});

test('[MSG] 그려지지 않던 안내 문구는 MSG에도 없다', () => {
    for (const key of ['GUIDE_SIGNATURE_PITY_DETAIL', 'GUIDE_FIRST_SORTIE_DETAIL', 'GUIDE_BAG_UPGRADE_TITLE', 'GUIDE_BAG_UPGRADE_DETAIL', 'GUIDE_BAG_UPGRADE_ACTION']) {
        assert.equal(key in MSG, false, key);
    }
});

test('[렌더] 안내가 만든 글은 조작판이 실제로 그린다 — 필드에서는 안내 줄, 마을에서는 안내 글이 없다', () => {
    const render = (subject) => renderStatic(createElement(ControlPanel, {
        gameState: GS.IDLE, player: subject, enemy: null, actions: new Proxy({}, { get: () => () => {} }), setGameState: () => {},
        shopItems: [], grave: null, isAiThinking: false, currentEvent: null, stats: null, onOpenArchiveConsole: () => {},
    }));
    const fieldPlayer = player({ loc: '고요한 숲' });
    const fieldGuidance = getAdventureGuidance(fieldPlayer, null, FIELD, GS.IDLE);
    const fieldHtml = render(fieldPlayer);
    assert.ok(fieldHtml.includes('data-testid="adventure-guidance-strip"'), '필드 안내 줄');
    assert.ok(fieldHtml.includes(fieldGuidance.title) && fieldHtml.includes(fieldGuidance.detail), '필드 안내 줄은 안내의 글을 그린다');

    for (const [label, p] of CASES) {
        const townHtml = render({ ...p, loc: '시작의 마을' });
        assert.ok(!townHtml.includes('data-testid="adventure-guidance-strip"'), `${label}: 마을에는 안내 줄이 없다`);
        assert.ok(townHtml.includes('data-testid="control-town-primary"'), `${label}: 마을 주 단추`);
    }
});
