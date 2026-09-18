/**
 * DifficultyManager.js — AI Stage 3: 동적 난이도 조절 게임 마스터
 *
 * 플레이어의 최근 전투 성과(승률, HP 소모율, 탈출률, 죽음 빈도)를 분석하여
 * 몬스터 스탯을 ±15% 범위에서 동적으로 조절합니다.
 *
 * 설계 원칙:
 *  - 너무 쉬우면 → 몬스터 강화 (최대 +15%)
 *  - 너무 어려우면 → 몬스터 약화 (최대 -15%)
 *  - 보통이면 → 변동 없음 (±5% 완만한 조절)
 *  - 연산은 항상 순수 함수로 사이드 이펙트 없음
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. 성과 지표 계산
// ─────────────────────────────────────────────────────────────────────────
import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { Player } from '../types/index.js';
import type { SpawnedMonster } from '../utils/exploreUtils.js';

/**
 * applyDynamicDifficulty가 받고 돌려주는 mStats — spawnEnemy()가 만드는
 * SpawnedMonster 그대로다(Monster로 느슨하게 받으면 hp/maxHp/atk/exp/gold/name이
 * 전부 optional이라, exploreFlow.ts가 그 필드들을 optional 처리 없이 바로 산술/로그에
 * 쓰는 곳이 새로 "possibly undefined"로 깨진다 — 이 트랙 범위 밖 파일).
 */
export type ScaledMonsterStats = SpawnedMonster;

const WINDOW = BALANCE.DIFFICULTY_BATTLE_WINDOW; // 최근 N 전투만 분석

/**
 * 최근 전투 로그에서 성과 지표를 추출합니다.
 * player.stats.recentBattles: Array<{ result: 'win'|'death'|'escape', hpRatio: number }>
 */
export const calcPerformanceScore = (player: Player) => {
    const battles = (player.stats?.recentBattles || []).slice(-WINDOW);
    if (battles.length < 5) return 0.5; // 데이터 부족 → 중립

    const wins    = battles.filter((b) => b.result === 'win').length;
    const deaths  = battles.filter((b) => b.result === 'death').length;
    const escapes = battles.filter((b) => b.result === 'escape').length;
    const total   = battles.length;

    const winRate    = wins / total;          // 0~1
    const deathRate  = deaths / total;        // 0~1
    const escapeRate = escapes / total;       // 0~1

    // 평균 남은 HP 비율 (승리한 전투만)
    const winBattles = battles.filter((b) => b.result === 'win');
    const avgHpRatio = winBattles.length > 0
        ? winBattles.reduce((sum, b) => sum + (b.hpRatio || 0.5), 0) / winBattles.length
        : 0.5;

    // 성과 점수 0~1: 높을수록 플레이어가 강함
    // - 승률 50%: +0.35
    // - 평균 남은 HP 70%: +0.25
    // - 탈출률 낮음: +0.20
    // - 사망률 낮음: +0.20
    const score =
        winRate     * 0.40 +
        avgHpRatio  * 0.30 +
        (1 - escapeRate) * 0.15 +
        (1 - deathRate)  * 0.15;

    return Math.min(1, Math.max(0, score));
};

// ─────────────────────────────────────────────────────────────────────────
// 2. 성과 점수 → 난이도 배율 변환
// ─────────────────────────────────────────────────────────────────────────
// PR #7 (2026-06): 비대칭 고무줄 재설계.
//   기존 고무줄은 "잘하면 적 +15% 강화"로 숙련/빌드 투자를 상쇄 → anti-로그라이크
//   (성공 처벌). 재설계 원칙: 상향(승리)은 난이도를 거의 안 올리는 대신 보상을 키워
//   숙련을 *보상*하고, 하향(고전)은 적을 약화하는 안전망을 그대로 유지(리텐션).
//   더 큰 도전을 원하면 프레스티지(PR #5)·심층 지역으로 가는 opt-in 축이 담당한다.
const DIFF_TABLE = [
    // { minScore, label, hpMult, atkMult, goldMult, expMult }
    // ── 상향: 적 강화 완만(성공 처벌 완화) + 보상 강화(숙련 보상) ──
    { minScore: 0.85, label: MSG.DIFFICULTY_LABEL_OVERWHELM,     hpMult: 1.05, atkMult: 1.05, goldMult: 1.4,  expMult: 1.4  },
    { minScore: 0.72, label: MSG.DIFFICULTY_LABEL_ADVANTAGE,     hpMult: 1.03, atkMult: 1.03, goldMult: 1.2,  expMult: 1.2  },
    { minScore: 0.55, label: MSG.DIFFICULTY_LABEL_BALANCED,      hpMult: 1.0,  atkMult: 1.0,  goldMult: 1.05, expMult: 1.05 },
    // ── 하향: 안전망 보존(struggling → 적 약화) — 변경 없음 ──
    { minScore: 0.40, label: MSG.DIFFICULTY_LABEL_CLOSE,         hpMult: 0.96, atkMult: 0.96, goldMult: 1.0,  expMult: 1.0  },
    { minScore: 0.25, label: MSG.DIFFICULTY_LABEL_DISADVANTAGE,  hpMult: 0.90, atkMult: 0.90, goldMult: 0.95, expMult: 0.95 },
    { minScore: 0.00, label: MSG.DIFFICULTY_LABEL_CRISIS,        hpMult: 0.85, atkMult: 0.85, goldMult: 0.9,  expMult: 0.9  },
];

