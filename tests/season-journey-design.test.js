import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.ts';
import {
    FIRST_SEASON,
    getSeasonDef,
    getSeasonRewards,
    getSeasonRewardScale,
    parseSeasonOrdinal,
    SEASON_REGISTRY,
    SEASON_REWARDS,
    SEASON_XP,
} from '../src/data/seasonPass.js';
import { MSG } from '../src/data/messages.ts';
import { checkTitles } from '../src/utils/gameUtils.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { rewardActionMap } from '../src/reducers/handlers/rewardHandlers.js';
import SeasonPassPanel from '../src/components/tabs/SeasonPassPanel.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';
import {
    advanceSeasonIfComplete,
    buildSeasonChapters,
    createSeasonPassState,
    formatSeasonRewardParts,
    getActiveSeason,
    getActiveSeasonRewards,
    getClaimableSeasonRewards,
    getCompletedSeasonCount,
    getNextSeasonRewards,
    getSeasonArchive,
    getSeasonClaimsRemaining,
    getSeasonProgress,
    isSeasonComplete,
    normalizeClaimedSeasonTiers,
    resolveSeasonOrdinal,
    SEASON_MAX_TIER,
    SEASON_MAX_XP,
} from '../src/utils/seasonPassPresentation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const makeState = ({ tier = 3, xp = 650, claimed = [1, 2], isPremium = false } = {}) => ({
    player: {
        gold: 100,
        premiumCurrency: 0,
        inv: [],
        titles: [],
        seasonPass: { tier, xp, claimed, isPremium, seasonId: 'S1' },
    },
    logs: [],
    syncStatus: 'synced',
});

test('30개 시즌 보상은 누락 없이 10단계씩 세 구간으로 묶인다', () => {
    const chapters = buildSeasonChapters(SEASON_REWARDS);

    assert.equal(chapters.length, 3);
    assert.deepEqual(chapters.map((chapter) => chapter.rewards.length), [10, 10, 10]);
    assert.deepEqual(chapters.flatMap((chapter) => chapter.rewards.map((row) => row.tier)),
        Array.from({ length: 30 }, (_, index) => index + 1));
});

test('시즌 진행은 가까운 보상과 받을 보상을 분리한다', () => {
    assert.deepEqual(getClaimableSeasonRewards(SEASON_REWARDS, 3, [1, 2]).map((row) => row.tier), [3]);
    assert.deepEqual(getNextSeasonRewards(SEASON_REWARDS, 3).map((row) => row.tier), [4, 5, 6]);
    assert.deepEqual(formatSeasonRewardParts({ gold: 2000, title: '시즌 선구자' }), [
        '골드 2,000',
        '칭호 시즌 선구자',
    ]);
    assert.deepEqual(getSeasonProgress(650, 0), {
        tier: 3,
        totalXp: 650,
        currentXp: 50,
        remainingXp: 150,
        completed: false,
        percent: 25,
    });
});

test('이전 저장의 시즌 보상 식별자도 중복 수령으로 이어지지 않는다', () => {
    assert.deepEqual(normalizeClaimedSeasonTiers(['s1_t1', '2', 3, 'broken']), [1, 2, 3]);

    const state = makeState({ claimed: ['s1_t3'] });
    const replayed = rewardActionMap.CLAIM_SEASON_REWARD(state, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 3 },
    });
    assert.equal(replayed, state);
});

test('잠긴 시즌 보상은 reducer 권한 경계에서 거부된다', () => {
    const state = makeState();
    const lockedClaim = rewardActionMap.CLAIM_SEASON_REWARD(state, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 30 },
    });

    assert.equal(lockedClaim, state);
    assert.equal(lockedClaim.player.gold, 100);
});

