/**
 * Map / Location domain types (cycle 58 phase 4 + cycle 60 phase D 완화).
 *
 * maps.ts의 42개 지역 + 무한 심연 정의를 망라.
 *
 * cycle 60: 모든 필드 optional + [key: string]: any 인덱스 시그니처.
 * 이유: maps.ts가 `level: number | 'infinite'`, `type: 'safe' | 'dungeon' | 'boss'`,
 * `boss`, `bossMonsters`, `eventChance` 등 다양한 형태로 데이터를 정의하며
 * exploreUtils / mapProgress 등 런타임에서 임의 필드(progressed 등)를 추가/조회한다.
 */

// cycle 284: MapType type alias 제거 — string의 단순 alias라 직접 string 사용으로 충분.

export interface GameMap {
    /** 지역 이름 (보통 MAPS 객체의 key지만 일부 시나리오에서 명시적 보유). */
    name?: string;
    /** 지역 분류 ('safe' | 'dungeon' | 'boss' 등). */
    type?: string;
    /** 입장 가능 최소 레벨 (legacy alias: level). */
    minLv?: number;
    /** 레벨 — 숫자 또는 'infinite'. */
    level?: number | 'infinite';
    desc?: string;
    /** 분위기/배경 정보 (lore). */
    lore?: string;
    /** 인접 지역 (이동 가능). */
    exits?: string[];
    /** 일반 몬스터 풀. */
    monsters?: string[];
    /** 보스 몬스터 풀. */
    bossMonsters?: string[];
    /** 단일 보스 (legacy 단일 필드). */
    boss?: string;
    /** 이벤트 발생 확률 (0~1). */
    eventChance?: number;
    // cycle 284: isSignatureZone 제거 — runtime access 0건.
    /** 동적으로 추가되는 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}
