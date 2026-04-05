import React from 'react';
import { Sword, Zap, ArrowRight, RotateCw } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { soundManager } from '../../systems/SoundManager';
import { getEnemyTacticalProfile } from '../../utils/runProfileUtils';
import { CombatEngine } from '../../systems/CombatEngine';

const ACTION_BUTTONS = [
  {
    key: 'attack',
    label: 'ATTACK',
    mobileLabel: 'ATK',
    tag: 'Burst',
    detail: '기본 공격으로 콤보와 처치 압박을 이어갑니다.',
    icon: Sword,
    className: 'bg-[linear-gradient(180deg,rgba(82,28,37,0.72)_0%,rgba(27,12,15,0.94)_100%)] border border-rose-300/20 text-rose-100 hover:bg-rose-400/10 hover:border-rose-200/28',
  },
  {
    key: 'skill',
    label: 'SKILL',
    mobileLabel: 'SKL',
    tag: 'Core',
    detail: '선택된 스킬을 사용해 전투 흐름을 바꿉니다.',
    icon: Zap,
    className: 'bg-[linear-gradient(180deg,rgba(24,43,48,0.74)_0%,rgba(8,16,18,0.94)_100%)] border border-[#7dd4d8]/20 text-[#dff7f5] hover:bg-[#7dd4d8]/10 hover:border-[#d5b180]/24',
  },
  {
    key: 'swap',
    label: 'SWAP',
    mobileLabel: 'SWAP',
    tag: 'Loadout',
    detail: '다음 스킬을 순환해 대응 루트를 교체합니다.',
    icon: RotateCw,
    className: 'bg-[linear-gradient(180deg,rgba(33,23,45,0.74)_0%,rgba(12,10,18,0.94)_100%)] border border-[#9a8ac0]/20 text-[#ece5ff] hover:bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/28',
  },
  {
    key: 'escape',
    label: 'ESCAPE',
    mobileLabel: 'RUN',
    tag: 'Exit',
    detail: '위험 구간에서 손실을 줄이고 이탈을 시도합니다.',
    icon: ArrowRight,
    className: 'bg-[linear-gradient(180deg,rgba(28,31,27,0.74)_0%,rgba(10,12,10,0.94)_100%)] border border-[#d5b180]/16 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/24',
  },
];

