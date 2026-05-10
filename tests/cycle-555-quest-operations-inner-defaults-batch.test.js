import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 555: questOperations 4 inner defaults batch unreachable + entry-point
 *   default 보존 (cycle 222-554 silent dead config 시리즈 296번째 — redundant
 *   default annotation 청소 메가 시리즈 49번째). entry-point pattern (cycle
 *   513) 재적용.
 *
 * 발견 (4 inner defaults unreachable, 1 entry default reachable 보존):
 * - src/utils/questOperations.ts:
 *     · line 61: const getQuestTargetMaps = (quest, maps: any = MAPS) — 2 callers
 *       (line 78/122) 모두 maps 명시.
 *     · line 76: const isBossQuest = (quest, maps: any = MAPS) — 1 caller
 *       (line 88, getQuestLane 내부) 명시.
 *     · line 84: const getQuestLane = (quest, resonance, maps: any = MAPS) —
 *       1 caller (line 120, scoreQuest 내부) 명시.
 *     · line 118: const scoreQuest = (..., maps: any = MAPS) — 1 caller
 *       (line 168, getQuestBoardRecommendations 내부) 명시.
 * - 호출 사이트 audit:
 *     · 4 inner functions: 모두 chain caller가 maps 명시 전달이라 default 도달
 *       불가.
 *     · entry: getQuestBoardRecommendations(line 160)는 외부 caller 3개
 *       (adventureGuide:335, QuestBoardPanel:66, cycle-356 test) 모두 1 arg만
 *       전달 → maps default = MAPS REACHABLE 보존 필수.
 *
 * 패턴 (cycle 222-554 시리즈 296번째):
 * - cycle 502-554: default 청소 메가 시리즈 53사이클.
 * - cycle 555: entry-point 패턴 (cycle 513 getEquipmentArtProfile에서 정착)
 *   재적용 — wrapper의 default는 entry이라 보존, inner chain의 default는
 *   redundant 정리. 4 inner defaults batch.
 *
 * 수정 (src/utils/questOperations.ts):
 * - getQuestTargetMaps signature: maps: any = MAPS → maps: any.
 * - isBossQuest signature: maps: any = MAPS → maps: any.
 * - getQuestLane signature: maps: any = MAPS → maps: any.
 * - scoreQuest signature: maps: any = MAPS → maps: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 4 inner callsite chain 동작 그대로.
 * - entry getQuestBoardRecommendations 2 defaults 보존 (maps + questCatalog).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 555: 4 inner defaults 0건', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const fns = ['getQuestTargetMaps', 'isBossQuest', 'getQuestLane', 'scoreQuest'];
    for (const fn of fns) {
        const fnIdx = source.indexOf(`const ${fn}`);
        const fnEnd = source.indexOf('=>', fnIdx);
        const sig = source.slice(fnIdx, fnEnd);
        assert.ok(!/maps:\s*any\s*=\s*MAPS/.test(sig),
            `${fn}: maps default MAPS 제거`);
    }
});

test('cycle 555: entry getQuestBoardRecommendations 2 defaults 보존 (reachable)', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const fnIdx = source.indexOf('export const getQuestBoardRecommendations');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/maps:\s*any\s*=\s*MAPS/.test(sig),
        'getQuestBoardRecommendations maps default MAPS 보존 (entry-point reachable)');
    assert.ok(/questCatalog:\s*any\s*=\s*QUESTS/.test(sig),
        'getQuestBoardRecommendations questCatalog default QUESTS 보존');
});

test('cycle 555: 정합성 가드 — chain callsite 보존', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    assert.ok(/getQuestTargetMaps\(quest,\s*maps\)/.test(source),
        'getQuestTargetMaps(quest, maps) chain 보존');
    assert.ok(/isBossQuest\(quest,\s*maps\)/.test(source),
        'isBossQuest(quest, maps) chain 보존');
    assert.ok(/getQuestLane\(quest,\s*resonance,\s*maps\)/.test(source),
        'getQuestLane(quest, resonance, maps) chain 보존');
});

test('cycle 555: cycle 502-554 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/const getExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
        'cycle 554 getExploreState stats default 0건');

    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/applyFatalProtection\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
        'cycle 553 applyFatalProtection relics default 0건');
});
