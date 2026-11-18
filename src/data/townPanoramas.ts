/**
 * 마을 무대의 전경 그림 — 지역 그림(정사각 썸네일)보다 큰 세로 그림이 있는 안전지대만 적는다.
 * 시작의 마을은 인트로 화면(IntroScreen의 배경 — 그 경로는 인트로 계약이 소스에서 잡는다)과 같은 그림이다. 없으면 마을 무대는 지역 그림 창을 그린다.
 */
export const STARTING_VILLAGE_ART = '/assets/intro/aetheria-starting-village.webp';

export const TOWN_PANORAMAS: Readonly<Record<string, string>> = Object.freeze({
    '시작의 마을': STARTING_VILLAGE_ART,
});

export const getTownPanorama = (loc: string | null | undefined): string | null => (
    loc ? TOWN_PANORAMAS[loc] ?? null : null
);
