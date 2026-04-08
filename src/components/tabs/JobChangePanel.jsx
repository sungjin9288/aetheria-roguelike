import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../../data/db';
import ClassCard from '../ClassCard';
import ClassIcon from '../icons/ClassIcon';

/**
 * JobChangePanel — 전직 선택 패널
 */
const JobChangePanel = ({ player, actions, setGameState }) => {
  const current = DB.CLASSES[player.job];
  const avail = current?.next || [];

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col items-center overflow-y-auto rounded-[1.95rem] border border-[#9a8ac0]/18 px-4 py-5 shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-2xl"
    >
      {/* 현재 직업 */}
      <div className="flex items-center gap-3 mb-4">
        <ClassIcon className={player.job} size={36} tier={current?.tier || 0} showBorder />
        <div>
          <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-slate-500">Current Class</div>
          <div className="text-lg font-rajdhani font-bold text-slate-100">{player.job}</div>
        </div>
      </div>
      <h2 className="text-xl text-cyber-purple font-bold mb-4 font-rajdhani uppercase tracking-[0.15em] drop-shadow-[0_0_10px_rgba(188,19,254,0.6)]">Class Advancement</h2>
      <div className="grid grid-cols-1 gap-2 w-full max-w-2xl justify-items-center">
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
