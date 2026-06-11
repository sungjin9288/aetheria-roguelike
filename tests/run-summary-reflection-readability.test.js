import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRunSummaryAnalysis, getRunSummaryReflectionStrip } from '../src/utils/outcomeAnalysis.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const buildReflection = (summary) => {
    const analysis = getRunSummaryAnalysis(summary);
    return getRunSummaryReflectionStrip(summary, analysis);
};

test('run summary reflection: high escapes produce a pressure recovery lesson', () => {
    const reflection = buildReflection({
        level: 18,
        kills: 120,
        bossKills: 0,
        relicsFound: 4,
        totalGold: 4200,
        escapes: 12,
        discoveries: 8,
        maxKillStreak: 4,
        primaryBuild: '균형형 런',
        difficultyLabel: '열세',
        recentWinRate: 42,
    });

    assert.equal(reflection.tone, 'pressure');
    assert.deepEqual(reflection.cells.map((cell) => cell.label), ['CAUSE', 'LESSON', 'NEXT']);
    assert.equal(reflection.cells[0].value, '후퇴 누적');
    assert.match(reflection.cells[2].value, /회복|장비/);
});

test('run summary reflection: boss progress and strong run signals become breakthrough', () => {
    const reflection = buildReflection({
        level: 17,
        kills: 142,
        bossKills: 3,
        relicsFound: 5,
        totalGold: 1842,
        escapes: 2,
        discoveries: 16,
        maxKillStreak: 12,
        primaryBuild: '치명 MP',
        difficultyLabel: '열세',
        recentWinRate: 42,
    });

    assert.equal(reflection.tone, 'breakthrough');
    assert.equal(reflection.cells[0].value, '보스권 도달');
    assert.match(reflection.cells[1].value, /빌드|streak|루트/);
});

test('RunSummaryCard wires reflection strip without touching share or restart controls', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');

    assert.match(source, /getRunSummaryReflectionStrip\(s,\s*analysis\)/);
    assert.match(source, /data-testid\s*=\s*["']run-summary-reflection-strip["']/);
    assert.match(source, /data-run-tone=\{reflection\.tone\}/);
    assert.match(source, /reflection\.cells\.map/);
    assert.match(source, /cell\.label/);
    assert.match(source, /cell\.value/);
    assert.match(source, /max-h-\[calc\(100svh-1rem\)\]/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /whitespace-normal/);
    assert.match(source, /break-keep/);
    assert.doesNotMatch(source, /truncate font-rajdhani/);
    assert.match(source, /data-testid\s*=\s*["']run-summary-share["']/);
    assert.match(source, /data-testid\s*=\s*["']run-summary-restart["']/);
});

test('smoke coverage captures deterministic run summary reflection output', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');
    const testApi = await readSrc('src/hooks/useGameTestApi.ts');

    assert.match(smoke, /verifyRunSummaryReflectionStrip/);
    assert.match(smoke, /run-summary-reflection-strip/);
    assert.match(smoke, /02f-run-summary-reflection-strip/);
    assert.match(smoke, /injectRunSummary/);
    assert.match(smoke, /data-run-tone/);
    assert.match(testApi, /maxKillStreak:\s*12/);
    assert.match(testApi, /discoveries:\s*16/);
});

test('run summary reflection styling participates in high readability mode', async () => {
    const css = await readSrc('src/index.css');

    assert.match(css, /\.aether-run-reflection-strip/);
    assert.match(css, /\.aether-run-reflection-cell/);
    assert.match(css, /data-run-tone="pressure"/);
    assert.match(css, /data-run-tone="growth"/);
    assert.match(css, /data-run-tone="breakthrough"/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-run-reflection-strip/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-run-reflection-cell/);
});
