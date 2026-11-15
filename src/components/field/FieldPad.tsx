import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import type { FieldDirection } from '../../types/fieldMap';

/**
 * 방향 패드(설계 §8) — 누르면 한 칸, 누르고 있으면 `BALANCE.FIELD_WALK_REPEAT_MS`마다 한 칸. 걸을 수 없게 되면(조우 · 상자 · 출구)
 * 반복이 그 자리에서 멈춘다. 칸은 44px 이상이다. 키보드는 단추 누름(Enter · Space)과 방향 키(훅)로 걷는다.
 */

interface FieldPadProps {
    canWalk: boolean;
    onWalk: (direction: FieldDirection) => void;
}

const BUTTONS: { direction: FieldDirection; label: string; Icon: typeof ChevronUp; area: string }[] = [
    { direction: 'up', label: MSG.FIELD_DIR_UP, Icon: ChevronUp, area: 'up' },
    { direction: 'left', label: MSG.FIELD_DIR_LEFT, Icon: ChevronLeft, area: 'left' },
    { direction: 'right', label: MSG.FIELD_DIR_RIGHT, Icon: ChevronRight, area: 'right' },
    { direction: 'down', label: MSG.FIELD_DIR_DOWN, Icon: ChevronDown, area: 'down' },
];

const FieldPad = ({ canWalk, onWalk }: FieldPadProps) => {
    const timerRef = useRef<number | null>(null);
    const canWalkRef = useRef(canWalk);
    const onWalkRef = useRef(onWalk);
    useEffect(() => {
        canWalkRef.current = canWalk;
        onWalkRef.current = onWalk;
    });

    const release = () => {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
    };
    useEffect(() => release, []);
    useEffect(() => {
        if (!canWalk) release();
    }, [canWalk]);

    const press = (direction: FieldDirection) => (event: PointerEvent<HTMLButtonElement>) => {
        if (!canWalkRef.current || event.button > 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        release();
        onWalkRef.current(direction);
        timerRef.current = window.setInterval(() => {
            if (!canWalkRef.current) {
                release();
                return;
            }
            onWalkRef.current(direction);
        }, BALANCE.FIELD_WALK_REPEAT_MS);
    };
    // 키보드 누름은 click으로만 온다(detail 0) — 포인터 누름은 pointerdown이 이미 걸었다.
    const click = (direction: FieldDirection) => (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0 && canWalkRef.current) onWalkRef.current(direction);
    };
    const keyRepeat = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.repeat) event.preventDefault();
    };

    return (
        <div data-testid="field-pad" role="group" aria-label={MSG.FIELD_A11Y_PAD} className="ae-field-pad">
            {BUTTONS.map(({ direction, label, Icon, area }) => (
                <button
                    key={direction}
                    type="button"
                    data-testid={`field-pad-${direction}`}
                    aria-label={label}
                    title={label}
                    disabled={!canWalk}
                    onPointerDown={press(direction)}
                    onPointerUp={release}
                    onPointerCancel={release}
                    onLostPointerCapture={release}
                    onClick={click(direction)}
                    onKeyDown={keyRepeat}
                    onContextMenu={(event) => event.preventDefault()}
                    className="ae-field-pad-btn"
                    style={{ gridArea: area }}
                >
                    <Icon size={22} aria-hidden="true" />
                </button>
            ))}
        </div>
    );
};

export default FieldPad;
