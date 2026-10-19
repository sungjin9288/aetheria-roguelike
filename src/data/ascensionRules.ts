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
    /**
     * 2026-10 Wave 91 (소유자 결정 "a, c 섞어서" — 원장 §95.5): 무거운 비틀기 셋(rank 4 ~ 6)은 받아들일지 고른다. 기본은 받아들임이고
     * 내용은 그대로다(a). 거절하면 그 회차에는 비틀기 · 표적 배율 · 정복 보상이 모두 없다 — 그 단계의 정복은 순환이 다시 올 때 받는다(c).
     */
    optional?: true;
    /**
     * 2026-10 Wave 92 (소유자 결정 "C를 보여주는게 좋지" — 원장 §96.5 (c)): 선택형 규칙의 받아들임 · 거절 측정 차이. 선택 화면이 한 줄로
     * 보이고 판단은 플레이어 몫이다(Wave 88 위협 줄과 같은 원칙). 값은 그 회차의 시드당 평균이다 — 사망은 그 회차의 사망 수, 각인은
     * 그 회차에 새로 발견한 전설 각인 수. 규칙 · 순서 · 엔진을 바꾸면 다시 잴 것.
     *
     * 2026-10 Wave 93 (소유자 결정 "b" — 원장 §97.5 (b) · §98): 순환마다 따로 잰다. 배열의 i번째가 i + 1번째 순환이다 — [0] = rank 4 ~ 6
     * (120시드 × 7회차, 원장 §96.3), [1] = rank 10 ~ 12(120시드 × 13회차, 원장 §98). 두 번째 순환은 적이 더 강한데도 사망이 첫 순환의
     * 39 ~ 62%였다(영구 성장이 적 성장보다 빨리 쌓인 것으로 보인다) — 첫 순환 값을 그대로 보이면 위험을 1.6 ~ 2.6배 크게 말했다. 측정이 없는 순환은
     * 마지막으로 잰 순환 값을 보이고 화면이 그렇다고 밝힌다(숫자를 지어내지 않는다).
     *
     * 2026-10 Wave 94: 카드 뽑기로 규칙이 아무 단계에나 올 수 있다. 값은 고정 순서에서 잰 그대로이고, 화면은 잰 단계(`measuredRank`)를
     * 밝힌다 — 순환(1 ~ 6 · 7 ~ 12단계)으로 고르는 규칙은 그대로다.
     *
     * 2026-10 Wave 114: 기본 선택형 규칙 셋의 첫 순환 값을 Wave 108(사망하면 여정이 처음부터) · 115 · 114(이월 100단계) 위에서 다시 쟀다
     * (원장 §121.7). 두 번째 순환 값(rank 10 ~ 12)은 Wave 108 전 측정이라 지웠다 — 첫 순환 사망이 그 측정의 2.3 ~ 4.9배라 두 번째 순환을
     * 그대로 보이면 위험을 작게 말한다. 두 번째 순환은 첫 순환 값을 보이고 출처 줄이 잰 단계를 밝힌다(Wave 93 규칙). 새 각인은 계승 화면
     * 요약과 같은 규칙(마지막 사망 뒤 회차 시작에 없던 각인)으로 센다 — 사망이 도감을 비우므로 회차 끝 발견 수의 차이는 음수가 될 수 있다.
     *
     * 2026-10 Wave 106: 겹친 규칙은 그 규칙의 카드 가운데 거절할 수 있는 카드(선택형 바탕, 또는 무거운 두 번째 비틀기)만 잰 값이다 —
     * 바탕이 가벼운 겹친 규칙은 무거운 두 번째 비틀기가 붙은 카드의 측정이다.
     *
     * 2026-10 Wave 121: 저장소 안 자연 플레이 드라이버(`scripts/naturalPlay/driver.mjs`, v2)와 Wave 118 게임으로 다시 쟀다(원장 §128) —
     * 이전 값을 잰 드라이버는 저장소 밖에 있다가 지워져 재현할 수 없었다. 첫 순환은 고정 순서 카드(`--rule-pick fixed`)의 받아들임과,
     * 그 단계 카드 하나만 거절한 회차(`--rule-decline rank:N`)를 짝지었다 — 앞 회차가 같은 역사라 결정 하나의 차이다.
     *
     * 2026-10 Wave 125: 전설 각인 발견이 계정 장부가 되어(사망해도 남는다) 새 각인은 계정에 처음 모은 각인만 센다 — 같은 명령으로
     * 다시 쟀다(원장 §132.4). 받아들임의 새 각인은 거의 정복 보상 하나이고, 거절은 0에 가깝다.
     */
    outlook?: readonly AscensionRuleOutlook[];
    /**
     * 2026-10 Wave 105 (소유자 결정 §109.4 (c) "2순환부터 겹친 카드만 · 카드마다 무작위 두 번째 비틀기 · 새 정복 칭호 6개 + 각인"):
     * 겹친 규칙이 바탕으로 삼는 기본 규칙 id. 겹친 규칙은 기본 규칙의 비틀기 · 표적 세트 · 선택형 여부를 그대로 들고, 카드마다 무작위
     * 두 번째 비틀기를 하나 더 얹는다(`systems/ascensionRule.ts` `getStackedSecondModifier`). 칭호는 자기 것이다.
     */
    stackedOf?: string;
}

