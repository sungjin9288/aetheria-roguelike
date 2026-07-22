import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('mobile combat places decisions before recent history', async () => {
    const layout = await readSrc('src/components/app/MobileGameLayout.tsx');

    assert.match(layout, /const isCombat = engine\.gameState === GS\.COMBAT/);
    assert.match(layout, /isCombat \? 'order-2 min-h-\[132px\]'/);
    assert.match(layout, /isCombat \? 'order-1 shrink-0'/);
});

test('combat status keeps player resources compact and enemy art prominent', async () => {
    const status = await readSrc('src/components/StatusBar.tsx');

    assert.match(status, /data-status-mode="combat"/);
    assert.match(status, /aether-combat-player-status/);
    assert.match(status, /h-14 w-14/);
    assert.match(status, /size=\{46\}/);
    for (const label of ['생명', '기력', '레벨', '교전 대상']) {
        assert.match(status, new RegExp(label));
    }
});

test('combat actions prioritize attack skill item and escape', async () => {
    const panel = await readSrc('src/components/tabs/CombatPanel.tsx');

    for (const key of ['attack', 'skill', 'item', 'escape']) {
        assert.match(panel, new RegExp(`key:\\s*'${key}'`));
        assert.match(panel, new RegExp(`combat-action-\\$\\{action\\.key\\}`));
    }
    assert.match(panel, /data-testid="combat-skill-cycle"/);
    assert.match(panel, /setItemsOpen\(\(open\) => !open\)/);
    assert.match(panel, /combatConsumables\.length > 0 && \(!mobile \|\| itemsOpen\)/);
});

test('combat history starts at three recent lines and remains expandable', async () => {
    const terminal = await readSrc('src/components/TerminalView.tsx');

    assert.match(terminal, /const SUMMARY_LOG_COUNT = 3/);
    assert.match(terminal, /data-testid="combat-log-toggle"/);
    assert.match(terminal, /aria-expanded=\{logExpanded\}/);
    assert.match(terminal, /data-log-expanded=\{logExpanded \? 'true' : 'false'\}/);
});

test('boss signature and counter are no longer desktop-only', async () => {
    const panel = await readSrc('src/components/tabs/CombatPanel.tsx');

    assert.match(panel, /enemy\?\.isBoss && \(tacticalProfile\?\.signature \|\| tacticalProfile\?\.counterHint\)/);
    assert.match(panel, /\{tacticalProfile\?\.signature &&/);
    assert.match(panel, /\{tacticalProfile\?\.counterHint &&/);
    assert.doesNotMatch(panel, /!mobile && enemy\?\.isBoss && tacticalProfile/);
});

test('combat focus E2E uses a deterministic encounter with a usable item', async () => {
    const testApi = await readSrc('src/hooks/useGameTestApi.ts');
    const e2e = await readSrc('tests/e2e/combat-focus.spec.ts');

    assert.match(testApi, /seedCombatFocusScenario/);
    assert.match(testApi, /type: AT\.SET_ENEMY/);
    assert.match(testApi, /type: AT\.SET_GAME_STATE, payload: GS\.COMBAT/);
    assert.match(e2e, /combat-action-item/);
    assert.match(e2e, /combat-log-toggle/);
});
