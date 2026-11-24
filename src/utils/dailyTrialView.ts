import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import {
    buildDailyTrialPlayer,
    getDailyTrialPlan,
    readDailyTrialLedger,
    type DailyTrialPlan,
} from '../systems/dailyTrial';
import type { DailyTrialDay, DailyTrialRecord, Item, Player } from '../types';
import { getRelicDisplayName } from './relicPresentation';

/**
 * 오늘의 시련 입구 화면의 뷰모델 — 조건 줄은 실제 시작 플레이어(`buildDailyTrialPlayer`)에서 만든다(화면과 시작이 갈라지지 않는다).
 * 조건 · 기록을 말할 뿐 권하지 않는다.
 */

export interface DailyTrialConditionRow {
    key: 'region' | 'job' | 'gear' | 'relics' | 'supplies';
    label: string;
    values: string[];
}

export interface DailyTrialView {
    plan: DailyTrialPlan;
    rows: DailyTrialConditionRow[];
    tries: number;
    best: DailyTrialRecord | null;
    /** 오늘을 뺀 지난 기록 — 최근 날부터 */
    history: DailyTrialDay[];
}

const getGearName = (item: Item | null | undefined): string[] => (
    item?.name ? [MSG.DAILY_TRIAL_GEAR_NAME(item.name, Number(item.enhance) || 0)] : []
);

const countByName = (items: readonly Item[]): string[] => {
    const counts = new Map<string, number>();
    for (const item of items) {
        if (item.name) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    }
    return [...counts].map(([name, count]) => MSG.DAILY_TRIAL_SUPPLY(name, count));
};

export const getDailyTrialView = (initialPlayer: Player, player: Player, dayKey: string): DailyTrialView => {
    const plan = getDailyTrialPlan(dayKey);
    const start = buildDailyTrialPlayer(initialPlayer, player, dayKey);
    const days = readDailyTrialLedger(player.stats).days;
    const today = days.find((entry) => entry.day === dayKey);
    const past = days.filter((entry) => entry.day !== dayKey).slice(-BALANCE.DAILY_TRIAL_HISTORY_DAYS);
    return {
        plan,
        rows: [
            { key: 'region', label: MSG.DAILY_TRIAL_COND_REGION, values: [plan.region] },
            { key: 'job', label: MSG.DAILY_TRIAL_COND_JOB, values: [plan.job, MSG.DAILY_TRIAL_COND_LEVEL(plan.level)] },
            {
                key: 'gear',
                label: MSG.DAILY_TRIAL_COND_GEAR,
                values: [start.equip?.weapon, start.equip?.armor, start.equip?.offhand].flatMap(getGearName),
            },
            { key: 'relics', label: MSG.DAILY_TRIAL_COND_RELICS, values: (start.relics || []).map((relic) => getRelicDisplayName(relic.name)) },
            { key: 'supplies', label: MSG.DAILY_TRIAL_COND_SUPPLIES, values: countByName(start.inv || []) },
        ],
        tries: today?.tries ?? 0,
        best: today?.best ?? null,
        history: past.reverse(),
    };
};
