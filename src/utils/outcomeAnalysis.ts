const clampRatio = (current: any, max: any) => {
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(1, current / max));
};

// cycle 557: result default {} 제거 — 1 production (PostCombatCard:59) +
//   N test (outcome-analysis, cycle-336) 모두 명시 전달이라 default 도달 불가.
//   outcomeAnalysis.ts 같은 모듈 batch (cycle 502-556 default 청소 51번째).
export const getPostCombatAnalysis = (result: any) => {
    const hpRatio = typeof result.hpLow === 'boolean'
        ? result.hpLow ? 0.2 : 1
        : clampRatio(result.playerHp, result.playerMaxHp);
    const mpRatio = typeof result.mpLow === 'boolean'
        ? result.mpLow ? 0.2 : 1
        : clampRatio(result.playerMp, result.playerMaxMp);
    const enemyTier = result.enemyTier || 'NORMAL';
    const enemyName = result.enemy || '적';
    const primaryBuild = result.primaryBuild || '균형형 런';

    let grade = '완승';
    if (hpRatio <= 0.2) grade = '붕괴 직전';
    else if (hpRatio <= 0.4) grade = '아슬아슬 승리';
    else if (hpRatio <= 0.7) grade = '안정 승리';

    const notes: any[] = [];
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

    const actions: any[] = [];
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

    const rewardHighlights: any[] = [];
    if (result.leveledUp) rewardHighlights.push('LEVEL UP');
    if (enemyTier === 'BOSS') rewardHighlights.push('BOSS');
    else if (enemyTier === 'ELITE') rewardHighlights.push('ELITE');
    if ((result.items?.length || 0) >= 2) rewardHighlights.push('LOOT HOT');
    if ((result.gold || 0) >= 100) rewardHighlights.push(`GOLD +${result.gold}`);
    if ((result.exp || 0) >= 100) rewardHighlights.push(`EXP +${result.exp}`);

    // cycle 336: hpRatio / mpRatio 출력 필드 제거 — analysis.hpRatio/mpRatio 외부 read 0건.
    //   내부에서만 grade/notes/actions 분기 계산용으로 사용. 출력은 dead.
    return {
        grade,
        rewardMood,
        rewardHighlights: rewardHighlights.slice(0, 3),
        notes: notes.slice(0, 4),
        actions: actions.slice(0, 3),
    };
};

export const getPostCombatDecisionStrip = (result: any, context: any = {}) => {
    const hpLow = typeof result.hpLow === 'boolean'
        ? result.hpLow
        : clampRatio(result.playerHp, result.playerMaxHp) <= 0.35;
    const mpLow = typeof result.mpLow === 'boolean'
        ? result.mpLow
        : clampRatio(result.playerMp, result.playerMaxMp) <= 0.3;
    const invFull = typeof result.invFull === 'boolean' ? result.invFull : false;
    const enemyTier = result.enemyTier || 'NORMAL';
    const droppedItems = Array.isArray(result.items)
        ? result.items
        : Array.isArray(result.loot)
            ? result.loot
            : [];
    const nonSignatureLootCount = Number.isFinite(context.nonSignatureLootCount)
        ? context.nonSignatureLootCount
        : droppedItems.length;
    const signatureLootCount = Number.isFinite(context.signatureLootCount)
        ? context.signatureLootCount
        : 0;
    const hasUpgradeHint = Boolean(result.upgradeHint);
    const hasTraitHint = Boolean(result.traitHint);

    let state = '진행 가능';
    if (hpLow) state = 'HP 회복';
    else if (mpLow) state = 'MP 보충';
    else if (result.leveledUp) state = '레벨업';
    else if (enemyTier === 'BOSS' || enemyTier === 'ELITE') state = '정비 권장';

    let loot = '획득 없음';
    if (signatureLootCount > 0) loot = `전설 ${signatureLootCount}개`;
    else if (hasUpgradeHint) loot = '장비 후보';
    else if (hasTraitHint) loot = '성향 공명';
    else if (nonSignatureLootCount > 0) loot = `전리품 ${nonSignatureLootCount}개`;
    else if ((result.gold || 0) >= 100) loot = `Gold +${result.gold}`;
    else if ((result.exp || 0) >= 100) loot = `EXP +${result.exp}`;

    let next = '다음 지역';
    if (hpLow) next = '휴식';
    else if (invFull) next = '인벤 정리';
    else if (signatureLootCount > 0 || nonSignatureLootCount > 0 || hasUpgradeHint || hasTraitHint) next = '장비 확인';
    else if (enemyTier === 'BOSS' || enemyTier === 'ELITE') next = '퀵슬롯 점검';

    let tone = 'steady';
    if (hpLow || invFull) tone = 'pressure';
    else if (signatureLootCount > 0 || hasUpgradeHint || hasTraitHint || result.leveledUp) tone = 'reward';
    else if (enemyTier === 'BOSS' || enemyTier === 'ELITE') tone = 'advantage';

    return {
        tone,
        cells: [
            { label: 'STATE', value: state },
            { label: 'LOOT', value: loot },
            { label: 'NEXT', value: next },
        ],
    };
};

