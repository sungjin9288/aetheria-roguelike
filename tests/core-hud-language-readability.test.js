import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';

import BootScreen from '../src/components/app/BootScreen.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import PixelCharacterAvatar from '../src/components/PixelCharacterAvatar.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import LevelUpBanner from '../src/components/LevelUpBanner.tsx';
import PhaseBanner from '../src/components/PhaseBanner.tsx';
import { parseCommand } from '../src/utils/commandParser.ts';
import { MSG } from '../src/data/messages.ts';
import { formatEquipmentDelta } from '../src/utils/equipmentUtils.ts';
import { getLootUpgradeHint } from '../src/hooks/combatActions/_helpers.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/**
 * 원래 계약 (각 assert가 지키던 것):
 *   1. BootScreen: 내부 부팅 단계는 data 속성(data-boot-stage)으로만 노출하고,
 *      플레이어에게는 "모험을 준비하고 있습니다." 같은 사람 언어 메시지를 보여준다
 *      (SYSTEM INITIALIZING 같은 개발자 문구·bootStage 원문 노출 금지).
 *   2. StatusBar: 상시 상태/교전 대상 표시는 생명/기력/경험/골드/교전 대상/보스/레벨
 *      같은 직접적 한국어 라벨을 쓰고, 음소거 관련 UI나 "Target Lock"/">Boss<" 같은
 *      영문 잔재는 없다. enemy-portrait/enemy-status-label/enemy-health-value testid를 갖는다.
 *   3. StatusBar: 정체성·위치는 한 줄(status-player-summary/status-location)에, 지표는
 *      status-metrics/status-metric-label/status-metric-value로 노출하고 10px/11px
 *      타이포를 쓴다. PixelCharacterAvatar의 강화 뱃지는 "강화 +N" 형태.
 *   4. useGameTestApi의 아바타 QA 프리셋은 hp/mp를 장비 반영 최대치로 clamp한다.
 *   5. TerminalView: 로그 타입 뱃지는 COMBAT/CRIT/AI 같은 개발자 약어가 아니라
 *      전투/치명타/이야기/안내/획득/이벤트/주의/오류/전설 같은 뜻이 통하는 한국어다.
 *   6. LevelUpBanner/PhaseBanner: "레벨 상승"/"N단계 진입"/"최종 단계" 같은 동일한
 *      플레이어 언어를 쓴다 (Level Up/Phase N 같은 영문 없음).
 *   7. 전투 후 장비 갱신 힌트는 바뀐 능력치 이름(MSG.EQUIP_DELTA_LABEL)을 실제로 말한다.
 *   8. status 명령은 생명:/기력:/골드:/위치: 같은 직접적 한국어 라벨을 반복한다.
 *   9. 스모크 테스트가 렌더링된 상태/적/로그 어휘를 검증한다.
 *
 * 1, 2, 3, 5, 6은 실제 컴포넌트를 renderStatic으로 렌더링해 markup 텍스트를 검증한다.
 * 4는 useGameTestApi가 풀 엔진(engineRef)에 묶여 있어 렌더 대상이 없으므로 구조
 * 불변식으로 유지한다(smoke-gameplay.mjs 부분도 동일 이유).
 * 7은 실제 순수 함수(getLootUpgradeHint/formatEquipmentDelta)를 호출해 반환값을 검증한다
 * (원래 테스트가 지키던 "_helpers.ts가 getEquipmentComparison을 쓴다"는 소스 텍스트보다
 * "실제로 올바른 한국어 델타 문자열을 만든다"가 더 강한 계약이다).
 * 8은 실제 parseCommand('status', ...)를 호출해 반환 문자열을 검증한다.
 * 9는 Playwright 스모크 스크립트라 렌더 대상이 없다 — 구조 불변식으로 유지한다.
 */

test('BootScreen: bootStage는 data 속성으로만, 플레이어에게는 한국어 메시지', () => {
    const html = renderStatic(createElement(BootScreen, { bootStage: 'auth' }));
    assert.ok(html.includes('data-boot-stage="auth"'));
    assert.ok(html.includes('모험을 준비하고 있습니다.'));
    assert.ok(!html.includes('SYSTEM INITIALIZING'));
    assert.ok(!html.includes('(auth)'), 'bootStage 원문이 괄호로 그대로 노출되지 않음');
});

test('StatusBar: 전투 중 표시는 직접적 한국어 라벨을 쓰고 영문/음소거 잔재가 없다', () => {
    const player = makePlayerFixture({ name: '테스트', hp: 50, mp: 20, level: 3 });
    const enemy = { name: '고블린 정찰병', hp: 40, maxHp: 80, isBoss: true };
    const html = renderStatic(createElement(StatusBar, { player, stats: null, enemy, enemyHitCrit: false }));

    for (const label of ['생명', '기력', '교전 대상', '보스', '레벨']) {
        assert.ok(html.includes(label), `"${label}" 라벨 노출`);
    }
    assert.ok(!/소리 켜기|소리 끄기|Volume2|VolumeX/.test(html));
    assert.ok(html.includes('data-testid="enemy-portrait"'));
    assert.ok(html.includes('data-testid="enemy-status-label"'));
    assert.ok(html.includes('data-testid="enemy-health-value"'));
    assert.ok(!/Target Lock|>Boss<|Toggle Sound/.test(html));
});

