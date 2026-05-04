import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildRunSummary } from '../src/utils/gameUtils.js';
import { buildRunShareText } from '../src/utils/runShareText.js';

/**
 * cycle 96: maxKillStreak feedback chain — StatsPanel / RunSummary / share 표면 통합.
 *
 * cycle 95에서 stats.maxKillStreak 누적 + ach_streak_5/10/20 + berserker 칭호를
 * 깔았다. 이번 사이클은 cycle 78/80/84/86 패턴을 따라 시각/공유 표면에도 노출:
 *
 *   1. StatsPanel: MAX STREAK row (Flame / red-400, killStreak 시스템 톤과 매치)
 *   2. buildRunSummary: maxKillStreak 필드 (reflection 단계에서 사용 가능)
 *   3. buildRunShareText: max-streak > 0이면 "🔥 최대 N연속 처치" 라인
 *      (silence-over-noise — 0이면 출력 안 함)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('StatsPanel: MAX STREAK row 노출', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.match(
        source,
        /label:\s*['"]MAX STREAK['"]/,
        'StatsPanel should expose MAX STREAK row'
    );
});

test('buildRunSummary: maxKillStreak 노출', () => {
    const player = {
        level: 30, job: '검사',
        stats: {
            kills: 200, deaths: 0, total_gold: 5000,
            maxKillStreak: 18,
        },
        equip: {}, inv: [], relics: [],
    };
    const summary = buildRunSummary(player, '심연');
    assert.equal(summary.maxKillStreak, 18);
});

test('buildRunSummary: maxKillStreak 누락 → 0', () => {
    const player = {
        level: 1, job: '모험가',
        stats: { kills: 0, deaths: 0, total_gold: 0 },
        equip: {}, inv: [], relics: [],
    };
    const summary = buildRunSummary(player, '시작의 마을');
    assert.equal(summary.maxKillStreak, 0);
});

test('buildRunShareText: maxKillStreak > 0 → 연속 처치 라인 노출', () => {
    const summary = {
        job: '검사', level: 30, loc: '심연', kills: 200, bossKills: 3,
        relicsFound: 2, totalGold: 50000, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 0, discoveries: 0, maxKillStreak: 22,
    };
    const text = buildRunShareText(summary);
    assert.match(text, /🔥.*22.*연속/, 'should include max-streak line with count');
});

test('buildRunShareText: maxKillStreak == 0 → silent (cycle 78 escape 패턴)', () => {
    const summary = {
        job: '검사', level: 5, loc: '평원', kills: 5, bossKills: 0,
        relicsFound: 0, totalGold: 100, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 0, discoveries: 0, maxKillStreak: 0,
    };
    const text = buildRunShareText(summary);
    assert.doesNotMatch(text, /연속 처치/, 'silent when maxKillStreak == 0');
});

test('buildRunShareText: 기존 escape/discovery 라인 회귀 보존', () => {
    const summary = {
        job: '검사', level: 10, loc: '평원', kills: 50, bossKills: 1,
        relicsFound: 1, totalGold: 1000, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 7, discoveries: 8, maxKillStreak: 0,
    };
    const text = buildRunShareText(summary);
    assert.match(text, /🏃 도주 7회/);
    assert.match(text, /🗺️ 지도 발견 8곳/);
});
