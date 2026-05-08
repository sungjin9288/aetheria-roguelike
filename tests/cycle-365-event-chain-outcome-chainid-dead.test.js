import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 365: eventChains.ts outcome.chainId 70개 redundant 정리
 *   (cycle 222-364 silent dead config 시리즈 131번째 — cleanup lens 연속).
 *
 * 발견 (70 dead config field — 동일 키, 13 chain × 평균 5+ outcome):
 * - eventChains.ts 13 chain의 모든 outcome 객체에 chainId 필드 (총 70개).
 * - eventActions.ts handleEventChoice는 `currentEvent._chainId`만 read.
 *   _chainId는 exploreActions에서 chain.id로 set됨 (chain trigger 시점).
 * - outcome.chainId는 항상 parent chain.id와 동일 — redundant. eventActions /
 *   tests / 어디에서도 outcome.chainId 직접 read 0건.
 * - 13 chain ID 목록 (chain.id ↔ outcome.chainId 일치 확인): abyss_signal /
 *   ancient_prophecy / divine_apostle_trial / dragon_legacy / forgotten_commander /
 *   forgotten_god / last_hero / lost_wizard / machine_uprising / rift_secret /
 *   shadow_guild / water_apostle / world_tree_corruption.
 *
 * 패턴 (cycle 222-364 silent dead config 시리즈 131번째):
 * - cycle 364: eventChain reward itemType / tier 7 dead annotations.
 * - cycle 365: eventChain outcome chainId 70 redundant duplicates (같은 lens).
 *
 * 수정 (src/data/eventChains.ts):
 * - 70 outcome 객체에서 chainId 필드 일괄 제거.
 *
 * 회귀 가드:
 * - 13 chain의 chain.id 정의 보존 (getChainEventForLoc lookup용).
 * - outcome.type / log / reward 보존.
 * - eventActions chain advance 동작 그대로 (`currentEvent._chainId` 사용).
 * - water-apostle-chain.test.js / discovery-chain test 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 365: eventChains.ts outcome.chainId 0건', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    const matches = source.match(/chainId:/g) || [];
    assert.equal(matches.length, 0,
        `eventChains.ts에서 chainId 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 365: 13 chain id 정의 보존 (회귀 가드)', async () => {
    const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
    const expectedIds = ['abyss_signal', 'ancient_prophecy', 'divine_apostle_trial',
        'dragon_legacy', 'forgotten_commander', 'forgotten_god', 'last_hero',
        'lost_wizard', 'machine_uprising', 'rift_secret', 'shadow_guild',
        'water_apostle', 'world_tree_corruption'];
    const actualIds = EVENT_CHAINS.map((c) => c.id).sort();
    assert.deepEqual(actualIds.slice().sort(), expectedIds.slice().sort(),
        '13 chain id 보존');
});

test('cycle 365: outcome 구조 보존 (type / log / reward)', async () => {
    const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
    let totalOutcomes = 0;
    for (const chain of EVENT_CHAINS) {
        for (const step of chain.steps) {
            for (const outcome of step.event.outcomes) {
                assert.ok(typeof outcome.type === 'string', 'outcome.type 보존');
                assert.equal(outcome.chainId, undefined, 'outcome.chainId 0건');
                totalOutcomes += 1;
            }
        }
    }
    assert.ok(totalOutcomes >= 50, `outcome 50+ 개 검증 (실제: ${totalOutcomes})`);
});

test('cycle 365: getChainEventForLoc 동작 보존', async () => {
    const { getChainEventForLoc } = await import('../src/data/eventChains.js');
    const result = getChainEventForLoc('호수의 신전', { water_apostle: 0 });
    assert.ok(result, 'water_apostle chain step 0 반환');
    assert.equal(result.chain.id, 'water_apostle', 'chain.id 보존');
});

test('cycle 364 회귀 가드: eventChain reward itemType/tier 0건 보존', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    const itemTypeMatches = source.match(/itemType:/g) || [];
    const tierMatches = source.match(/, tier: \d/g) || [];
    assert.equal(itemTypeMatches.length, 0, 'cycle 364 itemType 0건 보존');
    assert.equal(tierMatches.length, 0, 'cycle 364 reward tier 0건 보존');
});
