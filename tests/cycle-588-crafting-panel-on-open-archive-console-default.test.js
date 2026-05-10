import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 588: CraftingPanel `onOpenArchiveConsole = null` default unreachable
 *   (cycle 222-587 silent dead config 시리즈 326번째 — redundant default annotation
 *   청소 메가 시리즈 79번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/tabs/CraftingPanel.tsx (line 25):
 *     const CraftingPanel = ({ player, actions, setGameState,
 *         onOpenArchiveConsole = null }: CraftingPanelProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · ControlPanel.tsx:162 — <CraftingPanel ... 4 props 모두 명시>
 *     · 다른 caller 0건.
 * - 결과: onOpenArchiveConsole 항상 명시 전달. default null 도달 불가.
 *
 * 패턴 (cycle 222-587 시리즈 326번째):
 * - cycle 502-587: default 청소 메가 시리즈 86사이클.
 * - cycle 588: components/tabs/ entry-level cleanup (cycle 584 JobChangePanel
 *   동일 패턴).
 *
 * 수정 (src/components/tabs/CraftingPanel.tsx):
 * - signature에서 onOpenArchiveConsole = null → onOpenArchiveConsole.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (ControlPanel) 동작 그대로.
 * - body actions / setGameState 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 588: CraftingPanel signature에서 onOpenArchiveConsole default 0건', async () => {
    const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
    const fnIdx = source.indexOf('const CraftingPanel = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
        'CraftingPanel onOpenArchiveConsole default null 제거');
});

test('cycle 588: 정합성 가드 — ControlPanel callsite 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/<CraftingPanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
        'ControlPanel <CraftingPanel> 4-prop callsite 보존');
});

test('cycle 588: cycle 502-587 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/enemy\s*=\s*null/.test(cp),
        'cycle 587 ControlPanel enemy default 0건');

    const sb = await readSrc('src/components/StatusBar.tsx');
    assert.ok(!/onCrystalClick\s*=\s*null/.test(sb),
        'cycle 586 StatusBar onCrystalClick default 0건');
});
