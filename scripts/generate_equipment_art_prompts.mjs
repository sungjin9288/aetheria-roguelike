import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArtCatalog } from './artCatalog.mjs';
import {
    buildEquipmentPromptBatchFromRows,
    CELL_ORDER,
} from './equipmentPromptContract.mjs';

export { CELL_ORDER };

const readCatalog = async (path) => {
    const catalog = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(catalog)) throw new Error(`Catalog must be a JSON array: ${path}`);
    return catalog;
};

export const buildEquipmentPromptBatch = async ({ catalogPath, catalogRows = null, batchId, names }) => {
    const catalog = catalogRows || await readCatalog(catalogPath);
    const authoritativeCatalog = await buildArtCatalog();
    return buildEquipmentPromptBatchFromRows({
        catalog,
        catalogSha256: authoritativeCatalog.catalogSha256,
        batchId,
        names,
    });
};

const parseCli = (args) => {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--stdout') {
            options.stdout = true;
            continue;
        }
        const optionName = {
            '--catalog': 'catalogPath',
            '--batch-id': 'batchId',
            '--names': 'names',
            '--output': 'outputPath',
        }[argument];
        const value = args[index + 1];
        if (!optionName || !value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
        options[optionName] = value;
        index += 1;
    }
    for (const optionName of ['catalogPath', 'batchId', 'names']) {
        if (!options[optionName]) throw new Error(`Missing required option: --${optionName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    if (Boolean(options.stdout) === Boolean(options.outputPath)) {
        throw new Error('Choose exactly one output mode: --output <path> or --stdout');
    }
    return options;
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
    try {
        const options = parseCli(process.argv.slice(2));
        const batch = await buildEquipmentPromptBatch({
            catalogPath: resolve(options.catalogPath),
            batchId: options.batchId,
            names: options.names,
        });
        const output = `${JSON.stringify(batch, null, 2)}\n`;
        if (options.stdout) {
            process.stdout.write(output);
        } else {
            const outputPath = resolve(options.outputPath);
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, output, 'utf8');
        }
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
