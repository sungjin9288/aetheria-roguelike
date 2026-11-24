import { createPortal } from 'react-dom';
import { LogOut } from 'lucide-react';
import { MSG } from '../../data/messages';
import { useOverlayDialog } from '../../hooks/useOverlayDialog';
import { usePlatformBackHandler } from '../../platform/platformBackRegistry';
import ActionButton from '../ui/ActionButton';

interface DailyTrialLeaveDialogProps {
    onStay: () => void;
    onLeave: () => void;
}

/** 시련을 그만두기 전에 묻는다 — 이 판은 끝나고 최고 기록에 들지 않는다(도전 수만 는다). */
const DailyTrialLeaveDialog = ({ onStay, onLeave }: DailyTrialLeaveDialogProps) => {
    const dialog = useOverlayDialog({ label: MSG.DAILY_TRIAL_LEAVE_TITLE, onEscape: onStay, role: 'alertdialog' });
    usePlatformBackHandler(true, onStay, 60);

    return createPortal(
        <div
            {...dialog}
            data-testid="daily-trial-leave-dialog"
            className="fixed inset-0 z-[205] flex items-center justify-center px-4 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <button type="button" aria-label={MSG.DAILY_TRIAL_LEAVE_CLOSE_ARIA} onClick={onStay} className="ae-scrim" />
            <section className="ae-sheet relative z-10 w-full max-w-[22rem] overflow-hidden">
                <div className="px-5 pb-4 pt-5">
                    <LogOut size={22} aria-hidden="true" className="text-ae-threat" />
                    <h2 className="mt-2 font-readable text-[17px] font-bold text-ae-ink">{MSG.DAILY_TRIAL_LEAVE_TITLE}</h2>
                    <p className="mt-1.5 font-readable text-[13px] leading-relaxed text-ae-ink-2">{MSG.DAILY_TRIAL_LEAVE_BODY}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                    <ActionButton variant="danger" data-testid="daily-trial-leave-confirm" onClick={onLeave} label={MSG.DAILY_TRIAL_LEAVE_CONFIRM} />
                    <ActionButton variant="primary" data-testid="daily-trial-leave-stay" onClick={onStay} label={MSG.DAILY_TRIAL_LEAVE_CANCEL} />
                </div>
            </section>
        </div>,
        document.body,
    );
};

export default DailyTrialLeaveDialog;
