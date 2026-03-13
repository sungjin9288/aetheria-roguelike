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
    {
        id: 'ironman',
        name: '아이언맨',
        cond: { type: 'noDeathWin', val: 1 },
        color: 'text-green-400',
    },
]);

/** 희귀도 등급 → 표시 색상 */
export const RARITY_COLORS = Object.freeze({
    common: 'text-slate-300',
    uncommon: 'text-cyan-400',
    rare: 'text-purple-400',
    epic: 'text-yellow-400',
    legendary: 'text-red-400',
});

export const TITLE_PASSIVES = Object.freeze({
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
    ironman:          { hp: 35, def: 2, label: 'HP +35 · DEF +2' },

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
