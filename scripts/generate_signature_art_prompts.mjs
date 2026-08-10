import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSignaturePromptBatchFromRows } from './signaturePromptContract.mjs';

const readJson = async (target) => JSON.parse(await readFile(target, 'utf8'));

const parseArgs = (args) => {
    const options = {};
    const names = new Map([
        ['--catalog', 'catalogPath'],
        ['--registry', 'registryPath'],
        ['--catalog-sha256', 'catalogSha256'],
        ['--batch-id', 'batchId'],
        ['--names', 'names'],
        ['--output', 'outputPath'],
    ]);
    for (let index = 0; index < args.length; index += 2) {
        const key = names.get(args[index]);
        const value = args[index + 1];
        if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${args[index] || '<missing>'}`);
        options[key] = value;
    }
    for (const key of names.values()) {
        if (!options[key]) throw new Error(`Missing required signature prompt option: ${key}`);
    }
    return options;
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const [catalog, registryDocument] = await Promise.all([
        readJson(resolve(options.catalogPath)),
        readJson(resolve(options.registryPath)),
    ]);
    const batch = buildSignaturePromptBatchFromRows({
        catalog,
        registry: registryDocument.entries,
        catalogSha256: options.catalogSha256,
        batchId: options.batchId,
        names: options.names,
    });
    const outputPath = resolve(options.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, 'utf8');
    process.stdout.write(`generated signature prompt batch ${batch.batchId} (${batch.identityNames.length})\n`);
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
    main().catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
