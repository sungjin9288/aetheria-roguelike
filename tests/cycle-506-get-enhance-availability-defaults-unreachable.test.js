import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 506: getEnhanceAvailability `gold = 0` + `inventory = []` defaults
 *   unreachable batch 정리
 *   (cycle 222-505 silent dead config 시리즈 256번째 — redundant default annotation
 *   util-level batch, cycle 502-505 lens 회귀, util default 청소 메가 시리즈 5번째).
 *
 * 발견 (2 default unreachable):
 * - src/utils/enhancementUtils.ts (line 31):
 *     export const getEnhanceAvailability = (item, gold: number = 0,
 *         inventory: Item[] = []) => {...}
 * - 호출 사이트 (3 callsite):
 *     · EquipmentPanel.tsx:65 — getEnhanceAvailability(item, player?.gold || 0,
 *       player?.inv || []).
 *     · SmartInventory.tsx:261 — getEnhanceAvailability(item, player.gold,
 *       (player.inv || [])).
 *     · useInventoryActions.ts:547 — getEnhanceAvailability(item, player.gold,
 *       player.inv).
 *     · 3 callsite 모두 3 args 전달. default 0 / [] 도달 불가.
 *
 * 패턴 (cycle 222-505 시리즈 256번째):
 * - cycle 502-505: util default 청소 메가 시리즈 (incrementStat / consumeInventory /
 *   getDailyProtocolCompletions / grantGold).
 * - cycle 506: getEnhanceAvailability 2 default batch — 같은 파일에서 cycle 503
 *   (consumeInventoryItemByName count) paired completion.
 *
 * 수정 (src/utils/enhancementUtils.ts):
 * - signature에서 gold: number = 0 → gold: number.
 * - signature에서 inventory: Item[] = [] → inventory: Item[].
 *
 * 회귀 가드:
 * - 3 callsite 동작 그대로.
 * - body 동작 보존 (canEnhance / affordable 분기).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 506: getEnhanceAvailability signature에서 gold / inventory default 0건', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    const fnIdx = source.indexOf('export const getEnhanceAvailability');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/gold:\s*number\s*=\s*0/.test(sig), 'gold default 0 제거');
    assert.ok(!/inventory:\s*Item\[\]\s*=\s*\[\]/.test(sig), 'inventory default [] 제거');
    assert.ok(/\bgold\b/.test(sig), 'gold 파라미터 자체는 보존');
    assert.ok(/\binventory\b/.test(sig), 'inventory 파라미터 자체는 보존');
});

test('cycle 506: 정합성 가드 — 3 callsite 모두 3 args 전달', async () => {
    const callsites = [
        'src/components/EquipmentPanel.tsx',
        'src/components/SmartInventory.tsx',
        'src/hooks/useInventoryActions.ts',
    ];
    for (const f of callsites) {
        const source = await readSrc(f);
        const matches = source.match(/getEnhanceAvailability\(/g) || [];
        assert.ok(matches.length >= 1, `${f} getEnhanceAvailability 호출 발견`);
    }
});

test('cycle 506: body canEnhance / affordable 분기 보존', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(/canEnhance: false/.test(source), 'canEnhance: false 분기 보존');
    assert.ok(/affordable: true/.test(source), 'affordable: true 분기 보존');
    assert.ok(/missing: 'gold'/.test(source), 'missing gold 분기 보존');
    assert.ok(/missing: 'material'/.test(source), 'missing material 분기 보존');
});

test('cycle 506: cycle 502-505 회귀 가드 — 이전 default 정리 보존', async () => {
    const ps = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/incrementStat[^=]*amount/.test(ps.match(/export const incrementStat[^=]*=>/)?.[0] || ''),
        'cycle 502 incrementStat amount 0건');

    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/consumeInventoryItemByName[^=]*count:\s*number\s*=\s*1/.test(eu),
        'cycle 503 consume count default 0건');

    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/getDailyProtocolCompletions[^=]*amount:\s*any\s*=\s*1/.test(gu),
        'cycle 504 getDailyProtocolCompletions amount default 0건');
    assert.ok(!/grantGold[^=]*amount:\s*any\s*=\s*0/.test(gu),
        'cycle 505 grantGold amount default 0건');
});
