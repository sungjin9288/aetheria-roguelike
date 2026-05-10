import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 579: getMoveRecommendations `maps = {}` default unreachable
 *   (cycle 222-578 silent dead config 시리즈 318번째 — redundant default annotation
 *   청소 메가 시리즈 71번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/adventureGuide.ts (line 133):
 *     export const getMoveRecommendations = (player: Player, stats: any,
 *         currentMap: GameMap | null | undefined,
 *         maps: Record<string, GameMap> = {}) => {...};
 * - 호출 사이트:
 *     · MapNavigator.tsx:66 — getMoveRecommendations(player, stats, currentMap,
 *       DB.MAPS) — 4 args 명시.
 *     · ControlPanel.tsx:58 — getMoveRecommendations(player, stats, mapData,
 *       DB.MAPS) — 4 args 명시.
 *     · tests/signature-move-recommendation: 4 callsite (basePlayer, baseStats,
 *       fixture.sourceMap, MAPS) — 모두 명시.
 *     · tests/cycle-333: 2 callsite (DB.MAPS) — 모두 명시.
 *     · tests/adventure-guide: 2 callsite (object literal) — 모두 명시.
 * - 결과: maps 항상 명시 전달. default {} 도달 불가.
 *
 * 패턴 (cycle 222-578 시리즈 318번째):
 * - cycle 502-578: default 청소 메가 시리즈 77사이클.
 * - cycle 579: utils/adventureGuide.ts 추가 cleanup — cycle 519/523에 이은
 *   동일 모듈.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - signature에서 maps: Record<string, GameMap> = {} → maps: Record<string, GameMap>.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 다수 callsite 동작 그대로.
 * - body currentMap.exits.map / getMapLevel / forecast 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 579: getMoveRecommendations signature에서 maps default 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const fnIdx = source.indexOf('export const getMoveRecommendations');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/maps:\s*Record<string,\s*GameMap>\s*=\s*\{\}/.test(sig),
        'getMoveRecommendations maps default {} 제거');
});

test('cycle 579: 정합성 가드 — 다수 callsite 보존', async () => {
    const mn = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(/getMoveRecommendations\(\s*\n\s*player,\s*\n[\s\S]*?DB\.MAPS,\s*\n\s*\)/.test(mn),
        'MapNavigator getMoveRecommendations 4-arg callsite 보존');

    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/getMoveRecommendations\(player,\s*stats \|\| \{ maxHp: player\.maxHp, maxMp: player\.maxMp \},\s*mapData,\s*DB\.MAPS\)/.test(cp),
        'ControlPanel getMoveRecommendations callsite 보존');
});

test('cycle 579: cycle 502-578 회귀 가드 — default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/countInventoryItemByName[^=]*inventory:\s*Item\[\]\s*=\s*\[\]/.test(eu),
        'cycle 578 countInventoryItemByName inventory default 0건');

    const mp = await readSrc('src/utils/mapProgress.ts');
    assert.ok(!/getMapCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(mp),
        'cycle 577 getMapCodexProgress codex default 0건');
});
