import { BALANCE, CONSTANTS } from '../data/constants.js';
import { getInventoryCapacity } from './inventoryCapacity';
import { getBagCraftReadiness } from './bagCrafting';
import { MSG } from '../data/messages.js';
import { getVisibleRouteName } from './challengeRules.js';
import { FIRST_VISIT_REWARDS } from '../data/firstVisitRewards.js';
import type { FullStats, GameMap, Player, StatusId } from "../types/index.js";
import { MAPS } from '../data/maps.js';
import { getDiscoveryOdds } from './explorationPacing.js';
import { canBossAppearInMap } from './bossPresence.js';
import { getMapRequiredLevel, getNextMapTowardTarget } from './mapTopology.js';
import { getRestCost } from './expeditionReturnFlow.js';
import {
    getExpeditionQuestTargetMaps,
    getFocusedExpeditionQuestEntries,
    type ExpeditionQuestDefinition,
    type ExpeditionQuestEntry,
} from './expeditionMissionFocus.js';

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100)));
const ROUTE_PLAN_LOW_HP_RATIO = 0.35;
const ROUTE_PLAN_BOSS_HP_RATIO = 0.75;
const ROUTE_PLAN_INVENTORY_BUFFER = 2;

// 2026-10 Wave 136 (원장 §150): 경로 카드 · 지도가 그리는 접근 · 귀환만 둔다 — 귀환 조건 문구(`exitRule`)는 원정 준비의 읽는 곳 없는 칸만 읽었다.
interface RoutePlan {
    approach: string;
    returnLabel: string;
}

// 2026-10 Wave 61: 보스 경로 계획은 지역의 `boss` 필드가 아니라 실제 출현 판정(`canBossAppearInMap`)을 따른다 —
//   해금 전의 숨은 보스 지역 · 구역 보스를 쓰러뜨린 지역에 '보스 진입'을 안내하지 않는다.
const getRoutePlan = (
    bossCanAppear: boolean,
    isSafeTarget: boolean,
    badge: string,
    hpRatio: number,
    inventoryCount: number,
    inventoryCap: number,
): RoutePlan => {
    if (isSafeTarget) {
        return {
            approach: '마을 정비',
            returnLabel: '안전지대',
        };
    }

    if (bossCanAppear) {
        return {
            approach: hpRatio >= ROUTE_PLAN_BOSS_HP_RATIO ? '보스 진입' : '정비 후 진입',
            returnLabel: '생명 75%',
        };
    }

    if (hpRatio <= ROUTE_PLAN_LOW_HP_RATIO) {
        return {
            approach: '교전 보류',
            returnLabel: '안전지대',
        };
    }

    if (inventoryCount >= inventoryCap - ROUTE_PLAN_INVENTORY_BUFFER) {
        return {
            approach: '전리품 회수',
            returnLabel: '가방 정리',
        };
    }

    if (badge === '개척') {
        return {
            approach: '미답 권역 조사',
            returnLabel: '발견 후 귀환',
        };
    }

    if (badge === '도전' || badge === '경계') {
        return {
            approach: '소모품 확인',
            returnLabel: '생명 50%',
        };
    }

    return {
        approach: '목표 교전',
        returnLabel: '회수',
    };
};

// cycle 519: playerLevel default 1 제거 — 1 internal callsite (line 145)
//   getMapLevel(targetMap, playerLevel) 명시 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 17번째 (cycle 502-518). body의 (playerLevel
//   || 1) defensive 가드는 별개 — caller가 0/undefined 넘기는 path 보존.
// 안내의 진입 레벨은 지도 · 조작판과 같은 판정이다(Wave 61 — 심연을 따로 "레벨 + 8"로 잠그던 사본을 지웠다).
const getMapLevel = (map: GameMap | null | undefined, playerLevel: number) => getMapRequiredLevel(map, playerLevel);
const getVisitedMaps = (player: Player) => new Set([...(player?.stats?.visitedMaps || []), player?.loc].filter(Boolean));

const getQuestProgressLabel = (entry: ExpeditionQuestEntry) => {
    if (!entry?.quest) return '';
    if (entry.quest.target === 'level') return `레벨 ${entry.progress}/${entry.quest.goal}`;
    return `${entry.progress}/${entry.quest.goal}`;
};

