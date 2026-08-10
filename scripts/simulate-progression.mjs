import { createHash } from 'node:crypto';

import {
    ProgressionSimulationError,
    simulateProgression,
} from '../src/systems/progressionSimulator.ts';

const parseIntegerFlag = (flag, value) => {
    if (value === undefined || !/^-?\d+$/.test(value)) {
        throw new Error(`${flag} requires an integer`);
    }
    return Number(value);
};

const parseArgs = (args) => {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const flag = args[index];
        if (flag === '--seed') {
            options.seed = parseIntegerFlag(flag, args[index + 1]);
            index += 1;
        } else if (flag === '--max-steps') {
            options.maxSteps = parseIntegerFlag(flag, args[index + 1]);
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${flag}`);
        }
    }
    return options;
};

try {
    const report = simulateProgression(parseArgs(process.argv.slice(2)));
    const reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    process.stdout.write(`${JSON.stringify({ hashAlgorithm: 'sha256', reportHash, report })}\n`);
} catch (error) {
    const code = error instanceof ProgressionSimulationError ? error.code : 'CLI_ARGUMENT_ERROR';
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
}
