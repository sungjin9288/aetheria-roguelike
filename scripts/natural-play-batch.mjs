// 자연 플레이 여러 시드를 병렬로: node scripts/natural-play-batch.mjs --out DIR [--seeds 1-24] [--paths knight,archmage,...]
//   [--runs 7] [--jobs 2] [--rule-decline none|all|stacked] [--max-steps N]
// 결과는 DIR/<path>/seed-<n>.json — 이미 있는 파일은 건너뛴다(중단 뒤 이어 돌리기). 2026-10 Wave 117.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const parseRange = (text) => text.split(',').flatMap((part) => {
    const [from, to] = part.split('-').map(Number);
    return Number.isInteger(to) ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [from];
});

const out = flag('--out', null);
if (!out) throw new Error('--out DIR is required');
const seeds = parseRange(flag('--seeds', '1-24'));
const paths = flag('--paths', 'knight,berserker,archmage,cleric,assassin').split(',');
const jobs = Number(flag('--jobs', '2'));
const passThrough = ['--runs', '--rule-decline', '--max-steps'].flatMap((name) => (args.includes(name) ? [name, flag(name)] : []));
const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'natural-play.mjs');

const queue = [];
for (const seed of seeds) for (const name of paths) {
    const file = path.join(out, name, `seed-${seed}.json`);
    if (!fs.existsSync(file)) queue.push({ seed, name, file });
}
console.log(`natural-play: ${queue.length} jobs (${jobs} at a time) → ${out}`);

let failed = 0;
const runOne = ({ seed, name, file }) => new Promise((resolve) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.partial`;
    const child = spawn(process.execPath, ['--import', 'tsx', cli, '--seed', String(seed), '--path', name, '--out', temp, ...passThrough], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
        if (code === 0 && fs.existsSync(temp)) fs.renameSync(temp, file);
        else { failed += 1; console.error(`FAIL ${name} seed ${seed} (exit ${code})\n${stderr.slice(-2000)}`); }
        resolve();
    });
});

const workers = Array.from({ length: Math.max(1, jobs) }, async () => {
    while (queue.length) await runOne(queue.shift());
});
await Promise.all(workers);
console.log(`natural-play: done${failed ? ` — ${failed} failed` : ''}`);
process.exitCode = failed ? 1 : 0;
