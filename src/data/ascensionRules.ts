/**
 * 회차 규칙 (2026-10 Wave 89, 소유자 결정 §93.4 (b) "회차마다 이름 있는 규칙" + "반복하면서 칭호 · 세트를 다 모으는 콜렉터의 재미").
 *
 * 계승 단계(rank) 1부터 회차마다 규칙 하나가 붙는다. 규칙은 세 가지를 함께 정한다:
 * - **비틀기** — 그 회차 내내 켜지는 도전 조건 하나(`modifier`, `BALANCE.CHALLENGE_MODIFIERS`의 id). 엔진은 이미 있는 도전 조건
 *   판정을 그대로 쓰고, 보상 배율에도 하나로 센다(고른 도전 조건 슬롯은 차지하지 않는다).
 * - **표적 세트** — 그 회차에 각인 드롭률이 오르는 전설 각인 세트(`signatureSet`, `signatureSets.json`의 키).
 * - **정복 보상** — 그 회차에 마왕을 쓰러뜨리면 받는 칭호(`conquestTitle`)와 표적 세트의 아직 없는 각인 하나.
 *
 * 다섯 규칙이 rank 1 ~ 5에 차례로 놓이고 rank 6부터 다시 돈다. 순서는 비틀기의 무게(위치 가림 → 골드 → 기술 → 물약 → 정예) 순이다.
 */

export interface AscensionRuleDef {
    id: string;
    name: string;
    /** 그 회차 내내 켜지는 도전 조건 id. */
    modifier: 'blindMap' | 'noGold' | 'randomSkills' | 'noPotion' | 'eliteOnly';
    /** 드롭률이 오르고 정복 때 각인 하나를 주는 세트(`signatureSets.json`의 키). */
    signatureSet: 'worldtree' | 'celestial' | 'dimension' | 'dragon-lord' | 'shadow-lord';
    conquestTitle: { id: string; name: string };
}

export const ASCENSION_RULES: readonly AscensionRuleDef[] = Object.freeze([
    {
        id: 'lost_pilgrimage',
        name: '길 잃은 순례',
        modifier: 'blindMap',
        signatureSet: 'worldtree',
        conquestTitle: { id: 'conquest_worldtree', name: '세계수의 순례자' },
    },
    {
        id: 'empty_crusade',
        name: '빈손의 성전',
        modifier: 'noGold',
        signatureSet: 'celestial',
        conquestTitle: { id: 'conquest_celestial', name: '천공의 정복자' },
    },
    {
        id: 'twisted_dimension',
        name: '뒤틀린 차원',
        modifier: 'randomSkills',
        signatureSet: 'dimension',
        conquestTitle: { id: 'conquest_dimension', name: '차원을 꿰뚫은 자' },
    },
    {
        id: 'dry_dragon_road',
        name: '물약 없는 용의 길',
        modifier: 'noPotion',
        signatureSet: 'dragon-lord',
        conquestTitle: { id: 'conquest_dragon', name: '용왕의 계승자' },
    },
    {
        id: 'shadow_legion',
        name: '암흑의 군단',
        modifier: 'eliteOnly',
        signatureSet: 'shadow-lord',
        conquestTitle: { id: 'conquest_shadow', name: '암흑을 꺾은 자' },
    },
]);
