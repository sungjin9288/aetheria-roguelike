import { BALANCE } from '../data/constants.js';
import { QUESTS } from '../data/quests.js';
import { getDiscoveryOdds, getMapPacingProfile } from './explorationPacing.js';

const toArray = (value) => (Array.isArray(value) ? value : []);

const getActiveQuestEntries = (player) => (
    toArray(player?.quests)
        .map((questState) => {
            const quest = questState?.isBounty
                ? questState
                : QUESTS.find((entry) => entry.id === questState?.id);
            if (!quest) return null;

            const progress = questState?.progress || 0;
            return {
                id: questState.id,
                quest,
                progress,
                isBounty: Boolean(questState?.isBounty),
                isComplete: progress >= (quest.goal || 0),
            };
        })
        .filter(Boolean)
);

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value * 100)));
const getMapLevel = (map, playerLevel = 1) => (
    map?.level === 'infinite'
        ? Math.max((playerLevel || 1) + 8, 50)
        : (map?.minLv ?? map?.level ?? 1)
);
const getVisitedMaps = (player) => new Set([...(player?.stats?.visitedMaps || []), player?.loc].filter(Boolean));

const getQuestProgressLabel = (entry) => {
    if (!entry?.quest) return '';
    if (entry.quest.target === 'Level') return `Lv.${entry.progress}/${entry.quest.goal}`;
    return `${entry.progress}/${entry.quest.goal}`;
};

export const getQuestTracker = (player) => {
    const entries = getActiveQuestEntries(player);
    if (!entries.length) return null;

    const claimable = entries.find((entry) => entry.isComplete);
    if (claimable) {
        return {
            kind: 'claimable',
            title: claimable.quest.title,
            detail: '보상을 수령할 수 있습니다.',
            progressLabel: '보상 대기',
            questId: claimable.id,
        };
    }

    const ranked = [...entries].sort((left, right) => {
        const leftScore = (left.isBounty ? 20 : 0) + ((left.progress || 0) / Math.max(1, left.quest.goal));
        const rightScore = (right.isBounty ? 20 : 0) + ((right.progress || 0) / Math.max(1, right.quest.goal));
        return rightScore - leftScore;
    });

    const focus = ranked[0];
    return {
        kind: focus.isBounty ? 'bounty' : 'active',
        title: focus.quest.title,
        detail: focus.quest.desc,
        progressLabel: getQuestProgressLabel(focus),
        questId: focus.id,
    };
};

export const getExplorationForecast = (player, mapData) => {
    if (!mapData) {
        return {
            mood: '기록 동기화 중',
            description: '지역 정보를 불러오는 중입니다.',
            chips: [],
        };
    }

    if (mapData.type === 'safe') {
        return {
            mood: '안전 지대',
            description: '회복, 보급, 전직, 퀘스트 정리에 적합한 구간입니다.',
            chips: [
                { label: 'REST', value: 'SAFE' },
                { label: 'BOARD', value: 'OPEN' },
            ],
        };
    }

    const odds = getDiscoveryOdds(player, mapData);
    const pacingProfile = odds.pacingProfile || getMapPacingProfile(mapData);
    const eventPct = clampPercent(odds.narrativeEventChance);
    const relicPct = clampPercent(odds.relicChance);
    const quietPct = clampPercent(odds.quietChance);

    let mood = '교전 밀도 보통';
    let description = '전투와 발견이 무난하게 섞이는 구간입니다.';

    if (mapData.boss) {
        mood = eventPct >= 8 ? '보스 전조' : '보스 권역';
        description = '강한 교전이 예상됩니다. 회복과 퀵슬롯 정비를 우선하세요.';
    } else if (eventPct >= 10 || relicPct >= 12) {
        mood = '발견 상승';
        description = '이상 징후와 유물 기류가 올라온 구간입니다.';
    } else if (quietPct >= 24) {
        mood = '정적 구간';
        description = '조용한 탐색이 길어지고 있습니다. 다음 발견 확률이 서서히 오릅니다.';
    } else if (pacingProfile.id === 'volatile') {
        mood = '변칙 지대';
        description = '이벤트와 이변이 잦은 구간입니다. 짧은 정비 뒤 탐험을 이어가는 편이 좋습니다.';
    } else if (pacingProfile.id === 'hostile' || mapData.level >= 20) {
        mood = '고위험 교전';
        description = '한 번의 실수가 치명적일 수 있는 상위 전장입니다.';
    }

    return {
        mood,
        description,
        chips: [
            { label: 'TEMPO', value: pacingProfile.label },
            { label: 'EVENT', value: `${eventPct}%` },
            { label: 'RELIC', value: `${relicPct}%` },
            { label: 'QUIET', value: `${quietPct}%` },
        ],
    };
};

