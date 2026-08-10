import { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { DB } from '../../data/db';
import type { Player } from '../../types/index.js';
import {
  getActiveClassSkillNames,
  getClassIdentity,
  getClassStatGrade,
} from '../../utils/classPresentation';
import ClassCard from '../ClassCard';
import ClassIcon from '../icons/ClassIcon';
import FocusPanelHeader from '../FocusPanelHeader';
import PixelCharacterAvatar from '../PixelCharacterAvatar';
import ClassJourneySummary from '../ClassJourneySummary';

interface JobChangeActions {
  jobChange: (jobName: string) => void;
}

interface JobChangePanelProps {
  player: Player;
  actions?: JobChangeActions;
  setGameState?: (state: string) => void;
  onOpenArchiveConsole?: () => void;
}

const StatSummary = ({ label, value }: { label: string; value?: number }) => (
  <div className="min-w-0 flex-1 px-2 first:pl-0 last:pr-0">
    <div className="aether-type-meta font-readable text-slate-400/76">{label}</div>
    <div className="aether-type-body mt-0.5 font-readable font-semibold text-slate-100">
      {getClassStatGrade(value)}
    </div>
  </div>
);

const JobChangePanel = ({ player, actions, setGameState, onOpenArchiveConsole }: JobChangePanelProps) => {
  const currentJob = player.job || '모험가';
  const current = DB.CLASSES[currentJob];
  const availableJobs = current?.next || [];
  const level = player.level || 1;
  const [selectedJobName, setSelectedJobName] = useState(() => availableJobs[0] || '');
  const selectedName = availableJobs.includes(selectedJobName) ? selectedJobName : availableJobs[0];
  const selected = selectedName ? DB.CLASSES[selectedName] : undefined;
  const requirement = selected?.reqLv || 1;
  const selectedIsLocked = level < requirement;
  const identity = getClassIdentity(selected?.desc);
  const featuredSkills = getActiveClassSkillNames(selected);
  const readyCount = availableJobs.filter((jobName) => level >= (DB.CLASSES[jobName]?.reqLv || 1)).length;
  const nextLevel = availableJobs.length > 0
    ? Math.min(...availableJobs.map((jobName) => DB.CLASSES[jobName]?.reqLv || Number.POSITIVE_INFINITY))
    : null;
  const growthStatus = readyCount > 0
    ? `${readyCount}가지 전직 가능`
    : nextLevel && Number.isFinite(nextLevel)
      ? `레벨 ${nextLevel}에 다음 전직`
      : '모든 성장 완료';

  return (
    <Motion.div
      data-testid="job-change-panel"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      className="panel-noise aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden border border-[#9a8ac0]/18 px-4 py-4 shadow-[0_24px_48px_rgba(9,12,18,0.24)]"
    >
      <FocusPanelHeader
        eyebrow="성장 갈림길"
        title="전직 선택"
        meta={`현재 직업 ${currentJob} · ${availableJobs.length}가지 선택`}
        onBack={() => setGameState?.('idle')}
        backLabel="복귀"
        backTestId="job-change-close"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="job-change-open-archive"
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        <div
          data-testid="job-change-current"
          className="mb-3 flex items-center gap-2.5 border-b border-white/8 pb-3"
        >
          <ClassIcon className={currentJob} size={34} tier={current?.tier || 0} />
          <div className="min-w-0 flex-1">
            <div className="aether-type-meta font-readable text-slate-400/76">현재 직업</div>
            <div className="truncate font-readable text-lg font-semibold text-white">{currentJob}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="aether-type-meta font-readable text-slate-400/76">레벨 {level}</div>
            <div className={`aether-type-body mt-0.5 font-readable font-semibold ${readyCount > 0 ? 'text-emerald-100' : 'text-[#dff7f5]'}`}>
              {growthStatus}
            </div>
          </div>
        </div>

        {availableJobs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section aria-labelledby="job-change-options-title">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="aether-type-meta font-readable text-slate-400/76">다음 성장</div>
                  <h3 id="job-change-options-title" className="aether-type-title mt-0.5 font-readable font-semibold text-slate-100">
                    어떤 방식으로 싸울까?
                  </h3>
                </div>
                <span className="aether-type-meta shrink-0 font-readable text-slate-400">{availableJobs.length}가지 선택</span>
              </div>
              <div data-testid="job-change-options" className="grid grid-cols-2 gap-2">
                {availableJobs.map((jobName) => (
                  <ClassCard
                    key={jobName}
                    jobName={jobName}
                    onSelect={setSelectedJobName}
                    disabled={level < (DB.CLASSES[jobName]?.reqLv || 1)}
                    selected={selectedName === jobName}
                  />
                ))}
              </div>
            </section>

            <AnimatePresence mode="wait" initial={false}>
              {selected && selectedName && (
                <Motion.section
                  key={selectedName}
                  data-testid="job-change-decision"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-lg border border-[#7dd4d8]/20 bg-black/16 p-3"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-2.5">
                    <PixelCharacterAvatar
                      player={player}
                      appearance={{ job: selectedName }}
                      size="sm"
                      className="shrink-0"
                      showEnhanceBadge={false}
                      dataTestId="job-change-selected-avatar"
                      label={`${selectedName} 대표 외형`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="aether-type-meta font-readable text-[#7dd4d8]/82">선택한 성장</div>
                      <h3 className="font-readable text-lg font-semibold text-white">{selectedName}</h3>
                      <p
                        data-testid="job-change-selected-identity"
                        className="aether-type-body mt-0.5 font-readable leading-snug text-slate-300/82"
                      >
                        {identity.identity}
                      </p>
                    </div>
                    <div className={`flex shrink-0 items-center gap-1 font-readable text-[11px] font-semibold ${selectedIsLocked ? 'aether-lock-note' : 'text-emerald-100'}`}>
                      {selectedIsLocked ? <LockKeyhole size={12} /> : <Check size={13} />}
                      {selectedIsLocked ? `레벨 ${requirement}` : '준비 완료'}
                    </div>
                  </div>

                  <div className="mt-3 flex divide-x divide-white/8 border-y border-white/8 py-2.5">
                    <StatSummary label="생명" value={selected.hpMod} />
                    <StatSummary label="기력" value={selected.mpMod} />
                    <StatSummary label="공격력" value={selected.atkMod} />
                  </div>

                  <div className="mt-3 space-y-2 font-readable">
                    <div>
                      <div className="aether-type-meta text-slate-400/76">대표 기술</div>
                      <div className="aether-type-body mt-0.5 text-slate-100">
                        {featuredSkills.join(' · ') || '사용 기술 없음'}
                      </div>
                      <div className="aether-type-meta mt-0.5 text-slate-400">사용 기술 {getActiveClassSkillNames(selected, Number.POSITIVE_INFINITY).length}개</div>
                    </div>
                    <ClassJourneySummary
                      job={selectedName}
                      record={player.classJourney?.byJob[selectedName]}
                    />
                    <div>
                      <div className="aether-type-meta text-slate-400/76">다음 계보</div>
                      <div className="aether-type-body mt-0.5 text-slate-100">
                        {selected.next?.length ? selected.next.join(' 또는 ') : '이 길의 최종 전직'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2 border-t border-white/8 pt-3 font-readable text-[11px] leading-relaxed text-slate-300/76">
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-[#d5b180]" />
                    <span>전직하면 생명과 기력이 모두 회복되고, 기술 구성이 {selectedName}에 맞게 바뀝니다.</span>
                  </div>

                  <button
                    type="button"
                    data-testid="job-change-confirm"
                    onClick={() => !selectedIsLocked && actions?.jobChange(selectedName)}
                    disabled={selectedIsLocked}
                    className="aether-cta-primary aether-disabled-action aether-type-body mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-4 font-readable font-semibold text-[#dff7f5] disabled:cursor-not-allowed"
                  >
                    {selectedIsLocked ? (
                      <><LockKeyhole size={15} />레벨 {requirement}에 전직 가능</>
                    ) : (
                      <>{selectedName}로 전직 <ArrowRight size={15} /></>
                    )}
                  </button>
                </Motion.section>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div data-testid="job-change-complete" className="py-10 text-center font-readable">
            <Sparkles size={24} className="mx-auto text-[#d5b180]" />
            <div className="mt-3 text-base font-semibold text-slate-100">최종 전직에 도달했습니다.</div>
            <div className="aether-type-body mt-1 text-slate-400">이제 기술 성장과 장비 조화로 자신만의 전투를 완성하세요.</div>
          </div>
        )}
      </div>
    </Motion.div>
  );
};

export default JobChangePanel;
