import { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { DB } from '../../data/db';
import type { Player } from '../../types/index.js';
import { MSG } from '../../data/messages';
import {
  getActiveClassSkillNames,
  getClassIdentity,
  getClassStatGrade,
  getClassTraitLabels,
} from '../../utils/classPresentation';
import ClassCard from '../ClassCard';
import ClassIcon from '../icons/ClassIcon';
import FocusPanelHeader from '../FocusPanelHeader';
import PixelCharacterAvatar from '../PixelCharacterAvatar';
import ClassJourneySummary from '../ClassJourneySummary';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import type { GameMode } from '../../reducers/gameStates';

interface JobChangeActions {
  jobChange: (jobName: string) => void;
}

interface JobChangePanelProps {
  player: Player;
  actions?: JobChangeActions;
  setGameState?: (state: GameMode) => void;
  onOpenArchiveConsole?: () => void;
}

const StatSummary = ({ label, value }: { label: string; value?: number }) => (
  <div className="ae-job-stat min-w-0 px-2.5 py-2">
    <div className="aether-type-meta font-readable text-ae-ink-3">{label}</div>
    <div className="aether-type-body mt-0.5 font-readable font-semibold text-ae-ink">
      {getClassStatGrade(value)}
    </div>
  </div>
);

const TraitRow = ({ label, traits, tone, testId }: { label: string; traits: string[]; tone: 'strength' | 'weakness'; testId: string }) => (
  <div data-testid={testId} className="flex min-w-0 flex-wrap items-center gap-1.5">
    <span className="aether-type-meta w-8 shrink-0 font-readable text-ae-ink-3">{label}</span>
    {traits.map((trait) => (
      <Chip key={trait} tone={tone === 'strength' ? 'good' : 'threat'}>
        {trait}
      </Chip>
    ))}
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
  const traitLabels = getClassTraitLabels(selected);
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
      className="ae-job-panel aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4"
    >
      <FocusPanelHeader
        eyebrow="성장 갈림길"
        title="전직 선택"
        meta={`현재 직업 ${currentJob} · ${availableJobs.length}가지 선택`}
        onBack={() => setGameState?.('idle')}
        backLabel={MSG.UI_BACK}
        backTestId="job-change-close"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="job-change-open-archive"
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        <div
          data-testid="job-change-current"
          className="ae-well mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2.5"
        >
          <ClassIcon className={currentJob} size={34} tier={current?.tier || 0} />
          <div className="min-w-0 flex-1">
            <div className="aether-type-meta font-readable text-ae-ink-3">현재 직업</div>
            <div className="aether-type-title break-keep font-readable font-semibold text-ae-ink">{currentJob}</div>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <div className="aether-type-meta font-readable text-ae-ink-3">레벨 <span className="font-fira tabular-nums">{level}</span></div>
            <div className={`aether-type-body mt-0.5 font-readable font-semibold ${readyCount > 0 ? 'text-ae-good' : 'text-ae-ether-hi'}`}>
              {growthStatus}
            </div>
          </div>
        </div>

        {availableJobs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section aria-labelledby="job-change-options-title">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="aether-type-meta font-readable text-ae-ink-3">다음 성장</div>
                  <h3 id="job-change-options-title" className="aether-type-title mt-0.5 font-readable font-semibold text-ae-ink">
                    어떤 방식으로 싸울까?
                  </h3>
                </div>
                <span className="aether-type-meta shrink-0 font-readable text-ae-ink-3">{availableJobs.length}가지 선택</span>
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
                  className="ae-card ae-job-decision p-3 sm:p-3.5"
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
                      <div className="ae-eyebrow">선택한 성장</div>
                      <h3 className="aether-type-heading break-keep font-readable font-semibold text-ae-ink">{selectedName}</h3>
                      <p
                        data-testid="job-change-selected-identity"
                        className="aether-type-body mt-0.5 font-readable leading-snug text-ae-ink-2"
                      >
                        {identity.identity}
                      </p>
                    </div>
                    <div className={`ae-job-option-status aether-type-label flex shrink-0 items-center gap-1 font-readable font-semibold ${selectedIsLocked ? 'aether-lock-note' : 'text-ae-good'}`}>
                      {selectedIsLocked ? <LockKeyhole size={12} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                      {selectedIsLocked ? `레벨 ${requirement}` : '준비 완료'}
                    </div>
                  </div>

                  <div className="ae-well ae-job-stats mt-3 grid grid-cols-3 p-0">
                    <StatSummary label="생명" value={selected.hpMod} />
                    <StatSummary label="기력" value={selected.mpMod} />
                    <StatSummary label="공격력" value={selected.atkMod} />
                  </div>

                  {(traitLabels.strengths.length > 0 || traitLabels.weaknesses.length > 0) && (
                    <div data-testid="job-change-traits" className="mt-2.5 space-y-1.5">
                      <TraitRow label={MSG.CLASS_TRAIT_STRENGTHS} traits={traitLabels.strengths} tone="strength" testId="job-change-strengths" />
                      <TraitRow label={MSG.CLASS_TRAIT_WEAKNESSES} traits={traitLabels.weaknesses} tone="weakness" testId="job-change-weaknesses" />
                    </div>
                  )}

                  <div className="mt-3 space-y-2 font-readable">
                    <div>
                      <div className="aether-type-meta text-ae-ink-3">대표 기술</div>
                      <div className="aether-type-body mt-0.5 text-ae-ink">
                        {featuredSkills.join(' · ') || '사용 기술 없음'}
                      </div>
                      <div className="aether-type-meta mt-0.5 text-ae-ink-3">사용 기술 <span className="font-fira tabular-nums">{getActiveClassSkillNames(selected, Number.POSITIVE_INFINITY).length}</span>개</div>
                    </div>
                    <ClassJourneySummary
                      job={selectedName}
                      record={player.classJourney?.byJob[selectedName]}
                    />
                    <div>
                      <div className="aether-type-meta text-ae-ink-3">다음 계보</div>
                      <div className="aether-type-body mt-0.5 text-ae-ink">
                        {selected.next?.length ? selected.next.join(' 또는 ') : '이 길의 최종 전직'}
                      </div>
                    </div>
                  </div>

                  <div className="ae-divider mt-3" aria-hidden="true" />
                  <div className="aether-type-meta mt-3 flex items-start gap-2 font-readable leading-relaxed text-ae-ink-2">
                    <Sparkles size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-gold-text" />
                    <span>전직하면 생명과 기력이 모두 회복되고, 기술 구성이 {selectedName}에 맞게 바뀝니다.</span>
                  </div>

                  <ActionButton
                    variant="primary"
                    data-testid="job-change-confirm"
                    onClick={() => !selectedIsLocked && actions?.jobChange(selectedName)}
                    disabled={selectedIsLocked}
                    icon={selectedIsLocked ? <LockKeyhole size={15} /> : <ArrowRight size={15} />}
                    label={selectedIsLocked ? <>레벨 {requirement}에 전직 가능</> : MSG.JOB_CHANGE_CONFIRM(selectedName)}
                    className="mt-3 min-h-[48px] w-full font-readable"
                  />
                </Motion.section>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div data-testid="job-change-complete" className="py-10 text-center font-readable">
            <Sparkles size={24} aria-hidden="true" className="mx-auto text-ae-gold-text" />
            <div className="aether-type-title mt-3 font-semibold text-ae-ink">최종 전직에 도달했습니다.</div>
            <div className="aether-type-body mt-1 text-ae-ink-2">이제 기술 성장과 장비 조화로 자신만의 전투를 완성하세요.</div>
          </div>
        )}
      </div>
    </Motion.div>
  );
};

export default JobChangePanel;
