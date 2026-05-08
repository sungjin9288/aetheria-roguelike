/**
 * Barrel re-export — 하위 호환성 유지
 * 실제 구현: src/utils/runProfile.js
 * 데이터 상수: src/data/traits.js
 *
 * cycle 319: dead `import type { Monster, Player }` 2 줄 제거 — barrel re-export
 *   파일에서 unused. `export *`만 필요.
 */
export * from './runProfile.js';