test('해금된 시즌 보상은 한 번만 지급되고 기존 프리미엄 저장도 보존한다', () => {
    const freeState = makeState();
    const action = { type: AT.CLAIM_SEASON_REWARD, payload: { tier: 3 } };
    const claimed = rewardActionMap.CLAIM_SEASON_REWARD(freeState, action);
    const replayed = rewardActionMap.CLAIM_SEASON_REWARD(claimed, action);

    assert.equal(claimed.player.gold, 900);
    assert.deepEqual(claimed.player.seasonPass.claimed, [1, 2, 3]);
    assert.deepEqual(claimed.logs.map((log) => log.text), ['시즌 3단계 보상 · 골드 800']);
    assert.equal(replayed, claimed);

    const premiumState = makeState({ isPremium: true });
    const premiumClaimed = rewardActionMap.CLAIM_SEASON_REWARD(premiumState, action);
    assert.equal(premiumClaimed.player.gold, 900);
    assert.equal(premiumClaimed.player.premiumCurrency, 5);
    assert.deepEqual(premiumClaimed.logs.map((log) => log.text), [
        '시즌 3단계 보상 · 골드 800 · 에테르 크리스탈 5',
    ]);
});

test('시즌 경험은 양수만 반영하고 마지막 단계에서 고정된다', () => {
    const state = makeState({ tier: 29, xp: SEASON_MAX_XP - 10, claimed: [] });
    const invalid = rewardActionMap.ADD_SEASON_XP(state, { type: AT.ADD_SEASON_XP, payload: -50 });
    const completed = rewardActionMap.ADD_SEASON_XP(state, { type: AT.ADD_SEASON_XP, payload: 100 });
    const overflow = rewardActionMap.ADD_SEASON_XP(completed, { type: AT.ADD_SEASON_XP, payload: 100 });

    assert.equal(invalid, state);
    assert.equal(completed.player.seasonPass.xp, SEASON_MAX_XP);
    assert.equal(completed.player.seasonPass.tier, 30);
    assert.equal(overflow, completed);
    assert.deepEqual(getSeasonProgress(SEASON_MAX_XP + 500, 30), {
        tier: 30,
        totalXp: SEASON_MAX_XP,
        currentXp: 200,
        remainingXp: 0,
        completed: true,
        percent: 100,
    });
});

test('시즌 화면은 현재 진행과 세 구간 여정을 우선하고 가짜 프리미엄 안내를 제거한다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/tabs/SeasonPassPanel.tsx'), 'utf8');

    assert.match(source, /data-testid="season-journey-panel"/);
    assert.match(source, /data-testid="season-next-rewards"/);
    assert.match(source, /season-chapter-\$\{chapter\.id\}/);
    assert.match(source, /<details/);
    assert.doesNotMatch(source, /text-\[(?:8|9|10)px\]|max-h-\[360px\]|overflow-y-auto/);
    assert.doesNotMatch(source, /SEASON PASS|PREMIUM|FREE|추후 업데이트 예정/);
});

// ─── Wave 12 D2: 완주 기반 시즌 회전 ────────────────────────────────────────
//
// 이 블록이 고정하는 계약은 네 가지다.
//   (1) 시즌 1의 보상은 한 값도 바뀌지 않는다.
//   (2) 회전 트리거는 벽시계가 아니라 **마지막 티어 보상 수령**이다.
//   (3) `claimed`를 비우기 전에 아카이브로 옮기고, 티어 보상이 준 것은 아무것도 퇴행하지 않는다.
//   (4) 회전 뒤 적립이 다시 살아난다 — 상한에서 영구히 죽던 탭이 반복 루프가 된다.

/** 완주 직전(30티어 도달, 수령 0건) 상태. */
const makeMaxedState = ({ claimed = [], isPremium = false, seasonPass = {}, titles = [] } = {}) => ({
    player: {
        gold: 0,
        premiumCurrency: 0,
        inv: [],
        titles: [...titles],
        seasonPass: {
            xp: SEASON_MAX_XP,
            tier: SEASON_MAX_TIER,
            claimed,
            isPremium,
            seasonId: FIRST_SEASON.id,
            ...seasonPass,
        },
    },
    logs: [],
    syncStatus: 'synced',
});

