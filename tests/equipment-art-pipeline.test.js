import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

const createSourceSheet = (path, { kind = 'valid', colorOffset = 0 } = {}) => {
    const script = [
        'from PIL import Image, ImageDraw',
        `kind = ${JSON.stringify(kind)}`,
        `color_offset = ${JSON.stringify(colorOffset)}`,
        'if kind == "opaque-rgb":',
        '    image = Image.new("RGB", (600, 400), (48, 72, 96))',
        'elif kind == "opaque-rgba":',
        '    image = Image.new("RGBA", (600, 400), (48, 72, 96, 255))',
        'elif kind == "malformed-dimensions":',
        '    image = Image.new("RGBA", (600, 200), (0, 0, 0, 0))',
        'else:',
        '    image = Image.new("RGBA", (600, 400), (0, 0, 0, 0))',
        'draw = ImageDraw.Draw(image)',
        'if kind not in {"opaque-rgb", "opaque-rgba"}:',
        '    cell_height = image.height // 2',
        '    for index in range(6):',
        '        column = index % 3',
        '        row = index // 3',
        '        left = column * 200 + 48',
        '        top = row * cell_height + 20',
        '        if kind == "empty-cell" and index == 5:',
        '            continue',
        '        if kind == "one-pixel-cell" and index == 5:',
        '            image.putpixel((left, top), (255, 255, 255, 255))',
        '            continue',
        '        if kind == "touching-cell-boundary" and index == 5:',
        '            draw.rectangle((column * 200, row * cell_height, column * 200 + 92, row * cell_height + 118), fill=(255, 255, 255, 255))',
        '            continue',
        '        draw.rectangle((left, top, left + 92, top + min(118, cell_height - 28)), fill=(40 + index * 30 + color_offset, 90, 170, 255))',
        `image.save(${JSON.stringify(path)})`,
    ].join('\n');
    const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

const createProcessorFixture = async ({ batchId = 'equipment-pipeline-test-001' } = {}) => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-batch-'));
    const sourceManifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
    const catalogPath = join(directory, 'equipment-catalog.json');
    const batchPath = join(directory, 'batch.json');
    const declarationPath = join(directory, 'source-declaration.json');
    const sourceSheetPath = join(directory, 'source-sheet.png');
    const publicRoot = join(directory, 'public');
    const manifestPath = join(directory, 'equipmentArtManifest.json');
    const provenancePath = join(directory, 'provenance.json');
    const dumpResult = runDump(['--output', catalogPath]);
    assert.equal(dumpResult.status, 0, dumpResult.stderr);
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    const selected = catalog.filter((row) => row.cohort === 'weapon-core').slice(0, 6);
    assert.equal(selected.length, 6, 'The live catalog must supply one complete real prompt cohort fixture');
    const promptResult = runPromptGenerator([
        '--catalog', catalogPath,
        '--batch-id', batchId,
        '--names', selected.map((row) => row.name).reverse().join(','),
        '--output', batchPath,
    ]);
    assert.equal(promptResult.status, 0, promptResult.stderr);
    const batch = JSON.parse(await readFile(batchPath, 'utf8'));
    await writeFile(declarationPath, `${JSON.stringify({ batchId: batch.batchId, identityNames: batch.identityNames })}\n`);
    await writeFile(manifestPath, `${JSON.stringify(sourceManifest)}\n`);
    createSourceSheet(sourceSheetPath);

    return {
        batch,
        batchPath,
        catalog,
        catalogPath,
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
    '--catalog', fixture.catalogPath,
    '--source-sheet', fixture.sourceSheetPath,
    '--source-declaration', fixture.declarationPath,
    '--public-root', fixture.publicRoot,
    '--equipment-manifest', fixture.manifestPath,
    '--provenance', fixture.provenancePath,
    ...extra,
];

const rewriteDeclaration = async (fixture) => {
    await writeFile(fixture.declarationPath, `${JSON.stringify({
        batchId: fixture.batch.batchId,
        identityNames: fixture.batch.identityNames,
    })}\n`);
};

const regeneratePromptBatch = async (fixture) => {
    const result = runPromptGenerator([
        '--catalog', fixture.catalogPath,
        '--batch-id', fixture.batch.batchId,
        '--names', fixture.batch.identityNames.slice().reverse().join(','),
        '--output', fixture.batchPath,
    ]);
    assert.equal(result.status, 0, result.stderr);
    fixture.batch = JSON.parse(await readFile(fixture.batchPath, 'utf8'));
    await rewriteDeclaration(fixture);
};

const runtimeOutputPaths = (fixture) => fixture.batch.identities.map((identity) => (
    join(fixture.publicRoot, identity.runtimePath.slice(1))
));

const assertNoProcessorWrites = async (fixture) => {
    await assert.rejects(stat(fixture.publicRoot), { code: 'ENOENT' });
    await assert.rejects(stat(fixture.provenancePath), { code: 'ENOENT' });
};

const writeExistingOutputs = async (fixture) => {
    const paths = runtimeOutputPaths(fixture);
    for (const [index, path] of paths.entries()) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `existing-output-${index}`);
    }
    return paths;
};

