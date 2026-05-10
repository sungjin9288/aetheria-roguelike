import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 486: ControlPanel `mobileFocused` cascade unreachable 정리
 *   (cycle 222-485 silent dead config 시리즈 238번째 — unreachable code path
 *   cascade cleanup, cycle 471-485 패턴 회귀).
 *
 * 발견 (1 default + 1 state + 1 helper + 2 unreachable 블록 + 1 ternary 가지):
 * - src/components/ControlPanel.tsx:
 *     · destructure `mobileFocused = false` default.
 *     · useState confirmReset / setConfirmReset (renderResetControl 전용).
 *     · const renderResetControl helper.
 *     · line 181 EVENT-아이싱크: `mobileFocused ? <mobile-focused class> :
 *       <non-mobile class>` ternary.
 *     · line 331-335: `{!mobileFocused && !isSafeZone && renderResetControl(...)}`
 *     · line 338-342: `{!mobileFocused && isSafeZone && renderResetControl(...)}`
 * - 호출 사이트 분석:
 *     · MobileGameLayout.tsx:108 / 124 — 2 callsite 모두 mobileFocused (= true via
 *       shorthand) 전달.
 *     · 다른 파일 import 0건 (MobileGameLayout만 import).
 * - 결과: mobileFocused 항상 true → default `= false` 도달 불가.
 *   `!mobileFocused && ...` 항상 false → 2 renderResetControl 호출 unreachable
 *   → renderResetControl helper 자체 dead → confirmReset state cascade dead.
 *   line 181 ternary 첫 가지만 진입.
 *
 * 패턴 (cycle 222-485 시리즈 238번째):
 * - cycle 471-482: Dashboard cascade.
 * - cycle 485: CombatPanel cascade.
 * - cycle 486: ControlPanel mobileFocused cascade — 동일 lens 회귀.
 *
 * 수정 (src/components/ControlPanel.tsx):
 * - destructure에서 mobileFocused = false → mobileFocused (default 제거).
 * - useState confirmReset + setConfirmReset 제거 (cascade dead).
 * - renderResetControl helper 제거 (callsite 0건).
 * - line 181 ternary → mobile-focused 가지만 inline.
 * - line 331-342 unreachable 두 블록 제거.
 * - cycle 444 stale 가드 (handleMenuAction 'reset' 분기) 영향 검토 — 별개 패스.
 *
 * 회귀 가드:
 * - mobileFocused prop은 보존 (subchildren ShopPanel/QuestBoardPanel/EventPanel
 *   에 forward 필요 — 후속 cycle에서 cascade 가능).
 * - core 구조 (renderActionButton / coreButtons / safeZoneButtons / auxiliaryButtons /
 *   actionGridClass / GS state 분기 / Combat-Panel 호출) 모두 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 486: ControlPanel mobileFocused cycle 489 cascade로 prop 자체 제거', async () => {
    // cycle 489가 4사이클 cascade 마무리하며 ControlPanel destructure / interface
    // 에서도 mobileFocused 완전 제거. 이전 default 가드 → cascade 보존 가드로 약화.
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/mobileFocused/.test(source), 'cycle 489 cascade로 mobileFocused 제거 보존');
});

test('cycle 486: renderResetControl helper / 2 unreachable 블록 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/renderResetControl/.test(source), 'renderResetControl 0건');
    assert.ok(!/!mobileFocused\s*&&\s*!isSafeZone/.test(source), '!mobileFocused && !isSafeZone 가드 0건');
    assert.ok(!/!mobileFocused\s*&&\s*isSafeZone/.test(source), '!mobileFocused && isSafeZone 가드 0건');
});

test('cycle 486: confirmReset state cascade dead 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/confirmReset/.test(source), 'confirmReset / setConfirmReset 0건');
});

test('cycle 486: line 181 EVENT 분기 ternary 첫 가지 inline (mobile-focused class)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    // EVENT + isAiThinking 분기 className에서 mobile-focused 가지만 진입
    assert.ok(/aether-surface-strong relative z-20 flex min-h-0 flex-1 items-center justify-center/.test(source),
        'mobile-focused EVENT 분기 className 보존');
    // non-mobile-focused 가지는 제거
    assert.ok(!/panel-noise mt-4 rounded-lg border border-cyber-purple\/50/.test(source),
        'non-mobile-focused EVENT 가지 제거');
});

test('cycle 486: MobileGameLayout 2 callsite mobileFocused cycle 489 cascade로 제거', async () => {
    // cycle 489 paired completion으로 callsite의 mobileFocused 명시 전달도 모두 제거.
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const matches = source.match(/<ControlPanel[\s\S]*?\/>/g) || [];
    assert.equal(matches.length, 2, 'ControlPanel 호출 2건');
    matches.forEach((m, i) => {
        assert.ok(!/mobileFocused/.test(m), `callsite ${i}에 mobileFocused 0건 (cascade 완료)`);
    });
});

test('cycle 486: core 구조 보존 (renderActionButton / coreButtons / GS 분기 등)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/renderActionButton/.test(source), 'renderActionButton 보존');
    assert.ok(/coreButtons/.test(source), 'coreButtons 보존');
    assert.ok(/GS\.COMBAT/.test(source), 'GS.COMBAT 분기 보존');
    assert.ok(/<CombatPanel/.test(source), '<CombatPanel> 호출 보존');
});
