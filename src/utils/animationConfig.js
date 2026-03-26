/**
 * 중앙화된 Framer Motion 프리셋
 * 컴포넌트에서 inline으로 반복 정의하던 motion 값을 재사용 가능한 객체로 통합.
 *
 * 사용법:
 *   import { MOTION } from '../utils/animationConfig';
 *   <motion.div {...MOTION.fadeSlideUp}>
 *   <motion.div variants={MOTION.variants.tab} initial="hidden" animate="visible">
 */

// ── 개별 프리셋 (spread 용) ───────────────────────────────

/** 단순 페이드인 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
};

/** 아래→위 슬라이드 + 페이드 (기본 y=12) */
export const fadeSlideUp = (y = 12) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
});

/** 오른쪽→왼쪽 슬라이드 + 페이드 */
export const fadeSlideRight = (x = 20) => ({
  initial: { opacity: 0, x },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3 },
});

/** 스케일 + 페이드 (모달/카드 진입) */
export const fadeScale = (scale = 0.95) => ({
  initial: { opacity: 0, scale },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: 'easeOut' },
});

/** 높이 확장 (아코디언) */
export const expandHeight = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.25 },
};

/** 페이지/앱 레벨 진입 */
export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

// ── variants 객체 (variants prop 용) ──────────────────────

export const variants = {
  /** Dashboard 탭 전환 */
  tab: {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  },

  /** 리스트 아이템 (stagger 부모와 함께 사용) */
  listItem: {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  },

  /** 오버레이 백드롭 */
  overlay: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  },
};

// ── 공통 transition ──────────────────────────────────────

export const transition = {
  fast: { duration: 0.15 },
  normal: { duration: 0.3 },
  slow: { duration: 0.5 },
  spring: { type: 'spring', stiffness: 300, damping: 24 },
};

// ── 인터랙션 프리셋 ──────────────────────────────────────

export const interaction = {
  /** 버튼 탭 */
  tap: { whileTap: { scale: 0.97 } },
  /** 버튼 호버 */
  hover: { whileHover: { scale: 1.02 } },
  /** 탭 + 호버 */
  tapHover: { whileTap: { scale: 0.97 }, whileHover: { scale: 1.02 } },
};

// ── 통합 export ──────────────────────────────────────────

export const MOTION = {
  fadeIn,
  fadeSlideUp,
  fadeSlideRight,
  fadeScale,
  expandHeight,
  pageEnter,
  variants,
  transition,
  interaction,
};
