// 2026-11 E7(소유자 결정 "계승 · 심연 · 레벨 + rules 배포") — 명예의 전당은 평생 처치 수(시간 보상)가 아니라
// 계승 단계 → 혼돈의 심연 최고 기록 → 회차 최고 레벨 순서다.
//
// 정렬은 한 숫자 `rankScore`(계승 × 10⁸ + 심연 × 10³ + 레벨)다 — 세 필드 orderBy는 복합 색인이 필요하고 파이프라인은 rules만
// 배포한다. 이 파일은 (1) 합성이 사전식 순서를 지키고 상한이 rules와 같다 (2) 점수는 사망으로 줄지 않는다(회차 최고 레벨)
// (3) 보내는 문서 · 같은 값 건너뛰기(D35) (4) "내 순위" 한 줄의 있음 · 없음 렌더를 잡는다. rules 실행은
// `tests/firestore-rules-semantics.test.js`(에뮬레이터)가 맡는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';

import { CONSTANTS } from '../src/data/constants.ts';
import { MSG } from '../src/data/messages.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import {
    encodeLeaderboardScore,
    getLeaderboardRecord,
    isLeaderboardEligible,
    LEADERBOARD_MAX_SCORE,
} from '../src/utils/leaderboardScore.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { buildLeaderboardEntry, getLeaderboardEntryKey } from '../src/hooks/createCloudAutosave.ts';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import LeaderboardRankLine from '../src/components/LeaderboardRankLine.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import SystemLeaderboard from '../src/components/tabs/system/SystemLeaderboard.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const base = makePlayerFixture();
const playerWith = ({ rank = 0, abyss = 0, level = 1, cycleBest = null, kills = 10, name = '시험용사' } = {}) => makePlayerFixture({
    name,
    level,
    meta: { ...base.meta, prestigeRank: rank, ...(cycleBest ? { cycleBestLevel: { rank, level: cycleBest } } : {}) },
    stats: { ...base.stats, kills, abyssRecord: abyss },
});
const scoreOf = (player) => encodeLeaderboardScore(getLeaderboardRecord(player));

test('점수는 계승 → 심연 → 레벨의 사전식 순서다 — 앞 칸 하나가 뒤 칸 최대를 이긴다', () => {
    const maxTail = scoreOf(playerWith({ rank: 1, abyss: CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD, level: CONSTANTS.LEADERBOARD_MAX_LEVEL }));
    assert.ok(scoreOf(playerWith({ rank: 2, abyss: 0, level: 1 })) > maxTail, '계승 한 단계가 심연 · 레벨 최대를 이긴다');
    assert.ok(
        scoreOf(playerWith({ rank: 0, abyss: 1, level: 1 })) > scoreOf(playerWith({ rank: 0, abyss: 0, level: CONSTANTS.LEADERBOARD_MAX_LEVEL })),
        '심연 한 층이 레벨 최대를 이긴다',
    );
    assert.equal(scoreOf(playerWith({ rank: 3, abyss: 45, level: 50 })), 3 * 100_000_000 + 45 * 1000 + 50);
});

