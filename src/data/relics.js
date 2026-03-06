/**
 * 유물 시스템 (Relic System) — v4.0
 * 런마다 탐색 중 최대 5개 유물을 3지선다로 획득. 사망/리셋 시 소멸.
 * Slay the Spire 방식의 로그라이크 런 빌드 핵심.
 */

export const RELICS = [
    // ─── 공격 계열 (8개) ───────────────────────────────────────────────────
    {
        id: 'blood_pact',
        name: '피의 서약',
        rarity: 'common',
        desc: '적 처치 시 최대 HP의 3% 회복',
        effect: 'on_kill_heal',
        val: 0.03,
    },
    {
        id: 'void_shard',
        name: '허공의 파편',
        rarity: 'common',
        desc: 'ATK 20% 증가, DEF 15% 감소',
        effect: 'glass_cannon',
        val: { atk: 0.2, def: -0.15 },
    },
    {
        id: 'berserker',
        name: '광전사의 분노',
        rarity: 'uncommon',
        desc: 'HP 30% 미만일 때 ATK 40% 증가',
        effect: 'low_hp_atk',
        val: { threshold: 0.3, bonus: 0.4 },
    },
    {
        id: 'executioner',
        name: '처형자의 날',
        rarity: 'uncommon',
        desc: '적 HP 25% 미만일 때 피해 50% 증가',
        effect: 'execute_bonus',
        val: { threshold: 0.25, mult: 0.5 },
    },
    {
        id: 'twin_blades',
        name: '쌍검 각인',
        rarity: 'rare',
        desc: '일반 공격 2회 타격 (각 60% 위력)',
        effect: 'double_strike',
        val: 0.6,
    },
    {
        id: 'soul_drain',
        name: '영혼 흡수',
        rarity: 'rare',
        desc: '스킬 피해의 10% HP 흡수',
        effect: 'skill_lifesteal',
        val: 0.1,
    },
    {
        id: 'bloodthirst',
        name: '피의 갈증',
        rarity: 'epic',
        desc: '치명타 시 MP 15 회복',
        effect: 'crit_mp_regen',
        val: 15,
    },
    {
        id: 'ancient_fury',
        name: '고대의 분노',
        rarity: 'epic',
        desc: 'ATK 35% 증가, 크리티컬 확률 +15%',
        effect: 'ancient_power',
        val: { atk: 0.35, crit: 0.15 },
    },

    // ─── 방어/생존 계열 (6개) ──────────────────────────────────────────────
    {
        id: 'iron_will',
        name: '강철 의지',
        rarity: 'common',
        desc: '30% 확률로 치명타 피해 무효화',
        effect: 'crit_block',
        val: 0.3,
    },
    {
        id: 'stone_skin',
        name: '암석 피부',
        rarity: 'common',
        desc: 'DEF 25% 증가',
        effect: 'stone_skin',
        val: 0.25,
    },
    {
        id: 'thorns',
        name: '가시 갑옷',
        rarity: 'uncommon',
        desc: '피격 시 적에게 DEF의 30% 반사 피해',
        effect: 'reflect',
        val: 0.3,
    },
    {
        id: 'undying',
        name: '불사의 의지',
        rarity: 'uncommon',
        desc: '전투당 1회 HP 1 이하 방지',
        effect: 'death_save',
        val: 1,
    },
    {
        id: 'regen_core',
        name: '재생 코어',
        rarity: 'rare',
        desc: '전투 시작 시 최대 HP 15% 회복',
        effect: 'battle_start_heal',
        val: 0.15,
    },
    {
        id: 'fortress',
        name: '난공불락',
        rarity: 'epic',
        desc: 'DEF 50%, 최대 HP 20% 동시 증가',
        effect: 'fortress',
        val: { def: 0.5, hp: 0.2 },
    },

    // ─── 마법/MP 계열 (4개) ────────────────────────────────────────────────
    {
        id: 'mana_crystal',
        name: '마나 수정',
        rarity: 'common',
        desc: '최대 MP 25% 증가',
        effect: 'mp_mult',
        val: 0.25,
    },
    {
        id: 'spell_echo',
        name: '주문 메아리',
        rarity: 'uncommon',
        desc: '스킬 사용 시 15% 확률로 MP 소모 없음',
        effect: 'free_skill',
        val: 0.15,
    },
    {
        id: 'arcane_surge',
        name: '비전 서지',
        rarity: 'rare',
        desc: '전투 턴마다 MP 5 자연 회복',
        effect: 'mp_regen_turn',
        val: 5,
    },
    {
        id: 'mind_burn',
        name: '정신 연소',
        rarity: 'epic',
        desc: '스킬 피해 70% 추가 증가',
        effect: 'skill_mult',
        val: 0.7,
    },

    // ─── 탐색/유틸 계열 (6개) ─────────────────────────────────────────────
    {
        id: 'ancient_map',
        name: '고대 지도',
        rarity: 'common',
        desc: '이벤트 발생률 60% 증가',
        effect: 'event_chance',
        val: 0.6,
    },
    {
        id: 'gold_magnet',
        name: '황금 자석',
        rarity: 'common',
        desc: '골드 획득 30% 증가',
        effect: 'gold_mult',
        val: 0.3,
    },
    {
        id: 'exp_amplifier',
        name: 'EXP 증폭기',
        rarity: 'uncommon',
        desc: 'EXP 획득 40% 증가',
        effect: 'exp_mult',
        val: 0.4,
    },
    {
        id: 'lucky_coin',
        name: '행운의 동전',
        rarity: 'uncommon',
        desc: '아이템 드롭률 50% 증가',
        effect: 'drop_rate',
        val: 0.5,
    },
    {
        id: 'cursed_ring',
        name: '저주받은 반지',
        rarity: 'rare',
        desc: 'ATK 60% 증가, 매 전투 시작 시 HP 10% 감소',
        effect: 'cursed_power',
        val: { atk: 0.6, hp_cost: 0.1 },
    },
    {
        id: 'void_eye',
        name: '허공의 눈',
        rarity: 'epic',
        desc: '보스 발견 확률 3배, 보스 드롭 100% 증가',
        effect: 'boss_hunter',
        val: { spawn: 3, drop: 1.0 },
    },

    // ─── 특수 계열 (6개) ───────────────────────────────────────────────────
    {
        id: 'combo_ring',
        name: '연격의 반지',
        rarity: 'uncommon',
        desc: '3연속 공격 후 다음 공격 피해 100% 증가',
        effect: 'combo_stack',
        val: { stack: 3, bonus: 1.0 },
    },
    {
        id: 'death_mark',
        name: '죽음의 낙인',
        rarity: 'rare',
        desc: '상태이상(독/화상) 피해 3배',
        effect: 'dot_mult',
        val: 3.0,
    },
    {
        id: 'phantom_blade',
        name: '유령 검',
        rarity: 'rare',
        desc: '공격 시 적 DEF 30% 무시',
        effect: 'armor_pen',
        val: 0.3,
    },
    {
        id: 'chaos_gem',
        name: '혼돈의 보석',
        rarity: 'epic',
        desc: '전투 시작 시 무작위 버프 (ATK 또는 DEF +30%)',
        effect: 'chaos_buff',
        val: 0.3,
    },
    {
        id: 'omega_core',
        name: '오메가 코어',
        rarity: 'legendary',
        desc: '전 스탯 25%, 크리티컬 확률 25% 동시 증가',
        effect: 'omega',
        val: 0.25,
    },
    {
        id: 'void_heart',
        name: '허공의 심장',
        rarity: 'legendary',
        desc: '런당 1회 사망 직전 HP 1로 생존, 이후 첫 공격 피해 300%',
        effect: 'void_heart',
        val: { survive: 1, dmg_mult: 3.0 },
    },
];