const readByteSnapshot = async (paths) => Promise.all(paths.map((path) => readFile(path)));

test('actual prompt-generator batch is bound to the authoritative catalog hash and full catalog rows', async () => {
    const fixture = await createProcessorFixture();
    try {
        assert.equal(fixture.batch.catalogSha256, fixture.sourceManifest.catalogSha256);
        const catalogByName = new Map(fixture.catalog.map((row) => [row.name, row]));
        assert.deepEqual(
            fixture.batch.identities.map(({ cell, prompt, ...row }) => row),
            fixture.batch.identityNames.map((name) => catalogByName.get(name)),
        );
    } finally {
        await fixture.dispose();
    }
});

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

test('equipment batch processor rejects a prompt batch whose catalog projection is tampered before writes', async (t) => {
    const catalogMutations = [
        {
            name: 'catalog row tier',
            mutate(rows, names) {
                rows.find((row) => row.name === names[0]).tier = 6;
            },
        },
        {
            name: 'catalog cohort',
            mutate(rows, names) {
                for (const row of rows.filter((row) => names.includes(row.name))) row.cohort = 'armor';
            },
        },
        {
            name: 'catalog family',
            mutate(rows, names) {
                rows.find((row) => row.name === names[0]).familyKey = 'weapon-dagger';
            },
        },
        {
            name: 'catalog element',
            mutate(rows, names) {
                rows.find((row) => row.name === names[0]).elem = '화염';
            },
        },
        {
            name: 'catalog runtime path',
            mutate(rows, names) {
                rows.find((row) => row.name === names[0]).runtimePath = '/assets/equipment-exact/auto/tampered-runtime.png';
            },
        },
    ];

    for (const mutation of catalogMutations) {
        await t.test(mutation.name, async () => {
            const fixture = await createProcessorFixture();
            try {
                const rows = JSON.parse(await readFile(fixture.catalogPath, 'utf8'));
                mutation.mutate(rows, fixture.batch.identityNames);
                await writeFile(fixture.catalogPath, `${JSON.stringify(rows)}\n`);
                await regeneratePromptBatch(fixture);

                const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

                assert.equal(result.status, 1);
                assert.match(result.stderr, /catalogSha256/i);
                await assertNoProcessorWrites(fixture);
            } finally {
                await fixture.dispose();
            }
        });
    }
});

test('equipment batch processor rejects every tampered identity field before writes', async (t) => {
    const mutations = [
        { name: 'unsupported batch cohort', mutate: (batch) => { batch.cohort = 'unsupported-cohort'; } },
        { name: 'batch cohort mismatch', mutate: (batch) => { batch.cohort = 'armor'; } },
        { name: 'identity type', mutate: (batch) => { batch.identities[0].type = 'armor'; } },
        { name: 'identity tier', mutate: (batch) => { batch.identities[0].tier = 6; } },
        { name: 'identity element', mutate: (batch) => { batch.identities[0].elem = '화염'; } },
        { name: 'identity family', mutate: (batch) => { batch.identities[0].familyKey = 'armor-plate'; } },
        { name: 'identity runtime path', mutate: (batch) => { batch.identities[0].runtimePath = '/assets/equipment-exact/auto/tampered-path.png'; } },
        { name: 'identity cohort', mutate: (batch) => { batch.identities[0].cohort = 'armor'; } },
        {
            name: 'duplicate identity name',
            mutate: (batch) => {
                batch.identities[1].name = batch.identities[0].name;
                batch.identityNames[1] = batch.identityNames[0];
            },
        },
        {
            name: 'duplicate runtime path',
            mutate: (batch) => { batch.identities[1].runtimePath = batch.identities[0].runtimePath; },
        },
        {
            name: 'runtime traversal',
            mutate: (batch) => { batch.identities[0].runtimePath = '/assets/equipment-exact/../escaped.png'; },
        },
    ];

    for (const mutation of mutations) {
        await t.test(mutation.name, async () => {
            const fixture = await createProcessorFixture();
            try {
                mutation.mutate(fixture.batch);
                await writeFile(fixture.batchPath, `${JSON.stringify(fixture.batch)}\n`);
                await rewriteDeclaration(fixture);

                const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

                assert.equal(result.status, 1);
                assert.match(result.stderr, /Batch|catalog/i);
                await assertNoProcessorWrites(fixture);
            } finally {
                await fixture.dispose();
            }
        });
    }
});