/** 2026-10 Wave 114: 판 수를 따로 적지 않은 측정(Wave 92 · 93 · 106)은 120판이었다. */
export const OUTLOOK_DEFAULT_SAMPLES = 120;

export interface AscensionRuleOutlook {
    /** 2026-10 Wave 94: 이 값을 잰 계승 단계(고정 순서 측정) — 카드 뽑기 뒤로는 규칙이 다른 단계에 올 수 있어 화면이 밝힌다. */
    measuredRank: number;
    /**
     * 2026-10 Wave 123 (소유자 결정 "구간 분리", 원장 §130): 겹친 규칙은 단계 구간마다 하나 — 이 값을 잰 계승 단계 구간(양 끝 포함).
     * 계승 10단계에서 영구 능력치가 ×2가 되어(`getPrestigeUnlocks().statMult`) 같은 겹친 카드의 사망이 그 앞뒤로 2.6 ~ 10배 다르다 —
     * 두 구간의 평균은 앞에서 만난 플레이어에게 위험을 작게, 뒤에서 만난 플레이어에게 크게 말했다. 화면은 지금 단계가 시작 단계 이상인
     * 마지막 구간을 고른다(13단계 이후는 마지막 구간 — 출처 줄이 잰 구간을 밝힌다). `measuredRank`는 그 구간에서 가장 많이 놓인 단계다.
     */
    measuredRanks?: readonly [number, number];
    /** 2026-10 Wave 114: 받아들임 · 거절을 짝지은 판 수(없으면 `OUTLOOK_DEFAULT_SAMPLES`) — 출처 줄이 그대로 밝힌다. */
    samples?: number;
    acceptedDeaths: number;
    declinedDeaths: number;
    acceptedSignatures: number;
    declinedSignatures: number;
}

/**
 * 2026-10 Wave 106 (소유자 결정 §110.6 "(b)+(c) 같이"): 비틀기의 측정 무게 — 겹친 회차(rank 7 ~ 12)의 회차당 사망 평균.
 * 겹친 카드의 무게는 두 비틀기 무게의 합이고, 계승 화면이 처음 골라 두는 카드가 그 합이 가장 작은 카드다(`resolveAscensionRuleChoice`).
 * 기본 카드(1순환)는 규칙 표 순서 그대로다(Wave 90 — 놓인 회차에서 잰 순서). 규칙 · 순서 · 엔진이 바뀌면 다시 잴 것.
 *
 * 2026-10 Wave 122 (소유자 결정 "무작위 카드 측정으로 다시 잼", 원장 §129): Wave 105의 값은 Wave 108(사망하면 처음부터) 전 측정이었다.
 * 늘 받아들이는 드라이버가 패에서 무작위로 고른 카드(`--rule-pick random`, 240판 × 13회차 = 겹친 회차 1,440)로 다시 쟀다 — 기본 카드로
 * 재면 이 표로 고른 카드만 담겨(가벼운 두 번째일수록 무거운 바탕과 짝지어진다) 표가 표를 재는 순환이 된다. 무작위 카드에서는 바탕 ·
 * 두 번째 · 단계가 서로 독립이라 그 비틀기가 바탕이든 두 번째든 붙은 회차의 평균을 쓴다(두 번째만 쓰던 Wave 106의 이유 — 바탕이 단계와
 * 섞인다 — 가 사라졌고 표본이 두 배다). 순서가 바뀌었다: 물약 없이가 가장 가볍던 것이 길 잃음, 뒤섞인 기술이 가장 무겁다.
 */
