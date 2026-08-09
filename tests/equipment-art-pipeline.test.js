import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import { getItemIconAssetSrc } from '../src/utils/itemVisuals.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_SCRIPT = resolve(REPO_ROOT, 'scripts/dump-equipment-catalog.mjs');
const PROMPT_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_art_prompts.mjs');
const BATCH_PROCESSOR_SCRIPT = resolve(REPO_ROOT, 'scripts/process_equipment_art_batch.py');
const LEGACY_GENERATOR_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_item_art.py');
const FAMILY_SOURCE_DIR = resolve(REPO_ROOT, 'public/assets/equipment-family/items');
const EQUIPMENT_MANIFEST_PATH = resolve(REPO_ROOT, 'src/data/equipmentArtManifest.json');
const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

const compareCodePoints = (left, right) => {
    const leftText = String(left);
    const rightText = String(right);
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < leftText.length && rightIndex < rightText.length) {
        const leftCodePoint = leftText.codePointAt(leftIndex);
        const rightCodePoint = rightText.codePointAt(rightIndex);
        if (leftCodePoint !== rightCodePoint) return leftCodePoint < rightCodePoint ? -1 : 1;
        leftIndex += leftCodePoint > 0xffff ? 2 : 1;
        rightIndex += rightCodePoint > 0xffff ? 2 : 1;
    }

    return leftIndex === leftText.length && rightIndex === rightText.length
        ? 0
        : leftIndex === leftText.length ? -1 : 1;
};

const runDump = (args) => spawnSync(process.execPath, ['--import', 'tsx', DUMP_SCRIPT, ...args], {
    encoding: 'utf8',
});

const runLegacyGenerator = (args) => spawnSync('python3', [LEGACY_GENERATOR_SCRIPT, ...args], {
    encoding: 'utf8',
});

const runPromptGenerator = (args) => spawnSync(process.execPath, ['--import', 'tsx', PROMPT_SCRIPT, ...args], {
    encoding: 'utf8',
});

const runBatchProcessor = (args) => spawnSync('python3', [BATCH_PROCESSOR_SCRIPT, ...args], {
    encoding: 'utf8',
});

const expectedEquipmentRuntimePaths = new Map(
    Object.values(ITEMS)
        .flat()
        .filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type))
        .map((item) => [item.name, getItemIconAssetSrc(item)])
);

