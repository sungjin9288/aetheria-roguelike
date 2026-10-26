import { motion as Motion } from 'framer-motion';
import { Check, LockKeyhole } from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getClassIdentity } from '../utils/classPresentation';
import ClassIcon from './icons/ClassIcon';
import Chip, { type ChipTone } from './ui/Chip';

const TIER_LABELS: Record<number, string> = {
    0: MSG.CLASS_TIER_0,
    1: MSG.CLASS_TIER_1,
    2: MSG.CLASS_TIER_2,
    3: MSG.CLASS_TIER_3,
};

// 단계 칩 — 기본은 중립, 1차 에테르, 2차 금, 3차 금(보상 색). 희귀 등급 색은 아이템 등급의 것이라 쓰지 않는다.
const TIER_TONES: Record<number, ChipTone> = {
    0: 'neutral',
    1: 'ether',
    2: 'gold',
    3: 'gold',
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
            aria-label={MSG.JOB_CHANGE_OPTION_LABEL(jobName, disabled ? requirement : null)}
            className={`ae-card ae-job-option group relative grid min-h-[82px] w-full gap-2 p-2.5 text-left${
                disabled ? ' aether-locked-row' : ''
            }`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <ClassIcon className={jobName} size={28} tier={tier} />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-strong break-keep font-readable font-semibold text-ae-ink">{jobName}</div>
                    <Chip tone={TIER_TONES[tier]} className="mt-1">{TIER_LABELS[tier]}</Chip>
                </div>
            </div>
            <div className="ae-divider" aria-hidden="true" />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="aether-type-meta min-w-0 font-readable text-ae-ink-2">{identity.focus}</span>
                <span className={`ae-job-option-status aether-type-label flex shrink-0 items-center gap-1 font-readable font-semibold ${
                    disabled ? 'aether-lock-note' : 'text-ae-good'
                }`}>
                    {disabled ? <LockKeyhole size={11} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
                    {disabled ? MSG.JOB_CHANGE_LEVEL_SHORT(requirement) : MSG.JOB_CHANGE_READY_SHORT}
                </span>
            </div>
        </Motion.button>
    );
};

export default ClassCard;
