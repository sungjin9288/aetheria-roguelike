import { CLASSES } from './classes.js';
import { ITEMS } from './items.js';
import { MAPS } from './maps.js';
import { MONSTERS } from './monsters.js';
import { QUESTS, ACHIEVEMENTS } from './quests.js';

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
 */
export const DB: {
    CLASSES: any;
    ITEMS: any;
    MAPS: any;
    MONSTERS: any;
    QUESTS: any;
    ACHIEVEMENTS: any;
} = {
    CLASSES,
    ITEMS,
    MAPS,
    MONSTERS,
    QUESTS,
    ACHIEVEMENTS,
};

Object.freeze(DB);