test('equipment catalog dump writes the sorted current 233-row runtime catalog without a temporary path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-dump-'));
    const outputPath = join(directory, 'equipment-catalog.json');
    try {
        const outputResult = runDump(['--output', outputPath]);
        assert.equal(outputResult.status, 0, outputResult.stderr);
        const stdoutResult = runDump(['--stdout']);
        assert.equal(stdoutResult.status, 0, stdoutResult.stderr);

        const rows = JSON.parse(await readFile(outputPath, 'utf8'));
        const stdoutRows = JSON.parse(stdoutResult.stdout);
        assert.deepEqual(stdoutRows, rows);
        assert.equal(rows.length, 233);
        assert.equal(new Set(rows.map((row) => row.name)).size, 233);
        assert.ok(rows.every((row) => row.familyKey), 'Every used equipment identity needs a family key');
        assert.ok(rows.every((row, index) => index === 0 || compareCodePoints(rows[index - 1].name, row.name) < 0));
        assert.doesNotMatch(JSON.stringify(rows), /\/tmp\//);

        for (const row of rows) {
            assert.equal(row.runtimePath, expectedEquipmentRuntimePaths.get(row.name), `Current runtime path for ${row.name}`);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('legacy equipment generator validates only explicit inputs and dry-run writes nothing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-generator-'));
    const catalogPath = join(directory, 'catalog.json');
    const outputDir = join(directory, 'generated');
    const manifestPath = join(directory, 'equipment-manifest.json');
    try {
        await writeFile(catalogPath, `${JSON.stringify([{
            name: '검증용 검',
            type: 'weapon',
            tier: 1,
            elem: '',
            familyKey: 'weapon-sword',
            runtimePath: '/assets/equipment-exact/auto/auto-validation.png',
            cohort: 'weapon-core',
        }])}\n`);

        const result = runLegacyGenerator([
            '--catalog', catalogPath,
            '--source-dir', FAMILY_SOURCE_DIR,
            '--output-dir', outputDir,
            '--manifest', manifestPath,
            '--dry-run',
        ]);

        assert.equal(result.status, 0, result.stderr);
        await assert.rejects(stat(outputDir), { code: 'ENOENT' });
        await assert.rejects(stat(manifestPath), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('legacy equipment generator reports the exact missing explicit catalog path', () => {
    const missingCatalogPath = resolve(REPO_ROOT, 'output/missing-equipment-catalog.json');
    const result = runLegacyGenerator([
        '--catalog', missingCatalogPath,
        '--source-dir', FAMILY_SOURCE_DIR,
        '--output-dir', resolve(REPO_ROOT, 'output/equipment-generator-test-output'),
        '--manifest', resolve(REPO_ROOT, 'output/equipment-generator-test-manifest.json'),
        '--dry-run',
    ]);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, `Missing input path: ${missingCatalogPath}\n`);
});

test('legacy equipment generator preserves additive pipeline metadata when replacing entries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-metadata-'));
    const sourcePath = join(directory, 'source-manifest.json');
    const outputPath = join(directory, 'output-manifest.json');
    const sourceManifest = {
        $comment: 'Task 2 metadata fixture',
        version: 1,
        catalogSha256: 'a'.repeat(64),
        styleVersion: 1,
        art: { width: 160, height: 160, margin: 8 },
        pipeline: { version: 1, grid: { columns: 3, rows: 2, cellOrder: CELL_ORDER } },
        entries: { '이전 검': 'auto/old' },
    };
    try {
        await writeFile(sourcePath, `${JSON.stringify(sourceManifest)}\n`);
        const script = [
            'import importlib.util',
            'from pathlib import Path',
            `spec = importlib.util.spec_from_file_location('equipment_generator', ${JSON.stringify(LEGACY_GENERATOR_SCRIPT)})`,
            'module = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(module)',
            `module.write_manifest({'새 검': 'auto/new'}, Path(${JSON.stringify(outputPath)}), Path(${JSON.stringify(sourcePath)}))`,
        ].join('\n');
        const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        const manifest = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.deepEqual(manifest.pipeline, sourceManifest.pipeline);
        assert.deepEqual(manifest.entries, { '새 검': 'auto/new' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment prompt batch uses the fixed six-cell order and Art Bible language', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-prompts-'));
    const catalogPath = join(directory, 'catalog.json');
    const outputPath = join(directory, 'weapon-core-001.json');
    const rows = [
        { name: '가람의 검', type: 'weapon', tier: 1, elem: '', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/garam.png', cohort: 'weapon-core' },
        { name: '나래의 검', type: 'weapon', tier: 2, elem: '냉기', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/narae.png', cohort: 'weapon-core' },
        { name: '다온의 검', type: 'weapon', tier: 3, elem: '자연', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/daon.png', cohort: 'weapon-core' },
        { name: '라온의 검', type: 'weapon', tier: 4, elem: '화염', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/raon.png', cohort: 'weapon-core' },
        { name: '마루의 검', type: 'weapon', tier: 5, elem: '빛', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/maru.png', cohort: 'weapon-core' },
        { name: '바다의 검', type: 'weapon', tier: 6, elem: '에테르', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/bada.png', cohort: 'weapon-core' },
    ];
    try {
        await writeFile(catalogPath, `${JSON.stringify(rows)}\n`);
        const result = runPromptGenerator([
            '--catalog', catalogPath,
            '--batch-id', 'weapon-core-001',
            '--names', '바다의 검,마루의 검,라온의 검,다온의 검,나래의 검,가람의 검',
            '--output', outputPath,
        ]);

        assert.equal(result.status, 0, result.stderr);
        const batch = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.deepEqual(batch.grid, { columns: 3, rows: 2, cellOrder: CELL_ORDER });
        assert.deepEqual(batch.identityNames, ['가람의 검', '나래의 검', '다온의 검', '라온의 검', '마루의 검', '바다의 검']);
        assert.deepEqual(batch.identities.map((entry) => entry.cell), CELL_ORDER);
        assert.equal(batch.identities.length, 6);
        assert.equal(new Set(batch.identityNames).size, 6);
        assert.match(batch.prompt, /transparent 2x3 grid/i);
        assert.match(batch.prompt, /six isolated icons/i);
        assert.match(batch.prompt, /no labels/i);
        assert.match(batch.prompt, /equal cell padding/i);
        assert.match(batch.identities[0].prompt, /가람의 검/);
        assert.match(batch.identities[0].prompt, /weapon-sword/);
        assert.match(batch.identities[0].prompt, /T1/);
        assert.match(batch.identities[0].prompt, /worn wood, iron, or cloth/i);
        assert.match(batch.identities[3].prompt, /dark-red metal, cracked surface/i);
        assert.match(batch.identities[5].prompt, /separated pieces, grid structure/i);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

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

const createProcessorFixture = async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-batch-'));
    const sourceManifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
    const selectedEntries = Object.entries(sourceManifest.entries).slice(0, 6);
    const identities = selectedEntries.map(([name, entry], index) => ({
        cell: CELL_ORDER[index],
        name,
        runtimePath: `/assets/equipment-exact/${entry}.png`,
    }));
    const batch = {
        version: 1,
        batchId: 'equipment-pipeline-test-001',
        cohort: 'weapon-core',
        grid: { columns: 3, rows: 2, cellOrder: CELL_ORDER },
        identityNames: identities.map((entry) => entry.name),
        identities,
    };
    const batchPath = join(directory, 'batch.json');
    const declarationPath = join(directory, 'source-declaration.json');
    const sourceSheetPath = join(directory, 'source-sheet.png');
    const publicRoot = join(directory, 'public');
    const manifestPath = join(directory, 'equipmentArtManifest.json');
    const provenancePath = join(directory, 'provenance.json');
    await writeFile(batchPath, `${JSON.stringify(batch)}\n`);
    await writeFile(declarationPath, `${JSON.stringify({ batchId: batch.batchId, identityNames: batch.identityNames })}\n`);
    await writeFile(manifestPath, `${JSON.stringify(sourceManifest)}\n`);
    createSourceSheet(sourceSheetPath);

    return {
        batch,
        batchPath,
        declarationPath,
        directory,
        manifestPath,
        provenancePath,
        publicRoot,
        sourceManifest,
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

test('equipment batch processor dry-run refuses a mismatched six-identity declaration before writes', async () => {
    const fixture = await createProcessorFixture();
    try {
        const mismatched = [...fixture.batch.identityNames];
        mismatched[5] = '잘못된 선언';
        await writeFile(fixture.declarationPath, `${JSON.stringify({ batchId: fixture.batch.batchId, identityNames: mismatched })}\n`);

        const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

        assert.equal(result.status, 1);
        assert.equal(result.stderr, `Declared identities do not match batch manifest: ${fixture.batch.batchId}\n`);
        await assert.rejects(stat(fixture.publicRoot), { code: 'ENOENT' });
        await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('equipment batch processor dry-run validates matching inputs without writing runtime files or provenance', async () => {
    const fixture = await createProcessorFixture();
    try {
        const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

        assert.equal(result.status, 0, result.stderr);
        await assert.rejects(stat(join(fixture.publicRoot, fixture.batch.identities[0].runtimePath.slice(1))), { code: 'ENOENT' });
        await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('equipment batch processor crops six cells into existing runtime paths and writes stable provenance', async () => {
    const fixture = await createProcessorFixture();
    try {
        const result = runBatchProcessor(processorArgs(fixture));
        assert.equal(result.status, 0, result.stderr);

        const paths = fixture.batch.identities.map((entry) => join(fixture.publicRoot, entry.runtimePath.slice(1)));
        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `paths = json.loads(${JSON.stringify(JSON.stringify(paths))})`,
            'rows = []',
            'for path in paths:',
            '    with Image.open(path) as image:',
            '        alpha = image.convert("RGBA").getchannel("A")',
            '        rows.append({"size": image.size, "transparent": alpha.getextrema()[0] == 0})',
            'print(json.dumps(rows))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        assert.deepEqual(JSON.parse(inspection.stdout), Array.from({ length: 6 }, () => ({ size: [160, 160], transparent: true })));

        const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
        assert.deepEqual(manifest, fixture.sourceManifest);
        const provenance = JSON.parse(await readFile(fixture.provenancePath, 'utf8'));
        assert.equal(provenance.version, 1);
        assert.equal(provenance.batches.length, 1);
        assert.deepEqual(provenance.batches[0].identityNames, fixture.batch.identityNames);
        assert.deepEqual(provenance.batches[0].exports.map((entry) => entry.runtimePath), fixture.batch.identities.map((entry) => entry.runtimePath));
        assert.ok(provenance.batches[0].exports.every((entry) => /^[0-9a-f]{64}$/.test(entry.exportSha256)));
        assert.match(provenance.batches[0].sourceSheetSha256, /^[0-9a-f]{64}$/);
    } finally {
        await fixture.dispose();
    }
});
