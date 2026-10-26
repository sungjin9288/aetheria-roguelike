import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import StatusBar from '../src/components/StatusBar.tsx';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { getCombatStageView } from '../src/utils/combatPresentation.js';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * Slice 30: 적 타격 임팩트 피드백 — 게임 필 감사 GF-01 · 02에서 소스 정규식 가드를 행동 테스트로 바꿨다.
 *
 * 예전 가드는 "GameRoot가 최근 로그 critical에서 enemyHitCrit을 파생한다"를 소스 글자로 고정했다 — 그 판정이 바로
 * 결함이었다(한 차례의 기록 꼬리는 적 반격이라 내 치명타는 대부분 놓치고 적 강타에 금빛이 붙었다). 이제
 * 적 피해 숫자의 금빛은 리듀서의 차례 기록(`combatFeedback.playerCrit`)에서 온다.
 *
 * 시간에 따라 켜지고 꺼지는 표시(피해 숫자 · 금빛 · 처치 순간 · 박자)는 Chromium에서 실제 훅으로 잰다:
 * tests/combat-feedback-presentation.test.js. 여기서는 렌더 한 번으로 결정되는 계약을 본다.
 */

const player = makePlayerFixture({ name: '리베이아', hp: 400, maxHp: 400, mp: 20, maxMp: 20, level: 6 });
const enemy = { name: '정예 숲의 정령', baseName: '숲의 정령', hp: 30, maxHp: 60, isBoss: false };

test('slice 30: 적 패널은 마운트 때 가짜 피격(숫자 · 플래시)을 그리지 않는다', () => {
    const html = renderStatic(createElement(StatusBar, { player, stats: null, enemy, enemyHitCrit: true }));
    assert.ok(html.includes('data-testid="enemy-status"'));
    assert.ok(!html.includes('data-testid="enemy-damage-number"'), '피해가 없으면 숫자가 없다');
    assert.ok(!html.includes('data-hit-flash'), '피해가 없으면 플래시가 없다');
    assert.ok(!html.includes('data-defeated'), '싸우는 적은 쓰러진 모습이 아니다');
});

test('slice 30 → GF-02: 처치 순간의 적 패널 — 막대 0 · 처치 도장 · 전투 중 배지 없음', () => {
    const before = {
        ...structuredClone(INITIAL_STATE),
        player: { ...player, atk: 40, loc: '고요한 숲' },
        gameState: GS.COMBAT,
        enemy: { ...enemy, hp: 3, level: 1, atk: 1, def: 0, exp: 1, gold: 1, pattern: { guardChance: 0, heavyChance: 0 } },
    };
    const after = gameReducer(before, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 4, now: 1_700_000_000_000 },
    });
    assert.equal(after.gameState, GS.IDLE);
    const stage = getCombatStageView(null, after.combatFeedback.defeatedEnemy);
    const html = renderStatic(createElement(StatusBar, {
        player: after.player,
        stats: null,
        enemy: stage.enemy,
        enemyDefeated: stage.enemyDefeated,
        enemyHitCrit: after.combatFeedback.playerCrit,
    }));
    assert.ok(html.includes('data-defeated="true"'));
    assert.ok(html.includes('data-testid="enemy-defeated-stamp"'));
    assert.ok(html.includes(`>${MSG.COMBAT_DEFEATED_STAMP}<`));
    assert.ok(html.includes('정예 숲의 정령'), '쓰러진 적의 이름을 그린다');
    assert.match(html, /data-testid="enemy-health-value"[^>]*>0\/60</, '생명은 0에서 멈춘다');
    assert.match(html, /style="width:0%"/, '막대는 0까지 줄어든다');
    assert.ok(!html.includes('전투 중'), '끝난 전투는 전투 중이 아니다');
    const stampClass = html.match(/data-testid="enemy-defeated-stamp" class="([^"]*)"/)?.[1] ?? '';
    const stampPx = Number(stampClass.match(/(?:^|\s)text-\[(\d+)px\]/)?.[1] ?? 0);
    assert.ok(stampPx >= 11, `도장 글자는 11px 이상 (지금 ${stampPx}px)`);
});

test('slice 30 → GF-01: 적 강타가 기록 꼬리인 차례 — 예전 판정은 금빛, 차례 기록은 내 치명타 아님', () => {
    const base = {
        ...structuredClone(INITIAL_STATE),
        player: { ...player, atk: 40, loc: '고요한 숲', hp: 900, maxHp: 900 },
        gameState: GS.COMBAT,
        enemy: { ...enemy, hp: 100000, maxHp: 100000, level: 3, atk: 30, def: 0, exp: 1, gold: 1, pattern: { guardChance: 0, heavyChance: 1 } },
    };
    let checked = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
        const next = gameReducer(base, {
            type: AT.RESOLVE_COMBAT_ACTION,
            payload: { kind: 'attack', expectedTurn: 0, seed, now: 1_700_000_000_000 },
        });
        const logs = next.logs.slice(base.logs.length);
        const tailSaysCrit = logs[logs.length - 1].type === 'critical';
        const playerCrit = logs[0].type === 'critical';
        if (!tailSaysCrit || playerCrit) continue;
        checked += 1;
        assert.equal(next.combatFeedback.playerCrit, false, `seed ${seed}: 적 강타는 내 치명타가 아니다`);
        assert.equal(next.combatFeedback.enemyHeavy, true, `seed ${seed}: 적 강타는 강타로 기록된다`);
    }
    assert.ok(checked > 0, '기록 꼬리가 적 강타인 차례 표본이 있다');
});
