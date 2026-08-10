import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_SCRIPT = resolve(ROOT, 'scripts/dump-equipment-catalog.mjs');
const PROMPT_SCRIPT = resolve(ROOT, 'scripts/generate_signature_art_prompts.mjs');
const PROCESSOR_SCRIPT = resolve(ROOT, 'scripts/process_signature_art_batch.py');
const PREPARER_SCRIPT = resolve(ROOT, 'scripts/prepare_equipment_source_sheet.py');
const SYNC_SCRIPT = resolve(ROOT, 'scripts/sync-signature-art-manifest.mjs');
const VERIFIER_SCRIPT = resolve(ROOT, 'scripts/verify-art-assets.mjs');
const MANIFEST_PATH = resolve(ROOT, 'src/data/equipmentArtManifest.json');
const REGISTRY_PATH = resolve(ROOT, 'src/data/signatureRegistry.json');
const TRACKED_SOURCE_DIR = resolve(ROOT, 'scripts/art_sources/equipment/v2/signature-mythic');
const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const FULL_BATCHES = Object.freeze({
    'signature-mythic-armor-cloak-01': ['암흑 군주의 망토'],
    'signature-mythic-armor-plate-01': ['광기의 갑주', '드래곤로드 갑주', '심해의 수호복', '혼돈의 갑주'],
    'signature-mythic-armor-robe-01': ['세계수의 로브'],
    'signature-mythic-offhand-book-01': ['에테르 그리모어', '천공 성전'],
    'signature-mythic-offhand-shield-01': ['차원 방패 이지스'],
    'signature-mythic-weapon-bow-01': ['바람의 궁극'],
    'signature-mythic-weapon-dagger-01': ['그림자 절단기', '영혼 절단자'],
    'signature-mythic-weapon-lance-01': ['마왕의 대낫', '성스러운 창', '차원 마왕의 낫'],
    'signature-mythic-weapon-staff-01': ['세계수의 지팡이', '신전 도시의 지팡이', '천벌의 지팡이'],
    'signature-mythic-weapon-sword-01': ['대지의 심판', '라그나로크', '빙결의 왕관검', '성검 에테르니아', '세계수의 검', '에테르 거인의 대검'],
    'signature-mythic-weapon-sword-02': ['용의 화염'],
});

const runNode = (script, args) => spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { encoding: 'utf8' });
const runPython = (script, args) => spawnSync('python3', [script, ...args], { encoding: 'utf8' });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const hashCanonicalJson = (value) => sha256(JSON.stringify(canonicalize(value)));
const signatureReplayKey = (record) => sha256(JSON.stringify({
    batchId: record.batchId,
    itemSourceSheetSha256: record.itemSourceSheetSha256,
    overlaySourceSheetSha256: record.overlaySourceSheetSha256,
    identityNames: record.identityNames,
}));

