import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getCombatForecast } from '../src/utils/combatForecast.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const basePlayer = {
    hp: 80,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
};

const baseEnemy = {
    name: '테스트 적',
    hp: 80,
    maxHp: 100,
    atk: 20,
    def: 5,
    pattern: { guardChance: 0.1, heavyChance: 0.4 },
};

test('combat forecast maps pressure to actual mobile actions', () => {
    const forecast = getCombatForecast({
        player: { ...basePlayer, hp: 24 },
        enemy: baseEnemy,
        stats: { maxHp: 100 },
        selectedSkill: { name: '화염구', type: '화염', mp: 20 },
        skillCooldown: 0,
        enemyTelegraph: { type: 'heavy', label: '강타 준비 (40%)' },
        combatConsumables: [{ name: '회복 물약', type: 'hp' }],
    });

    assert.equal(forecast.tone, 'pressure');
    assert.equal(forecast.response, '회복 아이템');
    assert.equal(forecast.window, '회복 우선');
});

test('combat forecast recommends weakness skill when readable timing is favorable', () => {
    const forecast = getCombatForecast({
        player: basePlayer,
        enemy: { ...baseEnemy, weakness: '화염' },
        stats: { maxHp: 100 },
        selectedSkill: { name: '화염구', type: '화염', mp: 20 },
        skillCooldown: 0,
        enemyTelegraph: { type: 'normal', label: '일반 공격 예상' },
        combatConsumables: [],
    });

    assert.equal(forecast.tone, 'advantage');
    assert.equal(forecast.response, '화염구 약점');
    assert.equal(forecast.window, '약점 타이밍');
});

test('combat forecast exposes reward windows without changing combat logic', () => {
    const forecast = getCombatForecast({
        player: basePlayer,
        enemy: { ...baseEnemy, isBoss: true },
        stats: { maxHp: 100 },
        selectedSkill: { name: '강타', mp: 10 },
        skillCooldown: 1,
        enemyTelegraph: { type: 'normal', label: '일반 공격 예상' },
        combatConsumables: [],
        primarySignatureDrop: { name: '테스트 각인' },
    });

    assert.equal(forecast.tone, 'reward');
    assert.equal(forecast.window, '전설 보상');
    assert.equal(forecast.response, '재사용 대기');
});

test('CombatPanel renders direct Korean forecast labels', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    // 리팩토링: 전투 예보 계산은 buildCombatView(combatView.ts)로 분리, 렌더는 CombatPanel.
    const view = await readSrc('src/utils/combatView.ts');

    assert.match(view, /getCombatForecast/);
    assert.match(source, /data-testid="combat-forecast-strip"/);
    assert.match(source, /data-forecast-tone=\{combatForecast\.tone\}/);
    assert.match(source, /data-testid="combat-forecast-label"/);
    assert.match(source, /data-testid="combat-forecast-value"/);
    assert.match(view, /label:\s*'위협'/);
    assert.match(view, /label:\s*'권장 대응'/);
    assert.match(view, /label:\s*'예상 흐름'/);
    assert.doesNotMatch(view, /label:\s*'(INTENT|RESPONSE|WINDOW)'/);
    assert.doesNotMatch(source, /Combat Items|\d+T/);
    assert.doesNotMatch(view, /HP 아이템|CD 대기|MP 절약|스킬 보류/);
});

test('smoke loop verifies the combat forecast strip during combat coverage', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(source, /verifyCombatForecast/);
    assert.match(source, /combat-forecast-strip/);
    assert.match(source, /위협/);
    assert.match(source, /권장 대응/);
    assert.match(source, /예상 흐름/);
});

test('combat forecast has high readability CSS coverage', async () => {
    const css = await readSrc('src/index.css');

    assert.match(css, /\.aether-combat-forecast/);
    assert.match(css, /\.aether-combat-forecast-cell/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-combat-forecast/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-combat-forecast-cell/);
});
