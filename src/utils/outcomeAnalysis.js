const clampRatio = (current, max) => {
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(1, current / max));
};

export const getPostCombatAnalysis = (result = {}) => {
    const hpRatio = clampRatio(result.playerHp, result.playerMaxHp);
    const mpRatio = clampRatio(result.playerMp, result.playerMaxMp);
    const enemyTier = result.enemyTier || 'NORMAL';
    const enemyName = result.enemy || '적';
    const primaryBuild = result.primaryBuild || '균형형 런';

    let grade = '완승';
    if (hpRatio <= 0.2) grade = '붕괴 직전';
    else if (hpRatio <= 0.4) grade = '아슬아슬 승리';
    else if (hpRatio <= 0.7) grade = '안정 승리';

    const notes = [];
    if (enemyTier === 'BOSS') notes.push(`${enemyName} 보스전을 돌파했습니다.`);
    else if (enemyTier === 'ELITE') notes.push(`${enemyName} 엘리트 교전을 정리했습니다.`);
    else notes.push(`${enemyName} 전투를 정리했습니다.`);

    notes.push(`현재 주력 빌드는 ${primaryBuild}입니다.`);

    if (result.difficultyLabel) {
        notes.push(`현재 런 체감 난이도는 ${result.difficultyLabel}입니다.`);
    }

    if (result.leveledUp) notes.push('레벨업으로 다음 구간 진입 여유가 생겼습니다.');
    if (result.enemyWeakness) notes.push(`이 적은 ${result.enemyWeakness} 약점을 가졌습니다.`);
    if (result.enemyResistance) notes.push(`${result.enemyResistance} 내성이 있어 속성 선택을 조정하는 편이 좋습니다.`);

    const actions = [];
    if (hpRatio <= 0.35) actions.push('휴식 또는 회복 아이템을 우선 사용하세요.');
    else if (enemyTier === 'BOSS' || enemyTier === 'ELITE') actions.push('다음 전투 전 장비와 퀵슬롯을 한 번 정리하세요.');
    else actions.push('지금 페이스면 다음 지역으로 밀어도 됩니다.');

    if (mpRatio <= 0.3) actions.push('MP 회복 수단을 확보한 뒤 스킬 교전에 들어가세요.');
    if (result.invFull) actions.push('인벤토리가 가득 찼습니다. 상점에서 정리 후 이동하는 편이 안전합니다.');
    if (result.items?.length > 0) actions.push('새 전리품의 장비 비교를 확인해 현재 빌드에 맞는지 보세요.');

    let rewardMood = '안정 정리';
    if (result.leveledUp && (result.items?.length || 0) > 0) rewardMood = '성장 폭발';
    else if (enemyTier === 'BOSS') rewardMood = '보스 돌파';
    else if (enemyTier === 'ELITE') rewardMood = '강적 제압';
    else if ((result.items?.length || 0) >= 2) rewardMood = '풍성한 전리품';
    else if (hpRatio <= 0.35) rewardMood = '위험한 승리';

    const rewardHighlights = [];
    if (result.leveledUp) rewardHighlights.push('LEVEL UP');
    if (enemyTier === 'BOSS') rewardHighlights.push('BOSS');
    else if (enemyTier === 'ELITE') rewardHighlights.push('ELITE');
    if ((result.items?.length || 0) >= 2) rewardHighlights.push('LOOT HOT');
    if ((result.gold || 0) >= 100) rewardHighlights.push(`GOLD +${result.gold}`);
    if ((result.exp || 0) >= 100) rewardHighlights.push(`EXP +${result.exp}`);

    return {
        grade,
        hpRatio,
        mpRatio,
        rewardMood,
        rewardHighlights: rewardHighlights.slice(0, 3),
        notes: notes.slice(0, 4),
        actions: actions.slice(0, 3),
    };
};

export const getRunSummaryAnalysis = (summary = {}) => {
    const headline = summary.bossKills > 0
        ? '보스 구간까지 닿은 런'
        : summary.level >= 20
            ? '중후반까지 뻗은 런'
            : summary.level >= 10
                ? '성장 축은 잡힌 런'
                : '초반 안정화가 필요한 런';

    const notes = [];
    if (summary.primaryBuild) notes.push(`주력 빌드: ${summary.primaryBuild}`);
    if (summary.difficultyLabel) notes.push(`런 난이도 판정: ${summary.difficultyLabel}`);
    if (Number.isFinite(summary.recentWinRate)) notes.push(`최근 승률: ${summary.recentWinRate}%`);

    const focus = [];
    if ((summary.relicsFound || 0) <= 1) focus.push('유물 획득 수가 적었습니다. 이벤트/탐험 축을 더 강하게 타는 편이 좋습니다.');
    if ((summary.bossKills || 0) === 0 && (summary.level || 0) >= 12) focus.push('보스 진입 전 방어·회복 루틴을 더 챙기면 한 단계 더 올라갈 수 있습니다.');
    if ((summary.kills || 0) < 30) focus.push('초반 교전 수가 적었습니다. 1~2지역을 더 안정적으로 순환해 성장량을 확보하세요.');
    if ((summary.totalGold || 0) > 0 && (summary.totalGold || 0) < 1500) focus.push('골드 수급이 낮았습니다. 상점 구매보다 장비 교체 타이밍을 아껴보세요.');
    if (focus.length === 0) focus.push('이번 런은 기반이 좋았습니다. 같은 빌드 축을 더 강하게 밀어도 됩니다.');

    return {
        headline,
        notes: notes.slice(0, 3),
        focus: focus.slice(0, 3),
    };
};