test('StatusBar: 비전투(대기) 화면에서는 경험/골드 지표와 정체성 요약을 노출한다', () => {
    const player = makePlayerFixture({ name: '테스트', gold: 120, exp: 5, nextExp: 100 });
    const html = renderStatic(createElement(StatusBar, { player, stats: null, enemy: null }));
    for (const label of ['경험', '골드']) {
        assert.ok(html.includes(label), `"${label}" 라벨 노출`);
    }
});

test('StatusBar: 정체성/위치는 한 줄, 지표는 status-metrics로, 10px/11px 타이포를 쓴다', () => {
    const player = makePlayerFixture({ name: '테스트' });
    const html = renderStatic(createElement(StatusBar, { player, stats: null, enemy: null }));

    assert.ok(html.includes('data-testid="status-player-summary"'));
    assert.ok(html.includes('data-testid="status-location"'));
    assert.ok(html.includes('data-testid="status-metrics"'));
    assert.ok(html.includes('data-testid="status-metric-label"'));
    assert.ok(html.includes('data-testid="status-metric-value"'));
    assert.match(html, /text-\[10px\]/);
    assert.match(html, /text-\[11px\]/);
    assert.ok(!/status-outfit-affinity-chip|status-signature-chip/.test(html));
});

test('PixelCharacterAvatar: 강화 합계 뱃지는 "강화 +N" 형태로 렌더링된다', () => {
    const player = makePlayerFixture({ equip: { weapon: { name: '테스트 무기', enhance: 3 } } });
    const html = renderStatic(createElement(PixelCharacterAvatar, {
        player, size: 'sm', dataTestId: 'avatar-test', label: '초상',
    }));
    assert.ok(html.includes('data-testid="avatar-enhance-badge"'));
    assert.ok(html.includes('강화 +3'));
    assert.ok(!/>\s*\+3</.test(html), '라벨 없이 "+3"만 노출되지 않음');
});

// 구조 불변식(소스 텍스트) — useGameTestApi는 풀 엔진(engineRef.current)에 묶인
// QA 시드 함수이고 smoke-gameplay.mjs는 Playwright 브라우저 스크립트라 둘 다
// 렌더 대상이 없다.
test('avatar QA presets clamp current vitals to the rendered equipment maximums', async () => {
    const testApi = await readSrc('src/hooks/useGameTestApi.ts');
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(testApi, /const previewStats = calculateFullStats\(\{ \.\.\.er\.player, \.\.\.payload \}\)!/);
    assert.match(testApi, /payload\.hp = Math\.min\([\s\S]*?previewStats\.maxHp\)/);
    assert.match(testApi, /payload\.mp = Math\.min\([\s\S]*?previewStats\.maxMp\)/);
    assert.match(smoke, /nextState\.player\.hp <= nextState\.player\.maxHp/);
    assert.match(smoke, /nextState\.player\.mp <= nextState\.player\.maxMp/);
    assert.match(smoke, /avatar enhancement label should stay inside the avatar frame/);
});

test('TerminalView: 로그 타입 뱃지는 개발자 약어가 아니라 뜻이 통하는 한국어다', () => {
    const types = ['combat', 'critical', 'story', 'system', 'success', 'event', 'warning', 'error', 'legendary'];
    const expectedLabels = ['전투', '치명타', '이야기', '안내', '획득', '이벤트', '주의', '오류', '전설'];
    const logs = types.map((type, i) => ({ id: `l${i}`, type, text: `로그 ${type}` }));
    const html = renderStatic(createElement(TerminalView, {
        logs, gameState: 'IDLE', onCommand: () => {}, player: null, quickSlots: [], onQuickSlotUse: () => {},
    }));

    assert.ok(html.includes('data-testid="log-type-badge"'));
    for (const label of expectedLabels) {
        assert.ok(html.includes(label), `"${label}" 뱃지 라벨 노출`);
    }
    assert.ok(!/label: '(?:COMBAT|CRIT|AI|SYS|GAIN|EVENT|WARN|ERROR|LEGEND)'/.test(html));
});

