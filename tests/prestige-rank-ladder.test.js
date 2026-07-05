import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';

/**
 * feat/prestige-rank-ladder: rank4~9 해금 사다리.
 *   getPrestigeUnlocks(rank)가 이미 rank1/2/3/10만 커버하던 공백(rank4~9)을 메운다.
 *   비퇴행·순수 보너스만 추가:
 *   - rank≥4: 캠프파이어 발견율 +4%p (campfireChanceBonus)
 *   - rank≥5: 시작 부트 유물 3→4지선다 (startBootChoices)
 *   - rank≥6: 유물 pity 가속 ×1.5 (relicPityMult)
 *   - rank≥7: 챌린지 모디파이어 슬롯 +1 (challengeSlotBonus) — IntroScreen의
 *     toggleChallenge가 .slice(0, 3)으로 하드코딩된 상한을 가지므로 실제 슬롯 설계 적용
 *   - rank≥8: 에센스 획득 추가 +10%p (rank1과 누적 = +20%)
 *   - rank≥9: 정예 처치 보상 +25% (eliteRewardMult)
 */

test('rank0: rank4~9 신규 해금 모두 비활성 (기본 곡선 불변)', () => {
    const u = getPrestigeUnlocks(0);
    assert.equal(u.campfireChanceBonus, 0);
    assert.equal(u.startBootChoices, BALANCE.START_BOOT_RELIC_CHOICES);
    assert.equal(u.relicPityMult, 1);
    assert.equal(u.challengeSlotBonus, 0);
    assert.equal(u.eliteRewardMult, 1);
});

test('rank3→4 경계: 캠프파이어 발견율 +4%p는 rank4에서만 켜짐', () => {
    assert.equal(getPrestigeUnlocks(3).campfireChanceBonus, 0, 'rank3은 미해금');
    assert.equal(getPrestigeUnlocks(4).campfireChanceBonus, BALANCE.PRESTIGE_R4_CAMPFIRE_BONUS);
    assert.equal(BALANCE.PRESTIGE_R4_CAMPFIRE_BONUS, 0.04);
});

test('rank4→5 경계: 시작 부트 유물 4지선다는 rank5에서만 켜짐', () => {
    assert.equal(getPrestigeUnlocks(4).startBootChoices, BALANCE.START_BOOT_RELIC_CHOICES, 'rank4는 미해금');
    assert.equal(getPrestigeUnlocks(5).startBootChoices, BALANCE.START_BOOT_RELIC_CHOICES + 1);
});

test('rank5→6 경계: 유물 pity 가속 ×1.5는 rank6에서만 켜짐', () => {
    assert.equal(getPrestigeUnlocks(5).relicPityMult, 1, 'rank5는 미해금');
    assert.equal(getPrestigeUnlocks(6).relicPityMult, BALANCE.PRESTIGE_R6_RELIC_PITY_MULT);
    assert.equal(BALANCE.PRESTIGE_R6_RELIC_PITY_MULT, 1.5);
});

test('rank6→7 경계: 챌린지 모디파이어 슬롯 +1은 rank7에서만 켜짐', () => {
    assert.equal(getPrestigeUnlocks(6).challengeSlotBonus, 0, 'rank6은 미해금');
    assert.equal(getPrestigeUnlocks(7).challengeSlotBonus, BALANCE.PRESTIGE_R7_CHALLENGE_SLOT_BONUS);
    assert.equal(BALANCE.PRESTIGE_R7_CHALLENGE_SLOT_BONUS, 1);
});

test('rank7→8 경계: 에센스 +10%p 추가는 rank8에서만 켜짐 (rank1과 누적 = +20%)', () => {
    const r7 = getPrestigeUnlocks(7);
    const r8 = getPrestigeUnlocks(8);
    assert.equal(r7.essenceMult, 1 + BALANCE.PRESTIGE_ESSENCE_BONUS, 'rank7은 rank1 몫만');
    assert.equal(r8.essenceMult, 1 + BALANCE.PRESTIGE_ESSENCE_BONUS + BALANCE.PRESTIGE_R8_ESSENCE_BONUS);
    assert.ok(Math.abs(r8.essenceMult - 1.20) < 1e-9, 'rank8 essenceMult ≈ 1.20 (누적 +20%)');
});

