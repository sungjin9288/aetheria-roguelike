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
import { isEncounterBoss } from '../../utils/bossPresence';
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

/** 진입 레벨이 [minLevel, level + ABOVE]인 사냥 지역의 일반 몬스터(지역 순서 · 조우 목록 순서, 지역마다 한 번씩). */
const collectBountyTargets = (level: number, minLevel: number): string[] => {
    const targets: string[] = [];
    Object.entries(DB.MAPS).forEach(([name, map]) => {
        // 걸어서 못 들어가는 지역(시즌 한정 · 열쇠로 여는 고대 보물고)의 몬스터는 현상수배 대상이 아니다.
        //   Wave 61: 시즌만 빼던 동안 보물고 전용 몬스터(황금 골렘 · 보물사냥꾼 · 미믹)가 Lv35 대상 16종 중 3종이었다.
        if (nonWalkingEntryOf(name, map)) return;
        // 혼돈의 심연은 층마다 적이 커지는 별도 축이라 레벨 창으로 고르지 않는다.
        if (map.level === 'infinite') return;
        const mapLevel = getMapRequiredLevel(map, level);
        if (mapLevel > level + BALANCE.BOUNTY_LEVEL_WINDOW_ABOVE || mapLevel < minLevel) return;
        // 2026-10 Wave 62 (원장 §61.4 C12): 지역의 `boss` 필드(구역 보스의 이름, Wave 29)로 지역 전체를 빼지 않는다 —
        //   그 필터가 52곳 중 28곳을 빼서 Lv69부터 대상이 0이었고 슬라임(보상은 레벨 비례)으로 떨어졌다. 대신 보스로
        //   정산되는 몬스터만 뺀다 — 판정은 `spawnEnemy`의 `isBoss`와 같은 `isEncounterBoss`(몬스터 자신 · 지역
        //   `bossMonsters` · `BOSS_MONSTERS`).
        for (const monster of map.monsters || []) {
            if (!isEncounterBoss(monster, map)) targets.push(monster);
        }
    });
    return targets;
};

/**
 * 현상수배 대상 후보 — "현재 레벨 기준"(게시판 문구). 진입 레벨이 [레벨 − BELOW, 레벨 + ABOVE]인 걸어갈 수 있는 사냥
 * 지역의 일반 몬스터다. 창 안에 대상이 없으면(가장 높은 사냥 지역보다 한참 높은 레벨) 아래쪽 경계를 BELOW씩 넓힌다 —
 * 결정론이고 가장 가까운 레벨대를 고른다. 레벨 1까지 넓혀도 없으면 빈 목록이다(실데이터에서는 일어나지 않는다).
 */
export const getBountyTargets = (level: number): string[] => {
    for (let below = BALANCE.BOUNTY_LEVEL_WINDOW_BELOW; ; below += BALANCE.BOUNTY_LEVEL_WINDOW_BELOW) {
        const minLevel = Math.max(1, level - below);
        const targets = collectBountyTargets(level, minLevel);
        if (targets.length > 0 || minLevel <= 1) return targets;
    }
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
        // 대상이 없으면 발급하지 않는다(이름 없는 현상수배를 만들지 않는다) — 실데이터 Lv1 ~ 99에서는 언제나 있다.
        if (targets.length === 0) return state;
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