/** 티어 1..30을 순서대로 수령해 시즌을 완주시킨다(회전은 마지막 수령에서 일어난다). */
const claimEveryTier = (state) => {
    let current = state;
    for (let tier = 1; tier <= SEASON_MAX_TIER; tier += 1) {
        current = rewardActionMap.CLAIM_SEASON_REWARD(current, {
            type: AT.CLAIM_SEASON_REWARD,
            payload: { tier },
        });
    }
    return current;
};

test('시즌 1의 보상 테이블은 회전 도입 이후에도 한 값도 바뀌지 않는다', () => {
    // 배율이 정확히 1이므로 스케일 경로를 아예 타지 않는다 — 참조 동일성이 그 증거다.
    assert.equal(getSeasonRewardScale(1), 1);
    assert.equal(getSeasonRewards(1), SEASON_REWARDS);
    assert.deepEqual(getSeasonRewards(FIRST_SEASON.ordinal), SEASON_REWARDS);
    assert.equal(getActiveSeasonRewards(createSeasonPassState()), SEASON_REWARDS);
    assert.equal(getActiveSeasonRewards({ seasonId: 'S1' }), SEASON_REWARDS);
});

test('시즌 레지스트리는 식별자·서수·보상 배율을 데이터로 갖고, 표를 넘어가면 파생된다', () => {
    assert.equal(FIRST_SEASON.id, 'S1');
    assert.deepEqual(SEASON_REGISTRY.map((season) => season.ordinal), [1, 2, 3, 4, 5, 6]);

    assert.deepEqual(getSeasonDef(2), { id: 'S2', ordinal: 2, rewardScale: getSeasonRewardScale(2) });
    // 레지스트리 밖 서수도 사다리가 끊기지 않는다(회전은 무한히 이어진다).
    assert.deepEqual(getSeasonDef(9), { id: 'S9', ordinal: 9, rewardScale: BALANCE.SEASON_REWARD_SCALE_MAX });

    // 구세이브의 문자열 식별자도 같은 규칙으로 읽힌다.
    assert.equal(parseSeasonOrdinal('S1'), 1);
    assert.equal(parseSeasonOrdinal('S12'), 12);
    assert.equal(parseSeasonOrdinal('올드시즌'), null);
    assert.equal(resolveSeasonOrdinal({ seasonId: 'S1' }), 1);
    assert.equal(resolveSeasonOrdinal({ seasonId: '깨진값' }), 1);
    assert.equal(resolveSeasonOrdinal(undefined), 1);
    // 저장된 ordinal이 seasonId보다 우선한다.
    assert.equal(resolveSeasonOrdinal({ seasonId: 'S1', ordinal: 4 }), 4);
});

test('보상 스케일은 BALANCE에서 나오고 숫자 보상에만 걸린다 (아이템·칭호는 시즌 불변)', () => {
    const expected = Math.round(BALANCE.SEASON_REWARD_SCALE_PER_SEASON * 100) / 100;
    assert.equal(getSeasonRewardScale(2), expected);

    const s1 = SEASON_REWARDS.find((row) => row.tier === 1);
    const s2 = getSeasonRewards(2).find((row) => row.tier === 1);
    assert.equal(s2.free.gold, Math.round(s1.free.gold * expected));
    assert.equal(s2.premium.gold, Math.round(s1.premium.gold * expected));

    // 문자열 보상(아이템/칭호)은 그대로 — 시즌마다 새 문자열을 만들지 않는다.
    const s1Title = SEASON_REWARDS.find((row) => row.tier === 30);
    const s3Title = getSeasonRewards(3).find((row) => row.tier === 30);
    assert.equal(s3Title.free.title, s1Title.free.title);
    assert.equal(getSeasonRewards(2).find((row) => row.tier === 2).free.item,
        SEASON_REWARDS.find((row) => row.tier === 2).free.item);

    // 상한이 인플레를 자른다.
    assert.equal(getSeasonRewardScale(50), BALANCE.SEASON_REWARD_SCALE_MAX);
    assert.equal(getSeasonRewards(50).find((row) => row.tier === 1).free.gold,
        s1.free.gold * BALANCE.SEASON_REWARD_SCALE_MAX);

    // 티어 수와 순서는 시즌이 바뀌어도 동일하다.
    assert.deepEqual(getSeasonRewards(3).map((row) => row.tier), SEASON_REWARDS.map((row) => row.tier));
});

