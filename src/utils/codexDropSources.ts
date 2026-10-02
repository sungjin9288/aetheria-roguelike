import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { DROP_TABLES } from '../data/dropTables';
import { LOOT_TABLE, getLootTable } from '../data/loot';

/**
 * 도감의 몬스터 전리품 · 소재 획득처 (2026-10 Wave 61).
 *
 * 엔진(`processLoot`, systems/CombatEngine.loot.ts)과 같은 표 선택 규칙을 읽는다 — 드롭 표(`DROP_TABLES`)가 있는
 * 몬스터는 그 표만 돌리고 곧바로 반환하므로 레거시 표(`LOOT_TABLE`)는 드롭 표가 없는 몬스터에게만 쓰인다. 도감이 레거시
 * 표만 읽던 동안 두 표를 다 가진 80종 중 28종이 틀렸다(미라 → 나오지 않는 저주해제 주문서, 레드 드래곤 → 숨은
 * 라그나로크, 드롭 표만 있는 6종은 빈칸), 소재 56개 중 20개의 획득처가 틀렸다(와이번 날개 등 6개는 "획득처 없음").
 * 표의 항목은 엔진처럼 전리품 후보(소재 · 소모품 · 무기 · 방어구)에 있는 이름만, 확률이 0보다 큰 줄만 센다.
 *
 * 몬스터별 표가 아니라 적 레벨 · 계승 단계가 정하는 추가 전리품은 넣지 않는다 — 후반 강화 재료(적 레벨
 * `ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL` 이상, 같은 몬스터도 나오는 지역에 따라 달라진다)는 소재 기록이 규칙으로 따로
 * 알리고(`MSG.CODEX_ENHANCE_MATERIAL_LATE_SOURCE`), 고레벨 보너스 장비 · 계승 보스 희귀 장비는 등급 풀에서 무작위다.
 * `tests/codex-drop-source-contract.test.js`가 엔진 `processLoot`를 오라클로 전 몬스터를 대조한다.
 */

const LOOTABLE_ITEM_NAMES: ReadonlySet<string> = new Set(
    [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]
        .map((item) => item.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
);

/** 엔진이 그 몬스터에게 돌리는 표의 항목 이름(표 순서, 중복 제거). 표가 없으면 빈 배열. */
export const getMonsterCodexDrops = (monsterName: string): string[] => {
    const enrichedList = DROP_TABLES[monsterName];
    const names = enrichedList
        ? enrichedList
            .filter((entry) => entry.rate > 0 && (entry.qty ? entry.qty[1] >= 1 : true))
            .map((entry) => entry.item)
        : (BALANCE.DROP_CHANCE > 0 ? [...(getLootTable(monsterName) || [])] : []);
    return [...new Set(names.filter((name) => LOOTABLE_ITEM_NAMES.has(name)))];
};

let materialSourceIndex: Map<string, string[]> | null = null;

const buildMaterialSourceIndex = (): Map<string, string[]> => {
    const index = new Map<string, string[]>();
    const monsters = [...new Set([...Object.keys(DROP_TABLES), ...Object.keys(LOOT_TABLE)])];
    for (const monster of monsters) {
        for (const itemName of getMonsterCodexDrops(monster)) {
            index.set(itemName, [...(index.get(itemName) || []), monster]);
        }
    }
    return index;
};

/** 엔진 전리품 표에 그 아이템이 있는 몬스터(드롭 표 순서 → 레거시 표 순서). 없으면 빈 배열. */
export const getMaterialCodexSources = (materialName: string): string[] => {
    materialSourceIndex ??= buildMaterialSourceIndex();
    return [...(materialSourceIndex.get(materialName) || [])];
};
