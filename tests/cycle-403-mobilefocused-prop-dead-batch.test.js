import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 403: CraftingPanel + JobChangePanel `mobileFocused` interface dead prop 정리
 *   (cycle 222-402 silent dead config 시리즈 165번째 — interface dead lens 연속 3사이클).
 *
 * 발견 (2 components × 2 sites = 4 dead lines):
 *
 * 1) src/components/tabs/CraftingPanel.tsx CraftingPanelProps line 20:
 *    `mobileFocused?: boolean;`
 *    - 본체 destructure: `{ player, actions, setGameState, onOpenArchiveConsole = null }` —
 *      mobileFocused 제외.
 *    - 변수 read 0건.
 *
 * 2) src/components/tabs/JobChangePanel.tsx JobChangePanelProps line 14:
 *    동일 패턴.
 *
 * 3) src/components/ControlPanel.tsx line 200/208에서 두 컴포넌트에 `mobileFocused={mobileFocused}`
 *    prop pass — silent dropped.
 *
 * 비교: EventPanel / QuestBoardPanel / ShopPanel은 mobileFocused destructure + 본체 사용
 *   (활성). CraftingPanel / JobChangePanel만 dead.
 *
 * 패턴 (cycle 222-402 시리즈 165번째):
 * - cycle 401: DashboardProps mobile interface dead 양쪽 정리.
 * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
 * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
 *   `mobile`/`mobileFocused` interface dead lens 3사이클 연속.
 *
 * 수정:
 * 1) CraftingPanelProps에서 `mobileFocused?: boolean;` 제거.
 * 2) JobChangePanelProps에서 `mobileFocused?: boolean;` 제거.
 * 3) ControlPanel.tsx의 두 JSX prop pass에서 `mobileFocused={mobileFocused}` 제거.
 *
 * 회귀 가드:
 * - EventPanel / QuestBoardPanel / ShopPanel mobileFocused 사용 보존 (활성).
 * - CraftingPanel / JobChangePanel 활성 props (player/actions/setGameState/
 *   onOpenArchiveConsole) 동작 그대로.
 * - cycle 401/402 dead prop 정리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 403: CraftingPanelProps에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
    const ifaceStart = source.indexOf('interface CraftingPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/mobileFocused\?:/.test(ifaceBlock),
        'CraftingPanelProps에서 mobileFocused 0건');
});

test('cycle 403: JobChangePanelProps에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const ifaceStart = source.indexOf('interface JobChangePanelProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/mobileFocused\?:/.test(ifaceBlock),
        'JobChangePanelProps에서 mobileFocused 0건');
});

test('cycle 403: ControlPanel CraftingPanel/JobChangePanel JSX에서 mobileFocused prop 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const craftStart = source.indexOf('<CraftingPanel');
    const craftEnd = source.indexOf('/>', craftStart);
    assert.ok(craftStart >= 0 && craftEnd > craftStart, 'CraftingPanel JSX 발견');
    const craftBlock = source.slice(craftStart, craftEnd);
    assert.ok(!/mobileFocused=\{mobileFocused\}/.test(craftBlock),
        'CraftingPanel JSX에서 mobileFocused prop 0건');

    const jobStart = source.indexOf('<JobChangePanel');
    const jobEnd = source.indexOf('/>', jobStart);
    assert.ok(jobStart >= 0 && jobEnd > jobStart, 'JobChangePanel JSX 발견');
    const jobBlock = source.slice(jobStart, jobEnd);
    assert.ok(!/mobileFocused=\{mobileFocused\}/.test(jobBlock),
        'JobChangePanel JSX에서 mobileFocused prop 0건');
});

test('cycle 403: 활성 컴포넌트 mobileFocused 보존 (회귀 가드)', async () => {
    // cycle 487이 QuestBoardPanel mobileFocused cascade로 정리. 잔존 EventPanel /
    // ShopPanel만 가드.
    for (const f of ['src/components/EventPanel.tsx', 'src/components/ShopPanel.tsx']) {
        const source = await readSrc(f);
        assert.ok(/mobileFocused\?:/.test(source),
            `${f} mobileFocused 보존 (활성)`);
    }
});

test('cycle 402 회귀 가드: PostCombatCard / IntroScreen mobile 0건', async () => {
    const pcc = await readSrc('src/components/PostCombatCard.tsx');
    const ifaceStart1 = pcc.indexOf('interface PostCombatCardProps');
    const ifaceEnd1 = pcc.indexOf('}', ifaceStart1);
    assert.ok(!/^\s+mobile\?:/m.test(pcc.slice(ifaceStart1, ifaceEnd1)),
        'cycle 402 PostCombatCard mobile 0건 보존');

    const intro = await readSrc('src/components/IntroScreen.tsx');
    const ifaceStart2 = intro.indexOf('interface IntroScreenProps');
    const ifaceEnd2 = intro.indexOf('}', ifaceStart2);
    assert.ok(!/^\s+mobile\?:/m.test(intro.slice(ifaceStart2, ifaceEnd2)),
        'cycle 402 IntroScreen mobile 0건 보존');
});
