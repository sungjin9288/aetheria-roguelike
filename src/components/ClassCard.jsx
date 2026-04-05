import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import ClassIcon from './icons/ClassIcon';
import SignalBadge from './SignalBadge';

const TIER_LABELS = { 0: MSG.CLASS_TIER_0, 1: MSG.CLASS_TIER_1, 2: MSG.CLASS_TIER_2, 3: MSG.CLASS_TIER_3 };
const TIER_TONES = { 0: 'neutral', 1: 'recommended', 2: 'resonance', 3: 'upgrade' };

const StatBar = ({ label, value, color }) => {
    // value는 modifier (1.0 = 기준, 2.0 = 100% width, 3.0 = clamped)
    const pct = Math.min(100, Math.max(8, (value / 3.0) * 100));
    return (
        <div className="flex items-center gap-1.5">
            <span className="w-7 text-[9px] font-fira text-slate-400/80 text-right shrink-0">{label}</span>
            <div className="flex-1 h-[5px] rounded-full bg-white/6 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            <span className="w-7 text-[9px] font-fira text-slate-300/80 text-right shrink-0">x{value}</span>
        </div>
    );
};

/**
 * ClassCard — 직업 선택 카드 (아이콘 + 스탯 바 + 설명)
 */
const ClassCard = ({ jobName, onSelect, disabled = false, compact = false }) => {
    const jobData = DB.CLASSES[jobName];
    if (!jobData) return null;

    const tier = jobData.tier || 0;
    const skillCount = jobData.skills?.filter(s => !s.passive)?.length || 0;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 rounded-[0.85rem] border px-2 py-2.5 min-h-[44px] ${disabled ? 'border-white/6 opacity-40' : 'border-white/10 bg-white/[0.03]'}`}>
                <ClassIcon className={jobName} size={22} tier={tier} />
                <span className="text-[11px] font-rajdhani font-bold text-slate-200">{jobName}</span>
                <SignalBadge tone={TIER_TONES[tier]} size="sm">{TIER_LABELS[tier]}</SignalBadge>
            </div>
        );
    }

    return (
        <Motion.button
            whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -2 }}
            whileTap={{ scale: disabled ? 1 : 0.97 }}
            onClick={() => !disabled && onSelect?.(jobName)}
            disabled={disabled}
            className={`group relative w-full sm:w-44 md:w-52 rounded-[1.15rem] border p-4 text-left transition-all ${
                disabled
                    ? 'border-white/6 bg-cyber-dark/60 opacity-35 cursor-not-allowed'
                    : 'border-cyber-purple/30 bg-cyber-dark/80 hover:border-cyber-purple/60 hover:bg-cyber-purple/8 hover:shadow-[0_0_24px_rgba(188,19,254,0.25)]'
            }`}
        >
            {/* 아이콘 + 이름 */}
            <div className="flex items-center gap-2.5 mb-3">
                <ClassIcon className={jobName} size={34} tier={tier} showBorder />
                <div className="min-w-0">
                    <div className="text-[1.1rem] font-rajdhani font-bold text-white group-hover:text-cyber-purple transition-colors truncate">
                        {jobName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <SignalBadge tone={TIER_TONES[tier]} size="sm">{TIER_LABELS[tier]}</SignalBadge>
                    </div>
                </div>
            </div>

            {/* 설명 */}
            <div className="text-[10px] font-fira text-slate-400/80 mb-3 line-clamp-2 leading-relaxed">
                {jobData.desc}
            </div>

            {/* 스탯 바 */}
            <div className="space-y-1.5 mb-3">
                <StatBar label={MSG.CLASS_STAT_HP} value={jobData.hpMod} color="#f87171" />
                <StatBar label={MSG.CLASS_STAT_MP} value={jobData.mpMod} color="#00ccff" />
                <StatBar label={MSG.CLASS_STAT_ATK} value={jobData.atkMod} color="#f59e0b" />
            </div>

            {/* 하단 정보 */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-fira text-slate-500">{skillCount} skills</span>
                <span className={`text-[10px] font-fira px-2 py-0.5 rounded-full border ${
                    disabled
                        ? 'border-white/8 text-slate-500 bg-black/20'
                        : 'border-cyber-blue/30 text-cyber-blue bg-cyber-blue/10'
                }`}>
                    {MSG.CLASS_REQ_LEVEL(jobData.reqLv || 1)}
                </span>
            </div>
        </Motion.button>
    );
};

export default ClassCard;