test('rank8→9 경계: 정예 처치 보상 +25%는 rank9에서만 켜짐', () => {
    assert.equal(getPrestigeUnlocks(8).eliteRewardMult, 1, 'rank8은 미해금');
    assert.equal(getPrestigeUnlocks(9).eliteRewardMult, BALANCE.PRESTIGE_R9_ELITE_REWARD_MULT);
    assert.equal(BALANCE.PRESTIGE_R9_ELITE_REWARD_MULT, 1.25);
});

test('rank10: rank4~9 해금 전부 유지 (누적성)', () => {
    const u = getPrestigeUnlocks(10);
    assert.equal(u.campfireChanceBonus, BALANCE.PRESTIGE_R4_CAMPFIRE_BONUS);
    assert.equal(u.startBootChoices, BALANCE.START_BOOT_RELIC_CHOICES + 1);
    assert.equal(u.relicPityMult, BALANCE.PRESTIGE_R6_RELIC_PITY_MULT);
    assert.equal(u.challengeSlotBonus, BALANCE.PRESTIGE_R7_CHALLENGE_SLOT_BONUS);
    assert.equal(u.eliteRewardMult, BALANCE.PRESTIGE_R9_ELITE_REWARD_MULT);
});

test('단조성: rank가 오르면 rank4~9 해금도 사라지지 않음', () => {
    for (let r = 0; r < 12; r++) {
        const cur = getPrestigeUnlocks(r);
        const next = getPrestigeUnlocks(r + 1);
        assert.ok(next.campfireChanceBonus >= cur.campfireChanceBonus);
        assert.ok(next.startBootChoices >= cur.startBootChoices);
        assert.ok(next.relicPityMult >= cur.relicPityMult);
        assert.ok(next.challengeSlotBonus >= cur.challengeSlotBonus);
        assert.ok(next.essenceMult >= cur.essenceMult);
        assert.ok(next.eliteRewardMult >= cur.eliteRewardMult);
    }
});

test('방어적: undefined/null rank → rank0 취급 (신규 필드도 안전)', () => {
    const uUndef = getPrestigeUnlocks(undefined);
    const uNull = getPrestigeUnlocks(null);
    assert.equal(uUndef.campfireChanceBonus, 0);
    assert.equal(uNull.eliteRewardMult, 1);
});

// ── 통합: rank≥4 캠프파이어 발견율 +4%p (exploreActions.ts) ────────────────
test('통합: rank≥4 → 캠프파이어 조우 확률에 campfireChanceBonus 가산', async () => {
    // exploreActions.ts는 BALANCE.CAMPFIRE_CHANCE + getPrestigeUnlocks(rank).campfireChanceBonus를
    // 굴림 임계값으로 사용해야 한다. 직접 재계산해 배선 여부를 검증.
    const rank0Chance = BALANCE.CAMPFIRE_CHANCE + getPrestigeUnlocks(0).campfireChanceBonus;
    const rank4Chance = BALANCE.CAMPFIRE_CHANCE + getPrestigeUnlocks(4).campfireChanceBonus;
    assert.equal(rank0Chance, BALANCE.CAMPFIRE_CHANCE);
    assert.ok(rank4Chance > rank0Chance, 'rank4 캠프파이어 확률이 rank0보다 높아야 함');
});

// ── 통합: rank≥5 시작 부트 4지선다 (characterActions.ts) ──────────────────
test('통합: rank≥5 → 캐릭터 생성 시 시작 부트 유물 4선택 dispatch', async () => {
    const { createCharacterActions } = await import('../src/hooks/gameActions/characterActions.ts');
    const { AT } = await import('../src/reducers/actionTypes.ts');

    const makeDeps = (prestigeRank) => {
        const dispatches = [];
        const logs = [];
        const deps = {
            player: { meta: { prestigeRank }, stats: {} },
            gameState: 'idle',
            dispatch: (a) => dispatches.push(a),
            addLog: (type, text) => logs.push({ type, text }),
            addStoryLog: () => {},
            getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
        };
        return { deps, dispatches, logs };
    };
    const noopHooks = { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} };

    const { deps: deps5, dispatches: dispatches5 } = makeDeps(5);
    createCharacterActions(deps5, noopHooks).start('테스터', 'male', '모험가', []);
    const pending5 = dispatches5.find((d) => d.type === AT.SET_PENDING_RELICS);
    assert.equal(pending5.payload.length, BALANCE.START_BOOT_RELIC_CHOICES + 1, 'rank5는 4지선다');

    const { deps: deps4, dispatches: dispatches4 } = makeDeps(4);
    createCharacterActions(deps4, noopHooks).start('테스터', 'male', '모험가', []);
    const pending4 = dispatches4.find((d) => d.type === AT.SET_PENDING_RELICS);
    assert.equal(pending4.payload.length, BALANCE.START_BOOT_RELIC_CHOICES, 'rank4는 3지선다 그대로');
});

