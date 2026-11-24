import { Hourglass, LogOut } from 'lucide-react';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';

interface DailyTrialHudProps {
    map: number;
    actions: number;
    onLeave: () => void;
}

/** 시련을 걷는 동안 언제나 보이는 한 줄 — 지금 지도 · 행동 수 · 그만두기(전투 · 사건 중에도 된다). */
const DailyTrialHud = ({ map, actions, onLeave }: DailyTrialHudProps) => (
    <div data-testid="daily-trial-hud" className="ae-trial-hud flex min-h-[44px] shrink-0 items-center gap-2 pl-3 pr-1 font-readable">
        <Hourglass size={15} aria-hidden="true" className="shrink-0 text-ae-ether-hi" />
        <span data-testid="daily-trial-hud-text" className="min-w-0 flex-1 text-[13px] font-semibold tabular-nums text-ae-ink">
            {MSG.DAILY_TRIAL_HUD(map, BALANCE.DAILY_TRIAL_MAPS, actions)}
        </span>
        <button
            type="button"
            data-testid="daily-trial-leave"
            aria-label={MSG.DAILY_TRIAL_LEAVE}
            onClick={onLeave}
            className="ae-town-pill min-h-[44px] shrink-0 pl-2.5 pr-3.5"
        >
            <LogOut size={15} aria-hidden="true" />
            {MSG.DAILY_TRIAL_LEAVE_CONFIRM}
        </button>
    </div>
);

export default DailyTrialHud;