test('회전 트리거는 XP 상한이 아니라 완주(30단계 전부 수령)다', () => {
    // 상한에 닿아도 수령 전에는 회전하지 않는다 — 회전시키면 미수령 보상이 통째로 증발한다.
    const maxed = makeMaxedState();
    assert.equal(isSeasonComplete(maxed.player.seasonPass), false);
    assert.equal(getSeasonClaimsRemaining(maxed.player.seasonPass), SEASON_MAX_TIER);
    assert.equal(advanceSeasonIfComplete(maxed.player.seasonPass), null);
    assert.equal(
        getClaimableSeasonRewards(SEASON_REWARDS, SEASON_MAX_TIER, maxed.player.seasonPass.claimed).length,
        SEASON_MAX_TIER,
    );

    // 29개까지 받아도 아직 시즌 1이다.
    const almost = makeMaxedState({ claimed: Array.from({ length: 29 }, (_, i) => i + 1) });
    assert.equal(getSeasonClaimsRemaining(almost.player.seasonPass), 1);
    assert.equal(almost.player.seasonPass.seasonId, 'S1');
    const last = rewardActionMap.CLAIM_SEASON_REWARD(almost, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 30 },
    });
    // 마지막 한 장이 회전을 연다.
    assert.equal(last.player.seasonPass.seasonId, 'S2');
});

test('완주 회전은 xp/tier/claimed만 리셋하고 직전 시즌 수령 기록을 아카이브에 남긴다', () => {
    const completed = claimEveryTier(makeMaxedState());
    const sp = completed.player.seasonPass;

    assert.equal(sp.seasonId, 'S2');
    assert.equal(sp.ordinal, 2);
    assert.equal(sp.xp, 0);
    assert.equal(sp.tier, 0);
    assert.deepEqual(sp.claimed, []);
    assert.equal(sp.completedSeasons, 1);
    assert.equal(getCompletedSeasonCount(sp), 1);

    // 아카이브는 비우기 직전의 claimed를 통째로 들고 있다 — 기록 손실 0.
    const archive = getSeasonArchive(sp);
    assert.equal(archive.length, 1);
    assert.deepEqual(archive[0], {
        seasonId: 'S1',
        ordinal: 1,
        tier: SEASON_MAX_TIER,
        xp: SEASON_MAX_XP,
        claimed: Array.from({ length: SEASON_MAX_TIER }, (_, i) => i + 1),
    });
    // 아카이브에 벽시계가 섞이지 않는다(Wave 11 C2가 제거한 비결정론 재유입 금지).
    assert.deepEqual(Object.keys(archive[0]).sort(), ['claimed', 'ordinal', 'seasonId', 'tier', 'xp']);

    // isPremium 같은 그 밖의 필드는 회전을 그대로 통과한다.
    const premium = claimEveryTier(makeMaxedState({ isPremium: true }));
    assert.equal(premium.player.seasonPass.isPremium, true);
});

