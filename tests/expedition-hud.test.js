import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StatusBar from '../src/components/StatusBar.tsx';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { DB } from '../src/data/db.js';
import { getProtocolDayKey } from '../src/utils/protocolCycle.js';
import {
    getAbyssDiveChip,
    getBossGaugeChip,
    getBossGaugeTicks,
    getExpeditionHudChips,
} from '../src/utils/expeditionHud.js';
import { getAbyssDailyDiveRemaining } from '../src/utils/abyssDailyDive.js';

/**
 * 2026-09 감사 G10 — 원정 가독성.
 *
 * 보스 접근 게이지는 MapNavigator의 *선택된* 목적지 카드에서만 보였고, 심연 데일리
 * 다이브는 TSX 소비처가 0건이라 로그 한 줄이 전부였다. 탐험 중인 플레이어가
 * "지금 무엇에 가까워지고 있는가"를 상시 HUD에서 읽을 수 있어야 한다.
 */

const BOSS_MAP = '고대 하수도';
const BOSS_NAME = DB.MAPS[BOSS_MAP].boss;

const makePlayer = (overrides = {}) => ({
    name: '리베아',
    job: '모험가',
    level: 12,
    hp: 80, maxHp: 120, mp: 20, maxMp: 40, exp: 10, nextExp: 100,
    gold: 300,
    loc: BOSS_MAP,
    status: [],
    killStreak: 0,
    stats: {},
    ...overrides,
});

const renderStatusBar = (player) => renderToStaticMarkup(createElement(StatusBar, {
    player,
    stats: { maxHp: player.maxHp, maxMp: player.maxMp },
}));

// ── 게이지 → 눈금 환산 (BALANCE 파생) ───────────────────────────────────────
test('눈금 총 개수는 BALANCE.BOSS_GAUGE_PER_EXPLORE에서 파생된다', () => {
    const expectedTotal = Math.ceil(1 / BALANCE.BOSS_GAUGE_PER_EXPLORE);
    assert.equal(getBossGaugeTicks(0).total, expectedTotal);
    assert.equal(getBossGaugeTicks(0).ticks, 0);
    assert.equal(getBossGaugeTicks(BALANCE.BOSS_GAUGE_PER_EXPLORE).ticks, 1);
    assert.equal(getBossGaugeTicks(BALANCE.BOSS_GAUGE_PER_EXPLORE * 3).ticks, 3);
});

test('만충 전에는 절대 "전부 채움"으로 보이지 않는다 (과장 금지)', () => {
    const per = BALANCE.BOSS_GAUGE_PER_EXPLORE;
    const { total } = getBossGaugeTicks(0);
    // 마지막 한 걸음 직전(예: 7회 탐험 후 0.98)은 total-1을 넘지 않아야 한다.
    const almost = Math.min(0.999, per * (total - 1));
    assert.ok(getBossGaugeTicks(almost).ticks < total, '만충 전에는 ticks < total');
    assert.equal(getBossGaugeTicks(1).ticks, total, '만충이면 ticks = total');
});

// ── 칩 뷰모델 ───────────────────────────────────────────────────────────────
test('미격파 구역 보스가 있는 지역에서만 보스 접근 칩이 생긴다', () => {
    const chip = getBossGaugeChip(makePlayer({
        stats: { bossGauge: { [BOSS_MAP]: BALANCE.BOSS_GAUGE_PER_EXPLORE * 3 } },
    }));
    assert.ok(chip);
    assert.equal(chip.id, 'bossGauge');
    assert.equal(chip.label, MSG.HUD_BOSS_GAUGE(3, getBossGaugeTicks(0).total));

    // 안전지대(보스 없음)
    assert.equal(getBossGaugeChip(makePlayer({ loc: CONSTANTS.START_LOCATION })), null);
});

test('이미 격파한 구역 보스는 칩을 만들지 않는다', () => {
    const player = makePlayer({
        stats: { areaBossDefeated: { [BOSS_NAME]: true }, bossGauge: { [BOSS_MAP]: 0.5 } },
    });
    assert.equal(getBossGaugeChip(player), null);
});

test('게이지 만충이면 보스 이름을 밝히는 문구로 바뀐다 (R26 — 대상과 의미)', () => {
    const chip = getBossGaugeChip(makePlayer({ stats: { bossGauge: { [BOSS_MAP]: 1 } } }));
    assert.equal(chip.label, MSG.HUD_BOSS_GAUGE_FULL(BOSS_NAME));
    assert.ok(chip.label.includes(BOSS_NAME));
});

test('blindMap 도전 규칙 중에는 위치 정보를 노출하지 않는다', () => {
    const player = makePlayer({
        challengeModifiers: ['blindMap'],
        stats: { bossGauge: { [BOSS_MAP]: 0.5 } },
    });
    assert.equal(getBossGaugeChip(player), null);
});

