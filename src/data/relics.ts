/**
 * 유물 시스템 (Relic System) — v4.0
 * 런마다 탐색 중 최대 5개 유물을 3지선다로 획득. 사망/리셋 시 소멸.
 * Slay the Spire 방식의 로그라이크 런 빌드 핵심.
 */

import { BALANCE } from './constants.js';
import type { Relic } from '../types/relic.js';

export const RELICS: Relic[] = [
    // ─── 공격 계열 (8개) ───────────────────────────────────────────────────
    {
        id: 'blood_pact',
        name: '피의 서약',
        rarity: 'common',
        desc: '적을 처치하면 최대 생명의 3% 회복',
        effect: 'on_kill_heal',
        val: 0.03,
    },
    {
        id: 'void_shard',
        name: '허공의 파편',
        rarity: 'common',
        desc: '공격력 20% 증가, 방어력 15% 감소',
        effect: 'glass_cannon',
        val: { atk: 0.2, def: -0.15 },
    },
    {
        id: 'berserker',
        name: '광전사의 분노',
        rarity: 'uncommon',
        desc: '생명이 30% 미만이면 공격력 40% 증가',
        effect: 'low_hp_atk',
        val: { threshold: 0.3, bonus: 0.4 },
    },
    {
        id: 'executioner',
        name: '처형자의 날',
        rarity: 'uncommon',
        desc: '적 생명이 25% 미만이면 피해 50% 증가',
        effect: 'execute_bonus',
        val: { threshold: 0.25, mult: 0.5 },
    },
    {
        id: 'twin_blades',
        name: '쌍검 각인',
        rarity: 'rare',
        desc: '일반 공격이 두 번 적중하며 각각 60%의 피해를 줌',
        effect: 'double_strike',
        val: 0.6,
    },
    {
        id: 'soul_drain',
        name: '영혼 흡수',
        rarity: 'rare',
        desc: '기술로 준 피해의 10%만큼 생명 회복',
        effect: 'skill_lifesteal',
        val: 0.1,
    },
    {
        id: 'bloodthirst',
        name: '피의 갈증',
        rarity: 'epic',
        desc: '치명타가 적중하면 기력 15 회복',
        effect: 'crit_mp_regen',
        val: 15,
    },
    {
        id: 'ancient_fury',
        name: '고대의 분노',
        rarity: 'epic',
        desc: '공격력 35% 증가, 치명타 확률 15% 증가',
        effect: 'ancient_power',
        val: { atk: 0.35, crit: 0.15 },
    },

    // ─── 방어/생존 계열 (6개) ──────────────────────────────────────────────
    {
        id: 'iron_will',
        name: '강철 의지',
        rarity: 'common',
        desc: '치명타 피해를 30% 확률로 막음',
        effect: 'crit_block',
        val: 0.3,
    },
    {
        id: 'stone_skin',
        name: '암석 피부',
        rarity: 'common',
        desc: '방어력 25% 증가',
        effect: 'stone_skin',
        val: 0.25,
    },
    {
        id: 'thorns',
        name: '가시 갑옷',
        rarity: 'uncommon',
        desc: '공격받으면 방어력의 30%만큼 적에게 피해를 돌려줌',
        effect: 'reflect',
        val: 0.3,
    },
    {
        id: 'undying',
        name: '불사의 의지',
        rarity: 'uncommon',
        desc: '전투마다 한 번, 생명이 1 아래로 내려가지 않음',
        effect: 'death_save',
        val: 1,
    },
    {
        id: 'regen_core',
        name: '재생 코어',
        rarity: 'rare',
        desc: '전투가 시작되면 최대 생명의 15% 회복',
        effect: 'battle_start_heal',
        val: 0.15,
    },
    {
        id: 'fortress',
        name: '난공불락',
        rarity: 'epic',
        desc: '방어력 50%와 최대 생명 20% 증가',
        effect: 'fortress',
        val: { def: 0.5, hp: 0.2 },
    },

    // ─── 마법/기력 계열 (4개) ──────────────────────────────────────────────
    {
        id: 'mana_crystal',
        name: '마나 수정',
        rarity: 'common',
        desc: '최대 기력 25% 증가',
        effect: 'mp_mult',
        val: 0.25,
    },
    {
        id: 'spell_echo',
        name: '주문 메아리',
        rarity: 'uncommon',
        desc: '기술을 사용할 때 15% 확률로 기력을 소모하지 않음',
        effect: 'free_skill',
        val: 0.15,
    },
    {
        id: 'arcane_surge',
        name: '비전 서지',
        rarity: 'rare',
        desc: '전투에서 매 턴 기력 5 회복',
        effect: 'mp_regen_turn',
        val: 5,
    },
    {
        id: 'mind_burn',
        name: '정신 연소',
        rarity: 'epic',
        desc: '기술 피해 70% 증가',
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
        name: '경험 증폭기',
        rarity: 'uncommon',
        desc: '얻는 경험 40% 증가',
        effect: 'exp_mult',
        val: 0.4,
    },
    {
        id: 'lucky_coin',
        name: '행운의 동전',
        rarity: 'uncommon',
        desc: '아이템 획득 확률 50% 증가',
        effect: 'drop_rate',
        val: 0.5,
    },
    {
        id: 'cursed_ring',
        name: '저주받은 반지',
        rarity: 'rare',
        desc: '공격력 60% 증가, 전투가 시작될 때 생명 10% 감소',
        effect: 'cursed_power',
        val: { atk: 0.6, hp_cost: 0.1 },
    },
    {
        id: 'void_eye',
        name: '허공의 눈',
        rarity: 'epic',
        desc: '보스 발견 확률이 3배가 되고 보스 전리품 획득률 100% 증가',
        effect: 'boss_hunter',
        val: { spawn: 3, drop: 1.0 },
    },

    // ─── cycle 67: 탐색/유틸 보강 (3개, 기존 effect 재사용) ───────────────────
    {
        id: 'wanderer_charm',
        name: '방랑자의 부적',
        rarity: 'uncommon',
        desc: '이벤트 발생률 30% 증가 (저비용 옵션)',
        effect: 'event_chance',
        val: 0.3,
    },
    {
        id: 'merchant_seal',
        name: '상인의 인장',
        rarity: 'rare',
        desc: '골드 획득 60% 증가 (공허의 왕좌 다음 등급)',
        effect: 'gold_mult',
        val: 0.6,
    },
    {
        id: 'fortune_relic',
        name: '운명의 결정',
        rarity: 'rare',
        desc: '아이템 획득 확률 100% 증가 (행운의 동전 강화형)',
        effect: 'drop_rate',
        val: 1.0,
    },

    // ─── 특수 계열 (6개) ───────────────────────────────────────────────────
    {
        id: 'combo_ring',
        name: '연격의 반지',
        rarity: 'uncommon',
        desc: '세 번 연속 공격하면 다음 공격 피해 100% 증가',
        effect: 'combo_stack',
        val: { stack: 3, bonus: 1.0 },
    },
    {
        id: 'death_mark',
        name: '죽음의 낙인',
        rarity: 'rare',
        desc: '독과 화상으로 주는 피해가 3배로 증가',
        effect: 'dot_mult',
        val: 3.0,
    },
    {
        id: 'phantom_blade',
        name: '유령 검',
        rarity: 'rare',
        desc: '공격할 때 적 방어력의 30% 무시',
        effect: 'armor_pen',
        val: 0.3,
    },
    {
        id: 'chaos_gem',
        name: '혼돈의 보석',
        rarity: 'epic',
        desc: '전투가 시작되면 공격력 또는 방어력 30% 증가',
        effect: 'chaos_buff',
        val: 0.3,
    },
    {
        id: 'omega_core',
        name: '오메가 코어',
        rarity: 'legendary',
        desc: '모든 능력치와 치명타 확률 15% 증가',
        effect: 'omega',
        val: 0.15,
    },
    // ── Sprint 19: 신규 유물 15종 ────────────────────────────────────────────
    { id: 'time_shard',      name: '시간의 파편',   rarity: 'epic',      desc: '모든 기술의 재사용 대기 1턴 감소', effect: 'cd_minus', val: 1 },
    { id: 'soul_collector',  name: '영혼 수집가',   rarity: 'legendary', desc: '적을 50마리 처치할 때마다 공격력 25 누적', effect: 'kill_stack', stackPer: 50, stackVal: 25 },
    { id: 'chaos_heart',     name: '혼돈의 심장',   rarity: 'legendary', desc: '전투마다 무작위 유물 효과 발동', effect: 'chaos_relic' },
    // cycle 368: threshold: 0.25 redundant default 제거 — CombatEngine.ts:544
    //   `executeAtkRelic.threshold || 0.25` fallback과 동일.
    { id: 'prophecy_stone',  name: '예언의 돌판',   rarity: 'epic',      desc: '보스 생명이 25% 이하이면 공격력 2배', effect: 'execute_atk', val: 2.0 },
    { id: 'curse_crystal',   name: '저주의 결정',   rarity: 'rare',      desc: '상태 이상 피해 50% 증가', effect: 'dot_mult', val: 1.5 },
    { id: 'time_ring',       name: '시공의 반지',   rarity: 'epic',      desc: '기술을 사용할 때 15% 확률로 재사용 대기가 늘지 않음', effect: 'free_skill', val: 0.15 },
    { id: 'blood_moon',      name: '피의 달',       rarity: 'rare',      desc: '생명이 25% 이하이면 모든 피해 40% 증가', effect: 'low_hp_dmg', val: 1.4, threshold: 0.25 },
    { id: 'dragon_claw',     name: '드래곤 발톱',   rarity: 'epic',      desc: '치명타 피해 60% 증가', effect: 'crit_dmg', val: 1.6 },
    { id: 'phantom_core',    name: '환영 핵',       rarity: 'rare',      desc: '전투가 시작되면 공격력 15% 증가', effect: 'battle_start_atk', val: 0.15 },
    { id: 'void_echo',       name: '공허의 메아리', rarity: 'epic',      desc: '기술 사용 후 다음 일반 공격 피해 80% 증가', effect: 'echo_atk', val: 1.8 },
    { id: 'ancient_seal',    name: '고대의 봉인',   rarity: 'rare',      desc: '상태 이상 저항 40% 증가', effect: 'status_resist', val: 0.4 },
    { id: 'star_core',       name: '별의 핵',       rarity: 'legendary', desc: '전투가 끝나면 기력을 모두 회복', effect: 'mp_restore_battle' },
    { id: 'twin_blade',      name: '쌍검의 혼',     rarity: 'rare',      desc: '두 무기를 장착하면 치명타 확률 15% 증가', effect: 'dual_crit', val: 0.15 },
    { id: 'earth_heart',     name: '대지의 심장',   rarity: 'epic',      desc: '매 턴 최대 생명의 5% 회복', effect: 'regen', val: 0.05 },
    { id: 'rune_crown',      name: '룬 왕관',       rarity: 'legendary', desc: '공격력 15%, 방어력 15%, 최대 기력 40% 증가', effect: 'triple_up', atkVal: 0.15, defVal: 0.15, mpVal: 40 },

    // ── 신규 유물 8종 (구조 개선) ──────────────────────────────────────────
    { id: 'frost_anchor',   name: '동결의 닻',     rarity: 'rare',      desc: '공격 시 15% 확률로 적 1턴 빙결', effect: 'on_hit_freeze', val: 0.15 },
    { id: 'shadow_cloak',   name: '그림자 망토',   rarity: 'uncommon',  desc: '전투 첫 턴에 반드시 회피하고 방어력 10% 증가', effect: 'first_turn_evade', val: 0.1 },
    { id: 'war_drum',       name: '전쟁의 북',     rarity: 'uncommon',  desc: '전투 시작 후 2턴 동안 공격력 20% 증가', effect: 'battle_start_buff', val: { atk: 0.2, turns: 2 } },
    { id: 'soul_lantern',   name: '영혼 등불',     rarity: 'rare',      desc: '적을 처치하면 경험 25%와 골드 15% 추가 획득', effect: 'kill_bonus', val: { exp: 0.25, gold: 0.15 } },
    { id: 'titan_belt',     name: '타이탄의 허리띠', rarity: 'epic',    desc: '최대 생명 30% 증가, 받는 치명타 피해 50% 감소', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
    { id: 'spell_weaver',   name: '주문 직조자',   rarity: 'epic',      desc: '기술을 연속 사용하면 피해가 20%씩 증가하며 최대 60% 누적', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } },
    { id: 'blood_oath_ring', name: '혈맹의 반지',  rarity: 'rare',      desc: '매 턴 생명 3%를 소모하고 공격력 35% 증가', effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } },
    { id: 'prism_core',     name: '프리즘 핵',     rarity: 'legendary', desc: '모든 속성 약점 적중 배율 1.25→1.5', effect: 'elem_boost', val: 0.25 },

    {
        id: 'void_heart',
        name: '허공의 심장',
        rarity: 'legendary',
        desc: '모험마다 한 번 생명 1로 버티고, 다음 첫 공격의 피해가 300%로 증가',
        effect: 'void_heart',
        val: { survive: 1, dmg_mult: 3.0 },
    },

    // ─── 전설 유물 추가 (8개) ────────────────────────────────────────────────
    {
        id: 'genesis_core',
        name: '창세의 핵',
        rarity: 'legendary',
        desc: '전투가 시작되면 모든 능력치 15% 증가, 매 턴 생명 2% 회복',
        effect: 'genesis',
        val: { statBonus: 0.15, healPerTurn: 0.02 },
    },
    {
        id: 'void_monarch',
        name: '허공의 왕좌',
        rarity: 'legendary',
        desc: '적을 처치할 때마다 공격력 5% 증가, 전투 중 최대 50% 누적',
        effect: 'kill_stack_atk',
        val: { perKill: 0.05, max: 0.5 },
    },
    {
        id: 'time_lord_crown',
        name: '시간 군주의 왕관',
        rarity: 'legendary',
        desc: '기술 재사용 대기 1턴 감소, 첫 기술은 기력을 소모하지 않음',
        effect: 'cooldown_reduce',
        val: { cdReduction: 1, firstFree: true },
    },
    {
        id: 'phoenix_feather',
        name: '불사조의 깃털',
        rarity: 'legendary',
        desc: '생명이 0이 되면 한 번 부활해 30% 회복하고, 3턴 동안 공격력 50% 증가',
        effect: 'phoenix_revive',
        val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 },
    },
    {
        id: 'abyssal_contract',
        name: '심연의 계약',
        rarity: 'legendary',
        desc: '매 턴 최대 생명의 5%를 소모하고 공격력 60% 증가',
        effect: 'hp_drain_atk',
        val: { hpCost: 0.05, atkBonus: 0.6 },
    },
    {
        id: 'mirror_of_fate',
        name: '운명의 거울',
        rarity: 'legendary',
        desc: '받은 피해의 30%를 적에게 돌려주고 치명타 확률 15% 증가',
        effect: 'reflect_crit',
        val: { reflect: 0.3, critBonus: 0.15 },
    },
    {
        id: 'world_eater',
        name: '세계 포식자',
        rarity: 'legendary',
        desc: '적을 처치하면 적 최대 생명의 10%만큼 전투 중 자신의 최대 생명 증가',
        effect: 'devour_hp',
        val: 0.1,
    },
    {
        id: 'entropy_engine',
        name: '엔트로피 엔진',
        rarity: 'legendary',
        desc: '3턴마다 적에게 최대 생명의 8%만큼 고정 피해',
        effect: 'entropy_tick',
        val: { interval: 3, damage: 0.08 },
    },

    // ── 심연 전용 유물 ──────────────────────────────────────────────────────────
    {
        id: 'abyss_resonance',
        name: '심연의 공명',
        rarity: 'epic',
        desc: '심연 10층마다 공격력 3% 증가, 심연에서 최대 60% 적용',
        effect: 'abyss_atk_scale',
        val: { perFloors: 10, atkPer: 0.03, maxBonus: 0.6 },
    },
    {
        id: 'void_crystal',
        name: '공허의 결정',
        rarity: 'epic',
        desc: '심연 5층마다 치명타 확률 1% 증가, 최대 20% 적용',
        effect: 'abyss_crit_scale',
        val: { perFloors: 5, critPer: 0.01, maxBonus: 0.2 },
    },
    {
        id: 'abyssal_dominion',
        name: '심연의 지배',
        rarity: 'legendary',
        desc: '심연 30층부터 공격력 40%와 방어력 30% 증가',
        effect: 'abyss_floor_power',
        val: { minFloor: 30, atkBonus: 0.4, defBonus: 0.3 },
    },
];

