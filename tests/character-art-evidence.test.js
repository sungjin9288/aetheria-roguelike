import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REVIEW_PATH = new URL('../docs/evidence/art/character-review-2026-08.md', import.meta.url);

test('tracked character review records the closed immutable 18-row blind score', async () => {
    const review = await readFile(REVIEW_PATH, 'utf8');
    const scoredRows = review
        .split('\n')
        .filter((line) => /^\|\s*(?:0[1-9]|1[0-8])\s*\|/.test(line) && /\|\s*[✅❌]\s*\|/.test(line));

    assert.equal(scoredRows.length, 18, 'independent review must contain exactly 18 scored rows');
    assert.match(review, /Reviewer:\s*Task 3 independent reviewer/);
    assert.match(review, /Review date:\s*2026-08-09/);
    assert.match(review, /Exact job identification:\s*\*\*18\/18 — PASS\*\*/);
    assert.match(review, /Combat-promise match:\s*\*\*17\/18 — PASS\*\*/);
    assert.match(
        scoredRows[15],
        /그림자 주군[\s\S]*다중 타격과 전장 지배[\s\S]*어둠을 쌓아 확정적인 처형[\s\S]*❌/,
        'row 16 must preserve the blind miss and authoritative correction'
    );
    assert.doesNotMatch(review, /(?:gate remains open|게이트.*열려|blind review remains open)/i);
});
