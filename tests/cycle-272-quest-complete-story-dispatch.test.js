import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 272: aiService 'questComplete' 스토리 템플릿 dispatch 누락 dead config
 *   (cycle 222-271 silent dead config 시리즈 43번째).
 *
 * 발견 (story 템플릿 4 dead 중 1건 paired completion):
 * - src/services/aiService.ts getFallback 8 스토리 템플릿:
 *   encounter / victory / death / rest (활성) + levelUp / bossPhase2 / questComplete /
 *   ruinRecap (모두 dispatch 0건).
 * - addStoryLog 사용 4건 (encounter/victory/death/rest)만 매칭, 나머지 4 템플릿은 dead.
 * - completeQuest는 quest_complete 사운드는 재생하지만 addStoryLog 미호출 → AI narrative
 *   blurb 부재. quest 보상 모먼트가 sound만 있고 narrative 없음.
 *
 * 패턴 (cycle 222-271 silent dead config 시리즈 43번째):
 * - cycle 217-220: SoundManager 미사용 사운드 dispatch.
 * - cycle 261: claim 액션 sensory cue paired completion.
 * - cycle 272: addStoryLog 'questComplete' 템플릿 dispatch.
 *
 * 수정:
 * 1) src/hooks/useInventoryActions.ts createInventoryActions:
 *    - deps에서 addStoryLog 추가 추출.
 *    - completeQuest 마지막에 addStoryLog('questComplete', { questTitle: qData.title }) 호출.
 * 2) src/hooks/useGameEngine.ts: addStoryLog가 deps로 이미 전달되고 있으므로 변화 없음.
 *
 * 회귀 가드:
 * - 기존 quest_complete 사운드 dispatch 유지.
 * - quest 보상 grant / addLog 동작 변화 없음.
 * - aiService 다른 템플릿 dispatch 동작 유지 (encounter/victory/death/rest).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 272: createInventoryActions deps에서 addStoryLog 추출', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // deps destructuring 패턴 — { ..., addStoryLog, ... }.
    assert.ok(/createInventoryActions = \(\{[^}]*addStoryLog/.test(source),
        'createInventoryActions가 addStoryLog deps 추출');
});

test('cycle 272: completeQuest가 addStoryLog("questComplete", ...) 호출', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // completeQuest 함수 내에 addStoryLog('questComplete', ...) 패턴.
    // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
    const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
    assert.ok(fnMatch, 'completeQuest 정의 발견');
    assert.ok(/addStoryLog\(['"]questComplete['"]/.test(fnMatch[0]),
        "completeQuest 내부에 addStoryLog('questComplete', ...) 호출");
});

test('cycle 272: addStoryLog questComplete payload에 questTitle 포함', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
    const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
    assert.ok(fnMatch);
    assert.ok(/addStoryLog\(['"]questComplete['"]\s*,\s*\{[\s\S]{0,100}?questTitle/.test(fnMatch[0]),
        'questTitle 포함된 payload (template "${data.questTitle}" 정합)');
});

test('cycle 272: aiService questComplete 템플릿 정의 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/questComplete:[\s\S]{0,200}questTitle/.test(source),
        'aiService questComplete 템플릿 유지');
});

test('cycle 272: 기존 quest_complete 사운드 dispatch 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
    const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
    assert.ok(fnMatch);
    assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
        'cycle 122 quest_complete 사운드 dispatch 유지');
});
