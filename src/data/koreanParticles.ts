/**
 * koreanParticles.ts — 이름 · 숫자 뒤에 붙는 조사를 받침에 맞춘다(Wave 129, 원장 §140).
 *
 * 화면 문구가 이름 뒤에 조사를 고정으로 붙이던 동안 받침과 어긋난 문장이 나왔다 — Lv5 전직 단추 "도적로 전직",
 * 안전지대 출발 단추 "수정 동굴으로 출발", 기술 분기 "화염구을 어떻게 바꿀까?". 나머지는 "슬라임이(가) 3 피해"처럼
 * 둘 다 적었다(가장 많이 읽는 전투 기록). 조사는 이 파일 하나가 고른다 — 문구에 조사를 고정으로 붙이거나
 * 괄호로 둘 다 적지 말 것(`tests/korean-particle-contract.test.js`의 부재 불변식이 잡는다).
 *
 * 판정은 끝소리다: 받침 없음 · ㄹ 받침 · 그 밖의 받침. '으로/로'만 ㄹ 받침에서 '로'를 쓰고, 나머지 쌍은 받침이
 * 있으면 앞 형태(을 · 이 · 은 · 과)다. 숫자는 읽는 소리로 판정한다(3 = 삼 → '을', 10 = 십 → '을', 5 = 오 → '를').
 * 끝소리를 알 수 없는 글자(로마자 등)는 두 형태를 함께 적는다 — 틀린 한쪽을 고르지 않는다.
 */

export type ParticlePair = '을/를' | '이/가' | '은/는' | '과/와' | '으로/로';

/** 끝소리 — 받침 없음 · ㄹ 받침 · 그 밖의 받침. */
export type FinalSound = 'open' | 'rieul' | 'closed';

interface ParticleForms {
    /** 받침이 있을 때(으로/로는 ㄹ이 아닌 받침일 때). */
    closed: string;
    /** 받침이 없을 때(으로/로는 ㄹ 받침일 때도). */
    open: string;
    /** 끝소리를 알 수 없을 때 — 두 형태를 함께 적는다. */
    unknown: string;
}

const PARTICLE_FORMS: Record<ParticlePair, ParticleForms> = {
    '을/를': { closed: '을', open: '를', unknown: '을(를)' },
    '이/가': { closed: '이', open: '가', unknown: '이(가)' },
    '은/는': { closed: '은', open: '는', unknown: '은(는)' },
    '과/와': { closed: '과', open: '와', unknown: '과(와)' },
    '으로/로': { closed: '으로', open: '로', unknown: '(으)로' },
};

const HANGUL_SYLLABLE_FIRST = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;
const JONGSEONG_RIEUL = 8;

// 숫자 끝자리의 읽는 소리: 일(ㄹ) · 이 · 삼(ㅁ) · 사 · 오 · 육(ㄱ) · 칠(ㄹ) · 팔(ㄹ) · 구.
// 0으로 끝나면 영 · 십 · 백 · 천 · 만 · 억으로 읽혀 모두 받침이 있다.
const DIGIT_FINAL_SOUND: Record<string, FinalSound> = {
    0: 'closed',
    1: 'rieul',
    2: 'open',
    3: 'closed',
    4: 'open',
    5: 'open',
    6: 'closed',
    7: 'rieul',
    8: 'rieul',
    9: 'open',
};

// 끝에 붙은 닫는 괄호 · 따옴표 · 공백은 건너뛴다 — "[불꽃 검]은" · "「조합」이"는 안의 이름으로 판정한다.
const TRAILING_WRAPPERS = /[\s)\]}」』》〉"'”’]+$/u;

const syllableFinalSound = (ch: string): FinalSound | null => {
    const code = ch.codePointAt(0) ?? 0;
    if (code < HANGUL_SYLLABLE_FIRST || code > HANGUL_SYLLABLE_LAST) return null;
    const jongseong = (code - HANGUL_SYLLABLE_FIRST) % JONGSEONG_COUNT;
    if (jongseong === 0) return 'open';
    return jongseong === JONGSEONG_RIEUL ? 'rieul' : 'closed';
};

/** 낱말의 끝소리. 알 수 없으면 null. */
export const getFinalSound = (word: unknown): FinalSound | null => {
    const text = String(word ?? '').replace(TRAILING_WRAPPERS, '');
    const last = text.slice(-1);
    if (!last) return null;
    if (last in DIGIT_FINAL_SOUND) return DIGIT_FINAL_SOUND[last];
    // '%'는 '퍼센트'로 읽는다.
    if (last === '%') return 'open';
    return syllableFinalSound(last);
};

/** 낱말 뒤에 붙일 조사만. */
export const josa = (word: unknown, pair: ParticlePair): string => {
    const forms = PARTICLE_FORMS[pair];
    const sound = getFinalSound(word);
    if (sound === null) return forms.unknown;
    if (pair === '으로/로') return sound === 'closed' ? forms.closed : forms.open;
    return sound === 'open' ? forms.open : forms.closed;
};

/** 낱말 + 조사. */
export const withJosa = (word: unknown, pair: ParticlePair): string => `${word}${josa(word, pair)}`;
