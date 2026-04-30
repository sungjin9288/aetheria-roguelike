/**
 * Map / Location domain types (cycle 58 phase 4).
 *
 * maps.js의 42개 지역 + 무한 심연 정의를 망라.
 */

export type MapType = 'safe' | 'danger' | 'boss';

export interface GameMap {
    name: string;
    type: MapType;
    /** 입장 가능 최소 레벨. */
    minLv?: number;
    /** legacy alias for minLv. */
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
    /** 단일 보스. */
    boss?: string;
    /** 이벤트 발생 확률 (0~1). */
    eventChance?: number;
    /** 시그니처 보스 권역 여부 (전설 각인 드랍). */
    isSignatureZone?: boolean;
}
