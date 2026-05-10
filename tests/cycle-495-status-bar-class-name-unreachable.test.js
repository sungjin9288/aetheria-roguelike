import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 495: StatusBar `className` prop unreachable 정리
 *   (cycle 222-494 silent dead config 시리즈 246번째 — unreachable code path
 *   cleanup lens, cycle 463/465/466/493 같은 패턴 회귀).
 *
 * 발견 (1 prop unreachable):
 * - src/components/StatusBar.tsx (line 97-108):
 *     interface StatusBarProps { ..., className?: string, ... }
 *     destructure: className = ''
 *     body line 125: className={`... ${className}`.trim()}
 * - 호출 사이트 분석:
 *     · GameRoot.tsx:89 — <StatusBar /> 호출 (className 0건).
 *     · 다른 파일 import 0건.
 * - 결과: className 항상 ''. body의 ${className} 보간은 .trim()으로 빈 문자열만
 *   제거되는 unreachable.
 *
 * 패턴 (cycle 222-494 시리즈 246번째):
 * - cycle 463/465/466: ClassIcon/MonsterIcon/SignatureBadge className unreachable.
 * - cycle 493: AetherMark className unreachable.
 * - cycle 495: StatusBar className unreachable — 동일 lens 회귀.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - interface에서 className?: string 제거.
 * - destructure에서 className = '' 제거.
 * - body className 템플릿에서 ${className} 보간 제거 → 정적 문자열 (.trim() 제거).
 *
 * 회귀 가드:
 * - player / stats / enemy / onCrystalClick / isMuted / onToggleMute /
 *   onOpenEquipment props 보존.
 * - 1 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 495: StatusBar destructure에서 className 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusBar = ({');
    const fnEnd = source.indexOf('}: StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\b/.test(block), 'destructure에 className 0건');
});

test('cycle 495: interface에서 className 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const ifaceIdx = source.indexOf('interface StatusBarProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bclassName\b/.test(block), 'interface에 className 0건');
});

test('cycle 495: body ${className} 보간 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    // body 'className' attribute 자체는 여러 div에 있으므로 ${className} interpolation만 검사
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
});

test('cycle 495: 정합성 가드 — GameRoot <StatusBar> className 전달 0건', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    const idx = source.indexOf('<StatusBar');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/className=/.test(jsx), 'GameRoot <StatusBar> className 전달 0건');
});

test('cycle 495: 핵심 props 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusBar = ({');
    const fnEnd = source.indexOf('}: StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(block), 'player prop 보존');
    assert.ok(/\bstats\b/.test(block), 'stats prop 보존');
    assert.ok(/\benemy\b/.test(block), 'enemy prop 보존');
    assert.ok(/onCrystalClick/.test(block), 'onCrystalClick prop 보존');
    assert.ok(/isMuted/.test(block), 'isMuted prop 보존');
    assert.ok(/onToggleMute/.test(block), 'onToggleMute prop 보존');
    assert.ok(/onOpenEquipment/.test(block), 'onOpenEquipment prop 보존');
});
