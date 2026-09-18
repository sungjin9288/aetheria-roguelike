/**
 * Monster domain types (cycle 58 phase 4 + cycle 60 phase D 완화
 *   → 2026-09 Wave 3 L stage 1).
 *
 * monsters.ts의 템플릿(배율·패턴·페이즈)과 전투 중 스폰된 인스턴스(hp/atk/상태이상)를
 * 같은 인터페이스로 담는다.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 제거.
 * 템플릿 필드(`hpMult`/`atkMult`/`pattern`/`phase2`…)와 런타임에 붙는 전투 상태 필드
 * (`dots`/`stunnedTurns`/`guarding`…)를 전부 명시 선언했다. 이제 `enemy.오타`가 컴파일 에러다.
 */

/** 속성 — monsters.ts의 weakness/resistance에 실제로 등장하는 값 전체. */
export type ElementKey =
    | '냉기'
    | '대지'
    | '물리'
    | '바람'
    | '빛'
    | '어둠'
    | '에테르'
    | '자연'
    | '화염';

/**
 * 적 행동 패턴 확률 (템플릿 / 보스 페이즈 공용).
 * monsters.ts의 187개 pattern 전부가 두 확률을 모두 정의하므로 필수로 둔다.
 */
// 2026-09 N3: `pattern.statusEffect` / `pattern.statusChance` 제거. MONSTERS의 pattern
//   187개(base/phase2/phase3) 중 이 두 키를 정의한 것이 0개라 CombatEngine.enemyAI의
//   heavy-hit 분기와 combatForecast의 fallback은 한 번도 실행되지 않는 죽은 리더였다.
//   상태이상 부여의 살아 있는 경로는 몬스터 최상위 `statusOnHit`(+ 보스 페이즈의
//   `phase2/phase3.statusEffect`)뿐이다 — tests/data-shape-types.test.js가 재도입을 막는다.
export interface MonsterPattern {
    guardChance: number;
    heavyChance: number;
}

export interface MonsterBase {
    name?: string;
    baseName?: string;
    hp?: number;
    maxHp?: number;
    atk?: number;
    def?: number;
    exp?: number;
    gold?: number;
    /** 스폰 시 부여되는 적 레벨 (보상/난이도 계산). */
    level?: number;
    weakness?: ElementKey;
    resistance?: ElementKey;
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

    // --- monsters.ts 템플릿 필드 (스폰 시 기본 곡선에 곱해진다) ---
    hpMult?: number;
    atkMult?: number;
    defMult?: number;
    expMult?: number;
    goldMult?: number;
    /** 기본 행동 패턴 (미정의 시 BALANCE 기본값). */
    pattern?: MonsterPattern;
    /** 보스 2/3페이즈 정의 (isBoss 템플릿만 보유). */
    phase2?: BossPhase;
    phase3?: BossPhase;

    // --- 전투 중 인스턴스에 붙는 상태 (CombatEngine.status / enemyAI) ---
    /** 지속 피해 상태 키 목록 ('burn' | 'poison' | 'bleed'). */
    dots?: string[];
    blindTurns?: number;
    fearTurns?: number;
    cursedTurns?: number;
    stunnedTurns?: number;
    tauntTurns?: number;
    cursed?: boolean;
    taunted?: boolean;
    /** 이번 턴 방어 태세 여부. */
    guarding?: boolean;
    phase2Triggered?: boolean;
    phase3Triggered?: boolean;
}

// cycle 328: BossPhase export 제거 — phase2/phase3 필드 타입으로만 사용, 외부 import 0건.
interface BossPhase {
    threshold?: number;     // HP ratio (0~1) at which this phase activates
    name?: string;
    // cycle 283: atkMult / defMult / skills 3 dead 필드 제거 — 활성은 atkBonus / defBonus(cycle 228).
    atkBonus?: number;
    defBonus?: number;
    pattern?: MonsterPattern;
    log?: string;
    statusEffect?: string;
}

// cycle 298: BossMonster export 제거 — Monster 유니온 구성용 internal type.
interface BossMonster extends MonsterBase {
    isBoss: true;
    // cycle 283: phases (array) / onDeath 2 dead 필드 제거 — 활성은 phase2/phase3 singular.
    phase2?: BossPhase;
    phase3?: BossPhase;
}

export type Monster = MonsterBase | BossMonster;
