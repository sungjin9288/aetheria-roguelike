/**
 * 장 보스 규칙(2026-11 B5, 소유자 결정 2026-11-16 "본편 16장 보스 전부").
 *
 * 본편 장의 보스는 그 보스와 싸우는 동안만 통하는 규칙 하나를 든다 — 플레이어가 늘 쓰던 방법 하나를 그 전투에서 막거나 비튼다.
 * 규칙은 이 표가 선언하고 판정은 `systems/chapterBossRule.ts` 하나가 읽는다(엔진 · 나타날 때의 기록 줄 · 구역 보스 도전 카드 ·
 * 전투 화면 칩 · 몬스터 도감). 수치 보정은 없다 — 보스를 약하게 하거나 플레이어를 강하게 해서 규칙의 무게를 메우지 않는다.
 *
 * 장과 보스: 장의 보스는 그 장의 목표 몬스터가 보스면 그 보스, 아니면 그 장 지역의 보스(`bossMonsters`)다.
 * 첫 세 장(80 고요한 숲 · 81 잊혀진 폐허 · 82 화염의 협곡)은 지역에 보스가 없어 규칙이 없다(`CHAPTERS_WITHOUT_BOSS`).
 * 85 · 86(마왕성의 마왕의 사도 · 지옥의 문지기)은 마왕성의 보스 마왕이 장 보스라 87과 같은 규칙을 쓴다.
 */

export type ChapterBossRuleId =
    | 'buff_halved'
    | 'crit_sealed'
    | 'dot_sealed'
    | 'cooldown_double'
    | 'skill_mp_double'
    | 'resist_pierced'
    | 'potion_once'
    | 'evasion_sealed'
    | 'weakness_sealed'
    | 'lifesteal_sealed'
    | 'escape_sealed';

export interface ChapterBossRuleDef {
    /** 규칙의 이름(그 보스의 분위기) — 칩 · 기록 줄 · 도감이 같은 이름을 쓴다. */
    readonly name: string;
    readonly rule: ChapterBossRuleId;
    /** 이 규칙을 장 보스로 쓰는 본편 장(임무 id). */
    readonly storyQuestIds: readonly number[];
}

/** 규칙이 하는 일 — 규칙만 말한다(권고 · 대응 방법을 붙이지 않는다, Wave 88). */
export const CHAPTER_BOSS_RULE_TEXT: Readonly<Record<ChapterBossRuleId, string>> = {
    buff_halved: '기술로 건 강화의 지속 턴이 절반이다',
    crit_sealed: '치명타가 나지 않는다',
    dot_sealed: '독 · 화상 · 출혈이 보스에게 피해를 주지 않는다',
    cooldown_double: '기술의 재사용 대기가 두 배다',
    skill_mp_double: '기술의 기력 소모가 두 배다',
    resist_pierced: '상태이상 저항과 원소 저항이 통하지 않는다',
    potion_once: '전투 중 소모품은 한 번만 쓸 수 있다',
    evasion_sealed: '보스의 공격을 회피 · 은신으로 피할 수 없다',
    weakness_sealed: '약점 속성 피해가 늘지 않는다',
    lifesteal_sealed: '흡혈 · 흡수로 생명을 회복하지 못한다',
    escape_sealed: '도주할 수 없다',
};

const RULES = {
    '화염의 군주': { name: '열기의 장막', rule: 'buff_halved', storyQuestIds: [207] },
    '레드 드래곤': { name: '붉은 용린', rule: 'crit_sealed', storyQuestIds: [208] },
    '묘지기 네크론': { name: '망자의 봉인', rule: 'dot_sealed', storyQuestIds: [209] },
    '프로토타입 제로': { name: '과부하 회로', rule: 'cooldown_double', storyQuestIds: [84] },
    '빙결의 마녀': { name: '얼어붙은 마력', rule: 'skill_mp_double', storyQuestIds: [83] },
    '아이스 드래곤': { name: '빙하의 숨', rule: 'resist_pierced', storyQuestIds: [210] },
    '화염 군주 이프리트': { name: '꺼지지 않는 불', rule: 'potion_once', storyQuestIds: [211] },
    '천둥새 제피로스': { name: '폭풍의 눈', rule: 'evasion_sealed', storyQuestIds: [212] },
    '타락한 세계수 수호자': { name: '물든 뿌리', rule: 'weakness_sealed', storyQuestIds: [213] },
    '혈월의 뱀파이어 로드': { name: '혈월', rule: 'lifesteal_sealed', storyQuestIds: [214] },
    '마왕': { name: '마왕의 영역', rule: 'escape_sealed', storyQuestIds: [85, 86, 87] },
} as const satisfies Record<string, ChapterBossRuleDef>;

export type ChapterRuleBossName = keyof typeof RULES;

export const CHAPTER_BOSS_RULES: Readonly<Record<ChapterRuleBossName, ChapterBossRuleDef>> = RULES;

/** 지역에 보스가 없어 규칙이 없는 본편 장(탐험 · 일반 몬스터 처치 장, Lv1 ~ 15). */
export const CHAPTERS_WITHOUT_BOSS: readonly number[] = [80, 81, 82];

export const isChapterRuleBossName = (name: string): name is ChapterRuleBossName => (
    Object.prototype.hasOwnProperty.call(RULES, name)
);