test('상한으로 자르고, 최대 점수는 안전한 정수이며 rules의 리터럴과 같다', async () => {
    const huge = getLeaderboardRecord(playerWith({ rank: 50_000, abyss: 10_000_000, level: 5_000 }));
    assert.deepEqual(huge, {
        prestigeRank: CONSTANTS.LEADERBOARD_MAX_PRESTIGE_RANK,
        abyssRecord: CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD,
        bestLevel: CONSTANTS.LEADERBOARD_MAX_LEVEL,
    });
    assert.equal(encodeLeaderboardScore(huge), LEADERBOARD_MAX_SCORE);
    assert.ok(Number.isSafeInteger(LEADERBOARD_MAX_SCORE));
    const broken = getLeaderboardRecord(makePlayerFixture({ level: Number.NaN, meta: { prestigeRank: -3 }, stats: { abyssRecord: 'x' } }));
    assert.deepEqual(broken, { prestigeRank: 0, abyssRecord: 0, bestLevel: 1 });

    // rules의 상한 · 합성 계수는 CONSTANTS의 사본이다 — 한쪽만 바뀌면 새 클라이언트의 쓰기가 거부된다.
    const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    assert.match(rules, new RegExp(`'prestigeRank', 0, ${CONSTANTS.LEADERBOARD_MAX_PRESTIGE_RANK}\\)`));
    assert.match(rules, new RegExp(`'abyssRecord', 0, ${CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD}\\)`));
    assert.match(rules, new RegExp(`'bestLevel', 1, ${CONSTANTS.LEADERBOARD_MAX_LEVEL}\\)`));
    assert.match(rules, new RegExp(`'rankScore', 0, ${LEADERBOARD_MAX_SCORE}\\)`));
    const levelSlot = CONSTANTS.LEADERBOARD_MAX_LEVEL + 1;
    assert.match(rules, new RegExp(`prestigeRank \\* ${(CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD + 1) * levelSlot} \\+ next\\.abyssRecord \\* ${levelSlot} \\+ next\\.bestLevel`));
    assert.match(rules, new RegExp(`totalKills <= ${CONSTANTS.LEADERBOARD_MAX_TOTAL_KILLS}\\b`));
});

test('회차 최고 레벨 = 이번 회차에 끝낸 여정의 최고 레벨과 지금 레벨 중 큰 값 — 다른 단계의 기록은 읽지 않는다', () => {
    assert.equal(getLeaderboardRecord(playerWith({ rank: 1, level: 8, cycleBest: 41 })).bestLevel, 41);
    assert.equal(getLeaderboardRecord(playerWith({ rank: 1, level: 44, cycleBest: 41 })).bestLevel, 44);
    const staleRecord = makePlayerFixture({ level: 5, meta: { prestigeRank: 2, cycleBestLevel: { rank: 1, level: 47 } } });
    assert.equal(getLeaderboardRecord(staleRecord).bestLevel, 5, '앞 회차의 기록은 지금 회차의 최고가 아니다');
});

test('사망해도 점수는 줄지 않는다 — 실제 사망 전이(pickPermanentPlayerState death) 뒤 레벨 1에서도 같은 점수', () => {
    const before = playerWith({ rank: 1, abyss: 12, level: 38 });
    const after = { ...INITIAL_STATE.player, ...pickPermanentPlayerState(before, INITIAL_STATE.player, 'death'), name: before.name };
    assert.equal(after.level, 1, '전제: 새 여정은 레벨 1');
    assert.equal(after.stats.abyssRecord, 12, '전제: 심연 기록은 계정 범위');
    assert.equal(scoreOf(after), scoreOf(before));
});

test('계승해도 점수는 줄지 않는다 — 회차 최고 레벨은 지워지지만 계승 단계가 앞 칸이다', () => {
    const before = playerWith({ rank: 1, abyss: 12, level: 50, cycleBest: 49 });
    const ascended = playerWith({ rank: 2, abyss: 12, level: 1 });
    assert.ok(scoreOf(ascended) > scoreOf(before));
});

test('보내는 문서: 세 원래 값 + 점수, 평생 처치 수는 rules 상한으로 자른다 — 같은 값이면 같은 키(D35)', () => {
    const player = playerWith({ rank: 2, abyss: 35, level: 12, cycleBest: 47, kills: 2_000_000 });
    const entry = buildLeaderboardEntry(player, 'uid-1');
    assert.equal(entry.totalKills, CONSTANTS.LEADERBOARD_MAX_TOTAL_KILLS);
    assert.deepEqual(
        { prestigeRank: entry.prestigeRank, abyssRecord: entry.abyssRecord, bestLevel: entry.bestLevel, rankScore: entry.rankScore, level: entry.level },
        { prestigeRank: 2, abyssRecord: 35, bestLevel: 47, rankScore: 200_035_047, level: 12 },
    );
    assert.equal(getLeaderboardEntryKey(buildLeaderboardEntry(structuredClone(player), 'uid-1')), getLeaderboardEntryKey(entry));
    const deeper = playerWith({ rank: 2, abyss: 36, level: 12, cycleBest: 47, kills: 2_000_000 });
    assert.notEqual(getLeaderboardEntryKey(buildLeaderboardEntry(deeper, 'uid-1')), getLeaderboardEntryKey(entry));
});

