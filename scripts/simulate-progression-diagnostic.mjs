import {
    buildProgressionDiagnostic,
} from '../src/systems/progressionSimulator.ts';
import {
    PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS,
    PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS,
    canonicalJson,
} from './progression-diagnostic-evidence.mjs';

if (process.argv.length !== 2) {
    console.error('progression:diagnose accepts no arguments');
    process.exitCode = 1;
} else {
    const report = buildProgressionDiagnostic({
        focusedSeeds: PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS,
        comparisonSeeds: PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS,
        maxCombatTurns: 200,
    });
    process.stdout.write(canonicalJson(report));
}
