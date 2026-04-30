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
        desc: '전 스탯 15%, 크리티컬 확률 15% 동시 증가',
        effect: 'omega',
        val: 0.15,
    },
    // ── Sprint 19: 신규 유물 15종 ────────────────────────────────────────────
    { id: 'time_shard',      name: '시간의 파편',   rarity: 'epic',      desc: '스킬 쿨타임 -1 (모든 스킬)', effect: 'cd_minus', val: 1 },
    { id: 'soul_collector',  name: '영혼 수집가',   rarity: 'legendary', desc: '처치 50마리당 ATK +25 스택', effect: 'kill_stack', stackPer: 50, stackVal: 25 },
    { id: 'chaos_heart',     name: '혼돈의 심장',   rarity: 'legendary', desc: '전투마다 랜덤 유물 효과 발동', effect: 'chaos_relic' },
    { id: 'prophecy_stone',  name: '예언의 돌판',   rarity: 'epic',      desc: '보스 HP 25% 이하 시 ATK 2배', effect: 'execute_atk', val: 2.0, threshold: 0.25 },
    { id: 'curse_crystal',   name: '저주의 결정',   rarity: 'rare',      desc: '상태이상 피해 +50%', effect: 'dot_mult', val: 1.5 },
    { id: 'time_ring',       name: '시공의 반지',   rarity: 'epic',      desc: '스킬 발동 시 15% 확률 쿨타임 소모 없음', effect: 'free_skill', val: 0.15 },
    { id: 'blood_moon',      name: '피의 달',       rarity: 'rare',      desc: 'HP 25% 이하 시 모든 피해 +40%', effect: 'low_hp_dmg', val: 1.4, threshold: 0.25 },
    { id: 'dragon_claw',     name: '드래곤 발톱',   rarity: 'epic',      desc: '크리티컬 피해 +60%', effect: 'crit_dmg', val: 1.6 },
    { id: 'phantom_core',    name: '환영 핵',       rarity: 'rare',      desc: '매 전투 시작 시 ATK +15%', effect: 'battle_start_atk', val: 0.15 },
    { id: 'void_echo',       name: '공허의 메아리', rarity: 'epic',      desc: '스킬 사용 후 다음 일반 공격 피해 +80%', effect: 'echo_atk', val: 1.8 },
    { id: 'ancient_seal',    name: '고대의 봉인',   rarity: 'rare',      desc: '상태이상 저항 +40%', effect: 'status_resist', val: 0.4 },
    { id: 'star_core',       name: '별의 핵',       rarity: 'legendary', desc: '전투 종료 시 MP 전량 회복', effect: 'mp_restore_battle' },
    { id: 'twin_blade',      name: '쌍검의 혼',     rarity: 'rare',      desc: '이중 무기 장착 시 크리티컬 +15%', effect: 'dual_crit', val: 0.15 },
    { id: 'earth_heart',     name: '대지의 심장',   rarity: 'epic',      desc: '최대 HP의 5%를 매 턴 회복', effect: 'regen', val: 0.05 },
    { id: 'rune_crown',      name: '룬 왕관',       rarity: 'legendary', desc: 'ATK +15%, DEF +15%, MP +40%', effect: 'triple_up', atkVal: 0.15, defVal: 0.15, mpVal: 40 },

    // ── 신규 유물 8종 (구조 개선) ──────────────────────────────────────────
    { id: 'frost_anchor',   name: '동결의 닻',     rarity: 'rare',      desc: '공격 시 15% 확률로 적 1턴 빙결', effect: 'on_hit_freeze', val: 0.15 },
    { id: 'shadow_cloak',   name: '그림자 망토',   rarity: 'uncommon',  desc: '전투 첫 턴 회피 보장, DEF +10%', effect: 'first_turn_evade', val: 0.1 },
    { id: 'war_drum',       name: '전쟁의 북',     rarity: 'uncommon',  desc: '전투 시작 시 ATK +20% (2턴)', effect: 'battle_start_buff', val: { atk: 0.2, turns: 2 } },
    { id: 'soul_lantern',   name: '영혼 등불',     rarity: 'rare',      desc: '처치 시 EXP +25%, 골드 +15%', effect: 'kill_bonus', val: { exp: 0.25, gold: 0.15 } },
    { id: 'titan_belt',     name: '타이탄의 허리띠', rarity: 'epic',    desc: '최대 HP +30%, 받는 치명타 피해 -50%', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
    { id: 'spell_weaver',   name: '주문 직조자',   rarity: 'epic',      desc: '스킬 연속 사용 시 피해 +20% 누적 (최대 60%)', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } },
    { id: 'blood_oath_ring', name: '혈맹의 반지',  rarity: 'rare',      desc: '매 턴 HP 3% 소모, ATK +35%', effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } },
    { id: 'prism_core',     name: '프리즘 핵',     rarity: 'legendary', desc: '모든 속성 약점 적중 배율 1.25→1.5', effect: 'elem_boost', val: 0.25 },

    {
        id: 'void_heart',
        name: '허공의 심장',
        rarity: 'legendary',
        desc: '런당 1회 사망 직전 HP 1로 생존, 이후 첫 공격 피해 300%',
        effect: 'void_heart',
        val: { survive: 1, dmg_mult: 3.0 },
    },

    // ─── 전설 유물 추가 (8개) ────────────────────────────────────────────────
    {
        id: 'genesis_core',
        name: '창세의 핵',
        rarity: 'legendary',
        desc: '전투 시작 시 전 스탯 15% 증가, 매 턴 HP 2% 회복',
        effect: 'genesis',
        val: { statBonus: 0.15, healPerTurn: 0.02 },
    },
    {
        id: 'void_monarch',
        name: '허공의 왕좌',
        rarity: 'legendary',
        desc: '적 처치 시 ATK 5% 영구 누적 (전투 내, 최대 50%)',
        effect: 'kill_stack_atk',
        val: { perKill: 0.05, max: 0.5 },
    },
    {
        id: 'time_lord_crown',
        name: '시간 군주의 왕관',
        rarity: 'legendary',
        desc: '스킬 쿨다운 1턴 감소, 첫 스킬 MP 무소비',
        effect: 'cooldown_reduce',
        val: { cdReduction: 1, firstFree: true },
    },
    {
        id: 'phoenix_feather',
        name: '불사조의 깃털',
        rarity: 'legendary',
        desc: 'HP 0 도달 시 1회 부활 (HP 30% 회복), 부활 시 3턴 ATK 50% 증가',
        effect: 'phoenix_revive',
        val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 },
    },
    {
        id: 'abyssal_contract',
        name: '심연의 계약',
        rarity: 'legendary',
        desc: '매 턴 최대 HP의 5% 소모, ATK 60% 증가',
        effect: 'hp_drain_atk',
        val: { hpCost: 0.05, atkBonus: 0.6 },
    },
    {
        id: 'mirror_of_fate',
        name: '운명의 거울',
        rarity: 'legendary',
        desc: '받는 피해의 30%를 적에게 반사, 크리티컬 확률 15% 증가',
        effect: 'reflect_crit',
        val: { reflect: 0.3, critBonus: 0.15 },
    },
    {
        id: 'world_eater',
        name: '세계 포식자',
        rarity: 'legendary',
        desc: '적 처치 시 적 최대 HP의 10%만큼 자신의 최대 HP 증가 (전투 내)',
        effect: 'devour_hp',
        val: 0.1,
    },
    {
        id: 'entropy_engine',
        name: '엔트로피 엔진',
        rarity: 'legendary',
        desc: '매 3턴마다 적에게 최대 HP의 8% 고정 피해',
        effect: 'entropy_tick',
        val: { interval: 3, damage: 0.08 },
    },

    // ── 심연 전용 유물 ──────────────────────────────────────────────────────────
    {
        id: 'abyss_resonance',
        name: '심연의 공명',
        rarity: 'epic',
        desc: '심연 층수 10층마다 ATK +3%, 최대 +60% (심연 내에서만)',
        effect: 'abyss_atk_scale',
        val: { perFloors: 10, atkPer: 0.03, maxBonus: 0.6 },
    },
    {
        id: 'void_crystal',
        name: '공허의 결정',
        rarity: 'epic',
        desc: '심연 층수 5층마다 크리티컬 확률 +1%, 최대 +20%',
        effect: 'abyss_crit_scale',
        val: { perFloors: 5, critPer: 0.01, maxBonus: 0.2 },
    },
    {
        id: 'abyssal_dominion',
        name: '심연의 지배',
        rarity: 'legendary',
        desc: '심연 30층 이상에서 ATK +40%, DEF +30% 영구 적용',
        effect: 'abyss_floor_power',
        val: { minFloor: 30, atkBonus: 0.4, defBonus: 0.3 },
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
/**
 * 유물 시너지 정의 (Sprint 19)
 * requires: 두 유물 name이 모두 보유 시 bonus 적용
 */
export const RELIC_SYNERGIES = Object.freeze([
    {
        id: 'vampire_lord',
        label: '흡혈 군주',
        requires: ['피의 서약', '영혼 흡수'],
        bonus: { effect: 'vampire_lord', atkMult: 0.2, lifeSteal: 0.5 },
        desc: 'ATK +20%, 모든 공격 50% 흡혈',
    },
    {
        id: 'arcane_surge',
        label: '비전 파동',
        requires: ['마나 수정', '주문 메아리'],
        bonus: { effect: 'arcane_surge', mpMult: 0.3 },
        desc: '최대 MP +30%, 스킬 무료 확률 두 배',
    },
    {
        id: 'unbreakable',
        label: '난공불락',
        requires: ['강철 의지', '난공불락'],
        bonus: { effect: 'unbreakable', healOnSave: 0.3 },
        desc: '사망 방지 발동 시 최대 HP의 30% 회복',
    },
    {
        id: 'time_master',
        label: '시간 지배자',
        requires: ['시간의 파편', '시공의 반지'],
        bonus: { effect: 'time_master', extraTurnChance: 0.1 },
        desc: '스킬 사용 후 10% 확률로 추가 행동',
    },
    {
        id: 'death_oracle',
        label: '죽음의 예언자',
        requires: ['죽음의 낙인', '저주의 결정'],
        bonus: { effect: 'death_oracle', dotMult: 0.5 },
        desc: '모든 지속 피해 +50% 추가 증폭',
    },
    // ─── 신규 시너지 (10개) ──────────────────────────────────────────────────
    {
        id: 'immortal_warrior',
        label: '불멸의 전사',
        requires: ['불사조의 깃털', '피의 서약'],
        bonus: { effect: 'immortal_warrior', reviveHeal: 0.5, killHeal: 0.05 },
        desc: '부활 시 HP 50%로 증가, 적 처치 회복 5%',
    },
    {
        id: 'hell_reaper',
        label: '지옥의 수확자',
        requires: ['심연의 계약', '영혼 흡수'],
        bonus: { effect: 'hell_reaper', hpCostReduction: 0.02, lifeStealBonus: 0.5 },
        desc: 'HP 소모 3%로 감소, 흡혈 50% 증가',
    },
    {
        id: 'annihilator',
        label: '절멸자',
        requires: ['허공의 왕좌', '처형자의 날'],
        bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 },
        desc: '처형 임계치 35%, 킬 스택 7%로 증가',
    },
    {
        id: 'eternal_life',
        label: '영원의 생명',
        requires: ['창세의 핵', '재생 코어'],
        bonus: { effect: 'eternal_life', healPerTurn: 0.04, statBonus: 0.2 },
        desc: '매 턴 회복 4%, 전 스탯 20% 증가',
    },
    {
        id: 'time_dominator',
        label: '시간의 지배자 (강화)',
        requires: ['시간 군주의 왕관', '시간의 파편'],
        bonus: { effect: 'time_dominator', cdReduction: 2, extraAction: 0.3 },
        desc: '쿨다운 2턴 감소, 추가 행동 확률 30%',
    },
    {
        id: 'absolute_reflect',
        label: '절대 반사',
        requires: ['운명의 거울', '가시 갑옷'],
        bonus: { effect: 'absolute_reflect', reflect: 0.5, stunOnReflect: 0.25 },
        desc: '반사 피해 50%, 반사 시 적 스턴 25%',
    },
    {
        id: 'entropy_brand',
        label: '엔트로피 낙인',
        requires: ['엔트로피 엔진', '죽음의 낙인'],
        bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 },
        desc: '고정 피해 12%, 간격 2턴으로 단축',
    },
    {
        id: 'infinite_devour',
        label: '무한 포식',
        requires: ['세계 포식자', '광전사의 분노'],
        bonus: { effect: 'infinite_devour', devour: 0.15, lowHpAtk: 0.6 },
        desc: 'HP 포식 15%, 저HP ATK 보너스 60%',
    },
    {
        id: 'void_dragon',
        label: '공허의 용',
        requires: ['허공의 왕좌', '드래곤 발톱'],
        bonus: { effect: 'void_dragon', killStack: 0.08, critDmg: 2.0 },
        desc: '킬 스택 ATK 8%, 크리 추가 피해 2배',
    },
    {
        id: 'absolute_immortal',
        label: '절대 불사',
        requires: ['불사조의 깃털', '불사의 의지'],
        bonus: { effect: 'absolute_immortal', reviveCount: 2, reviveHeal: 0.5 },
        desc: '부활 2회 가능, 부활 시 HP 50% 회복',
    },
    // ─── 3피스 전설 시너지 (5개) ──────────────────────────────────────────
    {
        id: 'blood_immortal',
        label: '혈맹 불사',
        requires: ['피의 서약', '영혼 흡수', '허공의 심장'],
        bonus: { effect: 'blood_immortal', lifeSteal: 1.0, reviveHeal: 0.5 },
        desc: '모든 공격 100% 흡혈, 부활 시 HP 50% 회복',
    },
    {
        id: 'arcane_singularity',
        label: '비전 특이점',
        requires: ['마나 수정', '주문 메아리', '정신 연소'],
        bonus: { effect: 'arcane_singularity', freeSkillChance: 0.35, skillMult: 0.3 },
        desc: '스킬 무료 확률 35%, 스킬 피해 +30% 추가',
    },
    {
        id: 'primordial_wrath',
        label: '원초의 분노',
        requires: ['고대의 분노', '드래곤 발톱', '광전사의 분노'],
        bonus: { effect: 'primordial_wrath', critChance: 0.25, critDmg: 2.5, lowHpAtk: 0.8 },
        desc: '크리 확률 +25%, 크리 피해 2.5배, 저HP ATK +80%',
    },
    {
        id: 'eternal_fortress',
        label: '영원의 요새',
        requires: ['난공불락', '암석 피부', '대지의 심장'],
        bonus: { effect: 'eternal_fortress', defMult: 0.8, regenPerTurn: 0.08 },
        desc: 'DEF +80%, 매 턴 HP 8% 재생',
    },
    {
        id: 'entropy_god',
        label: '엔트로피의 신',
        requires: ['엔트로피 엔진', '죽음의 낙인', '혼돈의 보석'],
        bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 },
        desc: '매 턴 적 HP 15% 고정 피해, ATK +50%',
    },
]);

/**
 * 현재 보유 유물에서 활성화된 시너지 목록 반환
 * @param {object[]} relics - 보유 유물 배열
 * @returns {object[]} 활성 시너지 배열
 */
export const getActiveRelicSynergies = (relics = []) => {
    const ownedNames = new Set(relics.map((r) => r.name));
    return RELIC_SYNERGIES.filter((syn) => syn.requires.every((name) => ownedNames.has(name)));
};

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
