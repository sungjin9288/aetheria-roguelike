import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 584: JobChangePanel `onOpenArchiveConsole = null` default unreachable
 *   (cycle 222-583 silent dead config 시리즈 322번째 — redundant default annotation
 *   청소 메가 시리즈 75번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/tabs/JobChangePanel.tsx (line 19):
 *     const JobChangePanel = ({ player, actions, setGameState,
 *         onOpenArchiveConsole = null }: JobChangePanelProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · ControlPanel.tsx:151 — <JobChangePanel player actions setGameState
 *       onOpenArchiveConsole /> — 4 props 모두 명시.
 *     · 다른 caller 0건.
 * - 결과: onOpenArchiveConsole 항상 명시 전달. default null 도달 불가.
 *
 * 패턴 (cycle 222-583 시리즈 322번째):
 * - cycle 502-583: default 청소 메가 시리즈 82사이클.
 * - cycle 584: components/tabs/ entry-level cleanup.
 *
 * 수정 (src/components/tabs/JobChangePanel.tsx):
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

test('cycle 584: JobChangePanel signature에서 onOpenArchiveConsole default 0건', async () => {
    const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const fnIdx = source.indexOf('const JobChangePanel = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
        'JobChangePanel onOpenArchiveConsole default null 제거');
});

test('cycle 584: 정합성 가드 — ControlPanel callsite 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/<JobChangePanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
        'ControlPanel <JobChangePanel> 4-prop callsite 보존');
});

test('cycle 584: cycle 502-583 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sb = await readSrc('src/components/StatusBar.tsx');
    assert.ok(!/const StatusMetric = \({ label, value, max, variant\s*=\s*'hp'/.test(sb),
        'cycle 583 StatusMetric variant default 0건');

    const cc = await readSrc('src/components/ClassCard.tsx');
    assert.ok(!/const ClassCard = \({ jobName, onSelect, disabled\s*=\s*false/.test(cc),
        'cycle 582 ClassCard disabled default 0건');
});