/** 희귀도별 가중치 (가중 추첨) */
// cycle 285: export 제거 — pickWeightedRelics 내부에서만 사용. private const로 downgrade.
const RELIC_WEIGHTS: Record<string, any> = Object.freeze({
    common: 50,
    uncommon: 30,
    rare: 15,
    epic: 4,
    legendary: 1,
});

/**
 * 희귀도 서열 (낮음→높음). RELIC_WEIGHTS / BALANCE.RARITY_COLORS와 동일한 순서를
 * 단일 source로 유지 — rarityCap 필터(pickWeightedRelics)가 참조하는 유일한 서열 정의.
 */
const RARITY_ORDER: readonly string[] = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);

/**
 * 관대함 하향 (2026-07 밸런스 감사): pool에서 rarityCap 이하 등급만 남기는 순수 필터.
 * cap이 RARITY_ORDER에 없는 값이면 무필터(pool 그대로 반환) — 방어적 fallback.
 * 시작 부트(START_BOOT_RARITY_CAP: 'rare')에서 epic/legendary를 제외하는 데 사용.
 */
const filterByRarityCap = (pool: any[], rarityCap?: string) => {
    if (!rarityCap) return pool;
    const capIndex = RARITY_ORDER.indexOf(rarityCap);
    if (capIndex < 0) return pool;
    return pool.filter((r: any) => RARITY_ORDER.indexOf(r.rarity) <= capIndex);
};

