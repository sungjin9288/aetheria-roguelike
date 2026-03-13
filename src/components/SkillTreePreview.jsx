import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { DB } from '../data/db';
import { getJobSkills } from '../utils/gameUtils';

/**
 * SkillTreePreview — 현재 직업 스킬 목록 시각화 + 직업 선택 전 스킬 미리보기 (Feature #4)
 */

const EFFECT_LABELS = {
    burn: '🔥 화상',
    bleed: '💉 출혈',
    poison: '☠️ 독',
    stun: '⚡ 기절',
    freeze: '❄️ 빙결',
    drain: '🩸 흡수',
    curse: '💀 저주',
    fear: '😱 공포',
    atk_up: '⬆️ ATK 버프',
    def_up: '🛡️ DEF 버프',
    all_up: '✨ ATK+DEF 버프',
    berserk: '😤 광란',
    stealth: '🌙 은신',
};

const SkillCard = ({ skill, cooldown = 0, selected = false }) => {
    const isOnCooldown = cooldown > 0;
    const elem = { '화염': '🔥', '빛': '⚡', '냉기': '❄️', '어둠': '🌑', '자연': '🍃', '대지': '🌍', '물리': '⚔️' }[skill.type] || '';

    return (
        <div className={`p-3 rounded border transition-all
            ${selected
                ? 'border-cyber-blue/60 bg-cyber-blue/10 shadow-[0_0_10px_rgba(0,204,255,0.2)]'
                : 'border-cyber-blue/10 bg-cyber-dark/20'
            }
            ${isOnCooldown ? 'opacity-50' : ''}
        `}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-rajdhani font-bold text-cyber-blue">
                            {elem} {skill.name}
                        </span>
                        {selected && <span className="text-[10px] text-cyber-green border border-cyber-green/30 px-1 rounded">선택됨</span>}
                        {skill.fromWeapon && <span className="text-[10px] text-cyber-purple border border-cyber-purple/30 px-1 rounded">무기 생성</span>}
                        {skill.fromTrait && <span className="text-[10px] text-amber-300 border border-amber-500/30 px-1 rounded">성향</span>}
                        {isOnCooldown && <span className="text-[10px] text-red-400 font-fira">쿨타임 {cooldown}턴</span>}
                    </div>
                    <div className="text-cyber-blue/50 text-xs font-fira mt-0.5">{skill.desc}</div>
                    {skill.effect && EFFECT_LABELS[skill.effect] && (
                        <div className="text-xs text-cyber-purple/70 mt-1">{EFFECT_LABELS[skill.effect]}</div>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xs text-blue-400 font-fira"><Zap size={11} className="inline" /> {skill.mp}MP</div>
                    {skill.mult && <div className="text-xs text-yellow-400/70 font-fira">x{skill.mult}</div>}
                </div>
            </div>
        </div>
    );
};

const SkillTreePreview = ({ player }) => {
    const [expandedJob, setExpandedJob] = useState(null);
    const currentClass = DB.CLASSES[player.job];
    const allCurrentSkills = getJobSkills(player);
    const selectedIndex = player.skillLoadout?.selected ?? 0;
    const cooldowns = player.skillLoadout?.cooldowns || {};

    if (!currentClass) return null;

    const nextJobs = currentClass.next || [];

    return (
        <div className="space-y-4">
            {/* Current Job Skills */}
            <div>
                <div className="text-cyber-blue/50 text-xs font-fira mb-2 tracking-widest flex items-center gap-1">
                    <Shield size={12} /> 현재 직업 스킬 — {player.job}
                </div>
                <div className="space-y-2">
                    {allCurrentSkills?.map((skill, i) => (
                        <SkillCard
                            key={skill.name}
                            skill={skill}
                            selected={i === (selectedIndex % Math.max(1, allCurrentSkills.length))}
                            cooldown={cooldowns[skill.name] || 0}
                        />
                    ))}
                </div>
            </div>

            {/* Class Advancement Preview */}
            {nextJobs.length > 0 && (
                <div>
                    <div className="text-cyber-purple/60 text-xs font-fira mb-2 tracking-widest flex items-center gap-1">
                        <ChevronRight size={12} /> 전직 가능 (미리보기)
                    </div>
                    <div className="space-y-2">
                        {nextJobs.map((jobName) => {
                            const jobData = DB.CLASSES[jobName];
                            if (!jobData) return null;
                            const isOpen = expandedJob === jobName;
                            const meetsReq = player.level >= (jobData.reqLv || 0);

                            return (
                                <div key={jobName} className={`rounded border transition-all ${meetsReq ? 'border-cyber-purple/30' : 'border-cyber-blue/10'}`}>
                                    <button
                                        className={`w-full flex items-center justify-between p-3 text-left ${meetsReq ? 'text-cyber-purple' : 'text-cyber-blue/30'}`}
                                        onClick={() => setExpandedJob(isOpen ? null : jobName)}
                                    >
                                        <div>
                                            <span className="font-rajdhani font-bold text-sm">{jobName}</span>
                                            <span className="text-xs ml-2 opacity-60 font-fira">Lv.{jobData.reqLv} / {jobData.desc}</span>
                                        </div>
                                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    <AnimatePresence>
                                        {isOpen && (
                                            <Motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-3 pb-3 space-y-2 border-t border-cyber-purple/10 pt-2">
                                                    {jobData.skills?.map(skill => (
                                                        <SkillCard key={skill.name} skill={skill} />
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
            )}
        </div>
    );
};

export default SkillTreePreview;
