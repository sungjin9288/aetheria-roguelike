// Source notes:
// - Tuned for Korean-written fantasy proper names rather than modern real-world names.
// - Mixes curated hero/villain style names with syllable pools that stay readable in Hangul.

const CURATED_FANTASY_NAMES: any = [
    '아르덴', '엘리안', '세라핀', '루미엘', '카이론', '벨로아', '테오른', '리오넬',
    '에단', '이리엘', '노바린', '세리온', '라에나', '카엘', '루시안', '실베르',
    '아린델', '에르딘', '바레온', '마레아', '세라엘', '로웬', '키리아', '엘로엔',
    '칼리온', '드레이크', '아드린', '헤리온', '벨리아', '제라드', '리베아', '오르칸',
    '리안나', '카르멘', '엘시아', '루비아', '세이라', '아스텔', '네리온', '에일린',
];

const FANTASY_PREFIXES: any = [
    '아르', '엘', '세', '루', '카', '벨', '테', '리', '에', '노',
    '실', '라', '오', '헤', '제', '마', '키', '드', '이', '로',
];

const FANTASY_MIDDLES: any = [
    '리', '라', '로', '린', '엘', '엔', '온', '안', '에', '아',
    '베', '시', '루', '네', '디', '레',
];

const FANTASY_SUFFIXES: any = [
    '안', '엘', '온', '린', '아', '나', '엔', '르', '론', '엘라',
    '리온', '시아', '델', '하임', '로스', '베아', '드', '아르',
];

const HANGUL_NAME_RE = /^[가-힣]{2,4}$/;

const randomIndex = (length: any, rng: any) => Math.floor(rng() * length);
const pick = (items: any, rng: any) => items[randomIndex(items.length, rng)];

const dedupeName = (name: any) => {
    const chars = Array.from(name);
    if (chars.length >= 2 && chars.every((char: any) => char === chars[0])) {
        return `${chars[0]}린`;
    }
    return name;
};

const trimToFourSyllables = (name: any) => Array.from(name).slice(0, 4).join('');

const generateFromParts = (rng: any) => {
    const roll = rng();

    if (roll < 0.5) {
        return dedupeName(trimToFourSyllables(`${pick(FANTASY_PREFIXES, rng)}${pick(FANTASY_SUFFIXES, rng)}`));
    }

    return dedupeName(
        trimToFourSyllables(`${pick(FANTASY_PREFIXES, rng)}${pick(FANTASY_MIDDLES, rng)}${pick(FANTASY_SUFFIXES, rng)}`)
    );
};

// cycle 611: rng default Math.random 제거 — explicit default-elimination
//   pattern (cycle 608/609 신규 lens 3번째 적용). IntroScreen 2 production
//   caller에 Math.random 명시 추가 후 default unreachable.
export const createRandomMobileName = (rng: any) => {
    const roll = rng();
    const name = roll < 0.62 ? pick(CURATED_FANTASY_NAMES, rng) : generateFromParts(rng);
    return HANGUL_NAME_RE.test(name) ? name : '아르덴';
};

export const __NAME_GENERATOR_TESTING__ = {
    CURATED_FANTASY_NAMES,
    FANTASY_PREFIXES,
    FANTASY_MIDDLES,
    FANTASY_SUFFIXES,
    HANGUL_NAME_RE,
};