/** 한 모험에서 보유할 수 있는 최대 유물 수 */
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
 *
 * cycle 394: id 출력 dead 일괄 정리 — 매칭은 항상 bonus.effect 기반
 *   (statsCalculator + CombatEngine + 회귀 가드 cycle 153/154/236/237).
 *   syn.id read는 src/, tests/ 어디에도 0건. StatsPanel React key는 syn.name 사용.
 */
export const RELIC_SYNERGIES = Object.freeze([
    {
        label: '흡혈 군주',
        requires: ['피의 서약', '영혼 흡수'],
        bonus: { effect: 'vampire_lord', atkMult: 0.2, lifeSteal: 0.5 },
        desc: '공격력 20% 증가, 모든 공격으로 준 피해의 50%만큼 생명 회복',
    },
    {
        label: '비전 파동',
        requires: ['마나 수정', '주문 메아리'],
        bonus: { effect: 'arcane_surge', mpMult: 0.3 },
        desc: '최대 기력 30% 증가, 기술이 기력을 소모하지 않을 확률 두 배',
    },
    {
        label: '난공불락',
        requires: ['강철 의지', '난공불락'],
        bonus: { effect: 'unbreakable', healOnSave: 0.3 },
        desc: '사망 방지가 발동하면 최대 생명의 30% 회복',
    },
    {
        label: '시간 지배자',
        requires: ['시간의 파편', '시공의 반지'],
        bonus: { effect: 'time_master', extraTurnChance: 0.1 },
        desc: '기술 사용 후 10% 확률로 한 번 더 행동',
    },
    {
        label: '죽음의 예언자',
        requires: ['죽음의 낙인', '저주의 결정'],
        bonus: { effect: 'death_oracle', dotMult: 0.5 },
        desc: '모든 지속 피해 50% 증가',
    },
    // ─── 신규 시너지 (10개) ──────────────────────────────────────────────────
    {
        label: '불멸의 전사',
        requires: ['불사조의 깃털', '피의 서약'],
        bonus: { effect: 'immortal_warrior', reviveHeal: 0.5, killHeal: 0.05 },
        desc: '부활할 때 생명 50% 회복, 적 처치 시 생명 5% 회복',
    },
    {
        label: '지옥의 수확자',
        requires: ['심연의 계약', '영혼 흡수'],
        bonus: { effect: 'hell_reaper', hpCostReduction: 0.02, lifeStealBonus: 0.5 },
        desc: '생명 소모가 3%로 줄고 흡혈 효과 50% 증가',
    },
    {
        label: '절멸자',
        requires: ['허공의 왕좌', '처형자의 날'],
        bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 },
        desc: '생명 35% 이하인 적에게 마무리 효과 발동, 처치 누적 7%로 증가',
    },
    {
        label: '영원의 생명',
        requires: ['창세의 핵', '재생 코어'],
        bonus: { effect: 'eternal_life', healPerTurn: 0.04, statBonus: 0.2 },
        desc: '매 턴 생명 4% 회복, 모든 능력치 20% 증가',
    },
    {
        label: '시간의 지배자 (강화)',
        requires: ['시간 군주의 왕관', '시간의 파편'],
        bonus: { effect: 'time_dominator', cdReduction: 2, extraAction: 0.3 },
        desc: '기술 재사용 대기 2턴 감소, 추가 행동 확률 30%',
    },
    {
        label: '절대 반사',
        requires: ['운명의 거울', '가시 갑옷'],
        bonus: { effect: 'absolute_reflect', reflect: 0.5, stunOnReflect: 0.25 },
        desc: '반사 피해가 50%로 증가하고, 반사할 때 25% 확률로 적을 기절시킴',
    },
    {
        label: '엔트로피 낙인',
        requires: ['엔트로피 엔진', '죽음의 낙인'],
        bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 },
        desc: '고정 피해가 최대 생명의 12%로 증가하고 2턴마다 발동',
    },
    {
        label: '무한 포식',
        requires: ['세계 포식자', '광전사의 분노'],
        bonus: { effect: 'infinite_devour', devour: 0.15, lowHpAtk: 0.6 },
        desc: '적 처치 시 최대 생명 15% 증가, 생명이 낮을 때 공격력 60% 증가',
    },
    {
        label: '공허의 용',
        requires: ['허공의 왕좌', '드래곤 발톱'],
        bonus: { effect: 'void_dragon', killStack: 0.08, critDmg: 2.0 },
        desc: '처치할 때마다 공격력 8% 증가, 치명타 추가 피해 두 배',
    },
    {
        label: '절대 불사',
        requires: ['불사조의 깃털', '불사의 의지'],
        bonus: { effect: 'absolute_immortal', reviveCount: 2, reviveHeal: 0.5 },
        desc: '두 번 부활할 수 있으며 부활할 때 생명 50% 회복',
    },
    // ─── 3피스 전설 시너지 (5개) ──────────────────────────────────────────
    {
        label: '혈맹 불사',
        requires: ['피의 서약', '영혼 흡수', '허공의 심장'],
        bonus: { effect: 'blood_immortal', lifeSteal: 1.0, reviveHeal: 0.5 },
        desc: '모든 공격으로 준 피해만큼 생명 회복, 부활할 때 생명 50% 회복',
    },
    {
        label: '비전 특이점',
        requires: ['마나 수정', '주문 메아리', '정신 연소'],
        bonus: { effect: 'arcane_singularity', freeSkillChance: 0.35, skillMult: 0.3 },
        desc: '기술이 기력을 소모하지 않을 확률 35%, 기술 피해 30% 증가',
    },
    {
        label: '원초의 분노',
        requires: ['고대의 분노', '드래곤 발톱', '광전사의 분노'],
        bonus: { effect: 'primordial_wrath', critChance: 0.25, critDmg: 2.5, lowHpAtk: 0.8 },
        desc: '치명타 확률 25% 증가, 치명타 피해 2.5배, 생명이 낮을 때 공격력 80% 증가',
    },
    {
        label: '영원의 요새',
        requires: ['난공불락', '암석 피부', '대지의 심장'],
        bonus: { effect: 'eternal_fortress', defMult: 0.8, regenPerTurn: 0.08 },
        desc: '방어력 80% 증가, 매 턴 생명 8% 회복',
    },
    {
        label: '엔트로피의 신',
        requires: ['엔트로피 엔진', '죽음의 낙인', '혼돈의 보석'],
        bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 },
        desc: '매 턴 적 최대 생명의 15%만큼 고정 피해, 공격력 50% 증가',
    },
]);