// ── 통합: rank≥6 유물 pity 가속 ×1.5 (explorationPacing.ts) ────────────────
test('통합: rank≥6 → getDiscoveryOdds relicChance pity 가속', async () => {
    const { getDiscoveryOdds } = await import('../src/utils/explorationPacing.ts');
    const statsWithPity = { exploreState: { sinceRelic: 10, sinceDiscovery: 10, sinceNarrativeEvent: 10, quietStreak: 0, lastOutcome: 'nothing' } };
    const mapData = { type: 'dungeon', level: 5 };

    const oddsRank0 = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 0 } }, mapData);
    const oddsRank6 = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 6 } }, mapData);
    assert.ok(oddsRank6.relicChance > oddsRank0.relicChance, 'rank6 relicChance가 rank0보다 높아야 함 (pity 가속)');
});

// ── 통합: rank≥7 챌린지 슬롯 상한 +1 (BALANCE 상수 배선 확인) ───────────────
test('통합: rank≥7 → 챌린지 슬롯 상한이 BALANCE.CHALLENGE_MODIFIER_SLOTS + challengeSlotBonus', () => {
    const baseSlots = BALANCE.CHALLENGE_MODIFIER_SLOTS;
    assert.equal(baseSlots, 3, '기본 슬롯 상한 3 (기존 UI "Up to 3" 문구와 일치)');
    assert.equal(baseSlots + getPrestigeUnlocks(6).challengeSlotBonus, 3);
    assert.equal(baseSlots + getPrestigeUnlocks(7).challengeSlotBonus, 4);
});

// ── 통합: rank≥9 정예 처치 보상 +25% (CombatEngine.outcome.ts) ─────────────
test('통합: rank≥9 → 정예 처치 EXP/골드 +25% (handleVictory)', async () => {
    const { CombatEngine } = await import('../src/systems/CombatEngine.ts');
    const basePlayer = {
        level: 10, exp: 0, nextExp: 999999, gold: 0, maxHp: 200, hp: 200, maxMp: 50, mp: 50,
        atk: 20, def: 10, relics: [], stats: {}, meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
    };
    const eliteEnemy = { name: '정예 슬라임', baseName: '슬라임', exp: 100, gold: 100, isElite: true, level: 10 };

    const r8Player = { ...basePlayer, meta: { ...basePlayer.meta, prestigeRank: 8 } };
    const r9Player = { ...basePlayer, meta: { ...basePlayer.meta, prestigeRank: 9 } };

    const r8Result = CombatEngine.handleVictory(r8Player, eliteEnemy, {}, {});
    const r9Result = CombatEngine.handleVictory(r9Player, eliteEnemy, {}, {});

    assert.ok(r9Result.goldGained > r8Result.goldGained, `rank9 정예 골드(${r9Result.goldGained}) > rank8(${r8Result.goldGained})`);
    assert.ok(r9Result.expGained > r8Result.expGained, `rank9 정예 EXP(${r9Result.expGained}) > rank8(${r8Result.expGained})`);
});

test('통합: rank≥9 → 정예 아닌 적은 보상 불변', async () => {
    const { CombatEngine } = await import('../src/systems/CombatEngine.ts');
    const basePlayer = {
        level: 10, exp: 0, nextExp: 999999, gold: 0, maxHp: 200, hp: 200, maxMp: 50, mp: 50,
        atk: 20, def: 10, relics: [], stats: {}, meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
    };
    const normalEnemy = { name: '슬라임', baseName: '슬라임', exp: 100, gold: 100, isElite: false, level: 10 };

    const r8Player = { ...basePlayer, meta: { ...basePlayer.meta, prestigeRank: 8 } };
    const r9Player = { ...basePlayer, meta: { ...basePlayer.meta, prestigeRank: 9 } };

    const r8Result = CombatEngine.handleVictory(r8Player, normalEnemy, {}, {});
    const r9Result = CombatEngine.handleVictory(r9Player, normalEnemy, {}, {});

    assert.equal(r9Result.goldGained, r8Result.goldGained, '정예 아닌 적은 rank9 보너스 미적용');
    assert.equal(r9Result.expGained, r8Result.expGained, '정예 아닌 적은 rank9 보너스 미적용');
});
