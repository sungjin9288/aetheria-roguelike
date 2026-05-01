/**
 * Monster domain types (cycle 58 phase 4 + cycle 60 phase D 완화).
 *
 * monsters.js + dropTables.js + 보스 패턴을 통합한 인터페이스.
 *
 * cycle 60: 모든 필드 optional + [key: string]: any 인덱스 시그니처.
 * 이유: 런타임에 동적으로 추가되는 필드 (dots, phase2Triggered, blindTurns,
 * stunnedTurns, atkMult, defMult, weakness, resistance 등) 호환성.
 */

export interface MonsterBase {
    name?: string;
    baseName?: string;
    hp?: number;
    maxHp?: number;
    atk?: number;
    def?: number;
    exp?: number;
    gold?: number;
    /** 속성 (화염/냉기/빛 등). */
    elem?: string;
    weakness?: string;
    resistance?: string;
    /** 보스 여부. */
    isBoss?: boolean;
    /** 엘리트 prefix 여부. */
    isElite?: boolean;
    /** 드랍 테이블 키 (dropTables.js). */
    dropTable?: string;
    dropMod?: number;
    /** prefix mod 적용 여부 (일반/광폭/거대/고대 등). */
    prefix?: string;
    /** 시그니처 드랍 매핑. */
    signatureDrops?: Array<{ name: string; rate: number }>;
    /** 동적으로 추가되는 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}

export interface BossPhase {
    threshold?: number;     // HP ratio (0~1) at which this phase activates
    name?: string;
    atkMult?: number;
    defMult?: number;
    atkBonus?: number;
    defBonus?: number;
    skills?: string[];
    pattern?: { guardChance?: number; heavyChance?: number };
    log?: string;
    statusEffect?: string;
    [key: string]: any;
}

export interface BossMonster extends MonsterBase {
    isBoss: true;
    phases?: BossPhase[];
    phase2?: BossPhase;
    phase3?: BossPhase;
    /** 다음 이벤트 / 이벤트 체인 트리거. */
    onDeath?: string;
}

export type Monster = MonsterBase | BossMonster;