/**
 * 현재 보유 유물에서 활성화된 시너지 목록 반환
 * @param {object[]} relics - 보유 유물 배열
 * @returns {object[]} 활성 시너지 배열
 */
// cycle 597: relics default [] 제거 — 5 production caller (statsCalculator/
//   CombatEngine x4) + 1 test 모두 명시 전달이라 default 도달 불가.
export const getActiveRelicSynergies = (relics: any) => {
    const ownedNames = new Set(relics.map((r: any) => r.name));
    return RELIC_SYNERGIES.filter((syn: any) => syn.requires.every((name: any) => ownedNames.has(name)));
};

/**
 * remaining 배열에서 가중치 기반으로 1개를 뽑아 반환 (remaining 자체는 변경하지 않음).
 * pickWeightedRelics의 일반 슬롯 / 시너지 pity 슬롯 추첨 로직에서 공용으로 사용.
 */
const drawOneWeighted = (remaining: any[]) => {
    const totalWeight = remaining.reduce((sum: any, r: any) => sum + (RELIC_WEIGHTS[r.rarity] || 1), 0);
    let rand = Math.random() * totalWeight;
    let chosen = remaining[remaining.length - 1]; // fallback
    for (let j = 0; j < remaining.length; j++) {
        rand -= RELIC_WEIGHTS[remaining[j].rarity] || 1;
        if (rand <= 0) { chosen = remaining[j]; break; }
    }
    return chosen;
};

