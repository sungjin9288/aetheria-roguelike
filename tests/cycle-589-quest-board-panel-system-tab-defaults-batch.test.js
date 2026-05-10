import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 589: QuestBoardPanel + SystemTab 2 defaults cross-file batch unreachable
 *   (cycle 222-588 silent dead config 시리즈 327번째 — redundant default annotation
 *   청소 메가 시리즈 80번째). cross-file 2-default batch.
 *
 * 발견 (2 defaults batch, 2 files):
 * - src/components/tabs/QuestBoardPanel.tsx (line 59):
 *     const QuestBoardPanel = ({ player, actions, setGameState,
 *         onOpenArchiveConsole = null }: QuestBoardPanelProps) => {...};
 * - src/components/tabs/SystemTab.tsx (line 28):
 *     const SystemTab = ({ player, actions, stats, runtime = null }:
 *         SystemTabProps) => {...};
 * - 호출 사이트:
 *     · QuestBoardPanel: ControlPanel:158 — 4 props 명시 전달.
 *     · SystemTab: Dashboard:241 — runtime={runtime} 명시 전달.
 * - 결과: 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-588 시리즈 327번째):
 * - cycle 502-588: default 청소 메가 시리즈 87사이클.
 * - cycle 589: components/tabs/ cross-file 2-default batch — cycle 584/588과
 *   동일 onOpenArchiveConsole 패턴 + SystemTab runtime.
 *
 * 수정:
 * - QuestBoardPanel: onOpenArchiveConsole = null → onOpenArchiveConsole.
 * - SystemTab: runtime = null → runtime.
 *
 * 회귀 가드:
 * - 2 production callsite 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 589: 2 defaults 0건', async () => {
    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const qbSig = qb.slice(qb.indexOf('const QuestBoardPanel = '),
                            qb.indexOf('=>', qb.indexOf('const QuestBoardPanel = ')));
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(qbSig),
        'QuestBoardPanel onOpenArchiveConsole default null 제거');

    const st = await readSrc('src/components/tabs/SystemTab.tsx');
    const stSig = st.slice(st.indexOf('const SystemTab = '),
                            st.indexOf('=>', st.indexOf('const SystemTab = ')));
    assert.ok(!/runtime\s*=\s*null/.test(stSig),
        'SystemTab runtime default null 제거');
});

test('cycle 589: 정합성 가드 — production callsite 보존', async () => {
    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/<QuestBoardPanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(cp),
        'ControlPanel <QuestBoardPanel> 4-prop callsite 보존');

    const dash = await readSrc('src/components/Dashboard.tsx');
    assert.ok(/<SystemTab player=\{player\} actions=\{actions\} stats=\{stats\} runtime=\{runtime\}/.test(dash),
        'Dashboard <SystemTab> 4-prop callsite 보존');
});

test('cycle 589: cycle 502-588 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cr = await readSrc('src/components/tabs/CraftingPanel.tsx');
    assert.ok(!/CraftingPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(cr),
        'cycle 588 CraftingPanel onOpenArchiveConsole default 0건');

    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/enemy\s*=\s*null/.test(cp),
        'cycle 587 ControlPanel enemy default 0건');
});
