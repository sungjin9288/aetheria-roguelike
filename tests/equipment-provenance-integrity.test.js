import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_SCRIPT = resolve(REPO_ROOT, 'scripts/dump-equipment-catalog.mjs');
const PROMPT_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_art_prompts.mjs');
const PROCESSOR_SCRIPT = resolve(REPO_ROOT, 'scripts/process_equipment_art_batch.py');
const MANIFEST_PATH = resolve(REPO_ROOT, 'src/data/equipmentArtManifest.json');
const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

const runNodeScript = (script, args) => spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    encoding: 'utf8',
});

const runProcessor = (fixture) => spawnSync('python3', [
    PROCESSOR_SCRIPT,
    '--batch', fixture.batchPath,
    '--catalog', fixture.catalogPath,
    '--source-sheet', fixture.sourceSheetPath,
    '--source-declaration', fixture.declarationPath,
    '--public-root', fixture.publicRoot,
    '--equipment-manifest', fixture.manifestPath,
    '--provenance', fixture.provenancePath,
], { encoding: 'utf8' });

const replayKey = (record) => createHash('sha256').update(JSON.stringify({
    batchId: record.batchId,
    sourceSheetSha256: record.sourceSheetSha256,
    identityNames: record.identityNames,
})).digest('hex');

const createSourceSheet = (path) => {
    const script = [
        'from PIL import Image, ImageDraw',
        'image = Image.new("RGBA", (600, 400), (0, 0, 0, 0))',
        'draw = ImageDraw.Draw(image)',
        'for index in range(6):',
        '    column = index % 3',
        '    row = index // 3',
        '    left = column * 200 + 48',
        '    top = row * 200 + 40',
        '    draw.rectangle((left, top, left + 92, top + 118), fill=(40 + index * 30, 90, 170, 255))',
        `image.save(${JSON.stringify(path)})`,
    ].join('\n');
    const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

const createFixture = async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-provenance-integrity-'));
    const catalogPath = join(directory, 'catalog.json');
    const batchPath = join(directory, 'batch.json');
    const declarationPath = join(directory, 'declaration.json');
    const sourceSheetPath = join(directory, 'source-sheet.png');
    const manifestPath = join(directory, 'equipmentArtManifest.json');
    const dump = runNodeScript(DUMP_SCRIPT, ['--output', catalogPath]);
    assert.equal(dump.status, 0, dump.stderr);
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    const selected = catalog.filter((row) => row.cohort === 'weapon-core').slice(0, 6);
    const priorIdentities = catalog.filter((row) => row.cohort === 'weapon-core').slice(6, 12);
    assert.equal(selected.length, 6);
    assert.equal(priorIdentities.length, 6);
    const prompt = runNodeScript(PROMPT_SCRIPT, [
        '--catalog', catalogPath,
        '--batch-id', 'active-batch',
        '--names', selected.map((row) => row.name).reverse().join(','),
        '--output', batchPath,
    ]);
    assert.equal(prompt.status, 0, prompt.stderr);
    const batch = JSON.parse(await readFile(batchPath, 'utf8'));
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    await writeFile(declarationPath, `${JSON.stringify({
        batchId: batch.batchId,
        identityNames: batch.identityNames,
    })}\n`);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    createSourceSheet(sourceSheetPath);
    return {
        batch,
        batchPath,
        catalogPath,
        declarationPath,
        directory,
        manifestPath,
        priorIdentities,
        sourceSheetPath,
        async dispose() {
            await rm(directory, { recursive: true, force: true });
        },
    };
};

const canonicalPriorRecord = (batch, identities) => {
    const record = {
        batchId: 'prior-batch',
        catalogSha256: batch.catalogSha256,
        catalogRowsSha256: batch.catalogRowsSha256,
        cohort: batch.cohort,
        identityNames: identities.map((identity) => identity.name),
        sourceSheet: 'prior-source-sheet.png',
        sourceSheetSha256: '1'.repeat(64),
        replayKey: '',
        exports: identities.map((identity, index) => ({
            cell: CELL_ORDER[index],
            name: identity.name,
            runtimePath: identity.runtimePath,
            exportSha256: String(index + 2).repeat(64),
        })),
    };
    record.replayKey = replayKey(record);
    return record;
};

