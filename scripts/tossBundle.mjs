import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const TOSS_BUNDLE_BUDGET_BYTES = 80 * 1024 * 1024;
export const TOSS_TEST_HARNESS_MARKERS = [
    '__AETHERIA_TEST_API__',
    'aetheria.device-qa.',
    'toss-first-five',
    'VITE_ENABLE_TEST_API=1',
];

const listBundleFiles = async (directory, root = directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await listBundleFiles(absolutePath, root));
        else if (entry.isFile()) files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }

    return files;
};

export const verifyTossBundle = async ({
    bundleDir,
    catalog,
    maxBytes = TOSS_BUNDLE_BUDGET_BYTES,
    allowTestHarness = false,
}) => {
    const files = await listBundleFiles(bundleDir);
    const expected = [
        'index.html',
        ...catalog.files.map((file) => file.replace(/^public\//, '')),
    ];
    const expectedSet = new Set(expected);
    const missing = [];

    for (const relativePath of expected) {
        try {
            await access(path.join(bundleDir, relativePath));
        } catch {
            missing.push(relativePath);
        }
    }

    const forbidden = files.filter((file) => (
        /(^|\/)(sw|service-worker)([.-].*)?\.js$/.test(file)
    ));
    const generatedAsset = /^assets\/.+\.(?:css|js|woff2?)$/;
    const unexpected = files.filter((file) => (
        !expectedSet.has(file) && !generatedAsset.test(file)
    ));
    let totalBytes = 0;
    for (const file of files) totalBytes += (await stat(path.join(bundleDir, file))).size;
    const inspectableFiles = files.filter((file) => (
        file === 'index.html' || /\.(?:css|js)$/.test(file)
    ));
    const markerSet = new Set();
    for (const file of inspectableFiles) {
        const source = await readFile(path.join(bundleDir, file), 'utf8');
        for (const marker of TOSS_TEST_HARNESS_MARKERS) {
            if (source.includes(marker)) markerSet.add(marker);
        }
    }
    const testHarnessMarkers = [...markerSet];

    return {
        ok: missing.length === 0
            && forbidden.length === 0
            && unexpected.length === 0
            && (allowTestHarness || testHarnessMarkers.length === 0)
            && totalBytes <= maxBytes,
        files: files.length,
        totalBytes,
        maxBytes,
        missing,
        forbidden,
        unexpected,
        testHarnessMarkers,
    };
};
