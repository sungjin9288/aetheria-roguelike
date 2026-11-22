import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import type { FieldDirection } from '../../types/fieldMap';

/**
 * 방향 패드(설계 §8) — 누르면 한 칸, 누르고 있으면 `repeatMs`(`BALANCE.FIELD_WALK_REPEAT_MS` × 전투 속도 배율)마다 한 칸.
 * 걸을 수 없게 되면(조우 · 출구 · 보스 문) 반복이 그 자리에서 멈추고, 다음 칸이 열지 않은 상자면(`canRepeat`) 그 앞에서 멈춘다 —
 * 상자는 한 번 더 눌러 연다. 칸은 44px 이상이다. 키보드는 단추 누름(Enter · Space)과 방향 키(훅)로 걷는다.
 */

interface FieldPadProps {
    canWalk: boolean;
    onWalk: (direction: FieldDirection) => void;
    /** 누르고 있을 때의 반복 간격 — 없으면 `BALANCE.FIELD_WALK_REPEAT_MS` */
    repeatMs?: number;
    /** 그 방향으로 반복을 이어 가도 되는가 — 없으면 언제나 참 */
    canRepeat?: (direction: FieldDirection) => boolean;
}

const BUTTONS: { direction: FieldDirection; label: string; Icon: typeof ChevronUp; area: string }[] = [
    { direction: 'up', label: MSG.FIELD_DIR_UP, Icon: ChevronUp, area: 'up' },
    { direction: 'left', label: MSG.FIELD_DIR_LEFT, Icon: ChevronLeft, area: 'left' },
    { direction: 'right', label: MSG.FIELD_DIR_RIGHT, Icon: ChevronRight, area: 'right' },
    { direction: 'down', label: MSG.FIELD_DIR_DOWN, Icon: ChevronDown, area: 'down' },
];

const FieldPad = ({ canWalk, onWalk, repeatMs = BALANCE.FIELD_WALK_REPEAT_MS, canRepeat }: FieldPadProps) => {
    const timerRef = useRef<number | null>(null);
    const canWalkRef = useRef(canWalk);
    const onWalkRef = useRef(onWalk);
    const canRepeatRef = useRef(canRepeat);
    useEffect(() => {
        canWalkRef.current = canWalk;
        onWalkRef.current = onWalk;
        canRepeatRef.current = canRepeat;
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
            if (!canWalkRef.current || canRepeatRef.current?.(direction) === false) {
                release();
                return;
            }
            onWalkRef.current(direction);
        }, repeatMs);
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
