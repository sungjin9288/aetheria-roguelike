import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';

import { BALANCE } from '../src/data/constants.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { getCombatTimeScale, isCombatSpeedFast } from '../src/utils/playerSettings.ts';
import { getCombatBeatTiming, getCounterStagger } from '../src/utils/combatPresentation.ts';
import { migrateData } from '../src/utils/dataMigration.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import SystemTab from '../src/components/tabs/SystemTab.tsx';
import MainLayout from '../src/components/MainLayout.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-11 디자인 고도화 A5 — 전투 속도(보통 ×1 · 빠르게 ×2).
 *
 *   - 설정은 `player.settings.combatSpeed`의 선택 필드다(없으면 보통 — DATA_VERSION을 올리지 않는다). 사망 · 불러오기를 넘어 남는다.
 *   - 빠르게는 **연출 시간만** `BALANCE.COMBAT_FAST_TIME_SCALE` 배다: 반격 박자 · 처치 순간 · 비네트 · 흔들림(JS),
 *     피해 숫자 · 번쩍임 · 흩어짐 · 생명 막대 잔상(CSS `--ae-combat-time`), 결과 카드 공개(PostCombatCard `timeScale`).
 *   - 보통은 이전 값 그대로다. 모션 감소 설정의 처치 정지는 이미 최소라 줄이지 않는다.
 *   - 판정 · 난수 · 기록 줄은 이 설정을 읽지 않는다 — 리듀서는 settings를 그대로 넘길 뿐이다.
 */

const setCombatSpeed = (state, value) => gameReducer(state, {
    type: AT.SET_PLAYER,
    // useGameEngine의 setCombatSpeed와 같은 함수형 payload.
    payload: (current) => ({ settings: { ...(current.settings || {}), combatSpeed: value === 'fast' ? 'fast' : 'normal' } }),
});

test('A5 설정: 기본은 보통(×1)이고 빠르게만 배율이 바뀐다', () => {
    assert.equal(isCombatSpeedFast(INITIAL_STATE.player), false, '새 캐릭터는 보통');
    assert.equal(getCombatTimeScale(INITIAL_STATE.player), 1);
    assert.equal(getCombatTimeScale({ settings: {} }), 1, '값이 없는 이전 세이브는 보통');
    assert.equal(getCombatTimeScale({ settings: { combatSpeed: 'turbo' } }), 1, '모르는 값은 보통');
    assert.equal(getCombatTimeScale(null), 1);
    assert.equal(getCombatTimeScale({ settings: { combatSpeed: 'fast' } }), BALANCE.COMBAT_FAST_TIME_SCALE);
    assert.ok(BALANCE.COMBAT_FAST_TIME_SCALE > 0 && BALANCE.COMBAT_FAST_TIME_SCALE < 1, '빠르게는 시간을 줄인다');
});

test('A5 설정: 실제 리듀서로 바꾸고, 불러오기 · 사망을 넘어 남는다(다른 설정 키는 그대로)', () => {
    const fast = setCombatSpeed(INITIAL_STATE, 'fast');
    assert.equal(isCombatSpeedFast(fast.player), true);
    assert.equal(fast.player.settings.readabilityMode, INITIAL_STATE.player.settings?.readabilityMode, '다른 설정 키는 그대로');

    const migrated = migrateData(JSON.parse(JSON.stringify({ player: fast.player })), { now: 0 });
    assert.equal(isCombatSpeedFast(migrated.player), true, '불러온 뒤에도 빠르게');

    const afterDeath = pickPermanentPlayerState(fast.player, INITIAL_STATE.player, 'death');
    assert.equal(isCombatSpeedFast(afterDeath), true, '설정은 계정 범위 — 사망 뒤에도 남는다');

    assert.equal(isCombatSpeedFast(setCombatSpeed(fast, 'normal').player), false, '다시 보통으로');
});

test('A5 박자: 보통은 이전 상수 그대로, 빠르게는 네 박자가 모두 배율만큼 짧다', () => {
    const scale = BALANCE.COMBAT_FAST_TIME_SCALE;
    const normal = getCombatBeatTiming(false, 1);
    assert.deepEqual(normal, {
        counterDelayMs: BALANCE.ENEMY_TURN_DELAY_MS,
        killBeatMs: BALANCE.KILL_BEAT_MS,
        pulseMs: BALANCE.COMBAT_PULSE_MS,
        shakeMs: BALANCE.COMBAT_SHAKE_MS,
    });
    assert.deepEqual(getCombatBeatTiming(false), normal, '배율을 주지 않으면 보통');

    const fast = getCombatBeatTiming(false, scale);
    for (const key of Object.keys(normal)) {
        assert.equal(fast[key], Math.round(normal[key] * scale), `${key}는 배율만큼`);
        assert.ok(fast[key] < normal[key], `${key}는 빠르게에서 짧다`);
    }

    const reduced = getCombatBeatTiming(true, scale);
    assert.equal(reduced.counterDelayMs, 0, '모션 감소는 박자를 나누지 않는다');
    assert.equal(reduced.killBeatMs, BALANCE.KILL_BEAT_REDUCED_MS, '모션 감소의 처치 정지는 줄이지 않는다');

    for (const bad of [0, -1, Number.NaN, 2]) {
        assert.deepEqual(getCombatBeatTiming(false, bad), normal, `잘못된 배율 ${bad}은 보통`);
    }
});

