import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 275: aiService 'ruinRecap' 스토리 템플릿 dispatch (story 시리즈 마무리)
 *   (cycle 222-274 silent dead config 시리즈 46번째 — story 템플릿 4사이클 마무리).
 *
 * 발견 (story 템플릿 dead 시리즈 마지막 1건):
 * - cycle 272: questComplete dispatch.
 * - cycle 273: bossPhase2 dispatch.
 * - cycle 274: levelUp dispatch.
 * - cycle 275: ruinRecap dispatch (잔존 마지막).
 * - 'ruinRecap' 템플릿 (`💀 ${name}는 레벨 ${level}에서 추락했습니다. 하지만 그 정신은 다시
 *   불타오를 것입니다...`)는 사망 후 회상 narrative cue.
 * - 'death' 템플릿은 즉각 모먼트 ("의식이 흘려집니다")이고 'ruinRecap'은 retrospective —
 *   둘 다 사망 시점에 dispatch하면 player에게 immediate + reflective 양쪽 narrative 제공.
 *
 * 수정 (combatAttack.ts + combatItem.ts):
 * - 기존 addStoryLog('death', ...) 직후에 addStoryLog('ruinRecap', { name, level }) 추가.
 * - name = player.name, level = player.level.
 *
 * 회귀 가드:
 * - cycle 272/273/274 dispatch 동작 유지.
 * - 기존 'death' addStoryLog dispatch 유지.
 * - addStoryLog 미정의 deps 가드.
 *
 * 시리즈 마무리:
 * - aiService 8 스토리 템플릿 모두 dispatch 활성:
 *   encounter / victory / death / rest (이전 활성)
 *   + questComplete (cycle 272) / bossPhase2 (cycle 273) / levelUp (cycle 274) / ruinRecap (cycle 275).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 275: combatAttack가 addStoryLog("ruinRecap", ...) 호출', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/addStoryLog\(['"]ruinRecap['"]/.test(source),
        "combatAttack.ts에 addStoryLog('ruinRecap', ...) 호출");
});

test('cycle 275: combatItem이 addStoryLog("ruinRecap", ...) 호출', async () => {
    const source = await readSrc('src/hooks/combatActions/combatItem.ts');
    assert.ok(/addStoryLog\(['"]ruinRecap['"]/.test(source),
        "combatItem.ts에 addStoryLog('ruinRecap', ...) 호출");
});

test('cycle 275: ruinRecap payload에 name + level 포함', async () => {
    const sources = await Promise.all([
        readSrc('src/hooks/combatActions/combatAttack.ts'),
        readSrc('src/hooks/combatActions/combatItem.ts'),
    ]);
    sources.forEach((src, i) => {
        const matches = src.match(/addStoryLog\(['"]ruinRecap['"]\s*,\s*\{[^}]*\}/g);
        assert.ok(matches && matches.length > 0, `[file ${i}] ruinRecap payload 발견`);
        matches.forEach((match) => {
            assert.ok(/name/.test(match), `[file ${i}] name field 포함`);
            assert.ok(/level/.test(match), `[file ${i}] level field 포함`);
        });
    });
});

test('cycle 275: aiService ruinRecap 템플릿 정의 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/ruinRecap:[\s\S]{0,300}data\.name/.test(source),
        'aiService ruinRecap 템플릿 (data.name 사용) 유지');
});

test('cycle 272-274 회귀 가드: 이전 sponsored dispatch 동작 유지', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
    const vic = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/addStoryLog\(['"]questComplete['"]/.test(inv),
        'cycle 272 questComplete dispatch 유지');
    assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(atk),
        'cycle 273 bossPhase2 dispatch 유지');
    assert.ok(/addStoryLog\(['"]levelUp['"]/.test(vic),
        'cycle 274 levelUp dispatch 유지');
});

test('cycle 275: 기존 death dispatch 유지 (회귀 가드)', async () => {
    const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
    const itm = await readSrc('src/hooks/combatActions/combatItem.ts');
    const atkDeathMatches = atk.match(/addStoryLog\(['"]death['"]/g);
    const itmDeathMatches = itm.match(/addStoryLog\(['"]death['"]/g);
    assert.ok(atkDeathMatches && atkDeathMatches.length >= 2,
        `combatAttack에 'death' addStoryLog ≥2 (실제: ${atkDeathMatches?.length || 0})`);
    assert.ok(itmDeathMatches && itmDeathMatches.length >= 1,
        `combatItem에 'death' addStoryLog ≥1 (실제: ${itmDeathMatches?.length || 0})`);
});
