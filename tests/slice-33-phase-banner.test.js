import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import PhaseBanner from '../src/components/PhaseBanner.tsx';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * Slice 33: 보스 페이즈 전환 연출 — 원본 계약(Wave 4 이전, 소스 텍스트 grep):
 *
 *   1. PhaseBanner: phase가 null이면 미렌더, phase.n >= 3이면 강조(💀 최종 단계) 분기,
 *      phase.name 표시, "N단계 진입" / "최종 단계" 한국어 라벨.
 *   2. GameRoot: enemy.phase2Triggered/phase3Triggered가 false→true로 바뀌는 순간만
 *      감지해 배너를 띄우고(재트리거 방지), live enemy가 사라지면 안전하게 원복하며,
 *      ~2초 뒤 자동 해제하는 별도 effect(배너 표시 effect와는 분리된 cleanup)를 가진다.
 *   3. CombatEngine(enemyAttack): phase2/phase3 진입 시 실제로 phase2Triggered/
 *      phase3Triggered를 true로 세팅하고 enemy.name을 페이즈 이름으로 갱신한다
 *      (배너가 표시할 데이터의 원천).
 *
 * 아래에서 1, 3은 실제 렌더/실제 함수 호출로 검증한다. 2(GameRoot의 useState +
 * 두 개의 useEffect + setTimeout 타이머 배선)는 실제 DOM과 React act() 없이는
 * "false→true 플립에만 반응하고, 재렌더마다 재트리거하지 않으며, 타이머가 실제로
 * 도는지"를 관찰할 방법이 없다 — 이 프로젝트의 테스트 러너는 `react-dom/server`의
 * `renderToStaticMarkup`(1회성 SSR 문자열, effect 미실행)만 제공하고 jsdom/
 * react-test-renderer/testing-library는 devDependency에 없다. 따라서 2는
 * "구조 불변식(소스 텍스트)"로 유지한다.
 */

test('PhaseBanner: phase가 null이면 아무것도 렌더하지 않는다', () => {
    const html = renderStatic(createElement(PhaseBanner, { phase: null }));
    assert.ok(!html.includes('data-testid="phase-banner"'), 'phase null → 배너 미노출');
});

test('PhaseBanner: phase 2단계는 경고 톤 "N단계 진입" 라벨로 렌더된다', () => {
    const html = renderStatic(createElement(PhaseBanner, { phase: { n: 2, name: '분노한 마왕' } }));
    assert.ok(html.includes('data-testid="phase-banner"'), '배너 렌더');
    assert.ok(html.includes('data-phase="2"'), 'phase 번호 노출');
    assert.ok(html.includes('⚡ 2단계 진입'), '2단계 라벨');
    assert.ok(html.includes('분노한 마왕'), '보스 이름 노출');
    assert.ok(html.includes('#f47ab0'), '2단계 accent 색상');
    assert.ok(!html.includes('최종 단계'), '2단계는 최종 단계 라벨이 아니다');
});

test('PhaseBanner: phase.n >= 3이면 최종 단계로 강조된다', () => {
    const html = renderStatic(createElement(PhaseBanner, { phase: { n: 3, name: '최종 마왕' } }));
    assert.ok(html.includes('💀 최종 단계'), '3단계 이상은 최종 단계 라벨');
    assert.ok(html.includes('최종 마왕'), '보스 이름 노출');
    assert.ok(html.includes('#c7a4f0'), '최종 단계 accent 색상');
});

const BOSS_STATS = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };
const makeAttacker = () => ({
    name: 'Test', job: '전사', level: 10,
    hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
    atk: 20, def: 5,
    equip: { weapon: null, armor: null, offhand: null },
    status: [],
});

test('CombatEngine.enemyAttack: HP가 phase2 임계값 아래로 내려가면 phase2Triggered + 이름/능력치를 갱신한다', () => {
    const enemy = {
        name: '마왕', baseName: '마왕', isBoss: true,
        hp: 35, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0, heavyChance: 0 },
        phase2: { name: '분노한 마왕', log: '분노한 마왕이 포효한다!', atkBonus: 0.5 },
    };

    const result = CombatEngine.enemyAttack(makeAttacker(), enemy, BOSS_STATS, () => 0);

    assert.equal(result.updatedEnemy.phase2Triggered, true, 'phase2Triggered가 true로 세팅된다');
    assert.equal(result.updatedEnemy.name, '분노한 마왕', 'enemy.name이 phase2 이름으로 갱신된다(배너 표시 소스)');
    assert.equal(result.updatedEnemy.atk, 75, 'atkBonus가 실제로 적용된다 (50 * 1.5)');
    assert.ok(result.logs.some((log) => log.type === 'warning' && log.text.includes('분노한 마왕이 포효한다!')),
        'phase2 진입 로그가 남는다');
});