// cycle 557: summary default {} 제거 — 1 production (RunSummaryCard:25) +
//   N test (cycle-87/97) 모두 summary 명시 전달이라 default 도달 불가.
export const getRunSummaryAnalysis = (summary: any) => {
    const headline = summary.bossKills > 0
        ? '보스 구간까지 닿은 런'
        : summary.level >= 20
            ? '중후반까지 뻗은 런'
            : summary.level >= 10
                ? '성장 축은 잡힌 런'
                : '초반 안정화가 필요한 런';

    const notes: any[] = [];
    if (summary.primaryBuild) notes.push(`주력 빌드: ${summary.primaryBuild}`);
    if (summary.difficultyLabel) notes.push(`런 난이도 판정: ${summary.difficultyLabel}`);
    if (Number.isFinite(summary.recentWinRate)) notes.push(`최근 승률: ${summary.recentWinRate}%`);

    const focus: any[] = [];
    if ((summary.relicsFound || 0) <= 1) focus.push('유물 획득 수가 적었습니다. 이벤트/탐험 축을 더 강하게 타는 편이 좋습니다.');
    if ((summary.bossKills || 0) === 0 && (summary.level || 0) >= 12) focus.push('보스 진입 전 방어·회복 루틴을 더 챙기면 한 단계 더 올라갈 수 있습니다.');
    if ((summary.kills || 0) < 30) focus.push('초반 교전 수가 적었습니다. 1~2지역을 더 안정적으로 순환해 성장량을 확보하세요.');
    if ((summary.totalGold || 0) > 0 && (summary.totalGold || 0) < 1500) focus.push('골드 수급이 낮았습니다. 상점 구매보다 장비 교체 타이밍을 아껴보세요.');
    // cycle 87: cycle 78/84의 escapes/discoveries 시그널을 reflection focus로 연결.
    // 도주가 많은데 보스 진입이 적으면 빌드 강화 권장, 탐험이 좁으면 맵 확장 권장,
    // 탐험이 넓으면 칭찬 라인. silence-over-noise — 조건 미충족 시 추가 안 됨.
    if ((summary.escapes || 0) >= 10 && (summary.bossKills || 0) <= 1) {
        focus.push('도주가 많았고 보스 진입이 적었습니다. 빌드 강화 후 보스 도전을 권장합니다.');
    }
    if ((summary.discoveries || 0) <= 4 && (summary.level || 0) >= 12) {
        focus.push('맵 발견이 적었습니다. 새 지역을 더 탐색해 유물/이벤트 풀을 넓히세요.');
    }
    if ((summary.discoveries || 0) >= 15) {
        focus.push('탐험 폭이 넓었습니다. 같은 호기심으로 다음 런도 시작하세요.');
    }
    // cycle 97: maxKillStreak (cycle 95 신규 카운터) 기반 reflection.
    // KILL_STREAK_TIERS [3,5,10,20] 중 10 이상이면 공격 운영 칭찬 — tier 3 진입.
    // 3 미만이고 레벨 10+이면 streak 활용 권장 — 공격 호흡 미정착 시그널.
    if ((summary.maxKillStreak || 0) >= 10) {
        focus.push('공격형 운영 — 연속 처치를 유지해 streak 보너스를 끌어내고 있습니다.');
    }
    if ((summary.maxKillStreak || 0) < 3 && (summary.level || 0) >= 10) {
        focus.push('연속 처치가 끊기는 흐름. 빌드 강화 + 안전한 적부터 정리해 streak를 쌓아보세요.');
    }
    if (focus.length === 0) focus.push('이번 런은 기반이 좋았습니다. 같은 빌드 축을 더 강하게 밀어도 됩니다.');

    return {
        headline,
        notes: notes.slice(0, 3),
        focus: focus.slice(0, 3),
    };
};

