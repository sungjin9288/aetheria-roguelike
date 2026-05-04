import test from 'node:test';
import assert from 'node:assert/strict';

import { getRunSummaryAnalysis } from '../src/utils/outcomeAnalysis.js';

/**
 * cycle 87: getRunSummaryAnalysis 반성(focus) 어드바이스에 escape/discovery 시그널
 * 통합.
 *
 * 배경:
 * - cycle 78/84에서 escapes/discoveries를 RunSummary에 노출, cycle 86에서
 *   시각 chip까지 추가했으나 actionable focus 어드바이스 (RunSummaryCard
 *   "Run Readout" 박스)는 두 시그널을 무시하고 있었음.
 * - "런이 끝났을 때 무엇을 배워야 하나?"가 reflection의 핵심인데, 도주가
 *   많거나 탐험이 좁았다는 사실을 다음 런 전략에 연결해주는 advice가 비어
 *   있어 reflection의 가치가 일부 누락된 상태.
 *
 * 추가 advice:
 *   - escapes >= 10 AND bossKills <= 1 → "도주가 많았고 보스 진입이 적었습니다.
 *     빌드 강화 후 보스 도전을 권장합니다."
 *   - discoveries <= 4 AND level >= 12 → "맵 발견이 적었습니다. 새 지역을 더
 *     탐색해 유물/이벤트 풀을 넓히세요."
 *   - discoveries >= 15 → 칭찬 라인 "탐험 폭이 넓었습니다. 같은 호기심으로
 *     다음 런도 시작하세요."
 *
 * 모든 advice는 silence-over-noise: 조건 미충족 시 추가 안 됨.
 * focus는 .slice(0, 3) cap을 유지하므로 기존 라인을 밀어내지 않음.
 */

test('escapes 많고 bossKills 적음 → 도주 advice 추가', () => {
    const summary = {
        level: 18, kills: 200, bossKills: 0, relicsFound: 4, totalGold: 8000,
        primaryBuild: '초반 균형', difficultyLabel: 'NORMAL',
        recentWinRate: 60,
        escapes: 12, discoveries: 8,
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(
        result.focus.some((line) => /도주.*보스/.test(line)),
        'should advise on high-escape low-boss pattern'
    );
});

test('discoveries 적고 레벨 높음 → 탐험 권장 advice', () => {
    const summary = {
        level: 20, kills: 300, bossKills: 2, relicsFound: 5, totalGold: 12000,
        primaryBuild: '검사 중심', difficultyLabel: 'HARD',
        escapes: 0, discoveries: 3,
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(
        result.focus.some((line) => /맵 발견|탐색/.test(line)),
        'should advise on low-discovery high-level pattern'
    );
});

test('discoveries 많음 → 탐험 칭찬 advice', () => {
    const summary = {
        level: 25, kills: 400, bossKills: 3, relicsFound: 6, totalGold: 20000,
        primaryBuild: '탐험형', difficultyLabel: 'NORMAL',
        escapes: 0, discoveries: 18,
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(
        result.focus.some((line) => /탐험 폭|호기심/.test(line)),
        'should compliment broad exploration'
    );
});

test('escapes/discoveries 모두 0 → 새 advice 추가 안 됨 (silence)', () => {
    const summary = {
        level: 10, kills: 100, bossKills: 1, relicsFound: 3, totalGold: 5000,
        primaryBuild: '균형', difficultyLabel: 'EASY',
        escapes: 0, discoveries: 0,
    };
    const result = getRunSummaryAnalysis(summary);
    // 신규 cycle 87 advice 라인 모두 부재
    assert.ok(!result.focus.some((line) => /도주.*보스/.test(line)));
    assert.ok(!result.focus.some((line) => /맵 발견|탐색|탐험 폭|호기심/.test(line)));
});

test('focus는 최대 3개 cap 유지 (회귀)', () => {
    // 모든 시그널 동시 충족 케이스 — 기존 4개 + 신규 2개 = 6개 후보지만 3개 cap
    const summary = {
        level: 15, kills: 20, bossKills: 0, relicsFound: 0, totalGold: 1000,
        primaryBuild: '균형', difficultyLabel: 'EASY',
        escapes: 15, discoveries: 2, // 도주 advice + 탐험 권장 advice
    };
    const result = getRunSummaryAnalysis(summary);
    assert.ok(result.focus.length <= 3, `focus should be capped at 3, got ${result.focus.length}`);
});
