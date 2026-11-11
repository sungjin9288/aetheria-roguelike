// 자연 플레이 결과 요약 · 짝 비교: node scripts/natural-play-report.mjs DIR [BASE_DIR]
//   DIR 하나면 회차별 요약(사망/판 · 무사망 · 루프(한 회차 15번 이상) · 시간). BASE_DIR를 주면 같은 경로 · 시드 · 회차를 짝지어
//   차이와 z(짝 차이 평균 / 표준오차)를 보인다. 2026-10 Wave 117.
//   회차 규칙 카드별 줄(Wave 121): DIR 하나면 규칙별 사망 · 루프 · 새 각인, 짝이면 같은 거절 가능한 카드를 만난 회차의 받아들임 ↔ 거절.
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
/** 회차 시간 중 Lv41 → 48 구간 비중(H2, 2026-11) — Lv41에 닿지 못한 회차면 null. 48에 못 닿으면 회차 끝까지. */
const LATE_BAND = [41, 48];
const lateBandShare = (run) => {
    const from = run.levelAt?.[LATE_BAND[0]];
    if (from === undefined || !(run.hours > 0)) return null;
    return ((run.levelAt[LATE_BAND[1]] ?? run.hours) - from) / run.hours;
};
/**
 * 사망 뒤 다시 오르기(원장 §139) — 사망 직전 회차 최고 레벨 `best`에 다시 닿는 데 걸린 시간 ÷ 회차 시작부터 처음 `best`에 닿은 시간.
 * 겹치는 구간(다시 오르다 또 죽음)은 첫 사망부터 센다. 끝내 닿지 못한 구간은 뺀다(비율이 정의되지 않는다). 기록이 없으면 [].
 * (§139의 시간 합계는 '넘는 시각'까지지만 비율은 같은 레벨끼리 비교한다 — 넘는 레벨의 첫 시각은 그 순간 자체다.)
 */