test('equipment batch processor rejects opaque or degenerate source sheets before writes', async (t) => {
    const sourceCases = [
        { name: 'opaque RGB source', kind: 'opaque-rgb', error: /true RGBA/i },
        { name: 'fully opaque RGBA source', kind: 'opaque-rgba', error: /transparent and opaque/i },
        { name: 'malformed declared dimensions', kind: 'malformed-dimensions', error: /600x400/i },
        { name: 'empty cell', kind: 'empty-cell', error: /empty|opaque icon pixels/i },
        { name: 'one pixel cell', kind: 'one-pixel-cell', error: /degenerate/i },
        { name: 'cell content touches grid boundary', kind: 'touching-cell-boundary', error: /bounds|padding|boundary/i },
    ];

    for (const sourceCase of sourceCases) {
        await t.test(sourceCase.name, async () => {
            const fixture = await createProcessorFixture();
            try {
                createSourceSheet(fixture.sourceSheetPath, { kind: sourceCase.kind });

                const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

                assert.equal(result.status, 1);
                assert.match(result.stderr, sourceCase.error);
                await assertNoProcessorWrites(fixture);
            } finally {
                await fixture.dispose();
            }
        });
    }
});

test('equipment batch processor rejects an invalid provenance ledger without replacing existing outputs', async () => {
    const fixture = await createProcessorFixture();
    try {
        const paths = await writeExistingOutputs(fixture);
        const beforeOutputs = await readByteSnapshot(paths);
        const invalidLedger = Buffer.from('{"version":2,"batches":[]}\n');
        await writeFile(fixture.provenancePath, invalidLedger);

        const result = runBatchProcessor(processorArgs(fixture));

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Invalid provenance ledger/);
        assert.deepEqual(await readByteSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(fixture.provenancePath), invalidLedger);
    } finally {
        await fixture.dispose();
    }
});

