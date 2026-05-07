import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 261: claim 액션 sensory cue 누락 (cycle 122-123 paired completion)
 *   (cycle 222-260 silent dead config 시리즈 32번째).
 *
 * 발견 (cycle 122/123 sensory cue 시리즈 잔존 누락):
 * - cycle 122: quest_complete 사운드 도입 (퀘스트 완료 / 업적 청구).
 * - cycle 123: 업적 청구도 동일 사운드 재사용.
 * - 그러나 동일 결의 "달성/회수" 모먼트 2건 잔존:
 *   1) claimWeeklyMission (useInventoryActions): 보상 grant + addLog 있지만 sound 0건.
 *   2) SeasonPassPanel claimReward: dispatch만 있고 addLog/sound 모두 0건 — UX dead path.
 *
 * 패턴 (cycle 222-260 silent dead config 시리즈 32번째):
 * - cycle 122: quest_complete 사운드 도입.
 * - cycle 123: 업적 paired.
 * - cycle 217-220: levelUp/death/victory/skill/heal/explore 사운드 시리즈.
 * - cycle 261: claim 액션 sensory cue 누락 paired completion.
 *
 * 수정:
 * 1) src/hooks/useInventoryActions.ts:
 *    - claimWeeklyMission에 soundManager.play('quest_complete') 추가.
 *    - claimSeasonReward 신규 action 추가 — dispatch + addLog + sound 통합.
 * 2) src/components/tabs/SeasonPassPanel.tsx: useGameEngine actions 사용으로 refactor.
 *
 * 회귀 가드:
 * - claimWeeklyMission addLog 동작 유지.
 * - 기존 quest / achievement quest_complete 사운드 dispatch 유지.
 * - CLAIM_SEASON_REWARD reducer 핸들러 변화 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 261: claimWeeklyMission에 quest_complete 사운드 dispatch', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // claimWeeklyMission 함수 내에 soundManager.play 호출.
    const fnMatch = source.match(/claimWeeklyMission:[\s\S]{0,500}?},/);
    assert.ok(fnMatch, 'claimWeeklyMission 정의 발견');
    assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
        'claimWeeklyMission 내부에 soundManager.play("quest_complete") 호출');
});

test('cycle 261: claimSeasonReward 신규 액션 정의', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/claimSeasonReward:/.test(source),
        'claimSeasonReward action 정의됨');
    // claimSeasonReward 함수 내에 dispatch + addLog + sound 모두 있어야 함.
    const fnMatch = source.match(/claimSeasonReward:[\s\S]{0,800}?},/);
    assert.ok(fnMatch, 'claimSeasonReward 정의 발견');
    assert.ok(/CLAIM_SEASON_REWARD/.test(fnMatch[0]),
        'claimSeasonReward 내부에 CLAIM_SEASON_REWARD dispatch');
    assert.ok(/addLog/.test(fnMatch[0]),
        'claimSeasonReward 내부에 addLog 호출');
    assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
        'claimSeasonReward 내부에 quest_complete 사운드');
});

test('cycle 261: SeasonPassPanel이 actions.claimSeasonReward 사용', async () => {
    const source = await readSrc('src/components/tabs/SeasonPassPanel.tsx');
    assert.ok(/claimSeasonReward/.test(source),
        'SeasonPassPanel은 claimSeasonReward action 사용');
});

test('cycle 122-123 회귀 가드: 기존 quest_complete 사운드 dispatch 유지', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    const matches = source.match(/soundManager\.play\(['"]quest_complete['"]\)/g);
    // cycle 122 (completeQuest), cycle 123 (claimAchievement), cycle 261 (claimWeekly + claimSeason) → 4 expected.
    assert.ok(matches && matches.length >= 4,
        `quest_complete 사운드 dispatch ≥4개 (cycle 122/123 + cycle 261 추가, 실제: ${matches?.length || 0})`);
});

test('cycle 261: 기존 CLAIM_SEASON_REWARD reducer 변화 없음 (회귀 가드)', async () => {
    const source = await readSrc('src/reducers/handlers/rewardHandlers.ts');
    assert.ok(/CLAIM_SEASON_REWARD: \(state: GameState, action: GameAction\) => \{/.test(source),
        'CLAIM_SEASON_REWARD handler 시그니처 유지');
});