export const getMoveRecommendations = (player, stats, currentMap, maps = {}) => {
    if (!currentMap?.exits?.length) return [];

    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const mpRatio = (player?.mp || 0) / Math.max(1, stats?.maxMp || player?.maxMp || 1);
    const inventoryCount = player?.inv?.length || 0;
    const playerLevel = player?.level || 1;
    const visitedMaps = getVisitedMaps(player);

    return currentMap.exits
        .map((exitName) => {
            const targetMap = maps?.[exitName];
            if (!targetMap) return null;

            const targetLevel = getMapLevel(targetMap, playerLevel);
            const levelGap = targetLevel - playerLevel;
            const isSafeTarget = targetMap.type === 'safe';
            const isVisited = visitedMaps.has(exitName);
            const forecast = getExplorationForecast(player, targetMap);
            const chips = [
                { label: 'LV', value: targetMap.level === 'infinite' ? 'Abyss' : `${targetLevel}` },
                { label: 'STATE', value: isSafeTarget ? 'SAFE' : forecast.mood },
            ];
            let score = 0;
            let badge = '전진';
            let reason = '현재 전력으로 무난하게 전개할 수 있는 경로입니다.';

            if (isSafeTarget) {
                badge = '정비';
                score += 10;
                if (hpRatio <= 0.5) {
                    score += 32;
                    reason = '체력 회복과 보급을 먼저 하기 좋은 안전 경로입니다.';
                } else if (inventoryCount >= BALANCE.INV_MAX_SIZE - 2) {
                    score += 24;
                    reason = '상점과 정리를 먼저 하기 좋은 여유 구간입니다.';
                } else if (player?.job === '모험가' && playerLevel >= 5) {
                    score += 22;
                    reason = '전직과 재정비를 함께 마무리하기 좋은 경로입니다.';
                } else {
                    reason = '휴식, 상점, 게시판을 바로 열 수 있는 안전 경로입니다.';
                }
            } else {
                if (targetMap.boss) {
                    badge = '보스';
                    if (hpRatio >= 0.85 && mpRatio >= 0.65) {
                        score += 28;
                        reason = '보스 브리핑을 활용해 밀어붙이기 좋은 타이밍입니다.';
                    } else {
                        score -= 16;
                        badge = '경계';
                        reason = '보스 권역입니다. 회복과 퀵슬롯 정비 후 진입이 안전합니다.';
                    }
                } else if (!isVisited) {
                    badge = '개척';
                    score += 14;
                    reason = '아직 밟지 않은 지역입니다. 새 전리품과 발견 흐름을 기대할 수 있습니다.';
                } else if (levelGap >= 4) {
                    badge = '도전';
                    score -= 8;
                    reason = '현재 레벨보다 높은 전장입니다. 강한 교전이 예상됩니다.';
                } else if (levelGap <= -5) {
                    badge = '파밍';
                    score += 6;
                    reason = '안정적으로 정리 가능한 구간입니다. 회복 부담이 낮습니다.';
                }

                if (levelGap >= -2 && levelGap <= 2) {
                    score += 18;
                } else if (levelGap > 2) {
                    score -= Math.min(14, levelGap * 3);
                } else {
                    score += 8;
                }

                if (!isVisited) score += 6;
                if (forecast.mood === '발견 상승') score += 5;
                if (hpRatio <= 0.35) {
                    score -= 18;
                    badge = '경계';
                    reason = '현재 HP가 낮아 더 깊이 들어가기엔 위험한 경로입니다.';
                }
            }

            return {
                name: exitName,
                score,
                badge,
                reason,
                isSafeTarget,
                isVisited,
                isBoss: Boolean(targetMap.boss),
                levelLabel: targetMap.level === 'infinite' ? 'Abyss' : `Lv.${targetLevel}`,
                chips,
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .map((entry, index) => ({
            ...entry,
            isRecommended: index === 0,
        }));
};

export const getAdventureGuidance = (player, stats, mapData, runtimeState = 'idle') => {
    const safe = mapData?.type === 'safe';
    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const mpRatio = (player?.mp || 0) / Math.max(1, stats?.maxMp || player?.maxMp || 1);
    const inventoryCount = player?.inv?.length || 0;
    const questTracker = getQuestTracker(player);

    if (runtimeState && runtimeState !== 'idle') {
        return {
            title: '현재 상황 진행 중',
            detail: runtimeState === 'combat' ? '전투 판단을 우선하세요.' : '현재 패널을 먼저 마무리하면 다음 행동이 열립니다.',
            emphasis: '진행 우선',
            primaryAction: null,
            secondaryAction: null,
        };
    }

    if (questTracker?.kind === 'claimable') {
        return {
            title: '보상 회수 가능',
            detail: `${questTracker.title} 완료 보상을 지금 회수할 수 있습니다.`,
            emphasis: '즉시 이득',
            primaryAction: { kind: 'claim_quest', label: '보상 받기', questId: questTracker.questId },
            secondaryAction: { kind: 'open_quest', label: '퀘스트 보기' },
        };
    }

    if (safe && player?.job === '모험가' && (player?.level || 1) >= 5) {
        return {
            title: '전직 준비 완료',
            detail: '모험가 단계를 마쳤습니다. 지금 전직하면 런의 방향이 더 선명해집니다.',
            emphasis: '성장 분기',
            primaryAction: { kind: 'open_class', label: '전직 보기' },
            secondaryAction: questTracker ? { kind: 'open_quest', label: '임무 확인' } : null,
        };
    }

    if (safe && hpRatio <= 0.65 && (player?.gold || 0) >= BALANCE.REST_COST) {
        return {
            title: '정비 추천',
            detail: '체력이 충분히 회복되지 않았습니다. 다음 출발 전에 휴식으로 안정성을 확보하세요.',
            emphasis: '안정 우선',
            primaryAction: { kind: 'rest', label: '휴식' },
            secondaryAction: mpRatio <= 0.45 ? { kind: 'rest', label: 'MP도 회복' } : null,
        };
    }

    if (safe && inventoryCount >= BALANCE.INV_MAX_SIZE - 2) {
        return {
            title: '인벤토리 정리 필요',
            detail: `인벤토리가 ${inventoryCount}/${BALANCE.INV_MAX_SIZE} 입니다. 다음 드롭 전에 장비와 소모품을 정리하세요.`,
            emphasis: '정리 권장',
            primaryAction: { kind: 'open_inventory', label: '가방 열기' },
            secondaryAction: { kind: 'open_shop', label: '상점 열기' },
        };
    }

    if (safe && !questTracker) {
        return {
            title: '새 임무 수령 가능',
            detail: '현재 진행 중인 임무가 없습니다. 마을 게시판에서 목표를 받아 성장 축을 잡으세요.',
            emphasis: '목표 설정',
            primaryAction: { kind: 'open_quest_board', label: '게시판 열기' },
            secondaryAction: { kind: 'open_move', label: '이동 준비' },
        };
    }

    if (!safe && hpRatio <= 0.35) {
        return {
            title: '후퇴 또는 회복 권장',
            detail: '현재 HP가 낮습니다. 더 깊게 들어가기보다 이동과 회복을 먼저 고려하세요.',
            emphasis: '위험',
            primaryAction: { kind: 'open_move', label: '이동 경로' },
            secondaryAction: { kind: 'open_inventory', label: '회복 확인' },
        };
    }

    if (!safe && questTracker) {
        return {
            title: '현재 목표 진행 중',
            detail: `${questTracker.title} · ${questTracker.progressLabel}`,
            emphasis: questTracker.kind === 'bounty' ? '현상수배' : '임무 진행',
            primaryAction: { kind: 'explore', label: '탐험 계속' },
            secondaryAction: { kind: 'open_quest', label: '목표 보기' },
        };
    }

    return {
        title: safe ? '출발 준비 완료' : '탐험 이어가기',
        detail: safe
            ? '정비가 끝났다면 다음 지역으로 이동해 흐름을 이어가세요.'
            : '지금 흐름이면 탐험을 한 번 더 밀어도 됩니다.',
        emphasis: safe ? '다음 지역' : '전진',
        primaryAction: safe ? { kind: 'open_move', label: '이동' } : { kind: 'explore', label: '탐험' },
        secondaryAction: safe && questTracker ? { kind: 'open_quest', label: '임무 확인' } : null,
    };
};
