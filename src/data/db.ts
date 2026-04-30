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
 *
 * cycle 58: 데이터 객체는 너무 커서 정확한 union narrowing이 비실용적.
 * 점진 적용 — 도메인 타입(Player/Item/Monster/GameMap)이 필요한 함수는
 * src/types/에서 import해 명시 사용.
 */
export const DB: {
    CLASSES: any;
    ITEMS: any;
    MAPS: any;
    MONSTERS: any;
    LOOT_TABLE: any;
    DROP_TABLES: any;
    QUESTS: any;
    ACHIEVEMENTS: any;
} = {
    CLASSES,
    ITEMS,
    MAPS,
    MONSTERS,
    LOOT_TABLE,
    DROP_TABLES,
    QUESTS,
    ACHIEVEMENTS,
};

Object.freeze(DB);
