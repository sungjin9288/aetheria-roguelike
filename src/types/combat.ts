/**
 * 전투 결과 도메인 타입 (2026-09 Wave 8 Z1).
 *
 * `PostCombatResult` — 승리 직후 카드(`components/PostCombatCard.tsx`)가 읽는 정산
 * 스냅샷. 진실의 원천은 생산자 리터럴 **하나**다: `hooks/combatActions/combatVictory.ts`의
 * `AT.SET_POST_COMBAT_RESULT` dispatch. 그래서 필드 타입도 손으로 다시 적지 않고
 * 그 dispatch가 넘기는 값의 출처에서 도출한다 — 힌트 2개는 생산 함수의 `ReturnType`,
 * 적/전리품/플레이어 수치는 도메인 타입 인덱스 접근(`Monster['name']`·`Item['name']`·
 * `Player['hp']`), 성장 방향은 빌드 프로파일의 `primary.name`.
 *
 * 소비자가 "생산자가 안 쏘는 필드"를 읽는 경우는 여기에 넓혀 주지 않는다 —
 * 아래 두 optional 그룹만 예외이고, 각각 실제 생산자가 있다:
 *   1. `postCombatChoiceResolved` / `postCombatChoice` — reducer(`handlers/combatHandlers.ts`의
 *      `RESOLVE_POST_COMBAT_CHOICE`)가 카드의 "밀어붙인다 / 숨을 고른다" 선택을 적용할 때
 *      기존 결과에 덧붙인다.
 *   2. `hpLow` / `mpLow` — QA 시드(`hooks/useGameTestApi.injectPostCombatResult`)만 쏘는
 *      레거시 별칭이고, `utils/outcomeAnalysis.ts`가 비율 계산보다 우선해서 읽는다
 *      (`tests/cycle-500-599.test.js` cycle 557이 그 분기를 고정한다). 실제 승리 흐름은
 *      `playerHp`/`playerMaxHp`(수치)를 쏘므로 프로덕션 경로에는 나타나지 않는다.
 *
 * 타입에 **넣지 않은** 별칭 2개(생산자 0건 — 기록만 한다):
 *   - `loot`: 어떤 생산자도 쏘지 않는 dead read였다. 카드(`PostCombatCard`)에서 제거했고,
 *     `utils/outcomeAnalysis.ts`의 같은 분기는 Z3 소유라 그 트랙에서 함께 지운다.
 *   - `difficultyLabel`: `utils/gameUtils.buildRunSummary`(귀환 요약)의 필드다.
 *     `getPostCombatAnalysis`가 같은 이름을 읽지만 전투 결과 생산자는 쏘지 않는다
 *     (테스트 픽스처만 넘긴다 — `tests/outcome-analysis.test.js`).
 */

import type { Item } from './item.js';
import type { Monster } from './monster.js';
import type { Player } from './player.js';
import type { getLootUpgradeHint } from '../hooks/combatActions/_helpers.js';
import type { getRunBuildProfile, getTraitLootHint } from '../utils/runProfileUtils.js';
import type { PostCombatChoiceId } from '../utils/postCombatChoice.js';

/** 처치한 적의 등급 — 생산자가 `isBossKill` / `deadEnemy.isElite`로 정한다. */
export type PostCombatEnemyTier = 'BOSS' | 'ELITE' | 'NORMAL';

/** 장비 갱신 / 성향 공명 힌트 — 생산 함수의 반환형이 곧 계약이다. */
export type PostCombatUpgradeHint = ReturnType<typeof getLootUpgradeHint>;
export type PostCombatTraitHint = ReturnType<typeof getTraitLootHint>;

export interface PostCombatResult {
    /** 처치한 적 이름 (`deadEnemy.name`). */
    enemy: Monster['name'];
    enemyTier: PostCombatEnemyTier;
    isBoss: boolean;
    exp: number;
    gold: number;
    /** 가방에 실제로 들어간 전리품의 **이름** 목록 (`admittedItems.map((i) => i.name)`). */
    items: Array<Item['name']>;
    leveledUp: boolean;
    playerHp: Player['hp'];
    /** 생산자는 `victoryStats.maxHp`(= `updatedPlayer.maxHp`)를 쏜다. */
    playerMaxHp: Player['maxHp'];
    playerMp: Player['mp'];
    playerMaxMp: Player['maxMp'];
    invFull: boolean;
    /** 현재 성장 방향 라벨 (`getRunBuildProfile(...).primary.name`). */
    primaryBuild: ReturnType<typeof getRunBuildProfile>['primary']['name'];
    enemyWeakness: NonNullable<Monster['weakness']> | null;
    enemyResistance: NonNullable<Monster['resistance']> | null;
    upgradeHint: PostCombatUpgradeHint;
    traitHint: PostCombatTraitHint;
    bossRewardHint: string | null;
    bossClearBonus: number;

    // ── reducer가 덧붙이는 선택 상태 (위 주석 1) ──────────────────────────
    postCombatChoiceResolved?: boolean;
    postCombatChoice?: PostCombatChoiceId;

    // ── QA 시드 전용 레거시 별칭 (위 주석 2) ─────────────────────────────
    hpLow?: boolean;
    mpLow?: boolean;
}
