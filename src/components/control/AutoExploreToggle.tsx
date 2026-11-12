import { Pause, Repeat } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import { MSG } from '../../data/messages';
import type { AutoExploreControl } from '../../hooks/useAutoExplore';

interface AutoExploreToggleProps {
    control: AutoExploreControl;
}

/**
 * 연속 탐험 토글(2026-11 H1, docs/EXECUTION_SKETCH_H1_2026-11.md §3.3).
 *   꺼져 있으면 시작 단추(지금 첫 걸음이 탐험일 때만 눌린다), 켜져 있으면 "연속 탐험 중 · N걸음" 줄과 멈추기 단추다.
 *   멈춘 이유는 기록 한 줄이 말한다 — 여기서는 행동을 권하지 않는다(Wave 88).
 */
const AutoExploreToggle = ({ control }: AutoExploreToggleProps) => {
    if (control.running) {
        return (
            <div
                data-testid="auto-explore-running"
                role="status"
                aria-live="polite"
                className="ae-well flex items-center justify-between gap-2 rounded-ae-md px-3 py-1.5"
            >
                <span className="flex min-w-0 items-center gap-1.5 aether-type-meta font-semibold text-ae-ink">
                    <Repeat size={14} aria-hidden="true" className="shrink-0 text-ae-ether-hi" />
                    <span className="min-w-0 font-fira tabular-nums">{MSG.AUTO_EXPLORE_RUNNING(control.steps)}</span>
                </span>
                <ActionButton
                    data-testid="auto-explore-stop"
                    variant="ghost"
                    className="shrink-0"
                    icon={<Pause size={16} />}
                    label={MSG.AUTO_EXPLORE_STOP_BUTTON}
                    onClick={control.stop}
                />
            </div>
        );
    }
    return (
        <ActionButton
            data-testid="auto-explore-start"
            variant="glass"
            className="w-full"
            icon={<Repeat size={16} />}
            aria-label={MSG.AUTO_EXPLORE_START_ARIA}
            title={MSG.AUTO_EXPLORE_START_ARIA}
            label={MSG.AUTO_EXPLORE_START}
            disabled={!control.canStart}
            onClick={control.start}
        />
    );
};

export default AutoExploreToggle;