const caseFixture = (fixture, index) => ({
    ...fixture,
    publicRoot: join(fixture.directory, `case-${index}`, 'public'),
    provenancePath: join(fixture.directory, `case-${index}`, 'provenance.json'),
});

const runtimePaths = (fixture) => fixture.batch.identities.map((identity) => (
    join(fixture.publicRoot, identity.runtimePath.slice(1))
));

const seedExistingOutputs = async (fixture) => {
    const paths = runtimePaths(fixture);
    for (const [index, path] of paths.entries()) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `existing-output-${index}`);
    }
    return paths;
};

const readSnapshot = async (paths) => Promise.all(paths.map((path) => readFile(path)));

test('processor rejects every malformed prior version-1 provenance record without byte changes', async (t) => {
    const fixture = await createFixture();
    const mutations = [
        ['missing catalogSha256', (record) => { delete record.catalogSha256; }],
        ['invalid catalogSha256', (record) => { record.catalogSha256 = 'invalid'; }],
        ['inactive catalogSha256', (record) => { record.catalogSha256 = 'a'.repeat(64); }],
        ['missing catalogRowsSha256', (record) => { delete record.catalogRowsSha256; }],
        ['invalid catalogRowsSha256', (record) => { record.catalogRowsSha256 = 'invalid'; }],
        ['inactive catalogRowsSha256', (record) => { record.catalogRowsSha256 = 'b'.repeat(64); }],
        ['missing cohort', (record) => { delete record.cohort; }],
        ['unsupported cohort', (record) => { record.cohort = 'unsupported'; }],
        ['catalog cohort mismatch', (record) => { record.cohort = 'armor'; }],
        ['missing sourceSheet', (record) => { delete record.sourceSheet; }],
        ['empty sourceSheet', (record) => { record.sourceSheet = '  '; }],
        ['invalid sourceSheetSha256', (record) => { record.sourceSheetSha256 = 'invalid'; }],
        ['missing replayKey', (record) => { delete record.replayKey; }],
        ['invalid replayKey', (record) => { record.replayKey = 'invalid'; }],
        ['non-derived replayKey', (record) => { record.replayKey = 'c'.repeat(64); }],
        ['duplicate identityNames', (record) => {
            record.identityNames[1] = record.identityNames[0];
            record.exports[1].name = record.exports[0].name;
            record.replayKey = replayKey(record);
        }],
        ['missing exports', (record) => { delete record.exports; }],
        ['missing export cell', (record) => { delete record.exports[0].cell; }],
        ['out-of-order export cell', (record) => { record.exports[0].cell = CELL_ORDER[1]; }],
        ['missing export name', (record) => { delete record.exports[0].name; }],
        ['export name does not match ordered identity', (record) => { record.exports[0].name = record.identityNames[1]; }],
        ['missing export runtimePath', (record) => { delete record.exports[0].runtimePath; }],
        ['invalid export runtimePath prefix', (record) => { record.exports[0].runtimePath = '/assets/items/wrong.png'; }],
        ['traversing export runtimePath', (record) => { record.exports[0].runtimePath = '/assets/equipment-exact/../wrong.png'; }],
        ['inactive export runtimePath', (record) => { record.exports[0].runtimePath = '/assets/equipment-exact/auto/wrong.png'; }],
        ['duplicate export runtimePath', (record) => { record.exports[1].runtimePath = record.exports[0].runtimePath; }],
        ['missing export hash', (record) => { delete record.exports[0].exportSha256; }],
        ['invalid export hash', (record) => { record.exports[0].exportSha256 = 'invalid'; }],
        ['unexpected record field', (record) => { record.untrusted = true; }],
        ['unexpected export field', (record) => { record.exports[0].untrusted = true; }],
    ];

    try {
        for (const [index, [name, mutate]] of mutations.entries()) {
            await t.test(name, async () => {
                const current = caseFixture(fixture, index);
                const paths = await seedExistingOutputs(current);
                const beforeOutputs = await readSnapshot(paths);
                const record = structuredClone(canonicalPriorRecord(fixture.batch, fixture.priorIdentities));
                mutate(record);
                const ledgerBytes = Buffer.from(`${JSON.stringify({ version: 1, batches: [record] })}\n`);
                await writeFile(current.provenancePath, ledgerBytes);

                const result = runProcessor(current);

                assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`);
                assert.match(result.stderr, /Invalid provenance ledger/);
                assert.deepEqual(await readSnapshot(paths), beforeOutputs);
                assert.deepEqual(await readFile(current.provenancePath), ledgerBytes);
            });
        }
    } finally {
        await fixture.dispose();
    }
});

test('processor accepts a canonical active-catalog prior record and appends one new record', async () => {
    const fixture = await createFixture();
    const current = caseFixture(fixture, 'canonical');
    try {
        const prior = canonicalPriorRecord(fixture.batch, fixture.priorIdentities);
        await mkdir(dirname(current.provenancePath), { recursive: true });
        await writeFile(current.provenancePath, `${JSON.stringify({ version: 1, batches: [prior] })}\n`);

        const result = runProcessor(current);

        assert.equal(result.status, 0, result.stderr);
        const ledger = JSON.parse(await readFile(current.provenancePath, 'utf8'));
        assert.equal(ledger.batches.length, 2);
        assert.deepEqual(ledger.batches[0], prior);
    } finally {
        await fixture.dispose();
    }
});

test('processor rejects duplicate identities and runtime paths across prior batch records without byte changes', async () => {
    const fixture = await createFixture();
    const current = caseFixture(fixture, 'duplicate-prior-records');
    try {
        const paths = await seedExistingOutputs(current);
        const beforeOutputs = await readSnapshot(paths);
        const first = canonicalPriorRecord(fixture.batch, fixture.priorIdentities);
        const duplicate = structuredClone(first);
        duplicate.batchId = 'prior-batch-duplicate';
        duplicate.sourceSheet = 'prior-source-sheet-duplicate.png';
        duplicate.sourceSheetSha256 = '9'.repeat(64);
        duplicate.replayKey = replayKey(duplicate);
        const ledgerBytes = Buffer.from(`${JSON.stringify({ version: 1, batches: [first, duplicate] })}\n`);
        await mkdir(dirname(current.provenancePath), { recursive: true });
        await writeFile(current.provenancePath, ledgerBytes);

        const result = runProcessor(current);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Invalid provenance ledger/);
        assert.deepEqual(await readSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(current.provenancePath), ledgerBytes);
    } finally {
        await fixture.dispose();
    }
});

test('processor refuses a new batch that redeclares a prior identity or runtime path', async () => {
    const fixture = await createFixture();
    const current = caseFixture(fixture, 'duplicate-active-record');
    try {
        const paths = await seedExistingOutputs(current);
        const beforeOutputs = await readSnapshot(paths);
        const prior = canonicalPriorRecord(fixture.batch, fixture.batch.identities);
        const ledgerBytes = Buffer.from(`${JSON.stringify({ version: 1, batches: [prior] })}\n`);
        await mkdir(dirname(current.provenancePath), { recursive: true });
        await writeFile(current.provenancePath, ledgerBytes);

        const result = runProcessor(current);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /already declared by prior provenance/i);
        assert.deepEqual(await readSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(current.provenancePath), ledgerBytes);
    } finally {
        await fixture.dispose();
    }
});

test('processor keeps exact replay as a byte-identical no-op with strict prior validation', async () => {
    const fixture = await createFixture();
    const current = caseFixture(fixture, 'replay');
    try {
        const first = runProcessor(current);
        assert.equal(first.status, 0, first.stderr);
        const paths = runtimePaths(current);
        const beforeOutputs = await readSnapshot(paths);
        const beforeLedger = await readFile(current.provenancePath);

        const replay = runProcessor(current);

        assert.equal(replay.status, 0, replay.stderr);
        assert.deepEqual(await readSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(current.provenancePath), beforeLedger);
        assert.equal(JSON.parse(beforeLedger).batches.length, 1);
    } finally {
        await fixture.dispose();
    }
});
