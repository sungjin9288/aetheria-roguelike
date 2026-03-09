import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../../data/db';

/**
 * JobChangePanel — 전직 선택 패널
 */
const JobChangePanel = ({ player, actions, setGameState }) => {
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const current = DB.CLASSES[player.job];
  const avail = current?.next || [];

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-8 rounded-xl border border-cyber-purple/50 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(188,19,254,0.3)] backdrop-blur-2xl overflow-y-auto`}
    >
      <h2 className="text-2xl md:text-4xl text-cyber-purple font-bold mb-6 md:mb-10 font-rajdhani uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(188,19,254,0.6)]">Class Advancement</h2>
      <div className="flex gap-3 md:gap-6 flex-wrap justify-center w-full max-w-2xl">
        {avail.map((job) => (
          <Motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            key={job}
            onClick={() => actions.jobChange(job)}
            disabled={player.level < DB.CLASSES[job].reqLv}
            className="p-6 md:p-8 bg-cyber-dark/80 border border-cyber-purple/30 rounded-lg hover:bg-cyber-purple/10 hover:border-cyber-purple hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] disabled:opacity-30 disabled:hover:shadow-none transition-all w-40 md:w-56 group flex flex-col items-center"
          >
            <div className="text-xl md:text-2xl font-bold text-white group-hover:text-cyber-purple transition-colors font-rajdhani tracking-wider mb-2">{job}</div>
            <div className="text-xs text-cyber-blue font-fira bg-cyber-black/50 px-2 py-1 rounded">REQ: Lv.{DB.CLASSES[job].reqLv}</div>
          </Motion.button>
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