const getQuestProgressPercent = (entry: ExpeditionQuestEntry) => {
    if (!entry?.quest?.goal) return 0;
    return Math.max(0, Math.min(100, Math.round(((entry.progress || 0) / Math.max(1, entry.quest.goal)) * 100)));
};

const getQuestRouteLabel = (quest: ExpeditionQuestDefinition | undefined, targetMaps: string[]) => {
    if (targetMaps.length > 0) return targetMaps[0];
    if (quest?.target === 'level') return '성장 루트';
    if (quest?.type === 'craft') return '제작소';
    if (quest?.type === 'combat_count') return quest.target === 'bossKills' ? '보스 권역' : '모든 권역';
    if (quest?.type === 'bounty_count') return '현상금';
    if (quest?.type === 'build_victory') return quest?.buildLabel || '빌드 전투';
    if (quest?.type === 'discovery_count') return '미답 권역';
    if (quest?.type === 'explore_count') return '탐험 흐름';
    if (quest?.type === 'gold_earned') return MSG.QUEST_ROUTE_GOLD;
    if (quest?.type === 'survive_low_hp') return '위험 교전';
    return quest?.target || '현재 권역';
};

const getQuestNextStep = (entry: ExpeditionQuestEntry, targetMaps: string[]) => {
    const quest = entry.quest;
    const remaining = Math.max(0, (quest.goal || 0) - (entry?.progress || 0));

    if (entry?.isComplete) return '마을에서 보상 회수';
    if (quest.target === 'level') return `레벨 ${quest.goal}까지 성장`;
    if (quest.type === 'explore_count' && quest.location && targetMaps.length > 0) {
        return `${targetMaps[0]}에서 탐험 ${remaining}회 진행`;
    }
    if (targetMaps.length > 0) return `${targetMaps[0]}에서 ${quest.target} 추적`;
    if (quest.type === 'craft') return `제작 ${remaining}회 진행`;
    if (quest.type === 'combat_count') {
        // 2026-10 Wave 61: `kills`는 보스 처치도 센다(CombatEngine.handleVictory) — '일반 몬스터'라 부르지 않는다.
        return quest.target === 'bossKills'
            ? `보스 ${remaining}회 더 처치`
            : MSG.QUEST_NEXT_STEP_KILLS(remaining);
    }
    if (quest.type === 'bounty_count') return `현상금 ${remaining}건 완료`;
    if (quest.type === 'build_victory') return `${quest.buildLabel || '지정 빌드'} ${remaining}승`;
    if (quest.type === 'discovery_count') return `발견 ${remaining}회 확보`;
    if (quest.type === 'explore_count') return `탐험 ${remaining}회 진행`;
    if (quest.type === 'gold_earned') return MSG.QUEST_NEXT_STEP_GOLD(remaining);
    if (quest.type === 'survive_low_hp') return `낮은 생명 승리 ${remaining}회`;
    return `${quest.target || '목표'} ${remaining}회 진행`;
};

const getQuestReturnLabel = (entry: ExpeditionQuestEntry, targetMaps: string[]) => {
    const quest = entry.quest;
    if (entry?.isComplete) return '보상 받기';
    if (quest.target === 'level') return '성장';
    if (targetMaps.length > 0) return '목표 지역';
    if (quest.type === 'craft') return '제작';
    if (quest.type === 'combat_count') return quest.target === 'bossKills' ? '보스 토벌' : '누적 토벌';
    if (quest.type === 'bounty_count') return '현상금';
    if (quest.type === 'build_victory') return '빌드';
    if (quest.type === 'discovery_count') return '발견';
    if (quest.type === 'gold_earned') return MSG.QUEST_RETURN_GOLD;
    return '계속 진행';
};

interface QuestTrackerPayload {
    kind: 'claimable' | 'bounty' | 'active';
    title: string | undefined;
    progressLabel: string;
    questId: string | number;
    progressPercent: number;
    routeLabel: string;
    nextStep: string;
    returnLabel: string;
}

const buildQuestTrackerPayload = (entry: ExpeditionQuestEntry, kind: QuestTrackerPayload['kind'], progressLabel: string): QuestTrackerPayload => {
    const targetMaps = getExpeditionQuestTargetMaps(entry.quest);
    const routeLabel = getQuestRouteLabel(entry.quest, targetMaps);
    const nextStep = getQuestNextStep(entry, targetMaps);
    const returnLabel = getQuestReturnLabel(entry, targetMaps);
    const progressPercent = entry.isComplete ? 100 : getQuestProgressPercent(entry);

    return {
        kind,
        title: entry.quest.title,
        progressLabel,
        questId: entry.id,
        progressPercent,
        routeLabel,
        nextStep,
        returnLabel,
    };
};