/**
 * owned(보유 유물) 기준 "정확히 1개만 더 모으면 완성"되는 RELIC_SYNERGIES의
 * 잔여 유물 중, pool에 실제로 존재하는(=아직 보유하지 않은) 후보 목록을 반환.
 * - 이미 완성된 시너지(모든 requires 보유)는 후보를 만들지 않는다.
 * - 2개 이상 부족한 시너지도 제외 (정확히 1개 부족일 때만 "소프트 pity" 대상).
 * - 결과는 relic id 기준 중복 제거.
 */
const findSynergyPityCandidates = (pool: any[], owned: any[]) => {
    if (!owned || owned.length === 0) return [];
    const ownedNames = new Set(owned.map((r: any) => r.name));
    const poolByName = new Map(pool.map((r: any) => [r.name, r]));
    const candidates = new Map<string, any>();

    for (const syn of RELIC_SYNERGIES) {
        const missingNames = syn.requires.filter((name: string) => !ownedNames.has(name));
        if (missingNames.length !== 1) continue; // 이미 완성됐거나 2개 이상 부족
        const missingRelic = poolByName.get(missingNames[0]);
        if (missingRelic) candidates.set(missingRelic.id, missingRelic);
    }
    return Array.from(candidates.values());
};

// cycle 597: count default 3 제거 — 4 production caller (exploreUtils/
//   eventActions/exploreActions/combatBossHandlers) + 1 test 모두 count 명시
//   (1 또는 3) 전달이라 default 도달 불가.
// 2026-07 감사: 시너지 소프트 pity — 세 번째 인자로 { owned }를 넘기면, owned 기준
//   "1개만 더 모으면 완성"되는 시너지 잔여 유물이 pool에 있을 때 BALANCE.SYNERGY_PITY_SLOT개
//   슬롯을 그 후보군에서 가중 추첨으로 보장한다. owned 미전달/빈 배열/해당 후보 없음 시
//   기존 로직과 완전히 동일하게 동작 (기존 호출부 전부 무수정 하위호환).
// 관대함 하향 (2026-07 밸런스 감사): options.rarityCap을 넘기면 pool을 해당 등급 이하로만
//   제한한 뒤 기존 로직(시너지 pity 포함)을 그대로 태운다. 시작 부트(characterActions.ts)만
//   'rare'를 전달 — 일반 탐험 유물 발견(exploreUtils.ts)은 전달하지 않아 기존 확률 분포 불변.
export const pickWeightedRelics = (pool: any, count: any, options?: { owned?: any[]; rarityCap?: string }) => {
    const cappedPool = filterByRarityCap(pool, options?.rarityCap);
    if (cappedPool.length === 0) return [];
    const remaining = [...cappedPool];
    const needed = Math.min(count, remaining.length);
    if (needed === 0) return [];

    const result: any[] = [];
    const pityCandidates = findSynergyPityCandidates(remaining, options?.owned as any[]);

    if (pityCandidates.length > 0) {
        const pitySlots = Math.min(BALANCE.SYNERGY_PITY_SLOT, needed, pityCandidates.length);
        const pityPool = [...pityCandidates];
        for (let i = 0; i < pitySlots; i++) {
            const chosen = drawOneWeighted(pityPool);
            result.push(chosen);
            pityPool.splice(pityPool.indexOf(chosen), 1);
            remaining.splice(remaining.indexOf(chosen), 1);
        }
    }

    const remainingNeeded = needed - result.length;
    for (let i = 0; i < remainingNeeded; i++) {
        const chosen = drawOneWeighted(remaining);
        result.push(chosen);
        remaining.splice(remaining.indexOf(chosen), 1);
    }
    return result;
};
