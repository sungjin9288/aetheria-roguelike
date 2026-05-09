import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 407: formatRewardParts essence/relicShard 2 unreachable branches 정리
 *   (cycle 222-406 silent dead config 시리즈 169번째 — unreachable lens 회귀).
 *
 * 발견 (2 dead branches):
 * - src/utils/gameUtils.ts formatRewardParts (line ~99):
 *   `if (reward.essence) parts.push(...)`
 *   `if (reward.relicShard) parts.push(...)`
 * - 호출 사이트는 AchievementPanel / QuestTab / QuestBoardPanel 3종 — 모두
 *   quest/achievement reward를 인자로 전달.
 * - quests.ts/achievements 데이터: gold/exp/item/title/premiumCurrency만 사용 —
 *   essence/relicShard 0건 (확인 완료).
 * - daily protocol mission reward는 essence/relicShard 사용하지만 별도 함수
 *   formatDailyProtocolReward로 처리.
 * - 결과: formatRewardParts의 essence/relicShard 분기 → 절대 hit 안 됨.
 *
 * 패턴 (cycle 222-406 시리즈 169번째):
 * - cycle 359/361/392/395/397: unreachable lookup/branch lens.
 * - cycle 407: formatRewardParts 함수 내 unreachable branch 2개 정리
 *   (동일 lens 회귀 — 함수 분기 내 unreachable).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - formatRewardParts에서 essence / relicShard 분기 2 라인 제거.
 *
 * 회귀 가드:
 * - exp / gold / item 분기 보존.
 * - formatDailyProtocolReward 함수 (daily-specific 처리) 동작 그대로.
 * - AchievementPanel / QuestTab / QuestBoardPanel 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 407: formatRewardParts에서 essence/relicShard 분기 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const formatRewardParts');
    const fnEnd = source.indexOf('};', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(!/reward\.essence/.test(fnBlock),
        'formatRewardParts에서 reward.essence 분기 0건');
    assert.ok(!/reward\.relicShard/.test(fnBlock),
        'formatRewardParts에서 reward.relicShard 분기 0건');
});

test('cycle 407: formatRewardParts 활성 분기 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const formatRewardParts');
    const fnEnd = source.indexOf('};', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(/reward\.exp/.test(fnBlock), 'reward.exp 분기 보존');
    assert.ok(/reward\.gold/.test(fnBlock), 'reward.gold 분기 보존');
    assert.ok(/reward\.item/.test(fnBlock), 'reward.item 분기 보존');
});

test('cycle 407: formatDailyProtocolReward 동작 보존 (별도 함수)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/export const formatDailyProtocolReward/.test(source),
        'formatDailyProtocolReward 함수 보존');
    const fnStart = source.indexOf('export const formatDailyProtocolReward');
    const fnEnd = source.indexOf('};', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(/reward\.essence/.test(fnBlock),
        'formatDailyProtocolReward의 essence 분기 보존');
    assert.ok(/reward\.relicShard/.test(fnBlock),
        'formatDailyProtocolReward의 relicShard 분기 보존');
});

test('cycle 407: 정합성 가드 — quests/achievements는 essence/relicShard 0건', async () => {
    const source = await readSrc('src/data/quests.ts');
    assert.ok(!/reward:\s*\{[^}]*essence:/.test(source),
        '데이터 정합성: quests.ts reward에 essence 0건');
    assert.ok(!/reward:\s*\{[^}]*relicShard:/.test(source),
        '데이터 정합성: quests.ts reward에 relicShard 0건');
});

test('cycle 407: formatRewardParts 동작 (활성 분기)', async () => {
    const { formatRewardParts } = await import('../src/utils/gameUtils.js');
    const result = formatRewardParts({ exp: 100, gold: 500, item: '엘릭서' });
    assert.deepEqual(result, ['EXP 100', '500G', '엘릭서'],
        'exp/gold/item 분기 동작 보존');
});

test('cycle 406 회귀 가드: useGameEngine setAiThinking 0건', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(!/setAiThinking:/.test(source),
        'cycle 406 setAiThinking 0건 보존');
});
