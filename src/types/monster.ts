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

import type { StatusId } from './player.js';
import type { RelicRarity } from './relic.js';

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
/** 적에게 거는 지속 피해 종류(Wave 55). */
export type EnemyDotId = 'burn' | 'poison' | 'bleed';

export interface MonsterPattern {
    guardChance: number;
    heavyChance: number;
}

/**
 * 몬스터 계열(2026-09 Wave 51, 소유자 결정 "성직자의 컨셉 — 언데드 · 마족에게 힐로 공격").
 * 이름 문자열로 추론하지 않고 데이터(`monsters.ts`)가 선언한다. 애매한 종(아누비스 수호자 · 강의 요괴 ·
 * 원한의 용사 · 공허/혼돈 계열)은 넣지 않았다. 판정은 종(`baseName`) 기준이다(`getMonsterFamily`).
 */
export type MonsterFamily = 'undead' | 'demon';

/**
 * 보스 기믹(2026-10 Wave 59, 소유자 결정 "전부 설명대로 구현") — 브리핑이 약속한 행동을 데이터가 선언하고
 * 엔진(`CombatEngine.enemyAI` · `combatActionTurn` · `handleVictory`)이 그대로 읽는다. 선언과 브리핑 문구의 대응은
 * `tests/boss-mechanics-contract.test.js`가 지킨다.
 */
export interface BossMechanics {
    /**
     * 2페이즈 뒤 강타가 거는 상태("누적 · 연속 기절 · 제어"). `chance`는 강타 1번당 확률(1이면 난수를 쓰지 않는다).
     * `maxStacks`가 있으면 쌓인다 — 지속 피해 · 저주는 겹칠수록 세지고(`BALANCE.STATUS_STACK_BONUS`), 빙결은 그 수만큼
     * 쌓이면 얼어붙는다(빙결 누적). 없으면 걸려 있지 않을 때만 건다(연속 기절).
     */
    heavyStatus?: { status: StatusId; chance: number; maxStacks?: number };
    /** 방어 자세 중에 맞으면 반격한다(공격력 × `mult`, "강한 카운터"). 방어 무시 기술에는 반격하지 않는다. */
    guardCounter?: { mult: number };
    /** 방어 자세를 취할 때 최대 생명의 이 비율을 회복한다("회복 압박"). */
    guardHeal?: number;
    /** `every`번째 행동마다 브레스 — 방어 판정 없이 공격력 × `mult`, 맞으면 `status`를 건다. */
    breath?: { every: number; mult: number; status?: StatusId };
    /** 2페이즈 전환 때 `count`체를 소환한다 — 적 행동마다 공격력 × `hitMult`로 함께 친다. 내 피해 행동 1번에 1체가 쓰러진다. */
    summon?: { name: string; count: number; hitMult: number };
    /** 장기전 손해 — `afterActions`번째 행동 뒤로 행동마다 공격력 +`perAction`(최대 `max`). */
    longFightEnrage?: { afterActions: number; perAction: number; max: number };
    /** 장기전 보상 — 처치 골드 · 경험치 × (1 + min(`max`, 행동 수 × `perAction`)). */
    longFightReward?: { perAction: number; max: number };
    /** 첫 토벌 골드 보너스 배율("대량 초회 보상"). */
    firstClearBonusMult?: number;
    /** 처치 때 유물 선택 1회 보장 — `rarities` 안에서, 이름에 `preferNames`가 들어간 유물을 먼저 보인다. */
    relicReward?: { rarities: readonly RelicRarity[]; preferNames?: readonly string[] };
    /**
     * 보너스 장비의 계열("화염 계열 장비" 등) — 6등급 무작위 대신 이 계열에서 뽑는다. 원소 · 이름 · 직업 중 하나라도 맞고
     * `minTier` 이상인 전설 각인 아닌 장비다(`getBossThemedLootPool`).
     */
    lootTheme?: { elems?: readonly ElementKey[]; nameIncludes?: readonly string[]; jobs?: readonly string[]; minTier?: number };
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
    /** 2026-10 Wave 80: 토벌 의뢰 우두머리 인스턴스면 그 지역 이름(`applyHuntChampion`이 붙인다 — 데이터 템플릿에는 없다). */
    huntChampion?: string;
    dropMod?: number;
    /**
     * 강타(heavy hit) 적중 시 플레이어에게 부여하는 상태이상 키.
     * 소비처: CombatEngine.enemyAI.ts:239, utils/combatForecast.ts:74.
     */
    statusOnHit?: string;
    /** 몬스터 계열(Wave 51) — 성직자 계열 회복 기술의 신성 피해(`smite`) 대상. 없으면 일반. */
    family?: MonsterFamily;
    /** 보스 기믹(Wave 59) — 스폰이 인스턴스로 복사한다. */
    mechanics?: BossMechanics;
    // cycle 283: elem / dropTable / prefix / signatureDrops 4 dead 필드 제거 — runtime access 0건.
    //   prefix는 mStats.name 직접 string 합치기, signatureDrops는 local variable 사용.

