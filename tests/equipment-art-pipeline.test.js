import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import { getItemIconAssetSrc } from '../src/utils/itemVisuals.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_SCRIPT = resolve(REPO_ROOT, 'scripts/dump-equipment-catalog.mjs');
const PROMPT_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_art_prompts.mjs');
const SOURCE_PREPARER_SCRIPT = resolve(REPO_ROOT, 'scripts/prepare_equipment_source_sheet.py');
const BATCH_PROCESSOR_SCRIPT = resolve(REPO_ROOT, 'scripts/process_equipment_art_batch.py');
const MANIFEST_SYNC_SCRIPT = resolve(REPO_ROOT, 'scripts/sync-equipment-art-manifest.mjs');
const ART_VERIFIER_SCRIPT = resolve(REPO_ROOT, 'scripts/verify-art-assets.mjs');
const LEGACY_GENERATOR_SCRIPT = resolve(REPO_ROOT, 'scripts/generate_equipment_item_art.py');
const FAMILY_SOURCE_DIR = resolve(REPO_ROOT, 'public/assets/equipment-family/items');
const EQUIPMENT_MANIFEST_PATH = resolve(REPO_ROOT, 'src/data/equipmentArtManifest.json');
const WEAPON_CORE_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/weapon-core/batches');
const WEAPON_CORE_SOURCE_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/weapon-core');
const WEAPON_CORE_PROVENANCE_PATH = resolve(REPO_ROOT, 'docs/evidence/art/equipment-weapon-core-provenance.json');
const WEAPON_RANGED_MAGIC_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/weapon-ranged-magic/batches');
const WEAPON_RANGED_MAGIC_SOURCE_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/weapon-ranged-magic');
const WEAPON_RANGED_MAGIC_PROVENANCE_PATH = resolve(REPO_ROOT, 'docs/evidence/art/equipment-weapon-ranged-magic-provenance.json');
const OFFHAND_HEADGEAR_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/offhand-headgear/batches');
const ARMOR_BATCH_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/armor/batches');
const ARMOR_SOURCE_DIR = resolve(REPO_ROOT, 'scripts/art_sources/equipment/v2/armor');
const ARMOR_PROVENANCE_PATH = resolve(REPO_ROOT, 'docs/evidence/art/equipment-armor-provenance.json');
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

const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hashCanonicalJson = (value) => sha256(JSON.stringify(canonicalize(value)));
const equipmentReplayKey = (record) => sha256(JSON.stringify({
    batchId: record.batchId,
    sourceSheetSha256: record.sourceSheetSha256,
    identityNames: record.identityNames,
}));

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

const runManifestSync = (args) => spawnSync(process.execPath, [MANIFEST_SYNC_SCRIPT, ...args], {
    encoding: 'utf8',
});

const runArtVerifier = (args) => spawnSync(process.execPath, ['--import', 'tsx', ART_VERIFIER_SCRIPT, ...args], {
    encoding: 'utf8',
});

const expectedEquipmentRuntimePaths = new Map(
    [...ITEMS.weapons, ...ITEMS.armors]
        .filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type))
        .map((item) => [item.name, getItemIconAssetSrc(item)])
);

test('equipment catalog dump writes only the sorted 229 player equipment rows', async () => {
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
        assert.equal(rows.length, 229);
        assert.equal(new Set(rows.map((row) => row.name)).size, 229);
        assert.deepEqual(
            rows.filter((row) => ['날카로운', '묵직한', '단단한', '수호의'].includes(row.name)),
            [],
        );
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

test('equipment manifest sync rejects provenance order, cell and batch identity drift before writing', async (context) => {
    const mutations = [
        ['identity order', (provenance) => { provenance.batches[0].identityNames[0] = '위조된 정체성'; }],
        ['cell order', (provenance) => { provenance.batches[0].exports[0].cell = 'bottom-right'; }],
        ['duplicate batch id', (provenance) => { provenance.batches[1].batchId = provenance.batches[0].batchId; }],
    ];

    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-manifest-sync-'));
            const catalogPath = join(directory, 'catalog.json');
            const provenancePath = join(directory, 'provenance.json');
            const outputPath = join(directory, 'manifest.json');
            try {
                const dump = runDump(['--output', catalogPath]);
                assert.equal(dump.status, 0, dump.stderr);
                const provenance = JSON.parse(await readFile(WEAPON_CORE_PROVENANCE_PATH, 'utf8'));
                mutate(provenance);
                await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

                const result = runManifestSync([
                    '--catalog', catalogPath,
                    '--manifest', EQUIPMENT_MANIFEST_PATH,
                    '--provenance', provenancePath,
                    '--source-dir', WEAPON_CORE_SOURCE_DIR,
                    '--public-root', resolve(REPO_ROOT, 'public'),
                    '--output', outputPath,
                ]);

                assert.notEqual(result.status, 0, 'Tampered provenance must fail manifest sync');
                assert.match(result.stderr, /provenance/i);
                await assert.rejects(readFile(outputPath), { code: 'ENOENT' });
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        });
    }
});

test('equipment manifest sync rejects player-facing manifest runtime routing drift before writing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-manifest-route-'));
    const catalogPath = join(directory, 'catalog.json');
    const manifestPath = join(directory, 'equipment-manifest.json');
    const outputPath = join(directory, 'synced-manifest.json');
    try {
        const dump = runDump(['--output', catalogPath]);
        assert.equal(dump.status, 0, dump.stderr);
        const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
        manifest.entries['강철 롱소드'] = manifest.entries['여행자 튜닉'];
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

        const result = runManifestSync([
            '--catalog', catalogPath,
            '--manifest', manifestPath,
            '--provenance', WEAPON_CORE_PROVENANCE_PATH,
            '--source-dir', WEAPON_CORE_SOURCE_DIR,
            '--public-root', resolve(REPO_ROOT, 'public'),
            '--output', outputPath,
        ]);

        assert.notEqual(result.status, 0, 'Player-facing runtime routing drift must fail manifest sync');
        assert.match(result.stderr, /manifest runtime path/i);
        await assert.rejects(readFile(outputPath), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment manifest sync preserves canonical generation review pins for active weapon cohorts', async (context) => {
    const cohorts = [
        ['weapon-core', WEAPON_CORE_PROVENANCE_PATH, WEAPON_CORE_SOURCE_DIR],
        ['weapon-ranged-magic', WEAPON_RANGED_MAGIC_PROVENANCE_PATH, WEAPON_RANGED_MAGIC_SOURCE_DIR],
    ];

    for (const [cohort, provenancePath, sourceDir] of cohorts) {
        await context.test(cohort, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-generation-review-sync-'));
            const catalogPath = join(directory, 'catalog.json');
            const outputPath = join(directory, 'synced-manifest.json');
            try {
                const dump = runDump(['--output', catalogPath]);
                assert.equal(dump.status, 0, dump.stderr);

                const result = runManifestSync([
                    '--catalog', catalogPath,
                    '--manifest', EQUIPMENT_MANIFEST_PATH,
                    '--provenance', provenancePath,
                    '--source-dir', sourceDir,
                    '--public-root', resolve(REPO_ROOT, 'public'),
                    '--output', outputPath,
                ]);
                assert.equal(result.status, 0, result.stderr);

                const [manifest, synced] = await Promise.all([
                    readFile(EQUIPMENT_MANIFEST_PATH, 'utf8').then(JSON.parse),
                    readFile(outputPath, 'utf8').then(JSON.parse),
                ]);
                assert.deepEqual(
                    synced.pipeline.provenance.cohorts[cohort],
                    manifest.pipeline.provenance.cohorts[cohort],
                );
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        });
    }
});

