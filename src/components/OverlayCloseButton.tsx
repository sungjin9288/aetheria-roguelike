import type { ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { MSG } from '../data/messages';

type OverlayCloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'className'>;

/**
 * 오버레이의 닫기 단추 — 화면마다 하나, 같은 모양(44px 유리 알약 · X · "닫기").
 * 2026-10 에테르 유리: 집중 화면 머리의 돌아가기 · 기록 열기 알약(`.ae-town-pill`)과 같은 결이다.
 */
const OverlayCloseButton = (props: OverlayCloseButtonProps) => (
    <button
        type="button"
        {...props}
        className="ae-town-pill min-h-[44px] min-w-[44px] shrink-0 pl-2.5 pr-3.5 font-readable"
    >
        <X size={16} aria-hidden="true" />
        {MSG.UI_CLOSE}
    </button>
);

export default OverlayCloseButton;