export const ASCENSION_TWIST_WEIGHTS: Readonly<Record<AscensionRuleDef['modifier'], number>> = Object.freeze({
    blindMap: 7.36,
    noPotion: 14.19,
    noGold: 17.67,
    eliteOnly: 23.82,
    halfHp: 60.07,
    randomSkills: 67.64,
});

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
        optional: true,
        outlook: [
            { measuredRank: 4, samples: 74, acceptedDeaths: 11.86, declinedDeaths: 1.72, acceptedSignatures: 1.61, declinedSignatures: 0.39 },
        ],
    },
    {
        id: 'fading_dimension',
        name: '꺼져 가는 차원',
        modifier: 'halfHp',
        signatureSet: 'dimension',
        conquestTitle: { id: 'conquest_dimension', name: '차원을 꿰뚫은 자' },
        optional: true,
        outlook: [
            { measuredRank: 5, samples: 120, acceptedDeaths: 15.92, declinedDeaths: 1.38, acceptedSignatures: 1.14, declinedSignatures: 0.05 },
        ],
    },
    {
        id: 'shadow_legion',
        name: '암흑의 군단',
        modifier: 'eliteOnly',
        signatureSet: 'shadow-lord',
        conquestTitle: { id: 'conquest_shadow', name: '암흑을 꺾은 자' },
        optional: true,
        outlook: [
            { measuredRank: 6, samples: 120, acceptedDeaths: 4.75, declinedDeaths: 2.24, acceptedSignatures: 1.02, declinedSignatures: 0.23 },
        ],
    },
]);

/**
 * 겹친 회차 규칙 (2026-10 Wave 105, 소유자 결정 §109.4 (c)) — 기본 여섯 규칙을 모두 한 번 정복하면(1순환 끝) 덱이 이 여섯으로 바뀐다.
 * 13회차 측정(원장 §109)에서 2순환의 무거운 회차 사망이 1순환의 37 ~ 63%로 줄었다(영구 성장이 비틀기 하나의 무게를 따라잡는다) —
 * 비틀기를 하나 더 얹어 무게를 다시 올린다. 수치 보정이 아니라 콘텐츠다(소유자 원칙 §53.1).
 * 두 번째 비틀기는 카드마다 처치 영수증 · 다음 단계 · 다시 뽑기 횟수 · 규칙 id의 해시로 뽑는다 — 화면과 리듀서가 같은 카드를 본다.
 */
