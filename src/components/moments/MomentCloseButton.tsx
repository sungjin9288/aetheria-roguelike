import type { ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';

/**
 * 순간 · 결과 카드의 닫기 단추 하나(감사 VD-10) — 같은 모양(유리 원), 같은 아이콘 크기(18), 같은 터치 영역(44px).
 *   자리는 부르는 쪽이 카드 오른쪽 위에 둔다. 이름(aria-label)과 data-testid는 부르는 쪽이 넘긴다.
 */
export const MOMENT_CLOSE_ICON_SIZE = 18;

interface MomentCloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    'aria-label': string;
    'data-testid': string;
}

const MomentCloseButton = ({ className, type = 'button', ...buttonProps }: MomentCloseButtonProps) => (
    <button
        {...buttonProps}
        type={type}
        className={['ae-moment-close flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full', className]
            .filter(Boolean)
            .join(' ')}
    >
        <X size={MOMENT_CLOSE_ICON_SIZE} aria-hidden="true" />
    </button>
);

export default MomentCloseButton;