/**
 * 성과 점수에서 난이도 배율 객체를 반환합니다.
 * @returns {{ label, hpMult, atkMult, goldMult, expMult }}
 */
export const getDifficultyMults = (score: number) => {
    return DIFF_TABLE.find((t) => score >= t.minScore) || DIFF_TABLE[DIFF_TABLE.length - 1];
};

/** `getDifficultyMults()` 반환 형태 — DIFF_TABLE 엔트리 1건. */
type DifficultyMults = ReturnType<typeof getDifficultyMults>;

const applyBeginnerGrace = (diff: DifficultyMults, player: Player) => {
    const level = Number(player?.level || 1);
    const recentBattleCount = (player?.stats?.recentBattles || []).length;
    if (level > BALANCE.BEGINNER_GRACE_MAX_LEVEL || recentBattleCount >= BALANCE.BEGINNER_GRACE_BATTLES) {
        return diff;
    }

    // B+ 재설계 (2026-06): 적을 약화하지 않는다. 첫 1~2전투에서 불운한 즉사만 막는
    //   초미세 상한(HP/ATK ×0.95)만 적용하고, EXP/골드 강제 보너스는 제거(중립).
    const cap = BALANCE.BEGINNER_GRACE_ENEMY_MULT;
    return {
        ...diff,
        label: MSG.DIFFICULTY_LABEL_BEGINNER_GRACE,
        hpMult: Math.min(diff.hpMult, cap),
        atkMult: Math.min(diff.atkMult, cap),
    };
};

// ─────────────────────────────────────────────────────────────────────────
// 3. 몬스터 스탯에 동적 난이도 배율 적용
// ─────────────────────────────────────────────────────────────────────────
/**
 * spawnEnemy()가 반환한 mStats에 동적 배율을 적용합니다.
 * @param {object} mStats   spawnEnemy()의 결과 몬스터 스탯
 * @param {object} player   현재 플레이어 상태
 * @param {function} addLog 로그 출력 함수
 * @returns {{ mStats: object, diffLabel: string }}
 */
