import { CONSTANTS } from '../data/constants.js';
import type { Player } from '../types/index.js';

/**
 * 발견한 지역 수 — 방문 목록에서 시작 마을을 뺀다(시작 마을은 처음부터 목록에 있다).
 * 2026-10 Wave 58이 업적에서, Wave 61이 임무 · 칭호 · 능력치 화면에서 같은 규칙으로 맞췄다(원장 §61 A6).
 */
export const countDiscoveredMaps = (stats: Player['stats'] | undefined): number => (
    Array.isArray(stats?.visitedMaps) ? stats.visitedMaps : []
).filter((map) => map !== CONSTANTS.START_LOCATION).length;
