/**
 * 칭호 시스템 (Title System) — v4.0
 * 25개 잠금 해제 칭호 + 10개 프레스티지 칭호
 * 성취 기반 획득, 리더보드 표시, 과시욕 자극
 */

/** 프레스티지(환생) 칭호 — 환생 순서대로 1개씩 부여 */
export const PRESTIGE_TITLES = Object.freeze([
    '각성자',
    '초월자',
    '심연의 탐험가',
    '에테르 기사',
    '허공의 지배자',
    '차원의 균열',
    '시간의 파수꾼',
    '영겁의 존재',
    '절대자',
    '에테르의 신',
]);

/**
 * 일반 달성 칭호 목록
 * cond.type: 달성 조건 유형
 * cond.val:  달성 임계값
 * color:     TailwindCSS 텍스트 색상 클래스
 */
export const TITLES = Object.freeze([
    // ─── 전투 계열 ────────────────────────────────────────────────────────
    {
        id: 'first_blood',
        name: '첫 번째 사냥꾼',
        cond: { type: 'kills', val: 1 },
        color: 'text-slate-400',
    },
    {
        id: 'centurion',
        name: '백인대장',
        cond: { type: 'kills', val: 100 },
        color: 'text-cyan-400',
    },
    {
        id: 'warlord',
        name: '전쟁군주',
        cond: { type: 'kills', val: 1000 },
        color: 'text-purple-400',
    },
    {
        id: 'exterminator',
        name: '섬멸자',
        cond: { type: 'kills', val: 5000 },
        color: 'text-red-500',
    },

    // ─── 보스 계열 ────────────────────────────────────────────────────────
    {
        id: 'dragonslayer',
        name: '용살자',
        cond: { type: 'bossKills', val: 1 },
        color: 'text-orange-400',
    },
    {
        id: 'boss_hunter',
        name: '보스 사냥꾼',
        cond: { type: 'bossKills', val: 10 },
        color: 'text-yellow-400',
    },
    {
        id: 'demonbane',
        name: '마왕의 천적',
        cond: { type: 'bossKills', val: 50 },
        color: 'text-red-400',
    },

    // ─── 레벨 계열 ────────────────────────────────────────────────────────
    {
        id: 'veteran',
        name: '베테랑',
        cond: { type: 'level', val: 30 },
        color: 'text-cyan-400',
    },
    {
        id: 'legend',
        name: '전설',
        cond: { type: 'level', val: 50 },
        color: 'text-yellow-400',
    },

    // ─── 생존/사망 계열 ───────────────────────────────────────────────────
    {
        id: 'phoenix',
        name: '불사조',
        cond: { type: 'deaths', val: 10 },
        color: 'text-orange-500',
    },
    {
        id: 'undying_soul',
        name: '불멸의 영혼',
        cond: { type: 'deaths', val: 50 },
        color: 'text-red-400',
    },

    // ─── 재화 계열 ────────────────────────────────────────────────────────
    {
        id: 'merchant',
        name: '상인',
        cond: { type: 'total_gold', val: 10000 },
        color: 'text-yellow-500',
    },
    {
        id: 'tycoon',
        name: '재벌',
        cond: { type: 'total_gold', val: 100000 },
        color: 'text-yellow-400',
    },

    // ─── 유물 계열 ────────────────────────────────────────────────────────
    {
        id: 'relic_hunter',
        name: '유물 사냥꾼',
        cond: { type: 'relicCount', val: 10 },
        color: 'text-purple-400',
    },
    {
        id: 'collector',
        name: '대수집가',
        cond: { type: 'relicCount', val: 25 },
        color: 'text-yellow-400',
    },

    // ─── 프레스티지 계열 ──────────────────────────────────────────────────
    {
        id: 'reborn',
        name: '환생자',
        cond: { type: 'prestige', val: 1 },
        color: 'text-cyan-400',
    },
    {
        id: 'transcendent',
        name: '초월자',
        cond: { type: 'prestige', val: 5 },
        color: 'text-purple-400',
    },
    {
        id: 'eternal',
        name: '영겁의 존재',
        cond: { type: 'prestige', val: 10 },
        color: 'text-yellow-400',
    },

    // ─── 심연 계열 ────────────────────────────────────────────────────────
    {
        id: 'abyss_walker',
        name: '심연의 보행자',
        cond: { type: 'abyssFloor', val: 10 },
        color: 'text-indigo-400',
    },
    {
        id: 'void_lord',
        name: '허공의 지배자',
        cond: { type: 'abyssFloor', val: 50 },
        color: 'text-purple-400',
    },
    {
        id: 'void_conqueror',
        name: '허무의 정복자',
        cond: { type: 'abyssRecord', val: 100 },
        color: 'text-violet-300',
    },
    {
        id: 'abyss_legend',
        name: '심연의 전설',
        cond: { type: 'abyssRecord', val: 200 },
        color: 'text-fuchsia-400',
    },
    {
        id: 'void_sovereign',
        name: '공허의 군림자',
        cond: { type: 'abyssRecord', val: 300 },
        color: 'text-rose-400',
    },

    // ─── 퀘스트/기타 계열 ─────────────────────────────────────────────────
    {
        id: 'demon_slayer',
        name: '마왕 토벌자',
        cond: { type: 'demonKingSlain', val: 1 },
        color: 'text-red-500',
    },
    {
        id: 'well_rested',
        name: '안락함의 추구자',
        cond: { type: 'rests', val: 50 },
        color: 'text-emerald-400',
    },
    {
        id: 'bounty_king',
        name: '현상수배 왕',
        cond: { type: 'bountyDone', val: 20 },
        color: 'text-yellow-500',
    },
    {
        id: 'crafter',
        name: '장인',
        cond: { type: 'crafts', val: 30 },
        color: 'text-orange-400',
    },
    // cycle 85: 합성(synthesis) 카운터 기반 칭호 — cycle 30+ ach_synth_*과 cycle 82
    // StatsPanel SYNTHESES 라인의 빈 자리 채움. crafts(crafter)와 짝을 이루는 제작 계열
    // 보상 라인. ach_synth_20과 동일 임계값으로 자연스러운 진행 호흡.
    {
        id: 'alchemist',
        name: '연금술사',
        cond: { type: 'synths', val: 20 },
        color: 'text-amber-300',
    },
    // cycle 95: maxKillStreak 카운터 기반 칭호 — killStreak 시스템(BALANCE.KILL_STREAK_TIERS
    // [3,5,10,20])의 최고 임계값에서 unlock. 휘발성 streak를 영구 보상으로 연결.
    {
        id: 'berserker',
        name: '광전사',
        cond: { type: 'maxKillStreak', val: 20 },
        color: 'text-red-400',
    },
    // cycle 103: 발견 체인 마스터 — cycle 102 ach_chain_all과 짝을 이루는 칭호.
    // 5종 chain(fire/frost/void/ancient/demon)을 모두 완료한 탐험 + 전투 균형형 표상.
    {
        id: 'chain_master',
        name: '세계의 길잡이',
        cond: { type: 'discoveryChains', val: 5 },
        color: 'text-indigo-300',
    },
    {
        id: 'ironman',
        name: '아이언맨',
        cond: { type: 'noDeathWin', val: 1 },
        color: 'text-green-400',
    },

    // ─── 탐험 계열 (cycle 61 신규) ────────────────────────────────────────
    {
        id: 'wanderer',
        name: '방랑자',
        cond: { type: 'explores', val: 100 },
        color: 'text-teal-400',
    },
    {
        id: 'pathfinder',
        name: '길잡이',
        cond: { type: 'explores', val: 500 },
        color: 'text-cyan-300',
    },
    {
        id: 'cartographer',
        name: '지도 제작자',
        cond: { type: 'discoveries', val: 10 },
        color: 'text-emerald-300',
    },

    // ─── 시그니처 계열 (cycle 61 신규) ────────────────────────────────────
    {
        id: 'legend_seeker',
        name: '전설의 추적자',
        cond: { type: 'signaturesDiscovered', val: 5 },
        color: 'text-amber-300',
    },
    {
        id: 'legend_chronicler',
        name: '전설의 기록자',
        cond: { type: 'signaturesDiscovered', val: 15 },
        color: 'text-amber-200',
    },

    // ─── 도주/생존 계열 (cycle 77 신규) ───────────────────────────────────
    // cycle 74의 stats.escapes 카운터를 기반. ironman(noDeathWin)과 짝을 이루는
    // "런 보존" 축. 도주는 가치 있는 행동이라는 메시지를 칭호로도 강화.
    {
        id: 'cautious_explorer',
        name: '신중한 모험가',
        cond: { type: 'escapes', val: 10 },
        color: 'text-sky-300',
    },
    {
        id: 'survivor_instinct',
        name: '생존의 본능',
        cond: { type: 'escapes', val: 50 },
        color: 'text-sky-200',
    },
]);

