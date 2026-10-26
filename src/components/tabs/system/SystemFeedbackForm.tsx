import { Send } from 'lucide-react';
import { MSG } from '../../../data/messages';
import ActionButton from '../../ui/ActionButton';

export interface SystemNotice {
    type: 'success' | 'error';
    text: string;
}

interface SystemFeedbackFormProps {
    value: string;
    status: SystemNotice | null;
    onChange: (value: string) => void;
    onSubmit: () => void;
}

/** 의견 보내기 입력 — 전송(Firestore 쓰기)은 부르는 쪽이 소유한다. */
const SystemFeedbackForm = ({ value, status, onChange, onSubmit }: SystemFeedbackFormProps) => (
    <div className="space-y-2">
        {status && (
            <div role="status" className={`ab-notice font-readable ${status.type === 'error' ? 'is-threat' : 'is-good'}`}>
                {status.text}
            </div>
        )}
        <textarea
            aria-label={MSG.SYSTEM_FEEDBACK_ARIA}
            placeholder={MSG.SYSTEM_FEEDBACK_PLACEHOLDER}
            className="ab-field h-28 resize-none p-3 font-readable aether-type-body"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={500}
        />
        <ActionButton
            variant="glass"
            icon={<Send size={16} />}
            label={MSG.SYSTEM_FEEDBACK_SEND}
            onClick={onSubmit}
            className="w-full"
        />
    </div>
);

export default SystemFeedbackForm;