test('회전을 넘어 티어 보상이 준 것은 아무것도 퇴행하지 않는다', () => {
    const before = makeMaxedState();
    const after = claimEveryTier(before);

    // 지급분(골드/아이템/칭호)은 회전 뒤에도 그대로 플레이어에 남는다.
    const expectedGold = SEASON_REWARDS.reduce((sum, row) => sum + (row.free.gold || 0), 0);
    const expectedItems = SEASON_REWARDS.filter((row) => row.free.item).length;
    assert.equal(after.player.gold, expectedGold);
    assert.equal(after.player.inv.length, expectedItems);
    assert.ok(after.player.gold > before.player.gold);

    // 티어 보상 칭호 3종이 전부 남아 있다.
    ['시즌 선구자', '시즌 정복자', '시즌 마스터'].forEach((title) => {
        assert.ok(after.player.titles.includes(title), `${title} 퇴행`);
    });

    // 수령 기록 자체도 사라지지 않는다 — 아카이브가 전량 보존한다.
    const archivedClaims = getSeasonArchive(after.player.seasonPass)
        .flatMap((entry) => entry.claimed);
    assert.deepEqual(
        normalizeClaimedSeasonTiers(archivedClaims),
        SEASON_REWARDS.map((row) => row.tier),
    );
});

test('회전 직전에 칭호 복구 폴백을 한 번 돌린다 — tier 리셋이 seasonTier 칭호를 삼키지 않는다', () => {
    // 칭호 목록이 비어 있는 복구 케이스(cycle 201이 seasonTier 폴백을 만든 바로 그 상황).
    // 29개를 이미 수령한 상태라 남은 직접 지급은 30단계의 '시즌 마스터' 하나뿐이고,
    // 10/20단계 칭호는 checkTitles(seasonPass.tier >= val)로만 되찾을 수 있다.
    const state = makeMaxedState({ claimed: Array.from({ length: 29 }, (_, i) => i + 1), titles: [] });
    assert.deepEqual(state.player.titles, []);

    const rotated = rewardActionMap.CLAIM_SEASON_REWARD(state, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 30 },
    });

    assert.equal(rotated.player.seasonPass.tier, 0, '회전 후 tier는 0으로 리셋된다');
    ['시즌 선구자', '시즌 정복자', '시즌 마스터'].forEach((title) => {
        assert.ok(rotated.player.titles.includes(title), `${title}가 리셋에 삼켜졌다`);
    });
    // 리셋 후에는 폴백이 더 이상 이 칭호들을 짚어낼 수 없다 — 그래서 리셋 "직전"이어야 한다.
    assert.deepEqual(
        checkTitles({ ...rotated.player, titles: [] }).filter((id) => id.startsWith('시즌 ')),
        [],
    );
});

test('회전 뒤 시즌 적립이 다시 살아난다 (상한에서 죽던 탭이 반복 루프가 된다)', () => {
    const completed = claimEveryTier(makeMaxedState());
    assert.equal(completed.player.seasonPass.xp, 0);

    const earned = rewardActionMap.ADD_SEASON_XP(completed, {
        type: AT.ADD_SEASON_XP,
        payload: SEASON_XP.explore + SEASON_XP.kill,
    });
    assert.equal(earned.player.seasonPass.xp, SEASON_XP.explore + SEASON_XP.kill);
    assert.equal(earned.player.seasonPass.seasonId, 'S2');

    // 시즌 2의 보상은 시즌 1의 재탕이 아니다.
    const s2Row = getActiveSeasonRewards(earned.player.seasonPass).find((row) => row.tier === 1);
    assert.ok(s2Row.free.gold > SEASON_REWARDS.find((row) => row.tier === 1).free.gold);
});

test('적립량 계약은 이 트랙이 건드리지 않는다 (D1 진행 비용 모델 입력 보존)', () => {
    assert.deepEqual({ ...SEASON_XP }, {
        explore: 10,
        kill: 5,
        bossKill: 50,
        craft: 15,
        questComplete: 30,
        synthesize: 20,
        codexDiscover: 8,
    });
    assert.equal(SEASON_MAX_XP, SEASON_MAX_TIER * 200);
});

