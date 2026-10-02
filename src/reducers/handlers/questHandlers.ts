import { BALANCE } from '../../data/constants';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import {
    appendExpeditionFocusQuest,
    getPreparedExpeditionFocusQuestIds,
    MAX_EXPEDITION_FOCUS_QUESTS,
    removeExpeditionFocusQuest,
} from '../../utils/expeditionMissionFocus';
import { getMapRequiredLevel } from '../../utils/mapTopology';
import { nonWalkingEntryOf } from '../../utils/mapRouteGate';
import { getProtocolDayKey } from '../../utils/protocolCycle';
import { createQuestProgressState } from '../../utils/questProgress';
import { getUnmetQuestPrerequisite } from '../../utils/questPrerequisites';
import type { GameState, HandlerMap } from '../gameReducer';
import { appendRewardLogs } from './rewardLog';

const sameQuestId = (left: unknown, right: unknown) => String(left) === String(right);

const appendQuestLog = (state: GameState, type: string, text: string): GameState => ({
    ...state,
    logs: appendRewardLogs(state.logs, [{ type, text }]),
});

const isSafeLocation = (state: GameState) => (
    typeof state.player.loc === 'string' && DB.MAPS[state.player.loc]?.type === 'safe'
);

const normalizedSeed = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.abs(numeric % 1);
};

const getRequestDate = (requestedAt: unknown) => {
    const now = Date.now();
    const candidate = Number(requestedAt);
    const acceptedTime = Number.isFinite(candidate) && Math.abs(now - candidate) <= 5 * 60 * 1000
        ? candidate
        : now;
    return new Date(acceptedTime);
};

export const getBountyTargets = (level: number) => {
    const targets: string[] = [];
    Object.entries(DB.MAPS).forEach(([name, map]) => {
        // 걸어서 못 들어가는 지역(시즌 한정 · 열쇠로 여는 고대 보물고)의 몬스터는 현상수배 대상이 아니다.
        //   Wave 61: 시즌만 빼던 동안 보물고 전용 몬스터(황금 골렘 · 보물사냥꾼 · 미믹)가 Lv35 대상 16종 중 3종이었다.
        if (nonWalkingEntryOf(name, map)) return;
        const mapLevel = getMapRequiredLevel(map, level);
        if (
            map.level !== 'infinite'
            && mapLevel <= level + 5
            && mapLevel >= Math.max(1, level - 10)
            && !map.boss
        ) {
            targets.push(...(map.monsters || []));
        }
    });
    return targets.length > 0 ? targets : ['슬라임'];
};

