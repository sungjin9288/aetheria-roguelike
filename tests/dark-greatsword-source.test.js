import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('canonical dark greatsword uses the reviewed broad-blade export and preserved original source', () => {
    const source = 'scripts/art_sources/equipment/v3/dark-greatsword';
    assert.deepEqual(readFileSync('public/assets/equipment-exact/auto/auto-4473919467f6.png'), readFileSync(join(source, 'exports/item.png')));
    assert.deepEqual(readFileSync('scripts/art_sources/equipment/v2/weapon-core/weapon-core-sword-04.png'), readFileSync(join(source, 'exports/item-sheet.png')));
    assert.notDeepEqual(readFileSync(join(source, 'previous/item.png')), readFileSync(join(source, 'exports/item.png')));
});

test('dark greatsword replacement uses real finalized provenance without changing neighboring equipment', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aetheria-dark-adoption-'));
    const source = 'scripts/art_sources/equipment/v3/dark-greatsword';
    const sourceDir = 'scripts/art_sources/equipment/v2/weapon-core';
    const provenancePath = 'docs/evidence/art/equipment-weapon-core-provenance.json';
    const manifestPath = 'src/data/equipmentArtManifest.json';
    const target = '암흑의 대검';
    const original = JSON.parse(readFileSync(provenancePath));
    const batch = original.batches.find(entry => entry.identityNames.includes(target));
    const run = (command, args) => {
        const result = spawnSync(command, args, { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        return result;
    };
    try {
        cpSync(sourceDir, join(directory, 'sources'), { recursive: true });
        cpSync(provenancePath, join(directory, 'provenance.json'));
        cpSync(manifestPath, join(directory, 'manifest.json'));
        const exports = original.batches.flatMap(entry => entry.exports);
        for (const entry of exports) {
            const relative = entry.runtimePath.replace(/^\//, '');
            const destination = join(directory, 'public', relative);
            mkdirSync(join(destination, '..'), { recursive: true });
            cpSync(join('public', relative), destination);
        }
        cpSync(join(source, 'exports/item-sheet.png'), join(directory, 'sources', batch.sourceSheet));
        writeFileSync(join(directory, 'declaration.json'), JSON.stringify({ batchId: batch.batchId, identityNames: batch.identityNames }));
        run('node', ['--import', 'tsx', 'scripts/dump-equipment-catalog.mjs', '--output', join(directory, 'catalog.json')]);
        const args = ['scripts/process_equipment_art_batch.py',
            '--batch', join(sourceDir, 'batches', `${batch.batchId}.json`),
            '--catalog', join(directory, 'catalog.json'),
            '--source-sheet', join(directory, 'sources', batch.sourceSheet),
            '--source-declaration', join(directory, 'declaration.json'),
            '--public-root', join(directory, 'public'),
            '--equipment-manifest', join(directory, 'manifest.json'),
            '--provenance', join(directory, 'provenance.json'), '--replace-existing'];
        run('python3', args);
        for (const entry of exports) {
            const relative = entry.runtimePath.replace(/^\//, '');
            assert.deepEqual(readFileSync(join(directory, 'public', relative)),
                readFileSync(entry.name === target ? join(source, 'exports/item.png') : join('public', relative)), entry.name);
        }
        const next = JSON.parse(readFileSync(join(directory, 'provenance.json')));
        assert.deepEqual(next.generationReview, original.generationReview);
        assert.deepEqual(next.batches.filter(entry => entry.batchId !== batch.batchId), original.batches.filter(entry => entry.batchId !== batch.batchId));
        const beforeReplay = readFileSync(join(directory, 'provenance.json'));
        run('python3', args);
        assert.deepEqual(readFileSync(join(directory, 'provenance.json')), beforeReplay);
        run('node', ['scripts/sync-equipment-art-manifest.mjs',
            '--catalog', join(directory, 'catalog.json'), '--manifest', join(directory, 'manifest.json'),
            '--provenance', join(directory, 'provenance.json'), '--source-dir', join(directory, 'sources'),
            '--public-root', join(directory, 'public'), '--output', join(directory, 'manifest.json')]);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('dark greatsword preparation preserves five neighboring cells and produces identical exports', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aetheria-dark-greatsword-'));
    try {
        const run = (name) => spawnSync('python3', ['scripts/art_sources/equipment/v3/dark-greatsword/prepare.py', join(directory, name)], { encoding: 'utf8' });
        const first = run('first');
        assert.equal(first.status, 0, first.stderr);
        const receipt = JSON.parse(first.stdout);
        assert.equal(receipt.runtimeAdopted, false);
        assert.equal(receipt.originalsUnchanged, true);
        assert.equal(receipt.unchangedNeighborCells, 5);
        assert.equal(receipt.targetCell, 'bottom-center');
        assert.equal(receipt.targetCellChanged, true);
        const second = run('second');
        assert.equal(second.status, 0, second.stderr);
        assert.deepEqual(JSON.parse(second.stdout), receipt);
        for (const file of ['item-sheet.png', 'item.png', 'receipt.json']) {
            assert.deepEqual(readFileSync(join(directory, 'first', file)), readFileSync(join(directory, 'second', file)));
        }
        const before = readFileSync(join(directory, 'first', 'receipt.json'));
        assert.notEqual(run('first').status, 0);
        assert.deepEqual(readFileSync(join(directory, 'first', 'receipt.json')), before);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('dark greatsword preparation rejects each original hash drift before creating output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aetheria-dark-drift-'));
    const source = 'scripts/art_sources/equipment/v3/dark-greatsword';
    const originals = ['masters/item.png', 'previous/item-sheet.png', 'previous/item.png'];
    try {
        mkdirSync(join(directory, 'masters'));
        mkdirSync(join(directory, 'previous'));
        for (const changed of originals) {
            for (const file of originals) writeFileSync(join(directory, file), readFileSync(join(source, file)));
            writeFileSync(join(directory, changed), 'invalid original');
            const result = spawnSync('python3', ['-c',
                'import runpy,sys; from pathlib import Path; ns=runpy.run_path(sys.argv[1]); fn=ns["prepare"]; fn.__globals__["SOURCE"]=Path(sys.argv[2]); fn(Path(sys.argv[2])/"output")',
                join(source, 'prepare.py'), directory], { encoding: 'utf8' });
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Original source hash drift/);
            assert.equal(existsSync(join(directory, 'output')), false);
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