test('연속 완주는 아카이브를 쌓고 상한을 넘으면 최신 기록만 남기되 완주 횟수는 줄지 않는다', () => {
    // 2회 연속 완주 — 시즌 3까지.
    let state = claimEveryTier(makeMaxedState());
    state = claimEveryTier({
        ...state,
        player: {
            ...state.player,
            seasonPass: { ...state.player.seasonPass, xp: SEASON_MAX_XP, tier: SEASON_MAX_TIER },
        },
    });
    assert.equal(state.player.seasonPass.seasonId, 'S3');
    assert.deepEqual(getSeasonArchive(state.player.seasonPass).map((entry) => entry.seasonId), ['S1', 'S2']);
    assert.equal(state.player.seasonPass.completedSeasons, 2);

    // 보관 상한을 넘긴 세이브: 기록은 잘려도 완주 횟수는 별도 누적이라 감소하지 않는다.
    const longRunner = {
        ...createSeasonPassState(),
        xp: SEASON_MAX_XP,
        tier: SEASON_MAX_TIER,
        claimed: Array.from({ length: SEASON_MAX_TIER }, (_, i) => i + 1),
        ordinal: 20,
        seasonId: 'S20',
        completedSeasons: 19,
        archive: Array.from({ length: BALANCE.SEASON_ARCHIVE_LIMIT }, (_, i) => ({
            seasonId: `S${i + 7}`, ordinal: i + 7, tier: SEASON_MAX_TIER, xp: SEASON_MAX_XP, claimed: [1],
        })),
    };
    const rolled = advanceSeasonIfComplete(longRunner);
    assert.equal(rolled.seasonId, 'S21');
    assert.equal(rolled.archive.length, BALANCE.SEASON_ARCHIVE_LIMIT);
    assert.equal(rolled.archive.at(-1).seasonId, 'S20');
    assert.equal(rolled.completedSeasons, 20);
});

test('시즌 화면은 현재 시즌과 "완주하면 무엇이 열리는지"를 보여준다', () => {
    const fresh = renderStatic(createElement(SeasonPassPanel, {
        player: makePlayerFixture({ seasonPass: createSeasonPassState() }),
    }));
    assert.ok(fresh.includes(MSG.SEASON_NAME(1)), '현재 시즌 이름');
    assert.ok(fresh.includes(MSG.SEASON_ROTATION_TITLE), '회전 안내 제목');
    assert.ok(
        fresh.includes(MSG.SEASON_ROTATION_NOTICE(MSG.SEASON_NAME(2), '1.35')),
        '완주가 다음 시즌을 연다는 안내',
    );
    assert.ok(fresh.includes(MSG.SEASON_CLAIMS_REMAINING(SEASON_MAX_TIER)), '완주까지 남은 보상 수');
    assert.ok(fresh.includes(MSG.SEASON_ARCHIVE_EMPTY), '완주 기록 없음 안내');
    assert.ok(!fresh.includes('data-testid="season-scale-badge"'), '시즌 1에는 배율 배지가 없다');

    // 회전 이후: 시즌 이름·배율·아카이브가 모두 바뀐다.
    const rotated = claimEveryTier(makeMaxedState()).player.seasonPass;
    const later = renderStatic(createElement(SeasonPassPanel, {
        player: makePlayerFixture({ seasonPass: rotated }),
    }));
    assert.ok(later.includes(MSG.SEASON_NAME(2)), '회전 후 시즌 2 표기');
    assert.ok(later.includes('data-testid="season-scale-badge"'), '시즌 2 배율 배지 노출');
    assert.ok(later.includes(MSG.SEASON_SCALE_BADGE('1.35')), '시즌 2 보상 배율 표기');
    assert.ok(later.includes(MSG.SEASON_ARCHIVE_SUMMARY(1)), '완주 1회');
    assert.ok(
        later.includes(MSG.SEASON_ARCHIVE_ENTRY(MSG.SEASON_NAME(1), SEASON_MAX_TIER)),
        '지난 시즌 수령 기록',
    );
    // 시즌 2의 스케일된 골드가 실제로 화면에 실린다.
    const s2Tier1 = getActiveSeasonRewards(rotated).find((row) => row.tier === 1);
    assert.ok(later.includes(new Intl.NumberFormat('ko-KR').format(s2Tier1.free.gold)));
});

