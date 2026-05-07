import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 273: aiService 'bossPhase2' 스토리 템플릿 dispatch 누락 dead config
 *   (cycle 222-272 silent dead config 시리즈 44번째 — cycle 272 paired follow-up).
 *
 * 발견 (cycle 272 paired):
 * - cycle 272에서 'questComplete' 스토리 템플릿 dispatch 추가.
 * - 잔존 dead 3종: levelUp / bossPhase2 / ruinRecap.
 * - 'bossPhase2' (`⚡ [${bossName}]이(가) 진정한 힘을 해방합니다!`)는 보스 phase2 transition
 *   시점의 narrative cue. CombatEngine.enemyAttack 내부에서 phase2Triggered 전환되지만 hook
 *   layer는 이 transition을 감지해서 addStoryLog 호출 안 함.
 * - 결과: 보스 phase2 발현이 visual + log + status는 있지만 AI narrative blurb 부재.
 *
 * 패턴 (cycle 222-272 silent dead config 시리즈 44번째):
 * - cycle 272: questComplete 템플릿 dispatch.
 * - cycle 273: bossPhase2 템플릿 dispatch (paired follow-up).
 *
 * 수정 (src/hooks/combatActions/combatAttack.ts):
 * - enemyAttack 호출 후 phase2 transition 감지: 이전 enemy.phase2Triggered=false → 후 true.
 * - addStoryLog('bossPhase2', { bossName: counterResult.updatedEnemy.name }) 호출.
 *
 * 회귀 가드:
 * - cycle 272 questComplete dispatch 동작 유지.
 * - phase2 transition logs / status / atk bonus 동작 변화 없음.
 * - phase2 미정의 보스 / 일반 적은 미발동 (조건 가드).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 273: combatAttack가 phase2 transition 감지', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    // result.updatedEnemy.phase2Triggered (이전) vs counterResult.updatedEnemy.phase2Triggered (후) 비교.
    assert.ok(/phase2Triggered/.test(source),
        'combatAttack.ts에서 phase2Triggered 비교');
});

test('cycle 273: combatAttack가 addStoryLog("bossPhase2", ...) 호출', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(source),
        "addStoryLog('bossPhase2', ...) 호출");
});

test('cycle 273: bossPhase2 payload에 bossName 포함', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/addStoryLog\(['"]bossPhase2['"]\s*,\s*\{[\s\S]{0,80}?bossName/.test(source),
        'bossName 포함된 payload (template "${data.bossName}" 정합)');
});

test('cycle 273: aiService bossPhase2 템플릿 정의 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/bossPhase2:[\s\S]{0,200}bossName/.test(source),
        'aiService bossPhase2 템플릿 유지');
});

test('cycle 272 회귀 가드: questComplete dispatch 동작 유지', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/addStoryLog\(['"]questComplete['"]/.test(source),
        'cycle 272 questComplete addStoryLog 유지');
});
