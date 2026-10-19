import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { buildRunSummary } from '../src/utils/gameUtils.js';
import { normalizeClassJourneyLedger } from '../src/utils/classJourney.js';
import { JOURNEY_RESET_SURFACE, getJourneySurfaceText } from '../src/utils/journeyScope.js';
import { getSignatureDiscoveryProgress, isSignatureDiscovered } from '../src/utils/signatureDiscovery.js';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 109 — 사망 · 다시 시작 · 계승 화면이 말하는 "남는 것 / 새로 시작하는 것"은 실제 전이와 같아야 한다.
 *
 * Wave 108이 초기화 범위를 바꾼 뒤에도 사망 화면은 "승천 단계와 칭호·도감 기록은 다음 모험에도 이어집니다", 다시 시작
 * 확인은 "그대로 보존: … 도감과 누적 기록", 계승 화면은 "… 칭호 · 업적과 누적 기록 …", 진 엔딩은 "수령 기록은 영구
 * 보존"이라고 말했다. 이제 화면은 `JOURNEY_RESET_SURFACE`의 라벨만 그리고, 이 계약이 항목마다 실제 전이
 * (`handleDefeat` · `RESET_GAME` · `ASCEND`)로 약속을 확인한다 — 표에 항목을 옮기면 이 테스트가 그 약속을 다시 잰다.
 */

const NOW = 1_700_000_000_000;
const clone = (value) => structuredClone(value);
const GRAVE = { loc: '고요한 숲', gold: 321, items: ['녹슨 단검'], timestamp: NOW - 1000 };
// 2026-10 Wave 125: 전설 각인 발견은 사망에도 남는다(도감 무기 칸은 비워진다).
const SURFACE_SIGNATURE = '성검 에테르니아';

const veteran = () => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '약속 검증', job: '전사', level: 40, hp: 800, maxHp: 800, mp: 200, maxMp: 200, atk: 200, def: 80, gold: 5000,
        inv: [{ id: 'surface-blade', name: '약속의 검', type: 'weapon', tier: 3, val: 40, price: 900 }],
        equip: { ...base.equip, weapon: { id: 'surface-blade-equipped', name: '약속의 검', type: 'weapon', tier: 3, val: 40, price: 900 } },
        relics: [{ id: 'r_surface', name: '시험 유물', effect: 'atk_mult', val: 1.1, rarity: 'common' }],
        quests: [{ id: 81, progress: 0 }],
        eventChainProgress: { ancient_seal: 2 },
        titles: ['first_blood', 'cartographer', 'reborn'],
        premiumCurrency: 77,
        settings: { readabilityMode: 'large', equipmentDetailMode: 'full' },
        classJourney: normalizeClassJourneyLedger({ byJob: { 전사: { expeditionIds: ['exp-a'], bestLevel: 40 } } }),
        activeExpedition: { id: 'exp-live', startedAt: NOW - 5000, loc: '고요한 숲' },
        seasonPass: { ...(base.seasonPass || {}), tier: 12, xp: 345 },
        meta: {
            ...base.meta, prestigeRank: 1, essence: 4321, bonusAtk: 9, mirror: { start_gold: 2, revive: 1 },
            endgame: { lastEndgameReceiptKey: 'dk-surface' },
        },
        stats: {
            ...base.stats,
            kills: 900, deaths: 12, demonKingSlain: 1,
            claimedQuestIds: [80],
            visitedMaps: ['시작의 마을', '고요한 숲', '버려진 광산'],
            codex: { ...base.stats.codex, monsters: { 슬라임: true }, weapons: { [SURFACE_SIGNATURE]: { discovered: true } } },
            codexBonusAtk: 3, codexBonusDef: 2, codexBonusHp: 15,
            claimedAchievements: ['ach_first_blood', 'ach_die_1'],
            ruleConquestRuleIds: ['worldtree_pilgrimage'],
        },
    };
};

