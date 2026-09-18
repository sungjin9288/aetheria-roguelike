/**
 * 도메인 타입 통합 export — cycle 58 phase 4 + cycle 60 phase D batch 11.
 *
 * 사용:
 *   import type { Player, Item, Monster, GameMap, Relic } from '../types';
 */

export type * from './item.js';
export type * from './monster.js';
export type * from './map.js';
export type * from './player.js';
export type * from './relic.js';
export type * from './class.js';
export type * from './quest.js';
export type * from './progression.js';
export type * from './session.js';
export type * from './combat.js';

/**
 * 파생 전투 스탯 — 계산식(`utils/statsCalculator.calculateFullStats`)이 곧 정의라
 * 손으로 다시 적지 않고 반환 타입에서 추론한다. 타입 전용 re-export라 런타임 의존은 없다.
 */
export type { FullStats } from '../utils/statsCalculator.js';