test('A5 박자: 내 피격 숫자의 반격 지연(useDamageFlash 입력)도 같은 배율이다', () => {
    const feedback = { key: 'turn-3', kind: 'continue', enemyDamage: 12, enemyActed: true };
    assert.equal(getCounterStagger(feedback, false).delayMs, BALANCE.ENEMY_TURN_DELAY_MS);
    assert.equal(
        getCounterStagger(feedback, false, BALANCE.COMBAT_FAST_TIME_SCALE).delayMs,
        Math.round(BALANCE.ENEMY_TURN_DELAY_MS * BALANCE.COMBAT_FAST_TIME_SCALE),
    );
    assert.equal(getCounterStagger(feedback, true, BALANCE.COMBAT_FAST_TIME_SCALE).delayMs, 0);
});

test('A5 CSS: 빠르게의 시간 변수는 BALANCE 배율과 같고, 전투 연출 시간은 그 변수를 곱한다', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    const rule = css.match(/\[data-combat-speed="fast"\]\s*\{\s*--ae-combat-time:\s*([\d.]+);/);
    assert.ok(rule, '빠르게 규칙이 있다');
    assert.equal(Number(rule[1]), BALANCE.COMBAT_FAST_TIME_SCALE, 'CSS 배율 = BALANCE 배율');
    // 전투 연출 키프레임은 시간을 변수로 곱한다 — 고정 시간으로 되돌리면 빠르게가 그 연출만 느리다.
    for (const name of ['ae-stage-float', 'ae-stage-hit-flash', 'ae-stage-crit-shake', 'ae-stage-dissolve']) {
        const uses = [...css.matchAll(new RegExp(`(?<!@keyframes )${name}\\s+([^\\s,;]+)`, 'g'))].map((m) => m[1]);
        assert.ok(uses.length > 0, `${name}을 쓰는 곳이 있다`);
        for (const duration of uses) {
            assert.match(duration, /^calc\(\d+ms$/, `${name}의 시간은 calc(…ms * var(--ae-combat-time, 1))`);
        }
    }
});

test('A5 화면: 셸이 data-combat-speed를 싣고, 설정 탭에 두 칸 선택이 있다', () => {
    const fastShell = renderStatic(createElement(MainLayout, { combatSpeedFast: true }, null));
    assert.match(fastShell, /data-combat-speed="fast"/);
    assert.match(renderStatic(createElement(MainLayout, {}, null)), /data-combat-speed="normal"/);

    const render = (settings) => renderStatic(createElement(SystemTab, {
        player: makePlayerFixture({ settings }),
        actions: { leaderboard: [], isAdmin: () => false },
        stats: { maxHp: 100, maxMp: 50 },
        runtime: { viewport: 'mobile', gameState: 'idle', syncStatus: 'synced', isAiThinking: false },
    }));
    const normalHtml = render({});
    assert.match(normalHtml, /data-testid="combat-speed-settings"/);
    assert.ok(normalHtml.includes(MSG.SYSTEM_COMBAT_SPEED_TITLE));
    assert.match(normalHtml, /data-testid="combat-speed-normal"[^>]*aria-pressed="true"/);
    assert.match(normalHtml, /data-testid="combat-speed-fast"[^>]*aria-pressed="false"/);
    assert.match(render({ combatSpeed: 'fast' }), /data-testid="combat-speed-fast"[^>]*aria-pressed="true"/);
});

test('A5 문구: 바뀐 속도를 알리는 줄은 받침에 맞춘 조사를 쓴다', () => {
    assert.equal(MSG.SYSTEM_COMBAT_SPEED_CHANGED(MSG.SYSTEM_COMBAT_SPEED_NORMAL), '전투 속도를 보통 ×1로 바꿨습니다.');
    assert.equal(MSG.SYSTEM_COMBAT_SPEED_CHANGED(MSG.SYSTEM_COMBAT_SPEED_FAST), '전투 속도를 빠르게 ×2로 바꿨습니다.');
});
