/**
 * Map / Location domain types (cycle 58 phase 4 + cycle 60 phase D 완화).
 *
 * maps.ts의 42개 지역 + 무한 심연 정의를 망라.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 제거.
 * MAPS 52개 엔트리가 실제로 쓰는 필드만 선언한다. `type`은 4종 리터럴 유니온.
 */

/** MAPS 데이터에 존재하는 지역 분류 (4종). */
export type GameMapType = 'safe' | 'field' | 'dungeon' | 'boss';

export interface GameMap {
    /** 지역 이름 (보통 MAPS 객체의 key지만 일부 시나리오에서 명시적 보유). */
    name?: string;
    /** 지역 분류 — MAPS 52개가 쓰는 4종. */
    type?: GameMapType;
    // 2026-09 N3: `minLv`(입장 최소 레벨 legacy alias) 제거. MAPS 52개 중 정의한 지역이
    //   0개라 mapTopology/mapAccess/adventureGuide/MapNavigator의 `minLv ?? level`
    //   우선 분기는 한 번도 실행되지 않는 죽은 리더였다. 입장 레벨의 단일 진실 원천은
    //   `level`이다 — tests/data-shape-types.test.js가 재도입을 막는다.
    /** 레벨 — 숫자 / [최소, 최대] 범위 / 'infinite'(무한 심연). */
    level?: number | number[] | 'infinite';
    desc?: string;
    /** 분위기/배경 정보 (lore). */
    lore?: string;
    /** 인접 지역 (이동 가능). */
    exits?: string[];
    /** 일반 몬스터 풀. */
    monsters?: string[];
    /** 보스 몬스터 풀. */
    bossMonsters?: string[];
    /** 지역 보스 존재 여부 (boolean) — 단일 보스 이름은 legacy로 bossMonsters[0] 등에 위치. */
    boss?: boolean | string;
    /** 이벤트 발생 확률 (0~1). */
    eventChance?: number;
    /** 시즌 이벤트 기간에만 접근 가능한 지역인지 여부. */
    seasonOnly?: boolean;
    // cycle 284: isSignatureZone 제거 — runtime access 0건.
    /** 묘비 드롭 보정 (maps.ts 실측 — '잊혀진 묘지' 1곳만 보유). */
    graveDropBonus?: number;
    /** 상점 가격 보정 (maps.ts 실측 — 1곳만 보유). */
    shopBonus?: number;
}
