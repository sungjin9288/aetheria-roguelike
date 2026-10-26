/**
 * 화면 안 스크롤 이동의 동작 — 모션을 줄이도록 설정한 사용자(prefers-reduced-motion: reduce)에게는 즉시 옮긴다.
 * framer-motion 애니메이션은 `MotionConfig reducedMotion="user"`가 줄이지만, 네이티브 `scrollIntoView` · `scrollTo` ·
 * `scrollBy`의 'smooth'는 그 설정 밖이라 호출부가 이 값을 쓴다(2026-10 통합 감사 town-nav UX-01 · UX-08).
 */
export const getPreferredScrollBehavior = (): ScrollBehavior => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'smooth';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
};
