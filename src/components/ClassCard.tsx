import { motion as Motion } from 'framer-motion';
import { Check, ChevronRight, LockKeyhole } from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getClassIdentity } from '../utils/classPresentation';
import ClassIcon from './icons/ClassIcon';
import SignalBadge from './SignalBadge';

const TIER_LABELS: Record<number, string> = {
    0: MSG.CLASS_TIER_0,
    1: MSG.CLASS_TIER_1,
    2: MSG.CLASS_TIER_2,
    3: MSG.CLASS_TIER_3,
};

const TIER_TONES: Record<number, 'neutral' | 'recommended' | 'resonance' | 'upgrade'> = {
    0: 'neutral',
    1: 'recommended',
    2: 'resonance',
    3: 'upgrade',
};

interface ClassCardProps {
    jobName: string;
    onSelect: (jobName: string) => void;
    disabled: boolean;
    selected: boolean;
}

const ClassCard = ({ jobName, onSelect, disabled, selected }: ClassCardProps) => {
    const jobData = DB.CLASSES[jobName];
    if (!jobData) return null;

    const tier = jobData.tier || 0;
    const requirement = jobData.reqLv || 1;
    const identity = getClassIdentity(jobData.desc);
    return (
        <Motion.button
            type="button"
            data-testid="job-change-option"
            data-job-name={jobName}
            data-selected={selected ? 'true' : 'false'}
            data-locked={disabled ? 'true' : 'false'}
            whileTap={{ scale: 0.985 }}
            onClick={() => onSelect(jobName)}
            aria-pressed={selected}
            aria-label={`${jobName} 전직 미리보기${disabled ? `, 레벨 ${requirement} 필요` : ', 지금 가능'}`}
            className={`group relative min-h-[82px] w-full rounded-lg border px-2.5 py-2.5 text-left transition-colors ${
                selected
                    ? 'border-[#7dd4d8]/58 bg-[#7dd4d8]/12 shadow-[0_10px_24px_rgba(5,20,24,0.22)]'
                    : disabled
                        ? 'aether-locked-row border-white/8 hover:border-white/16'
                        : 'border-white/10 bg-black/14 hover:border-[#7dd4d8]/32 hover:bg-[#7dd4d8]/7'
            }`}
        >
            <div className="flex items-center gap-2">
                <ClassIcon className={jobName} size={28} tier={tier} />
                <div className="min-w-0 flex-1">
                    <div className="truncate font-readable text-base font-semibold text-white">{jobName}</div>
                    <div className="mt-0.5"><SignalBadge tone={TIER_TONES[tier]} size="sm">{TIER_LABELS[tier]}</SignalBadge></div>
                </div>
                <ChevronRight
                    size={14}
                    className={`shrink-0 transition-transform ${selected ? 'translate-x-0.5 text-[#dff7f5]' : 'text-slate-500'}`}
                />
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-white/7 pt-1.5">
                <span className="aether-type-meta min-w-0 truncate font-readable text-slate-300/76">{identity.focus}</span>
                <span className={`flex shrink-0 items-center gap-1 font-readable text-[11px] font-semibold ${
                    disabled ? 'aether-lock-note' : 'text-emerald-100'
                }`}>
                    {disabled ? <LockKeyhole size={11} /> : <Check size={12} />}
                    {disabled ? `레벨 ${requirement}` : '가능'}
                </span>
            </div>
        </Motion.button>
    );
};

export default ClassCard;
