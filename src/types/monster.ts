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
    weakness?: string;
    resistance?: string;
    /** 보스 여부. */
    isBoss?: boolean;
    /** 엘리트 prefix 여부. */
    isElite?: boolean;
    dropMod?: number;
    /**
     * 강타(heavy hit) 적중 시 플레이어에게 부여하는 상태이상 키.
     * 소비처: CombatEngine.enemyAI.ts:239, utils/combatForecast.ts:74.
     */
    statusOnHit?: string;
    // cycle 283: elem / dropTable / prefix / signatureDrops 4 dead 필드 제거 — runtime access 0건.
    //   prefix는 mStats.name 직접 string 합치기, signatureDrops는 local variable 사용.
    /** 동적으로 추가되는 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}

// cycle 328: BossPhase export 제거 — phase2/phase3 필드 타입으로만 사용, 외부 import 0건.
interface BossPhase {
    threshold?: number;     // HP ratio (0~1) at which this phase activates
    name?: string;
    // cycle 283: atkMult / defMult / skills 3 dead 필드 제거 — 활성은 atkBonus / defBonus(cycle 228).
    atkBonus?: number;
    defBonus?: number;
    pattern?: { guardChance?: number; heavyChance?: number };
    log?: string;
    statusEffect?: string;
    [key: string]: any;
}

// cycle 298: BossMonster export 제거 — Monster 유니온 구성용 internal type.
interface BossMonster extends MonsterBase {
    isBoss: true;
    // cycle 283: phases (array) / onDeath 2 dead 필드 제거 — 활성은 phase2/phase3 singular.
    phase2?: BossPhase;
    phase3?: BossPhase;
}

export type Monster = MonsterBase | BossMonster;