// 희귀도 등급 → 표시 색상(Tailwind 클래스). 단일 출처는 constants.js.
export { RARITY_CLASSES as RARITY_COLORS } from './constants.js';

export const TITLE_PASSIVES: Record<string, any> = Object.freeze({
    first_blood:      { atk: 1, label: 'ATK +1' },
    centurion:        { atk: 2, label: 'ATK +2' },
    warlord:          { atk: 4, crit: 0.01, label: 'ATK +4 · CRIT +1%' },
    exterminator:     { atk: 6, crit: 0.02, label: 'ATK +6 · CRIT +2%' },
    dragonslayer:     { crit: 0.02, def: 1, label: 'CRIT +2% · DEF +1' },
    boss_hunter:      { atk: 3, def: 1, label: 'ATK +3 · DEF +1' },
    demonbane:        { atk: 5, crit: 0.03, label: 'ATK +5 · CRIT +3%' },
    veteran:          { hp: 20, def: 1, label: 'HP +20 · DEF +1' },
    legend:           { hp: 40, atk: 2, label: 'HP +40 · ATK +2' },
    phoenix:          { hp: 25, label: 'HP +25' },
    undying_soul:     { hp: 45, def: 2, label: 'HP +45 · DEF +2' },
    merchant:         { mp: 10, label: 'MP +10' },
    tycoon:           { mp: 20, crit: 0.01, label: 'MP +20 · CRIT +1%' },
    relic_hunter:     { mp: 12, atk: 1, label: 'MP +12 · ATK +1' },
    collector:        { hp: 20, mp: 20, label: 'HP +20 · MP +20' },
    reborn:           { hp: 20, atk: 1, label: 'HP +20 · ATK +1' },
    transcendent:     { hp: 30, mp: 20, crit: 0.01, label: 'HP +30 · MP +20 · CRIT +1%' },
    eternal:          { hp: 50, atk: 2, def: 2, label: 'HP +50 · ATK +2 · DEF +2' },
    abyss_walker:     { def: 2, label: 'DEF +2' },
    void_lord:        { atk: 3, mp: 20, label: 'ATK +3 · MP +20' },
    demon_slayer:     { atk: 4, def: 1, label: 'ATK +4 · DEF +1' },
    well_rested:      { hp: 25, mp: 10, label: 'HP +25 · MP +10' },
    bounty_king:      { crit: 0.02, atk: 2, label: 'CRIT +2% · ATK +2' },
    crafter:          { def: 2, mp: 10, label: 'DEF +2 · MP +10' },
    // cycle 85: 연금술사 — crafter(장인)와 같은 제작 계열. 합성 보호/소비 골드의 비용을
    // 흡수하는 mp/atk 보조 패시브로 차별화 (crafter는 def/mp 중심).
    alchemist:        { mp: 15, atk: 1, label: 'MP +15 · ATK +1' },
    // cycle 95: 광전사 — 공격 일변도 streak 빌드 보상. ATK 최우선 + 부수적 crit.
    berserker:        { atk: 3, crit: 0.02, label: 'ATK +3 · CRIT +2%' },
    // cycle 103: 세계의 길잡이 — 5종 chain 완료의 탐험·전투 균형 패시브.
    chain_master:     { atk: 1, def: 1, mp: 15, label: 'ATK +1 · DEF +1 · MP +15' },
    ironman:          { hp: 35, def: 2, label: 'HP +35 · DEF +2' },

    // cycle 61 신규 칭호 패시브
    wanderer:         { mp: 10, hp: 10, label: 'MP +10 · HP +10' },
    pathfinder:       { mp: 20, atk: 1, label: 'MP +20 · ATK +1' },
    cartographer:     { hp: 25, mp: 15, label: 'HP +25 · MP +15' },
    legend_seeker:    { atk: 2, crit: 0.01, label: 'ATK +2 · CRIT +1%' },
    legend_chronicler:{ atk: 4, crit: 0.02, hp: 20, label: 'ATK +4 · CRIT +2% · HP +20' },

    // cycle 77 신규 도주/생존 칭호 패시브 — 위험 회피 운영을 보상.
    // ironman(공격적 무사망)과 대조되는 보수적 빌드의 정체성: HP/DEF 중심.
    cautious_explorer:{ hp: 20, def: 1, label: 'HP +20 · DEF +1' },
    survivor_instinct:{ hp: 40, def: 2, mp: 10, label: 'HP +40 · DEF +2 · MP +10' },

    각성자:           { hp: 25, mp: 10, label: 'HP +25 · MP +10' },
    초월자:           { hp: 35, atk: 2, label: 'HP +35 · ATK +2' },
    '심연의 탐험가':   { mp: 20, def: 1, label: 'MP +20 · DEF +1' },
    '에테르 기사':     { hp: 30, def: 2, label: 'HP +30 · DEF +2' },
    '허공의 지배자':   { atk: 3, crit: 0.02, label: 'ATK +3 · CRIT +2%' },
    '차원의 균열':     { mp: 25, atk: 2, label: 'MP +25 · ATK +2' },
    '시간의 파수꾼':   { def: 3, hp: 20, label: 'DEF +3 · HP +20' },
    '영겁의 존재':     { hp: 50, mp: 20, label: 'HP +50 · MP +20' },
    절대자:           { atk: 4, def: 2, label: 'ATK +4 · DEF +2' },
    '에테르의 신':     { hp: 60, atk: 4, crit: 0.03, label: 'HP +60 · ATK +4 · CRIT +3%' },
});
