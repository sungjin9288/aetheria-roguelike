/**
 * 순간 · 결과 카드의 움직임 한 갈래(감사 VD-14) — 디자인 토큰 `--aether-ease`(cubic-bezier(.2,.8,.2,1)) ·
 *   UI 200ms · 패널 320ms와 같은 값을 Framer Motion에 넘긴다. 모션 감소 설정은 GameRoot의 MotionConfig가 처리한다.
 */
export const MOMENT_EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const MOMENT_DUR_UI = 0.2;
export const MOMENT_DUR_PANEL = 0.32;
