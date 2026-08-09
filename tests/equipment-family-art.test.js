import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_SCRIPT = resolve(REPO_ROOT, 'scripts/dump-equipment-catalog.mjs');
const FAMILY_PROMPT_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_family_art_prompts.mjs');
const FAMILY_PROCESSOR_SCRIPT = resolve(REPO_ROOT, 'scripts/process_equipment_family_art_batch.py');
const ART_VERIFIER_SCRIPT = resolve(REPO_ROOT, 'scripts/verify-art-assets.mjs');
const EQUIPMENT_MANIFEST_PATH = resolve(REPO_ROOT, 'src/data/equipmentArtManifest.json');
const ARMOR_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/armor/batches');
const FAMILY_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/family-exemplars/batches');
const FAMILY_SOURCE_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/family-exemplars');
const FAMILY_PROVENANCE_PATH = resolve(REPO_ROOT, 'docs/evidence/art/equipment-family-exemplars-provenance.json');
const PUBLIC_ROOT = resolve(REPO_ROOT, 'public');
const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const DEFINED_FAMILIES = [
    'armor-boots',
    'armor-cloak',
    'armor-coat',
    'armor-leather',
    'armor-plate',
    'armor-robe',
    'headgear-cap',
    'headgear-circlet',
    'headgear-helm',
    'headgear-hood',
    'headgear-mask',
    'headgear-straw-hat',
    'headgear-wizard-hat',
    'offhand-book',
    'offhand-shield',
    'weapon-bow',
    'weapon-dagger',
    'weapon-heavy',
    'weapon-lance',
    'weapon-staff',
    'weapon-sword',
    'weapon-whip',
];

const runNode = (script, args) => spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    encoding: 'utf8',
});

const runPython = (script, args) => spawnSync('python3', [script, ...args], { encoding: 'utf8' });

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};

const hashCanonicalJson = (value) => createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');

