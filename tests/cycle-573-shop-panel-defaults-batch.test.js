import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 573: ShopPanel `stats = null` + `onOpenArchiveConsole = null` defaults
 *   batch unreachable (cycle 222-572 silent dead config 시리즈 312번째 —
 *   redundant default annotation 청소 메가 시리즈 65번째).
 *
 * 발견 (2 defaults batch):
 * - src/components/ShopPanel.tsx (line 113):
 *     const ShopPanel = ({ player, actions, shopItems, setGameState,
 *         stats = null, onOpenArchiveConsole = null }: ShopPanelProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · ControlPanel.tsx:147 — <ShopPanel player actions shopItems setGameState
 *       stats onOpenArchiveConsole /> — 6 props 모두 명시 전달.
 *     · 다른 caller 0건.
 * - 결과: stats / onOpenArchiveConsole 항상 명시 전달. 두 default 모두 도달
 *   불가.
 *
 * 패턴 (cycle 222-572 시리즈 312번째):
 * - cycle 502-572: default 청소 메가 시리즈 71사이클.
 * - cycle 573: components/ entry-level cleanup — cycle 572 Dashboard에 이은
 *   대형 컴포넌트 default cleanup.
 *
 * 수정 (src/components/ShopPanel.tsx):
 * - signature에서 stats = null → stats.
 * - signature에서 onOpenArchiveConsole = null → onOpenArchiveConsole.
 * - body의 stats / onOpenArchiveConsole 사용처 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (ControlPanel) 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 573: ShopPanel signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const ShopPanel = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats\s*=\s*null/.test(sig),
        'ShopPanel stats default null 제거');
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
        'ShopPanel onOpenArchiveConsole default null 제거');
});

test('cycle 573: 정합성 가드 — ControlPanel callsite 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/<ShopPanel player=\{player\} actions=\{actions\} shopItems=\{shopItems\} setGameState=\{setGameState\} stats=\{stats\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
        'ControlPanel <ShopPanel> 6-prop callsite 보존');
});

test('cycle 573: cycle 502-572 회귀 가드 — default 청소 시리즈 보존', async () => {
    const dash = await readSrc('src/components/Dashboard.tsx');
    assert.ok(!/mobileSection\s*=\s*'full'/.test(dash),
        'cycle 572 Dashboard mobileSection default 0건');

    const mi = await readSrc('src/components/icons/MonsterIcon.tsx');
    assert.ok(!/const MonsterIcon = \({ name, discovered\s*=\s*false/.test(mi),
        'cycle 571 MonsterIcon discovered default 0건');
});
