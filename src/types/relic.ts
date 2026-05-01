/**
 * Relic domain type (cycle 60 phase D batch 11).
 *
 * 53개 유물의 effect-기반 다형 데이터를 망라한 permissive 인터페이스.
 *
 * 정착 전략: effect별 val 형태가 number / { atk, def } / { threshold, mult } /
 * { drop, gold } 등으로 매우 다양하므로 strict union 대신 [key: string]: any를
 * 사용해 런타임 호환성을 우선한다. effect 분기는 RelicEffect 문자열 enum
 * (자유 string)으로 강제하지 않고, 코드의 string equality 비교만으로 처리한다.
 */

export interface Relic {
    id?: string;
    name?: string;
    rarity?: string;
    desc?: string;
    /** 유물의 효과 키 (CombatEngine + 패시브 처리에서 분기). */
    effect?: string;
    /** 효과 매개변수 — number 단일값이거나 { threshold, mult } 같은 dict. */
    val?: any;
    /** 발동 임계값 (값에 따라 val 안에 들거나 외부에 있음). */
    threshold?: number;
    /** 동적으로 추가되는 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}