test('심연 데일리 다이브 칩은 심연에 있을 때만 · 잔여 수를 표시한다', () => {
    const now = new Date('2026-09-16T05:00:00Z');
    const today = getProtocolDayKey(now);

    const fresh = makePlayer({ loc: CONSTANTS.ABYSS_MAP_NAME, stats: {} });
    const chip = getAbyssDiveChip(fresh, now);
    assert.ok(chip);
    assert.equal(chip.id, 'abyssDive');
    assert.equal(
        chip.label,
        MSG.HUD_ABYSS_DAILY_DIVE(BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT, BALANCE.ABYSS_DAILY_DIVE_MULT),
    );

    // 심연 밖에서는 표시하지 않는다.
    assert.equal(getAbyssDiveChip(makePlayer(), now), null);

    // 오늘 다 쓰면 사라진다.
    const used = makePlayer({
        loc: CONSTANTS.ABYSS_MAP_NAME,
        stats: { abyssDailyDive: { date: today, combats: BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT } },
    });
    assert.equal(getAbyssDailyDiveRemaining(used, today), 0);
    assert.equal(getAbyssDiveChip(used, now), null);
});

test('getAbyssDailyDiveRemaining은 읽기 전용 — 상태를 소비하지 않는다', () => {
    const now = new Date('2026-09-16T05:00:00Z');
    const today = getProtocolDayKey(now);
    const stats = { abyssDailyDive: { date: today, combats: 2 } };
    const player = makePlayer({ loc: CONSTANTS.ABYSS_MAP_NAME, stats });

    const first = getAbyssDailyDiveRemaining(player, today);
    const second = getAbyssDailyDiveRemaining(player, today);
    assert.equal(first, BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT - 2);
    assert.equal(second, first, '반복 호출해도 값이 변하지 않음');
    assert.equal(stats.abyssDailyDive.combats, 2, '원본 상태 불변');
});

test('심연에서는 보스 접근 칩과 다이브 칩이 함께 나올 수 있다', () => {
    const now = new Date('2026-09-16T05:00:00Z');
    const chips = getExpeditionHudChips(
        makePlayer({
            loc: CONSTANTS.ABYSS_MAP_NAME,
            stats: { bossGauge: { [CONSTANTS.ABYSS_MAP_NAME]: BALANCE.BOSS_GAUGE_PER_EXPLORE * 2 } },
        }),
        now,
    );
    assert.deepEqual(chips.map((c) => c.id), ['bossGauge', 'abyssDive']);
});

// ── 실제 DOM 출력 (상시 HUD 렌더링) ─────────────────────────────────────────
test('StatusBar가 보스 접근 칩을 상시 HUD에 실제로 렌더링한다', () => {
    const html = renderStatusBar(makePlayer({
        stats: { bossGauge: { [BOSS_MAP]: BALANCE.BOSS_GAUGE_PER_EXPLORE * 3 } },
    }));

    assert.ok(html.includes('data-testid="status-bossGauge-chip"'), '칩 노드가 렌더링됨');
    assert.ok(html.includes(MSG.HUD_BOSS_GAUGE(3, getBossGaugeTicks(0).total)), '플레이어 어휘 문구 출력');
    assert.ok(html.includes('data-testid="status-context-line"'), '상시 HUD 컨텍스트 라인에 위치');
});

test('StatusBar는 보스가 없는 지역에서 칩을 렌더링하지 않는다 (기존 HUD 회귀 가드)', () => {
    const html = renderStatusBar(makePlayer({ loc: CONSTANTS.START_LOCATION }));
    assert.ok(!html.includes('status-bossGauge-chip'));
    assert.ok(!html.includes('status-abyssDive-chip'));
    assert.ok(html.includes('data-testid="persistent-status-bar"'), 'HUD 자체는 정상 렌더링');
});

test('StatusBar가 심연 데일리 다이브 잔여를 렌더링한다', () => {
    const html = renderStatusBar(makePlayer({ loc: CONSTANTS.ABYSS_MAP_NAME, stats: {} }));
    assert.ok(html.includes('data-testid="status-abyssDive-chip"'));
    assert.ok(html.includes(
        MSG.HUD_ABYSS_DAILY_DIVE(BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT, BALANCE.ABYSS_DAILY_DIVE_MULT),
    ));
});

test('전투 중 HUD(교전 모드)에는 원정 칩을 넣지 않는다 (전투 정보 우선)', () => {
    const html = renderToStaticMarkup(createElement(StatusBar, {
        player: makePlayer({ stats: { bossGauge: { [BOSS_MAP]: 0.5 } } }),
        stats: { maxHp: 120, maxMp: 40 },
        enemy: { name: '하수도 쥐', hp: 10, maxHp: 20 },
    }));
    assert.ok(html.includes('data-status-mode="combat"'));
    assert.ok(!html.includes('status-bossGauge-chip'));
});

// ── 지도 목록 행 배지 ───────────────────────────────────────────────────────
test('MapNavigator는 선택 카드만이 아니라 모든 목록 행에 배지를 그린다', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../src/components/MapNavigator.tsx', import.meta.url), 'utf8');

    assert.match(source, /data-testid="map-row-badges"/, '목록 행 배지 노드 존재');
    assert.match(source, /entry\.badges\.map/, '행 단위로 badges를 순회');
    assert.match(source, /selectedEntry\.badges\.map/, '선택 카드 상세는 그대로 유지');
    // 배지 색 의미가 두 표면에서 갈라지지 않도록 단일 tone 표를 공유한다.
    assert.equal((source.match(/BADGE_TONE\[badge\.id\]/g) || []).length, 2);
});