test('완주 로그는 어느 시즌이 끝났고 무엇이 열렸는지 남긴다', () => {
    const completed = claimEveryTier(makeMaxedState());
    const texts = completed.logs.map((log) => log.text);
    const nextSeason = getActiveSeason(completed.player.seasonPass);
    assert.equal(
        texts.at(-1),
        MSG.SEASON_ROTATED(MSG.SEASON_NAME(1), MSG.SEASON_NAME(2), '1.35'),
    );
    assert.equal(nextSeason.ordinal, 2);
    // 개별 수령 로그도 그대로 남는다.
    assert.ok(texts.some((text) => text.startsWith('시즌 30단계 보상 ·')));
});

test('구세이브(선택 필드 없음)도 시즌 1로 굴러 들어가고 회전 경로를 그대로 탄다', () => {
    const legacy = { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    assert.equal(resolveSeasonOrdinal(legacy), 1);
    assert.deepEqual(getSeasonArchive(legacy), []);
    assert.equal(getCompletedSeasonCount(legacy), 0);
    assert.equal(getActiveSeasonRewards(legacy), SEASON_REWARDS);
    assert.equal(advanceSeasonIfComplete(legacy), null);

    // 레거시 문자열 claimed('s1_t..')만 들고 있어도 완주 판정이 성립한다.
    const legacyClaimed = {
        ...legacy,
        xp: SEASON_MAX_XP,
        tier: SEASON_MAX_TIER,
        claimed: Array.from({ length: SEASON_MAX_TIER }, (_, i) => `s1_t${i + 1}`),
    };
    const rolled = advanceSeasonIfComplete(legacyClaimed);
    assert.equal(rolled.seasonId, 'S2');
    assert.deepEqual(rolled.archive[0].claimed, Array.from({ length: SEASON_MAX_TIER }, (_, i) => i + 1));
});

test('세 구간 여정은 시즌이 바뀌어도 10단계씩 유지된다', () => {
    const chapters = buildSeasonChapters(getSeasonRewards(4));
    assert.deepEqual(chapters.map((chapter) => chapter.rewards.length), [10, 10, 10]);
    assert.deepEqual(getNextSeasonRewards(getSeasonRewards(4), 3).map((row) => row.tier), [4, 5, 6]);
    assert.deepEqual(formatSeasonRewardParts(getSeasonRewards(4).find((row) => row.tier === 1).free), [
        `골드 ${new Intl.NumberFormat('ko-KR').format(getSeasonRewards(4)[0].free.gold)}`,
    ]);
    assert.equal(getSeasonProgress(0, 0).tier, 0);
});

test('손상된 아카이브는 읽는 경계에서 걸러진다 (UI가 세이브 모양을 신뢰하지 않는다)', () => {
    const corrupted = {
        ...createSeasonPassState(),
        completedSeasons: 3,
        archive: [
            null,
            'S2',
            { seasonId: 'S2', ordinal: 2 },
            { seasonId: 'S3', ordinal: 3, tier: 30, xp: 6000, claimed: [1, 2] },
        ],
    };
    assert.deepEqual(getSeasonArchive(corrupted).map((entry) => entry.seasonId), ['S3']);
    // 기록이 깨져도 완주 횟수는 별도 누적값이 지킨다.
    assert.equal(getCompletedSeasonCount(corrupted), 3);
    assert.deepEqual(getSeasonArchive({ ...createSeasonPassState(), archive: 'nope' }), []);

    // 그 상태로도 패널이 렌더된다(빈 목록으로 접히지 않고 온전한 항목만 실린다).
    const markup = renderStatic(createElement(SeasonPassPanel, {
        player: makePlayerFixture({ seasonPass: corrupted }),
    }));
    assert.ok(markup.includes(MSG.SEASON_ARCHIVE_SUMMARY(3)));
    assert.ok(markup.includes('data-testid="season-archive-S3"'));
    assert.ok(!markup.includes('data-testid="season-archive-S2"'));
});
