import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { MAX_RELICS_PER_RUN } from '../src/data/relics.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';

/**
 * PR #8 (2026-06): 프레스티지 해금 효과 구현.
 *   AscensionScreen이 광고하던 PRESTIGE_UNLOCKS가 대부분 dead display text였던 것을
 *   getPrestigeUnlocks(rank) 단일 진실 원천으로 실제 구현. 비퇴행 효과만:
 *   essence+10%(r1) / 유물 6개+4지선다(r2) / 엘리트+25%(r3) / 스탯×2(r10).
 */

test('rank0: 모든 해금 비활성 (신규/기본 곡선 불변)', () => {
    const u = getPrestigeUnlocks(0);
    assert.equal(u.essenceMult, 1);
    assert.equal(u.maxRelics, MAX_RELICS_PER_RUN);
    assert.equal(u.relicChoices, BALANCE.RELIC_CHOICE_BASE);
    assert.equal(u.eliteChanceBonus, 0);
    assert.equal(u.statMult, 1);
});

test('rank1: 에센스 +10%', () => {
    assert.equal(getPrestigeUnlocks(1).essenceMult, 1 + BALANCE.PRESTIGE_ESSENCE_BONUS);
});

test('rank2: 유물 최대 6개 + 4지선다', () => {
    const u = getPrestigeUnlocks(2);
    assert.equal(u.maxRelics, MAX_RELICS_PER_RUN + BALANCE.PRESTIGE_RELIC_SLOT_BONUS);
    assert.equal(u.relicChoices, BALANCE.RELIC_CHOICE_BASE + 1);
});

test('rank3: 엘리트 출현 +25% + 보스 희귀 보장 드롭', () => {
    assert.equal(getPrestigeUnlocks(3).eliteChanceBonus, BALANCE.PRESTIGE_ELITE_BONUS);
    assert.equal(getPrestigeUnlocks(2).guaranteedRareBossDrop, false, 'rank2는 미해금');
    assert.equal(getPrestigeUnlocks(3).guaranteedRareBossDrop, true, 'rank3 해금');
});

test('rank10: 영구 스탯 ×2 (에테르 초월)', () => {
    assert.equal(getPrestigeUnlocks(10).statMult, BALANCE.PRESTIGE_R10_STAT_MULT);
    // 누적성: rank10은 하위 해금도 모두 보유
    const u = getPrestigeUnlocks(10);
    // feat/prestige-rank-ladder: rank≥8 "에테르 심화"가 essenceMult에 +10%p를 추가로
    //   누적시키므로(PRESTIGE_R8_ESSENCE_BONUS), rank10은 rank1(+10%)과 rank8(+10%)이
    //   모두 적용된 1.2가 정답. 기존 1.1 기대값은 rank4~9 사다리 도입 전 스냅샷이었다.
    assert.equal(u.essenceMult, 1 + BALANCE.PRESTIGE_ESSENCE_BONUS + BALANCE.PRESTIGE_R8_ESSENCE_BONUS);
    assert.equal(u.relicChoices, BALANCE.RELIC_CHOICE_BASE + 1);
    assert.equal(u.eliteChanceBonus, BALANCE.PRESTIGE_ELITE_BONUS);
});

test('단조성: rank가 오르면 해금이 사라지지 않음', () => {
    for (let r = 0; r < 12; r++) {
        const cur = getPrestigeUnlocks(r);
        const next = getPrestigeUnlocks(r + 1);
        assert.ok(next.essenceMult >= cur.essenceMult);
        assert.ok(next.maxRelics >= cur.maxRelics);
        assert.ok(next.relicChoices >= cur.relicChoices);
        assert.ok(next.eliteChanceBonus >= cur.eliteChanceBonus);
        assert.ok(next.statMult >= cur.statMult);
    }
});

test('방어적: undefined/null rank → rank0 취급', () => {
    assert.equal(getPrestigeUnlocks(undefined).statMult, 1);
    assert.equal(getPrestigeUnlocks(null).maxRelics, MAX_RELICS_PER_RUN);
});

// ── 통합: rank10 "에테르 초월" 영구 스탯 ×2 실제 적용 ──────────────────────
test('통합: rank10 → ATK 보너스 ×2 (statsCalculator)', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.ts');
    const base = {
        name: 'T', job: '전사', level: 50, hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20, equip: {}, relics: [], skillChoices: {}, titles: [], stats: {},
    };
    const r9 = calculateFullStats({ ...base, meta: { bonusAtk: 50, prestigeRank: 9 } });
    const r10 = calculateFullStats({ ...base, meta: { bonusAtk: 50, prestigeRank: 10 } });
    assert.ok(r10.atk > r9.atk, `rank10 atk(${r10.atk}) > rank9 atk(${r9.atk}) — bonusAtk ×2`);
});

test('통합: rank10 → HP/MP 보너스 ×2 (buildClassVitals)', async () => {
    const { buildClassVitals } = await import('../src/hooks/gameActions/_shared.ts');
    const r9 = buildClassVitals(50, '전사', { bonusHp: 100, bonusMp: 60, prestigeRank: 9 });
    const r10 = buildClassVitals(50, '전사', { bonusHp: 100, bonusMp: 60, prestigeRank: 10 });
    assert.equal(r10.maxHp - r9.maxHp, 100, 'rank10 bonusHp ×2 → +100 추가');
    assert.equal(r10.maxMp - r9.maxMp, 60, 'rank10 bonusMp ×2 → +60 추가');
});

// ── 통합: rank≥3 보스 희귀 보장 드롭 (PR #10) ────────────────────────────
test('통합: rank≥3 보스 처치 → 희귀(tier≥4) 장비 보장 (processLoot)', async () => {
    const { processLoot } = await import('../src/systems/CombatEngine.loot.ts');
    const orig = Math.random;
    Math.random = () => 0.99; // 다른 확률 드롭 억제 → 보장 블록만 검증
    try {
        // exp 180 → 추정 Lv34 → rareTier 4 (tier-4 장비 확실 존재). DROP_TABLES 미등록 이름.
        const boss = { name: '시험용 보스 XYZ', isBoss: true, exp: 180 };
        const { items } = processLoot(boss, { meta: { prestigeRank: 3 }, relics: [] }, 1);
        assert.ok(items.filter((i) => (i.tier || 1) >= 4).length >= 1, 'rank3 보스는 tier≥4 보장');
    } finally {
        Math.random = orig;
    }
});

test('통합: rank<3 보스 / rank≥3 비보스 → 보장 없음', async () => {
    const { processLoot } = await import('../src/systems/CombatEngine.loot.ts');
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const boss = { name: '시험용 보스 XYZ', isBoss: true, exp: 180 };
        const r2 = processLoot(boss, { meta: { prestigeRank: 2 }, relics: [] }, 1);
        assert.equal(r2.items.filter((i) => (i.tier || 1) >= 4).length, 0, 'rank2 보스 보장 없음');
        const trash = { name: '시험용 잡몹 XYZ', isBoss: false, exp: 180 };
        const r3 = processLoot(trash, { meta: { prestigeRank: 3 }, relics: [] }, 1);
        assert.equal(r3.items.filter((i) => (i.tier || 1) >= 4).length, 0, 'rank3 비보스 보장 없음');
    } finally {
        Math.random = orig;
    }
});
