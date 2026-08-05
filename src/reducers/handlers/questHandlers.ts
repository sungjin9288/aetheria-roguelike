import { BALANCE } from '../../data/constants';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import {
    appendExpeditionFocusQuest,
    getPreparedExpeditionFocusQuestIds,
    MAX_EXPEDITION_FOCUS_QUESTS,
    removeExpeditionFocusQuest,
} from '../../utils/expeditionMissionFocus';
import { getProtocolDayKey } from '../../utils/protocolCycle';
import { createQuestProgressState } from '../../utils/questProgress';
import { getUnmetQuestPrerequisite } from '../../utils/questPrerequisites';
import type { GameAction, GameState } from '../gameReducer';
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

const getBountyTargets = (level: number) => {
    const targets: string[] = [];
    (Object.values(DB.MAPS) as any[]).forEach((map) => {
        if (
            map.level !== 'infinite'
            && map.level <= level + 5
            && map.level >= Math.max(1, level - 10)
            && !map.boss
        ) {
            targets.push(...(map.monsters || []));
        }
    });
    return targets.length > 0 ? targets : ['슬라임'];
};

export const questActionMap = {
    ACCEPT_QUEST: (state: GameState, action: GameAction) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.QUEST_TOWN_ONLY);

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        if ((state.player.quests || []).some((quest: any) => sameQuestId(quest.id, questId))) return state;

        const quest = DB.QUESTS.find((entry: any) => sameQuestId(entry.id, questId));
        if (!quest || quest.id === undefined) return state;

        const claimedQuestIds = Array.isArray(state.player.stats?.claimedQuestIds)
            ? state.player.stats.claimedQuestIds
            : [];
        if (claimedQuestIds.some((id: any) => sameQuestId(id, quest.id))) {
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

    ABANDON_QUEST: (state: GameState, action: GameAction) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.QUEST_ABANDON_TOWN_ONLY);

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        const activeQuest = (state.player.quests || []).find((quest: any) => sameQuestId(quest.id, questId));
        if (!activeQuest) return state;

        const quest = activeQuest.isBounty
            ? activeQuest
            : DB.QUESTS.find((entry: any) => sameQuestId(entry.id, questId));
        if (!quest) return state;
        if ((activeQuest.progress || 0) >= (quest.goal || 0)) {
            return appendQuestLog(state, 'info', MSG.QUEST_ABANDON_REWARD_PENDING);
        }

        const player = removeExpeditionFocusQuest({
            ...state.player,
            quests: (state.player.quests || []).filter((entry: any) => !sameQuestId(entry.id, questId)),
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

    REQUEST_BOUNTY: (state: GameState, action: GameAction) => {
        if (!isSafeLocation(state)) return appendQuestLog(state, 'error', MSG.BOUNTY_TOWN_ONLY);
        if ((state.player.quests || []).some((quest: any) => quest.isBounty)) return state;

        const requestDate = getRequestDate(action.payload?.requestedAt);
        const dayKey = getProtocolDayKey(requestDate);
        if (state.player.stats?.bountyDate === dayKey && state.player.stats?.bountyIssued) {
            return appendQuestLog(state, 'error', MSG.BOUNTY_DAILY_LIMIT);
        }

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

    UPDATE_EXPEDITION_FOCUS_QUEST: (state: GameState, action: GameAction) => {
        if (!isSafeLocation(state) || state.player.activeExpedition) {
            return appendQuestLog(state, 'error', MSG.EXPEDITION_FOCUS_TOWN_ONLY);
        }

        const questId = action.payload?.questId;
        if (questId === undefined || questId === null) return state;
        const shouldSelect = action.payload?.selected === true;
        const questState = (state.player.quests || []).find((quest: any) => sameQuestId(quest.id, questId));
        if (!questState) return state;
        const quest = questState.isBounty
            ? questState
            : DB.QUESTS.find((entry: any) => sameQuestId(entry.id, questId));
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
};