export interface QuestTrackerFocusQuest {
    questId: string | number;
    title: string | undefined;
    progressLabel: string;
    routeLabel: string;
    nextStep: string;
    isComplete: boolean;
}

export interface QuestTracker extends QuestTrackerPayload {
    focusCount: number;
    focusQuests: QuestTrackerFocusQuest[];
}

export const getQuestTracker = (player: Player): QuestTracker | null => {
    const entries = getFocusedExpeditionQuestEntries(player);
    if (!entries.length) return null;

    const withFocusSummary = (payload: QuestTrackerPayload): QuestTracker => ({
        ...payload,
        focusCount: entries.length,
        focusQuests: entries.map((entry) => {
            const summary = buildQuestTrackerPayload(
                entry,
                entry.isComplete ? 'claimable' : entry.isBounty ? 'bounty' : 'active',
                entry.isComplete ? '보상 대기' : getQuestProgressLabel(entry),
            );
            return {
                questId: summary.questId,
                title: summary.title,
                progressLabel: summary.progressLabel,
                routeLabel: summary.routeLabel,
                nextStep: summary.nextStep,
                isComplete: entry.isComplete,
            };
        }),
    });

    // cycle 334: detail 필드 제거 — getQuestTracker 외부 read 0건이던 dead field.
    const claimable = entries.find((entry) => entry.isComplete);
    if (claimable) {
        return withFocusSummary(buildQuestTrackerPayload(claimable, 'claimable', '보상 대기'));
    }

    const ranked = [...entries].sort((left, right) => {
        const leftScore = (left.isBounty ? 20 : 0) + ((left.progress || 0) / Math.max(1, left.quest.goal || 1));
        const rightScore = (right.isBounty ? 20 : 0) + ((right.progress || 0) / Math.max(1, right.quest.goal || 1));
        return rightScore - leftScore;
    });

    const focus = ranked[0];
    return withFocusSummary(buildQuestTrackerPayload(focus, focus.isBounty ? 'bounty' : 'active', getQuestProgressLabel(focus)));
};

// 2026-10 Wave 136 (원장 §150): 탐험 예보는 분위기 문구와 영어 칩(TEMPO · EVENT · RELIC · QUIET, 안전지대는 REST · BOARD)을
//   만들었지만 화면은 어느 것도 그리지 않았다(경로 추천의 LV · STATE · RETURN 칩도 그리지 않았다). 남는 것은 경로 추천 점수의
//   '발견 상승' 판정 하나다 — 이전 분위기 순서대로 보스가 나오는 지역은 보스가 먼저라 호출처가 거른다.
const isDiscoveryRising = (player: Player, mapData: GameMap): boolean => {
    const odds = getDiscoveryOdds(player, mapData);
    return clampPercent(odds.narrativeEventChance) >= 10 || clampPercent(odds.relicChance) >= 12;
};

interface MoveRecommendationCandidate {
    name: string;
    _sortKey: number;
    _isLocked: boolean;
    badge: string;
    reason: string;
    levelLabel: string;
    routePlan: RoutePlan;
}

export interface MoveRecommendation {
    name: string;
    badge: string;
    reason: string;
    levelLabel: string;
    routePlan: RoutePlan;
    isRecommended: boolean;
}