test('equipment generation review rejects tampering before sync or cohort verification writes', async (context) => {
    const mutations = [
        ['accepted raw hash', (provenance) => { provenance.generationReview.accepted[0].rawSha256 = '0'.repeat(64); }],
        ['fabricated rejected reason', (provenance) => { provenance.generationReview.rejected[0].reason = 'fabricated review reason'; }],
        ['blank rejected reason', (provenance) => { provenance.generationReview.rejected[0].reason = ''; }],
        ['rejected record shape', (provenance) => { delete provenance.generationReview.rejected[0].rawImage; }],
        ['rejected batch id', (provenance) => { provenance.generationReview.rejected[0].batchId = 'outside-active-cohort'; }],
        ['duplicate raw candidate', (provenance) => { provenance.generationReview.rejected[0].rawSha256 = provenance.generationReview.accepted[0].rawSha256; }],
        ['duplicate accepted batch', (provenance) => { provenance.generationReview.accepted[1].batchId = provenance.generationReview.accepted[0].batchId; }],
        ['unexpected accepted field', (provenance) => { provenance.generationReview.accepted[0].unexpected = true; }],
        ['unexpected top-level field', (provenance) => { provenance.unexpected = true; }],
        ['repinned accepted raw traversal', (provenance, manifest) => {
            provenance.generationReview.accepted[0].rawImage = '../escaped.png';
            manifest.pipeline.provenance.cohorts['weapon-ranged-magic'].generationReviewSha256 = hashCanonicalJson(provenance.generationReview);
        }],
        ['repinned rejected raw traversal', (provenance, manifest) => {
            provenance.generationReview.rejected[0].rawImage = 'nested/escaped.png';
            manifest.pipeline.provenance.cohorts['weapon-ranged-magic'].generationReviewSha256 = hashCanonicalJson(provenance.generationReview);
        }],
        ['repinned duplicate raw image name', (provenance, manifest) => {
            provenance.generationReview.rejected[0].rawImage = provenance.generationReview.accepted[0].rawImage;
            manifest.pipeline.provenance.cohorts['weapon-ranged-magic'].generationReviewSha256 = hashCanonicalJson(provenance.generationReview);
        }],
    ];

    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-generation-review-'));
            const catalogPath = join(directory, 'catalog.json');
            const manifestPath = join(directory, 'equipment-manifest.json');
            const provenancePath = join(directory, 'provenance.json');
            const outputPath = join(directory, 'synced-manifest.json');
            const reportPath = join(directory, 'report.json');
            try {
                const dump = runDump(['--output', catalogPath]);
                assert.equal(dump.status, 0, dump.stderr);

                const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
                const provenance = JSON.parse(await readFile(WEAPON_RANGED_MAGIC_PROVENANCE_PATH, 'utf8'));
                const runtimePath = provenance.batches[0].exports[0].runtimePath;
                const runtime = resolve(REPO_ROOT, 'public', runtimePath.slice(1));
                const runtimeBytes = await readFile(runtime);
                const outputBytes = Buffer.from('existing synced manifest');
                const reportBytes = Buffer.from('existing verifier report');

                mutate(provenance, manifest);
                const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
                await Promise.all([
                    writeFile(manifestPath, manifestBytes),
                    writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`),
                    writeFile(outputPath, outputBytes),
                    writeFile(reportPath, reportBytes),
                ]);

                const sync = runManifestSync([
                    '--catalog', catalogPath,
                    '--manifest', manifestPath,
                    '--provenance', provenancePath,
                    '--source-dir', WEAPON_RANGED_MAGIC_SOURCE_DIR,
                    '--public-root', resolve(REPO_ROOT, 'public'),
                    '--output', outputPath,
                ]);
                assert.equal(sync.status, 1, `Sync accepted ${label}: ${sync.stderr}`);
                assert.deepEqual(await readFile(outputPath), outputBytes);
                assert.deepEqual(await readFile(manifestPath), manifestBytes);
                assert.deepEqual(await readFile(runtime), runtimeBytes);

                const verification = runArtVerifier([
                    '--cohort', 'weapon-ranged-magic',
                    '--equipment-manifest', manifestPath,
                    '--equipment-provenance', provenancePath,
                    '--equipment-source-dir', WEAPON_RANGED_MAGIC_SOURCE_DIR,
                    '--public-root', resolve(REPO_ROOT, 'public'),
                    '--write-report', reportPath,
                ]);
                assert.equal(verification.status, 1, `Verifier accepted ${label}: ${verification.stderr}`);
                const report = JSON.parse(verification.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.invalidArtwork.length, 1);
                assert.deepEqual(await readFile(reportPath), reportBytes);
                assert.deepEqual(await readFile(manifestPath), manifestBytes);
                assert.deepEqual(await readFile(runtime), runtimeBytes);
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        });
    }
});

test('armor evidence rejects export hash collisions across the full styleVersion 2 art surface', async (context) => {
    for (const collision of ['cross-family', 'cross-cohort', 'family-exemplar']) {
        await context.test(collision, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-export-duplicate-'));
            const catalogPath = join(directory, 'catalog.json');
            const manifestPath = join(directory, 'equipment-manifest.json');
            const provenancePath = join(directory, 'armor-provenance.json');
            const publicRoot = join(directory, 'public');
            const outputPath = join(directory, 'synced-manifest.json');
            const reportPath = join(directory, 'verification-report.json');
            try {
                const dump = runDump(['--output', catalogPath]);
                assert.equal(dump.status, 0, dump.stderr);
                const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
                const provenance = JSON.parse(await readFile(ARMOR_PROVENANCE_PATH, 'utf8'));
                const exports = provenance.batches.flatMap((record) => record.exports);
                for (const entry of exports) {
                    const source = resolve(REPO_ROOT, 'public', entry.runtimePath.slice(1));
                    const destination = resolve(publicRoot, entry.runtimePath.slice(1));
                    await mkdir(dirname(destination), { recursive: true });
                    await writeFile(destination, await readFile(source));
                }

                const target = provenance.batches.find((record) => record.batchId === 'armor-cloak-01').exports[0];
                let duplicatePath;
                let duplicateHash;
                if (collision === 'cross-family') {
                    const boots = provenance.batches.find((record) => record.batchId === 'armor-boots-01').exports[0];
                    duplicatePath = boots.runtimePath;
                    duplicateHash = boots.exportSha256;
                } else if (collision === 'cross-cohort') {
                    const other = JSON.parse(await readFile(WEAPON_CORE_PROVENANCE_PATH, 'utf8')).batches[0].exports[0];
                    duplicatePath = other.runtimePath;
                    duplicateHash = other.exportSha256;
                } else {
                    const family = manifest.art.families['armor-boots'];
                    duplicatePath = family.runtimePath;
                    duplicateHash = family.exportSha256;
                }
                const targetRuntime = resolve(publicRoot, target.runtimePath.slice(1));
                await writeFile(targetRuntime, await readFile(resolve(REPO_ROOT, 'public', duplicatePath.slice(1))));
                target.exportSha256 = duplicateHash;
                manifest.artwork[target.name].exportSha256 = duplicateHash;

                const outputBytes = Buffer.from('existing synced manifest');
                const reportBytes = Buffer.from('existing verification report');
                await Promise.all([
                    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
                    writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`),
                    writeFile(outputPath, outputBytes),
                    writeFile(reportPath, reportBytes),
                ]);
                const runtimePaths = exports.map((entry) => resolve(publicRoot, entry.runtimePath.slice(1)));
                const runtimeBefore = await readByteSnapshot(runtimePaths);
                const manifestBefore = await readFile(manifestPath);
                const provenanceBefore = await readFile(provenancePath);

                const sync = runManifestSync([
                    '--catalog', catalogPath,
                    '--manifest', manifestPath,
                    '--provenance', provenancePath,
                    '--source-dir', ARMOR_SOURCE_DIR,
                    '--public-root', publicRoot,
                    '--output', outputPath,
                ]);
                assert.equal(sync.status, 1);
                assert.match(sync.stderr, /(duplicat|reproduce)/i);
                assert.deepEqual(await readFile(outputPath), outputBytes);

                const verification = runArtVerifier([
                    '--scope', 'equipment',
                    '--cohort', 'armor',
                    '--equipment-manifest', manifestPath,
                    '--equipment-provenance', provenancePath,
                    '--equipment-source-dir', ARMOR_SOURCE_DIR,
                    '--public-root', publicRoot,
                    '--write-report', reportPath,
                ]);
                assert.equal(verification.status, 1);
                const verificationReport = JSON.parse(verification.stdout);
                assert.equal(verificationReport.ok, false);
                assert.match(verificationReport.invalidArtwork.join('\n'), /(duplicat|reproduce)/i);
                assert.deepEqual(await readFile(reportPath), reportBytes);
                assert.deepEqual(await readByteSnapshot(runtimePaths), runtimeBefore);
                assert.deepEqual(await readFile(manifestPath), manifestBefore);
                assert.deepEqual(await readFile(provenancePath), provenanceBefore);
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        });
    }
});

