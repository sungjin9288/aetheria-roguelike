// 자연 플레이 결과 요약 · 짝 비교: node scripts/natural-play-report.mjs DIR [BASE_DIR]
//   DIR 하나면 회차별 요약(사망/판 · 무사망 · 루프(한 회차 15번 이상) · 시간). BASE_DIR를 주면 같은 경로 · 시드 · 회차를 짝지어
//   차이와 z(짝 차이 평균 / 표준오차)를 보인다. 2026-10 Wave 117.
import fs from 'node:fs';
import path from 'node:path';

const LOOP_DEATHS = 15;

const deathRows = [];
/** 큰 순간 사이 가장 긴 공백(회차 시작 → 첫 순간, 마지막 순간 → 회차 끝 포함). 순간 기록이 없는 결과면 null. */
const longestGap = (run) => {
    if (!Array.isArray(run.moments)) return null;
    const times = [0, ...run.moments.map(([at]) => at), run.hours];
    return times.slice(1).reduce((max, at, index) => Math.max(max, at - times[index]), 0);
};
const quantile = (xs, q) => { const sorted = [...xs].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; };
const load = (dir, collectDeaths = false) => {
    const rows = new Map();
    for (const name of fs.readdirSync(dir)) {
        const sub = path.join(dir, name);
        if (!fs.statSync(sub).isDirectory()) continue;
        for (const file of fs.readdirSync(sub).filter((f) => f.endsWith('.json'))) {
            const result = JSON.parse(fs.readFileSync(path.join(sub, file), 'utf8'));
            for (const run of result.runs || []) {
                rows.set(`${name}/${file}/${run.run}`, { path: name, run: run.run, deaths: run.deaths, hours: run.hours, longestGap: longestGap(run), moments: run.moments || null, zero: run.deaths === 0 ? 1 : 0, loop: run.deaths >= LOOP_DEATHS ? 1 : 0, ruleId: run.ruleId });
            }
            if (collectDeaths) for (const death of result.deaths || []) deathRows.push(death);
            if (result.stalled) console.warn(`stalled: ${name}/${file} ${JSON.stringify(result.stalled).slice(0, 200)}`);
        }
    }
    return rows;
};

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const stdErr = (xs) => {
    const m = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1) / Math.max(1, xs.length));
};

const [dir, baseDir] = process.argv.slice(2);
if (!dir) throw new Error('usage: natural-play-report.mjs DIR [BASE_DIR]');
const rows = load(dir, !baseDir);
const runs = [...new Set([...rows.values()].map((row) => row.run))].sort((a, b) => a - b);
if (!baseDir) {
    for (const run of runs) {
        const xs = [...rows.values()].filter((row) => row.run === run);
        const deaths = deathRows.filter((death) => death.run === run);
        const kind = (death) => (death.enemy.huntChampion ? '우두머리' : death.enemy.isBoss ? '보스' : death.enemy.isElite ? '정예' : '일반');
        const tally = (key) => Object.entries(deaths.reduce((acc, death) => ({ ...acc, [key(death)]: (acc[key(death)] || 0) + 1 }), {}))
            .sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(' · ');
        console.log(`run ${run}: n ${xs.length} · 사망 ${mean(xs.map((r) => r.deaths)).toFixed(2)} · 무사망 ${(100 * mean(xs.map((r) => r.zero))).toFixed(0)}% · 루프 ${xs.filter((r) => r.loop).length} · 최다 ${Math.max(...xs.map((r) => r.deaths))} · ${mean(xs.map((r) => r.hours)).toFixed(1)}h`);
        const gaps = xs.map((r) => r.longestGap).filter((gap) => gap !== null);
        if (gaps.length) {
            const kinds = xs.flatMap((r) => r.moments || []).reduce((acc, [, kind]) => ({ ...acc, [kind]: (acc[kind] || 0) + 1 }), {});
            const perHour = xs.reduce((sum, r) => sum + (r.moments || []).length, 0) / Math.max(1e-9, xs.reduce((sum, r) => sum + r.hours, 0));
            console.log(`  큰 순간: ${perHour.toFixed(2)}/시간 · 최장 공백 중앙값 ${quantile(gaps, 0.5).toFixed(2)}h · 상위 10% ${quantile(gaps, 0.9).toFixed(2)}h · 3시간 이상 ${gaps.filter((gap) => gap >= 3).length}판 · ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([kind, count]) => `${kind} ${count}`).join(' ')}`);
        }
        if (deaths.length) console.log(`  적: ${tally(kind)}\n  레벨대: ${tally((death) => `Lv${Math.floor((death.level - 1) / 10) * 10 + 1}~${Math.floor((death.level - 1) / 10) * 10 + 10}`)}`);
    }
} else {
    const base = load(baseDir);
    for (const run of runs) {
        const pairs = [...rows.entries()].filter(([, row]) => row.run === run).map(([key, row]) => [base.get(key), row]).filter(([b]) => b);
        if (!pairs.length) continue;
        const cell = (key) => {
            const diffs = pairs.map(([b, r]) => r[key] - b[key]);
            const se = stdErr(diffs);
            return `${key} ${mean(pairs.map(([b]) => b[key])).toFixed(2)}→${mean(pairs.map(([, r]) => r[key])).toFixed(2)} (z ${(se ? mean(diffs) / se : 0).toFixed(2)})`;
        };
        console.log(`run ${run} (짝 ${pairs.length}): ${['deaths', 'zero', 'loop', 'hours', ...(pairs.every(([b, r]) => b.longestGap !== null && r.longestGap !== null) ? ['longestGap'] : [])].map(cell).join(' · ')}`);
    }
}
