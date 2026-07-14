import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import ClassIcon from './icons/ClassIcon';
import SignalBadge from './SignalBadge';

const TIER_LABELS: any = { 0: MSG.CLASS_TIER_0, 1: MSG.CLASS_TIER_1, 2: MSG.CLASS_TIER_2, 3: MSG.CLASS_TIER_3 };
const TIER_TONES: any = { 0: 'neutral', 1: 'recommended', 2: 'resonance', 3: 'upgrade' };

const getStatGrade = (value: number) => {
    if (value < 0.8) return '낮음';
    if (value < 1.15) return '보통';
    if (value < 1.5) return '높음';
    return '매우 높음';
};

const StatBar = ({ label, value, color }: any) => {
    const pct = Math.min(100, Math.max(15, 15 + ((value - 0.5) / 1.5) * 85));
    return (
        <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-readable text-[11px] text-slate-300/76">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            <span className="w-[3.8rem] shrink-0 text-right font-readable text-[11px] text-slate-200/82">
                {getStatGrade(value)}
            </span>
        </div>
    );
};

/**
 * ClassCard — 직업 선택 카드 (아이콘 + 스탯 바 + 설명)
 *
 * cycle 461: compact prop / if (compact) 9줄 분기 제거 — JobChangePanel 1 callsite
 *   compact 전달 0건 (caller 0이라 항상 false). cycle 458/459 unreachable lens 회귀.
 */
// cycle 582: disabled default false 제거 — 1 production caller (JobChangePanel
//   :51) disabled={player.level < ...} 명시 전달이라 default 도달 불가.
//   청소 메가 시리즈 73번째.
const ClassCard = ({ jobName, onSelect, disabled }: any) => {
    const jobData = DB.CLASSES[jobName];
    if (!jobData) return null;

    const tier = jobData.tier || 0;
    const activeSkills = jobData.skills?.filter((skill: any) => !skill.passive) || [];
    const featuredSkills = activeSkills.slice(0, 2).map((skill: any) => skill.name).join(' · ');
    const reqLv = jobData.reqLv || 1;

    return (
        <Motion.button
            data-testid="job-change-option"
            whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -1 }}
            whileTap={{ scale: disabled ? 1 : 0.97 }}
            onClick={() => !disabled && onSelect?.(jobName)}
            disabled={disabled}
            aria-label={`${jobName} 전직 ${disabled ? `잠금, 레벨 ${reqLv} 필요` : '가능'}`}
            className={`group relative w-full rounded-[1rem] border px-3.5 py-3 text-left transition-all ${
                disabled
                    ? 'aether-locked-row cursor-not-allowed'
                    : 'border-[#7dd4d8]/22 bg-black/18 hover:border-[#7dd4d8]/40 hover:bg-[#7dd4d8]/8 hover:shadow-[0_14px_28px_rgba(5,20,24,0.24)]'
            }`}
        >
            <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <ClassIcon className={jobName} size={28} tier={tier} />
                    <div className="min-w-0">
                        <div className="truncate font-rajdhani text-[17px] font-bold text-white transition-colors group-hover:text-[#dff7f5]">
                            {jobName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <SignalBadge tone={TIER_TONES[tier]} size="sm">{TIER_LABELS[tier]}</SignalBadge>
                        </div>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 font-readable text-[11px] ${
                    disabled
                        ? 'aether-lock-note'
                        : 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100'
                }`}>
                    {disabled ? `레벨 ${reqLv} 필요` : '전직 가능'}
                </span>
            </div>

            <div className="mb-2.5 text-[12px] leading-snug text-slate-300/76">
                {jobData.desc}
            </div>

            <div className="mb-2.5 space-y-1.5">
                <StatBar label={MSG.CLASS_STAT_HP} value={jobData.hpMod} color="#f87171" />
                <StatBar label={MSG.CLASS_STAT_MP} value={jobData.mpMod} color="#00ccff" />
                <StatBar label={MSG.CLASS_STAT_ATK} value={jobData.atkMod} color="#f59e0b" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/8 pt-2">
                <span className="font-readable text-[11px] text-slate-300/76">
                    대표 기술 · {featuredSkills || '없음'}
                </span>
                <span className="font-readable text-[11px] text-slate-400/72">
                    사용 기술 {activeSkills.length}개
                </span>
            </div>
        </Motion.button>
    );
};

export default ClassCard;
