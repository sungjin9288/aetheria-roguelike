import React from 'react';
import { Sword, Zap, ArrowRight, RotateCw } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { soundManager } from '../../systems/SoundManager';

/**
 * CombatPanel — 전투 상태 액션 버튼 패널
 */
const CombatPanel = ({ player, actions, isAiThinking }) => {
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mt-3 md:mt-4 relative z-10 w-full">
      {/* 스킬 상태 표시 바 */}
      <div className="text-xs text-cyber-blue/60 font-fira text-center uppercase tracking-widest bg-cyber-black/50 py-1.5 rounded border border-cyber-blue/10 backdrop-blur-sm">
        {selectedSkill ? (
          <span>
            Skill: <span className="text-cyber-purple font-bold drop-shadow-sm">{selectedSkill.name}</span> / MP {selectedSkill.mp || 0} / CD {skillCooldown}
          </span>
        ) : (
          <span className="text-slate-500">NO SKILL SELECTED</span>
        )}
      </div>

      {/* 모바일: 2행 레이아웃 */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking}
          onClick={() => { soundManager.play('attack'); actions.combat('attack'); }}
          className="min-h-[72px] bg-red-900/20 hover:bg-red-900/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-500/50 p-4 rounded-lg text-red-400 font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <Sword className="group-hover:scale-110 transition-transform mb-1.5" size={24} />
          <span className="font-rajdhani tracking-wider text-base">ATTACK</span>
          <span className="text-[10px] text-red-500/50 font-fira mt-0.5">[1]</span>
        </Motion.button>
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking}
          onClick={() => actions.combat('escape')}
          className="min-h-[72px] bg-cyber-dark/60 hover:bg-cyber-green/20 border border-cyber-green/40 p-4 rounded-lg text-cyber-green/80 hover:text-cyber-green font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <ArrowRight className="group-hover:translate-x-2 transition-transform mb-1.5" size={24} />
          <span className="font-rajdhani tracking-wider text-base">ESCAPE</span>
          <span className="text-[10px] text-cyber-green/30 font-fira mt-0.5">[3]</span>
        </Motion.button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking || !selectedSkill}
          onClick={() => actions.combat('skill')}
          className="min-h-[56px] bg-cyber-blue/20 hover:bg-cyber-blue/40 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] border border-cyber-blue/50 p-3 rounded-lg text-cyber-blue font-bold flex flex-row items-center justify-center gap-2 disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <Zap className="group-hover:scale-110 transition-transform" size={18} />
          <span className="font-rajdhani tracking-wider">SKILL <span className="text-[10px] text-cyber-blue/40 font-fira">[2]</span></span>
        </Motion.button>
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking || !selectedSkill}
          onClick={() => actions.cycleSkill(1)}
          className="min-h-[56px] bg-cyber-purple/20 hover:bg-cyber-purple/40 hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] border border-cyber-purple/50 p-3 rounded-lg text-cyber-purple font-bold flex flex-row items-center justify-center gap-2 disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <RotateCw className="group-hover:rotate-180 transition-transform duration-500" size={18} />
          <span className="font-rajdhani tracking-wider">SWAP SKILL</span>
        </Motion.button>
      </div>

      {/* PC: 4열 가로 배치 */}
      <div className="hidden md:grid grid-cols-4 gap-3">
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking}
          onClick={() => { soundManager.play('attack'); actions.combat('attack'); }}
          className="min-h-[64px] bg-red-900/20 hover:bg-red-900/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-500/50 p-3 sm:p-4 rounded-sm text-red-400 font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <Sword className="group-hover:scale-110 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">ATTACK</span>
        </Motion.button>
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking || !selectedSkill}
          onClick={() => actions.combat('skill')}
          className="min-h-[64px] bg-cyber-blue/20 hover:bg-cyber-blue/40 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] border border-cyber-blue/50 p-3 sm:p-4 rounded-sm text-cyber-blue font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <Zap className="group-hover:scale-110 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">SKILL</span>
        </Motion.button>
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking || !selectedSkill}
          onClick={() => actions.cycleSkill(1)}
          className="min-h-[64px] bg-cyber-purple/20 hover:bg-cyber-purple/40 hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] border border-cyber-purple/50 p-3 sm:p-4 rounded-sm text-cyber-purple font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <RotateCw className="group-hover:rotate-180 transition-transform duration-500 mb-1" /> <span className="font-rajdhani tracking-wider">SWAP</span>
        </Motion.button>
        <Motion.button
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking}
          onClick={() => actions.combat('escape')}
          className="min-h-[64px] bg-cyber-dark/60 hover:bg-cyber-green/20 border border-cyber-green/40 p-3 sm:p-4 rounded-sm text-cyber-green/80 hover:text-cyber-green font-bold flex flex-col items-center justify-center disabled:opacity-50 transition-all group backdrop-blur-md"
        >
          <ArrowRight className="group-hover:translate-x-2 transition-transform mb-1" /> <span className="font-rajdhani tracking-wider">ESCAPE</span>
        </Motion.button>
      </div>
    </Motion.div>
  );
};

export default CombatPanel;
