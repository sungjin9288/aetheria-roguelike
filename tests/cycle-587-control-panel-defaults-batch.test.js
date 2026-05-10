import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 587: ControlPanel 3 defaults batch unreachable
 *   (cycle 222-586 silent dead config 시리즈 325번째 — redundant default annotation
 *   청소 메가 시리즈 78번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/components/ControlPanel.tsx (line 38):
 *     const ControlPanel = ({
 *         gameState, player,
 *         enemy = null,
 *         actions, setGameState, shopItems, grave, isAiThinking, currentEvent,
 *         stats = null,
 *         onOpenArchiveConsole = null,
 *     }: ControlPanelProps) => {...};
 * - 호출 사이트 (2 callers):
 *     · MobileGameLayout.tsx:106 — <ControlPanel ... 12 props 모두 명시>
 *     · MobileGameLayout.tsx:121 — <ControlPanel ... 12 props 모두 명시>
 * - 결과: enemy / stats / onOpenArchiveConsole 항상 명시 전달. 3 defaults
 *   모두 도달 불가.
 *
 * 패턴 (cycle 222-586 시리즈 325번째):
 * - cycle 502-586: default 청소 메가 시리즈 85사이클.
 * - cycle 587: components/ entry-level cleanup — cycle 572-586 시리즈 연속.
 *
 * 수정 (src/components/ControlPanel.tsx):
 * - signature에서 3 defaults 모두 제거.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 2 production callsite (MobileGameLayout) 동작 그대로.
 * - body GS 분기 / panel rendering 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 587: ControlPanel signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const fnIdx = source.indexOf('const ControlPanel = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/enemy\s*=\s*null/.test(sig), 'ControlPanel enemy default null 제거');
    assert.ok(!/stats\s*=\s*null/.test(sig), 'ControlPanel stats default null 제거');
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig), 'ControlPanel onOpenArchiveConsole default null 제거');
});

test('cycle 587: 정합성 가드 — 2 MobileGameLayout callsite 보존', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const matches = source.match(/<ControlPanel[\s\S]*?\/>/g) || [];
    assert.equal(matches.length, 2, `<ControlPanel> 2 callsite 보존: ${matches.length}건`);
    for (const match of matches) {
        assert.ok(/enemy=\{engine\.enemy\}/.test(match), 'enemy 명시 전달 보존');
        assert.ok(/stats=\{fullStats\}/.test(match), 'stats 명시 전달 보존');
        assert.ok(/onOpenArchiveConsole=\{openArchiveConsole\}/.test(match), 'onOpenArchiveConsole 명시 전달 보존');
    }
});

test('cycle 587: cycle 502-586 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sb = await readSrc('src/components/StatusBar.tsx');
    assert.ok(!/onCrystalClick\s*=\s*null/.test(sb),
        'cycle 586 StatusBar onCrystalClick default 0건');

    const ii = await readSrc('src/components/icons/ItemIcon.tsx');
    assert.ok(!/const ItemIcon = \({ item, size\s*=\s*24/.test(ii),
        'cycle 585 ItemIcon size default 0건');
});