const reclimbRatios = (run) => {
    if (!Array.isArray(run.climbs)) return [];
    const out = [];
    let best = 0;
    let pending = null;
    for (const [at, level] of run.climbs) {
        if (pending && level >= pending.best) {
            const first = run.levelAt?.[pending.best];
            if (first > 0) out.push({ best: pending.best, ratio: (at - pending.at) / first });
            pending = null;
        }
        if (!pending && level < best) pending = { at, best };
        best = Math.max(best, level);
    }
    return out;
};
/** 회차 시간 중 레벨이 [lo, hi]였던 시간(사망 뒤 다시 오른 구간 포함) — 레벨 기록이 없으면 0. */
const bandHours = (run, lo, hi) => {
    if (!Array.isArray(run.climbs)) return 0;
    return run.climbs.reduce((sum, [at, level], index) => {
        const until = run.climbs[index + 1]?.[0] ?? run.hours;
        return level >= lo && level <= hi ? sum + (until - at) : sum;
    }, 0);
};
/** 장의 선물(H3) 판단 구간 — 재미 분석 §2.1의 빌드 결정이 시간당 0.08 · 0.5였던 Lv31-48. */
const PICK_BAND = [31, 48];
const quantile = (xs, q) => { const sorted = [...xs].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; };
const load = (dir, collectDeaths = false) => {
    const rows = new Map();
    for (const name of fs.readdirSync(dir)) {
        const sub = path.join(dir, name);
        if (!fs.statSync(sub).isDirectory()) continue;
        for (const file of fs.readdirSync(sub).filter((f) => f.endsWith('.json'))) {
            const result = JSON.parse(fs.readFileSync(path.join(sub, file), 'utf8'));
            const ordered = [...(result.runs || [])].sort((a, b) => a.run - b.run);
            ordered.forEach((run, index) => {
                // 새 각인 = 회차 끝 발견한 각인 중 직전 회차 끝에 없던 것(계승 화면 요약과 같은 규칙, 원장 §121.7 — Wave 125부터 발견은
                //   계정 수집이라 처음 모은 각인만 센다). 기록이 없는 결과면 null.
                const before = new Set(ordered[index - 1]?.signatures || []);
                const newSignatures = Array.isArray(run.signatures) ? run.signatures.filter((name) => !before.has(name)).length : null;
                rows.set(`${name}/${file}/${run.run}`, {
                    path: name, run: run.run, rank: run.rank, deaths: run.deaths, hours: run.hours, longestGap: longestGap(run), moments: run.moments || null,
                    zero: run.deaths === 0 ? 1 : 0, loop: run.deaths >= LOOP_DEATHS ? 1 : 0,
                    ruleId: run.ruleId, ruleOptional: Boolean(run.ruleOptional), ruleDeclined: Boolean(run.ruleDeclined), newSignatures,
                    chapterPicks: Array.isArray(run.chapterPicks) ? run.chapterPicks : null, pickBandHours: bandHours(run, ...PICK_BAND),
                    lateShare: lateBandShare(run), reclimbs: reclimbRatios(run), ladderRank: Number(run.ladderRank) || 0, essence: Number(run.essence) || 0,
                });
            });
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
        const picked = xs.filter((r) => r.chapterPicks);
        if (picked.length) {
            const all = picked.flatMap((r) => r.chapterPicks);
            const kinds = all.reduce((acc, [, , kind]) => ({ ...acc, [kind]: (acc[kind] || 0) + 1 }), {});
            const inBand = all.filter(([, , , level]) => level >= PICK_BAND[0] && level <= PICK_BAND[1]).length;
            const bandTime = picked.reduce((sum, r) => sum + r.pickBandHours, 0);
            console.log(`  장의 선물: 판당 ${(all.length / picked.length).toFixed(2)}번 · ${Object.entries(kinds).map(([kind, count]) => `${kind} ${(100 * count / all.length).toFixed(0)}%`).join(' ')} · Lv${PICK_BAND[0]}-${PICK_BAND[1]} ${(inBand / Math.max(1e-9, bandTime)).toFixed(2)}/시간 (그 구간 판당 ${(bandTime / picked.length).toFixed(1)}h)`);
        }
        const shares = xs.map((r) => r.lateShare).filter((share) => share !== null);
        if (shares.length) console.log(`  Lv41-48 비중: 평균 ${(100 * mean(shares)).toFixed(1)}% · 중앙 ${(100 * quantile(shares, 0.5)).toFixed(1)}% (Lv41 닿은 ${shares.length}판) · 정수 사다리 ${mean(xs.map((r) => r.ladderRank)).toFixed(0)}단계`);
        const climbs = xs.flatMap((r) => r.reclimbs);
        if (climbs.length) {
            const band = (c) => (c.best <= 20 ? 'Lv1~20' : c.best <= 30 ? 'Lv21~30' : c.best <= 40 ? 'Lv31~40' : 'Lv41+');
            const bands = ['Lv1~20', 'Lv21~30', 'Lv31~40', 'Lv41+'].map((name) => [name, climbs.filter((c) => band(c) === name).map((c) => c.ratio)]).filter(([, rs]) => rs.length);
            console.log(`  다시 오르기 ÷ 처음 오르기 중앙값: ${bands.map(([name, rs]) => `${name} ${quantile(rs, 0.5).toFixed(2)} (${rs.length})`).join(' · ')}`);
        }
        if (deaths.length) console.log(`  적: ${tally(kind)}\n  레벨대: ${tally((death) => `Lv${Math.floor((death.level - 1) / 10) * 10 + 1}~${Math.floor((death.level - 1) / 10) * 10 + 10}`)}`);
    }
    // 회차 규칙별(거절할 수 있는 카드인지 · 거절했는지로 나눈다) — 카드 미리보기(`outlook`)의 입력이다. 2026-10 Wave 121.
    const groups = new Map();
    for (const row of rows.values()) {
        if (!row.ruleId) continue;
        const key = `${row.ruleId}${row.ruleOptional ? ' · 거절 가능' : ''}${row.ruleDeclined ? ' · 거절함' : ''}`;
        groups.set(key, [...(groups.get(key) || []), row]);
    }
    const ruleCell = (xs) => {
        const sigs = xs.map((r) => r.newSignatures).filter((n) => n !== null);
        return `n ${xs.length} · 사망 ${mean(xs.map((r) => r.deaths)).toFixed(2)} · 루프 ${xs.filter((r) => r.loop).length} · 최다 ${Math.max(...xs.map((r) => r.deaths))}${sigs.length ? ` · 새 각인 ${mean(sigs).toFixed(2)}` : ''}`;
    };
    for (const [key, xs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const ranks = [...new Set(xs.map((r) => r.rank))].sort((a, b) => a - b);
        console.log(`규칙 ${key}: ${ruleCell(xs)}`);
        if (ranks.length > 1) for (const rank of ranks) console.log(`  단계 ${rank}: ${ruleCell(xs.filter((r) => r.rank === rank))}`);
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
        // 둘 다 Lv41에 닿은 짝만 — 구간 비중(H2)과 계승 때 정수 사다리 · 남은 정수.
        const late = pairs.filter(([b, r]) => b.lateShare !== null && r.lateShare !== null);
        if (late.length) {
            const lateCell = (key, scale = 1, digits = 2) => {
                const diffs = late.map(([b, r]) => (r[key] - b[key]) * scale);
                const se = stdErr(diffs);
                return `${key} ${(mean(late.map(([b]) => b[key])) * scale).toFixed(digits)}→${(mean(late.map(([, r]) => r[key])) * scale).toFixed(digits)} (z ${(se ? mean(diffs) / se : 0).toFixed(2)})`;
            };
            console.log(`  Lv41 닿은 짝 ${late.length}: ${[lateCell('lateShare', 100, 1), lateCell('ladderRank', 1, 0), lateCell('essence', 1, 0)].join(' · ')}`);
        }
    }
    // 같은 경로 · 시드 · 회차 · 단계에서 같은 거절 가능한 카드를 만난 짝(받아들임 BASE_DIR ↔ 거절 DIR) — 첫 순환 미리보기 값. 2026-10 Wave 121.
    const rulePairs = new Map();
    for (const [key, row] of rows.entries()) {
        const b = base.get(key);
        if (!b || !row.ruleId || !b.ruleOptional || b.ruleId !== row.ruleId || b.rank !== row.rank) continue;
        const group = `${row.ruleId} · 단계 ${row.rank}`;
        rulePairs.set(group, [...(rulePairs.get(group) || []), [b, row]]);
    }
    for (const [group, pairs] of [...rulePairs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const cell = (key) => {
            const valid = pairs.filter(([b, r]) => b[key] !== null && r[key] !== null);
            const diffs = valid.map(([b, r]) => r[key] - b[key]);
            const se = stdErr(diffs);
            return `${key} ${mean(valid.map(([b]) => b[key])).toFixed(2)}→${mean(valid.map(([, r]) => r[key])).toFixed(2)} (z ${(se ? mean(diffs) / se : 0).toFixed(2)})`;
        };
        console.log(`규칙 ${group} (짝 ${pairs.length}): ${['deaths', 'loop', 'newSignatures'].map(cell).join(' · ')}`);
    }
}