const createPairedSheets = (itemPath, overlayPath, count, contaminateOverlayBlank = false, seed = 0) => {
    const result = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
item_path, overlay_path, count, contaminate, seed = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4] == '1', int(sys.argv[5])
for path, inset in ((item_path, 32), (overlay_path, 45)):
    image = Image.new('RGBA', (600, 400), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for index in range(count):
        x = (index % 3) * 200
        y = (index // 3) * 200
        color = (
            80 + (seed * 19 + index * 41) % 80,
            55 + (seed * 29 + index * 31) % 50,
            110 + (seed * 43 + index * 23) % 80,
            255,
        )
        left = x + inset + (seed % 7)
        right = x + 199 - inset
        draw.rectangle((left, y + 24 + (seed % 5), right, y + 176), fill=color)
        draw.rectangle((x + 70 + (seed % 9), y + 12, x + 125, y + 38 + (seed % 11)), fill=(230, 210 - seed % 40, 80 + seed % 90, 255))
    if contaminate and path == overlay_path:
        index = count
        x = (index % 3) * 200
        y = (index // 3) * 200
        draw.rectangle((x + 50, y + 50, x + 70, y + 70), fill=(255, 0, 255, 255))
    image.save(path)
`, itemPath, overlayPath, String(count), contaminateOverlayBlank ? '1' : '0', String(seed)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

const buildFullFixture = async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-full-'));
    const catalogPath = join(directory, 'catalog.json');
    const manifestPath = join(directory, 'manifest.json');
    const provenancePath = join(directory, 'provenance.json');
    const sourceDir = join(directory, 'sources');
    const batchDir = join(sourceDir, 'batches');
    const publicRoot = join(directory, 'public');
    await Promise.all([mkdir(batchDir, { recursive: true }), mkdir(publicRoot, { recursive: true })]);

    const dumped = runNode(DUMP_SCRIPT, ['--output', catalogPath]);
    assert.equal(dumped.status, 0, dumped.stderr);
    const [manifest, registry] = await Promise.all([
        readFile(MANIFEST_PATH, 'utf8').then(JSON.parse),
        readFile(REGISTRY_PATH, 'utf8').then(JSON.parse),
    ]);
    for (const [name, metadata] of Object.entries(registry.entries)) manifest.entries[name] = metadata.spriteKey;
    manifest.art.signatureOverlay = { width: 72, height: 72, margin: 4, assetRoot: '/assets/equipment-wearable-exact/' };
    manifest.art.signatureOverlays = {};
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(provenancePath, `${JSON.stringify({ version: 1, batches: [] }, null, 2)}\n`);

    let seed = 1;
    for (const [batchId, names] of Object.entries(FULL_BATCHES)) {
        const batchPath = join(batchDir, `${batchId}.json`);
        const itemSourcePath = join(sourceDir, `${batchId}-item.png`);
        const overlaySourcePath = join(sourceDir, `${batchId}-overlay.png`);
        const declarationPath = join(directory, `${batchId}-declaration.json`);
        const generated = runNode(PROMPT_SCRIPT, [
            '--catalog', catalogPath,
            '--registry', REGISTRY_PATH,
            '--catalog-sha256', manifest.catalogSha256,
            '--batch-id', batchId,
            '--names', names.join(','),
            '--output', batchPath,
        ]);
        assert.equal(generated.status, 0, generated.stderr);
        await writeFile(declarationPath, `${JSON.stringify({ batchId, identityNames: names }, null, 2)}\n`);
        createPairedSheets(itemSourcePath, overlaySourcePath, names.length, false, seed);
        const processed = runPython(PROCESSOR_SCRIPT, [
            '--batch', batchPath,
            '--catalog', catalogPath,
            '--signature-registry', REGISTRY_PATH,
            '--item-source-sheet', itemSourcePath,
            '--overlay-source-sheet', overlaySourcePath,
            '--source-declaration', declarationPath,
            '--public-root', publicRoot,
            '--equipment-manifest', manifestPath,
            '--provenance', provenancePath,
        ]);
        assert.equal(processed.status, 0, processed.stderr);
        seed += 1;
    }

    const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
    const generationReview = {
        tool: 'image_gen',
        accepted: provenance.batches.flatMap((record) => [
            {
                batchId: record.batchId,
                surface: 'item',
                rawImage: `exec-${record.batchId}-item.png`,
                rawSha256: record.itemSourceSheetSha256,
            },
            {
                batchId: record.batchId,
                surface: 'overlay',
                rawImage: `exec-${record.batchId}-overlay.png`,
                rawSha256: record.overlaySourceSheetSha256,
            },
        ]),
        rejected: [],
    };
    const finalized = {
        version: 1,
        catalogSha256: manifest.catalogSha256,
        catalogRowsSha256: manifest.pipeline.catalog.rowsSha256,
        cohort: 'signature-mythic',
        registrySha256: sha256(await readFile(REGISTRY_PATH)),
        generationReview,
        batches: provenance.batches,
    };
    manifest.pipeline.provenance.cohorts['signature-mythic'] = {
        generationReviewSha256: hashCanonicalJson(generationReview),
    };
    await Promise.all([
        writeFile(provenancePath, `${JSON.stringify(finalized, null, 2)}\n`),
        writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
    ]);

    return { directory, catalogPath, manifestPath, provenancePath, sourceDir, publicRoot, registry, finalized };
};

const buildFixture = async ({ contaminateOverlayBlank = false } = {}) => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-pipeline-'));
    const catalogPath = join(directory, 'catalog.json');
    const batchPath = join(directory, 'signature-mythic-weapon-sword-01.json');
    const declarationPath = join(directory, 'declaration.json');
    const itemSourcePath = join(directory, 'signature-mythic-weapon-sword-01-item.png');
    const overlaySourcePath = join(directory, 'signature-mythic-weapon-sword-01-overlay.png');
    const manifestPath = join(directory, 'manifest.json');
    const provenancePath = join(directory, 'provenance.json');
    const publicRoot = join(directory, 'public');
    await mkdir(publicRoot, { recursive: true });

    const dumped = runNode(DUMP_SCRIPT, ['--output', catalogPath]);
    assert.equal(dumped.status, 0, dumped.stderr);
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
    const names = ['대지의 심판', '라그나로크'];
    for (const name of names) manifest.entries[name] = registry.entries[name].spriteKey;
    manifest.art.signatureOverlay = {
        width: 72,
        height: 72,
        margin: 4,
        assetRoot: '/assets/equipment-wearable-exact/',
    };
    manifest.art.signatureOverlays = {};
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(provenancePath, `${JSON.stringify({ version: 1, batches: [] }, null, 2)}\n`);

    const generated = runNode(PROMPT_SCRIPT, [
        '--catalog', catalogPath,
        '--registry', REGISTRY_PATH,
        '--catalog-sha256', manifest.catalogSha256,
        '--batch-id', 'signature-mythic-weapon-sword-01',
        '--names', names.join(','),
        '--output', batchPath,
    ]);
    assert.equal(generated.status, 0, generated.stderr);
    await writeFile(declarationPath, `${JSON.stringify({
        batchId: 'signature-mythic-weapon-sword-01',
        identityNames: names,
    }, null, 2)}\n`);
    createPairedSheets(itemSourcePath, overlaySourcePath, names.length, contaminateOverlayBlank);

    return {
        directory,
        catalog,
        catalogPath,
        batchPath,
        declarationPath,
        itemSourcePath,
        overlaySourcePath,
        manifestPath,
        provenancePath,
        publicRoot,
        names,
    };
};

const processorArgs = (fixture, extra = []) => [
    '--batch', fixture.batchPath,
    '--catalog', fixture.catalogPath,
    '--signature-registry', REGISTRY_PATH,
    '--item-source-sheet', fixture.itemSourcePath,
    '--overlay-source-sheet', fixture.overlaySourcePath,
    '--source-declaration', fixture.declarationPath,
    '--public-root', fixture.publicRoot,
    '--equipment-manifest', fixture.manifestPath,
    '--provenance', fixture.provenancePath,
    ...extra,
];

const snapshotFiles = async (roots) => {
    const snapshot = {};
    const visit = async (path, label) => {
        const entries = await readdir(path, { withFileTypes: true });
        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
            const childPath = join(path, entry.name);
            const childLabel = `${label}/${entry.name}`;
            if (entry.isDirectory()) await visit(childPath, childLabel);
            else snapshot[childLabel] = sha256(await readFile(childPath));
        }
    };
    for (const [label, path] of Object.entries(roots)) {
        const metadata = await stat(path);
        if (metadata.isDirectory()) await visit(path, label);
        else snapshot[label] = sha256(await readFile(path));
    }
    return snapshot;
};

const syncArgs = (fixture, manifestPath, outputPath) => [
    '--catalog', fixture.catalogPath,
    '--manifest', manifestPath,
    '--registry', REGISTRY_PATH,
    '--provenance', fixture.provenancePath,
    '--source-dir', fixture.sourceDir,
    '--public-root', fixture.publicRoot,
    '--output', outputPath,
];

const verifierArgs = (fixture, manifestPath, reportPath) => [
    '--scope', 'equipment',
    '--cohort', 'signature-mythic',
    '--equipment-manifest', manifestPath,
    '--equipment-provenance', fixture.provenancePath,
    '--equipment-source-dir', fixture.sourceDir,
    '--public-root', fixture.publicRoot,
    '--write-report', reportPath,
];

const fullProcessorArgs = (fixture, batchId) => [
    '--batch', join(fixture.sourceDir, 'batches', `${batchId}.json`),
    '--catalog', fixture.catalogPath,
    '--signature-registry', REGISTRY_PATH,
    '--item-source-sheet', join(fixture.sourceDir, `${batchId}-item.png`),
    '--overlay-source-sheet', join(fixture.sourceDir, `${batchId}-overlay.png`),
    '--source-declaration', join(fixture.directory, `${batchId}-declaration.json`),
    '--public-root', fixture.publicRoot,
    '--equipment-manifest', fixture.manifestPath,
    '--provenance', fixture.provenancePath,
];

const assertRejectedWithoutWrites = async ({ run, error, sentinelPath, protectedFiles }) => {
    const sentinel = Buffer.from('preserve-this-sentinel\n');
    await writeFile(sentinelPath, sentinel);
    const before = await snapshotFiles(protectedFiles);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, error);
    assert.deepEqual(await readFile(sentinelPath), sentinel);
    assert.deepEqual(await snapshotFiles(protectedFiles), before);
    return result;
};

test('signature prompt generator binds catalog and registry artNote into one paired family-pure batch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-prompts-'));
    const catalogPath = join(directory, 'catalog.json');
    const outputPath = join(directory, 'batch.json');
    try {
        const dumped = runNode(DUMP_SCRIPT, ['--output', catalogPath]);
        assert.equal(dumped.status, 0, dumped.stderr);
        const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
        const result = runNode(PROMPT_SCRIPT, [
            '--catalog', catalogPath,
            '--registry', REGISTRY_PATH,
            '--catalog-sha256', manifest.catalogSha256,
            '--batch-id', 'signature-mythic-weapon-dagger-01',
            '--names', '그림자 절단기,영혼 절단자',
            '--output', outputPath,
        ]);
        assert.equal(result.status, 0, result.stderr);

        const batch = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.equal(batch.cohort, 'signature-mythic');
        assert.deepEqual(batch.identityNames, ['그림자 절단기', '영혼 절단자']);
        assert.deepEqual(batch.grid, { columns: 3, rows: 2, cellOrder: CELL_ORDER });
        assert.match(batch.identities[0].itemPrompt, /곡선 falchion \+ 어둠 rim/);
        assert.match(batch.identities[0].overlayPrompt, /그림자 절단기/);
        assert.match(batch.itemPrompt, /2 isolated identities/);
        assert.doesNotMatch(batch.itemPrompt, /identityies/);
        assert.match(batch.itemPrompt, /bottom-right/);
        assert.match(batch.overlayPrompt, /wearable overlay/i);
        assert.equal(batch.identities[0].spriteKey, 'signature-weapon-shadow-cutter');
        assert.equal(batch.identities[1].artNote, '1H dagger · 훅형 블레이드 + 영혼 오브 + 혼 연기');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature single-cell source preparation can deterministically shrink and recenter a boundary-crossing silhouette', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-source-fit-'));
    const inputPath = join(directory, 'working.png');
    const outputPath = join(directory, 'prepared.png');
    try {
        const created = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
image = Image.new('RGB', (600, 400), (255, 0, 255))
draw = ImageDraw.Draw(image)
draw.rectangle((35, 25, 245, 175), fill=(70, 45, 30))
draw.polygon(((60, 90), (250, 110), (70, 165)), fill=(120, 80, 35))
image.save(sys.argv[1])
`, inputPath], { encoding: 'utf8' });
        assert.equal(created.status, 0, created.stderr);

        const prepared = runPython(PREPARER_SCRIPT, [
            '--input', inputPath,
            '--output', outputPath,
            '--used-cells', '1',
            '--shrink-cells', '1',
        ]);
        assert.equal(prepared.status, 0, prepared.stderr);
        const inspection = spawnSync('python3', ['-c', `
from PIL import Image
import json, sys
image = Image.open(sys.argv[1]).convert('RGBA')
first = image.crop((0, 0, 200, 200)).getchannel('A')
trailing = image.crop((200, 0, 600, 400)).getchannel('A')
print(json.dumps({'bounds': first.getbbox(), 'trailing': trailing.getbbox()}))
`, outputPath], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        const result = JSON.parse(inspection.stdout);
        assert.ok(result.bounds[0] >= 20 && result.bounds[1] >= 20);
        assert.ok(result.bounds[2] <= 180 && result.bounds[3] <= 180);
        assert.equal(result.trailing, null);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature source preparation can preserve an approved cell while replacing its neighbors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-source-preserve-'));
    const inputPath = join(directory, 'working.png');
    const approvedPath = join(directory, 'approved.png');
    const outputPath = join(directory, 'prepared.png');
    try {
        const created = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
working = Image.new('RGBA', (600, 400), (0, 0, 0, 0))
approved = Image.new('RGBA', (600, 400), (0, 0, 0, 0))
ImageDraw.Draw(working).rectangle((40, 40, 140, 160), fill=(180, 40, 40, 255))
ImageDraw.Draw(working).rectangle((240, 40, 340, 160), fill=(80, 90, 150, 255))
ImageDraw.Draw(working).rectangle((440, 40, 540, 160), fill=(110, 70, 160, 255))
ImageDraw.Draw(approved).rectangle((55, 35, 145, 165), fill=(45, 120, 70, 255))
working.save(sys.argv[1])
approved.save(sys.argv[2])
`, inputPath, approvedPath], { encoding: 'utf8' });
        assert.equal(created.status, 0, created.stderr);

        const prepared = runPython(PREPARER_SCRIPT, [
            '--input', inputPath,
            '--output', outputPath,
            '--used-cells', '3',
            '--preserve-cells-from', approvedPath,
            '--preserve-cells', '1',
        ]);
        assert.equal(prepared.status, 0, prepared.stderr);
        const inspected = spawnSync('python3', ['-c', `
from PIL import Image
import hashlib, json, sys
approved = Image.open(sys.argv[1]).convert('RGBA').crop((0, 0, 200, 200))
output = Image.open(sys.argv[2]).convert('RGBA')
first = output.crop((0, 0, 200, 200))
second = output.crop((200, 0, 400, 200))
print(json.dumps({
    'first': hashlib.sha256(first.tobytes()).hexdigest(),
    'approved': hashlib.sha256(approved.tobytes()).hexdigest(),
    'secondPixel': second.getpixel((100, 100)),
}))
`, approvedPath, outputPath], { encoding: 'utf8' });
        assert.equal(inspected.status, 0, inspected.stderr);
        const result = JSON.parse(inspected.stdout);
        assert.equal(result.first, result.approved);
        assert.deepEqual(result.secondPixel, [80, 90, 150, 255]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature source preparation removes only tiny detached islands from an explicitly selected cell', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-island-cleanup-'));
    const inputPath = join(directory, 'working.png');
    const outputPath = join(directory, 'prepared.png');
    try {
        const created = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
image = Image.new('RGBA', (600, 400), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rectangle((40, 40, 140, 160), fill=(90, 70, 40, 255))
draw.rectangle((240, 40, 340, 160), fill=(70, 90, 120, 255))
draw.rectangle((440, 40, 540, 160), fill=(80, 100, 130, 255))
draw.point((575, 175), fill=(255, 255, 255, 255))
image.save(sys.argv[1])
`, inputPath], { encoding: 'utf8' });
        assert.equal(created.status, 0, created.stderr);

        const prepared = runPython(PREPARER_SCRIPT, [
            '--input', inputPath,
            '--output', outputPath,
            '--used-cells', '3',
            '--remove-tiny-islands-cells', '3',
        ]);
        assert.equal(prepared.status, 0, prepared.stderr);
        const inspected = spawnSync('python3', ['-c', `
from PIL import Image
import json, sys
cell = Image.open(sys.argv[1]).convert('RGBA').crop((400, 0, 600, 200))
alpha = cell.getchannel('A')
print(json.dumps({'bounds': alpha.getbbox(), 'visible': sum(value > 0 for value in alpha.get_flattened_data())}))
`, outputPath], { encoding: 'utf8' });
        assert.equal(inspected.status, 0, inspected.stderr);
        const result = JSON.parse(inspected.stdout);
        assert.deepEqual(result.bounds, [40, 40, 141, 161]);
        assert.ok(result.visible > 10_000);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature source preparation removes exterior and large enclosed magenta while preserving nature green', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-magenta-cleanup-'));
    const inputPath = join(directory, 'working.png');
    const outputPath = join(directory, 'prepared.png');
    try {
        const created = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
image = Image.new('RGB', (600, 400), (255, 0, 255))
draw = ImageDraw.Draw(image)
draw.rectangle((40, 30, 160, 170), fill=(45, 95, 35))
draw.rectangle((65, 55, 135, 145), fill=(95, 65, 35))
draw.rectangle((75, 65, 125, 135), fill=(255, 0, 255))
draw.rectangle((98, 40, 102, 44), fill=(235, 20, 220))
draw.rectangle((38, 28, 42, 172), fill=(220, 35, 210))
image.save(sys.argv[1])
`, inputPath], { encoding: 'utf8' });
        assert.equal(created.status, 0, created.stderr);

        const prepared = runPython(PREPARER_SCRIPT, [
            '--input', inputPath,
            '--output', outputPath,
            '--used-cells', '1',
            '--preserve-green-cells', '1',
            '--remove-enclosed-magenta-cells', '1',
            '--strip-low-alpha-magenta',
        ]);
        assert.equal(prepared.status, 0, prepared.stderr);
        const inspected = spawnSync('python3', ['-c', `
from PIL import Image
import json, sys
image = Image.open(sys.argv[1]).convert('RGBA').crop((0, 0, 200, 200))
green = magenta = opaque_magenta = 0
for red, value, blue, alpha in image.get_flattened_data():
    if alpha and value >= red + 30 and value >= blue + 30:
        green += 1
    if alpha and red >= value + 40 and blue >= value + 40:
        magenta += 1
        opaque_magenta += alpha == 255
print(json.dumps({'green': green, 'magenta': magenta, 'opaqueMagenta': opaque_magenta}))
`, outputPath], { encoding: 'utf8' });
        assert.equal(inspected.status, 0, inspected.stderr);
        const counts = JSON.parse(inspected.stdout);
        assert.ok(counts.green > 1000);
        assert.ok(counts.magenta < 100);
        assert.ok(counts.opaqueMagenta < 50);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('tracked signature batches are the exact 11 family-pure deterministic prompt projections for all 25 identities', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-tracked-batches-'));
    const catalogPath = join(directory, 'catalog.json');
    try {
        const dumped = runNode(DUMP_SCRIPT, ['--output', catalogPath]);
        assert.equal(dumped.status, 0, dumped.stderr);
        const [catalog, manifest, registryDocument, contract] = await Promise.all([
            readFile(catalogPath, 'utf8').then(JSON.parse),
            readFile(MANIFEST_PATH, 'utf8').then(JSON.parse),
            readFile(REGISTRY_PATH, 'utf8').then(JSON.parse),
            import('../scripts/signaturePromptContract.mjs'),
        ]);
        const files = (await readdir(join(TRACKED_SOURCE_DIR, 'batches')))
            .filter((name) => name.endsWith('.json'))
            .sort();
        assert.deepEqual(files, Object.keys(FULL_BATCHES).sort().map((batchId) => `${batchId}.json`));

        const covered = [];
        for (const [batchId, names] of Object.entries(FULL_BATCHES)) {
            const actual = JSON.parse(await readFile(join(TRACKED_SOURCE_DIR, 'batches', `${batchId}.json`), 'utf8'));
            const expected = contract.buildSignaturePromptBatchFromRows({
                catalog,
                registry: registryDocument.entries,
                catalogSha256: manifest.catalogSha256,
                batchId,
                names: names.join(','),
            });
            assert.deepEqual(actual, expected, batchId);
            assert.deepEqual(actual.identityNames, names, batchId);
            assert.equal(new Set(actual.identities.map((identity) => identity.familyKey)).size, 1, batchId);
            assert.ok(actual.identities.every((identity) => identity.itemPrompt.includes(identity.artNote)), batchId);
            assert.ok(actual.identities.every((identity) => identity.overlayPrompt.includes(identity.artNote)), batchId);
            covered.push(...actual.identityNames);
        }
        assert.equal(covered.length, 25);
        assert.equal(new Set(covered).size, 25);
        assert.deepEqual([...covered].sort(), Object.keys(registryDocument.entries).sort());
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('paired signature processor validates dry-run without publishing item, overlay, or provenance bytes', async () => {
    const fixture = await buildFixture();
    try {
        const before = await readFile(fixture.provenancePath);
        const result = runPython(PROCESSOR_SCRIPT, processorArgs(fixture, ['--dry-run']));
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /dry run: validated 2 signature identities/);
        assert.deepEqual(await readFile(fixture.provenancePath), before);
        for (const name of fixture.names) {
            const row = fixture.catalog.find((entry) => entry.name === name);
            await assert.rejects(stat(join(fixture.publicRoot, row.runtimePath.replace(/^\//, ''))), { code: 'ENOENT' });
            const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8')).entries[name];
            await assert.rejects(stat(join(fixture.publicRoot, 'assets/equipment-wearable-exact', `${registry.spriteKey}.png`)), { code: 'ENOENT' });
        }
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('paired signature processor atomically publishes 160 item and 72 overlay outputs with one source-bound record', async () => {
    const fixture = await buildFixture();
    try {
        const result = runPython(PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.equal(result.status, 0, result.stderr);
        const provenance = JSON.parse(await readFile(fixture.provenancePath, 'utf8'));
        assert.equal(provenance.batches.length, 1);
        const record = provenance.batches[0];
        assert.equal(record.itemSourceSheet, 'signature-mythic-weapon-sword-01-item.png');
        assert.equal(record.overlaySourceSheet, 'signature-mythic-weapon-sword-01-overlay.png');
        assert.equal(record.itemExports.length, 2);
        assert.equal(record.overlayExports.length, 2);

        for (const [index, name] of fixture.names.entries()) {
            const item = await readFile(join(fixture.publicRoot, record.itemExports[index].runtimePath.replace(/^\//, '')));
            const overlay = await readFile(join(fixture.publicRoot, record.overlayExports[index].runtimePath.replace(/^\//, '')));
            assert.deepEqual([item.readUInt32BE(16), item.readUInt32BE(20), item[25]], [160, 160, 6]);
            assert.deepEqual([overlay.readUInt32BE(16), overlay.readUInt32BE(20), overlay[25]], [72, 72, 6]);
            assert.equal(sha256(item), record.itemExports[index].exportSha256, name);
            assert.equal(sha256(overlay), record.overlayExports[index].exportSha256, name);
        }
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('paired signature processor replaces one approved batch only when revision is explicit', async () => {
    const fixture = await buildFullFixture();
    const batchId = 'signature-mythic-weapon-dagger-01';
    const names = FULL_BATCHES[batchId];
    const itemSourcePath = join(fixture.sourceDir, `${batchId}-item.png`);
    const overlaySourcePath = join(fixture.sourceDir, `${batchId}-overlay.png`);
    const protectedFiles = {
        provenance: fixture.provenancePath,
        runtime: fixture.publicRoot,
    };
    try {
        createPairedSheets(itemSourcePath, overlaySourcePath, names.length, false, 97);
        const before = await snapshotFiles(protectedFiles);

        const implicit = runPython(PROCESSOR_SCRIPT, fullProcessorArgs(fixture, batchId));
        assert.notEqual(implicit.status, 0);
        assert.match(implicit.stderr, /conflicting signature batchId/i);
        assert.deepEqual(await snapshotFiles(protectedFiles), before);

        const replaced = runPython(PROCESSOR_SCRIPT, [
            ...fullProcessorArgs(fixture, batchId),
            '--replace-existing',
        ]);
        assert.equal(replaced.status, 0, replaced.stderr);
        assert.match(replaced.stdout, /replaced 2 signature identities/i);

        const provenance = JSON.parse(await readFile(fixture.provenancePath, 'utf8'));
        const record = provenance.batches.find((entry) => entry.batchId === batchId);
        assert.equal(record.itemSourceSheetSha256, sha256(await readFile(itemSourcePath)));
        assert.equal(record.overlaySourceSheetSha256, sha256(await readFile(overlaySourcePath)));
        assert.notEqual(record.itemSourceSheetSha256, fixture.finalized.batches.find((entry) => entry.batchId === batchId).itemSourceSheetSha256);

        const after = await snapshotFiles(protectedFiles);
        assert.notDeepEqual(after, before);
        const replayed = runPython(PROCESSOR_SCRIPT, [
            ...fullProcessorArgs(fixture, batchId),
            '--replace-existing',
        ]);
        assert.equal(replayed.status, 0, replayed.stderr);
        assert.match(replayed.stdout, /replay no-op/i);
        assert.deepEqual(await snapshotFiles(protectedFiles), after);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('paired signature processor rejects contaminated trailing cells with total no-write behavior', async () => {
    const fixture = await buildFixture({ contaminateOverlayBlank: true });
    try {
        const before = await readFile(fixture.provenancePath);
        const result = runPython(PROCESSOR_SCRIPT, processorArgs(fixture));
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /unused trailing cell/i);
        assert.deepEqual(await readFile(fixture.provenancePath), before);
        const runtimeRoot = join(fixture.publicRoot, 'assets');
        await assert.rejects(stat(runtimeRoot), { code: 'ENOENT' });
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('paired signature processor rejects trapped chroma in a non-nature source cell without writes', async () => {
    const fixture = await buildFixture();
    try {
        const injected = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
import sys
path = sys.argv[1]
image = Image.open(path).convert('RGBA')
ImageDraw.Draw(image).rectangle((82, 72, 122, 112), fill=(0, 255, 0, 255))
image.save(path)
`, fixture.itemSourcePath], { encoding: 'utf8' });
        assert.equal(injected.status, 0, injected.stderr);
        const before = await readFile(fixture.provenancePath);

        const result = runPython(PROCESSOR_SCRIPT, processorArgs(fixture));

        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /chroma-green residual/i);
        assert.deepEqual(await readFile(fixture.provenancePath), before);
        await assert.rejects(stat(join(fixture.publicRoot, 'assets')), { code: 'ENOENT' });
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('signature chroma guard uses registry nature tone for a bounded accent without allowing contamination', () => {
    const result = spawnSync('python3', ['-c', `
import importlib.util
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, ${JSON.stringify(resolve(ROOT, 'scripts'))})
spec = importlib.util.spec_from_file_location('signature_batch_processor', ${JSON.stringify(PROCESSOR_SCRIPT)})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
identity = {'name': '바람의 궁극', 'elem': '', 'tone': 'nature'}
accent = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
ImageDraw.Draw(accent).rectangle((78, 78, 79, 79), fill=(120, 210, 125, 255))
module.validate_signature_chroma(accent, identity, 'overlay')
contaminated = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
ImageDraw.Draw(contaminated).rectangle((40, 40, 80, 80), fill=(0, 255, 0, 255))
try:
    module.validate_signature_chroma(contaminated, identity, 'overlay')
except ValueError as error:
    assert 'excessive chroma-green region' in str(error)
else:
    raise AssertionError('nature-tone contamination was accepted')
print('nature-tone-guard-ok')
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'nature-tone-guard-ok\n');
});

test('plain-node signature sync and cohort verifier accept one complete finalized paired ledger', async () => {
    const fixture = await buildFullFixture();
    const outputPath = join(fixture.directory, 'synced-manifest.json');
    try {
        const synced = spawnSync(process.execPath, [
            SYNC_SCRIPT,
            '--catalog', fixture.catalogPath,
            '--manifest', fixture.manifestPath,
            '--registry', REGISTRY_PATH,
            '--provenance', fixture.provenancePath,
            '--source-dir', fixture.sourceDir,
            '--public-root', fixture.publicRoot,
            '--output', outputPath,
        ], { encoding: 'utf8' });
        assert.equal(synced.status, 0, synced.stderr);
        assert.match(synced.stdout, /synced 25 signature item and overlay records/);

        const manifest = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.equal(Object.keys(manifest.artwork).length, 229);
        assert.equal(Object.keys(manifest.art.signatureOverlays).length, 25);
        assert.equal(manifest.styleVersion, 2);

        const verified = runNode(VERIFIER_SCRIPT, [
            '--scope', 'equipment',
            '--cohort', 'signature-mythic',
            '--equipment-manifest', outputPath,
            '--equipment-provenance', fixture.provenancePath,
            '--equipment-source-dir', fixture.sourceDir,
            '--public-root', fixture.publicRoot,
        ]);
        assert.equal(verified.status, 0, verified.stderr);
        const report = JSON.parse(verified.stdout);
        assert.equal(report.ok, true, JSON.stringify(report, null, 2));
        assert.deepEqual(report.verifiedSurfaces, ['equipment', 'signature-overlays']);
        assert.equal(report.exports.length, 50);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('art verifier honors an explicit signature registry and preserves reports when it is invalid', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-registry-override-'));
    const missingRegistry = join(directory, 'missing-registry.json');
    const reportPath = join(directory, 'report.json');
    const sentinel = Buffer.from('preserve-this-report\n');
    try {
        await writeFile(reportPath, sentinel);
        const result = runNode(VERIFIER_SCRIPT, [
            '--scope', 'all',
            '--signature-registry', missingRegistry,
            '--write-report', reportPath,
        ]);
        assert.notEqual(result.status, 0);
        assert.match(`${result.stdout}\n${result.stderr}`, /missing-registry\.json|ENOENT|no such file/i);
        assert.deepEqual(await readFile(reportPath), sentinel);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature sync and verifier reject route or prompt tampering without changing protected bytes', async () => {
    const fixture = await buildFullFixture();
    const validManifestPath = join(fixture.directory, 'valid-manifest.json');
    const syncOutputPath = join(fixture.directory, 'sync-output.json');
    const verifierReportPath = join(fixture.directory, 'verifier-report.json');
    const originalManifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
    try {
        const baseline = spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, validManifestPath)], { encoding: 'utf8' });
        assert.equal(baseline.status, 0, baseline.stderr);
        const validManifestBytes = await readFile(validManifestPath);

        const routeManifest = structuredClone(originalManifest);
        routeManifest.entries['대지의 심판'] = 'signature-route-drift';
        await writeFile(fixture.manifestPath, `${JSON.stringify(routeManifest, null, 2)}\n`);
        await assertRejectedWithoutWrites({
            run: () => spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, syncOutputPath)], { encoding: 'utf8' }),
            error: /route differ/i,
            sentinelPath: syncOutputPath,
            protectedFiles: {
                manifest: fixture.manifestPath,
                provenance: fixture.provenancePath,
                sources: fixture.sourceDir,
                runtime: fixture.publicRoot,
            },
        });

        const verifierManifest = JSON.parse(await readFile(validManifestPath, 'utf8'));
        verifierManifest.entries['대지의 심판'] = 'signature-route-drift';
        await writeFile(validManifestPath, `${JSON.stringify(verifierManifest, null, 2)}\n`);
        await assertRejectedWithoutWrites({
            run: () => runNode(VERIFIER_SCRIPT, verifierArgs(fixture, validManifestPath, verifierReportPath)),
            error: /route differ/i,
            sentinelPath: verifierReportPath,
            protectedFiles: {
                manifest: validManifestPath,
                provenance: fixture.provenancePath,
                sources: fixture.sourceDir,
                runtime: fixture.publicRoot,
            },
        });

        await writeFile(fixture.manifestPath, `${JSON.stringify(originalManifest, null, 2)}\n`);
        await writeFile(validManifestPath, validManifestBytes);
        const promptPath = join(fixture.sourceDir, 'batches', 'signature-mythic-weapon-sword-01.json');
        const promptBatch = JSON.parse(await readFile(promptPath, 'utf8'));
        promptBatch.itemPrompt = 'forged generic signature prompt';
        promptBatch.identities[0].overlayPrompt = 'forged generic overlay prompt';
        await writeFile(promptPath, `${JSON.stringify(promptBatch, null, 2)}\n`);

        await assertRejectedWithoutWrites({
            run: () => spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, syncOutputPath)], { encoding: 'utf8' }),
            error: /tracked prompt batch is invalid/i,
            sentinelPath: syncOutputPath,
            protectedFiles: {
                manifest: fixture.manifestPath,
                provenance: fixture.provenancePath,
                sources: fixture.sourceDir,
                runtime: fixture.publicRoot,
            },
        });

        await assertRejectedWithoutWrites({
            run: () => runNode(VERIFIER_SCRIPT, verifierArgs(fixture, validManifestPath, verifierReportPath)),
            error: /tracked prompt batch is invalid/i,
            sentinelPath: verifierReportPath,
            protectedFiles: {
                manifest: validManifestPath,
                provenance: fixture.provenancePath,
                sources: fixture.sourceDir,
                runtime: fixture.publicRoot,
            },
        });
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('signature sync and verifier reject unsafe item, overlay, and review paths without changing evidence', async () => {
    const fixture = await buildFullFixture();
    const validManifestPath = join(fixture.directory, 'valid-manifest.json');
    const syncOutputPath = join(fixture.directory, 'sync-output.json');
    const verifierReportPath = join(fixture.directory, 'verifier-report.json');
    try {
        const baseline = spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, validManifestPath)], { encoding: 'utf8' });
        assert.equal(baseline.status, 0, baseline.stderr);
        const originalManifestBytes = await readFile(fixture.manifestPath);
        const validManifestBytes = await readFile(validManifestPath);
        const provenanceBytes = await readFile(fixture.provenancePath);

        const restore = async () => Promise.all([
            writeFile(fixture.manifestPath, originalManifestBytes),
            writeFile(validManifestPath, validManifestBytes),
            writeFile(fixture.provenancePath, provenanceBytes),
        ]);
        const rejectBoth = async (error) => {
            await assertRejectedWithoutWrites({
                run: () => spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, syncOutputPath)], { encoding: 'utf8' }),
                error,
                sentinelPath: syncOutputPath,
                protectedFiles: {
                    manifest: fixture.manifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
            await assertRejectedWithoutWrites({
                run: () => runNode(VERIFIER_SCRIPT, verifierArgs(fixture, validManifestPath, verifierReportPath)),
                error,
                sentinelPath: verifierReportPath,
                protectedFiles: {
                    manifest: validManifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
        };

        const itemTraversal = JSON.parse(provenanceBytes);
        itemTraversal.batches[0].itemSourceSheet = '../escaped.png';
        await writeFile(fixture.provenancePath, `${JSON.stringify(itemTraversal, null, 2)}\n`);
        await rejectBoth(/item source must be a safe PNG basename/i);
        await restore();

        const overlayTraversal = JSON.parse(provenanceBytes);
        overlayTraversal.batches[0].overlaySourceSheet = '/tmp/escaped.png';
        await writeFile(fixture.provenancePath, `${JSON.stringify(overlayTraversal, null, 2)}\n`);
        await rejectBoth(/overlay source must be a safe PNG basename/i);
        await restore();

        const rawTraversal = JSON.parse(provenanceBytes);
        rawTraversal.generationReview.accepted[0].rawImage = '../escaped.png';
        const originalManifest = JSON.parse(originalManifestBytes);
        const verifierManifest = JSON.parse(validManifestBytes);
        const reviewPin = hashCanonicalJson(rawTraversal.generationReview);
        originalManifest.pipeline.provenance.cohorts['signature-mythic'].generationReviewSha256 = reviewPin;
        verifierManifest.pipeline.provenance.cohorts['signature-mythic'].generationReviewSha256 = reviewPin;
        await Promise.all([
            writeFile(fixture.provenancePath, `${JSON.stringify(rawTraversal, null, 2)}\n`),
            writeFile(fixture.manifestPath, `${JSON.stringify(originalManifest, null, 2)}\n`),
            writeFile(validManifestPath, `${JSON.stringify(verifierManifest, null, 2)}\n`),
        ]);
        await rejectBoth(/rawImage must be a safe PNG basename/i);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('signature sync and verifier reject duplicate, non-PNG, or non-reconstructable paired sources without writes', async () => {
    const fixture = await buildFullFixture();
    const validManifestPath = join(fixture.directory, 'valid-manifest.json');
    const syncOutputPath = join(fixture.directory, 'sync-output.json');
    const verifierReportPath = join(fixture.directory, 'verifier-report.json');
    try {
        const baseline = spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, validManifestPath)], { encoding: 'utf8' });
        assert.equal(baseline.status, 0, baseline.stderr);
        const provenanceBytes = await readFile(fixture.provenancePath);
        const provenance = JSON.parse(provenanceBytes);
        const itemPath = join(fixture.sourceDir, provenance.batches[0].itemSourceSheet);
        const overlayRecord = provenance.batches.find((record) => record.identityNames.length > 1);
        const overlayPath = join(fixture.sourceDir, overlayRecord.overlaySourceSheet);
        const [itemBytes, overlayBytes] = await Promise.all([readFile(itemPath), readFile(overlayPath)]);

        const replayBefore = await snapshotFiles({
            manifest: fixture.manifestPath,
            provenance: fixture.provenancePath,
            sources: fixture.sourceDir,
            runtime: fixture.publicRoot,
        });
        const replayed = runPython(PROCESSOR_SCRIPT, fullProcessorArgs(fixture, overlayRecord.batchId));
        assert.equal(replayed.status, 0, replayed.stderr);
        assert.match(replayed.stdout, /replay no-op/i);
        assert.deepEqual(await snapshotFiles({
            manifest: fixture.manifestPath,
            provenance: fixture.provenancePath,
            sources: fixture.sourceDir,
            runtime: fixture.publicRoot,
        }), replayBefore);

        const restore = async () => Promise.all([
            writeFile(fixture.provenancePath, provenanceBytes),
            writeFile(itemPath, itemBytes),
            writeFile(overlayPath, overlayBytes),
        ]);
        const rejectBoth = async (error) => {
            await assertRejectedWithoutWrites({
                run: () => spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, syncOutputPath)], { encoding: 'utf8' }),
                error,
                sentinelPath: syncOutputPath,
                protectedFiles: {
                    manifest: fixture.manifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
            await assertRejectedWithoutWrites({
                run: () => runNode(VERIFIER_SCRIPT, verifierArgs(fixture, validManifestPath, verifierReportPath)),
                error,
                sentinelPath: verifierReportPath,
                protectedFiles: {
                    manifest: validManifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
        };

        const duplicate = structuredClone(provenance);
        duplicate.batches[1].itemSourceSheetSha256 = duplicate.batches[0].itemSourceSheetSha256;
        duplicate.batches[1].replayKey = signatureReplayKey(duplicate.batches[1]);
        await writeFile(fixture.provenancePath, `${JSON.stringify(duplicate, null, 2)}\n`);
        await rejectBoth(/source hash is duplicated/i);
        await restore();

        const nonPngBytes = Buffer.from('not a PNG source sheet\n');
        await writeFile(itemPath, nonPngBytes);
        const nonPng = structuredClone(provenance);
        nonPng.batches[0].itemSourceSheetSha256 = sha256(nonPngBytes);
        nonPng.batches[0].replayKey = signatureReplayKey(nonPng.batches[0]);
        await writeFile(fixture.provenancePath, `${JSON.stringify(nonPng, null, 2)}\n`);
        await rejectBoth(/source reconstruction failed|true RGBA 600x400|cannot identify image file/i);
        await restore();

        const swapped = spawnSync('python3', ['-c', `
from PIL import Image
import sys
path = sys.argv[1]
with Image.open(path) as opened:
    image = opened.convert('RGBA')
first = image.crop((0, 0, 200, 200))
second = image.crop((200, 0, 400, 200))
image.paste(second, (0, 0))
image.paste(first, (200, 0))
image.save(path)
`, overlayPath], { encoding: 'utf8' });
        assert.equal(swapped.status, 0, swapped.stderr);
        const drift = structuredClone(provenance);
        const driftRecord = drift.batches.find((record) => record.batchId === overlayRecord.batchId);
        driftRecord.overlaySourceSheetSha256 = sha256(await readFile(overlayPath));
        driftRecord.replayKey = signatureReplayKey(driftRecord);
        await writeFile(fixture.provenancePath, `${JSON.stringify(drift, null, 2)}\n`);
        await rejectBoth(/source does not reproduce runtime exports/i);
        const conflictBefore = await snapshotFiles({
            manifest: fixture.manifestPath,
            provenance: fixture.provenancePath,
            sources: fixture.sourceDir,
            runtime: fixture.publicRoot,
        });
        const conflicted = runPython(PROCESSOR_SCRIPT, fullProcessorArgs(fixture, overlayRecord.batchId));
        assert.notEqual(conflicted.status, 0);
        assert.match(conflicted.stderr, /conflicting signature batchId/i);
        assert.deepEqual(await snapshotFiles({
            manifest: fixture.manifestPath,
            provenance: fixture.provenancePath,
            sources: fixture.sourceDir,
            runtime: fixture.publicRoot,
        }), conflictBefore);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('signature sync and verifier reject export hash collisions across every style-v2 art surface', async () => {
    const fixture = await buildFullFixture();
    const validManifestPath = join(fixture.directory, 'valid-manifest.json');
    const syncOutputPath = join(fixture.directory, 'sync-output.json');
    const verifierReportPath = join(fixture.directory, 'verifier-report.json');
    try {
        const baseline = spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, validManifestPath)], { encoding: 'utf8' });
        assert.equal(baseline.status, 0, baseline.stderr);
        const originalManifestBytes = await readFile(fixture.manifestPath);
        const validManifestBytes = await readFile(validManifestPath);
        const provenance = JSON.parse(await readFile(fixture.provenancePath, 'utf8'));
        const signatureItemHash = provenance.batches[0].itemExports[0].exportSha256;
        const signatureOverlayHash = provenance.batches[0].overlayExports[0].exportSha256;

        const mutateBoth = async (mutate) => {
            const syncManifest = JSON.parse(originalManifestBytes);
            const verifierManifest = JSON.parse(validManifestBytes);
            mutate(syncManifest);
            mutate(verifierManifest);
            await Promise.all([
                writeFile(fixture.manifestPath, `${JSON.stringify(syncManifest, null, 2)}\n`),
                writeFile(validManifestPath, `${JSON.stringify(verifierManifest, null, 2)}\n`),
            ]);
        };
        const rejectBoth = async () => {
            await assertRejectedWithoutWrites({
                run: () => spawnSync(process.execPath, [SYNC_SCRIPT, ...syncArgs(fixture, fixture.manifestPath, syncOutputPath)], { encoding: 'utf8' }),
                error: /export hash is duplicated/i,
                sentinelPath: syncOutputPath,
                protectedFiles: {
                    manifest: fixture.manifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
            await assertRejectedWithoutWrites({
                run: () => runNode(VERIFIER_SCRIPT, verifierArgs(fixture, validManifestPath, verifierReportPath)),
                error: /export hash is duplicated/i,
                sentinelPath: verifierReportPath,
                protectedFiles: {
                    manifest: validManifestPath,
                    provenance: fixture.provenancePath,
                    sources: fixture.sourceDir,
                    runtime: fixture.publicRoot,
                },
            });
        };

        await mutateBoth((manifest) => {
            const existingName = Object.keys(manifest.artwork).find((name) => !fixture.registry.entries[name]);
            manifest.artwork[existingName].exportSha256 = signatureItemHash;
        });
        await rejectBoth();

        await mutateBoth((manifest) => {
            const existingItem = Object.values(manifest.artwork).find((entry) => entry?.styleVersion === 2);
            manifest.art.signatureOverlays['forged-item-collision'] = {
                styleVersion: 2,
                familyKey: 'weapon-sword',
                batchId: 'forged-overlay',
                sourcePath: 'forged-overlay.png',
                sourceSha256: '1'.repeat(64),
                exportSha256: existingItem.exportSha256,
                runtimePath: '/assets/equipment-wearable-exact/forged-item-collision.png',
            };
        });
        await rejectBoth();

        await mutateBoth((manifest) => {
            const family = Object.values(manifest.art.families).find((entry) => entry?.styleVersion === 2);
            manifest.art.signatureOverlays['forged-family-collision'] = {
                styleVersion: 2,
                familyKey: 'weapon-sword',
                batchId: 'forged-overlay',
                sourcePath: 'forged-overlay.png',
                sourceSha256: '2'.repeat(64),
                exportSha256: family.exportSha256,
                runtimePath: '/assets/equipment-wearable-exact/forged-family-collision.png',
            };
        });
        await rejectBoth();

        await mutateBoth((manifest) => {
            manifest.art.signatureOverlays['forged-overlay-collision'] = {
                styleVersion: 2,
                familyKey: 'weapon-sword',
                batchId: 'forged-overlay',
                sourcePath: 'forged-overlay.png',
                sourceSha256: '3'.repeat(64),
                exportSha256: signatureOverlayHash,
                runtimePath: '/assets/equipment-wearable-exact/forged-overlay-collision.png',
            };
        });
        await rejectBoth();
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test('paired signature publication rolls back item, overlay, and ledger bytes after a mid-transaction failure', async () => {
    const fixture = await buildFixture();
    try {
        const script = [
            'import importlib.util',
            'import sys',
            'from pathlib import Path',
            `sys.path.insert(0, ${JSON.stringify(resolve(ROOT, 'scripts'))})`,
            `spec = importlib.util.spec_from_file_location('signature_batch_processor', ${JSON.stringify(PROCESSOR_SCRIPT)})`,
            'module = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(module)',
            `args = ${JSON.stringify(processorArgs(fixture))}`,
            `public_root = Path(${JSON.stringify(fixture.publicRoot)})`,
            `provenance = Path(${JSON.stringify(fixture.provenancePath)})`,
            'before_ledger = provenance.read_bytes()',
            'shared_globals = module.publish_staged_batch.__globals__',
            'real_replace = shared_globals["os"].replace',
            'replace_count = 0',
            'def fail_during_overlay(source, destination):',
            '    global replace_count',
            '    replace_count += 1',
            '    if replace_count == 4:',
            '        raise OSError("injected paired publication failure")',
            '    return real_replace(source, destination)',
            'shared_globals["os"].replace = fail_during_overlay',
            'try:',
            '    module.main(args)',
            'except OSError as error:',
            '    assert str(error) == "injected paired publication failure"',
            'else:',
            '    raise AssertionError("paired publication failure was not raised")',
            'assert provenance.read_bytes() == before_ledger',
            'assert not list(public_root.rglob("*.png"))',
            'assert not list(public_root.rglob("*.stage"))',
            'print("paired-rollback-ok")',
        ].join('\n');
        const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, 'paired-rollback-ok\n');
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
});