test('CombatEngine.enemyAttack: HP가 phase3 임계값(기본 25%) 아래로 내려가면 phase3Triggered + def 보너스까지 반영한다', () => {
    const enemy = {
        name: '마왕', baseName: '마왕', isBoss: true,
        hp: 20, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0, heavyChance: 0 },
        phase3: { name: '최종 마왕', log: '최종 형태를 드러낸다!', atkBonus: 0.3, defBonus: 10 },
    };

    const result = CombatEngine.enemyAttack(makeAttacker(), enemy, BOSS_STATS, () => 0);

    assert.equal(result.updatedEnemy.phase3Triggered, true, 'phase3Triggered가 true로 세팅된다');
    assert.equal(result.updatedEnemy.name, '최종 마왕', 'enemy.name이 phase3 이름으로 갱신된다');
    assert.equal(result.updatedEnemy.def, 15, 'defBonus가 실제로 적용된다 (5 + 10)');
    assert.ok(result.logs.some((log) => log.type === 'critical' && log.text.includes('최종 형태를 드러낸다!')),
        'phase3 진입 로그가 critical 톤으로 남는다');
});

test('CombatEngine.enemyAttack: HP 비율이 임계값보다 높으면 phase2가 트리거되지 않는다 (회귀 가드)', () => {
    const enemy = {
        name: '마왕', baseName: '마왕', isBoss: true,
        hp: 90, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0, heavyChance: 0 },
        phase2: { name: '분노한 마왕', log: '...', atkBonus: 0.5 },
    };

    const result = CombatEngine.enemyAttack(makeAttacker(), enemy, BOSS_STATS, () => 0);

    assert.ok(!result.updatedEnemy.phase2Triggered, 'HP가 충분히 높으면 phase2가 트리거되지 않는다');
    assert.equal(result.updatedEnemy.name, '마왕', '이름도 그대로 유지된다');
});

// ─── 구조 불변식(소스 텍스트) — GameRoot의 phase 플립 감지 + 타이머 배선 ───
//
// react-dom/server의 renderToStaticMarkup은 useEffect를 실행하지 않고, 이 프로젝트에는
// jsdom/react-test-renderer/testing-library가 없어 "실제 재렌더 사이 상태 변화"를
// 관찰할 방법이 없다. false→true 플립 감지, enemy 소멸 시 안전한 원복, ~2초 자동
// 해제 타이머가 서로 다른 effect로 분리되어 있는지는 소스 텍스트로만 확인한다.
test('구조 불변식: GameRoot는 phase2/3Triggered의 false→true 플립만 배너로 띄우고, 별도 effect로 ~2초 후 해제한다', async () => {
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const src = await readFile(path.join(ROOT, 'src/components/app/GameRoot.tsx'), 'utf8');

    assert.ok(/import PhaseBanner/.test(src), 'PhaseBanner import');
    assert.ok(/const visiblePhaseBanner = engine\.enemy && phaseBanner/.test(src),
        'live enemy와 저장된 배너를 함께 확인');
    assert.ok(/engine\.enemy\.phase2Triggered/.test(src)
        && /engine\.enemy\.phase3Triggered/.test(src), 'live phase flag authority를 확인');
    assert.ok(/<PhaseBanner phase=\{visiblePhaseBanner\}/.test(src), '배너 렌더');
    assert.ok(/phase2Triggered/.test(src) && /phase3Triggered/.test(src), '두 페이즈 플래그 watch');
    assert.ok(/p3 && !prev\.p3/.test(src) && /p2 && !prev\.p2/.test(src),
        'false→true 플립만 트리거');
    assert.doesNotMatch(src, /if \(!e\) \{[\s\S]{0,180}setPhaseBanner\(null\)/,
        'enemy 소멸 effect는 동기 state update를 만들지 않는다');
    assert.ok(/setTimeout\([\s\S]{0,80}setPhaseBanner\(null\)[\s\S]{0,12}2000\)/.test(src),
        '~2s 자동 해제');
    assert.ok(/\}, \[engine\.enemy\]\);\s*useEffect\(\(\) => \{\s*if \(!phaseBanner\)/.test(src),
        '적 상태 감지와 배너 해제 타이머가 별도 effect');
    assert.ok(/clearTimeout\(timer\);\s*\}, \[phaseBanner\]\)/.test(src),
        '배너 자체 변경에만 자동 해제 타이머 cleanup');
});
