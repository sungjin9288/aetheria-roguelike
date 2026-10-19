// 자연 플레이 한 시드: node --import tsx scripts/natural-play.mjs --seed 1 [--path knight] [--runs 1] [--max-steps N] [--rule-decline none|all|stacked] [--rule-pick default|fixed] [--out file.json]
// 2026-10 Wave 117 — 드라이버 본체는 `scripts/naturalPlay/driver.mjs`.
import fs from 'node:fs';
import { JOB_PATHS, runNaturalPlay } from './naturalPlay/driver.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const pathName = flag('--path', 'knight');
const jobPath = JOB_PATHS[pathName];
if (!jobPath) throw new Error(`unknown --path ${pathName} (${Object.keys(JOB_PATHS).join(', ')})`);
const result = await runNaturalPlay({
    seed: Number(flag('--seed', '1')),
    jobPath,
    runs: Number(flag('--runs', '1')),
    maxSteps: Number(flag('--max-steps', '400000')),
    ruleDecline: flag('--rule-decline', 'none'),
    rulePick: flag('--rule-pick', 'default'),
});
result.path = pathName;
const out = flag('--out', null);
const text = `${JSON.stringify(result)}\n`;
if (out) fs.writeFileSync(out, text);
else process.stdout.write(text);
