import type { GameMap } from '../types/index.js';

/**
 * Slice 21: 지역별 ambient 팔레트 — 42+개 지역이 단일 다크 톤이라 탐험
 * 진행감이 시각적으로 약하던 문제(READABILITY_TREND_RESEARCH 진단 잔여) 해소.
 *
 * 원칙:
 * - 시맨틱 컬러(행동/위험/보상)는 건드리지 않는다. 지역 톤은 ambient 전용.
 * - 맵 데이터 필드 추가 없음 — 이름 키워드 + type 기반 파생 (세이브 영향 0).
 * - accent: 위치 표기 등 포인트 1-2곳, soft: 셸 상단 radial wash 1곳만.
 */

export interface RegionTheme {
    key: string;
    label: string;
    accent: string;
    soft: string;
}

export const REGION_THEMES: Record<string, RegionTheme> = Object.freeze({
    haven:  { key: 'haven',  label: '거점',   accent: '#d5b180', soft: 'rgba(213, 177, 128, 0.10)' },
    forest: { key: 'forest', label: '녹지',   accent: '#a8cf96', soft: 'rgba(122, 186, 104, 0.09)' },
    water:  { key: 'water',  label: '수역',   accent: '#8ec2ea', soft: 'rgba(96, 156, 224, 0.10)' },
    ember:  { key: 'ember',  label: '화염',   accent: '#eb9c7d', soft: 'rgba(232, 116, 78, 0.10)' },
    frost:  { key: 'frost',  label: '한랭',   accent: '#aadcef', soft: 'rgba(132, 202, 236, 0.10)' },
    desert: { key: 'desert', label: '사막',   accent: '#e2c98b', soft: 'rgba(222, 186, 108, 0.09)' },
    storm:  { key: 'storm',  label: '창공',   accent: '#9fc6dc', soft: 'rgba(120, 170, 210, 0.09)' },
    arcane: { key: 'arcane', label: '비전',   accent: '#bda6e8', soft: 'rgba(154, 118, 224, 0.10)' },
    abyss:  { key: 'abyss',  label: '심연',   accent: '#e08097', soft: 'rgba(214, 84, 110, 0.09)' },
    ruin:   { key: 'ruin',   label: '폐허',   accent: '#c6b594', soft: 'rgba(168, 150, 116, 0.08)' },
});

// 키워드 우선순위 — 합성 지명 충돌 해소가 목적:
// '빙하 심연'은 frost(빙하)가 abyss(심연)보다 먼저, '수정 동굴'은
// arcane(수정)이 ruin(동굴)보다 먼저 매칭되어야 한다.
const KEYWORD_RULES: Array<{ key: string; words: string[] }> = [
    { key: 'haven',  words: ['마을', '쉼터'] },
    { key: 'frost',  words: ['설원', '얼음', '빙하', '서리'] },
    { key: 'ember',  words: ['화염', '용암', '화산', '용의'] },
    { key: 'desert', words: ['사막', '피라미드', '황금', '보물고'] },
    { key: 'abyss',  words: ['암흑', '마왕', '심연', '공허', '혼돈', '어둠', '저주', '종말', '영혼', '지옥'] },
    { key: 'water',  words: ['호수', '심해', '오아시스', '바다', '항구'] },
    { key: 'storm',  words: ['바람', '폭풍', '천공', '공중', '허공', '하늘'] },
    { key: 'arcane', words: ['수정', '마법', '에테르', '차원', '도서관', '시간', '연구소', '기계', '관문'] },
    { key: 'forest', words: ['숲', '평원', '정원', '고원', '세계수', '요정', '봄'] },
    { key: 'ruin',   words: ['폐허', '동굴', '광산', '하수도', '묘지', '미궁', '지하', '요새', '전초기지', '신전', '도시', '감옥', '성채', '전장', '회랑', '둥지', '폐도', '균열', '유적'] },
];

// 키워드 우선, type은 fallback — '사막 오아시스'(safe)가 haven으로 덮이지 않고
// 사막 정체성을 유지한다. 안전지대 시그널은 SAFE 라벨/REST 버튼이 별도 담당.
const matchThemeKey = (locName: string, mapData: GameMap | null | undefined): string => {
    for (const rule of KEYWORD_RULES) {
        if (rule.words.some((word) => locName.includes(word))) return rule.key;
    }
    if (mapData?.type === 'safe') return 'haven';
    if (mapData?.level === 'infinite' || mapData?.type === 'boss') return 'abyss';
    return 'ruin';
};

export const getRegionTheme = (locName: string | null | undefined, mapData: GameMap | null | undefined): RegionTheme => {
    const key = matchThemeKey(String(locName || ''), mapData);
    return REGION_THEMES[key] || REGION_THEMES.ruin;
};
