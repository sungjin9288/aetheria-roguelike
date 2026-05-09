import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 394: RELIC_SYNERGIES `id` 출력 dead 일괄 정리
 *   (cycle 222-393 silent dead config 시리즈 157번째 — cleanup lens 연속).
 *
 * 발견 (20 dead 필드):
 * - src/data/relics.ts RELIC_SYNERGIES 20 entry 각각에 `id: '<synergy_id>'`.
 * - 매칭은 `bonus.effect` 기반 (statsCalculator + CombatEngine).
 *   · `syn.bonus.effect === 'eternal_fortress'` / `'entropy_god'` / `'primordial_wrath'` 등.
 *   · syn.id 매칭은 src/, tests/ 어디에도 0건.
 * - StatsPanel React key는 `syn.name` 사용 (id 아님).
 * - RelicChoicePanel은 syn.requires / syn.label / syn.legendaryHint만 read.
 * - 일부 id 값(e.g. 'eternal_fortress')은 bonus.effect와 동일하지만 dispatch는 항상 effect로 일어남.
 *
 * 패턴 (cycle 222-393 시리즈 157번째):
 * - cycle 365: eventChain outcome chainId 70 redundant 일괄 정리 (가장 큰 단일 batch까지).
 * - cycle 393: PREMIUM_SHOP entry category/repeatable 10 dead.
 * - cycle 394: RELIC_SYNERGIES id 20 dead 일괄 정리
 *   (function-output-dead lens의 data-config-dead 변형 — 동일 패턴 연속).
 *
 * 수정 (src/data/relics.ts):
 * - 20 synergy entry에서 `id: '...'` 라인 일괄 제거.
 *
 * 회귀 가드:
 * - bonus.effect / label / requires / desc / bonus 필드 보존.
 * - getActiveRelicSynergies 동작 (filter syn.requires every) 보존.
 * - StatsPanel `syn.name` 키 + label 동작 보존.
 * - cycle 153/154/236/237 회귀 가드 (bonus.effect 매칭 시너지) 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 394: RELIC_SYNERGIES entry에서 id 0건', async () => {
    const source = await readSrc('src/data/relics.ts');
    const synergyStart = source.indexOf('export const RELIC_SYNERGIES');
    const synergyEnd = source.indexOf(']);', synergyStart);
    const block = source.slice(synergyStart, synergyEnd);
    const idMatches = block.match(/^\s+id: '/gm) || [];
    assert.equal(idMatches.length, 0,
        `RELIC_SYNERGIES에서 id 0건, 발견: ${idMatches.length}`);
});

test('cycle 394: RELIC_SYNERGIES 동작 보존 (bonus.effect 기반 매칭)', async () => {
    const { RELIC_SYNERGIES, getActiveRelicSynergies } = await import('../src/data/relics.js');
    assert.ok(Array.isArray(RELIC_SYNERGIES), 'RELIC_SYNERGIES 배열 유지');
    assert.equal(RELIC_SYNERGIES.length, 20, '20 entries 유지');

    // bonus / label / requires 필드 보존 확인
    for (const syn of RELIC_SYNERGIES) {
        assert.ok(typeof syn.label === 'string', 'label 유지');
        assert.ok(Array.isArray(syn.requires), 'requires 유지');
        assert.ok(typeof syn.bonus === 'object', 'bonus 유지');
        assert.ok(typeof syn.bonus.effect === 'string', 'bonus.effect 유지');
        assert.equal(syn.id, undefined, 'id 필드 제거');
    }

    // getActiveRelicSynergies 동작 회귀 가드 (vampire_lord 예시)
    const relics = [{ name: '피의 서약' }, { name: '영혼 흡수' }];
    const active = getActiveRelicSynergies(relics);
    assert.ok(active.length > 0, 'getActiveRelicSynergies 매칭 보존');
    assert.equal(active[0].bonus.effect, 'vampire_lord', 'vampire_lord effect 보존');
});

test('cycle 394: cycle 153/154/236/237 회귀 가드 (bonus.effect 매칭 시너지 통과)', async () => {
    const source = await readSrc('src/data/relics.ts');
    const fixtures = [
        'eternal_fortress', 'entropy_god', 'primordial_wrath',
        'vampire_lord', 'arcane_surge', 'eternal_life', 'annihilator',
    ];
    for (const effect of fixtures) {
        const re = new RegExp(`bonus:[^}]+effect: '${effect}'`);
        assert.ok(re.test(source), `bonus.effect: '${effect}' 보존`);
    }
});

test('cycle 393 회귀 가드: PREMIUM_SHOP category/repeatable 0건', async () => {
    const source = await readSrc('src/data/premiumShop.ts');
    assert.ok(!/category:\s*'utility'/.test(source),
        'cycle 393 utility category 0건 보존');
    assert.ok(!/repeatable:\s*true/.test(source),
        'cycle 393 repeatable 0건 보존');
});
