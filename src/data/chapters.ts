/**
 * 2026-11 B1 장 결산 (소유자 결정 2026-11-09 — 명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §1.2):
 * 장은 사냥 지역을 경로 게이트(시작의 마을에서 실제로 걸어 들어가는 최소 레벨) 묶음으로 나눈 것이다.
 * 이 표는 묶음의 게이트 하한과 이름만 갖고, 지역 목록은 `utils/chapters.ts`가 지도에서 도출한다(지역을 손으로 적지 않는다).
 * 경계는 게이트가 실제로 뛰는 곳(5 → 7, 12 → 14, 18 → 25, 25 → 35, 36 → 40, 40 → 42, 44 → 48)이다.
 * 장 이름은 지역 이름의 전체 문자열을 담지 않는다(길 잃은 여행 · 발견 원칙 — `tests/chapter-definition-contract.test.js`).
 */
export interface ChapterBand {
    readonly chapter: number;
    readonly minGate: number;
    readonly name: string;
}

export const CHAPTER_BANDS: readonly ChapterBand[] = Object.freeze([
    { chapter: 1, minGate: 1, name: '깨어나는 숲' },
    { chapter: 2, minGate: 7, name: '물 아래의 길' },
    { chapter: 3, minGate: 14, name: '바람과 불씨' },
    { chapter: 4, minGate: 25, name: '용의 그늘' },
    { chapter: 5, minGate: 35, name: '갈라진 대륙' },
    { chapter: 6, minGate: 40, name: '하늘의 상처' },
    { chapter: 7, minGate: 42, name: '깊은 어둠' },
    { chapter: 8, minGate: 48, name: '왕좌 앞에서' },
    { chapter: 9, minGate: 50, name: '잊힌 성역' },
    { chapter: 10, minGate: 62, name: '무너진 서고' },
    { chapter: 11, minGate: 68, name: '에테르의 끝' },
]);
