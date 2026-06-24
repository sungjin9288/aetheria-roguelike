import { Sword, Zap, ArrowRight, RotateCw, Sparkles } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { soundManager } from '../../systems/SoundManager';
import { buildCombatView } from '../../utils/combatView';
import type { Player, Monster } from '../../types/index.js';

// cycle 485: 컴팩트/조밀 모드 props 인터페이스 제거 — cycle 457이 callsite 명시
//   false 제거 후 caller 0건. cascade로 14 ternary + 1 const + 1 conditional UI
//   블록 일괄 정리. cycle 471-482 cascade 패턴 + cycle 457 paired completion.
interface CombatPanelProps {
    player: Player;
    actions?: any;
    enemy?: Monster | null;
    stats?: any;
    isAiThinking?: boolean;
    mobile?: boolean;
}

// cycle 416: tag / detail 출력 dead 정리 — render는 icon/key/className/
//   mobileLabel/label만 read. tag (Burst/Core/Loadout/Exit) + detail (한국어 설명)
//   src/, tests/ read 0건이라 dead.
const ACTION_BUTTONS: any = [
  {
    key: 'attack',
    label: 'ATTACK',
    mobileLabel: 'ATK',
    icon: Sword,
    className: 'bg-[linear-gradient(180deg,rgba(82,28,37,0.72)_0%,rgba(27,12,15,0.94)_100%)] border border-rose-300/20 text-rose-100 hover:bg-rose-400/10 hover:border-rose-200/28',
  },
  {
    key: 'skill',
    label: 'SKILL',
    mobileLabel: 'SKL',
    icon: Zap,
    className: 'bg-[linear-gradient(180deg,rgba(24,43,48,0.74)_0%,rgba(8,16,18,0.94)_100%)] border border-[#7dd4d8]/20 text-[#dff7f5] hover:bg-[#7dd4d8]/10 hover:border-[#d5b180]/24',
  },
  {
    key: 'swap',
    label: 'SWAP',
    mobileLabel: 'SWAP',
    icon: RotateCw,
    className: 'bg-[linear-gradient(180deg,rgba(33,23,45,0.74)_0%,rgba(12,10,18,0.94)_100%)] border border-[#9a8ac0]/20 text-[#ece5ff] hover:bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/28',
  },
  {
    key: 'escape',
    label: 'ESCAPE',
    mobileLabel: 'RUN',
    icon: ArrowRight,
    className: 'bg-[linear-gradient(180deg,rgba(28,31,27,0.74)_0%,rgba(10,12,10,0.94)_100%)] border border-[#d5b180]/16 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/24',
  },
];

