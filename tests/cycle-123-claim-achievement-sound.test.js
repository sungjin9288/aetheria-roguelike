import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 123: 업적 청구(claimAchievement) 사운드 큐 — cycle 122 quest_complete 재사용.
 *
 * 발견:
 * - cycle 122에서 completeQuest에 quest_complete 사운드 추가했지만, 같은 결의
 *   celebratory 모먼트인 claimAchievement는 audio cue 없음 (success 로그만).
 * - 둘 다 보상(gold/item) + 가능하면 칭호 해금이 동반되는 의미 있는 액션이라
 *   동일한 audio reflection이 자연스러움.
 *
 * 추가:
 * - useInventoryActions.claimAchievement: addLog 'success' 다음에 soundManager.play
 *   ('quest_complete') 호출. 사운드 키는 cycle 122 추가분 재사용 (새 case 추가
 *   대신 기존 의미 확장 — quest 완료와 achievement 청구가 동일한 사이클의
 *   "달성/회수" 종류).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('useInventoryActions: claimAchievement에서 quest_complete 사운드 재생', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    const idx = source.indexOf('claimAchievement:');
    assert.ok(idx > -1, 'claimAchievement action should exist');
    const blockEnd = source.indexOf('synthesize:', idx);
    const block = source.slice(idx, blockEnd);
    assert.match(
        block,
        /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
        'claimAchievement should call soundManager.play("quest_complete")'
    );
});

test('useInventoryActions: completeQuest 회귀 보존 — 여전히 quest_complete 사운드', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    const idx = source.indexOf('completeQuest:');
    const blockEnd = source.indexOf('claimAchievement:', idx);
    const block = source.slice(idx, blockEnd);
    assert.match(block, /play\(['"]quest_complete['"]\)/);
});

test('SoundManager: quest_complete 사운드 case 회귀 보존 (cycle 122)', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]quest_complete['"]\s*:/);
});