test('equipment batch processor treats an exact batch replay as a no-op without duplicate provenance', async () => {
    const fixture = await createProcessorFixture();
    try {
        const first = runBatchProcessor(processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = runtimeOutputPaths(fixture);
        const beforeOutputs = await readByteSnapshot(paths);
        const beforeLedger = await readFile(fixture.provenancePath);

        const replay = runBatchProcessor(processorArgs(fixture));

        assert.equal(replay.status, 0, replay.stderr);
        assert.deepEqual(await readByteSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(fixture.provenancePath), beforeLedger);
        const provenance = JSON.parse(beforeLedger);
        assert.equal(provenance.batches.length, 1);
    } finally {
        await fixture.dispose();
    }
});

test('equipment batch processor keys exact replay by source bytes rather than the source filename', async () => {
    const fixture = await createProcessorFixture();
    try {
        const first = runBatchProcessor(processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = runtimeOutputPaths(fixture);
        const beforeOutputs = await readByteSnapshot(paths);
        const beforeLedger = await readFile(fixture.provenancePath);
        const renamedSource = join(fixture.directory, 'renamed-source-sheet.png');
        await writeFile(renamedSource, await readFile(fixture.sourceSheetPath));
        fixture.sourceSheetPath = renamedSource;

        const replay = runBatchProcessor(processorArgs(fixture));

        assert.equal(replay.status, 0, replay.stderr);
        assert.deepEqual(await readByteSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(fixture.provenancePath), beforeLedger);
    } finally {
        await fixture.dispose();
    }
});

test('equipment batch processor rejects conflicting reuse of a batchId before writes', async () => {
    const fixture = await createProcessorFixture();
    try {
        const first = runBatchProcessor(processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = runtimeOutputPaths(fixture);
        const beforeOutputs = await readByteSnapshot(paths);
        const beforeLedger = await readFile(fixture.provenancePath);
        createSourceSheet(fixture.sourceSheetPath, { colorOffset: 70 });

        const replay = runBatchProcessor(processorArgs(fixture));

        assert.equal(replay.status, 1);
        assert.match(replay.stderr, /Conflicting batchId/);
        assert.deepEqual(await readByteSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(fixture.provenancePath), beforeLedger);
    } finally {
        await fixture.dispose();
    }
});

test('publish_staged_batch rolls back every destination after a monkeypatched os.replace failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-rollback-'));
    try {
        const destinations = Array.from({ length: 6 }, (_, index) => join(directory, 'public', 'assets', `icon-${index}.png`));
        const script = [
            'import importlib.util',
            'import json',
            'from pathlib import Path',
            `spec = importlib.util.spec_from_file_location('equipment_batch_processor', ${JSON.stringify(BATCH_PROCESSOR_SCRIPT)})`,
            'module = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(module)',
            `root = Path(${JSON.stringify(directory)})`,
            `destinations = [Path(value) for value in json.loads(${JSON.stringify(JSON.stringify(destinations))})]`,
            'staged = []',
            'for index, destination in enumerate(destinations):',
            '    destination.parent.mkdir(parents=True, exist_ok=True)',
            '    destination.write_bytes(f"old-output-{index}".encode())',
            '    staged_path = root / f"staged-{index}.png"',
            '    staged_path.write_bytes(f"new-output-{index}".encode())',
            '    staged.append((staged_path, destination))',
            'provenance = root / "provenance.json"',
            'provenance.write_bytes(b"old-ledger")',
            'staged_provenance = root / "staged-provenance.json"',
            'staged_provenance.write_bytes(b"new-ledger")',
            'before_outputs = [path.read_bytes() for path in destinations]',
            'before_ledger = provenance.read_bytes()',
            'real_replace = module.os.replace',
            'failed = False',
            'def fail_once(source, destination):',
            '    global failed',
            '    if not failed and Path(source) == staged[2][0] and Path(destination) == staged[2][1]:',
            '        failed = True',
            '        raise OSError("injected replace failure")',
            '    return real_replace(source, destination)',
            'module.os.replace = fail_once',
            'try:',
            '    module.publish_staged_batch(staged, staged_provenance, provenance)',
            'except OSError as error:',
            '    assert str(error) == "injected replace failure"',
            'else:',
            '    raise AssertionError("publish failure was not raised")',
            'assert [path.read_bytes() for path in destinations] == before_outputs',
            'assert provenance.read_bytes() == before_ledger',
            'print("rollback-ok")',
        ].join('\n');
        const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, 'rollback-ok\n');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('legacy generator main rolls back generated outputs and manifest after a monkeypatched os.replace failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-legacy-rollback-'));
    try {
        const catalogPath = join(directory, 'catalog.json');
        const outputDir = join(directory, 'generated');
        const manifestPath = join(directory, 'equipment-manifest.json');
        const catalog = [
            { name: '검증용 검', type: 'weapon', tier: 1, elem: '', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/unused-1.png', cohort: 'weapon-core' },
            { name: '검증용 단검', type: 'weapon', tier: 2, elem: '', familyKey: 'weapon-dagger', runtimePath: '/assets/equipment-exact/auto/unused-2.png', cohort: 'weapon-core' },
        ];
        const sourceManifest = {
            $comment: 'rollback fixture',
            version: 1,
            catalogSha256: 'a'.repeat(64),
            styleVersion: 1,
            art: { width: 160, height: 160, margin: 8 },
            entries: { previous: 'auto/previous' },
        };
        await mkdir(outputDir, { recursive: true });
        await writeFile(catalogPath, `${JSON.stringify(catalog)}\n`);
        await writeFile(manifestPath, `${JSON.stringify(sourceManifest)}\n`);

        const script = [
            'import importlib.util',
            'from pathlib import Path',
            `spec = importlib.util.spec_from_file_location('legacy_equipment_generator', ${JSON.stringify(LEGACY_GENERATOR_SCRIPT)})`,
            'module = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(module)',
            `output_dir = Path(${JSON.stringify(outputDir)})`,
            `manifest = Path(${JSON.stringify(manifestPath)})`,
            'names = ["검증용 검", "검증용 단검"]',
            'destinations = [output_dir / f"{module.art_slug(name)}.png" for name in names]',
            'for index, destination in enumerate(destinations):',
            '    destination.write_bytes(f"old-output-{index}".encode())',
            'before_outputs = [path.read_bytes() for path in destinations]',
            'before_manifest = manifest.read_bytes()',
            'real_replace = module.os.replace',
            'replace_count = 0',
            'def fail_once(source, destination):',
            '    global replace_count',
            '    replace_count += 1',
            '    if replace_count == 2:',
            '        raise OSError("injected legacy replace failure")',
            '    return real_replace(source, destination)',
            'module.os.replace = fail_once',
            'try:',
            '    module.main([',
            `        "--catalog", ${JSON.stringify(catalogPath)},`,
            `        "--source-dir", ${JSON.stringify(FAMILY_SOURCE_DIR)},`,
            `        "--output-dir", ${JSON.stringify(outputDir)},`,
            `        "--manifest", ${JSON.stringify(manifestPath)},`,
            '    ])',
            'except OSError as error:',
            '    assert str(error) == "injected legacy replace failure"',
            'else:',
            '    raise AssertionError("legacy publish failure was not raised")',
            'assert [path.read_bytes() for path in destinations] == before_outputs',
            'assert manifest.read_bytes() == before_manifest',
            'print("legacy-rollback-ok")',
        ].join('\n');
        const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, 'legacy-rollback-ok\n');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
