/**
 * Monster domain types (cycle 58 phase 4).
 *
 * monsters.js + dropTables.js + 보스 패턴을 통합한 인터페이스.
 */

export interface MonsterBase {
    name: string;
    hp: number;
    maxHp?: number;
    atk: number;
    def?: number;
    exp: number;
    gold?: number;
    /** 속성 (화염/냉기/빛 등). */
    elem?: string;
    /** 보스 여부. */
    isBoss?: boolean;
    /** 엘리트 prefix 여부. */
    isElite?: boolean;
    /** 드랍 테이블 키 (dropTables.js). */
    dropTable?: string;
    /** prefix mod 적용 여부 (일반/광폭/거대/고대 등). */
    prefix?: string;
    /** 시그니처 드랍 매핑. */
    signatureDrops?: Array<{ name: string; rate: number }>;
}

export interface BossPhase {
    threshold: number;     // HP ratio (0~1) at which this phase activates
    name?: string;
    atkMult?: number;
    defMult?: number;
    skills?: string[];
}

export interface BossMonster extends MonsterBase {
    isBoss: true;
    phases?: BossPhase[];
    /** 다음 이벤트 / 이벤트 체인 트리거. */
    onDeath?: string;
}

export type Monster = MonsterBase | BossMonster;