const createSourceSheet = (path, { usedCells, paintUnusedCell = false, mode = 'RGBA', colorShift = 0 }) => {
    const script = [
        'from PIL import Image, ImageDraw',
        `image = Image.new(${JSON.stringify(mode)}, (600, 400), ${(mode === 'RGBA' ? '(0, 0, 0, 0)' : '(0, 0, 0)')})`,
        'draw = ImageDraw.Draw(image)',
        `used_cells = ${usedCells}`,
        'for index in range(used_cells):',
        '    column = index % 3',
        '    row = index // 3',
        '    left = column * 200 + 48',
        '    top = row * 200 + 42',
        `    fill = ${(mode === 'RGBA' ? `(50 + index * 20 + ${colorShift}, 90, 160, 255)` : `(50 + index * 20 + ${colorShift}, 90, 160)`)}`,
        '    draw.rectangle((left, top, left + 92, top + 112), fill=fill)',
        ...(paintUnusedCell ? [
            'index = used_cells',
            'column = index % 3',
            'row = index // 3',
            'draw.rectangle((column * 200 + 48, row * 200 + 42, column * 200 + 140, row * 200 + 154), fill=(120, 80, 40, 255))',
        ] : []),
        `image.save(${JSON.stringify(path)})`,
    ].join('\n');
    const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

test('tracked armor batches cover the exact 82 catalog identities in 17 family-pure sheets', async () => {
    const dump = runNode(DUMP_SCRIPT, ['--stdout']);
    assert.equal(dump.status, 0, dump.stderr);
    const armor = JSON.parse(dump.stdout).filter((row) => row.cohort === 'armor');
    const filenames = (await readdir(ARMOR_BATCH_DIR)).filter((name) => name.endsWith('.json')).sort();

    assert.deepEqual(filenames, [
        'armor-boots-01.json',
        'armor-cloak-01.json',
        'armor-cloak-02.json',
        'armor-coat-01.json',
        'armor-coat-02.json',
        'armor-leather-01.json',
        'armor-leather-02.json',
        'armor-plate-01.json',
        'armor-plate-02.json',
        'armor-plate-03.json',
        'armor-plate-04.json',
        'armor-plate-05.json',
        'armor-plate-06.json',
        'armor-robe-01.json',
        'armor-robe-02.json',
        'armor-robe-03.json',
        'armor-robe-04.json',
    ]);
    const batches = await Promise.all(filenames.map((name) => readJson(join(ARMOR_BATCH_DIR, name))));
    const identities = batches.flatMap((batch) => batch.identities);
    assert.equal(armor.length, 82);
    assert.equal(identities.length, 82);
    assert.deepEqual(new Set(identities.map((identity) => identity.name)), new Set(armor.map((row) => row.name)));
    assert.ok(batches.every((batch) => batch.cohort === 'armor'));
    assert.ok(batches.every((batch) => new Set(batch.identities.map((identity) => identity.familyKey)).size === 1));
    assert.ok(batches.every((batch) => batch.identities.every((identity, index) => identity.cell === CELL_ORDER[index])));
    assert.deepEqual(batches.map((batch) => batch.identities.length), [1, 6, 6, 6, 1, 6, 4, 6, 6, 6, 6, 6, 2, 6, 6, 6, 2]);
});

test('tracked family exemplar batches declare the exact 22 Art Bible families without item identities', async () => {
    const filenames = (await readdir(FAMILY_BATCH_DIR)).filter((name) => name.endsWith('.json')).sort();
    assert.deepEqual(filenames, [
        'family-exemplars-armor-01.json',
        'family-exemplars-headgear-01.json',
        'family-exemplars-headgear-02.json',
        'family-exemplars-offhand-01.json',
        'family-exemplars-weapon-01.json',
        'family-exemplars-weapon-02.json',
    ]);
    const batches = await Promise.all(filenames.map((name) => readJson(join(FAMILY_BATCH_DIR, name))));
    const identities = batches.flatMap((batch) => batch.identities);
    assert.deepEqual(identities.map((identity) => identity.familyKey).sort(), DEFINED_FAMILIES);
    assert.equal(new Set(identities.map((identity) => identity.runtimePath)).size, 22);
    assert.ok(identities.every((identity) => !Object.hasOwn(identity, 'name')));
    assert.ok(batches.every((batch) => batch.identities.every((identity, index) => identity.cell === CELL_ORDER[index])));
    assert.deepEqual(batches.map((batch) => batch.identities.length), [6, 6, 1, 2, 6, 1]);
});

const createFamilyFixture = async ({ familyCount = 3 } = {}) => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-family-art-'));
    const manifestPath = join(directory, 'equipmentArtManifest.json');
    const batchPath = join(directory, 'batch.json');
    const declarationPath = join(directory, 'declaration.json');
    const sourceSheetPath = join(directory, 'source.png');
    const provenancePath = join(directory, 'provenance.json');
    const publicRoot = join(directory, 'public');
    const manifest = await readJson(EQUIPMENT_MANIFEST_PATH);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    const familyKeys = DEFINED_FAMILIES.slice(0, familyCount);
    const prompt = runNode(FAMILY_PROMPT_SCRIPT, [
        '--manifest', manifestPath,
        '--batch-id', 'family-fixture-01',
        '--families', familyKeys.slice().reverse().join(','),
        '--output', batchPath,
    ]);
    assert.equal(prompt.status, 0, prompt.stderr);
    const batch = await readJson(batchPath);
    await writeFile(declarationPath, `${JSON.stringify({ batchId: batch.batchId, familyKeys: batch.familyKeys })}\n`);
    createSourceSheet(sourceSheetPath, { usedCells: familyCount });
    return {
        batch,
        batchPath,
        declarationPath,
        directory,
        manifestPath,
        provenancePath,
        publicRoot,
        sourceSheetPath,
        async dispose() {
            await rm(directory, { recursive: true, force: true });
        },
    };
};

const processorArgs = (fixture, extra = []) => [
    '--batch', fixture.batchPath,
    '--source-sheet', fixture.sourceSheetPath,
    '--source-declaration', fixture.declarationPath,
    '--public-root', fixture.publicRoot,
    '--equipment-manifest', fixture.manifestPath,
    '--provenance', fixture.provenancePath,
    ...extra,
];

test('family prompt generator emits sorted family-only declarations bound to the manifest', async () => {
    const fixture = await createFamilyFixture();
    try {
        assert.deepEqual(fixture.batch.familyKeys, DEFINED_FAMILIES.slice(0, 3));
        assert.deepEqual(fixture.batch.identities.map((identity) => identity.cell), CELL_ORDER.slice(0, 3));
        assert.ok(fixture.batch.identities.every((identity) => !Object.hasOwn(identity, 'name')));
        assert.ok(fixture.batch.identities.every((identity) => identity.runtimePath.startsWith('/assets/equipment-family/items/')));
    } finally {
        await fixture.dispose();
    }
});