export const applyDynamicDifficulty = (
    mStats: SpawnedMonster,
    player: Player,
    addLog: ((type: string, text: string) => void) | undefined,
) => {
    const score = calcPerformanceScore(player);
    const diff  = applyBeginnerGrace(getDifficultyMults(score), player);

    // 중립에 가까우면 로그 생략
    const LABEL_VISIBLE = [
        MSG.DIFFICULTY_LABEL_OVERWHELM,
        MSG.DIFFICULTY_LABEL_CRISIS,
        MSG.DIFFICULTY_LABEL_DISADVANTAGE,
    ];
    const GM_PREFIX_MAP: Record<string, string> = {
        [MSG.DIFFICULTY_LABEL_OVERWHELM]: MSG.DIFFICULTY_GM_OVERWHELM,
        [MSG.DIFFICULTY_LABEL_CRISIS]: MSG.DIFFICULTY_GM_CRISIS,
        [MSG.DIFFICULTY_LABEL_DISADVANTAGE]: MSG.DIFFICULTY_GM_DISADVANTAGE,
    };

    if (LABEL_VISIBLE.includes(diff.label)) {
        addLog?.('system', GM_PREFIX_MAP[diff.label]);
    }

    // cycle 343: _diffLabel / _diffScore / diffLabel return 3 dead 필드 정리.
    //   exploreActions:127는 { mStats }만 destructure하고 mStats._diff* 읽는 곳 0건.
    // Number() — Monster의 hp/maxHp/atk/exp/gold는 전부 optional이라 곱셈에는 number가
    //   필요하다. spawnEnemy가 항상 채워서 넘기므로 값 변화는 없다(순수 타입 캐스트).
    // scaled는 ScaledMonsterStats(위 정의) — 5개 수치 필드만 필수로 좁힌 Monster.
    const scaled: ScaledMonsterStats = {
        ...mStats,
        hp:    Math.floor(Number(mStats.hp)    * diff.hpMult),
        maxHp: Math.floor(Number(mStats.maxHp) * diff.hpMult),
        atk:   Math.floor(Number(mStats.atk)   * diff.atkMult),
        exp:   Math.floor(Number(mStats.exp)   * diff.expMult),
        gold:  Math.floor(Number(mStats.gold)  * diff.goldMult),
    };

    return { mStats: scaled };
};

// ─────────────────────────────────────────────────────────────────────────
// 4. 전투 결과 기록 (player.stats.recentBattles 업데이트용 페이로드 생성)
// ─────────────────────────────────────────────────────────────────────────
/**
 * 전투가 끝난 뒤 호출하여 recentBattles 배열에 추가할 항목을 반환합니다.
 * @param {'win'|'death'|'escape'} result
 * @param {number} hpRatio  전투 종료 시점 HP / maxHp (0~1)
 * @returns {object}
 */
// cycle 435: timestamp 출력 dead 필드 제거 — battle record consumers
//   (calcPerformanceScore / countLowHpWins / gameUtils recentWinRate)는 result /
//   hpRatio만 read. cycle 333-356 시리즈 회귀.
export const makeBattleRecord = (result: string, hpRatio: number) => ({
    result,
    hpRatio: Math.max(0, Math.min(1, hpRatio)),
});

/** `player.stats.recentBattles` 한 칸. */
export type BattleRecord = ReturnType<typeof makeBattleRecord>;

/**
 * player.stats.recentBattles를 새 전투 결과로 업데이트합니다.
 * 최대 50개까지 보관합니다.
 */
export const pushBattleRecord = (stats: Player['stats'], record: BattleRecord) => {
    const prev: BattleRecord[] = stats?.recentBattles || [];
    return {
        ...stats,
        recentBattles: [...prev, record].slice(-50),
    };
};

export const countLowHpWins = (stats: Player['stats'], threshold: number) => {
    const recentBattles: BattleRecord[] = stats?.recentBattles || [];
    if (recentBattles.length > 0) {
        return recentBattles.filter((battle) => (
            battle?.result === 'win'
            && Number.isFinite(battle?.hpRatio)
            && battle.hpRatio <= threshold
        )).length;
    }
    return stats?.lowHpWins || 0;
};

// ─────────────────────────────────────────────────────────────────────────
// 5. AI 이벤트 컨텍스트에 난이도 정보 주입
// ─────────────────────────────────────────────────────────────────────────
/**
 * AI_SERVICE.generateEvent() 호출 시 playerSnapshot에 난이도 정보를 추가합니다.
 */
// playerSnapshot은 AI_SERVICE.generateEvent 컨텍스트로 그대로 흘러가는 자유 형태
// 페이로드다(actionDeps.ts의 StoryLogData와 동일한 열린 계약) — 호출부(exploreActions.ts)도
// Record<string, unknown>으로 만들어 넘긴다(AiEventContext.playerSnapshot과 동일 타입).
export const enrichSnapshotWithDifficulty = (playerSnapshot: Record<string, unknown>, player: Player) => {
    const score = calcPerformanceScore(player);
    const diff  = getDifficultyMults(score);
    return {
        ...playerSnapshot,
        performanceScore: Math.round(score * 100),
        difficultyLabel:  diff.label,
        recentWinRate:    (() => {
            const b = (player.stats?.recentBattles || []).slice(-WINDOW);
            return b.length > 0 ? Math.round((b.filter((r) => r.result === 'win').length / b.length) * 100) : null;
        })(),
    };
};
