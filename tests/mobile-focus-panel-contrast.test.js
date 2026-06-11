import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('mobile focus panels expose a shared contrast contract', async () => {
  const css = await readSrc('src/index.css');

  assert.match(css, /\.aether-focus-panel\s*\{/);
  assert.match(css, /\.aether-event-choice\s*\{/);
  assert.match(css, /\.aether-craft-row\s*\{/);
  assert.match(css, /\.aether-locked-row\s*\{/);
  assert.match(css, /\.aether-lock-note\s*\{/);
  assert.match(css, /\.aether-disabled-action:disabled[\s\S]*opacity:\s*1/);
  assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-focus-panel/);
  assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-lock-note/);
});

test('locked or disabled focus-panel content stays readable instead of fading out', async () => {
  const classCard = await readSrc('src/components/ClassCard.tsx');
  const crafting = await readSrc('src/components/tabs/CraftingPanel.tsx');
  const quest = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
  const shop = await readSrc('src/components/ShopPanel.tsx');

  assert.match(classCard, /aether-locked-row/);
  assert.match(classCard, /aether-lock-note/);
  assert.doesNotMatch(classCard, /opacity-35/);

  assert.match(crafting, /data-craft-state=\{canCraft \? 'ready' : 'locked'\}/);
  assert.match(crafting, /aether-lock-note/);
  assert.match(crafting, /aether-disabled-action/);
  assert.doesNotMatch(crafting, /disabled:opacity-30/);

  assert.match(quest, /aether-locked-row/);
  assert.match(quest, /aether-disabled-action/);
  assert.doesNotMatch(quest, /disabled:opacity-60/);

  assert.match(shop, /aether-disabled-action/);
  assert.doesNotMatch(shop, /disabled:opacity-30/);
  assert.doesNotMatch(shop, /disabled:opacity-65/);
});

test('deterministic mobile focus panels opt into stronger standard-mode surfaces', async () => {
  const event = await readSrc('src/components/EventPanel.tsx');
  const crafting = await readSrc('src/components/tabs/CraftingPanel.tsx');
  const quest = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
  const job = await readSrc('src/components/tabs/JobChangePanel.tsx');
  const shop = await readSrc('src/components/ShopPanel.tsx');

  assert.match(event, /aether-focus-panel/);
  assert.match(event, /aether-event-choice/);
  assert.match(crafting, /aether-focus-panel/);
  assert.match(quest, /aether-focus-panel/);
  assert.match(job, /aether-focus-panel/);
  assert.match(shop, /aether-focus-panel/);
});
