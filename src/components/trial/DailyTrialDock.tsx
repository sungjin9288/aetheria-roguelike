import { Pause, Route } from 'lucide-react';
import { MSG } from '../../data/messages';
import type { FieldMapControl } from '../../hooks/useFieldMap';
import type { ControlButton } from '../control/types';
import FieldPad from '../field/FieldPad';
import ActionButton from '../ui/ActionButton';

interface DailyTrialDockProps {
    control: FieldMapControl | null;
    bag: ControlButton;
}

/** 시련 지도의 조작판 — 방향 패드 · 자동 걷기 · 가방뿐이다(이동 · 지도 · 정찰 · 하루 자동 탐험은 본편의 몫이다). */
const DailyTrialDock = ({ control, bag }: DailyTrialDockProps) => {
    const BagIcon = bag.icon;
    const walking = Boolean(control?.autoWalk.running);
    return (
        <div className="ae-field-dock-wrap">
            <div data-testid="daily-trial-dock" aria-label={MSG.FIELD_DOCK_LABEL} role="group" className="ae-field-dock ae-trial-dock is-walk">
                {control && (
                    <div className="ae-dock-pad">
                        <FieldPad canWalk={control.canWalk} onWalk={control.walk} repeatMs={control.repeatMs} canRepeat={control.canRepeat} />
                    </div>
                )}
                <ActionButton
                    variant={walking ? 'ghost' : 'glass'}
                    data-testid={walking ? 'field-walk-stop' : 'field-walk-start'}
                    icon={walking ? <Pause size={18} /> : <Route size={18} />}
                    label={walking ? MSG.FIELD_WALK_STOP : MSG.FIELD_WALK_START}
                    disabled={!walking && !control?.autoWalk.canStart}
                    onClick={walking ? control?.stopAutoWalk : control?.startAutoWalk}
                    className="ae-dock-btn"
                />
                <ActionButton
                    data-testid={bag.testId}
                    icon={<BagIcon size={18} />}
                    label={bag.label}
                    disabled={bag.disabled}
                    onClick={bag.onClick}
                    className="ae-dock-btn"
                />
            </div>
        </div>
    );
};

export default DailyTrialDock;