test('family processor validates a partial sheet in dry-run without publishing assets or provenance', async () => {
    const fixture = await createFamilyFixture();
    try {
        const result = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture, ['--dry-run']));
        assert.equal(result.status, 0, result.stderr);
        await assert.rejects(stat(fixture.publicRoot), { code: 'ENOENT' });
        await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('family processor publishes 160px alpha assets and a replay-safe provenance record', async () => {
    const fixture = await createFamilyFixture();
    try {
        const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = fixture.batch.identities.map((identity) => join(fixture.publicRoot, identity.runtimePath.slice(1)));
        const before = await Promise.all(paths.map((path) => readFile(path)));
        const ledgerBefore = await readFile(fixture.provenancePath);
        const provenance = JSON.parse(ledgerBefore);
        assert.equal(provenance.version, 1);
        assert.deepEqual(provenance.batches[0].familyKeys, fixture.batch.familyKeys);
        assert.ok(provenance.batches[0].exports.every((entry) => /^[0-9a-f]{64}$/.test(entry.exportSha256)));

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json, sys',
            'result = []',
            'for path in sys.argv[1:]:',
            '    with Image.open(path) as image:',
            '        alpha = image.getchannel("A")',
            '        result.append([image.mode, image.size, alpha.getextrema()[0]])',
            'print(json.dumps(result))',
        ].join('\n'), ...paths], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        assert.deepEqual(JSON.parse(inspection.stdout), paths.map(() => ['RGBA', [160, 160], 0]));

        const replay = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(replay.status, 0, replay.stderr);
        assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
        assert.deepEqual(await readFile(fixture.provenancePath), ledgerBefore);
    } finally {
        await fixture.dispose();
    }
});

