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
        <section data-testid="class-growth-path" aria-labelledby="class-growth-path-title" className="ae-card is-quiet p-3.5">
            <div className="flex items-start gap-2">
                <Sparkles size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-gold" />
                <div>
                    <h3 id="class-growth-path-title" className="aether-type-title font-readable font-semibold text-ae-ink">전직 계보</h3>
                    <p className="aether-type-meta mt-0.5 font-readable text-ae-ink-3">다음 전직 기술 미리보기</p>
                </div>
            </div>

            <div data-testid="class-growth-current" className="ae-well mt-3 flex items-center gap-2.5 px-3 py-2.5">
                <ClassIcon className={currentName} size={30} tier={currentClass?.tier || 0} />
                <div className="min-w-0 flex-1">
                    <div className="ae-eyebrow">현재 직업</div>
                    <div className="font-readable text-base font-semibold text-ae-ink">{currentName}</div>
                </div>
                <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ae-ink-3" />
                <div className="aether-type-body shrink-0 font-readable text-ae-ink-2">
                    {nextJobs.length > 0 ? `${nextJobs.length}가지 성장` : '최종 전직'}
                </div>
            </div>

            {nextJobs.length > 0 ? (
                <div className="ae-rows mt-1">
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: Math.min(index, 6) * 0.03, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                                className="py-3"
                            >
                                <div className="flex items-start gap-2.5">
                                    <ClassIcon className={jobName} size={30} tier={job.tier || 0} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-readable text-[15px] font-semibold text-ae-ink">{jobName}</span>
                                            <span className={`flex items-center gap-1 font-readable text-[11px] font-semibold ${available ? 'text-ae-good' : 'aether-lock-note'}`}>
                                                {available ? <Check size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}
                                                {available ? '전직 가능' : `레벨 ${requirement}`}
                                            </span>
                                        </div>
                                        <div className="aether-type-body mt-1 font-readable text-ae-ink-2">{identity.focus}</div>
                                        <div className="aether-type-meta mt-1.5 font-readable text-ae-ink-3">
                                            대표 기술 · {skills.join(' · ') || '사용 기술 없음'}
                                        </div>
                                        <div className="aether-type-meta mt-1 font-readable text-ae-ink-3">
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
                    <div className="text-sm font-semibold text-ae-ink">최종 전직에 도달했습니다.</div>
                    <div className="aether-type-meta mt-1 text-ae-ink-3">기술 성장과 장비 조화로 전투 방식을 완성하세요.</div>
                </div>
            )}
        </section>
    );
};

export default ClassTree;
