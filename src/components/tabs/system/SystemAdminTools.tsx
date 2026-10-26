import { Megaphone, SlidersHorizontal } from 'lucide-react';
import { MSG } from '../../../data/messages';
import ActionButton from '../../ui/ActionButton';

interface SystemAdminToolsProps {
    onSetMultiplier: () => void;
    onBroadcast: () => void;
}

/** 운영 설정 단추 — 권한 확인과 Firestore 쓰기는 부르는 쪽이 소유한다. */
const SystemAdminTools = ({ onSetMultiplier, onBroadcast }: SystemAdminToolsProps) => (
    <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="danger" icon={<SlidersHorizontal size={16} />} label={MSG.SYSTEM_ADMIN_MULTIPLIER} onClick={onSetMultiplier} />
        <ActionButton variant="danger" icon={<Megaphone size={16} />} label={MSG.SYSTEM_ADMIN_BROADCAST} onClick={onBroadcast} />
    </div>
);

export default SystemAdminTools;