test('순위표에 오르는 조건은 이름 + 처치 1 이상이다', () => {
    assert.equal(isLeaderboardEligible(playerWith({ kills: 1 })), true);
    assert.equal(isLeaderboardEligible(playerWith({ kills: 0 })), false);
    assert.equal(isLeaderboardEligible(playerWith({ name: '' })), false);
    assert.equal(isLeaderboardEligible(null), false);
});

test('내 순위 한 줄: 순위가 있으면 그리고, 없으면(오프라인 · 읽기 전) 아무것도 그리지 않는다', () => {
    const html = renderStatic(createElement(LeaderboardRankLine, { rank: 3, testId: 'rank-line' }));
    assert.ok(html.includes('data-testid="rank-line"'));
    assert.ok(html.includes(MSG.LEADERBOARD_MY_RANK(3)));
    assert.ok(html.includes('text-[11px]'), '11px 하한');
    assert.doesNotMatch(html, /truncate|line-clamp/u, '말줄임 없이 줄을 넘긴다');
    for (const rank of [null, 0, Number.NaN]) {
        assert.equal(renderStatic(createElement(LeaderboardRankLine, { rank, testId: 'rank-line' })), '');
    }
});

test('사망 화면: 순위를 받으면 줄을 그리고, 받지 못하면 줄이 없다', () => {
    const player = playerWith({ rank: 1, abyss: 3, level: 20 });
    const runSummary = buildRunSummary(player, player.loc);
    const withRank = renderStatic(createElement(RunSummaryCard, { runSummary, onRestart: () => {}, leaderboardRank: 12 }));
    assert.ok(withRank.includes('data-testid="run-summary-leaderboard-rank"'));
    assert.ok(withRank.includes(MSG.LEADERBOARD_MY_RANK(12)));
    const without = renderStatic(createElement(RunSummaryCard, { runSummary, onRestart: () => {} }));
    assert.ok(!without.includes('run-summary-leaderboard-rank'));
});

test('계승 화면: Firebase 없는 실행(테스트 · e2e와 같은 조건)에서는 순위 줄이 없다', () => {
    const player = playerWith({ rank: 1, abyss: 3, level: 50 });
    const html = renderStatic(createElement(AscensionScreen, { player }));
    assert.ok(html.includes('data-testid="ascension-screen"'));
    assert.ok(!html.includes('ascension-leaderboard-rank'));
});

test('명예의 전당 목록은 계승 · 심연 · 최고 레벨을 그리고, 내 줄은 uid로 찾는다', () => {
    const entries = [
        { nickname: '같은이름', uid: 'other', prestigeRank: 3, abyssRecord: 45, bestLevel: 50, rankScore: 300_045_050 },
        { nickname: '같은이름', uid: 'me', prestigeRank: 0, abyssRecord: 0, bestLevel: 12, rankScore: 12 },
        { nickname: '이전문서', uid: 'legacy', prestigeRank: 1, level: 30 },
    ];
    const html = renderStatic(createElement(SystemLeaderboard, { entries, playerName: '같은이름', uid: 'me' }));
    assert.ok(html.includes(MSG.SYSTEM_LEADERBOARD_RANK(3)));
    assert.ok(html.includes(MSG.SYSTEM_LEADERBOARD_ABYSS(45)));
    assert.ok(html.includes(MSG.SYSTEM_LEADERBOARD_BEST_LEVEL(50)));
    assert.ok(html.includes(MSG.SYSTEM_LEADERBOARD_BEST_LEVEL(30)), '최고 레벨이 없는 이전 문서는 레벨을 그린다');
    assert.equal(html.split(`>${MSG.SYSTEM_LEADERBOARD_ME}<`).length - 1, 1, '같은 이름이어도 내 줄은 하나');
    assert.equal(html.split(MSG.SYSTEM_LEADERBOARD_ABYSS(0)).length - 1, 0, '심연 기록 0은 그리지 않는다');
});
