import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../../data/db';
import ClassCard from '../ClassCard';
import ClassIcon from '../icons/ClassIcon';
import FocusPanelHeader from '../FocusPanelHeader';

/**
 * JobChangePanel — 전직 선택 패널
 */
const JobChangePanel = ({ player, actions, setGameState, onOpenArchiveConsole = null }: any) => {
  const current = DB.CLASSES[player.job];
  const avail = current?.next || [];

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] border border-[#9a8ac0]/18 px-4 py-4 shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-2xl"
    >
      <FocusPanelHeader
        eyebrow="Class Circuit"
        title="Class Advancement"
        meta={`현재 ${player.job} · 다음 전직 ${avail.length || 0}개`}
        onBack={() => setGameState('idle')}
        backLabel="복귀"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="INV"
        archiveTestId="job-change-open-archive"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="flex items-center gap-2.5 mb-3">
          <ClassIcon className={player.job} size={30} tier={current?.tier || 0} showBorder />
          <div>
            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-slate-500">Current Class</div>
            <div className="text-[15px] font-rajdhani font-bold text-slate-100">{player.job}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 w-full max-w-2xl justify-items-center">
          {avail.map((job: any) => (
            <ClassCard
              key={job}
              jobName={job}
              player={player}
              onSelect={(name: any) => actions.jobChange(name)}
              disabled={player.level < (DB.CLASSES[job]?.reqLv || 999)}
            />
          ))}
          {avail.length === 0 && <div className="text-cyber-blue/50 font-rajdhani tracking-widest text-lg">MAXIMUM POTENTIAL REACHED</div>}
        </div>
      </div>
    </Motion.div>
  );
};

export default JobChangePanel;