test('TerminalView: 이야기 흐름/처리 중 문구는 한국어를 쓴다', () => {
    const logs = Array.from({ length: 20 }, (_, i) => (
        i === 10
            ? { id: 'story', type: 'story', text: '숲 속에서 낯선 기척을 느꼈다' }
            : { id: `l${i}`, type: 'system', text: `로그 ${i}` }
    ));
    logs.push({ id: 'loading', type: 'loading', text: '' });
    const html = renderStatic(createElement(TerminalView, {
        logs, gameState: 'IDLE', onCommand: () => {}, player: null, quickSlots: [], onQuickSlotUse: () => {},
    }));
    assert.ok(html.includes('이야기 흐름'));
    assert.ok(html.includes('이야기를 이어가는 중'));
});

test('LevelUpBanner / PhaseBanner: 성장·보스 전환 배너는 같은 플레이어 언어를 쓴다', () => {
    const levelHtml = renderStatic(createElement(LevelUpBanner, { level: 12 }));
    assert.ok(levelHtml.includes('레벨 상승'));
    assert.ok(levelHtml.includes('레벨 12'));
    assert.ok(!levelHtml.includes('Level Up'));

    const phaseHtml = renderStatic(createElement(PhaseBanner, { phase: { n: 2, name: '분노한 수호자' } }));
    assert.ok(phaseHtml.includes('2단계 진입'));
    assert.ok(!phaseHtml.includes('Phase 2'));

    const finalPhaseHtml = renderStatic(createElement(PhaseBanner, { phase: { n: 3, name: '최후의 형상' } }));
    assert.ok(finalPhaseHtml.includes('최종 단계'));
    assert.ok(!finalPhaseHtml.includes('Final Phase'));
});

test('post-combat 장비 갱신 힌트는 바뀐 능력치 이름을 실제로 말한다', () => {
    assert.deepEqual(MSG.EQUIP_DELTA_LABEL, { atk: '공격력', def: '방어력', crit: '치명타', mp: '기력' });
    assert.equal(formatEquipmentDelta('atk', 4), '공격력 +4');
    assert.equal(formatEquipmentDelta('crit', 5), '치명타 +5%');

    // 장비 스탯은 atk/def가 아니라 .val 필드에서 나온다(getEnhancedEquipmentStatValue,
    // equipmentUtils.ts). 방어구는 val이 그대로 방어력 diff가 되므로, 아무것도 착용하지
    // 않은 상태에서 방어구 하나를 얻으면 정확히 "방어력 +N" 힌트가 만들어진다 — 실제
    // 장비 비교 파이프라인이 formatEquipmentDelta/MSG.EQUIP_DELTA_LABEL과 맞물려
    // 작동함을 증명하는 결정론적 케이스.
    const player = makePlayerFixture({ job: '전사', level: 10, equip: {} });
    const upgrade = { type: 'armor', name: '견습생의 갑옷', val: 5, jobs: ['전사'] };
    const hint = getLootUpgradeHint(player, [upgrade]);

    assert.ok(hint, '업그레이드 후보가 있으면 힌트가 만들어짐');
    assert.equal(hint.name, '견습생의 갑옷');
    assert.equal(hint.summary, '방어력 +5', '실제 변화가 MSG 라벨과 formatEquipmentDelta 서식을 그대로 씀');
});

test('status 명령은 생명:/기력:/골드:/위치: 같은 직접적 한국어 라벨을 반복한다', () => {
    const player = makePlayerFixture({ name: '테스트', level: 4, job: '전사', hp: 50, mp: 20, gold: 300, loc: '고요한 숲' });
    const stats = calculateFullStats(player);
    const actions = { getFullStats: () => stats };
    const result = parseCommand('status', 'idle', player, actions);

    assert.match(result, /^\[상태\] 레벨 4/);
    for (const label of ['생명:', '기력:', '골드:', '위치:']) {
        assert.ok(result.includes(label), `"${label}" 라벨 포함`);
    }
    assert.ok(!/\[상태\] Lv\.|HP:|MP:|Gold:/.test(result));
});

// 구조 불변식(소스 텍스트) — Playwright 스모크 스크립트, 렌더 대상 없음.
test('smoke verifies the rendered status, enemy, and log vocabulary', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(smoke, /Mobile status bar should expose one readable player summary/);
    assert.match(smoke, /Mobile status avatar should finish loading before visual evidence/);
    assert.match(smoke, /Mobile status bar should not overflow horizontally/);
    assert.match(smoke, /Mobile status should keep equipment detail in the equipment console/);
    assert.match(smoke, /document\.getAnimations\(\)/);
    assert.match(smoke, /writeStateArtifact\('03-arrived-forest', state, page\)/);
    assert.match(smoke, /Enemy status should use the player-facing target label/);
    assert.match(smoke, /Enemy portrait should remain visually identifiable/);
    assert.match(smoke, /Enemy portrait should render a monster family shape/);
    assert.match(smoke, /Combat forecast labels should be at least 9px/);
    assert.match(smoke, /Field log should expose at least one readable type badge/);
    assert.match(smoke, /Status command should use direct Korean metric labels/);
});