export const getRunSummaryReflectionStrip = (summary: any, analysis: any) => {
    const level = Number.isFinite(summary.level) ? summary.level : 0;
    const kills = Number.isFinite(summary.kills) ? summary.kills : 0;
    const bossKills = Number.isFinite(summary.bossKills) ? summary.bossKills : 0;
    const relicsFound = Number.isFinite(summary.relicsFound) ? summary.relicsFound : 0;
    const totalGold = Number.isFinite(summary.totalGold) ? summary.totalGold : 0;
    const escapes = Number.isFinite(summary.escapes) ? summary.escapes : 0;
    const discoveries = Number.isFinite(summary.discoveries) ? summary.discoveries : 0;
    const maxKillStreak = Number.isFinite(summary.maxKillStreak) ? summary.maxKillStreak : 0;
    const focusText = Array.isArray(analysis?.focus) ? analysis.focus.join(' ') : '';

    const highEscapes = escapes >= 10 && bossKills <= 1;
    const lowRelics = relicsFound <= 1;
    const lowBossProgress = bossKills === 0 && level >= 12;
    const lowKills = kills < 30;
    const lowGold = totalGold > 0 && totalGold < 1500;
    const lowDiscovery = discoveries <= 4 && level >= 12;
    const wideDiscovery = discoveries >= 15;
    const strongStreak = maxKillStreak >= 10;
    const lowStreak = maxKillStreak < 3 && level >= 10;

    let tone = 'steady';
    let cause = '기반 안정';
    let lesson = analysis?.headline || '런 패턴 확인';
    let next = '같은 빌드 강화';

    if (highEscapes || /도주.*보스/.test(focusText)) {
        tone = 'pressure';
        cause = '후퇴 누적';
        lesson = '교전 전 정비 부족';
        next = '회복·장비 점검';
    } else if (lowRelics || /유물/.test(focusText)) {
        tone = 'pressure';
        cause = '유물 부족';
        lesson = '이벤트 루트 필요';
        next = 'Map/Quest 확장';
    } else if (lowBossProgress || /보스 진입 전/.test(focusText)) {
        tone = 'pressure';
        cause = '보스 전 정비';
        lesson = '방어·회복 루틴';
        next = '퀵슬롯 보강';
    } else if (lowKills || /교전 수/.test(focusText)) {
        tone = 'pressure';
        cause = '성장량 부족';
        lesson = '초반 순환 짧음';
        next = '1~2지역 반복';
    } else if (lowGold || /골드 수급/.test(focusText)) {
        tone = 'growth';
        cause = '골드 부족';
        lesson = '구매 타이밍 조절';
        next = '상점 전리품 비교';
    } else if (lowDiscovery || /맵 발견|탐색/.test(focusText)) {
        tone = 'growth';
        cause = '탐험 폭 부족';
        lesson = '이벤트 풀 미확장';
        next = '새 지역 개방';
    } else if (lowStreak || /연속 처치가 끊/.test(focusText)) {
        tone = 'growth';
        cause = '연속 처치 단절';
        lesson = '공격 호흡 재정렬';
        next = '약한 적부터 정리';
    } else if ((bossKills >= 3 && relicsFound >= 4) || strongStreak || wideDiscovery) {
        tone = 'breakthrough';
        cause = bossKills >= 3 ? '보스권 도달' : strongStreak ? '공격 흐름' : '탐험 폭 강점';
        lesson = strongStreak ? 'streak 운영 유효' : wideDiscovery ? '루트 확장 유효' : '빌드 축 검증';
        next = bossKills >= 3 ? '막힌 속성 보강' : '동일 강점 유지';
    } else if (bossKills > 0 || level >= 20) {
        tone = 'growth';
        cause = bossKills > 0 ? '보스 진입 성공' : '중반 진입';
        lesson = '기반은 충분';
        next = '약점 구간 보강';
    }

    return {
        tone,
        cells: [
            { label: 'CAUSE', value: cause },
            { label: 'LESSON', value: lesson },
            { label: 'NEXT', value: next },
        ],
    };
};
