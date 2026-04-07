import React from 'react';
import SignalBadge from './SignalBadge';

const METER_THEME = {
  hp: {
    border: 'border-rose-300/24',
    fill: 'bg-gradient-to-r from-rose-400/55 to-rose-300',
    label: 'text-rose-100/82',
  },
  mp: {
    border: 'border-sky-300/24',
    fill: 'bg-gradient-to-r from-sky-400/55 to-cyan-300',
    label: 'text-cyan-100/82',
  },
  exp: {
    border: 'border-violet-300/24',
    fill: 'bg-gradient-to-r from-violet-400/55 to-violet-300',
    label: 'text-violet-100/82',
  },
};

const StatusMetric = ({ label, value, max, variant = 'hp', compact = false, dense = false, inline = false }) => {
  const theme = METER_THEME[variant] || METER_THEME.hp;
  const safeMax = Math.max(1, max || 1);
  const safeValue = Math.max(0, value || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);

  if (inline) {
    return (
      <div className="min-w-0">
        <div className={`flex items-center justify-between gap-1 font-fira uppercase ${dense ? 'text-[6px] tracking-[0.12em]' : 'text-[7px] tracking-[0.14em]'}`}>
          <span className={theme.label}>{label}</span>
          <span className="text-white/72">{safeValue}/{safeMax}</span>
        </div>
        <div className={`overflow-hidden rounded-full border bg-black/28 ${theme.border} ${dense ? 'mt-px h-[1.5px]' : 'mt-0.5 h-[2px]'}`}>
          <div
            className={`h-full rounded-full ${theme.fill}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`aether-panel-muted relative overflow-hidden rounded-[1rem] ${dense ? 'px-1.5 py-1' : compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
      <div className={`flex items-center justify-between gap-2 font-fira uppercase tracking-[0.16em] ${dense ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[9px]'}`}>
        <span className={theme.label}>{label}</span>
        <span className="text-white/72">{safeValue}/{safeMax}</span>
      </div>
      <div className={`overflow-hidden rounded-full border bg-black/28 ${theme.border} ${dense ? 'mt-0.5 h-[3px]' : compact ? 'mt-1 h-1' : 'mt-1.5 h-1.5'}`}>
        <div
          className={`h-full rounded-full ${theme.fill}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const EnemyStatus = ({ enemy, mobile = false, compact = false }) => {
  if (!enemy) return null;

  const safeMax = Math.max(1, enemy.maxHp || 1);
  const safeValue = Math.max(0, enemy.hp || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);

  return (
    <div className={`relative overflow-hidden rounded-[1.1rem] border border-rose-300/18 bg-[radial-gradient(circle_at_85%_10%,rgba(244,114,182,0.12),transparent_22%),linear-gradient(180deg,rgba(58,20,29,0.52)_0%,rgba(18,9,12,0.82)_100%)] shadow-[0_16px_36px_rgba(22,6,10,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] ${mobile ? 'px-2.75 py-2.5' : compact ? 'px-2 py-1' : 'px-3 py-2.5'}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-100/22 to-transparent" />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`${compact ? 'text-[7px]' : 'text-[9px]'} font-fira uppercase tracking-[0.18em] text-rose-100/58`}>
            {mobile ? 'Target Lock' : 'Combat Target'}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className={`truncate font-rajdhani font-bold text-rose-50/94 ${compact ? 'text-[11px]' : 'text-[13px]'}`}>{enemy.name}</span>
            {enemy.isBoss && <SignalBadge tone="danger" size="sm" className={compact ? 'min-h-[16px] px-1 py-0 text-[7px]' : ''}>Boss</SignalBadge>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[8px] font-fira uppercase tracking-[0.16em] text-rose-100/52">HP</div>
          <div className={`font-rajdhani font-bold text-rose-50/90 ${compact ? 'text-[10px]' : 'text-[12px]'}`}>{safeValue}/{safeMax}</div>
        </div>
      </div>
      <div className={`${compact ? 'mt-1 h-[3px]' : 'mt-2 h-1.5'} overflow-hidden rounded-full border border-rose-300/20 bg-black/30`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500/60 to-rose-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const StatusBar = ({ player, stats, enemy = null, mobile = false, compactDesktop = false, className = '', onCrystalClick = null }) => {
  if (!player?.name) return null;
  const compactBadgeClass = compactDesktop ? 'min-h-[16px] px-1 py-0 text-[7px] tracking-[0.12em]' : '';
  const hasPremiumCurrency = (player.premiumCurrency || 0) > 0;
  return (
    <section
      data-testid="persistent-status-bar"
      className={`pointer-events-none panel-noise aether-surface sticky top-[calc(env(safe-area-inset-top)+0.15rem)] z-50 w-full overflow-hidden ${mobile ? 'rounded-[1.55rem]' : 'rounded-[1.45rem]'} ${mobile ? 'px-3 py-2' : compactDesktop ? 'px-1 py-0.5' : 'px-2.5 py-2'} ${className}`.trim()}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" style={{position:'absolute'}} />
      {mobile ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="truncate text-[15px] font-rajdhani font-bold tracking-[0.04em] text-white/96">{player.name}</span>
              <SignalBadge tone={enemy ? 'danger' : 'neutral'} size="sm">{enemy ? '전투중' : player.job}</SignalBadge>
              <SignalBadge tone="resonance" size="sm">Lv.{player.level}</SignalBadge>
              {(player.killStreak || 0) >= 3 && (
                <span className="shrink-0 rounded-full bg-orange-500/20 border border-orange-400/30 px-1.5 py-0.5 text-[7px] font-fira font-bold uppercase tracking-[0.14em] text-orange-300 animate-pulse">🔥{player.killStreak}</span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[13px] font-rajdhani font-bold text-[#f6e7c8]">{player.gold}</span>
              <span className="ml-0.5 text-[9px] font-fira text-slate-400/68">CR</span>
              {hasPremiumCurrency && (
                <div className={`text-[11px] font-rajdhani font-bold text-cyan-200 leading-none mt-0.5 ${onCrystalClick ? 'cursor-pointer pointer-events-auto' : ''}`} onClick={onCrystalClick}>
                  💎{player.premiumCurrency}
                </div>
              )}
            </div>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] font-fira text-slate-300/65">
            <span className="h-1 w-1 shrink-0 rounded-full bg-[#7dd4d8] animate-pulse" />
            <span className="truncate">{player.loc}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[1.15rem] border border-white/8 bg-black/18 p-1.5">
            <StatusMetric label="HP" value={player.hp} max={stats?.maxHp} variant="hp" compact />
            <StatusMetric label="NRG" value={player.mp} max={stats?.maxMp} variant="mp" compact />
            <StatusMetric label="EXP" value={player.exp} max={player.nextExp} variant="exp" compact />
          </div>
          {enemy && <EnemyStatus enemy={enemy} mobile />}
        </>
      ) : (
        <div className={compactDesktop ? 'space-y-0.5' : 'space-y-1.5'}>
          <div className={`flex items-center ${compactDesktop ? 'gap-1' : 'gap-2.5'}`}>
            <div className={`min-w-0 rounded-[0.9rem] border border-white/8 bg-black/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${compactDesktop ? 'px-1.25 py-0.5' : 'px-2.5 py-1.5'}`}>
              <div className="flex min-w-0 items-center gap-1">
                <span className={`${compactDesktop ? 'text-[10px]' : 'text-[14px]'} truncate font-rajdhani font-bold text-white/94`}>{player.name}</span>
                <SignalBadge tone="neutral" size="sm" className={compactBadgeClass}>{player.job}</SignalBadge>
                <SignalBadge tone="resonance" size="sm" className={compactBadgeClass}>Lv.{player.level}</SignalBadge>
                <SignalBadge tone="upgrade" size="sm" className={compactBadgeClass}>{player.gold} CR</SignalBadge>
                {(player.premiumCurrency || 0) > 0 && (
                  <SignalBadge
                    tone="info"
                    size="sm"
                    className={`${compactBadgeClass}${onCrystalClick ? ' cursor-pointer hover:opacity-80 pointer-events-auto' : ''}`}
                    onClick={onCrystalClick}
                  >
                    💎{player.premiumCurrency}
                  </SignalBadge>
                )}
                {(player.killStreak || 0) >= 3 && (
                  <SignalBadge tone="danger" size="sm" className={`${compactBadgeClass} animate-pulse`}>
                    🔥{player.killStreak}
                  </SignalBadge>
                )}
                {!compactDesktop && (
                  <span className="truncate text-[9px] font-fira uppercase tracking-[0.16em] text-slate-400/68">
                    {player.loc}
                  </span>
                )}
              </div>
            </div>

            <div className={`grid min-w-0 flex-1 grid-cols-3 ${compactDesktop ? 'gap-0.75' : 'gap-1.5'}`}>
              <StatusMetric label="HP" value={player.hp} max={stats?.maxHp} variant="hp" compact={compactDesktop ? false : true} dense={compactDesktop} inline={compactDesktop} />
              <StatusMetric label="NRG" value={player.mp} max={stats?.maxMp} variant="mp" compact={compactDesktop ? false : true} dense={compactDesktop} inline={compactDesktop} />
              <StatusMetric label="EXP" value={player.exp} max={player.nextExp} variant="exp" compact={compactDesktop ? false : true} dense={compactDesktop} inline={compactDesktop} />
            </div>
          </div>

          {enemy && <EnemyStatus enemy={enemy} compact={compactDesktop} />}
        </div>
      )}
    </section>
  );
};

export default StatusBar;
