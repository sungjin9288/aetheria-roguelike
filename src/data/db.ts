import { CLASSES } from './classes.js';
import { ITEMS } from './items.js';
import { MAPS } from './maps.js';
import { MONSTERS } from './monsters.js';
import { QUESTS, ACHIEVEMENTS } from './quests.js';
import type { ClassDef } from '../types/class.js';
import type { ItemDatabase } from '../types/item.js';
import type { GameMap } from '../types/map.js';
import type { Monster } from '../types/monster.js';
import type { Quest, Achievement } from '../types/quest.js';

/**
 * 게임 정적 데이터의 단일 진입점.
 * UI/시스템은 DB.ITEMS, DB.MONSTERS 등을 통해서만 접근.
 *
 * cycle 58: 데이터 객체는 너무 커서 정확한 union narrowing이 비실용적.
 * 점진 적용 — 도메인 타입(Player/Item/Monster/GameMap)이 필요한 함수는
 * src/types/에서 import해 명시 사용.
 *
 * cycle 304: LOOT_TABLE / DROP_TABLES key 제거 — DB.LOOT_TABLE, DB.DROP_TABLES
 *   접근 0건. 모든 consumer는 data/loot.js / data/dropTables.js 직접 import.
 *   DB wrapper 2 dead key cleanup.
 *
 * 2026-07 타입화: 6필드 모두 any → 각 데이터 파일의 실제 export 타입을 재사용.
 * 각 소스(classes.ts/items.ts/maps.ts/monsters.ts/quests.ts)에서 이미 구체
 * 타입으로 export하므로 여기서는 그 타입을 그대로 참조만 한다.
 */
export const DB: {
    CLASSES: Record<string, ClassDef>;
    ITEMS: ItemDatabase;
    MAPS: Record<string, GameMap>;
    MONSTERS: Record<string, Monster>;
    QUESTS: Quest[];
    ACHIEVEMENTS: Achievement[];
} = {
    CLASSES,
    ITEMS,
    MAPS,
    MONSTERS,
    QUESTS,
    ACHIEVEMENTS,
};

Object.freeze(DB);
