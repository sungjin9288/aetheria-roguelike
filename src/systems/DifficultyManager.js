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
const WINDOW = 20; // 최근 20 전투만 분석

/**
 * 최근 전투 로그에서 성과 지표를 추출합니다.
 * player.stats.recentBattles: Array<{ result: 'win'|'death'|'escape', hpRatio: number }>
 */
export const calcPerformanceScore = (player) => {
    const battles = (player.stats?.recentBattles || []).slice(-WINDOW);
    if (battles.length < 5) return 0.5; // 데이터 부족 → 중립

    const wins    = battles.filter(b => b.result === 'win').length;
    const deaths  = battles.filter(b => b.result === 'death').length;
    const escapes = battles.filter(b => b.result === 'escape').length;
    const total   = battles.length;

    const winRate    = wins / total;          // 0~1
    const deathRate  = deaths / total;        // 0~1
    const escapeRate = escapes / total;       // 0~1

    // 평균 남은 HP 비율 (승리한 전투만)
    const winBattles = battles.filter(b => b.result === 'win');
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
const DIFF_TABLE = [
    // { minScore, label, hpMult, atkMult, goldMult, expMult }
    { minScore: 0.85, label: '압도',   hpMult: 1.15, atkMult: 1.15, goldMult: 1.3, expMult: 1.3 },
    { minScore: 0.72, label: '우세',   hpMult: 1.08, atkMult: 1.08, goldMult: 1.15, expMult: 1.15 },
    { minScore: 0.55, label: '균형',   hpMult: 1.02, atkMult: 1.02, goldMult: 1.05, expMult: 1.05 },
    { minScore: 0.40, label: '박빙',   hpMult: 0.96, atkMult: 0.96, goldMult: 1.0,  expMult: 1.0  },
    { minScore: 0.25, label: '열세',   hpMult: 0.90, atkMult: 0.90, goldMult: 0.95, expMult: 0.95 },
    { minScore: 0.00, label: '위기',   hpMult: 0.85, atkMult: 0.85, goldMult: 0.9,  expMult: 0.9  },
];

/**
 * 성과 점수에서 난이도 배율 객체를 반환합니다.
 * @returns {{ label, hpMult, atkMult, goldMult, expMult }}
 */
export const getDifficultyMults = (score) => {
    return DIFF_TABLE.find(t => score >= t.minScore) || DIFF_TABLE[DIFF_TABLE.length - 1];
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
export const applyDynamicDifficulty = (mStats, player, addLog) => {
    const score = calcPerformanceScore(player);
    const diff  = getDifficultyMults(score);

    // 중립에 가까우면 로그 생략
    const LABEL_VISIBLE = ['압도', '위기', '열세'];
    const GM_PREFIX_MAP = {
        '압도': '⚔️ [GM] 도전적인 편이 더 재미있겠죠? 몬스터가 강해집니다.',
        '위기': '🛡️ [GM] 잠시 숨을 고를 시간입니다. 몬스터가 약해집니다.',
        '열세': '🛡️ [GM] 어려운 상황이군요. 몬스터 강도를 낮춥니다.',
    };

    if (LABEL_VISIBLE.includes(diff.label)) {
        addLog?.('system', GM_PREFIX_MAP[diff.label]);
    }

    const scaled = {
        ...mStats,
        hp:    Math.floor(mStats.hp    * diff.hpMult),
        maxHp: Math.floor(mStats.maxHp * diff.hpMult),
        atk:   Math.floor(mStats.atk   * diff.atkMult),
        exp:   Math.floor(mStats.exp   * diff.expMult),
        gold:  Math.floor(mStats.gold  * diff.goldMult),
        _diffLabel: diff.label,
        _diffScore: Math.round(score * 100),
    };

    return { mStats: scaled, diffLabel: diff.label };
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
export const makeBattleRecord = (result, hpRatio) => ({
    result,
    hpRatio: Math.max(0, Math.min(1, hpRatio)),
    ts: Date.now(),
});

/**
 * player.stats.recentBattles를 새 전투 결과로 업데이트합니다.
 * 최대 50개까지 보관합니다.
 */
export const pushBattleRecord = (stats, record) => {
    const prev = stats?.recentBattles || [];
    return {
        ...stats,
        recentBattles: [...prev, record].slice(-50),
    };
};

export const countLowHpWins = (stats, threshold = 0.2) => {
    const recentBattles = stats?.recentBattles || [];
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
export const enrichSnapshotWithDifficulty = (playerSnapshot, player) => {
    const score = calcPerformanceScore(player);
    const diff  = getDifficultyMults(score);
    return {
        ...playerSnapshot,
        performanceScore: Math.round(score * 100),
        difficultyLabel:  diff.label,
        recentWinRate:    (() => {
            const b = (player.stats?.recentBattles || []).slice(-WINDOW);
            return b.length > 0 ? Math.round((b.filter(r => r.result === 'win').length / b.length) * 100) : null;
        })(),
    };
};
