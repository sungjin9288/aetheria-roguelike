import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { stageTossAssets } from './tossAssetCatalog.mjs';

const repoRoot = process.cwd();
const outputRoot = path.join(repoRoot, '.toss/public');
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
const result = await stageTossAssets({ repoRoot, outputRoot });

console.log(JSON.stringify({
    outputRoot,
    copiedFiles: result.copiedFiles,
    totalBytes: result.catalog.totalBytes,
    filesSha256: result.catalog.filesSha256,
}, null, 2));