/** 희귀도별 가중치 (가중 추첨) */
export const RELIC_WEIGHTS = Object.freeze({
    common: 50,
    uncommon: 30,
    rare: 15,
    epic: 4,
    legendary: 1,
});

/** 런당 최대 유물 보유 수 */
export const MAX_RELICS_PER_RUN = 5;

/**
 * 가중치 기반 무작위 유물 N개 선택 (중복 없음)
 * @param {object[]} pool - 선택 가능한 유물 목록
 * @param {number}   count - 뽑을 개수
 * @returns {object[]} 선택된 유물 배열
 */
export const pickWeightedRelics = (pool, count = 3) => {
    if (pool.length === 0) return [];
    const result = [];
    const remaining = [...pool];
    const needed = Math.min(count, remaining.length);

    for (let i = 0; i < needed; i++) {
        const totalWeight = remaining.reduce((sum, r) => sum + (RELIC_WEIGHTS[r.rarity] || 1), 0);
        let rand = Math.random() * totalWeight;
        let chosen = remaining[remaining.length - 1]; // fallback
        for (let j = 0; j < remaining.length; j++) {
            rand -= RELIC_WEIGHTS[remaining[j].rarity] || 1;
            if (rand <= 0) { chosen = remaining[j]; break; }
        }
        result.push(chosen);
        remaining.splice(remaining.indexOf(chosen), 1);
    }
    return result;
};
