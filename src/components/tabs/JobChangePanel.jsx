import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../../data/db';
import ClassCard from '../ClassCard';
import ClassIcon from '../icons/ClassIcon';

/**
 * JobChangePanel — 전직 선택 패널
 */
const JobChangePanel = ({ player, actions, setGameState, mobileFocused = false }) => {
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const current = DB.CLASSES[player.job];
  const avail = current?.next || [];

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${mobileFocused ? 'panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col items-center overflow-y-auto rounded-[1.95rem] border border-[#9a8ac0]/18 px-4 py-5 shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-2xl' : `${overlayPanelClass} bg-cyber-black/95 z-30 flex flex-col items-center justify-center overflow-y-auto rounded-xl border border-cyber-purple/50 p-4 md:p-8 shadow-[0_0_40px_rgba(188,19,254,0.3)] backdrop-blur-2xl`}`}
    >
      {/* 현재 직업 */}
      <div className="flex items-center gap-3 mb-4">
        <ClassIcon className={player.job} size={36} tier={current?.tier || 0} showBorder />
        <div>
          <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-slate-500">Current Class</div>
          <div className="text-lg font-rajdhani font-bold text-slate-100">{player.job}</div>
        </div>
      </div>
      <h2 className="text-xl md:text-4xl text-cyber-purple font-bold mb-4 md:mb-10 font-rajdhani uppercase tracking-[0.15em] md:tracking-[0.2em] drop-shadow-[0_0_10px_rgba(188,19,254,0.6)]">Class Advancement</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-6 w-full max-w-2xl justify-items-center">
        {avail.map((job) => (
          <ClassCard
            key={job}
            jobName={job}
            player={player}
            onSelect={(name) => actions.jobChange(name)}
            disabled={player.level < (DB.CLASSES[job]?.reqLv || 999)}
          />
        ))}
        {avail.length === 0 && <div className="text-cyber-blue/50 font-rajdhani tracking-widest text-lg">MAXIMUM POTENTIAL REACHED</div>}
      </div>
      <button
        onClick={() => setGameState('idle')}
        className="mt-12 text-cyber-blue/50 hover:text-cyber-blue font-fira text-sm uppercase tracking-widest hover:underline transition-all"
      >
        [ ABORT SEQUENCE ]
      </button>
    </Motion.div>
  );
};

export default JobChangePanel;