test('family processor rejects non-transparent trailing cells before any write', async () => {
    const fixture = await createFamilyFixture();
    try {
        createSourceSheet(fixture.sourceSheetPath, { usedCells: 3, paintUnusedCell: true });
        const result = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture, ['--dry-run']));
        assert.equal(result.status, 1);
        assert.match(result.stderr, /unused trailing cell bottom-left must be completely transparent/i);
        await assert.rejects(stat(fixture.publicRoot), { code: 'ENOENT' });
        await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('family processor rejects opaque sources before any write', async () => {
    const fixture = await createFamilyFixture();
    try {
        createSourceSheet(fixture.sourceSheetPath, { usedCells: 3, mode: 'RGB' });
        const result = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture, ['--dry-run']));
        assert.equal(result.status, 1);
        assert.match(result.stderr, /true RGBA/i);
        await assert.rejects(stat(fixture.publicRoot), { code: 'ENOENT' });
        await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('family processor rejects conflicting batch reuse without replacing published bytes', async () => {
    const fixture = await createFamilyFixture();
    try {
        const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = fixture.batch.identities.map((identity) => join(fixture.publicRoot, identity.runtimePath.slice(1)));
        const before = await Promise.all(paths.map((path) => readFile(path)));
        const ledgerBefore = await readFile(fixture.provenancePath);
        createSourceSheet(fixture.sourceSheetPath, { usedCells: 3, colorShift: 10 });

        const conflict = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(conflict.status, 1);
        assert.match(conflict.stderr, /Conflicting batchId/i);
        assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
        assert.deepEqual(await readFile(fixture.provenancePath), ledgerBefore);
    } finally {
        await fixture.dispose();
    }
});

test('family processor replays a finalized approved generation-review ledger without writes', async () => {
    const fixture = await createFamilyFixture();
    try {
        const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const provenance = await readJson(fixture.provenancePath);
        const review = {
            tool: 'fixture image generator and original-size review',
            accepted: [{
                batchId: fixture.batch.batchId,
                rawImage: 'fixture-accepted.png',
                rawSha256: 'a'.repeat(64),
            }],
            rejected: [],
        };
        provenance.generationReview = review;
        const manifest = await readJson(fixture.manifestPath);
        manifest.pipeline.provenance.familyExemplars = {
            generationReviewSha256: hashCanonicalJson(review),
        };
        await writeFile(fixture.provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
        await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        const runtimePaths = fixture.batch.identities.map((identity) => join(
            fixture.publicRoot,
            identity.runtimePath.slice(1),
        ));
        const before = await Promise.all([
            readFile(fixture.provenancePath),
            ...runtimePaths.map((path) => readFile(path)),
        ]);

        const replay = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(replay.status, 0, replay.stderr);
        assert.match(replay.stdout, /replay no-op/i);
        assert.deepEqual(await Promise.all([
            readFile(fixture.provenancePath),
            ...runtimePaths.map((path) => readFile(path)),
        ]), before);
    } finally {
        await fixture.dispose();
    }
});

test('family processor rejects malformed approved generation review without writes', async () => {
    const fixture = await createFamilyFixture();
    try {
        const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const provenance = await readJson(fixture.provenancePath);
        provenance.generationReview = {
            tool: 'fixture review',
            accepted: [{
                batchId: fixture.batch.batchId,
                rawImage: 'fixture.png',
                rawSha256: 'a'.repeat(64),
                unexpected: true,
            }],
            rejected: [],
        };
        await writeFile(fixture.provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
        const runtimePaths = fixture.batch.identities.map((identity) => join(
            fixture.publicRoot,
            identity.runtimePath.slice(1),
        ));
        const before = await Promise.all([
            readFile(fixture.provenancePath),
            ...runtimePaths.map((path) => readFile(path)),
        ]);

        const replay = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(replay.status, 1);
        assert.match(replay.stderr, /Invalid family provenance ledger/i);
        assert.deepEqual(await Promise.all([
            readFile(fixture.provenancePath),
            ...runtimePaths.map((path) => readFile(path)),
        ]), before);
    } finally {
        await fixture.dispose();
    }
});

test('family processor rejects generation reviews that do not cover the active batch set', async (context) => {
    const activeReview = (batchId) => ({
        tool: 'fixture review',
        accepted: [{ batchId, rawImage: 'accepted.png', rawSha256: 'a'.repeat(64) }],
        rejected: [],
    });
    const mutations = [
        ['foreign accepted batch', () => activeReview('foreign-batch')],
        ['foreign rejected batch', (batchId) => ({
            ...activeReview(batchId),
            rejected: [{
                batchId: 'foreign-batch',
                rawImage: 'rejected.png',
                rawSha256: 'b'.repeat(64),
                reason: 'foreign batch must not be accepted by the active ledger',
            }],
        })],
        ['incomplete accepted coverage', () => ({
            tool: 'fixture review',
            accepted: [],
            rejected: [],
        })],
        ['accepted raw traversal', (batchId) => ({
            ...activeReview(batchId),
            accepted: [{ batchId, rawImage: '../escaped.png', rawSha256: 'a'.repeat(64) }],
        })],
        ['rejected raw traversal', (batchId) => ({
            ...activeReview(batchId),
            rejected: [{
                batchId,
                rawImage: 'nested/escaped.png',
                rawSha256: 'b'.repeat(64),
                reason: 'unsafe metadata path',
            }],
        })],
        ['duplicate raw image name', (batchId) => ({
            ...activeReview(batchId),
            rejected: [{
                batchId,
                rawImage: 'accepted.png',
                rawSha256: 'b'.repeat(64),
                reason: 'same name cannot identify different evidence bytes',
            }],
        })],
    ];

    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            const fixture = await createFamilyFixture();
            try {
                const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
                assert.equal(first.status, 0, first.stderr);
                const provenance = await readJson(fixture.provenancePath);
                const review = mutate(fixture.batch.batchId);
                provenance.generationReview = review;
                const manifest = await readJson(fixture.manifestPath);
                manifest.pipeline.provenance.familyExemplars = {
                    generationReviewSha256: hashCanonicalJson(review),
                };
                await writeFile(fixture.provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
                await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
                const runtimePaths = fixture.batch.identities.map((identity) => join(
                    fixture.publicRoot,
                    identity.runtimePath.slice(1),
                ));
                const before = await Promise.all([
                    readFile(fixture.provenancePath),
                    ...runtimePaths.map((path) => readFile(path)),
                ]);

                const replay = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
                assert.equal(replay.status, 1);
                assert.match(replay.stderr, /Invalid family provenance ledger/i);
                assert.deepEqual(await Promise.all([
                    readFile(fixture.provenancePath),
                    ...runtimePaths.map((path) => readFile(path)),
                ]), before);
            } finally {
                await fixture.dispose();
            }
        });
    }
});

test('family processor rejects unsafe prior source-sheet paths without writes', async (context) => {
    for (const unsafePath of ['../escaped.png', '/tmp/escaped.png', 'nested/source.png', './source.png']) {
        await context.test(unsafePath, async () => {
            const fixture = await createFamilyFixture();
            try {
                const first = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
                assert.equal(first.status, 0, first.stderr);
                const provenance = await readJson(fixture.provenancePath);
                provenance.batches[0].sourceSheet = unsafePath;
                await writeFile(fixture.provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
                const runtimePaths = fixture.batch.identities.map((identity) => join(
                    fixture.publicRoot,
                    identity.runtimePath.slice(1),
                ));
                const before = await Promise.all([
                    readFile(fixture.provenancePath),
                    ...runtimePaths.map((path) => readFile(path)),
                ]);

                const replay = runPython(FAMILY_PROCESSOR_SCRIPT, processorArgs(fixture));
                assert.equal(replay.status, 1);
                assert.match(replay.stderr, /Invalid family provenance ledger/i);
                assert.deepEqual(await Promise.all([
                    readFile(fixture.provenancePath),
                    ...runtimePaths.map((path) => readFile(path)),
                ]), before);
            } finally {
                await fixture.dispose();
            }
        });
    }
});

test('family verifier rejects byte-identical exports even when hashes are internally repinned', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-family-duplicate-'));
    try {
        const publicRoot = join(directory, 'public');
        const manifestPath = join(directory, 'manifest.json');
        const provenancePath = join(directory, 'provenance.json');
        const reportPath = join(directory, 'approved-report.json');
        const manifest = await readJson(EQUIPMENT_MANIFEST_PATH);
        const provenance = await readJson(FAMILY_PROVENANCE_PATH);
        const exports = provenance.batches.flatMap((batch) => batch.exports);
        const boots = exports.find((entry) => entry.familyKey === 'armor-boots');
        const cloak = exports.find((entry) => entry.familyKey === 'armor-cloak');
        assert.ok(boots && cloak);
        const duplicateBytes = await readFile(join(PUBLIC_ROOT, boots.runtimePath.slice(1)));

        for (const entry of exports) {
            const destination = join(publicRoot, entry.runtimePath.slice(1));
            await mkdir(dirname(destination), { recursive: true });
            const bytes = entry.familyKey === 'armor-cloak'
                ? duplicateBytes
                : await readFile(join(PUBLIC_ROOT, entry.runtimePath.slice(1)));
            await writeFile(destination, bytes);
        }
        cloak.exportSha256 = boots.exportSha256;
        manifest.art.families['armor-cloak'].exportSha256 = boots.exportSha256;
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
        await writeFile(reportPath, 'approved report sentinel\n');

        const result = runNode(ART_VERIFIER_SCRIPT, [
            '--scope', 'families',
            '--equipment-manifest', manifestPath,
            '--equipment-provenance', provenancePath,
            '--equipment-source-dir', FAMILY_SOURCE_DIR,
            '--public-root', publicRoot,
            '--write-report', reportPath,
        ]);
        assert.equal(result.status, 1, result.stderr || result.stdout);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.ok(report.invalidArtwork.some((message) => /duplicate family export/i.test(message)));
        assert.equal(await readFile(reportPath, 'utf8'), 'approved report sentinel\n');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('family verifier rejects repinned unsafe or duplicated raw image names without writing evidence', async (context) => {
    const mutations = [
        ['accepted traversal', (review) => { review.accepted[0].rawImage = '../escaped.png'; }],
        ['rejected traversal', (review) => { review.rejected[0].rawImage = 'nested/escaped.png'; }],
        ['duplicate raw image name', (review) => { review.rejected[0].rawImage = review.accepted[0].rawImage; }],
    ];
    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'aetheria-family-raw-image-'));
            try {
                const manifestPath = join(directory, 'manifest.json');
                const provenancePath = join(directory, 'provenance.json');
                const reportPath = join(directory, 'report.json');
                const manifest = await readJson(EQUIPMENT_MANIFEST_PATH);
                const provenance = await readJson(FAMILY_PROVENANCE_PATH);
                mutate(provenance.generationReview);
                manifest.pipeline.provenance.familyExemplars.generationReviewSha256 = hashCanonicalJson(
                    provenance.generationReview,
                );
                await Promise.all([
                    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
                    writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`),
                    writeFile(reportPath, 'approved report sentinel\n'),
                ]);

                const result = runNode(ART_VERIFIER_SCRIPT, [
                    '--scope', 'families',
                    '--equipment-manifest', manifestPath,
                    '--equipment-provenance', provenancePath,
                    '--equipment-source-dir', FAMILY_SOURCE_DIR,
                    '--public-root', PUBLIC_ROOT,
                    '--write-report', reportPath,
                ]);
                assert.equal(result.status, 1, result.stderr || result.stdout);
                const report = JSON.parse(result.stdout);
                assert.equal(report.ok, false);
                assert.match(report.invalidArtwork.join('\n'), /raw (image|candidate)/i);
                assert.equal(await readFile(reportPath, 'utf8'), 'approved report sentinel\n');
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        });
    }
});

test('family art verifier validates all 22 defined exemplar assets as an independent surface', () => {
    const result = runNode(ART_VERIFIER_SCRIPT, ['--scope', 'families']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual(report.verifiedSurfaces, ['families']);
    assert.equal(report.counts.families, 22);
    assert.equal(report.exports.length, 22);
    assert.deepEqual(report.invalidArtwork, []);
});