// cycle 575: enemy / stats / mobile 3 defaults batch 제거 — 1 production caller
//   (ControlPanel:119) 6 props 모두 명시 전달이라 도달 불가. body의 enemy ?
//   ternary 분기는 별개 보존 (caller가 enemy: null 명시 전달하는 path).
//   청소 메가 시리즈 67번째 single-cycle 3-default batch.
const CombatPanel = ({ player, actions, enemy, stats, isAiThinking, mobile }: CombatPanelProps) => {
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;
  // 전투 파생 데이터(전술 프로파일·텔레그래프·콤보·전투 예보) — 계산은 buildCombatView로 분리,
  //   여기서는 렌더링만. (slice 20: telegraph 칩 제거 — forecast strip INTENT 셀로 통일.)
  const {
    tacticalProfile,
    bossBriefLine,
    signatureDropCandidates,
    primarySignatureDrop,
    combatConsumables,
    comboRelic,
    comboCount,
    comboStack,
    combatForecast,
    combatForecastCells,
    mobileCombatSignals,
  } = buildCombatView({ player, enemy, stats, selectedSkill, skillCooldown, mobile });

  const handleAction = (key: any) => {
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

  const handleConsumableUse = (item: any) => {
    soundManager.play('item');
    if (actions.combatUseItem) {
      actions.combatUseItem(item);
      return;
    }
    actions.useItem?.(item);
  };

  const getConsumableTone = (type: any) => (({
    hp: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-200 hover:bg-emerald-500/14',
    mp: 'border-cyber-blue/25 bg-cyber-blue/8 text-cyber-blue hover:bg-cyber-blue/14',
    cure: 'border-amber-400/25 bg-amber-500/8 text-amber-200 hover:bg-amber-500/14',
    buff: 'border-cyber-purple/25 bg-cyber-purple/8 text-cyber-purple hover:bg-cyber-purple/14',
  } as Record<string, string>)[type] || 'border-slate-600/30 bg-slate-900/25 text-slate-300 hover:bg-slate-800/40');

  return (
    <Motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className={`relative z-10 w-full space-y-2 ${
        mobile
          ? 'panel-noise aether-surface rounded-[1.5rem] p-3'
          : 'mt-2.5'
      }`}
    >
      <>
          {mobile && (
            <div className="rounded-[1.1rem] aether-panel-core px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-rajdhani font-bold text-white/94 truncate">
                  {enemy?.name || 'Enemy'}와 교전 중
                </div>
                {selectedSkill && (
                  <div className="text-[10px] font-fira text-slate-300/70">
                    {selectedSkill.name} · MP {selectedSkill.mp || 0} · CD {skillCooldown}
                  </div>
                )}
              </div>
            </div>
          )}
          {!mobile && bossBriefLine && (
            <div className="rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/10 px-3 py-1.5 text-center text-[10px] font-fira text-[#f6e7c8]">
              보스 전술: {bossBriefLine}
            </div>
          )}
          {/* cycle 269: tacticalProfile.signature(보스 mechanic) / counterHint(대응) 추가 dispatch.
              getEnemyTacticalProfile은 14+ 필드 반환했지만 CombatPanel이 entryHint/hint/phaseHint
              3종만 read이라 signature/counterHint 등 in-combat 핵심 정보 영원히 invisible. */}
          {!mobile && enemy?.isBoss && tacticalProfile?.signature && (
            <div
              data-testid="combat-boss-signature"
              className="rounded-[1rem] border border-rose-300/24 bg-rose-300/[0.08] px-3 py-1.5 text-[10px] font-fira"
            >
              <span className="text-rose-200 font-bold">기믹</span>
              <span className="text-slate-300/80"> · {tacticalProfile.signature}</span>
            </div>
          )}
          {!mobile && enemy?.isBoss && tacticalProfile?.counterHint && (
            <div
              data-testid="combat-boss-counter"
              className="rounded-[1rem] border border-emerald-300/24 bg-emerald-300/[0.08] px-3 py-1.5 text-[10px] font-fira"
            >
              <span className="text-emerald-200 font-bold">대응</span>
              <span className="text-slate-300/80"> · {tacticalProfile.counterHint}</span>
            </div>
          )}

          {primarySignatureDrop && (
            <div
              data-testid="combat-signature-drop-hint"
              className="flex items-center justify-center gap-1.5 rounded-[1rem] px-3 py-1.5 text-[10px] font-fira"
              style={{
                border: '1px solid rgba(246,231,162,0.42)',
                background: 'linear-gradient(180deg, rgba(246,231,162,0.12) 0%, rgba(18,16,10,0.72) 100%)',
                color: '#f6e7a2',
              }}
            >
              <Sparkles size={11} />
              <span className="uppercase tracking-normal">전설 각인</span>
              <span className="truncate">
                ✦ {primarySignatureDrop.name}
                {signatureDropCandidates.length > 1 ? ` 외 ${signatureDropCandidates.length - 1}` : ''}
              </span>
            </div>
          )}

          {/* slice 20: 데스크톱 telegraph 행 제거 — forecast strip INTENT 셀과 중복. */}

          {/* cycle 113: 적 debuff chip — cycle 111 player debuff chip의 짝(symmetry).
              플레이어가 부여한 stun/curse/blind/fear/DoT의 활성 상태를 전투 화면에 노출.
              emerald 톤(플레이어에게 유리)으로 cycle 111 rose(위험)과 대비. */}
          {enemy && (() => {
            const dots: string[] = Array.isArray(enemy?.dots) ? enemy.dots : [];
            const debuffs: string[] = [];
            if ((enemy?.stunnedTurns || 0) > 0) debuffs.push(`기절·${enemy.stunnedTurns}T`);
            if ((enemy?.cursedTurns || 0) > 0) debuffs.push(`저주·${enemy.cursedTurns}T`);
            if ((enemy?.blindTurns || 0) > 0) debuffs.push(`실명·${enemy.blindTurns}T`);
            if ((enemy?.fearTurns || 0) > 0) debuffs.push(`공포·${enemy.fearTurns}T`);
            const DOT_LABEL: Record<string, string> = { poison: '독', burn: '화상', bleed: '출혈' };
            for (const dot of dots) {
              if (DOT_LABEL[dot]) debuffs.push(DOT_LABEL[dot]);
            }
            if (debuffs.length === 0) return null;
            const headLabel = debuffs[0];
            const showCount = debuffs.length > 1;
            return (
              <div
                data-testid="combat-enemy-debuff-chip"
                data-enemy-debuff-count={debuffs.length}
                className="flex flex-wrap items-center justify-center gap-1.5 rounded-[1rem] border border-emerald-300/30 bg-emerald-400/8 px-3 py-1 text-[10px] font-fira text-emerald-200"
                aria-label={`적 디버프: ${debuffs.join(', ')}`}
              >
                <span className="uppercase tracking-normal text-emerald-300/80">적 디버프</span>
                <span>{headLabel}{showCount ? ` +${debuffs.length - 1}` : ''}</span>
              </div>
            );
          })()}

          {!mobile && comboRelic && (
            <div className={`rounded-[1rem] border px-3 py-1.5 text-center text-[10px] font-fira transition-all ${
              comboCount >= comboStack - 1
                ? 'border-cyber-pink/60 bg-cyber-pink/10 text-cyber-pink animate-pulse'
                : 'border-cyber-pink/20 bg-cyber-pink/5 text-cyber-pink/60'
            }`}>
              <span className="tracking-widest">COMBO </span>
              {Array.from({ length: comboStack }).map((_: any, i: any) => (
                <span key={i} className={`mx-0.5 ${i < comboCount ? 'text-cyber-pink' : 'text-cyber-pink/25'}`}>◆</span>
              ))}
              {comboCount >= comboStack && <span className="ml-1 font-bold">READY!</span>}
            </div>
          )}
          {mobileCombatSignals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mobileCombatSignals.map((signal: any) => (
                <span
                  key={signal.key}
                  className={`inline-flex min-h-[24px] items-center rounded-full border px-2 py-0.5 text-[9px] font-fira uppercase tracking-normal ${signal.className}`}
                >
                  {signal.text}
                </span>
              ))}
            </div>
          )}
          {combatForecast && (
            <section
              data-testid="combat-forecast-strip"
              data-forecast-tone={combatForecast.tone}
              aria-label="전투 판단 요약"
              className="aether-combat-forecast rounded-lg px-3 py-2"
            >
              <div className="grid grid-cols-3 gap-1.5">
                {combatForecastCells.map((cell) => (
                  <div key={cell.label} className="aether-combat-forecast-cell rounded-lg px-2 py-1.5">
                    <div className="font-fira text-[7px] font-bold uppercase tracking-normal text-slate-400/78">
                      {cell.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 font-readable text-[10px] font-semibold leading-[1.15] text-slate-100/90">
                      {cell.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

      </>

      <div className="grid grid-cols-2 gap-1.5">
        {ACTION_BUTTONS.map((action: any) => {
          const Icon = action.icon;
          const isDisabled = isAiThinking || ((action.key === 'skill' || action.key === 'swap') && !selectedSkill);

          return (
            <Motion.button
              key={action.key}
              whileTap={{ scale: 0.95 }}
              disabled={isDisabled}
              onClick={() => handleAction(action.key)}
              className={`aether-combat-action min-h-[50px] overflow-hidden rounded-[1rem] px-2.5 flex items-center gap-2 font-bold transition-all backdrop-blur-md disabled:opacity-45 ${action.className}`}
            >
              <span className="aether-combat-action-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem]">
                <Icon size={13} className={action.key === 'swap' ? 'transition-transform group-hover:rotate-180' : ''} />
              </span>
              <span className="text-[12px] font-readable tracking-normal text-white/94">
                {action.mobileLabel || action.label}
              </span>
            </Motion.button>
          );
        })}
      </div>

      {combatConsumables.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 text-[10px] font-fira uppercase tracking-normal text-cyber-blue/65">
            Combat Items
          </div>
          <div className={`grid gap-2 ${mobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {combatConsumables.map((item: any) => (
              <Motion.button
                key={`${item.type}:${item.name}`}
                whileTap={{ scale: 0.97 }}
                disabled={isAiThinking}
                onClick={() => handleConsumableUse(item)}
                className={`rounded-[1rem] border ${mobile ? 'px-3 py-2.5' : 'px-3 py-2'} text-left transition-all disabled:opacity-45 ${getConsumableTone(item.type)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-rajdhani font-bold leading-tight">{item.name}</span>
                  {item.count > 1 && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] font-fira text-white/70">
                      x{item.count}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[10px] font-fira text-white/55">
                  {item.desc_stat || item.desc}
                </div>
              </Motion.button>
            ))}
          </div>
        </div>
      )}
    </Motion.div>
  );
};

export default CombatPanel;
