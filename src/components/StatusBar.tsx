import { Volume2, VolumeX } from 'lucide-react';
import PixelCharacterAvatar from './PixelCharacterAvatar';
import SignalBadge from './SignalBadge';
import MonsterIcon from './icons/MonsterIcon';
import { isSignatureItem } from '../data/signatureItems.js';
import { OUTFIT_SLOT_COUNT } from '../utils/jobOutfitAffinity';
import { useHitFlash } from '../hooks/useHitFlash';
import type { Player, Monster } from '../types/index.js';

const METER_THEME: any = {
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

// cycle 458: inline prop / if (inline) 분기 제거 — 3 callsite 모두 컴팩트만 전달,
//   inline 진입 0건의 unreachable code path. cycle 357-359/421/425/444 lens.
// cycle 491: 컴팩트/조밀 props cascade — 3 callsite 모두 컴팩트 shorthand (=true)
//   전달, 조밀 prop 0건 → chained ternary 첫/마지막 가지 unreachable, 컴팩트
//   가지만 진입 → props 자체 제거 + 정적 className inline.
// cycle 583: variant default 'hp' 제거 — 3 internal callsite (line 236-238)
//   모두 variant 명시 (hp/mp/exp). default 도달 불가. body의 METER_THEME[variant]
//   || METER_THEME.hp nullish fallback은 별개 보존. 청소 메가 시리즈 74번째.
const StatusMetric = ({ label, value, max, variant }: any) => {
  const theme = METER_THEME[variant] || METER_THEME.hp;
  const safeMax = Math.max(1, max || 1);
  const safeValue = Math.max(0, value || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);

  return (
    <div
      data-testid={`status-metric-${variant}`}
      className="aether-status-metric relative overflow-hidden rounded-[0.8rem] px-2 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-1 font-readable text-[10px] leading-none">
        <span data-testid="status-metric-label" className={theme.label}>{label}</span>
        <span data-testid="status-metric-value" className="text-[11px] font-semibold text-white/82">{safeValue}/{safeMax}</span>
      </div>
      <div className={`mt-1 h-[3px] overflow-hidden rounded-full border bg-black/28 ${theme.border}`}>
        {/* slice 31: 바 fill 부드러운 tween — 기존엔 즉시 snap이라 데미지/EXP
            변화가 끊겨 보였음. EXP 바가 레벨업 직전까지 차오르고 → slice 29 배너. */}
        <div
          className={`h-full rounded-full ${theme.fill} transition-[width] duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 적이 피해를 받으면 생명력 막대와 피해 숫자를 함께 강조한다.
const EnemyStatus = ({ enemy, enemyHitCrit }: any) => {
  const { flash, amount } = useHitFlash(enemy?.hp, enemy?.name, { crit: !!enemyHitCrit });
  if (!enemy) return null;

  const safeMax = Math.max(1, enemy.maxHp || 1);
  const safeValue = Math.max(0, enemy.hp || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);
  const isCritHit = amount?.meta?.crit;

  return (
    <div
      data-testid="enemy-status"
      data-hit-flash={flash ? 'true' : undefined}
      className={`relative overflow-hidden rounded-[1.1rem] border bg-[radial-gradient(circle_at_85%_10%,rgba(244,114,182,0.12),transparent_22%),linear-gradient(180deg,rgba(58,20,29,0.52)_0%,rgba(18,9,12,0.82)_100%)] shadow-[0_16px_36px_rgba(22,6,10,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] px-2.75 py-2.5 transition-transform duration-150 ${flash ? 'border-rose-200/70 scale-[1.015]' : 'border-rose-300/18'}`}
    >
      {/* 타격 플래시 오버레이 */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 rounded-[1.1rem] bg-rose-100/12 mix-blend-screen" />
      )}
      {/* 적 데미지 float 숫자 */}
      {amount && (
        <span
          key={amount.key}
          data-testid="enemy-damage-number"
          className={`pointer-events-none absolute right-3 top-1 z-10 font-rajdhani font-black ${
            isCritHit ? 'text-[#f6e7a2] text-xl' : 'text-rose-100 text-base'
          }`}
          style={{
            animation: 'floatUp 0.9s ease-out forwards',
            textShadow: isCritHit
              ? '0 0 14px rgba(246,231,162,0.7), 0 2px 4px rgba(0,0,0,0.7)'
              : '0 0 10px rgba(244,63,94,0.5), 0 2px 4px rgba(0,0,0,0.7)',
          }}
        >
          {isCritHit ? '✦ ' : ''}-{amount.value}
        </span>
      )}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-100/22 to-transparent" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            data-testid="enemy-portrait"
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.85rem] border border-rose-200/18 bg-black/24 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <MonsterIcon name={enemy.name} discovered isBoss={enemy.isBoss} size={34} />
          </div>
          <div className="min-w-0">
            <div data-testid="enemy-status-label" className="text-[10px] font-readable text-rose-100/66">
              교전 대상
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <span className="truncate font-readable font-semibold text-rose-50/94 text-[14px]">{enemy.name}</span>
              {enemy.isBoss && <SignalBadge tone="danger" size="sm">보스</SignalBadge>}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div data-testid="enemy-health-label" className="text-[10px] font-readable text-rose-100/62">생명</div>
          <div data-testid="enemy-health-value" className="font-readable font-semibold text-rose-50/92 text-[12px]">{safeValue}/{safeMax}</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-rose-300/20 bg-black/30">
        <div
          className={`h-full rounded-full transition-all duration-200 ${flash ? 'bg-rose-100' : 'bg-gradient-to-r from-rose-500/60 to-rose-300'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// cycle 495: 외부 보조 클래스 prop 인터페이스 제거 — GameRoot 1 callsite 전달
//   0건이라 보간 결과 ''만 추가되는 unreachable. cycle 463/465/466/493 lens 회귀.
interface StatusBarProps {
  player?: Player | null;
  stats?: any;
  enemy?: Monster | null;
  enemyHitCrit?: boolean;
  onCrystalClick?: (() => void) | null;
  isMuted?: boolean;
  onToggleMute?: (() => void) | null;
  onOpenEquipment?: (() => void) | null;
}

// cycle 586: 5 defaults batch 제거 (enemy/onCrystalClick/isMuted/onToggleMute/
//   onOpenEquipment) — 1 production caller (GameRoot:89) 7 props 모두 명시
//   전달이라 5 defaults 모두 도달 불가. 청소 메가 시리즈 77번째 single-cycle
//   5-default batch (cycle 572 6-default partial 다음으로 큰 batch).
const StatusBar = ({
  player,
  stats,
  enemy,
  enemyHitCrit,
  onCrystalClick,
  isMuted,
  onToggleMute,
  onOpenEquipment,
}: StatusBarProps) => {
  if (!player?.name) return null;
  const hasPremiumCurrency = (player.premiumCurrency || 0) > 0;
  // 장착중인 signature 개수 — sticky HUD에 ✦N 칩으로 상시 노출
  const equippedSignatureCount = [
    player?.equip?.weapon,
    player?.equip?.armor,
    player?.equip?.offhand,
  ].filter((item: any) => item && isSignatureItem(item)).length;
  return (
    <section
      data-testid="persistent-status-bar"
      className="pointer-events-none aether-status-shell sticky top-0 z-50 w-full overflow-hidden rounded-[1.2rem] px-2.5 py-1.5"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{position:'absolute'}} />
      <div className="flex items-start gap-2.5">
        <PixelCharacterAvatar
          player={player}
          size="sm"
          interactive={Boolean(onOpenEquipment)}
          onClick={onOpenEquipment}
          dataTestId="status-character-chip"
          label="장비 콘솔 열기"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div data-testid="status-player-summary" className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5">
              <span className="min-w-0 max-w-[8.5rem] truncate font-readable text-[15px] font-semibold leading-tight text-white/96">{player.name}</span>
              <SignalBadge tone={enemy ? 'danger' : 'neutral'} size="sm">{enemy ? '전투중' : player.job}</SignalBadge>
              <SignalBadge tone="resonance" size="sm">레벨 {player.level}</SignalBadge>
              {/* cycle 176: 'blindMap' challenge modifier — 위치 표시 숨김 ('???' 라벨로 대체).
                  cycle 147 이전엔 dead modifier(handler 0건)였음 — 이제 정상 동작. */}
              {/* slice 21: 위치 점/텍스트에 지역 accent — 지역 이동이 상태 바에서도 체감되게. */}
              <div
                data-testid="status-context-line"
                className="basis-full flex min-h-[20px] min-w-0 flex-wrap items-center gap-1.5"
              >
                <span className="flex min-w-0 items-center gap-1 font-readable text-[10px]" style={{ color: 'var(--region-accent)' }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--region-accent)' }} />
                  <span className="max-w-[8.5rem] truncate opacity-90">
                    {player.challengeModifiers?.includes('blindMap') ? '???' : player.loc}
                  </span>
                </span>
                {(player.killStreak || 0) >= 3 && (
                  <span className="shrink-0 rounded-full border border-orange-400/28 bg-orange-500/18 px-1.5 py-0.5 text-[9px] font-fira font-bold tracking-normal text-orange-300">연속 처치 {player.killStreak}</span>
                )}
                {/* cycle 111: 활성 디버프 chip — cycle 106-110에서 활성화된 5종 status
                    (bleed/freeze/stun/curse/blind/fear)의 시각 노출. 기존엔 전투 로그에만
                    나오고 스크롤되어 사라져 플레이어가 현재 디버프 상태를 알기 어려웠음.
                    rose 톤(위험)으로 단일화 — 모든 5종이 player에 부정적이라 통합. */}
                {Array.isArray(player.status) && player.status.length > 0 && (() => {
                  const DEBUFF_LABELS: Record<string, string> = {
                    bleed: '출혈', burn: '화상', poison: '중독',
                    freeze: '빙결', stun: '기절', curse: '저주',
                    blind: '실명', fear: '공포',
                  };
                  const debuffs = player.status.filter((s: any) => DEBUFF_LABELS[s as string]);
                  if (debuffs.length === 0) return null;
                  const headLabel = DEBUFF_LABELS[debuffs[0] as string] || debuffs[0];
                  const showCount = debuffs.length > 1;
                  return (
                    <span
                      data-testid="status-debuff-chip"
                      data-debuff-count={debuffs.length}
                      className="shrink-0 rounded-full border border-rose-400/40 bg-rose-500/16 px-1.5 py-0.5 text-[9px] font-fira font-bold tracking-normal text-rose-200"
                      aria-label={`디버프 ${debuffs.length}개: ${debuffs.map((d: any) => DEBUFF_LABELS[d as string] || d).join(', ')}`}
                    >
                      {headLabel}{showCount ? ` +${debuffs.length - 1}` : ''}
                    </span>
                  );
                })()}
                {stats?.jobAffinity?.matchCount > 0 && (() => {
                  const tier = stats.jobAffinity.tier;
                  const tone =
                    tier === 'full' ? { color: '#f6e7a2', border: 'rgba(246,231,162,0.55)', bg: 'rgba(246,231,162,0.18)' } :
                    tier === 'partial2' ? { color: '#d5b180', border: 'rgba(213,177,128,0.50)', bg: 'rgba(213,177,128,0.14)' } :
                    { color: '#7dd4d8', border: 'rgba(125,212,216,0.42)', bg: 'rgba(125,212,216,0.12)' };
                  return (
                    <span
                      data-testid="status-outfit-affinity-chip"
                      data-affinity-tier={tier}
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-fira font-bold tracking-normal"
                      style={{ color: tone.color, border: `1px solid ${tone.border}`, background: tone.bg }}
                      aria-label={`장비 조화 ${stats.jobAffinity.matchCount}/${OUTFIT_SLOT_COUNT}: ${stats.jobAffinity.label}`}
                    >
                      장비 조화 {stats.jobAffinity.matchCount}/{OUTFIT_SLOT_COUNT}
                    </span>
                  );
                })()}
                {equippedSignatureCount > 0 && (
                  <span
                    data-testid="status-signature-chip"
                    data-signature-count={equippedSignatureCount}
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-fira font-bold tracking-normal"
                    style={{
                      color: '#f6e7a2',
                      border: '1px solid rgba(246,231,162,0.42)',
                      background: 'rgba(246,231,162,0.12)',
                    }}
                    aria-label={`전설 각인 ${equippedSignatureCount}종 장착중`}
                  >
                    ✦ 전설 각인 {equippedSignatureCount}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {onToggleMute && (
                <button
                  onClick={onToggleMute}
                  className="pointer-events-auto rounded-full border border-white/8 bg-black/20 p-1 text-slate-300/70 transition-colors hover:text-white"
                  aria-label={isMuted ? '소리 켜기' : '소리 끄기'}
                >
                  {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
              )}
              <div className="text-right">
                <span className="text-[13px] font-rajdhani font-bold text-[#f6e7c8]">{player.gold}</span>
                <span className="ml-0.5 text-[9px] font-readable text-slate-400/68">골드</span>
                {hasPremiumCurrency && (
                  <div className={`text-[11px] font-rajdhani font-bold text-cyan-200 leading-none mt-0.5 ${onCrystalClick ? 'cursor-pointer pointer-events-auto' : ''}`} onClick={onCrystalClick || undefined}>
                    💎{player.premiumCurrency}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div data-testid="status-metrics" className="mt-1.5 grid grid-cols-3 gap-1">
            <StatusMetric label="생명" value={player.hp} max={stats?.maxHp} variant="hp" />
            <StatusMetric label="기력" value={player.mp} max={stats?.maxMp} variant="mp" />
            <StatusMetric label="경험" value={player.exp} max={player.nextExp} variant="exp" />
          </div>
        </div>
      </div>
      {enemy && <div className="mt-1"><EnemyStatus enemy={enemy} enemyHitCrit={enemyHitCrit} /></div>}
    </section>
  );
};

export default StatusBar;
