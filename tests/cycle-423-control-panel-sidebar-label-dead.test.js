import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 423: ControlPanel coreButtons sidebarLabel 출력 dead 정리
 *   (cycle 222-422 silent dead config 시리즈 183번째 — output dead field cleanup lens
 *   회귀, cycle 333-356 24-cycle 시리즈 패턴).
 *
 * 발견 (2 dead output fields):
 * - src/components/ControlPanel.tsx coreButtons:
 *     line 217: `sidebarLabel: 'EXP'` (explore button)
 *     line 229: `sidebarLabel: 'MOVE'` (move button)
 * - 호출 사이트 (renderActionButton line 74-84):
 *     `const { key, testId, icon: Icon, label, mobileLabel = label, onClick,
 *             className, disabled = false } = button;`
 *   → sidebarLabel 미destructure. button.sidebarLabel read 0건.
 * - 결과: 두 sidebarLabel 필드 어디로도 흐르지 않는 dead output.
 *
 * 패턴 (cycle 222-422 시리즈 183번째):
 * - cycle 333-356 시리즈: 함수 출력 필드 dead cleanup (24 cycles).
 * - cycle 416: CombatPanel ACTION_BUTTONS tag/detail dead output.
 * - cycle 423: ControlPanel coreButtons sidebarLabel dead output.
 *
 * 수정 (src/components/ControlPanel.tsx):
 * - coreButtons 두 entry에서 `sidebarLabel: '...'` 라인 제거.
 *
 * 회귀 가드:
 * - label / key / icon / onClick 등 다른 필드 그대로.
 * - renderActionButton 동작 그대로 (label / mobileLabel만 read).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 423: ControlPanel sidebarLabel 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const matches = source.match(/sidebarLabel/g) || [];
    assert.equal(matches.length, 0, 'ControlPanel.tsx sidebarLabel 0건');
});

test('cycle 423: 활성 필드 보존 (label / key / icon / onClick)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    // explore 버튼
    assert.ok(/key: 'explore'/.test(source), "explore button key 보존");
    assert.ok(/label: 'EXPLORE'/.test(source), "EXPLORE label 보존");
    // move 버튼
    assert.ok(/key: 'move'/.test(source), "move button key 보존");
    assert.ok(/label: 'MOVE'/.test(source), "MOVE label 보존");
});

test('cycle 423: renderActionButton destructure 정합성 가드 — sidebarLabel 미destructure', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const fnIdx = source.indexOf('const renderActionButton');
    const fnEnd = source.indexOf('return (', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/sidebarLabel/.test(block),
        'renderActionButton 본체 sidebarLabel destructure 0건');
});

test('cycle 422 회귀 가드: MonsterIcon 골렘 includes 1건만', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnStart = source.indexOf('const getMonsterType');
    const fnEnd = source.indexOf('};', fnStart);
    const block = source.slice(fnStart, fnEnd);
    const golemMatches = block.match(/name\.includes\('골렘'\)/g) || [];
    assert.equal(golemMatches.length, 1, "cycle 422 골렘 includes 1건만 보존");
});