test('armor evidence binds unique source provenance and ordered identities to tracked family-pure batches', async (context) => {
    const mutations = [
        ['duplicate source path', async ({ provenance }) => {
            const boots = provenance.batches.find((record) => record.batchId === 'armor-boots-01');
            const cloak = provenance.batches.find((record) => record.batchId === 'armor-cloak-01');
            cloak.sourceSheet = boots.sourceSheet;
        }],
        ['duplicate source bytes', async ({ manifest, provenance, sourceDir }) => {
            const boots = provenance.batches.find((record) => record.batchId === 'armor-boots-01');
            const cloak = provenance.batches.find((record) => record.batchId === 'armor-cloak-01');
            await writeFile(join(sourceDir, cloak.sourceSheet), await readFile(join(sourceDir, boots.sourceSheet)));
            cloak.sourceSheetSha256 = boots.sourceSheetSha256;
            cloak.replayKey = equipmentReplayKey(cloak);
            for (const name of cloak.identityNames) {
                manifest.artwork[name].sourceSha256 = cloak.sourceSheetSha256;
            }
        }],
        ['cross-family batch swap', async ({ provenance }) => {
            const cloak = provenance.batches.find((record) => record.batchId === 'armor-cloak-01');
            const coat = provenance.batches.find((record) => record.batchId === 'armor-coat-01');
            [cloak.identityNames, coat.identityNames] = [coat.identityNames, cloak.identityNames];
            [cloak.exports, coat.exports] = [coat.exports, cloak.exports];
            cloak.replayKey = equipmentReplayKey(cloak);
            coat.replayKey = equipmentReplayKey(coat);
        }],
        ['within-family identity order swap', async ({ provenance }) => {
            const cloak = provenance.batches.find((record) => record.batchId === 'armor-cloak-01');
            [cloak.identityNames[0], cloak.identityNames[1]] = [cloak.identityNames[1], cloak.identityNames[0]];
            [cloak.exports[0], cloak.exports[1]] = [cloak.exports[1], cloak.exports[0]];
            cloak.exports[0].cell = CELL_ORDER[0];
            cloak.exports[1].cell = CELL_ORDER[1];
            cloak.replayKey = equipmentReplayKey(cloak);
        }],
        ['tracked batch prompt tamper', async ({ sourceDir }) => {
            const batchPath = join(sourceDir, 'batches', 'armor-cloak-01.json');
            const batch = JSON.parse(await readFile(batchPath, 'utf8'));
            batch.prompt = 'forged batch prompt';
            await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
        }],
        ['tracked identity prompt tamper', async ({ sourceDir }) => {
            const batchPath = join(sourceDir, 'batches', 'armor-cloak-01.json');
            const batch = JSON.parse(await readFile(batchPath, 'utf8'));
            batch.identities[0].prompt = 'forged identity prompt';
            await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
        }],
    ];
    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            await assertArmorEvidenceMutationRejected({ label, mutate, copySources: true });
        });
    }
});