// cycle 579: maps default {} 제거 — 2 production caller (MapNavigator:66,
//   ControlPanel:58) + 8+ test caller 모두 maps 명시 (DB.MAPS / MAPS / object
//   literal)이라 default 도달 불가. 청소 메가 시리즈 71번째.
export const getMoveRecommendations = (player: Player, stats: FullStats | null | undefined, currentMap: GameMap | null | undefined, maps: Record<string, GameMap>): MoveRecommendation[] => {
    if (!currentMap?.exits?.length) return [];

    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const mpRatio = (player?.mp || 0) / Math.max(1, stats?.maxMp || player?.maxMp || 1);
    const inventoryCount = player?.inv?.length || 0;
    // cycle 182: player.maxInv 확장 우선 — 기존 BALANCE.INV_MAX_SIZE 만 사용해 확장 인벤(25)에서도 20-2=18에 경고 발동.
    //   2026-09 Wave 33: 상한은 getInventoryCapacity(영구 크기 + 이번 런 가방 칸).
    const inventoryCap = getInventoryCapacity(player || {});
    const playerLevel = player?.level || 1;
    const visitedMaps = getVisitedMaps(player);

    return currentMap.exits
        .map((exitName): MoveRecommendationCandidate | null => {
            const targetMap = maps?.[exitName];
            if (!targetMap) return null;

            const targetLevel = getMapLevel(targetMap, playerLevel);
            const levelGap = targetLevel - playerLevel;
            const isLocked = targetLevel > playerLevel;
            const isSafeTarget = targetMap.type === 'safe';
            const isVisited = visitedMaps.has(exitName);
            const bossCanAppear = canBossAppearInMap(exitName, targetMap, player);
            let score = 0;
            let badge = '전진';
            let reason = '현재 전력으로 무난하게 전개할 수 있는 경로입니다.';

            if (isSafeTarget) {
                badge = '정비';
                score += 10;
                if (hpRatio <= 0.5) {
                    score += 32;
                    reason = '생명 회복과 보급을 먼저 하기 좋은 안전 경로입니다.';
                } else if (inventoryCount >= inventoryCap - 2) {
                    score += 24;
                    reason = '상점과 정리를 먼저 하기 좋은 여유 구간입니다.';
                } else if (player?.job === '모험가' && playerLevel >= 5) {
                    score += 22;
                    reason = '전직과 재정비를 함께 마무리하기 좋은 경로입니다.';
                } else {
                    reason = '휴식, 상점, 게시판을 바로 열 수 있는 안전 경로입니다.';
                }
            } else {
                if (bossCanAppear) {
                    badge = '보스';
                    if (hpRatio >= 0.85 && mpRatio >= 0.65) {
                        score += 28;
                        reason = '보스 브리핑을 활용해 밀어붙이기 좋은 타이밍입니다.';
                    } else {
                        score -= 16;
                        badge = '경계';
                        reason = '보스 권역입니다. 회복과 빠른 칸 정비 후 진입이 안전합니다.';
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
                    badge = '사냥터';
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
                if (!bossCanAppear && isDiscoveryRising(player, targetMap)) score += 5;
                if (hpRatio <= 0.35) {
                    score -= 18;
                    badge = '경계';
                    reason = '현재 생명이 낮아 더 깊이 들어가기엔 위험한 경로입니다.';
                }
            }

            if (isLocked) {
                badge = '잠김';
                reason = `레벨 ${targetLevel}부터 진입할 수 있습니다. 현재 지역의 임무와 탐험을 먼저 진행하세요.`;
            }

            const routePlan = getRoutePlan(bossCanAppear, isSafeTarget, badge, hpRatio, inventoryCount, inventoryCap);

            // cycle 333: score / isSafeTarget / isVisited / isBoss 4 dead 필드 제거 —
            //   score는 정렬 직후 외부 read 0건, 나머지는 ControlPanel/MapNavigator/test 모두
            //   read 0건이라 silent metadata. score는 정렬 후 내부 _sortKey로만 유지.
            return {
                name: exitName,
                _sortKey: score,
                _isLocked: isLocked,
                badge,
                reason,
                levelLabel: targetMap.level === 'infinite' ? '심연' : `레벨 ${targetLevel}`,
                routePlan,
            };
        })
        .filter((entry): entry is MoveRecommendationCandidate => entry !== null)
        .sort((left, right) => (
            Number(left._isLocked) - Number(right._isLocked)
            || right._sortKey - left._sortKey
        ))
        .map((entry, index): MoveRecommendation => {
            // 내부 정렬용 필드는 UI 계약에 노출하지 않는다.
            const { _sortKey, _isLocked, ...exposed } = entry;
            void _sortKey;
            return { ...exposed, isRecommended: index === 0 && !_isLocked };
        });
};

export const getExpeditionPreparation = (
    player: Player,
    stats: FullStats | null | undefined,
    currentMap: GameMap | null | undefined,
    maps: Record<string, GameMap>,
) => {
    const tracker = getQuestTracker(player);
    const routes = getMoveRecommendations(player, stats, currentMap, maps);
    const currentLocation = player?.loc || '';
    const targetLocation = tracker?.routeLabel && maps[tracker.routeLabel]
        ? tracker.routeLabel
        : null;
    const missionStep = targetLocation
        ? getNextMapTowardTarget(maps, currentLocation, targetLocation)
        : null;
    const departure = routes.find((route) => route.name === missionStep) || routes[0] || null;
    const destinationMap = departure ? maps[departure.name] : null;
    const playerLevel = player?.level || 1;
    const hpPercent = Math.max(0, Math.min(100, Math.round(
        ((player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1)) * 100,
    )));

    const isClaimable = tracker?.kind === 'claimable';
    const canDepart = Boolean(
        currentMap?.type === 'safe'
        && departure
        && destinationMap
        && playerLevel >= getMapRequiredLevel(destinationMap, playerLevel),
    );
    const readinessLabel = isClaimable
        ? '보상 대기'
        : !canDepart
            ? '경로 확인 필요'
            : hpPercent < 65
                ? '휴식 권장'
                : !player?.equip?.weapon
                    ? '무기 필요'
                    : !player?.equip?.armor
                        ? '장비 확인'
                        : '출발 가능';
    const additionalGoalCount = Math.max(0, (tracker?.focusQuests?.length || 0) - 1);
    const goalLabel = tracker?.nextStep
        ? `${tracker.nextStep}${additionalGoalCount > 0 ? ` · 외 ${additionalGoalCount}건` : ''}`
        : '임무를 고르거나 자유 탐험';

    // 2026-10 Wave 136 (원장 §150): 원정 준비 칸이 그리는 것은 준비 칩 · 목적지 · 목표 · 주 단추다 — 아무도 읽지 않던
    //   임무 이름 · 진행 · 집중 임무 · 생명/기력 · 장비 · 귀환 문구 여섯 칸을 지웠다.
    return {
        tracker,
        departure,
        canDepart,
        isClaimable,
        readinessLabel,
        goalLabel,
        // Wave 62 (원장 §61.2 A10): 길 잃은 여행은 출구가 어디로 이어지는지 말하지 않는다(지도 화면의 '미확인 경로'와 같다).
        destination: departure?.name ? getVisibleRouteName(player, departure.name) : '이동 경로 없음',
    };
};

/** 다음 행동의 종류 — 조작판의 단추 강조(`ACTION_KIND_TO_BUTTON`)와 마을 주 단추(`getTownActionPresentation`)가 읽는다. */
export type GuidanceActionKind =
    | 'claim_quest'
    | 'explore'
    | 'open_class'
    | 'open_crafting'
    | 'open_inventory'
    | 'open_move'
    | 'open_quest_board'
    | 'rest';

export interface GuidanceAction {
    kind: GuidanceActionKind;
    /** 첫 원정(탐험 · 처치 0)의 출발 — 마을 주 단추가 첫 출발 문구를 고른다. */
    firstSortie?: true;
}

/**
 * 모험 안내. 행동 종류는 언제나 정하고, 제목 · 이유는 필드 안내 줄(`adventure-guidance-strip`)이 그리는 곳 — 대기 상태 ·
 * 안전지대 밖 · 임무 추적 없음 — 에서만 싣는다. 마을은 행동 종류만 쓴다(주 단추 · 시설 단추 강조).
 */
export interface AdventureGuidance {
    title?: string;
    detail?: string;
    primaryAction: GuidanceAction | null;
}

// 2026-10 Wave 136 (원장 §150, 소유자 결정 "지우기"): 마을의 다음 행동. 이유 문구는 없다 — 안전지대 안내 아홉 갈래의 제목 ·
//   이유는 화면에 그려진 적이 없다(Wave 62 · 134가 그 문장을 고쳤다). 전설 각인 공명 갈래도 지웠다: 남은 것은 단추뿐이었는데,
//   자연 플레이 마을 도착의 0.8%(전부 사망 뒤 Lv1 재시작)에서 임무 게시판 대신 시작 지역 출발을 가리켰다(원장 §149.5).
const getTownGuidanceAction = (player: Player, hpRatio: number, hasQuestTracker: boolean): GuidanceAction => {
    const level = player?.level || 1;
    // slice 22: 첫 세션 온보딩 — 탐험 · 처치 이력이 전혀 없으면 첫 출발. 첫 방문 보상은 시작 마을의 첫 출구(추천 경로의
    //   첫 지역)의 표 값이다(2026-10 Wave 62, 원장 §61.4 C16).
    const firstSortieReward = FIRST_VISIT_REWARDS[MAPS[CONSTANTS.START_LOCATION]?.exits?.[0] ?? ''];
    if (firstSortieReward && level <= 2 && !(Number(player?.stats?.explores) || 0) && !(Number(player?.stats?.kills) || 0)) {
        return { kind: 'open_move', firstSortie: true };
    }
    if (player?.job === '모험가' && level >= 5) return { kind: 'open_class' };
    // Wave 61: 휴식은 실제 휴식 비용(레벨 · 거울 반영, `getRestCost`)으로 판단한다 — 기본 비용 60으로 보던 동안 Lv40 · 골드 100에서
    //   휴식을 가리키고 누르면 골드 부족으로 거부됐다(원장 §61 A19).
    const canAffordRest = (player?.gold || 0) >= (player ? getRestCost(player) : BALANCE.REST_COST);
    if (hpRatio <= 0.65 && canAffordRest) return { kind: 'rest' };
    // cycle 115: 걸린 상태이상은 안전지대의 휴식이 모두 푼다.
    if (canAffordRest && (player?.status || []).some((status: StatusId) => MSG.STATUS_LABELS[status])) return { kind: 'rest' };
    const inventoryCount = player?.inv?.length || 0;
    // cycle 182: player.maxInv 확장 우선 — 2026-09 Wave 33부터 상한은 getInventoryCapacity(영구 크기 + 이번 런 가방 칸).
    if (inventoryCount >= getInventoryCapacity(player || {}) - 2) {
        // 2026-09 Wave 33: 가방이 찼는데 다음 가방을 바로 만들 수 있으면 정리보다 제작소를 먼저 가리킨다.
        return { kind: player && getBagCraftReadiness(player)?.ready ? 'open_crafting' : 'open_inventory' };
    }
    return { kind: hasQuestTracker ? 'open_move' : 'open_quest_board' };
};

// cycle 509: runtimeState default 제거 — 1 callsite (ControlPanel:57) 항상
//   gameState 명시 전달이라 default 도달 불가. util default 청소 메가 시리즈
//   8번째 (cycle 502-508).
export const getAdventureGuidance = (player: Player, stats: FullStats | null | undefined, mapData: GameMap | null | undefined, runtimeState: string | null | undefined): AdventureGuidance => {
    // 대기 상태가 아니면 다음 행동이 없다 — 안내 줄은 대기 상태의 조작판에만 있다(전투는 전투 화면, 계승 · 진 엔딩은 화면 전체를 덮는다).
    if (runtimeState && runtimeState !== 'idle') return { primaryAction: null };

    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const questTracker = getQuestTracker(player);
    if (questTracker?.kind === 'claimable') return { primaryAction: { kind: 'claim_quest' } };
    if (mapData?.type === 'safe') return { primaryAction: getTownGuidanceAction(player, hpRatio, Boolean(questTracker)) };

    // 필드 — 안내 줄은 임무 추적이 없을 때만 그려진다(추적이 있으면 그 자리는 임무 줄이다).
    const strip = (title: string, detail: string) => (questTracker ? {} : { title, detail });
    // slice 22: 첫 교전 — 처치 이력이 없는 Lv2 이하에게 탐험 → 첫 교전을 안내한다.
    if ((player?.level || 1) <= 2 && !(Number(player?.stats?.kills) || 0)) {
        return {
            ...strip('첫 교전', '탐험으로 적을 찾아보세요. 기본 공격 사이에 기력 10을 쓰는 강타를 섞으면 4-5턴이면 충분합니다.'),
            primaryAction: { kind: 'explore' },
        };
    }
    if (hpRatio <= 0.35) {
        return {
            ...strip('후퇴 또는 회복 권장', '현재 생명이 낮습니다. 더 깊게 들어가기보다 이동과 회복을 먼저 고려하세요.'),
            primaryAction: { kind: 'open_move' },
        };
    }
    return { ...strip('탐험 이어가기', '지금 흐름이면 탐험을 한 번 더 밀어도 됩니다.'), primaryAction: { kind: 'explore' } };
};