export const STACKED_ASCENSION_RULES: readonly AscensionRuleDef[] = Object.freeze(ASCENSION_RULES.map((base) => {
    const names: Record<string, { name: string; title: string }> = {
        lost_pilgrimage: { name: '두 겹의 순례', title: '두 겹 길의 순례자' },
        empty_crusade: { name: '두 겹의 성전', title: '두 겹 성전의 정복자' },
        dry_dragon_road: { name: '두 겹의 용의 길', title: '두 겹 용왕의 계승자' },
        tangled_legends: { name: '두 겹의 전설', title: '두 겹 전설의 수집가' },
        fading_dimension: { name: '두 겹의 차원', title: '두 겹 차원을 꿰뚫은 자' },
        shadow_legion: { name: '두 겹의 군단', title: '두 겹 암흑을 꺾은 자' },
    };
    // 겹친 규칙 카드 가운데 거절할 수 있는 카드(선택형 바탕, 또는 무거운 두 번째 비틀기 — Wave 106)의 받아들임 · 거절 측정
    // (Wave 106, 원장 §111): 받아들인 회차와 같은 시드 · 같은 단계에서 그 카드를 거절한 회차를 짝지었다(거절은 규칙 없이 그 회차를 한다).
    // 카드마다 두 번째 비틀기가 다르므로 값은 그 규칙의 거절 가능한 카드들의 평균이고, 잰 단계는 가장 많이 놓인 단계다.
    // 2026-10 Wave 116: Wave 108(사망하면 처음부터) · 114(이월 100단계) · 115 위에서 다시 쟀다 — 늘 받아들이는 드라이버와
    // 겹친 카드만 거절하는 드라이버(같은 120시드 × 13회차)의 거절 가능한 카드 회차 평균이다(짝이 아니다 — 첫 거절 뒤로 두 드라이버의
    // 회차가 갈라진다). 판 수는 두 쪽 중 적은 쪽이다. 이전 값은 받아들임 사망을 1.7 ~ 8.7분의 1로 말했다(원장 §122).
    // 2026-10 Wave 121: 같은 방식을 저장소 드라이버 v2 · Wave 118 게임으로 다시 쟀다(원장 §128). 잰 단계는 받아들임 쪽에서 가장 많이
    // 놓인 단계다(같으면 두 쪽 합). 계승 10단계(에테르 초월, 영구 능력치 ×2) 앞뒤로 사망이 5 ~ 9배 달라 이 값은 두 구간의 평균이다.
    // 2026-10 Wave 123 (소유자 결정 "구간 분리", 원장 §130): 단계 구간마다 따로 잰다 — 계승 7 ~ 9단계와 10 ~ 12단계(영구 능력치 ×2,
    // `getPrestigeUnlocks().statMult`). 카드를 무작위로 고르는 드라이버(`--rule-pick random`)의 늘 받아들임 · 겹친 카드만 거절
    // 240판 × 13회차로 쟀다 — 기본 카드로 재면 무거운 카드가 10단계 뒤로 밀려(Wave 122) 7 ~ 9단계 표본이 4 ~ 6판뿐이었다.
    // 짝이 아니고(첫 거절 뒤로 회차가 갈라진다) 판 수는 두 쪽 중 적은 쪽, 잰 단계는 받아들임 쪽에서 가장 많이 놓인 단계다.
    // 2026-10 Wave 125: 각인 발견이 계정 장부가 된 게임(새 각인 = 계정에 처음 모은 것)으로 같은 방식을 다시 쟀다(원장 §132.4).
    const band = (from: number, to: number, values: Omit<AscensionRuleOutlook, 'measuredRanks'>): AscensionRuleOutlook => ({ ...values, measuredRanks: [from, to] });
    const outlook: Record<string, readonly AscensionRuleOutlook[]> = {
        lost_pilgrimage: [
            band(7, 9, { measuredRank: 9, samples: 70, acceptedDeaths: 18.23, declinedDeaths: 2.86, acceptedSignatures: 1.19, declinedSignatures: 0.12 }),
            band(10, 12, { measuredRank: 12, samples: 67, acceptedDeaths: 4.3, declinedDeaths: 0.5, acceptedSignatures: 1.03, declinedSignatures: 0.01 }),
        ],
        empty_crusade: [
            band(7, 9, { measuredRank: 7, samples: 65, acceptedDeaths: 56.25, declinedDeaths: 2.67, acceptedSignatures: 1.06, declinedSignatures: 0.19 }),
            band(10, 12, { measuredRank: 10, samples: 64, acceptedDeaths: 6.05, declinedDeaths: 0.4, acceptedSignatures: 1.02, declinedSignatures: 0.03 }),
        ],
        dry_dragon_road: [
            band(7, 9, { measuredRank: 7, samples: 67, acceptedDeaths: 36.82, declinedDeaths: 2.1, acceptedSignatures: 1.15, declinedSignatures: 0.24 }),
            band(10, 12, { measuredRank: 10, samples: 58, acceptedDeaths: 2.55, declinedDeaths: 0.45, acceptedSignatures: 1, declinedSignatures: 0 }),
        ],
        tangled_legends: [
            band(7, 9, { measuredRank: 9, samples: 114, acceptedDeaths: 113.37, declinedDeaths: 2.81, acceptedSignatures: 1.32, declinedSignatures: 0.16 }),
            band(10, 12, { measuredRank: 12, samples: 126, acceptedDeaths: 13.28, declinedDeaths: 0.63, acceptedSignatures: 1.05, declinedSignatures: 0.03 }),
        ],
        fading_dimension: [
            band(7, 9, { measuredRank: 7, samples: 123, acceptedDeaths: 107.3, declinedDeaths: 2.99, acceptedSignatures: 1.19, declinedSignatures: 0.2 }),
            band(10, 12, { measuredRank: 12, samples: 116, acceptedDeaths: 9.76, declinedDeaths: 0.44, acceptedSignatures: 1.03, declinedSignatures: 0.01 }),
        ],
        shadow_legion: [
            band(7, 9, { measuredRank: 8, samples: 115, acceptedDeaths: 50.43, declinedDeaths: 2.49, acceptedSignatures: 1.04, declinedSignatures: 0.23 }),
            band(10, 12, { measuredRank: 11, samples: 117, acceptedDeaths: 3.62, declinedDeaths: 0.55, acceptedSignatures: 1, declinedSignatures: 0.02 }),
        ],
    };
    const entry = names[base.id];
    const stacked: AscensionRuleDef = {
        id: `stacked_${base.id}`,
        name: entry.name,
        modifier: base.modifier,
        signatureSet: base.signatureSet,
        conquestTitle: { id: `conquest_stacked_${base.id}`, name: entry.title },
        stackedOf: base.id,
        ...(base.optional ? { optional: true as const } : {}),
        outlook: outlook[base.id],
    };
    return stacked;
}));

/** 기본 + 겹친 규칙 전부(id 조회 · 정복 기록 · 칭호 번호). 번호는 이 순서다 — 기본 1 ~ 6, 겹친 7 ~ 12. */
export const ALL_ASCENSION_RULES: readonly AscensionRuleDef[] = Object.freeze([...ASCENSION_RULES, ...STACKED_ASCENSION_RULES]);
