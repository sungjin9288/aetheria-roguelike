import { Footprints, Pause } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import { MSG } from '../../data/messages';
import { getFieldAutoButtonText, getFieldAutoLockText } from '../../utils/fieldAuto';
import type { FieldMapControl } from '../../hooks/useFieldMap';

/**
 * 지도 자동 탐험 단추(설계 §7) — 무료면 '자동 탐험 N/5', 무료를 다 썼으면 다음 한 번의 값('자동 탐험 · 골드 6000'). 클리어하지
 * 않았거나 오늘 횟수를 다 썼거나 값을 낼 수 없으면 이유와 함께 꺼진 채로 보인다(D12와 같은 방식). 걷는 동안에는 멈추기 단추가 된다.
 */
const FieldAutoButton = ({ control }: { control: FieldMapControl }) => {
    const { auto } = control;
    if (auto.running) {
        return (
            <ActionButton
                variant="ghost"
                data-testid="field-auto-stop"
                icon={<Pause size={18} />}
                label={MSG.FIELD_AUTO_STOP}
                onClick={control.stopAuto}
                className="w-full"
            />
        );
    }
    const lockText = auto.lock ? getFieldAutoLockText(auto.lock, auto.cost) : null;
    return (
        <div>
            <ActionButton
                data-testid="field-auto-start"
                icon={<Footprints size={18} />}
                label={getFieldAutoButtonText(auto)}
                title={lockText ?? undefined}
                disabled={!auto.canStart}
                onClick={control.startAuto}
                className="w-full"
            />
            {lockText && (
                <p data-testid="field-auto-lock" className="mt-1 px-1 aether-type-meta text-ae-ink-3">{lockText}</p>
            )}
        </div>
    );
};

export default FieldAutoButton;