const CombatPanel = ({ player, actions, enemy = null, stats = {}, isAiThinking, mobile = false, compact = false, dense = false }) => {
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;
  const tacticalProfile = getEnemyTacticalProfile(enemy, stats);
  const bossBriefLine = enemy?.isBoss
    ? tacticalProfile?.entryHint || tacticalProfile?.hint || tacticalProfile?.phaseHint
    : null;
  const combatConsumables = Object.values(
    (player.inv || [])
      .filter((item) => ['hp', 'mp', 'cure', 'buff'].includes(item?.type))
      .sort((a, b) => {
        const typeOrder = { hp: 0, mp: 1, cure: 2, buff: 3 };
        return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      })
      .reduce((acc, item) => {
        const key = `${item.type}:${item.name}`;
        if (!acc[key]) {
          acc[key] = { ...item, count: 1 };
        } else {
          acc[key].count += 1;
        }
        return acc;
      }, {})
  ).slice(0, dense ? 3 : mobile || compact ? 4 : 6);

  // 콤보 시스템 (연격의 반지 유물 보유 시)
  const comboRelic = player.relics?.find((r) => r.effect === 'combo_stack');
  const comboCount = player.combatFlags?.comboCount || 0;
  const comboStack = comboRelic?.val?.stack || 0;

  // 보스 패턴 텔레그래프 (적의 다음 행동 예측)
  const enemyTelegraph = enemy ? CombatEngine.predictEnemyNextAction(enemy) : null;
  const telegraphColorClass = {
    red: 'border-red-500/40 bg-red-900/15 text-red-300',
    orange: 'border-orange-400/40 bg-orange-900/15 text-orange-300',
    blue: 'border-cyber-blue/30 bg-cyber-blue/10 text-cyber-blue',
    purple: 'border-cyber-purple/50 bg-cyber-purple/15 text-cyber-purple animate-pulse',
    gray: 'border-slate-600/30 bg-slate-900/20 text-slate-400',
  }[enemyTelegraph?.color || 'gray'];

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

  const handleConsumableUse = (item) => {
    soundManager.play('item');
    if (actions.combatUseItem) {
      actions.combatUseItem(item);
      return;
    }
    actions.useItem?.(item);
  };

  const getConsumableTone = (type) => ({
    hp: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-200 hover:bg-emerald-500/14',
    mp: 'border-cyber-blue/25 bg-cyber-blue/8 text-cyber-blue hover:bg-cyber-blue/14',
    cure: 'border-amber-400/25 bg-amber-500/8 text-amber-200 hover:bg-amber-500/14',
    buff: 'border-cyber-purple/25 bg-cyber-purple/8 text-cyber-purple hover:bg-cyber-purple/14',
  }[type] || 'border-slate-600/30 bg-slate-900/25 text-slate-300 hover:bg-slate-800/40');

  const compactMetaEntries = [
    selectedSkill
      ? {
          key: 'skill',
          label: selectedSkill.name,
          detail: `MP ${selectedSkill.mp || 0} · CD ${skillCooldown}`,
          className: 'border-cyber-blue/18 bg-cyber-blue/8 text-cyber-blue',
        }
      : null,
    bossBriefLine
      ? {
          key: 'boss',
          label: '보스 전술',
          detail: bossBriefLine,
          className: 'border-[#d5b180]/18 bg-[#d5b180]/10 text-[#f6e7c8]',
        }
      : null,
    enemyTelegraph && enemyTelegraph.type !== 'normal'
      ? {
          key: 'telegraph',
          label: enemyTelegraph.label,
          detail: enemy?.name || 'enemy',
          className: telegraphColorClass,
        }
      : null,
    comboRelic
      ? {
          key: 'combo',
          label: 'COMBO',
          detail: `${comboCount}/${comboStack}${comboCount >= comboStack ? ' READY' : ''}`,
          className: comboCount >= comboStack
            ? 'border-cyber-pink/50 bg-cyber-pink/12 text-cyber-pink'
            : 'border-cyber-pink/18 bg-cyber-pink/6 text-cyber-pink/70',
        }
      : null,
  ].filter(Boolean);

  return (
    <Motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative z-10 w-full space-y-2 ${
        compact
          ? dense
            ? 'panel-noise aether-surface rounded-[1.2rem] p-2'
            : 'panel-noise aether-surface rounded-[1.5rem] p-3'
          : mobile
            ? 'panel-noise aether-surface rounded-[1.9rem] p-3'
          : 'mt-2.5 md:mt-4'
      }`}
    >
      {mobile && !compact && (
        <>
          <div className="pointer-events-none absolute -top-6 right-0 h-20 w-20 rounded-full bg-[#d5b180]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-0 h-24 w-24 rounded-full bg-rose-400/8 blur-3xl" />
        </>
      )}
      {dense ? (
        compactMetaEntries.length > 0 && (
          <div className="grid gap-1">
            {compactMetaEntries.map((entry) => (
              <div
                key={entry.key}
                className={`rounded-[0.9rem] border px-2 py-1.5 text-left font-fira ${entry.className}`}
              >
                <div className="truncate text-[9px] uppercase tracking-[0.18em]">
                  {entry.label}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[9px] text-white/74">
                  {entry.detail}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {mobile && (
            <div className="rounded-[1.2rem] aether-panel-core px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-fira uppercase tracking-[0.2em] text-slate-400/66">
                    Combat Sequence
                  </div>
                  <div className="mt-1 text-[14px] font-rajdhani font-bold text-white/94">
                    {enemy?.name || 'Enemy'}와 교전 중
                  </div>
                  <div className="mt-1 text-[10px] font-fira leading-snug text-slate-300/74">
                    {selectedSkill
                      ? `${selectedSkill.name} 준비 완료 · MP ${selectedSkill.mp || 0} · CD ${skillCooldown}`
                      : '선택된 스킬이 없으면 기본 공격과 탈출 위주로 운영합니다.'}
                  </div>
                </div>
                {enemyTelegraph && enemyTelegraph.type !== 'normal' && (
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-fira uppercase tracking-[0.16em] ${telegraphColorClass}`}>
                    {enemyTelegraph.label}
                  </span>
                )}
              </div>
            </div>
          )}
          {bossBriefLine && (
            <div className="rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/10 px-3 py-1.5 text-center text-[10px] font-fira text-[#f6e7c8]">
              보스 전술: {bossBriefLine}
            </div>
          )}

          {enemyTelegraph && enemyTelegraph.type !== 'normal' && (
            <div className={`rounded-[1rem] border px-3 py-1.5 text-center text-[10px] font-fira ${telegraphColorClass}`}>
              ▶ {enemy?.name} — {enemyTelegraph.label}
            </div>
          )}

          {comboRelic && (
            <div className={`rounded-[1rem] border px-3 py-1.5 text-center text-[10px] font-fira transition-all ${
              comboCount >= comboStack - 1
                ? 'border-cyber-pink/60 bg-cyber-pink/10 text-cyber-pink animate-pulse'
                : 'border-cyber-pink/20 bg-cyber-pink/5 text-cyber-pink/60'
            }`}>
              <span className="tracking-widest">COMBO </span>
              {Array.from({ length: comboStack }).map((_, i) => (
                <span key={i} className={`mx-0.5 ${i < comboCount ? 'text-cyber-pink' : 'text-cyber-pink/25'}`}>◆</span>
              ))}
              {comboCount >= comboStack && <span className="ml-1 font-bold">READY!</span>}
            </div>
          )}

          <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3 py-1.5 text-center text-[10px] font-fira text-slate-300/74">
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
        </>
      )}

      <div className={`grid gap-2 ${mobile || compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {ACTION_BUTTONS.map((action) => {
          const Icon = action.icon;
          const isDisabled = isAiThinking || ((action.key === 'skill' || action.key === 'swap') && !selectedSkill);

          return (
            <Motion.button
              key={action.key}
              whileTap={{ scale: 0.95 }}
              disabled={isDisabled}
              onClick={() => handleAction(action.key)}
              className={`${dense ? 'min-h-[42px]' : mobile ? 'min-h-[88px] overflow-hidden px-3 py-3 text-left' : compact ? 'min-h-[58px]' : 'min-h-[52px]'} rounded-[1.15rem] border ${mobile ? '' : 'px-1.5 py-2'} font-bold transition-all backdrop-blur-md disabled:opacity-45 ${action.className}`}
            >
              {mobile ? (
                <div className="flex h-full flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[1rem] border border-white/8 bg-black/18 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <Icon size={16} className={action.key === 'swap' ? 'transition-transform group-hover:rotate-180' : ''} />
                    </span>
                    <span className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[8px] font-fira uppercase tracking-[0.16em] text-white/72">
                      {action.tag}
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] font-rajdhani tracking-[0.18em] text-white/92">
                      {action.label}
                    </div>
                    <div className="mt-1 text-[10px] font-fira leading-snug text-white/58">
                      {action.detail}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-center ${dense ? 'gap-1.5' : 'flex-col gap-1'}`}>
                  <Icon size={dense ? 13 : compact ? 16 : 18} className={action.key === 'swap' ? 'transition-transform group-hover:rotate-180' : ''} />
                  <span className={`${dense ? 'text-[8px] tracking-[0.14em]' : compact ? 'text-[9px] tracking-[0.16em]' : 'text-[10px] tracking-[0.18em]'} font-rajdhani`}>
                    {compact ? action.mobileLabel : action.label}
                  </span>
                </div>
              )}
            </Motion.button>
          );
        })}
      </div>

      {combatConsumables.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 text-[9px] font-fira uppercase tracking-[0.22em] text-cyber-blue/45">
            Combat Items
          </div>
          <div className={`grid gap-2 ${dense ? 'grid-cols-1' : mobile || compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {combatConsumables.map((item) => (
              <Motion.button
                key={`${item.type}:${item.name}`}
                whileTap={{ scale: 0.97 }}
                disabled={isAiThinking}
                onClick={() => handleConsumableUse(item)}
                className={`rounded-[1rem] border ${dense ? 'px-2 py-1.5' : mobile ? 'px-3 py-2.5' : 'px-3 py-2'} text-left transition-all disabled:opacity-45 ${getConsumableTone(item.type)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`${dense ? 'text-[10px]' : 'text-[11px]'} font-rajdhani font-bold leading-tight`}>{item.name}</span>
                  {item.count > 1 && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] font-fira text-white/70">
                      x{item.count}
                    </span>
                  )}
                </div>
                {!dense && (
                  <div className="mt-1 text-[10px] font-fira text-white/55">
                    {item.desc_stat || item.desc}
                  </div>
                )}
              </Motion.button>
            ))}
          </div>
        </div>
      )}
    </Motion.div>
  );
};

export default CombatPanel;
