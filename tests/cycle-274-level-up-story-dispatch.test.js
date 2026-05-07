import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 274: aiService 'levelUp' 스토리 템플릿 dispatch 누락 dead config
 *   (cycle 222-273 silent dead config 시리즈 45번째 — cycle 272-273 paired follow-up).
 *
 * 발견 (story 템플릿 dead 시리즈 — 잔존 2 → 1):
 * - cycle 272: questComplete dispatch.
 * - cycle 273: bossPhase2 dispatch.
 * - cycle 274: levelUp dispatch (잔존 2개 중 1번째).
 * - 'levelUp' 템플릿 (`✨ 새로운 힘이 깨어됩니다! 레벨 ${data.level} 달성!`)는 player 레벨업 시점의
 *   narrative cue. CombatEngine.handleVictory 내부 applyExpGain이 leveledUp boolean 반환하지만
 *   hook layer는 이를 read해 addStoryLog 호출 안 함이라 dispatch 0건.
 * - 결과: 레벨업이 visual('levelUp') + sound(cycle 217) + log는 있지만 AI narrative blurb 부재.
 *
 * 수정 (src/hooks/combatActions/combatVictory.ts):
 * - victoryResult.leveledUp이 true면 addStoryLog('levelUp', { level: updatedPlayer.level }) 호출.
 *
 * 회귀 가드:
 * - cycle 272 questComplete + cycle 273 bossPhase2 dispatch 동작 유지.
 * - 레벨업 visual / sound / log 동작 변화 없음.
 * - 레벨업 안 된 victory는 미발동.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 274: combatVictory가 victoryResult.leveledUp 감지', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/victoryResult\.leveledUp|leveledUp/.test(source),
        'combatVictory.ts에서 leveledUp 검사');
});

test('cycle 274: combatVictory가 addStoryLog("levelUp", ...) 호출', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/addStoryLog\(['"]levelUp['"]/.test(source),
        "addStoryLog('levelUp', ...) 호출");
});

test('cycle 274: levelUp payload에 level 포함', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/addStoryLog\(['"]levelUp['"]\s*,\s*\{[\s\S]{0,80}?level/.test(source),
        'level 포함된 payload (template "${data.level}" 정합)');
});

test('cycle 274: aiService levelUp 템플릿 정의 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/levelUp:[\s\S]{0,200}data\.level/.test(source),
        'aiService levelUp 템플릿 유지');
});

test('cycle 272-273 회귀 가드: 이전 sponsored dispatch 동작 유지', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/addStoryLog\(['"]questComplete['"]/.test(inv),
        'cycle 272 questComplete dispatch 유지');
    assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(atk),
        'cycle 273 bossPhase2 dispatch 유지');
});
