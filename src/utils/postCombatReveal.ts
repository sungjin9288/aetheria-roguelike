/**
 * 승리 보상 카드의 순서 공개 — 2026-10 (감사 GF-10). 카드가 한 번에 올라오고 '경험 +22 · 골드 +18'이 정적 글자라
 *   전투에서 얻은 것을 '받는' 감각이 약했다. 머리말 · 판단 칸 · 단추는 처음부터 보이고(판단은 기다리지 않는다),
 *   경험 · 골드는 0에서 값까지 늘고, 그다음 전리품이 차례로 튀어나온다. 카드를 누르면 바로 끝값이다.
 *   모션 감소 설정 · 서버 렌더에서는 처음부터 끝값이다. 시간표는 표시 연출 값이라 BALANCE가 아니라 여기 둔다.
 */
export const POST_COMBAT_REVEAL_TIMING = {
    /** 경험 · 골드가 0에서 값까지 느는 시간. */
    countUpMs: 400,
    /** 전리품 줄 사이 간격. */
    lootStaggerMs: 60,
    /** rAF가 멈춘 탭(숨은 창)에서도 끝값으로 닫히게 하는 여유. */
    settleGraceMs: 250,
} as const;

/**
 * 카드가 나타난 직후 주 행동 단추를 받지 않는 시간 — 전투를 끝낸 연타가 카드의 '계속 탐험'(이제 탐험을 바로 부른다)이나
 *   '장비 확인'을 누르지 않게 한다(감사 UX-10의 실수 방지). 닫기 단추는 언제나 받는다.
 */
export const POST_COMBAT_INPUT_GUARD_MS = 350;

/** 공개 단계 — 0: 경험 · 골드가 느는 중(전리품은 아직), 1: 끝(전리품까지 보인다). */
export type PostCombatRevealStage = 0 | 1;
export const POST_COMBAT_REVEAL_DONE: PostCombatRevealStage = 1;

/** 카드가 나타난 뒤 지난 시간 → 숫자 증가 진행도(0 ~ 1). */
export const getRevealProgress = (elapsedMs: number): number => {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    return Math.min(1, elapsedMs / POST_COMBAT_REVEAL_TIMING.countUpMs);
};

export const getRevealStage = (progress: number): PostCombatRevealStage => (
    progress >= 1 ? POST_COMBAT_REVEAL_DONE : 0
);

/** 숫자 증가 — 0에서 target까지 처음이 빠르고 끝이 느리다(ease-out). 진행도 1이면 정확히 target이다. */
export const getCountUpValue = (target: number, progress: number): number => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    if (progress >= 1) return safeTarget;
    if (!(progress > 0)) return 0;
    const eased = 1 - (1 - progress) ** 3;
    return Math.floor(safeTarget * eased);
};

/** n번째 전리품 줄이 튀어나오기까지의 지연(ms). */
export const getLootRevealDelayMs = (index: number): number => (
    Math.max(0, Math.floor(index)) * POST_COMBAT_REVEAL_TIMING.lootStaggerMs
);
