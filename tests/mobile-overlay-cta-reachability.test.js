import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('smoke helper verifies viewport reachability with scroll recovery', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(smoke, /async function verifyActionReachable/);
    assert.match(smoke, /getBoundingClientRect\(\)/);
    assert.match(smoke, /visibleRatio/);
    assert.match(smoke, /scrollIntoViewIfNeeded/);
    assert.match(smoke, /minHitHeight/);
    assert.match(smoke, /pointerEvents !== 'none'/);
});

test('deterministic overlay smoke checks reachable primary and close CTAs', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    [
        'post-combat-continue',
        'post-combat-close',
        'relic-choice-skip',
        'run-summary-share',
        'run-summary-restart',
        'shop-buy-inline',
        'shop-close',
        'mobile-console-open-archive',
        'mobile-console-return-log',
        'menu-town-class',
        'menu-town-quest',
        'menu-town-craft',
        'menu-reset-cancel',
        'job-change-close',
        'quest-board-close',
        'crafting-close',
        'event-close',
        'event-choice-0',
    ].forEach((testId) => {
        assert.match(smoke, new RegExp(testId));
    });

    assert.match(smoke, /Post-combat continue CTA/);
    assert.match(smoke, /Relic choice recommended CTA/);
    assert.match(smoke, /Run summary restart CTA/);
    assert.match(smoke, /Shop close CTA/);
    assert.match(smoke, /first-scan decision area/);
});

test('mobile focus panels expose explicit close and primary CTA test ids', async () => {
    const focusHeader = await readSrc('src/components/FocusPanelHeader.tsx');
    const postCombat = await readSrc('src/components/PostCombatCard.tsx');
    const mobileLayout = await readSrc('src/components/app/MobileGameLayout.tsx');
    const dashboard = await readSrc('src/components/Dashboard.tsx');
    const classCard = await readSrc('src/components/ClassCard.tsx');
    const job = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const quest = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const crafting = await readSrc('src/components/tabs/CraftingPanel.tsx');
    const event = await readSrc('src/components/EventPanel.tsx');

    assert.match(focusHeader, /min-h-\[44px\]/);
    assert.match(postCombat, /data-testid="post-combat-close"/);
    assert.match(postCombat, /min-h-\[44px\] min-w-\[44px\]/);
    assert.match(mobileLayout, /data-testid="mobile-console-open-archive"[\s\S]*min-h-\[44px\]/);
    assert.match(dashboard, /mobile-console-return-log[\s\S]*min-h-\[44px\]/);
    assert.match(dashboard, /data-testid="menu-reset"[\s\S]*min-h-\[44px\]/);
    assert.match(dashboard, /data-testid="menu-reset-confirm"[\s\S]*min-h-\[44px\]/);
    assert.match(dashboard, /data-testid="menu-reset-cancel"[\s\S]*min-h-\[44px\]/);
    assert.match(classCard, /data-testid="job-change-option"/);
    assert.match(job, /backTestId="job-change-close"/);
    assert.match(quest, /backTestId="quest-board-close"/);
    assert.match(quest, /data-testid="quest-board-start-operation"/);
    assert.match(quest, /data-testid="quest-board-accept-mission"/);
    assert.match(crafting, /backTestId="crafting-close"/);
    assert.match(crafting, /data-testid="crafting-recipe-action"/);
    assert.match(crafting, /data-testid="crafting-synthesize-action"/);
    assert.match(event, /backTestId="event-close"/);
    assert.match(event, /data-testid=\{`event-choice-\$\{idx\}`\}/);
});

test('mobile archive console suppresses bottom controls while reset CTAs are active', async () => {
    const mobileLayout = await readSrc('src/components/app/MobileGameLayout.tsx');

    assert.match(mobileLayout, /showArchiveConsole\s*=\s*archiveAvailable && mobileConsoleMode === 'archive'/);
    assert.match(mobileLayout, /\) : !showArchiveConsole \? \(/);
    assert.match(mobileLayout, /\) : null\}/);
});