export const questActionMap = {
    ACCEPT_QUEST: (state, action) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.QUEST_TOWN_ONLY);

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        if ((state.player.quests || []).some((quest) => sameQuestId(quest.id, questId))) return state;

        const quest = DB.QUESTS.find((entry) => sameQuestId(entry.id, questId));
        if (!quest || quest.id === undefined) return state;

        const claimedQuestIds = Array.isArray(state.player.stats?.claimedQuestIds)
            ? state.player.stats.claimedQuestIds
            : [];
        if (claimedQuestIds.some((id) => sameQuestId(id, quest.id))) {
            return appendQuestLog(state, 'info', MSG.QUEST_ALREADY_COMPLETED);
        }
        if ((Number(state.player.level) || 1) < (quest.minLv || 1)) {
            return appendQuestLog(state, 'error', MSG.QUEST_LEVEL_REQUIRED(quest.minLv));
        }

        const unmetPrerequisite = getUnmetQuestPrerequisite(quest, claimedQuestIds, DB.QUESTS);
        if (unmetPrerequisite) {
            return appendQuestLog(state, 'info', MSG.QUEST_PREREQUISITE_REQUIRED(unmetPrerequisite.title));
        }

        const acceptedQuest = createQuestProgressState(quest, state.player);
        const player = appendExpeditionFocusQuest({
            ...state.player,
            quests: [...(state.player.quests || []), acceptedQuest],
        }, quest.id);

        return {
            ...state,
            player,
            logs: appendRewardLogs(state.logs, [{ type: 'event', text: MSG.QUEST_ACCEPTED(quest.title) }]),
            syncStatus: 'syncing',
        };
    },

    ABANDON_QUEST: (state, action) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.QUEST_ABANDON_TOWN_ONLY);

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        const activeQuest = (state.player.quests || []).find((quest) => sameQuestId(quest.id, questId));
        if (!activeQuest) return state;

        const quest = activeQuest.isBounty
            ? activeQuest
            : DB.QUESTS.find((entry) => sameQuestId(entry.id, questId));
        if (!quest) return state;
        if ((activeQuest.progress || 0) >= (quest.goal || 0)) {
            return appendQuestLog(state, 'info', MSG.QUEST_ABANDON_REWARD_PENDING);
        }

        const player = removeExpeditionFocusQuest({
            ...state.player,
            quests: (state.player.quests || []).filter((entry) => !sameQuestId(entry.id, questId)),
        }, questId);
        const message = activeQuest.isBounty
            ? MSG.BOUNTY_ABANDONED
            : MSG.QUEST_ABANDONED(quest.title);

        return {
            ...state,
            player,
            logs: appendRewardLogs(state.logs, [{ type: 'event', text: message }]),
            syncStatus: 'syncing',
        };
    },

    REQUEST_BOUNTY: (state, action) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.BOUNTY_TOWN_ONLY);
        if ((state.player.quests || []).some((quest) => quest.isBounty)) return state;

        // 2026-09 Wave 32 (소유자 결정): 하루 1회 제한을 없앴다 — 진행 중인 현상수배는 하나, 완료하면 바로 다음이다.
        //   카탈로그 임무는 계정당 1회라(Q8) 계승 뒤 런에는 이것이 유일한 반복 게시판 콘텐츠다(원장 §31.2).
        //   `bountyDate`/`bountyIssued`는 마지막 발급 기록으로만 남는다(게이트가 아니다).
        const requestDate = getRequestDate(action.payload?.requestedAt);
        const dayKey = getProtocolDayKey(requestDate);

        const level = Math.max(1, Number(state.player.level) || 1);
        const seed = normalizedSeed(action.payload?.seed);
        const targets = getBountyTargets(level);
        const target = targets[Math.min(targets.length - 1, Math.floor(seed * targets.length))];
        const countSeed = normalizedSeed(seed * 9973);
        const count = BALANCE.BOUNTY_MIN_COUNT + Math.floor(countSeed * BALANCE.BOUNTY_COUNT_RANGE);
        const bountyId = `bounty_${requestDate.getTime()}_${Math.floor(seed * 1_000_000_000)}`;
        const bounty = {
            id: bountyId,
            title: `[현상수배] ${target} 토벌`,
            desc: `${target} ${count}마리를 처치하라.`,
            target,
            goal: count,
            progress: 0,
            isBounty: true,
            reward: {
                exp: Math.floor(count * level * BALANCE.BOUNTY_EXP_MULT),
                gold: Math.floor(count * level * BALANCE.BOUNTY_GOLD_MULT),
            },
        };
        const player = appendExpeditionFocusQuest({
            ...state.player,
            quests: [...(state.player.quests || []), bounty],
            stats: {
                ...state.player.stats,
                bountyDate: dayKey,
                bountyIssued: true,
            },
        }, bountyId);

        return {
            ...state,
            player,
            logs: appendRewardLogs(state.logs, [{ type: 'event', text: MSG.BOUNTY_ACCEPTED_NEW(target, count) }]),
            syncStatus: 'syncing',
        };
    },

    UPDATE_EXPEDITION_FOCUS_QUEST: (state, action) => {
        if (!isSafeLocation(state) || state.player.activeExpedition) {
            return appendQuestLog(state, 'error', MSG.EXPEDITION_FOCUS_TOWN_ONLY);
        }

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        const shouldSelect = action.payload?.selected === true;
        const questState = (state.player.quests || []).find((quest) => sameQuestId(quest.id, questId));
        if (!questState) return state;
        const quest = questState.isBounty
            ? questState
            : DB.QUESTS.find((entry) => sameQuestId(entry.id, questId));
        if (!quest) return state;

        const selected = getPreparedExpeditionFocusQuestIds(state.player);
        const isSelected = selected.some((id) => sameQuestId(id, questId));
        if (isSelected === shouldSelect) return state;
        if (shouldSelect && selected.length >= MAX_EXPEDITION_FOCUS_QUESTS) {
            return appendQuestLog(state, 'info', MSG.EXPEDITION_FOCUS_LIMIT);
        }
        if (!shouldSelect && selected.length === 1) {
            return appendQuestLog(state, 'info', MSG.EXPEDITION_FOCUS_REQUIRED);
        }

        const expeditionFocusQuestIds = shouldSelect
            ? [...selected, questState.id]
            : selected.filter((id) => !sameQuestId(id, questId));
        const message = shouldSelect
            ? MSG.EXPEDITION_FOCUS_ADDED(quest.title)
            : MSG.EXPEDITION_FOCUS_REMOVED(quest.title);

        return {
            ...state,
            player: { ...state.player, expeditionFocusQuestIds },
            logs: appendRewardLogs(state.logs, [{ type: 'system', text: message }]),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
