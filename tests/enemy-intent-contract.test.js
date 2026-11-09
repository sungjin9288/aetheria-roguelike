import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';

import EnemyStatus from '../src/components/combat/EnemyStatus.tsx';
import { MSG } from '../src/data/messages.ts';
import { MONSTERS } from '../src/data/monsters.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getEnemyIntent } from '../src/utils/enemyIntent.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-11 디자인 고도화 A4 — 적 무대의 의도 표시(소유자 결정 Q2 "권장 대응 칩은 없앤다").
 * 전투 조작판의 판단 요약 세 칸(위협 · 권장 대응 · 예상 흐름)을 지우고, 적 이름 아래에 다음 행동 · 그 행동 한 번의 예상 피해를 보인다.
 * (1) 다음 행동은 엔진의 예고 그대로 (2) 숫자는 그 행동을 실제로 했을 때의 엔진 피해와 같다 (3) 게임 난수를 쓰지 않는다
 * (4) 무엇을 하라고 권하지 않는다(Wave 88) (5) 판단 요약 세 칸은 돌아오지 않는다.
 */

const SRC = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const makePlayer = (extra = {}) => ({
    name: '시험자', job: '전사', level: 30, hp: 3_000, maxHp: 3_000, mp: 200, maxMp: 200, atk: 200, def: 60, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
const makeEnemy = (extra = {}) => ({
    name: '시험 적', baseName: '시험 적', level: 30, hp: 2_000, maxHp: 2_000, atk: 260, def: 20, exp: 100, gold: 50,
    pattern: { guardChance: 0.1, heavyChance: 0.1 }, ...extra,
});

/** 첫 굴림(행동 판정)만 정하고 나머지는 회피 · 막기 · 상태 판정에 걸리지 않는 값이다. */
const rollThen = (first) => {
    let calls = 0;
    return () => (calls++ === 0 ? first : 0.999);
};
const engineHit = (player, enemy, firstRoll) => (
    CombatEngine.enemyAttack(player, enemy, calculateFullStats(player), rollThen(firstRoll)).damage
);

test('A4: 일반 공격 예고 — 숫자는 엔진이 일반 공격을 굴린 피해와 같다', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const intent = getEnemyIntent(player, enemy);
    assert.equal(intent.kind, 'attack');
    assert.equal(intent.label, MSG.ENEMY_TELEGRAPH_NORMAL);
    assert.ok(intent.hit > 0);
    assert.equal(intent.hit, engineHit(player, enemy, 0.999));
});

test('A4: 맹공 예고 — 숫자는 엔진이 강타를 굴린 피해와 같고 일반 공격보다 크다', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ pattern: { guardChance: 0, heavyChance: 0.5 } });
    const intent = getEnemyIntent(player, enemy);
    assert.equal(intent.kind, 'heavy');
    assert.equal(intent.hit, engineHit(player, enemy, 0.2));
    assert.ok(intent.hit > engineHit(player, enemy, 0.999));
});

test('A4: 방어 예고 — 숫자는 공격할 때의 일반 공격 피해다', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ pattern: { guardChance: 0.6, heavyChance: 0.1 } });
    const intent = getEnemyIntent(player, enemy);
    assert.equal(intent.kind, 'guard');
    assert.equal(intent.hit, engineHit(player, enemy, 0.999));
});

test('A4: 브레스 차례 — 숫자는 엔진의 브레스 피해와 같다', () => {
    const player = makePlayer();
    const profile = MONSTERS['레드 드래곤'];
    const dragon = makeEnemy({
        name: '레드 드래곤', baseName: '레드 드래곤', isBoss: true, mechanics: profile.mechanics, actionCount: profile.mechanics.breath.every - 1,
    });
    const intent = getEnemyIntent(player, dragon);
    assert.equal(intent.kind, 'breath');
    assert.equal(intent.hit, engineHit(player, dragon, 0.999));
    assert.ok(intent.hit > engineHit(player, { ...dragon, actionCount: 0 }, 0.999), '브레스는 일반 공격보다 세다');
});

test('A4: 기절한 적은 숫자 · 상태가 없다', () => {
    const intent = getEnemyIntent(makePlayer(), makeEnemy({ stunnedTurns: 1, statusOnHit: 'poison' }));
    assert.equal(intent.kind, 'stunned');
    assert.equal(intent.hit, null);
    assert.equal(intent.status, null);
});

test('A4: 맞으면 걸릴 상태는 기록과 같은 이름이다', () => {
    const intent = getEnemyIntent(makePlayer(), makeEnemy({ statusOnHit: 'poison' }));
    assert.equal(intent.status, MSG.DOT_LABELS.poison);
});

test('A4: 의도 계산은 게임 난수를 쓰지 않고 입력을 바꾸지 않는다', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ pattern: { guardChance: 0, heavyChance: 0.5 }, statusOnHit: 'burn' });
    const before = JSON.stringify({ player, enemy });
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random을 쓰면 안 된다'); };
    try {
        assert.ok(getEnemyIntent(player, enemy));
    } finally {
        Math.random = original;
    }
    assert.equal(JSON.stringify({ player, enemy }), before);
});

test('A4: 적 무대 · 상태 카드가 의도를 그리고, 처치 순간에는 그리지 않는다', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ statusOnHit: 'bleed' });
    const intent = getEnemyIntent(player, enemy);
    for (const layout of ['stage', 'card']) {
        const html = renderStatic(createElement(EnemyStatus, { enemy, layout, intent }));
        assert.match(html, /data-testid="enemy-intent"[^>]*data-intent-kind="attack"/, layout);
        assert.ok(html.includes(MSG.ENEMY_INTENT_SR_PREFIX), `${layout}: 화면 낭독기 머리말`);
        assert.ok(html.includes(MSG.ENEMY_INTENT_HIT(intent.hit)), `${layout}: 예상 피해`);
        assert.ok(html.includes(MSG.DOT_LABELS.bleed), `${layout}: 상태`);
        const defeated = renderStatic(createElement(EnemyStatus, { enemy, layout, intent, defeated: true }));
        assert.ok(!defeated.includes('data-testid="enemy-intent"'), `${layout}: 처치 순간`);
    }
});

test('A4: 의도 표시는 정보만이다 — 권하는 말이 없다', () => {
    const player = makePlayer();
    const cases = [
        makeEnemy(),
        makeEnemy({ pattern: { guardChance: 0, heavyChance: 0.5 } }),
        makeEnemy({ pattern: { guardChance: 0.6, heavyChance: 0 } }),
        makeEnemy({ stunnedTurns: 1 }),
    ];
    for (const enemy of cases) {
        const intent = getEnemyIntent(player, enemy);
        const html = renderStatic(createElement(EnemyStatus, { enemy, layout: 'stage', intent }));
        for (const word of ['권장', '추천', '도주', '물약', '하세요', '하십시오']) {
            assert.ok(!html.includes(word), `"${word}" 없음 (${intent.kind})`);
        }
    }
});

test('A4: 판단 요약 세 칸은 돌아오지 않는다(부재 불변식)', () => {
    assert.equal(fs.existsSync(new URL('../src/utils/combatForecast.ts', import.meta.url)), false);
    assert.equal('COMBAT_FORECAST_ARIA' in MSG, false);
    for (const path of ['src/components/tabs/CombatPanel.tsx', 'src/utils/combatView.ts', 'src/index.css']) {
        const source = SRC(path);
        assert.ok(!/combat-forecast|getCombatForecast|COMBAT_FORECAST/.test(source), path);
    }
});
