import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 196: SEASON_XP.codexDiscover dispatch를 useInventoryActions의 3 paths로 확장
 * (cycle 193 follow-up).
 *
 * 발견:
 * - cycle 193이 combatVictory에서 신규 codex 등록 시 SEASON_XP.codexDiscover 부여 fix.
 * - 그러나 useInventoryActions의 3 codex 등록 path는 dispatch 누락:
 *   1. shopBuy (line 185 registerLootToCodex) — 상점 구매 시 신규 발견.
 *   2. craft (line 240/241 registerCodex + registerLootToCodex) — 제작 시 레시피/결과.
 *   3. synthesize (line 393 registerLootToCodex) — 합성 결과.
 *
 * 결과: combat loot로만 codex XP 적립, 다른 정상 codex 발견 경로(상점/제작/합성)에서는
 *   silent. 게임 spec의 codexDiscover XP가 부분적으로만 dispatch.
 *
 * 수정 (src/hooks/useInventoryActions.ts):
 * - 3 path 모두에 countNewCodexEntries 호출 전후 비교 + ADD_SEASON_XP * codexDiscover 추가.
 * - import에 countNewCodexEntries 추가.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test('cycle 196: useInventoryActions에 countNewCodexEntries import + 사용', async () => {
    const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
    assert.match(src, /countNewCodexEntries/);
    assert.match(src, /SEASON_XP\.codexDiscover/);
});

test('cycle 196: useInventoryActions에 codexBefore / newCodexCount 변수 3 path 적용', async () => {
    const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
    // shopBuy + craft + synth — 각각 codex 추적 패턴 1+ 회.
    const codexBeforeMatches = (src.match(/codexBefore/g) || []).length;
    const newCodexMatches = (src.match(/newCodexCount/g) || []).length;
    assert.ok(codexBeforeMatches >= 2, `codexBefore variable usage >= 2; got ${codexBeforeMatches}`);
    // synth는 별도 변수명 synthCodexBefore — newCodexCount는 shopBuy+craft에서만.
    assert.ok(newCodexMatches >= 2, `newCodexCount usage >= 2; got ${newCodexMatches}`);
});

test('cycle 196: combatVictory 회귀 가드 (cycle 193 codexDiscover dispatch 보존)', async () => {
    const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf8');
    assert.match(src, /SEASON_XP\.codexDiscover/);
    assert.match(src, /newCodexCount/);
});