const TRANSITIONS = {
    death: (before) => ({
        player: CombatEngine.handleDefeat(before, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer,
        grave: null,
    }),
    reset: (before) => {
        const state = gameReducer({ ...clone(INITIAL_STATE), bootStage: 'ready', player: before, grave: GRAVE }, { type: AT.RESET_GAME });
        return { player: state.player, grave: state.grave };
    },
    ascension: (before) => {
        const state = gameReducer(
            { ...clone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player: before, grave: GRAVE },
            { type: AT.ASCEND, payload: { expectedPrestigeRank: 1, sourceReceiptKey: 'dk-surface', seed: 1, challengeModifiers: [] } },
        );
        return { player: state.player, grave: state.grave };
    },
};

// 항목마다 "남았다" · "새로 시작했다"를 실제 값으로 판정한다. 남았다는 것은 줄지 않았다는 뜻이다(계승은 단계 +1 · 보상 정수를 더한다).
const KEPT = {
    essenceGrowth: (b, a) => a.meta.essence >= b.meta.essence && JSON.stringify(a.meta.mirror) === JSON.stringify(b.meta.mirror),
    prestigeLedger: (b, a) => a.meta.prestigeRank >= b.meta.prestigeRank
        && b.stats.ruleConquestRuleIds.every((id) => (a.stats.ruleConquestRuleIds || []).includes(id))
        && a.stats.deaths >= b.stats.deaths && a.stats.demonKingSlain >= b.stats.demonKingSlain,
    classJourney: (b, a) => JSON.stringify(a.classJourney) === JSON.stringify(b.classJourney),
    settings: (b, a) => JSON.stringify(a.settings) === JSON.stringify(b.settings),
    seasonPass: (b, a) => a.seasonPass.tier === b.seasonPass.tier && a.seasonPass.xp >= b.seasonPass.xp,
    crystals: (b, a) => a.premiumCurrency >= b.premiumCurrency,
    codex: (b, a) => Boolean(a.stats.codex?.monsters?.슬라임) && a.stats.codexBonusHp === b.stats.codexBonusHp
        && a.stats.visitedMaps.includes('버려진 광산'),
    unrecoveredGraves: (b, a, grave) => JSON.stringify(grave) === JSON.stringify(GRAVE),
    signatureCollection: (b, a) => isSignatureDiscovered(SURFACE_SIGNATURE, a) && getSignatureDiscoveryProgress(a).discovered === 1,
};
const RESET = {
    level: (b, a) => a.level === 1,
    gear: (b, a) => !(a.inv || []).some((item) => item.id === 'surface-blade') && a.equip?.weapon?.id !== 'surface-blade-equipped',
    relics: (b, a) => (a.relics || []).length === 0,
    questsStory: (b, a) => (a.stats.claimedQuestIds || []).length === 0 && !(a.quests || []).some((q) => q.id === 81)
        && !a.eventChainProgress?.ancient_seal,
    journeyTitles: (b, a) => !a.titles.includes('first_blood') && !(a.stats.claimedAchievements || []).includes('ach_first_blood'),
    codex: (b, a) => !a.stats.codex?.monsters?.슬라임 && !a.stats.codex?.weapons?.[SURFACE_SIGNATURE]
        && a.stats.codexBonusHp === 0 && !a.stats.visitedMaps.includes('버려진 광산'),
    activeExpedition: (b, a) => !a.activeExpedition,
};

test('표: 한 종류 안에서 남는 것과 새로 시작하는 것은 겹치지 않고, 모든 항목은 판정을 가진다', () => {
    for (const [kind, surface] of Object.entries(JOURNEY_RESET_SURFACE)) {
        for (const item of surface.kept) assert.ok(!surface.reset.includes(item), `${kind}: ${item}`);
        for (const item of surface.kept) assert.ok(item in KEPT, `${kind} 남는 것 ${item}의 판정`);
        for (const item of surface.reset) assert.ok(item in RESET, `${kind} 새로 시작 ${item}의 판정`);
        for (const item of [...surface.kept, ...surface.reset]) assert.ok(MSG.JOURNEY_ITEM_LABELS[item], `${item}의 라벨`);
        // 빠뜨림도 약속이다 — 화면에서 사라진 항목은 플레이어가 남는지 잃는지 알 수 없다. 사망은 새 유해를 남기므로
        // '회수하지 못한 유해'만 사망 표에 없다.
        const listed = new Set([...surface.kept, ...surface.reset]);
        for (const item of Object.keys(MSG.JOURNEY_ITEM_LABELS)) {
            if (kind === 'death' && item === 'unrecoveredGraves') continue;
            assert.ok(listed.has(item), `${kind}: "${MSG.JOURNEY_ITEM_LABELS[item]}"이 남는 것에도 새로 시작하는 것에도 없다`);
        }
    }
});

for (const [label, transition, kind] of [['사망', TRANSITIONS.death, 'death'], ['다시 시작', TRANSITIONS.reset, 'death'], ['계승', TRANSITIONS.ascension, 'ascension']]) {
    test(`${label}: 화면이 말하는 남는 것 · 새로 시작하는 것이 실제 전이와 같다`, () => {
        const before = veteran();
        const { player: after, grave } = transition(clone(before));
        const surface = JOURNEY_RESET_SURFACE[kind];
        for (const item of surface.kept) {
            if (item === 'unrecoveredGraves' && grave === null) continue;
            assert.ok(KEPT[item](before, after, grave), `${label}: "${MSG.JOURNEY_ITEM_LABELS[item]}"이 남는다고 말하지만 남지 않았다`);
        }
        for (const item of surface.reset) {
            assert.ok(RESET[item](before, after, grave), `${label}: "${MSG.JOURNEY_ITEM_LABELS[item]}"을 새로 시작한다고 말하지만 남았다`);
        }
    });
}

test('사망 화면은 사망의 표를 그린다', () => {
    const before = veteran();
    const html = renderStatic(createElement(RunSummaryCard, { runSummary: buildRunSummary(before, before.loc), onRestart: () => {} }));
    assert.ok(html.includes(MSG.JOURNEY_KEPT_LINE(getJourneySurfaceText('death', 'kept'))));
    assert.ok(html.includes(MSG.JOURNEY_RESET_LINE(getJourneySurfaceText('death', 'reset'))));
    assert.ok(!html.includes('칭호·도감 기록은 다음 모험에도'), '사망은 칭호 · 도감을 비운다');
});

test('계승 화면은 계승의 표를 그린다', () => {
    const html = renderStatic(createElement(AscensionScreen, { player: veteran() }));
    assert.ok(html.includes(getJourneySurfaceText('ascension', 'kept')));
    assert.ok(html.includes(getJourneySurfaceText('ascension', 'reset')));
});

// 부재 불변식: 화면에 손으로 적은 이전 약속이 되돌아오지 않는다(식별자 수준 — 문구 그대로).
test('이전 약속 문구가 컴포넌트에 되돌아오지 않는다', async () => {
    const dir = new URL('../src/components/', import.meta.url);
    const files = (await readdir(dir, { recursive: true })).filter((name) => name.endsWith('.tsx'));
    const stale = ['칭호·도감 기록은 다음 모험에도', '도감과 누적 기록', '칭호 · 업적과 누적 기록', '수령 기록은 영구 보존', '영구 성장과 기록은 보존합니다'];
    for (const name of files) {
        const source = await readFile(new URL(name, dir), 'utf8');
        for (const phrase of stale) assert.ok(!source.includes(phrase), `${name}: ${phrase}`);
    }
});