test('armor evidence reconstructs tracked source cells before accepting their runtime lineage', async (context) => {
    const mutations = [
        ['non-PNG source bytes', async ({ manifest, provenance, sourceDir }) => {
            const record = provenance.batches.find((batch) => batch.batchId === 'armor-boots-01');
            const sourcePath = join(sourceDir, record.sourceSheet);
            await writeFile(sourcePath, 'not a PNG source sheet');
            record.sourceSheetSha256 = sha256(await readFile(sourcePath));
            record.replayKey = equipmentReplayKey(record);
            manifest.artwork[record.identityNames[0]].sourceSha256 = record.sourceSheetSha256;
        }],
        ['source cell swap', async ({ manifest, provenance, sourceDir }) => {
            const record = provenance.batches.find((batch) => batch.batchId === 'armor-cloak-01');
            const sourcePath = join(sourceDir, record.sourceSheet);
            const script = [
                'from PIL import Image',
                `path = ${JSON.stringify(sourcePath)}`,
                'image = Image.open(path).convert("RGBA")',
                'first = image.crop((0, 0, 200, 200))',
                'second = image.crop((200, 0, 400, 200))',
                'image.paste(second, (0, 0))',
                'image.paste(first, (200, 0))',
                'image.save(path)',
            ].join('\n');
            const swap = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
            assert.equal(swap.status, 0, swap.stderr);
            record.sourceSheetSha256 = sha256(await readFile(sourcePath));
            record.replayKey = equipmentReplayKey(record);
            for (const name of record.identityNames) {
                manifest.artwork[name].sourceSha256 = record.sourceSheetSha256;
            }
        }],
    ];
    for (const [label, mutate] of mutations) {
        await context.test(label, async () => {
            await assertArmorEvidenceMutationRejected({ label, mutate, copySources: true });
        });
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
        { name: '가람의 검', type: 'weapon', tier: 0, elem: '', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/garam.png', cohort: 'weapon-core' },
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
        assert.match(batch.prompt, /readable at 32px/i);
        assert.match(batch.prompt, /at least two of blade or body shape, handle, central ornament, and material/i);
        assert.match(batch.identities[0].prompt, /가람의 검/);
        assert.match(batch.identities[0].prompt, /weapon-sword/);
        assert.match(batch.identities[0].prompt, /T0/);
        assert.match(batch.identities[0].prompt, /plain training-grade construction/i);
        assert.match(batch.identities[3].prompt, /dark-red metal, cracked surface/i);
        assert.match(batch.identities[5].prompt, /separated pieces, grid structure/i);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment prompt preserves the curved scythe identity inside the weapon-lance cohort', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-scythe-prompt-'));
    const catalogPath = join(directory, 'catalog.json');
    const outputPath = join(directory, 'weapon-ranged-magic-lance-01.json');
    try {
        await writeFile(catalogPath, `${JSON.stringify([{
            name: '죽음의 낫',
            type: 'weapon',
            tier: 4,
            elem: '어둠',
            familyKey: 'weapon-lance',
            runtimePath: '/assets/equipment-exact/auto/death-scythe.png',
            cohort: 'weapon-ranged-magic',
        }])}\n`);
        const result = runPromptGenerator([
            '--catalog', catalogPath,
            '--batch-id', 'weapon-ranged-magic-lance-01',
            '--names', '죽음의 낫',
            '--output', outputPath,
        ]);

        assert.equal(result.status, 0, result.stderr);
        const batch = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.match(batch.identities[0].prompt, /curved scythe blade/i);
        assert.doesNotMatch(batch.identities[0].prompt, /readable spearhead/i);
        assert.match(batch.prompt, /curved scythe blade/i);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment prompt rejects a same-cohort batch that mixes illustration families', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-family-pure-prompt-'));
    const catalogPath = join(directory, 'catalog.json');
    const outputPath = join(directory, 'mixed.json');
    try {
        const rows = [
            { name: '가람의 검', type: 'weapon', tier: 1, elem: '', familyKey: 'weapon-sword', runtimePath: '/assets/equipment-exact/auto/sword.png', cohort: 'weapon-core' },
            { name: '나래의 단검', type: 'weapon', tier: 1, elem: '', familyKey: 'weapon-dagger', runtimePath: '/assets/equipment-exact/auto/dagger.png', cohort: 'weapon-core' },
        ];
        await writeFile(catalogPath, `${JSON.stringify(rows)}\n`);

        const result = runPromptGenerator([
            '--catalog', catalogPath,
            '--batch-id', 'mixed-family',
            '--names', '가람의 검,나래의 단검',
            '--output', outputPath,
        ]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /share one illustration family/i);
        await assert.rejects(stat(outputPath), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment prompt carries exact offhand and armor morphology from live item semantics', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-morphology-prompt-'));
    const catalogPath = join(directory, 'catalog.json');
    try {
        assert.equal(runDump(['--output', catalogPath]).status, 0);
        for (const [name, pattern] of [
            ['견습 주문서', /parchment scroll/i],
            ['현자의 서판', /stone tablet/i],
            ['성광 방벽', /tower shield/i],
            ['암살자 장갑', /pair of leather gloves/i],
        ]) {
            const outputPath = join(directory, `${encodeURIComponent(name)}.json`);
            const result = runPromptGenerator([
                '--catalog', catalogPath,
                '--batch-id', `morphology-${encodeURIComponent(name)}`,
                '--names', name,
                '--output', outputPath,
            ]);
            assert.equal(result.status, 0, result.stderr);
            const batch = JSON.parse(await readFile(outputPath, 'utf8'));
            assert.match(batch.identities[0].prompt, pattern, name);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('tracked weapon-core batches declare every authoritative identity exactly once with partial final sheets', async () => {
    const catalogResult = runDump(['--stdout']);
    assert.equal(catalogResult.status, 0, catalogResult.stderr);
    const expected = JSON.parse(catalogResult.stdout)
        .filter((entry) => entry.cohort === 'weapon-core')
        .map((entry) => entry.name)
        .sort(compareCodePoints);
    const batchFiles = [
        'weapon-core-sword-01.json',
        'weapon-core-sword-02.json',
        'weapon-core-sword-03.json',
        'weapon-core-sword-04.json',
        'weapon-core-sword-05.json',
        'weapon-core-dagger-01.json',
        'weapon-core-dagger-02.json',
        'weapon-core-dagger-03.json',
        'weapon-core-dagger-04.json',
        'weapon-core-heavy-01.json',
        'weapon-core-heavy-02.json',
    ];
    const batches = await Promise.all(batchFiles.map(async (file) => (
        JSON.parse(await readFile(join(WEAPON_CORE_BATCH_DIR, file), 'utf8'))
    )));
    const declared = batches.flatMap((batch) => batch.identityNames);

    assert.equal(declared.length, 54);
    assert.equal(new Set(declared).size, 54);
    assert.deepEqual([...declared].sort(compareCodePoints), expected);
    assert.deepEqual(batches.find((batch) => batch.batchId === 'weapon-core-sword-01').identityNames, [
        '강철 롱소드', '기계식 레이피어', '기사의 검', '농부의 포크', '롱소드',
    ]);
    assert.deepEqual(batches.find((batch) => batch.batchId === 'weapon-core-sword-02').identityNames, [
        '미스릴검', '사냥칼', '사막의 시미터', '수련생의 검', '양손검',
    ]);
    assert.equal(batches.find((batch) => batch.batchId === 'weapon-core-sword-03').identityNames.length, 3);
    assert.equal(batches.find((batch) => batch.batchId === 'weapon-core-sword-05').identityNames.length, 5);
    assert.equal(batches.find((batch) => batch.batchId === 'weapon-core-dagger-01').identityNames.length, 5);
    assert.equal(batches.find((batch) => batch.batchId === 'weapon-core-dagger-04').identityNames.length, 2);
    assert.equal(batches.find((batch) => batch.batchId === 'weapon-core-heavy-02').identityNames.length, 5);
});

test('tracked offhand-headgear batches cover all 21 identities in seven family-pure sheets', async () => {
    const catalogResult = runDump(['--stdout']);
    assert.equal(catalogResult.status, 0, catalogResult.stderr);
    const catalog = JSON.parse(catalogResult.stdout).filter((entry) => entry.cohort === 'offhand-headgear');
    const expected = catalog.map((entry) => entry.name).sort(compareCodePoints);
    const files = [
        'offhand-headgear-book-01.json',
        'offhand-headgear-shield-01.json',
        'offhand-headgear-shield-02.json',
        'offhand-headgear-shield-03.json',
        'offhand-headgear-hood-01.json',
        'offhand-headgear-straw-hat-01.json',
        'offhand-headgear-wizard-hat-01.json',
    ];
    const batches = await Promise.all(files.map(async (file) => JSON.parse(await readFile(
        join(OFFHAND_HEADGEAR_BATCH_DIR, file), 'utf8'
    ))));
    const declared = batches.flatMap((batch) => batch.identityNames);

    assert.equal(catalog.length, 21);
    assert.deepEqual(Object.fromEntries([
        'offhand-book', 'offhand-shield', 'headgear-hood', 'headgear-straw-hat', 'headgear-wizard-hat',
    ].map((familyKey) => [familyKey, catalog.filter((entry) => entry.familyKey === familyKey).length])), {
        'offhand-book': 5,
        'offhand-shield': 13,
        'headgear-hood': 1,
        'headgear-straw-hat': 1,
        'headgear-wizard-hat': 1,
    });
    assert.equal(new Set(declared).size, 21);
    assert.deepEqual([...declared].sort(compareCodePoints), expected);
    assert.deepEqual(batches.map((batch) => batch.identityNames.length), [5, 6, 6, 1, 1, 1, 1]);
    assert.deepEqual(batches.map((batch) => batch.identities[0].familyKey), [
        'offhand-book', 'offhand-shield', 'offhand-shield', 'offhand-shield',
        'headgear-hood', 'headgear-straw-hat', 'headgear-wizard-hat',
    ]);
    assert.ok(batches.every((batch) => new Set(batch.identities.map((identity) => identity.familyKey)).size === 1));
});

test('tracked weapon-ranged-magic batches declare all 47 identities with family-pure partial sheets', async () => {
    const catalogResult = runDump(['--stdout']);
    assert.equal(catalogResult.status, 0, catalogResult.stderr);
    const expected = JSON.parse(catalogResult.stdout)
        .filter((entry) => entry.cohort === 'weapon-ranged-magic')
        .map((entry) => entry.name)
        .sort(compareCodePoints);
    const ids = ['bow-01', 'bow-02', 'staff-01', 'staff-02', 'staff-03', 'staff-04', 'lance-01', 'lance-02', 'whip-01'];
    const batches = await Promise.all(ids.map(async (id) => JSON.parse(await readFile(
        join(WEAPON_RANGED_MAGIC_BATCH_DIR, `weapon-ranged-magic-${id}.json`), 'utf8'
    ))));
    const declared = batches.flatMap((batch) => batch.identityNames);
    assert.equal(declared.length, 47);
    assert.equal(new Set(declared).size, 47);
    assert.deepEqual([...declared].sort(compareCodePoints), expected);
    assert.deepEqual(batches.map((batch) => batch.identities[0].familyKey), [
        'weapon-bow', 'weapon-bow', 'weapon-staff', 'weapon-staff', 'weapon-staff',
        'weapon-staff', 'weapon-lance', 'weapon-lance', 'weapon-whip',
    ]);
    assert.deepEqual(batches.map((batch) => batch.identityNames.length), [6, 5, 6, 6, 6, 6, 6, 5, 1]);
});

test('equipment source preparer removes only edge-connected working background and fixes the 600x400 grid', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (245, 245, 245))',
            'draw = ImageDraw.Draw(image)',
            'for y in range(0, 600, 24):',
            '    for x in range(0, 900, 24):',
            '        if (x // 24 + y // 24) % 2:',
            '            draw.rectangle((x, y, x + 23, y + 23), fill=(225, 225, 225))',
            'for index in range(6):',
            '    column = index % 3',
            '    row = index // 3',
            '    left = column * 300 + (4 if index == 4 else 90)',
            '    top = row * 300 + 54',
            '    draw.polygon(((left, top + 132), (left + 54, top), (left + 84, top + 144), (left + 42, top + 210)), fill=(40 + index * 20, 70, 110))',
            '    draw.rectangle((left + 24, top + 150, left + 66, top + 180), fill=(255, 255, 255))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `path = ${JSON.stringify(sourcePath)}`,
            'with Image.open(path) as image:',
            '    alpha = image.getchannel("A")',
            '    cells = []',
            '    for index in range(6):',
            '        column = index % 3',
            '        row = index // 3',
            '        cell = alpha.crop((column * 200, row * 200, column * 200 + 200, row * 200 + 200))',
            '        cells.append({"extrema": cell.getextrema(), "bounds": cell.getbbox()})',
            '    print(json.dumps({"mode": image.mode, "size": image.size, "cells": cells}))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        const prepared = JSON.parse(inspection.stdout);
        assert.deepEqual(prepared.size, [600, 400]);
        assert.equal(prepared.mode, 'RGBA');
        assert.ok(prepared.cells.every((cell) => cell.extrema[0] === 0 && cell.extrema[1] === 255));
        assert.ok(prepared.cells.every((cell) => cell.bounds[0] > 0 && cell.bounds[1] > 0 && cell.bounds[2] < 200 && cell.bounds[3] < 200));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment source preparer rejects real icon pixels on a working cell boundary before resampling', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-boundary-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (245, 245, 245))',
            'draw = ImageDraw.Draw(image)',
            'for y in range(0, 600, 24):',
            '    for x in range(0, 900, 24):',
            '        if (x // 24 + y // 24) % 2:',
            '            draw.rectangle((x, y, x + 23, y + 23), fill=(225, 225, 225))',
            'for index in range(6):',
            '    column = index % 3',
            '    row = index // 3',
            '    left = column * 300 + (0 if index == 1 else 80)',
            '    top = row * 300 + 70',
            '    draw.rectangle((left, top, left + 90, top + 150), fill=(55 + index * 20, 75, 115))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
        ], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /working source cell 2 requires transparent boundary padding/);
        await assert.rejects(stat(sourcePath), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment source preparer preserves completely blank trailing cells for a partial batch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-partial-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (245, 245, 245))',
            'draw = ImageDraw.Draw(image)',
            'for index in range(3):',
            '    left = index * 300 + 80',
            '    draw.rectangle((left, 70, left + 90, 220), fill=(55 + index * 30, 75, 115))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
            '--used-cells', '3',
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `path = ${JSON.stringify(sourcePath)}`,
            'with Image.open(path) as image:',
            '    maxima = []',
            '    for index in range(6):',
            '        column = index % 3',
            '        row = index // 3',
            '        alpha = image.crop((column * 200, row * 200, column * 200 + 200, row * 200 + 200)).getchannel("A")',
            '        maxima.append(alpha.getextrema()[1])',
            '    print(json.dumps(maxima))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        assert.deepEqual(JSON.parse(inspection.stdout), [255, 255, 255, 0, 0, 0]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment source preparer removes edge-connected chroma variation without erasing enclosed green detail', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-chroma-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (24, 230, 145))',
            'draw = ImageDraw.Draw(image)',
            'for y in range(600):',
            '    draw.line((0, y, 899, y), fill=(20 + y % 9, 224 + y % 13, 138 + y % 11))',
            'for index in range(6):',
            '    column = index % 3',
            '    row = index // 3',
            '    left = column * 300 + 80',
            '    top = row * 300 + 55',
            '    draw.rectangle((left, top, left + 140, top + 180), fill=(18, 20, 28))',
            '    draw.rectangle((left + 35, top + 45, left + 105, top + 125), fill=(22, 210, 118))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `path = ${JSON.stringify(sourcePath)}`,
            'with Image.open(path) as image:',
            '    alpha = image.getchannel("A")',
            '    print(json.dumps({"corner": alpha.getpixel((0, 0)), "detail": alpha.getpixel((100, 90))}))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        assert.deepEqual(JSON.parse(inspection.stdout), { corner: 0, detail: 255 });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment source preparer does not resample removed chroma into visible edge pixels', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-despill-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (0, 255, 0))',
            'draw = ImageDraw.Draw(image)',
            'draw.rectangle((88, 68, 232, 232), fill=(8, 160, 16))',
            'draw.rectangle((96, 76, 224, 224), fill=(30, 34, 42))',
            'image.putpixel((96, 76), (0, 255, 0))',
            'image.putpixel((97, 77), (6, 196, 12))',
            'image.putpixel((98, 76), (5, 45, 3))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
            '--used-cells', '1',
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `image = Image.open(${JSON.stringify(sourcePath)}).convert("RGBA")`,
            'green = [pixel for pixel in image.getdata() if pixel[3] > 0 and pixel[1] > pixel[0] and pixel[1] > pixel[2]]',
            'print(json.dumps({"visibleGreen": len(green), "opaqueGreen": sum(pixel[3] == 255 for pixel in green)}))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        assert.deepEqual(JSON.parse(inspection.stdout), { visibleGreen: 0, opaqueGreen: 0 });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment source preparer removes enclosed chroma only from explicitly declared neutral cells', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-source-enclosed-chroma-'));
    const workingPath = join(directory, 'working.png');
    const sourcePath = join(directory, 'source.png');
    try {
        const fixture = spawnSync('python3', ['-c', [
            'from PIL import Image, ImageDraw',
            'image = Image.new("RGB", (900, 600), (0, 255, 0))',
            'draw = ImageDraw.Draw(image)',
            'for index in range(6):',
            '    column = index % 3',
            '    row = index // 3',
            '    left = column * 300 + 70',
            '    top = row * 300 + 55',
            '    draw.rectangle((left, top, left + 160, top + 185), fill=(28, 31, 38))',
            'draw.rectangle((410, 390, 450, 455), fill=(22, 210, 118))',
            'draw.rectangle((710, 390, 750, 455), fill=(0, 255, 0))',
            `image.save(${JSON.stringify(workingPath)})`,
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = spawnSync('python3', [
            SOURCE_PREPARER_SCRIPT,
            '--input', workingPath,
            '--output', sourcePath,
            '--remove-enclosed-green-cells', '6',
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        const inspection = spawnSync('python3', ['-c', [
            'from PIL import Image',
            'import json',
            `image = Image.open(${JSON.stringify(sourcePath)}).convert("RGBA")`,
            'def strong_green(cell):',
            '    column = (cell - 1) % 3',
            '    row = (cell - 1) // 3',
            '    pixels = image.crop((column * 200, row * 200, column * 200 + 200, row * 200 + 200)).getdata()',
            '    return sum(1 for red, green, blue, alpha in pixels if alpha > 0 and green >= 180 and green >= red + 50 and green >= blue + 50)',
            'print(json.dumps({"preserved": strong_green(5), "removed": strong_green(6)}))',
        ].join('\n')], { encoding: 'utf8' });
        assert.equal(inspection.status, 0, inspection.stderr);
        const counts = JSON.parse(inspection.stdout);
        assert.ok(counts.preserved > 0);
        assert.equal(counts.removed, 0);

        for (const invalidCells of ['0', '7', '1,7']) {
            const invalid = spawnSync('python3', [
                SOURCE_PREPARER_SCRIPT,
                '--input', workingPath,
                '--output', join(directory, `invalid-${invalidCells.replace(',', '-')}.png`),
                '--remove-enclosed-green-cells', invalidCells,
            ], { encoding: 'utf8' });
            assert.equal(invalid.status, 2);
            assert.match(invalid.stderr, /remove-enclosed-green-cells must reference used cells/);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

const createSourceSheet = (path, {
    kind = 'valid',
    colorOffset = 0,
    usedCells = 6,
    paintUnusedCell = false,
} = {}) => {
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
        `    used_cells = ${JSON.stringify(usedCells)}`,
        `    paint_unused_cell = ${paintUnusedCell ? 'True' : 'False'}`,
        '    for index in range(6):',
        '        column = index % 3',
        '        row = index // 3',
        '        left = column * 200 + 48',
        '        top = row * cell_height + 20',
        '        if index >= used_cells and not (paint_unused_cell and index == used_cells):',
        '            continue',
        '        if kind == "empty-cell" and index == 5:',
        '            continue',
        '        if kind == "one-pixel-cell" and index == 5:',
        '            image.putpixel((left, top), (255, 255, 255, 255))',
        '            continue',
        '        if kind == "touching-cell-boundary" and index == 5:',
        '            draw.rectangle((column * 200, row * cell_height, column * 200 + 92, row * cell_height + 118), fill=(255, 255, 255, 255))',
        '            continue',
        '        draw.rectangle((left, top, left + 92, top + min(118, cell_height - 28)), fill=(40 + index * 30 + color_offset, 90, 170, 255))',
        '        if kind == "chroma-residual":',
        '            draw.line((left - 3, top + 20, left - 3, top + 80), fill=(0, 255, 0, 255), width=2)',
        `image.save(${JSON.stringify(path)})`,
    ].join('\n');
    const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

const createProcessorFixture = async ({
    batchId = 'equipment-pipeline-test-001',
    identityCount = 6,
    cohort = 'weapon-core',
    familyKey = 'weapon-sword',
} = {}) => {
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
    const selected = catalog.filter((row) => row.cohort === cohort && row.familyKey === familyKey).slice(0, identityCount);
    assert.equal(selected.length, identityCount, 'The live catalog must supply the requested real prompt cohort fixture');
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
    createSourceSheet(sourceSheetPath, { usedCells: identityCount });

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

const assertArmorEvidenceMutationRejected = async ({ label, mutate, copySources = false }) => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-armor-evidence-mutation-'));
    try {
        const catalogPath = join(directory, 'catalog.json');
        const manifestPath = join(directory, 'manifest.json');
        const provenancePath = join(directory, 'provenance.json');
        const outputPath = join(directory, 'synced-manifest.json');
        const reportPath = join(directory, 'report.json');
        const sourceDir = copySources ? join(directory, 'sources') : ARMOR_SOURCE_DIR;
        const dump = runDump(['--output', catalogPath]);
        assert.equal(dump.status, 0, dump.stderr);
        if (copySources) await cp(ARMOR_SOURCE_DIR, sourceDir, { recursive: true });
        const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
        const provenance = JSON.parse(await readFile(ARMOR_PROVENANCE_PATH, 'utf8'));
        await mutate({ manifest, provenance, sourceDir });
        const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
        const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`);
        const outputBytes = Buffer.from('existing synced manifest');
        const reportBytes = Buffer.from('existing verifier report');
        await Promise.all([
            writeFile(manifestPath, manifestBytes),
            writeFile(provenancePath, provenanceBytes),
            writeFile(outputPath, outputBytes),
            writeFile(reportPath, reportBytes),
        ]);
        const runtimePaths = provenance.batches.flatMap((record) => record.exports)
            .map((entry) => resolve(REPO_ROOT, 'public', entry.runtimePath.slice(1)));
        const runtimeBefore = await readByteSnapshot(runtimePaths);

        const sync = runManifestSync([
            '--catalog', catalogPath,
            '--manifest', manifestPath,
            '--provenance', provenancePath,
            '--source-dir', sourceDir,
            '--public-root', resolve(REPO_ROOT, 'public'),
            '--output', outputPath,
        ]);
        assert.equal(sync.status, 1, `Sync accepted ${label}: ${sync.stderr}`);
        assert.deepEqual(await readFile(outputPath), outputBytes);

        const verification = runArtVerifier([
            '--scope', 'equipment',
            '--cohort', 'armor',
            '--equipment-manifest', manifestPath,
            '--equipment-provenance', provenancePath,
            '--equipment-source-dir', sourceDir,
            '--public-root', resolve(REPO_ROOT, 'public'),
            '--write-report', reportPath,
        ]);
        assert.equal(verification.status, 1, `Verifier accepted ${label}: ${verification.stderr}`);
        const report = JSON.parse(verification.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.invalidArtwork.length, 1);
        assert.deepEqual(await readFile(reportPath), reportBytes);
        assert.deepEqual(await readFile(manifestPath), manifestBytes);
        assert.deepEqual(await readFile(provenancePath), provenanceBytes);
        assert.deepEqual(await readByteSnapshot(runtimePaths), runtimeBefore);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
};

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

test('partial equipment batch publishes only declared cells and exact replay remains byte-identical', async () => {
    const fixture = await createProcessorFixture({ batchId: 'partial-batch', identityCount: 3 });
    try {
        assert.equal(fixture.batch.identities.length, 3);
        assert.deepEqual(fixture.batch.identities.map((identity) => identity.cell), CELL_ORDER.slice(0, 3));
        assert.match(fixture.batch.prompt, /unused trailing cells.*completely transparent/i);

        const first = runBatchProcessor(processorArgs(fixture));
        assert.equal(first.status, 0, first.stderr);
        const paths = runtimeOutputPaths(fixture);
        const beforeOutputs = await readByteSnapshot(paths);
        const beforeLedger = await readFile(fixture.provenancePath);
        const provenance = JSON.parse(beforeLedger);
        assert.equal(provenance.batches.length, 1);
        assert.equal(provenance.batches[0].identityNames.length, 3);
        assert.equal(provenance.batches[0].exports.length, 3);

        const replay = runBatchProcessor(processorArgs(fixture));
        assert.equal(replay.status, 0, replay.stderr);
        assert.deepEqual(await readByteSnapshot(paths), beforeOutputs);
        assert.deepEqual(await readFile(fixture.provenancePath), beforeLedger);
    } finally {
        await fixture.dispose();
    }
});

test('partial equipment batch rejects content in every unused trailing cell before writes', async () => {
    const fixture = await createProcessorFixture({ batchId: 'partial-unused-cell', identityCount: 3 });
    try {
        createSourceSheet(fixture.sourceSheetPath, { usedCells: 3, paintUnusedCell: true });

        const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

        assert.equal(result.status, 1);
        assert.match(result.stderr, /unused trailing cell bottom-left must be completely transparent/i);
        await assertNoProcessorWrites(fixture);
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

test('equipment batch processor rejects a catalog-valid mixed-family batch without writes', async () => {
    const fixture = await createProcessorFixture();
    try {
        const replacement = fixture.catalog.find((row) => (
            row.cohort === fixture.batch.cohort
            && row.familyKey !== fixture.batch.identities[0].familyKey
        ));
        assert.ok(replacement);
        fixture.batch.identities[5] = {
            cell: CELL_ORDER[5],
            ...replacement,
            prompt: `${replacement.name} prompt`,
        };
        fixture.batch.identityNames[5] = replacement.name;
        await writeFile(fixture.batchPath, `${JSON.stringify(fixture.batch)}\n`);
        await rewriteDeclaration(fixture);

        const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

        assert.equal(result.status, 1);
        assert.match(result.stderr, /share one illustration family/i);
        await assertNoProcessorWrites(fixture);
    } finally {
        await fixture.dispose();
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

test('armor processor rejects visible chroma-green residual before writes', async () => {
    const fixture = await createProcessorFixture({ cohort: 'armor', familyKey: 'armor-coat' });
    try {
        createSourceSheet(fixture.sourceSheetPath, { kind: 'chroma-residual' });

        const result = runBatchProcessor(processorArgs(fixture, ['--dry-run']));

        assert.equal(result.status, 1);
        assert.match(result.stderr, /chroma-green residual/i);
        await assertNoProcessorWrites(fixture);
    } finally {
        await fixture.dispose();
    }
});

test('armor processor preserves reviewed nature accents but rejects a large chroma-key region without writes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-armor-nature-chroma-'));
    const catalogPath = join(directory, 'catalog.json');
    const sourcePath = join(directory, 'armor-cloak-01.png');
    const declarationPath = join(directory, 'declaration.json');
    const publicRoot = join(directory, 'public');
    const provenancePath = join(directory, 'provenance.json');
    const batchPath = join(ARMOR_BATCH_DIR, 'armor-cloak-01.json');
    try {
        const dump = runDump(['--output', catalogPath]);
        assert.equal(dump.status, 0, dump.stderr);
        const batch = JSON.parse(await readFile(batchPath, 'utf8'));
        await writeFile(sourcePath, await readFile(join(ARMOR_SOURCE_DIR, 'armor-cloak-01.png')));
        await writeFile(declarationPath, `${JSON.stringify({
            batchId: batch.batchId,
            identityNames: batch.identityNames,
        })}\n`);
        const script = [
            'from PIL import Image, ImageDraw',
            `path = ${JSON.stringify(sourcePath)}`,
            'image = Image.open(path).convert("RGBA")',
            'draw = ImageDraw.Draw(image)',
            'draw.rectangle((19, 219, 79, 279), fill=(0, 255, 0, 255))',
            'image.save(path)',
        ].join('\n');
        const inject = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
        assert.equal(inject.status, 0, inject.stderr);

        const result = runBatchProcessor([
            '--batch', batchPath,
            '--catalog', catalogPath,
            '--source-sheet', sourcePath,
            '--source-declaration', declarationPath,
            '--public-root', publicRoot,
            '--equipment-manifest', EQUIPMENT_MANIFEST_PATH,
            '--provenance', provenancePath,
            '--dry-run',
        ]);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /nature source contains excessive chroma-green region/i);
        await assert.rejects(stat(publicRoot), { code: 'ENOENT' });
        await assert.rejects(stat(provenancePath), { code: 'ENOENT' });

        const actual = runArtVerifier(['--scope', 'equipment', '--cohort', 'armor']);
        assert.equal(actual.status, 0, actual.stderr || actual.stdout);
        assert.equal(JSON.parse(actual.stdout).ok, true);
    } finally {
        await rm(directory, { recursive: true, force: true });
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

test('equipment batch processor validates finalized generation review before an exact armor replay', async (context) => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-finalized-replay-'));
    const catalogPath = join(directory, 'catalog.json');
    const declarationPath = join(directory, 'source-declaration.json');
    const batchPath = join(ARMOR_BATCH_DIR, 'armor-boots-01.json');
    const sourcePath = join(ARMOR_SOURCE_DIR, 'armor-boots-01.png');
    try {
        const dump = runDump(['--output', catalogPath]);
        assert.equal(dump.status, 0, dump.stderr);
        const batch = JSON.parse(await readFile(batchPath, 'utf8'));
        const provenance = JSON.parse(await readFile(ARMOR_PROVENANCE_PATH, 'utf8'));
        await writeFile(declarationPath, `${JSON.stringify({
            batchId: batch.batchId,
            identityNames: batch.identityNames,
        })}\n`);
        const runtimePaths = provenance.batches.flatMap((record) => record.exports)
            .map((entry) => resolve(REPO_ROOT, 'public', entry.runtimePath.slice(1)));
        const runtimeBefore = await readByteSnapshot(runtimePaths);
        const manifestBefore = await readFile(EQUIPMENT_MANIFEST_PATH);
        const provenanceBefore = await readFile(ARMOR_PROVENANCE_PATH);
        const argsFor = (provenancePath, manifestPath = EQUIPMENT_MANIFEST_PATH) => [
            '--batch', batchPath,
            '--catalog', catalogPath,
            '--source-sheet', sourcePath,
            '--source-declaration', declarationPath,
            '--public-root', resolve(REPO_ROOT, 'public'),
            '--equipment-manifest', manifestPath,
            '--provenance', provenancePath,
        ];

        const replay = runBatchProcessor(argsFor(ARMOR_PROVENANCE_PATH));
        assert.equal(replay.status, 0, replay.stderr);
        assert.match(replay.stdout, /replay no-op/i);
        assert.deepEqual(await readByteSnapshot(runtimePaths), runtimeBefore);
        assert.deepEqual(await readFile(EQUIPMENT_MANIFEST_PATH), manifestBefore);
        assert.deepEqual(await readFile(ARMOR_PROVENANCE_PATH), provenanceBefore);

        const mutations = [
            ['foreign accepted batch', (ledger) => { ledger.generationReview.accepted[0].batchId = 'foreign-batch'; }],
            ['incomplete accepted coverage', (ledger) => { ledger.generationReview.accepted.pop(); }],
            ['foreign rejected batch', (ledger) => { ledger.generationReview.rejected[0].batchId = 'foreign-batch'; }],
            ['unexpected accepted field', (ledger) => { ledger.generationReview.accepted[0].unexpected = true; }],
            ['unexpected top-level field', (ledger) => { ledger.unexpected = true; }],
            ['traversal source sheet', (ledger) => { ledger.batches[0].sourceSheet = '../escaped.png'; }],
            ['absolute source sheet', (ledger) => { ledger.batches[0].sourceSheet = '/tmp/escaped.png'; }],
            ['nested source sheet', (ledger) => { ledger.batches[0].sourceSheet = 'nested/source.png'; }],
            ['dot source sheet', (ledger) => { ledger.batches[0].sourceSheet = '.'; }],
            ['accepted raw traversal', (ledger) => { ledger.generationReview.accepted[0].rawImage = '../escaped.png'; }, true],
            ['rejected raw traversal', (ledger) => { ledger.generationReview.rejected[0].rawImage = 'nested/escaped.png'; }, true],
            ['duplicate raw image name', (ledger) => {
                ledger.generationReview.rejected[0].rawImage = ledger.generationReview.accepted[0].rawImage;
            }, true],
        ];
        for (const [label, mutate, repinReview = false] of mutations) {
            await context.test(label, async () => {
                const mutated = structuredClone(provenance);
                mutate(mutated);
                const mutatedPath = join(directory, `${label.replaceAll(' ', '-')}.json`);
                const mutatedBytes = Buffer.from(`${JSON.stringify(mutated, null, 2)}\n`);
                await writeFile(mutatedPath, mutatedBytes);
                const mutatedManifest = JSON.parse(manifestBefore.toString('utf8'));
                if (repinReview) {
                    mutatedManifest.pipeline.provenance.cohorts.armor.generationReviewSha256 = hashCanonicalJson(mutated.generationReview);
                }
                const mutatedManifestPath = join(directory, `${label.replaceAll(' ', '-')}-manifest.json`);
                await writeFile(mutatedManifestPath, `${JSON.stringify(mutatedManifest, null, 2)}\n`);

                const result = runBatchProcessor(argsFor(mutatedPath, mutatedManifestPath));

                assert.equal(result.status, 1);
                assert.match(result.stderr, /Invalid provenance ledger/);
                assert.deepEqual(await readFile(mutatedPath), mutatedBytes);
                assert.deepEqual(await readByteSnapshot(runtimePaths), runtimeBefore);
                assert.deepEqual(await readFile(EQUIPMENT_MANIFEST_PATH), manifestBefore);
                assert.deepEqual(await readFile(ARMOR_PROVENANCE_PATH), provenanceBefore);
            });
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
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
