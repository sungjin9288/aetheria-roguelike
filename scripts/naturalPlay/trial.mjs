// 오늘의 시련 측정: node --import tsx scripts/naturalPlay/trial.mjs [--from 2026-12-01] [--days 30] [--seeds 4] [--out file.json]
// 날짜마다 그날의 조건으로 시드 수만큼 한 판씩 걷고, 완주율 · 행동 수 · 직업/지역별 표를 낸다(드라이버 본체는 `driver.mjs`, 같은 정책).
import fs from 'node:fs';
import { runNaturalPlay } from './driver.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const from = flag('--from', '2026-12-01');
const dayCount = Number(flag('--days', '30'));
const seedCount = Number(flag('--seeds', '4'));
const out = flag('--out', null);

const [year, month, day] = from.split('-').map(Number);
const dayKeys = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, month - 1, day + index, 12);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
});

const runs = [];
for (const dayKey of dayKeys) {
    for (let seed = 1; seed <= seedCount; seed += 1) {
        // 직업 경로는 정책의 이름일 뿐이다 — 시련의 직업은 날짜가 정한다.
        const result = await runNaturalPlay({ seed, jobPath: ['전사'], runs: 1, maxSteps: 4000, field: 'all', trialDay: dayKey });
        runs.push({ seed, steps: result.steps, ...result.trial });
    }
}

const median = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const summarize = (list) => {
    const cleared = list.filter((run) => run.result?.cleared);
    const actions = cleared.map((run) => run.result.actions);
    return {
        runs: list.length,
        cleared: cleared.length,
        rate: Number(((100 * cleared.length) / Math.max(1, list.length)).toFixed(0)),
        actions: median(actions),
        minActions: actions.length ? Math.min(...actions) : null,
        maxActions: actions.length ? Math.max(...actions) : null,
        maps: Number((list.reduce((sum, run) => sum + (run.result?.maps ?? 0), 0) / Math.max(1, list.length)).toFixed(2)),
        stuck: list.filter((run) => !run.result).length,
    };
};
const groupBy = (list, key) => {
    const groups = new Map();
    for (const run of list) groups.set(key(run), [...(groups.get(key(run)) ?? []), run]);
    return [...groups.entries()].sort(([left], [right]) => (left < right ? -1 : 1));
};
const print = (title, rows) => {
    console.log(`\n${title}`);
    for (const [name, list] of rows) {
        const sum = summarize(list);
        console.log(`  ${name} · 판 ${sum.runs} · 완주 ${sum.cleared} (${sum.rate}%) · 행동 ${sum.actions ?? '-'} [${sum.minActions ?? '-'}~${sum.maxActions ?? '-'}] · 깬 지도 ${sum.maps}${sum.stuck ? ` · 막힘 ${sum.stuck}` : ''}`);
    }
};

print('전체', [['모든 날', runs]]);
print('날짜', groupBy(runs, (run) => `${run.dayKey} ${run.loc} ${run.job} Lv${run.startLevel}`));
print('지역', groupBy(runs, (run) => run.loc));
print('직업', groupBy(runs, (run) => run.job));
if (out) fs.writeFileSync(out, `${JSON.stringify({ from, dayCount, seedCount, runs })}\n`);
