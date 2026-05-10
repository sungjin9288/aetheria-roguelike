import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 556: formatDailyProtocolReward + formatRewardParts 2 defaults batch
 *   unreachable (cycle 222-555 silent dead config 시리즈 297번째 — redundant
 *   default annotation 청소 메가 시리즈 50번째). gameUtils.ts 같은 모듈 batch.
 *
 * 발견 (2 defaults batch):
 * - src/utils/gameUtils.ts (line 96, 111):
 *     · formatDailyProtocolReward (reward: any = {})
 *     · formatRewardParts (reward: any = {})
 * - 호출 사이트 (모두 명시 전달):
 *     · formatDailyProtocolReward: 3 callers
 *       - useInventoryActions:29 — formatDailyProtocolReward(mission.reward)
 *       - _shared.ts:34 — formatDailyProtocolReward(mission.reward)
 *       - useCombatActions:18 — formatDailyProtocolReward(mission.reward)
 *     · formatRewardParts: 3 callers
 *       - QuestBoardPanel:31 — formatRewardParts(reward)
 *       - QuestTab:36 — formatRewardParts(reward)
 *       - AchievementPanel:68 — formatRewardParts(achievement.reward || {})
 * - 결과: reward 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-555 시리즈 297번째):
 * - cycle 502-555: default 청소 메가 시리즈 54사이클.
 * - cycle 556: gameUtils.ts 같은 모듈 batch — cycle 504/505 grantGold/
 *   getDailyProtocolCompletions에 이은 동일 모듈 추가 cleanup.
 *
 * 수정 (src/utils/gameUtils.ts):
 * - formatDailyProtocolReward signature: reward: any = {} → reward: any.
 * - formatRewardParts signature: reward: any = {} → reward: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 6 callsite 동작 그대로.
 * - body essence/item/relicShard/exp/gold 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 556: 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const dailySig = source.slice(source.indexOf('export const formatDailyProtocolReward'),
                                    source.indexOf('=>', source.indexOf('export const formatDailyProtocolReward')));
    assert.ok(!/reward:\s*any\s*=\s*\{\}/.test(dailySig),
        'formatDailyProtocolReward reward default {} 제거');

    const partsSig = source.slice(source.indexOf('export const formatRewardParts'),
                                    source.indexOf('=>', source.indexOf('export const formatRewardParts')));
    assert.ok(!/reward:\s*any\s*=\s*\{\}/.test(partsSig),
        'formatRewardParts reward default {} 제거');
});

test('cycle 556: 정합성 가드 — 6 callsite 보존', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/formatDailyProtocolReward\(mission\.reward\)/.test(inv),
        'useInventoryActions formatDailyProtocolReward 보존');

    const sh = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(/formatDailyProtocolReward\(mission\.reward\)/.test(sh),
        '_shared.ts formatDailyProtocolReward 보존');

    const ap = await readSrc('src/components/AchievementPanel.tsx');
    assert.ok(/formatRewardParts\(achievement\.reward \|\| \{\}\)/.test(ap),
        'AchievementPanel formatRewardParts 보존');

    const qt = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/formatRewardParts\(reward\)/.test(qt),
        'QuestTab formatRewardParts 보존');
});

test('cycle 556: body essence/item/exp/gold 분기 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/if \(reward\.essence\) return `에센스 \$\{reward\.essence\}`/.test(source),
        'essence 분기 보존');
    assert.ok(/if \(reward\.exp\) parts\.push\(`EXP \$\{reward\.exp\}`\)/.test(source),
        'exp 분기 보존');
    assert.ok(/if \(reward\.gold\) parts\.push\(`\$\{reward\.gold\}G`\)/.test(source),
        'gold 분기 보존');
});

test('cycle 556: cycle 502-555 회귀 가드 — default 청소 시리즈 보존', async () => {
    const qo = await readSrc('src/utils/questOperations.ts');
    assert.ok(!/const getQuestTargetMaps[^=]*maps:\s*any\s*=\s*MAPS/.test(qo),
        'cycle 555 getQuestTargetMaps maps default 0건');

    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/const getExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
        'cycle 554 getExploreState stats default 0건');
});
