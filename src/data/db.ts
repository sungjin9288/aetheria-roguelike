import { CLASSES } from './classes.js';
import { ITEMS } from './items.js';
import { MAPS } from './maps.js';
import { MONSTERS } from './monsters.js';
import { LOOT_TABLE } from './loot.js';
import { DROP_TABLES } from './dropTables.js';
import { QUESTS, ACHIEVEMENTS } from './quests.js';

/**
 * 게임 정적 데이터의 단일 진입점.
 * UI/시스템은 DB.ITEMS, DB.MONSTERS 등을 통해서만 접근.
 */
export const DB = {
    CLASSES,
    ITEMS,
    MAPS,
    MONSTERS,
    LOOT_TABLE,
    DROP_TABLES,
    QUESTS,
    ACHIEVEMENTS,
} as const;

Object.freeze(DB);
