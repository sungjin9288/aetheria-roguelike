import path from 'node:path';
import process from 'node:process';

import { buildTossAssetCatalog } from './tossAssetCatalog.mjs';
import { verifyTossBundle } from './tossBundle.mjs';

const repoRoot = process.cwd();
const catalog = await buildTossAssetCatalog({ repoRoot });
const report = await verifyTossBundle({
    bundleDir: path.join(repoRoot, 'dist-toss'),
    catalog,
});

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
