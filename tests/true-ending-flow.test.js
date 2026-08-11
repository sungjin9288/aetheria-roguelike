import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    ENDING_LINES,
    buildTrueEndingStars,
    getNextTrueEndingTimedStep,
    resolveTrueEndingBackAction,
} from '../src/utils/trueEndingPresentation.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test('true ending timed narrative advances deterministically into a complete surface', () => {
    assert.equal(ENDING_LINES.length, 5);
    assert.deepEqual(getNextTrueEndingTimedStep(0), {
        delayMs: 1800,
        nextLineIndex: 1,
        revealState: 'narrative',
    });
    assert.deepEqual(getNextTrueEndingTimedStep(ENDING_LINES.length), {
        delayMs: 600,
        nextLineIndex: ENDING_LINES.length,
        revealState: 'complete',
    });
});

test('true ending star field is byte-stable and does not require global randomness', () => {
    const first = buildTrueEndingStars(60);
    const second = buildTrueEndingStars(60);
    assert.deepEqual(first, second);
    assert.equal(first.length, 60);
    assert.equal(new Set(first.map((star) => JSON.stringify(star))).size, 60);
});

test('platform back reveals an incomplete ending and consumes a completed ending', () => {
    assert.equal(resolveTrueEndingBackAction('narrative'), 'reveal_all');
    assert.equal(resolveTrueEndingBackAction('complete'), 'consume');
});

test('true ending source exposes immediate skip, reduced-motion, safe-area and one-shot controls', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/TrueEndingScreen.tsx'), 'utf8');

    assert.doesNotMatch(source, /Math\.random/);
    assert.match(source, /useReducedMotion\(\)/);
    assert.match(source, /data-testid="true-ending-skip"/);
    assert.match(source, /revealAll/);
    assert.match(source, /usePlatformBackHandler\(true,[\s\S]*500\)/);
    assert.match(source, /confirmationAcceptedRef/);
    assert.match(source, /h-\[100dvh\]/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /overflow-x-hidden/);
    assert.match(source, /min-h-\[44px\]/);
    assert.match(source, /--aether-safe-area-top/);
    assert.match(source, /--aether-safe-area-bottom/);
});
