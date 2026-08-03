import { motion as Motion } from 'framer-motion';
import { Check, ChevronRight, LockKeyhole, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { getActiveClassSkillNames, getClassIdentity } from '../utils/classPresentation';
import type { Player } from '../types/index.js';
import ClassIcon from './icons/ClassIcon';

interface ClassTreeProps {
    player: Player;
}

const ClassTree = ({ player }: ClassTreeProps) => {
    const currentName = player.job || '모험가';
    const currentClass = DB.CLASSES[currentName];
    const nextJobs = currentClass?.next || [];

    return (
        <section data-testid="class-growth-path" aria-labelledby="class-growth-path-title" className="border-t border-white/8 pt-4">
            <div className="flex items-start gap-2">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-[#d5b180]" />
                <div>
                    <h3 id="class-growth-path-title" className="aether-type-title font-readable font-semibold text-slate-100">전직 계보</h3>
                    <p className="aether-type-meta mt-0.5 font-readable text-slate-400/76">다음 전직 기술 미리보기</p>
                </div>
            </div>

            <div data-testid="class-growth-current" className="mt-3 flex items-center gap-2.5 border-y border-white/8 py-2.5">
                <ClassIcon className={currentName} size={30} tier={currentClass?.tier || 0} />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-meta font-readable text-[#7dd4d8]/78">현재 직업</div>
                    <div className="font-readable text-base font-semibold text-slate-100">{currentName}</div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-500" />
                <div className="aether-type-body shrink-0 font-readable text-slate-300/76">
                    {nextJobs.length > 0 ? `${nextJobs.length}가지 성장` : '최종 전직'}
                </div>
            </div>

            {nextJobs.length > 0 ? (
                <div className="mt-2 space-y-2">
                    {nextJobs.map((jobName, index) => {
                        const job = DB.CLASSES[jobName];
                        if (!job) return null;

                        const requirement = job.reqLv || 1;
                        const available = (player.level || 1) >= requirement;
                        const identity = getClassIdentity(job.desc);
                        const skills = getActiveClassSkillNames(job);

                        return (
                            <Motion.div
                                key={jobName}
                                data-testid="class-growth-option"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                                className="rounded-lg border border-white/8 bg-black/12 px-3 py-2.5"
                            >
                                <div className="flex items-start gap-2.5">
                                    <ClassIcon className={jobName} size={30} tier={job.tier || 0} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-readable text-sm font-semibold text-slate-100">{jobName}</span>
                                            <span className={`flex items-center gap-1 font-readable text-[11px] font-semibold ${available ? 'text-emerald-100' : 'aether-lock-note'}`}>
                                                {available ? <Check size={12} /> : <LockKeyhole size={11} />}
                                                {available ? '전직 가능' : `레벨 ${requirement}`}
                                            </span>
                                        </div>
                                        <div className="aether-type-body mt-1 font-readable text-slate-300/76">{identity.focus}</div>
                                        <div className="aether-type-meta mt-1.5 font-readable text-slate-400/76">
                                            대표 기술 · {skills.join(' · ') || '사용 기술 없음'}
                                        </div>
                                        <div className="aether-type-meta mt-1 font-readable text-slate-500">
                                            다음 계보 · {job.next?.length ? job.next.join(' 또는 ') : '이 길의 최종 전직'}
                                        </div>
                                    </div>
                                </div>
                            </Motion.div>
                        );
                    })}
                </div>
            ) : (
                <div data-testid="class-growth-complete" className="py-6 text-center font-readable">
                    <div className="text-sm font-semibold text-slate-100">최종 전직에 도달했습니다.</div>
                    <div className="aether-type-meta mt-1 text-slate-400/76">기술 성장과 장비 조화로 전투 방식을 완성하세요.</div>
                </div>
            )}
        </section>
    );
};

export default ClassTree;
