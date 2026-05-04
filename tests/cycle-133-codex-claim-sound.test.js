import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 133: 도감 milestone 수령 사운드 큐 — cycle 122-123 quest_complete 재사용.
 *
 * 발견:
 * - cycle 122에서 completeQuest, cycle 123에서 claimAchievement에 quest_complete
 *   사운드 추가했지만 같은 결의 celebratory 모먼트인 codex milestone 수령은
 *   audio cue 없음 (Codex.tsx onClick에서 dispatch만).
 * - 도감 milestone 보상은 ATK/DEF/HP 영구 보너스 + premiumCurrency까지 주는
 *   의미 있는 액션이라 동일한 audio reflection이 자연스러움.
 *
 * 수정:
 * - Codex.tsx milestone 수령 버튼 onClick에 soundManager.play('quest_complete')
 *   추가. 새 case 추가 대신 cycle 122 사운드 재사용 (3가지 "달성/회수" 액션
 *   — completeQuest / claimAchievement / claimCodex가 동일 음악적 정체성).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('Codex: milestone 수령 onClick에 quest_complete 사운드 재생', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const idx = source.indexOf('CLAIM_CODEX_REWARD');
    assert.ok(idx > -1, 'CLAIM_CODEX_REWARD dispatch should exist');
    const window = source.slice(Math.max(0, idx - 200), idx + 800);
    assert.match(
        window,
        /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
        'codex claim button should play quest_complete sound'
    );
});

test('Codex: soundManager import 추가됨', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
});

test('회귀 보존: cycle 122 completeQuest / cycle 123 claimAchievement 사운드 그대로', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // completeQuest와 claimAchievement 둘 다 quest_complete 사운드 호출 여전히 활성
    const completeQuestIdx = source.indexOf('completeQuest:');
    const claimAchIdx = source.indexOf('claimAchievement:');
    const cqBlock = source.slice(completeQuestIdx, claimAchIdx);
    const caBlock = source.slice(claimAchIdx, source.indexOf('synthesize:', claimAchIdx));
    assert.match(cqBlock, /play\(['"]quest_complete['"]\)/);
    assert.match(caBlock, /play\(['"]quest_complete['"]\)/);
});
