import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { getJobSkills } from '../utils/gameUtils';
import SignalBadge from './SignalBadge';

const EFFECT_LABELS = {
    burn: '화상',
    bleed: '출혈',
    poison: '독',
    stun: '기절',
    freeze: '빙결',
    drain: '흡수',
    curse: '저주',
    fear: '공포',
    atk_up: 'ATK 버프',
    def_up: 'DEF 버프',
    all_up: 'ATK + DEF 버프',
    berserk: '광란',
    stealth: '은신',
};

const TYPE_TONE = {
    화염: 'warning',
    빛: 'upgrade',
    냉기: 'recommended',
    어둠: 'resonance',
    자연: 'success',
    대지: 'neutral',
    물리: 'neutral',
};

const SkillCard = ({ skill, cooldown = 0, selected = false, compact = false, summary = false }) => {
    const isOnCooldown = cooldown > 0;
    const tone = TYPE_TONE[skill.type] || 'neutral';

    return (
        <div
            className={`rounded-[1.05rem] border transition-all ${summary ? 'px-2.5 py-2' : compact ? 'px-2.5 py-2.5' : 'px-3 py-3'} ${
                selected
                    ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10 shadow-[0_16px_28px_rgba(125,212,216,0.08)]'
                    : 'border-white/8 bg-black/18'
            } ${isOnCooldown ? 'opacity-64' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-[1rem] font-rajdhani font-bold text-slate-100">
                            {skill.name}
                        </div>
                        {skill.type && <SignalBadge tone={tone} size="sm">{skill.type}</SignalBadge>}
                        {selected && <SignalBadge tone="recommended" size="sm">선택중</SignalBadge>}
                        {skill.fromWeapon && <SignalBadge tone="spotlight" size="sm">무기</SignalBadge>}
                        {skill.fromTrait && <SignalBadge tone="resonance" size="sm">성향</SignalBadge>}
                        {isOnCooldown && <SignalBadge tone="danger" size="sm">쿨타임 {cooldown}턴</SignalBadge>}
                    </div>

                    {!summary && (
                        <div className="mt-1 text-[11px] font-fira text-slate-300/78">
                            {skill.desc}
                        </div>
                    )}

                    {skill.effect && EFFECT_LABELS[skill.effect] && !summary && (
                        <div className="mt-2 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-500">
                            Effect
                            <span className="ml-2 text-slate-300/76 normal-case tracking-normal">{EFFECT_LABELS[skill.effect]}</span>
                        </div>
                    )}
                </div>

                <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/18 px-2 py-1 text-[10px] font-fira text-slate-200/82">
                        <Zap size={11} className="text-[#7dd4d8]" />
                        {skill.mp} MP
                    </div>
                    {skill.mult && (
                        <div className="mt-1 text-[10px] font-fira text-[#f6e7c8]/78">
                            x{skill.mult}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SkillTreePreview = ({ player, compact = false }) => {
    const [showAllSkills, setShowAllSkills] = useState(false);
    const [expandedJob, setExpandedJob] = useState(null);
    const currentClass = DB.CLASSES[player.job];
    const allCurrentSkills = getJobSkills(player);
    const selectedIndex = player.skillLoadout?.selected ?? 0;
    const cooldowns = player.skillLoadout?.cooldowns || {};

    if (!currentClass) return null;

    const nextJobs = currentClass.next || [];
    const selectedSkillName = allCurrentSkills[selectedIndex % Math.max(1, allCurrentSkills.length)]?.name || null;
    const visibleCurrentSkills = compact && !showAllSkills
        ? [...allCurrentSkills]
            .sort((a, b) => Number(b.name === selectedSkillName) - Number(a.name === selectedSkillName))
            .slice(0, 2)
        : allCurrentSkills;
    const hiddenSkillCount = Math.max(0, allCurrentSkills.length - visibleCurrentSkills.length);
    const showSkillSummary = compact && !showAllSkills;

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className={`rounded-[1.2rem] border border-white/8 bg-black/18 ${compact ? 'px-3 py-3' : 'px-4 py-3.5'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            Skill Ledger
                        </div>
                        <div className="mt-1 text-[1.05rem] font-rajdhani font-bold text-slate-100">
                            {player.job} 전투 스킬
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SignalBadge tone="neutral" size="sm">{allCurrentSkills?.length || 0} skills</SignalBadge>
                        {nextJobs.length > 0 && <SignalBadge tone="resonance" size="sm">next class {nextJobs.length}</SignalBadge>}
                        {compact && (hiddenSkillCount > 0 || nextJobs.length > 0) && (
                            <button
                                type="button"
                                onClick={() => setShowAllSkills((prev) => !prev)}
                                className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/78 hover:bg-white/[0.04]"
                            >
                                {showAllSkills ? '요약 보기' : '스킬 더 보기'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`rounded-[1.15rem] border border-white/8 bg-black/16 ${compact ? 'px-3 py-3' : 'px-4 py-3.5'}`}>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                    <Shield size={12} />
                    Current Loadout
                </div>
                <div className="space-y-2">
                    {visibleCurrentSkills?.map((skill) => (
                        <SkillCard
                            key={skill.name}
                            skill={skill}
                            selected={skill.name === selectedSkillName}
                            cooldown={cooldowns[skill.name] || 0}
                            compact={compact}
                            summary={showSkillSummary}
                        />
                    ))}
                </div>
            </div>

            {nextJobs.length > 0 && (
                showSkillSummary ? (
                    <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-3 py-3">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            <Sparkles size={12} />
                            Advancement Preview
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {nextJobs.slice(0, 2).map((jobName) => {
                                const jobData = DB.CLASSES[jobName];
                                if (!jobData) return null;
                                const meetsReq = player.level >= (jobData.reqLv || 0);
                                return (
                                    <div key={jobName} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                                        <div className={`text-[13px] font-rajdhani font-bold ${meetsReq ? 'text-[#e3dcff]' : 'text-slate-200/86'}`}>{jobName}</div>
                                        <div className="mt-1 text-[10px] font-fira text-slate-500">Lv.{jobData.reqLv} 필요</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            <Sparkles size={12} />
                            Advancement Preview
                        </div>

                        <div className="space-y-2">
                            {nextJobs.map((jobName) => {
                                const jobData = DB.CLASSES[jobName];
                                if (!jobData) return null;
                                const isOpen = expandedJob === jobName;
                                const meetsReq = player.level >= (jobData.reqLv || 0);

                                return (
                                    <div
                                        key={jobName}
                                        className={`rounded-[1rem] border transition-all ${
                                            isOpen
                                                ? 'border-[#9a8ac0]/24 bg-[#9a8ac0]/10'
                                                : 'border-white/8 bg-white/[0.03]'
                                        }`}
                                    >
                                        <button
                                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                                            onClick={() => setExpandedJob(isOpen ? null : jobName)}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`text-[1rem] font-rajdhani font-bold ${meetsReq ? 'text-[#e3dcff]' : 'text-slate-200/86'}`}>
                                                        {jobName}
                                                    </span>
                                                    <SignalBadge tone={meetsReq ? 'resonance' : 'neutral'} size="sm">
                                                        Lv.{jobData.reqLv}
                                                    </SignalBadge>
                                                </div>
                                                <div className="mt-1 text-[11px] font-fira text-slate-400/76">
                                                    {jobData.desc}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-slate-400">
                                                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isOpen && (
                                                <Motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-2 border-t border-white/8 px-3 pb-3 pt-3">
                                                        {jobData.skills?.map((skill) => (
                                                            <SkillCard key={skill.name} skill={skill} compact={compact} />
                                                        ))}
                                                    </div>
                                                </Motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default SkillTreePreview;
