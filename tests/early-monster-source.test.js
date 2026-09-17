import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('early monster preparation preserves masters and exports deterministic padded silhouettes', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'aetheria-early-monsters-'));
    try {
        const run = name => spawnSync('python3', [
            'scripts/art_sources/monsters/v6/prepare.py', join(temporary, name),
        ], { encoding: 'utf8' });
        const first = run('first');
        assert.equal(first.status, 0, first.stderr);
        const second = run('second');
        assert.equal(second.status, 0, second.stderr);
        for (const name of ['goblin', 'kobold', 'green-slime']) {
            const file = `${name}.png`;
            assert.deepEqual(readFileSync(join(temporary, 'first', file)), readFileSync(join(temporary, 'second', file)));
            const inspection = spawnSync('python3', ['scripts/inspect_art_pixels.py', '--path', join(temporary, 'first', file), '--margin', '8', '--foot-baseline', '151'], { encoding: 'utf8' });
            assert.equal(inspection.status, 0, inspection.stderr);
            const result = JSON.parse(inspection.stdout);
            assert.equal(result.boundsWithinMargin, true);
            assert.equal(result.footBaselineMatches, true);
            assert.equal(result.hasTransparentPixels, true);
            const bytes = readFileSync(join(temporary, 'first', file));
            assert.equal(bytes.readUInt32BE(16), 160);
            assert.equal(bytes.readUInt32BE(20), 160);
        }
        assert.equal(JSON.parse(first.stdout).originalsUnchanged, true);
        assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));
        const original = readFileSync(join(temporary, 'first', 'goblin.png'));
        assert.notEqual(run('first').status, 0);
        assert.deepEqual(readFileSync(join(temporary, 'first', 'goblin.png')), original);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});
