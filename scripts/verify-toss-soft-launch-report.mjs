#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
    evaluateSoftLaunchGate,
    verifySoftLaunchAuthorityFiles,
    verifySoftLaunchReport,
} from './tossSoftLaunchReport.mjs';

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

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (!args.report || !args.events || !args.authority) {
        throw new Error('Usage: --report <json> --events <jsonl> --authority <json>');
    }
    const report = JSON.parse(await readFile(path.resolve(args.report), 'utf8'));
    const events = (await readFile(path.resolve(args.events), 'utf8'))
        .split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
    const authorityPath = path.resolve(args.authority);
    const authority = JSON.parse(await readFile(authorityPath, 'utf8'));
    const authorityFiles = await verifySoftLaunchAuthorityFiles(authority, path.dirname(authorityPath));
    const binding = authorityFiles.ok
        ? verifySoftLaunchReport(report, events, authority)
        : { ok: false, reason: authorityFiles.reason };
    const gate = binding.ok ? evaluateSoftLaunchGate(report) : { ok: false, blockers: [binding.reason] };
    const result = { ok: binding.ok && gate.ok, binding, gate };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