    // --- monsters.ts 템플릿 필드 (스폰 시 기본 곡선에 곱해진다) ---
    hpMult?: number;
    /**
     * 템플릿 공격력 배율 — 스폰 때 `atk`에 곱해지고 인스턴스에는 남지 않는다. Wave 44 이전에는
     * 약화가 같은 이름을 런타임 배율로 썼다(구세이브의 전투 중 적에 남아 있을 수 있으나 읽지 않는다).
     */
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
    /**
     * 지속 피해별 남은 틱(Wave 55, 설명이 "N턴간"이라고 말하는 기술 — 출혈베기 · 영혼 소환). 키가 없으면 전투 내내다.
     * 적 행동마다 피해를 준 뒤 1 줄고, 0이면 그 지속 피해가 사라진다.
     */
    dotTurns?: Partial<Record<EnemyDotId, number>>;
    /** 지속 피해별 피해 배율(Wave 55 — 출혈베기 A · 독바르기 A · 독 보강 · 역병의 안개 "+50%"). 없으면 1. */
    dotMults?: Partial<Record<EnemyDotId, number>>;
    /**
     * 약화 남은 턴 — 값은 "앞으로 영향받을 적 행동 수"다(Wave 44). 행동이 시작될 때 0보다 크면
     * 그 행동에 적용되고, 행동 뒤 1 줄어든다. 공격력 배율은 저장하지 않고 걸려 있는 약화에서
     * `getEnemyDebuffAtkMult`가 계산한다. 실명은 공격력이 아니라 빗나감 확률이다(Wave 55).
     */
    blindTurns?: number;
    fearTurns?: number;
    /** 공포의 공격력 배율 — 기술마다 다르다(Wave 42). 없으면 BALANCE.FEAR_ATK_MULT. */
    fearAtkMult?: number;
    cursedTurns?: number;
    stunnedTurns?: number;
    tauntTurns?: number;
    cursed?: boolean;
    taunted?: boolean;
    /** 이번 턴 방어 태세 여부. */
    guarding?: boolean;
    phase2Triggered?: boolean;
    phase3Triggered?: boolean;
    /** 이번 전투에서 이 적이 한 행동 수(Wave 59 — 브레스 주기 · 장기전). 기절 · 방어 턴도 센다. */
    actionCount?: number;
    /** 소환된 하수인 수(Wave 59 망자 소환). */
    summons?: number;
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
    /** 전환 때 거는 상태 — 둘 이상이면 함께 건다("상태이상이 겹칩니다", Wave 59). */
    statusEffect?: StatusId | readonly StatusId[];
    /** 이 페이즈에서는 상태 저항 유물 · 원소 저항 장비가 통하지 않는다("모든 저항이 무력화됩니다", Wave 59). */
    pierceResist?: boolean;
}

// cycle 298: BossMonster export 제거 — Monster 유니온 구성용 internal type.
interface BossMonster extends MonsterBase {
    isBoss: true;
    // cycle 283: phases (array) / onDeath 2 dead 필드 제거 — 활성은 phase2/phase3 singular.
    phase2?: BossPhase;
    phase3?: BossPhase;
}

export type Monster = MonsterBase | BossMonster;
