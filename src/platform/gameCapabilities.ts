export interface GameCapabilities {
    /**
     * 다른 차원의 묘비(2026-10 Wave 70) — 죽을 때 공개 묘비를 올리고, 온라인 세션이 최근 공개 묘비를 읽어 탐험 이벤트로 만난다.
     * 공개 목록에서 골라 침공하던 화면(Wave 69까지 `publicGraveInvasion`, 꺼져 있었다)은 없앴다.
     */
    dimensionGraveEvent: boolean;
}

export const PRODUCTION_GAME_CAPABILITIES: Readonly<GameCapabilities> = Object.freeze({
    dimensionGraveEvent: true,
});
