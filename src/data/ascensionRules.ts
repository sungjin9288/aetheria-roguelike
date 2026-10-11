/**
 * 회차 규칙 (2026-10 Wave 89, 소유자 결정 §93.4 (b) "회차마다 이름 있는 규칙" + "반복하면서 칭호 · 세트를 다 모으는 콜렉터의 재미").
 *
 * 계승 단계(rank) 1부터 회차마다 규칙 하나가 붙는다. 규칙은 세 가지를 함께 정한다:
 * - **비틀기** — 그 회차 내내 켜지는 도전 조건 하나(`modifier`, `BALANCE.CHALLENGE_MODIFIERS`의 id). 엔진은 이미 있는 도전 조건
 *   판정을 그대로 쓰고, 보상 배율에도 하나로 센다(고른 도전 조건 슬롯은 차지하지 않는다).
 * - **표적 세트** — 그 회차에 각인 드롭률이 오르는 전설 각인 세트(`signatureSet`, `signatureSets.json`의 키).
 * - **정복 보상** — 그 회차에 마왕을 쓰러뜨리면 받는 칭호(`conquestTitle`)와 표적 세트의 아직 없는 각인 하나.
 *
 * 여섯 규칙이 rank 1 ~ 6에 차례로 놓이고 rank 7부터 다시 돈다. 순서는 **측정한 비틀기의 무게** 순이다(2026-10 Wave 90, 소유자
 * 결정 "b, c 섞어서" — 원장 §95): 위치 가림 → 골드 → 물약 → 기술 뒤섞기 → 생명 절반 → 정예. 120시드 × 7회차 자연 플레이에서 그 회차
 * 사망은 길 잃은 여행 0.47 · 빈손 0.52 · 물약 없이 0.69 · 뒤섞인 기술 2.50 · 약한 생명력 4.21 · 강적의 길 6.81이었다(같은 단계가
 * 아니라 놓인 단계의 값). "생명 절반은 가볍다"는 추정으로 3단계에 두었던 첫 정렬은 4회차 사망을 2.50 → 4.21로 올렸다.
 * 여섯째 규칙의 표적은 세트에 속하지 않은 전설 각인 8개(`UNBOUND_SIGNATURE_GROUP`)다 — 그 각인들은 정복 보상이 다섯 세트를 다
 * 채운 뒤에야 나왔다.
 */

/** 세트에 속하지 않은 전설 각인 묶음(레지스트리 `setGroup`이 없는 것). 세트 보너스는 없고 표적 · 수집 단위로만 쓴다. */
export const UNBOUND_SIGNATURE_GROUP = Object.freeze({ key: 'unbound', name: '흩어진 전설' } as const);

export interface AscensionRuleDef {
    id: string;
    name: string;
    /** 그 회차 내내 켜지는 도전 조건 id. */
    modifier: 'blindMap' | 'noGold' | 'halfHp' | 'noPotion' | 'eliteOnly' | 'randomSkills';
    /** 드롭률이 오르고 정복 때 각인 하나를 주는 세트(`signatureSets.json`의 키, 또는 세트 밖 묶음 `UNBOUND_SIGNATURE_GROUP.key`). */
    signatureSet: 'worldtree' | 'celestial' | 'dimension' | 'dragon-lord' | 'shadow-lord' | typeof UNBOUND_SIGNATURE_GROUP.key;
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
        id: 'dry_dragon_road',
        name: '물약 없는 용의 길',
        modifier: 'noPotion',
        signatureSet: 'dragon-lord',
        conquestTitle: { id: 'conquest_dragon', name: '용왕의 계승자' },
    },
    {
        id: 'tangled_legends',
        name: '뒤엉킨 전설',
        modifier: 'randomSkills',
        signatureSet: UNBOUND_SIGNATURE_GROUP.key,
        conquestTitle: { id: 'conquest_unbound', name: '흩어진 전설의 수집가' },
    },
    {
        id: 'fading_dimension',
        name: '꺼져 가는 차원',
        modifier: 'halfHp',
        signatureSet: 'dimension',
        conquestTitle: { id: 'conquest_dimension', name: '차원을 꿰뚫은 자' },
    },
    {
        id: 'shadow_legion',
        name: '암흑의 군단',
        modifier: 'eliteOnly',
        signatureSet: 'shadow-lord',
        conquestTitle: { id: 'conquest_shadow', name: '암흑을 꺾은 자' },
    },
]);
