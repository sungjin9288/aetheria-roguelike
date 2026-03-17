import React from 'react';
import { Sword, Zap, ArrowRight, RotateCw } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { soundManager } from '../../systems/SoundManager';
import { getEnemyTacticalProfile } from '../../utils/runProfileUtils';

const ACTION_BUTTONS = [
  {
    key: 'attack',
    label: 'ATTACK',
    mobileLabel: 'ATK',
    icon: Sword,
    className: 'bg-red-900/18 border-red-500/40 text-red-300 hover:bg-red-900/34 hover:shadow-[0_0_18px_rgba(239,68,68,0.24)]',
  },
  {
    key: 'skill',
    label: 'SKILL',
    mobileLabel: 'SKL',
    icon: Zap,
    className: 'bg-cyber-blue/16 border-cyber-blue/40 text-cyber-blue hover:bg-cyber-blue/30 hover:shadow-[0_0_18px_rgba(0,204,255,0.2)]',
  },
  {
    key: 'swap',
    label: 'SWAP',
    mobileLabel: 'SWAP',
    icon: RotateCw,
    className: 'bg-cyber-purple/16 border-cyber-purple/40 text-cyber-purple hover:bg-cyber-purple/30 hover:shadow-[0_0_18px_rgba(188,19,254,0.2)]',
  },
  {
    key: 'escape',
    label: 'ESCAPE',
    mobileLabel: 'RUN',
    icon: ArrowRight,
    className: 'bg-emerald-950/24 border-emerald-500/35 text-emerald-300 hover:bg-emerald-900/28 hover:shadow-[0_0_18px_rgba(16,185,129,0.2)]',
  },
];

const CombatPanel = ({ player, actions, enemy = null, stats = {}, isAiThinking, mobile = false }) => {
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;
  const tacticalProfile = getEnemyTacticalProfile(enemy, stats);
  const bossBriefLine = enemy?.isBoss
    ? tacticalProfile?.entryHint || tacticalProfile?.hint || tacticalProfile?.phaseHint
    : null;

  const handleAction = (key) => {
    if (key === 'attack') {
      soundManager.play('attack');
      actions.combat('attack');
      return;
    }

    if (key === 'skill') {
      actions.combat('skill');
      return;
    }

    if (key === 'swap') {
      actions.cycleSkill(1);
      return;
    }

    actions.combat('escape');
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 md:mt-4 relative z-10 w-full space-y-2"
    >
      {bossBriefLine && (
        <div className="rounded-[1rem] border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-center text-[10px] font-fira text-amber-200">
          보스 전술: {bossBriefLine}
        </div>
      )}

      <div className="rounded-[1rem] border border-cyan-400/14 bg-cyber-black/60 px-3 py-1.5 text-center text-[10px] font-fira text-cyber-blue/72">
        {selectedSkill ? (
          <span>
            {selectedSkill.name}
            <span className="text-cyber-blue/42"> · </span>
            MP {selectedSkill.mp || 0}
            <span className="text-cyber-blue/42"> · </span>
            CD {skillCooldown}
          </span>
        ) : (
          <span className="text-slate-500">선택된 스킬 없음</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {ACTION_BUTTONS.map((action) => {
          const Icon = action.icon;
          const isDisabled = isAiThinking || ((action.key === 'skill' || action.key === 'swap') && !selectedSkill);

          return (
            <Motion.button
              key={action.key}
              whileTap={{ scale: 0.95 }}
              disabled={isDisabled}
              onClick={() => handleAction(action.key)}
              className={`min-h-[52px] rounded-[1rem] border px-1.5 py-2 font-bold transition-all backdrop-blur-md disabled:opacity-45 ${action.className}`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <Icon size={mobile ? 16 : 18} className={action.key === 'swap' ? 'transition-transform group-hover:rotate-180' : ''} />
                <span className={`${mobile ? 'text-[9px] tracking-[0.16em]' : 'text-[10px] tracking-[0.18em]'} font-rajdhani`}>
                  {mobile ? action.mobileLabel : action.label}
                </span>
              </div>
            </Motion.button>
          );
        })}
      </div>
    </Motion.div>
  );
};

export default CombatPanel;
