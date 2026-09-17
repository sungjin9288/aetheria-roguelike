import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Earth Verdict preparation preserves sources and five neighboring cells deterministically', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aetheria-earth-verdict-'));
    const script = 'scripts/art_sources/equipment/v3/earth-verdict/prepare.py';
    try {
        const run = (name) => spawnSync('python3', [script, join(directory, name)], { encoding: 'utf8' });
        const first = run('first');
        assert.equal(first.status, 0, first.stderr);
        const receipt = JSON.parse(first.stdout);
        assert.equal(receipt.runtimeAdopted, false);
        assert.equal(receipt.originalsUnchanged, true);
        for (const surface of ['item', 'overlay']) {
            assert.equal(receipt.surfaces[surface].unchangedNeighborCells, 5);
            assert.equal(receipt.surfaces[surface].targetCellChanged, true);
        }
        const second = run('second');
        assert.equal(second.status, 0, second.stderr);
        assert.deepEqual(JSON.parse(second.stdout), receipt);
        for (const file of ['item-sheet.png', 'overlay-sheet.png', 'item.png', 'overlay.png', 'receipt.json']) {
            assert.deepEqual(readFileSync(join(directory, 'first', file)), readFileSync(join(directory, 'second', file)));
        }
        const before = readFileSync(join(directory, 'first', 'receipt.json'));
        assert.notEqual(run('first').status, 0);
        assert.deepEqual(readFileSync(join(directory, 'first', 'receipt.json')), before);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
