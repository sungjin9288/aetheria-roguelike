import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getRunSummaryAnalysis } from '../src/utils/outcomeAnalysis.js';

/**
 * cycle 97: maxKillStreak reflection 마무리 — RunSummaryCard chip + focus advice.
 *
 * cycle 95(데이터/보상) + 96(StatsPanel/RunSummary/share)에 이어,
 * cycle 86(escape/discovery chip) + cycle 87(focus advice) 패턴을 따라
 * 시각 카드 + actionable 어드바이스까지 닫는다.
 *
 * 추가:
 * - RunSummaryCard run-summary-extras 섹션에 streak chip
 *   (data-testid="run-summary-streak", Flame / red 톤, maxKillStreak > 0 조건부)
 * - getRunSummaryAnalysis focus advice:
 *   - maxKillStreak >= 10 → "공격형 운영 — 연속 처치를 유지해 streak 보너스를 끌어내고 있습니다."
 *   - maxKillStreak < 3 AND level >= 10 → "연속 처치가 끊기는 흐름. 빌드 강화 + 안전한 적부터 정리해 streak를 쌓아보세요."
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('RunSummaryCard: run-summary-streak testid 노출', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.match(source, /data-testid\s*=\s*["']run-summary-streak["']/);
});

test('RunSummaryCard: extras 섹션 조건에 maxKillStreak 포함', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    // (escapes > 0 || discoveries > 0 || maxKillStreak > 0) 조건
    const idx = source.indexOf('run-summary-extras');
    assert.ok(idx > -1);
    const window = source.slice(Math.max(0, idx - 600), idx);
    assert.match(window, /maxKillStreak/);
});

test('RunSummaryCard: 기존 escape/discovery chip 회귀 보존', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.match(source, /data-testid\s*=\s*["']run-summary-escape["']/);
    assert.match(source, /data-testid\s*=\s*["']run-summary-discovery["']/);
});

test('focus advice: maxKillStreak >= 10 → 공격형 칭찬', () => {
    const summary = {
        level: 20, kills: 200, bossKills: 2, relicsFound: 4, totalGold: 10000,
        primaryBuild: '검사 직선', difficultyLabel: 'NORMAL',
        escapes: 0, discoveries: 0, maxKillStreak: 12,
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(
        result.focus.some((line) => /연속 처치|streak|공격형 운영/.test(line)),
        'should compliment offensive streak play'
    );
});

test('focus advice: maxKillStreak < 3 AND level >= 10 → streak 활용 권장', () => {
    const summary = {
        level: 15, kills: 80, bossKills: 1, relicsFound: 3, totalGold: 4000,
        primaryBuild: '균형형', difficultyLabel: 'NORMAL',
        escapes: 0, discoveries: 0, maxKillStreak: 2,
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(
        result.focus.some((line) => /streak|연속 처치/.test(line)),
        'should advise on building streak'
    );
});

test('focus advice: maxKillStreak == 0 OR level 낮음 → silent (조건 미충족)', () => {
    const summary = {
        level: 8, kills: 20, bossKills: 0, relicsFound: 0, totalGold: 200,
        primaryBuild: '균형', difficultyLabel: 'EASY',
        escapes: 0, discoveries: 0, maxKillStreak: 2,
    };
    const result = getRunSummaryAnalysis(summary);
    // level < 10 → 권장 라인 미발생
    assert.ok(
        !result.focus.some((line) => /연속 처치|streak/.test(line)),
        'should be silent at low level even if streak is low'
    );
});
