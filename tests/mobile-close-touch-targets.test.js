import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');

test('release journey close controls preserve a 44px mobile hit area', async () => {
    const cases = [
        ['ExpeditionDebriefCard.tsx', 'expedition-debrief-close-icon'],
        ['MilestoneStoryCard.tsx', 'milestone-story-close-icon'],
        ['EnhanceDecisionCard.tsx', 'enhance-decision-close'],
        ['ReturnBriefingCard.tsx', 'return-briefing-close-icon'],
    ];
    for (const [file, testId] of cases) {
        const source = await read(file);
        const start = source.indexOf(`data-testid="${testId}"`);
        const end = source.indexOf('</button>', start);
        const button = source.slice(start, end);
        assert.match(button, /(?:h-11\s+w-11|min-h-\[44px\].*min-w-\[44px\])/, file);
    }
});
