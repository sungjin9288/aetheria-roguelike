import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { LogOut } from 'lucide-react';
import { useOverlayDialog } from '../../hooks/useOverlayDialog';
import { MSG } from '../../data/messages';
import ActionButton from '../ui/ActionButton';

interface ExitConfirmDialogProps {
    onStay: () => void;
    onLeave: () => void;
}

/**
 * 뒤로가기로 미니앱 · 앱을 닫기 전에 묻는다(앱인토스 게임 체크리스트 '미니앱 종료 시 확인 모달').
 * 다시 뒤로가기를 누르면 '계속하기'와 같다 — App의 뒤로가기 처리기가 이 창을 먼저 닫는다.
 * 모든 오버레이(z 200) 위에 뜬다.
 */
const ExitConfirmDialog = ({ onStay, onLeave }: ExitConfirmDialogProps) => {
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_EXIT, onEscape: onStay, role: 'alertdialog' });
    const leavingRef = useRef(false);
    const handleLeave = () => {
        if (leavingRef.current) return;
        leavingRef.current = true;
        onLeave();
    };

    return createPortal(
        <div
            {...dialog}
            data-testid="exit-confirm-dialog"
            className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <button type="button" aria-label={MSG.EXIT_CONFIRM_STAY} onClick={onStay} className="ae-scrim" />
            <section className="ae-sheet relative z-10 w-full max-w-[22rem] overflow-hidden">
                <div className="px-5 pb-4 pt-5">
                    <LogOut size={22} aria-hidden="true" className="text-ae-gold-text" />
                    <h2 className="mt-2 font-readable text-[17px] font-bold text-ae-ink">{MSG.EXIT_CONFIRM_TITLE}</h2>
                    <p className="mt-1.5 font-readable text-[13px] leading-relaxed text-ae-ink-2">{MSG.EXIT_CONFIRM_BODY}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                    <ActionButton
                        variant="ghost"
                        data-testid="exit-confirm-leave"
                        onClick={handleLeave}
                        label={MSG.EXIT_CONFIRM_LEAVE}
                    />
                    <ActionButton
                        variant="primary"
                        data-testid="exit-confirm-stay"
                        onClick={onStay}
                        label={MSG.EXIT_CONFIRM_STAY}
                    />
                </div>
            </section>
        </div>,
        document.body,
    );
};

export default ExitConfirmDialog;
