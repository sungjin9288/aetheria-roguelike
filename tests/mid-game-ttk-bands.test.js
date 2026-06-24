import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';

/**
 * Slice 21: 중후반 TTK(Time-To-Kill) 밴드 가드
 *
 * Slice 19가 초반(Lv1-10) 템포를 실측 검증했지만 중후반(Lv10-50)은 수식상
 * 추정만 있었다. 이 테스트는 레벨 구간별 "기준 플레이어 vs 맵 레벨 몬스터"
 * TTK/TTD를 BALANCE 상수와 실제 아이템 DB에서 유도해 밴드로 가드한다.
 * 곡선 상수(MONSTER_HP_*, ATK_PER_LEVEL, 티어 아이템 수치)가 어긋나게
 * 변경되면 즉시 실패한다.
 *
 * 기준 플레이어 모델 (보수적):
 * - 레벨 P = 맵 레벨 + 2 (플레이어가 약간 앞서 진행)
 * - ATK = 시작 12 + (P-1)×ATK_PER_LEVEL + 10레벨 마일스톤 보너스
 *         + 해당 레벨 허용 최고 티어 무기 중앙값 × ONE_HAND_ATK_RATIO
 *   (유물/시너지/강화/직업 atkMod 제외 — 전부 상향 요인이므로 보수적)
 * - 스킬 배율 1.8 (Tier1-2 스킬 1.5-2.5의 보수 추정), 분산 하한 0.9
 * - DEF = 5 + (P-1)×DEF_PER_LEVEL + 티어 방어구 중앙값
 * - HP = START_HP + (P-1)×HP_PER_LEVEL + 마일스톤 HP
 *
 * 밴드 (모바일 텍스트 RPG 기준):
 * - TTK: 2~9턴 — 2턴 미만이면 깊이 없음, 9턴 초과면 지루함
 * - TTD/TTK ≥ 1.3 — 기준 빌드가 회복 없이도 여유 있게 이김
 * - 곡선 폭주 가드: Lv50 TTK ≤ Lv10 TTK × 2.5
 */

const medianTierVal = (items, maxTier) => {
    const eligible = items.filter((i) => (i.tier || 1) <= maxTier).filter((i) => typeof i.val === 'number');
    const topTier = Math.max(...eligible.map((i) => i.tier || 1));
    const vals = eligible.filter((i) => (i.tier || 1) === topTier).map((i) => i.val).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)] || 0;
};

const maxTierAt = (level) => {
    const entries = Object.entries(BALANCE.TIER_REQ_LEVEL)
        .filter(([, reqLv]) => level >= reqLv)
        .map(([tier]) => Number(tier));
    return Math.max(1, ...entries);
};

const baselinePlayer = (level) => {
    const majorMilestones = Math.floor(level / BALANCE.LEVEL_MAJOR_MILESTONE_EVERY);
    const tier = maxTierAt(level);
    const weaponVal = medianTierVal(DB.ITEMS.weapons, tier);
    const armorVal = medianTierVal(DB.ITEMS.armors, tier);
    return {
        level,
        atk: 12 + (level - 1) * BALANCE.ATK_PER_LEVEL
            + majorMilestones * BALANCE.MILESTONE_STAT_ATK
            + Math.floor(weaponVal * BALANCE.ONE_HAND_ATK_RATIO),
        def: 5 + (level - 1) * BALANCE.DEF_PER_LEVEL + armorVal,
        hp: CONSTANTS.START_HP + (level - 1) * BALANCE.HP_PER_LEVEL
            + majorMilestones * BALANCE.MILESTONE_STAT_HP,
    };
};

const monsterAt = (mapLevel) => ({
    hp: BALANCE.MONSTER_HP_BASE + mapLevel * BALANCE.MONSTER_HP_PER_LEVEL,
    atk: 15 + mapLevel * 4,
    // PR #3 (2026-06): 적 DEF가 spawnEnemy에서 실제로 설정되고 calculateDamage 출력이
    //   비율 경감되도록 수정됨. 이 모델도 def를 포함해야 실전 TTK를 충실히 가드한다.
    def: BALANCE.MONSTER_DEF_BASE + mapLevel * BALANCE.MONSTER_DEF_PER_LEVEL,
});

const SKILL_MULT = 1.8;

const ttkAt = (mapLevel) => {
    const player = baselinePlayer(mapLevel + 2);
    const monster = monsterAt(mapLevel);
    const rawHit = Math.floor(player.atk * BALANCE.DAMAGE_BASE_RATIO * SKILL_MULT);
    // PR #3: 적 DEF 비율 경감(mitigateByEnemyDef) 미러 — mitigated = max(1, floor(dmg×K/(K+def))).
    const K = BALANCE.ENEMY_DEF_K;
    const minHit = Math.max(1, Math.floor(rawHit * K / (K + monster.def)));
    return Math.ceil(monster.hp / Math.max(1, minHit));
};

const ttdAt = (mapLevel) => {
    const player = baselinePlayer(mapLevel + 2);
    const monster = monsterAt(mapLevel);
    const dmgPerTurn = Math.max(Math.floor(monster.atk * 0.10), monster.atk - player.def);
    return Math.ceil(player.hp / Math.max(1, dmgPerTurn));
};

const MAP_LEVELS = [10, 20, 30, 40, 50];

test('slice 21: 중후반 TTK 밴드 — 전 구간 2~9턴', () => {
    for (const mapLevel of MAP_LEVELS) {
        const ttk = ttkAt(mapLevel);
        assert.ok(ttk >= 2 && ttk <= 9,
            `맵 Lv${mapLevel}: TTK ${ttk}턴 — 밴드(2~9) 이탈`);
    }
});

test('slice 21: 생존 여유 — 전 구간 TTD/TTK ≥ 1.3', () => {
    for (const mapLevel of MAP_LEVELS) {
        const ttk = ttkAt(mapLevel);
        const ttd = ttdAt(mapLevel);
        const ratio = ttd / ttk;
        assert.ok(ratio >= 1.3,
            `맵 Lv${mapLevel}: TTD ${ttd} / TTK ${ttk} = ${ratio.toFixed(2)} — 1.3 미만 (기준 빌드가 못 이김)`);
    }
});

test('slice 21: 곡선 폭주 가드 — Lv50 TTK ≤ Lv10 TTK × 2.5', () => {
    const early = ttkAt(10);
    const late = ttkAt(50);
    assert.ok(late <= early * 2.5,
        `Lv10 TTK ${early} vs Lv50 TTK ${late} — 후반 곡선 폭주`);
});

test('slice 21: 곡선 데이터 계약 — 유도에 쓰인 상수/DB 존재', () => {
    assert.equal(typeof BALANCE.MONSTER_HP_BASE, 'number');
    assert.equal(typeof BALANCE.MONSTER_HP_PER_LEVEL, 'number');
    assert.equal(typeof BALANCE.MONSTER_DEF_BASE, 'number');
    assert.equal(typeof BALANCE.MONSTER_DEF_PER_LEVEL, 'number');
    assert.equal(typeof BALANCE.ENEMY_DEF_K, 'number');
    assert.equal(typeof BALANCE.ATK_PER_LEVEL, 'number');
    assert.ok(Array.isArray(DB.ITEMS.weapons) && DB.ITEMS.weapons.length > 0);
    assert.ok(Array.isArray(DB.ITEMS.armors) && DB.ITEMS.armors.length > 0);
    assert.ok(BALANCE.TIER_REQ_LEVEL[2] === 10, '티어2 해금 Lv10 (모델 가정)');
});
