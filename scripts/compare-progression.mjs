import { createHash } from 'node:crypto';

import { BASELINE_PROGRESSION_PROFILE, EXPLORATION_RHYTHM_PROFILE } from '../src/data/progressionProfiles.ts';
import {
    ProgressionSimulationError,
    simulateProgressionComparison,
} from '../src/systems/progressionSimulator.ts';

const AXES = new Set(['exp', 'loot', 'event']);

const parseInteger = (flag, value) => {
    if (value === undefined || !/^-?\d+$/.test(value)) throw new Error(`${flag} requires an integer`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`${flag} requires a safe integer`);
    return parsed;
};

const parseMultiplier = (value) => {
    if (value === undefined || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
        throw new Error('--multiplier requires a finite decimal number');
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('--multiplier requires a finite decimal number');
    return parsed;
};

const parseArgs = (args) => {
    const parsed = {
        axis: undefined,
        multiplier: undefined,
        seedStart: 20_260_810,
        seedCount: 64,
        maxSteps: undefined,
        candidateId: undefined,
        candidateVersion: undefined,
    };

    for (let index = 0; index < args.length; index += 1) {
        const flag = args[index];
        const value = args[index + 1];
        if (flag === '--axis') {
            if (!AXES.has(value)) throw new Error('--axis must be exp, loot, or event');
            parsed.axis = value;
            index += 1;
        } else if (flag === '--multiplier') {
            parsed.multiplier = parseMultiplier(value);
            index += 1;
        } else if (flag === '--seed-start') {
            parsed.seedStart = parseInteger(flag, value);
            index += 1;
        } else if (flag === '--seed-count') {
            parsed.seedCount = parseInteger(flag, value);
            index += 1;
        } else if (flag === '--max-steps') {
            parsed.maxSteps = parseInteger(flag, value);
            index += 1;
        } else if (flag === '--candidate-id') {
            if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(value)) throw new Error('INVALID_PROFILE_ID: --candidate-id is unsafe');
            parsed.candidateId = value;
            index += 1;
        } else if (flag === '--candidate-version') {
            parsed.candidateVersion = parseInteger(flag, value);
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${flag}`);
        }
    }

    if (!parsed.axis) throw new Error('--axis is required');
    if (parsed.multiplier === undefined) throw new Error('--multiplier is required');
    if (!parsed.candidateId || parsed.candidateVersion === undefined) throw new Error('INVALID_PROFILE_IDENTITY: --candidate-id and --candidate-version are required');
    if (parsed.candidateVersion !== BASELINE_PROGRESSION_PROFILE.version + 1) throw new Error('INVALID_PROFILE_VERSION: candidate version must be predecessor + 1');
    if (parsed.seedCount < 2 || parsed.seedCount > 1_000) {
        throw new Error('--seed-count must be between 2 and 1000');
    }

    return parsed;
};

try {
    const options = parseArgs(process.argv.slice(2));
    const seeds = Array.from({ length: options.seedCount }, (_, index) => options.seedStart + index);
    const multiplierKey = `${options.axis}Multiplier`;
    const candidateProfile = options.candidateId === EXPLORATION_RHYTHM_PROFILE.id
        ? (() => {
            if (options.axis !== 'event' || options.multiplier !== EXPLORATION_RHYTHM_PROFILE.eventMultiplier
                || options.candidateVersion !== EXPLORATION_RHYTHM_PROFILE.version) {
                throw new Error('INVALID_PROFILE_IDENTITY: exploration-rhythm@2 is the event-axis 0.8 candidate');
            }
            return EXPLORATION_RHYTHM_PROFILE;
        })()
        : {
            ...BASELINE_PROGRESSION_PROFILE,
            id: options.candidateId,
            version: options.candidateVersion,
            [multiplierKey]: options.multiplier,
        };
    const report = simulateProgressionComparison({
        seeds,
        predecessorProfile: BASELINE_PROGRESSION_PROFILE,
        candidateProfile,
        declaredAxis: options.axis,
        maxSteps: options.maxSteps,
    });
    const reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    process.stdout.write(`${JSON.stringify({ hashAlgorithm: 'sha256', reportHash, report })}\n`);
} catch (error) {
    const code = error instanceof ProgressionSimulationError ? error.code : 'CLI_ARGUMENT_ERROR';
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
}
