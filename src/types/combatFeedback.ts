/**
 * 전투 차례의 연출 기록 (게임 필 감사 GF-01 · 02 · 06 · 11).
 *
 * 전투 한 차례(플레이어 행동 → 적 반격 → 정산)는 리듀서의 한 전이에서 끝난다(§8-1). 화면은 그 결과만 보므로
 * "누가 무엇을 했는가"를 기록 꼬리(마지막 줄의 종류)로 추측해 왔고, 그래서 플레이어 치명타 연출이 적의 강타에 붙었다.
 * 이 기록은 정산이 그 차례의 사실을 구조로 남긴 것이다 — 연출(치명타 비네트 · 강타 흔들림 · 처치 순간 · 주고받는 박자 ·
 * 화면 낭독기 요약)은 모두 이것을 읽는다.
 *
 * 저장하지 않는다: 세이브 봉투(일곱 필드)에 넣지 않고 `LOAD_DATA`가 비운다 — `presentationEpoch`처럼 표시 전용이라
 * `DATA_VERSION`과 무관하다. 게임 판정은 이 기록을 읽지 않는다.
 */
import type { MonsterBase } from './monster.js';

/** 전투 차례 해석기(`combatActionTurn` · `combatItemTurn`)가 결과와 함께 남기는 그 차례의 사실. */
export interface CombatTurnSignals {
    /** 플레이어의 이번 행동이 치명타였다. */
    playerCrit: boolean;
    /** 적의 이번 행동이 강타(브레스 포함)였다. */
    enemyHeavy: boolean;
    /** 적이 이번 차례에 행동했다(반격 단계가 있었다). */
    enemyActed: boolean;
    /** 차례 끝의 적 생명 — 처치면 마지막 일격 뒤 값이라 0 이하일 수 있다(넘친 피해). */
    enemyHpAfter: number;
}

/**
 * 쓰러진 적의 표시용 모습 — 처치 순간을 그리는 동안 상태 표시줄이 읽는다. 적의 무게(보스 · 의뢰 우두머리 · 정예) 표시가
 * 처치 순간에 바뀌지 않게 그 플래그도 함께 옮긴다.
 */
export type DefeatedEnemySnapshot = Required<Pick<MonsterBase, 'name' | 'baseName' | 'hp' | 'maxHp'>>
    & Pick<MonsterBase, 'isBoss' | 'isElite' | 'huntChampion'>;

/** 정산 영수증(`combatReceipt.kind`)과 같은 갈래 — 거부된 기술도 차례를 쓴다. */
export type CombatFeedbackKind = 'continue' | 'victory' | 'defeat' | 'escape' | 'rejected';

export interface CombatFeedback {
    /** 차례의 영수증 키(`combatReceipt.key`와 같다) — 연출이 새 차례를 알아보는 기준이다. */
    key: string;
    kind: CombatFeedbackKind;
    /** 이번 차례에 적이 잃은 생명(넘친 피해 포함, 0 이상). */
    enemyDamage: number;
    /** 이번 차례 플레이어 생명 변화(회복 +, 피해 −). 쓰러지면 0까지의 변화다. */
    playerHpDelta: number;
    playerCrit: boolean;
    enemyHeavy: boolean;
    enemyActed: boolean;
    /** 처치한 차례에만 있다. */
    defeatedEnemy: DefeatedEnemySnapshot | null;
}
