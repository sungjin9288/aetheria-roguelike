#!/usr/bin/env node
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildSoftLaunchReport, verifySoftLaunchAuthorityFiles } from './tossSoftLaunchReport.mjs';

const parseArgs = (argv) => {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error(`Invalid option: ${key}`);
        values[key.slice(2)] = argv[index + 1];
        index += 1;
    }
    return values;
};

const readJsonl = async (filePath) => (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const safeBuildOutputPath = async (output) => {
    const buildRoot = path.resolve('build/toss-soft-launch');
    const outputPath = path.resolve(output);
    const relativeOutput = path.relative(buildRoot, outputPath);
    if (!relativeOutput
        || relativeOutput === '..'
        || relativeOutput.startsWith(`..${path.sep}`)
        || path.isAbsolute(relativeOutput)) {
        throw new Error('Soft Launch report output must stay under build/toss-soft-launch/ until reviewed');
    }

    await mkdir(buildRoot, { recursive: true });
    const rootStat = await lstat(buildRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        throw new Error('Soft Launch report build root must be a real directory');
    }

    let current = buildRoot;
    const parentSegments = path.dirname(relativeOutput).split(path.sep).filter(Boolean);
    for (const segment of parentSegments) {
        const next = path.join(current, segment);
        let directoryStat;
        try {
            directoryStat = await lstat(next);
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
            await mkdir(next);
            directoryStat = await lstat(next);
        }
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
            throw new Error('Soft Launch report output cannot traverse a symlink or non-directory');
        }
        current = next;
    }
    return outputPath;
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const required = ['events', 'authority', 'out'];
    for (const key of required) if (!args[key]) throw new Error(`Missing --${key}`);
    for (const key of ['release-id', 'deployment-id', 'cutoff']) {
        if (args[key]) throw new Error(`--${key} must be declared by the authority document`);
    }
    const authorityPath = path.resolve(args.authority);
    const authority = JSON.parse(await readFile(authorityPath, 'utf8'));
    const authorityFiles = await verifySoftLaunchAuthorityFiles(authority, path.dirname(authorityPath));
    if (!authorityFiles.ok) throw new Error(authorityFiles.reason);
    const report = buildSoftLaunchReport({
        events: await readJsonl(path.resolve(args.events)),
        candidateId: authority.candidateId,
        artifactSha256: authority.artifactSha256,
        releaseId: authority.releaseId,
        deploymentId: authority.deploymentId,
        cutoff: authority.cutoff,
        authority,
    });
    const outputPath = await safeBuildOutputPath(args.out);
    try {
        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
        if (error?.code === 'EEXIST') {
            throw new Error('Soft Launch report output already exists; immutable output required');
        }
        throw error;
    }
    process.stdout.write(`${JSON.stringify({
        ok: true,
        outputPath,
        candidateId: report.candidateId,
        artifactSha256: report.artifactSha256,
        inputSha256: report.inputSha256,
        authoritySha256: report.authoritySha256,
    })}\n`);
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
