import { Gem, MapPin } from 'lucide-react';
import PixelCharacterAvatar from './PixelCharacterAvatar';
import SignalBadge from './SignalBadge';
import EnemyPortrait from './combat/EnemyPortrait';
import { useHitFlash } from '../hooks/useHitFlash';
import { getExpeditionHudChips } from '../utils/expeditionHud';
import { getVisibleLocationName } from '../utils/challengeRules';
import { getEnemyRank } from '../utils/enemyRank';
import { MSG } from '../data/messages.js';
import type { FullStats, Player, Monster } from '../types/index.js';

// 2026-10 에테르 유리 3차(shell): 지표 막대는 공용 게이지 부품의 클래스(`.ae-gauge-*`)를 쓴다 — 색은 토큰 한 곳이 정한다.
const METER_THEME: Record<string, { gauge: string; label: string }> = {
  hp: { gauge: 'ae-gauge-life', label: 'text-ae-life' },
  mp: { gauge: 'ae-gauge-will', label: 'text-ae-will' },
  exp: { gauge: 'ae-gauge-exp', label: 'text-ae-exp' },
};

// cycle 458: inline prop / if (inline) 분기 제거 — 3 callsite 모두 컴팩트만 전달,
//   inline 진입 0건의 unreachable code path. cycle 357-359/421/425/444 lens.
// cycle 491: 컴팩트/조밀 props cascade — 3 callsite 모두 컴팩트 shorthand (=true)
//   전달, 조밀 prop 0건 → chained ternary 첫/마지막 가지 unreachable, 컴팩트
//   가지만 진입 → props 자체 제거 + 정적 className inline.
// cycle 583: variant default 'hp' 제거 — 3 internal callsite 모두 variant 명시 (hp/mp/exp).
//   default 도달 불가. body의 METER_THEME[variant] || METER_THEME.hp nullish fallback은 별개 보존.
type MeterVariant = 'hp' | 'mp' | 'exp';

interface StatusMetricProps {
  label: string;
  value?: number;
  max?: number;
  variant: MeterVariant;
}

const StatusMetric = ({ label, value, max, variant }: StatusMetricProps) => {
  const theme = METER_THEME[variant] || METER_THEME.hp;
  const safeMax = Math.max(1, max || 1);
  const safeValue = Math.max(0, value || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);

  return (
    <div
      data-testid={`status-metric-${variant}`}
      className="aether-status-metric ae-status-metric relative overflow-hidden rounded-ae-sm px-2 py-1.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-1 font-readable text-[11px] leading-tight">
        <span data-testid="status-metric-label" className={`whitespace-nowrap font-semibold ${theme.label}`}>{label}</span>
        <span data-testid="status-metric-value" aria-label={`${safeValue}/${safeMax}`} className="font-fira text-[11px] font-semibold tabular-nums text-ae-ink"><span className="whitespace-nowrap">{safeValue}</span><wbr /><span className="whitespace-nowrap text-ae-ink-2">/{safeMax}</span></span>
      </div>
      <div className={`ae-gauge ae-sunk mt-1 ${theme.gauge}`}>
        {/* slice 31: 바 fill 부드러운 tween — 데미지/EXP 변화가 끊겨 보이지 않게. EXP 바가 레벨업 직전까지 차오르고 → slice 29 배너. */}
        <div
          className="ae-gauge-fill transition-[width] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 감사 A11Y-06: 전투 화면의 내 상태 · 적 정보는 제목이 있는 영역이다(화면 낭독기 영역 · 제목 이동).
const PLAYER_STATUS_HEADING_ID = 'combat-player-status-heading';
const ENEMY_STATUS_HEADING_ID = 'combat-enemy-status-heading';

interface EnemyStatusProps {
  enemy?: Monster | null;
  enemyHitCrit?: boolean;
  /** 처치 순간(게임 필 GF-02) — 쓰러진 적을 막대 0 · 마지막 피해 숫자 · '처치' 도장으로 그린다. */
  defeated?: boolean;
}

// 적이 피해를 받으면 생명력 막대와 피해 숫자를 함께 강조한다.
//   데스크톱 배치(≥1024px)에서도 상태 카드 안에 있다 — 왼쪽 열이 "나와 상대"를 위아래로 보인다.
const EnemyStatus = ({ enemy, enemyHitCrit, defeated = false }: EnemyStatusProps) => {
  const { flash, amount } = useHitFlash(enemy?.hp, enemy?.name, { crit: !!enemyHitCrit });
  if (!enemy) return null;

  const safeMax = Math.max(1, enemy.maxHp || 1);
  const safeValue = Math.max(0, enemy.hp || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);
  const isCritHit = amount?.meta?.crit;
  // 2026-10 감사 VD-02: 적의 무게(보스 · 우두머리 · 정예 · 일반)가 카드 · 초상 테두리 · 생명 막대 색을 정한다(index.css).
  const rank = getEnemyRank(enemy);

  return (
    <div
      data-defeated={defeated ? 'true' : undefined}
      data-testid="enemy-status"
      role="region"
      aria-labelledby={ENEMY_STATUS_HEADING_ID}
      data-hit-flash={flash ? 'true' : undefined}
      data-enemy-rank={rank}
      className="aether-encounter-stage ae-encounter-stage relative mt-1.5 overflow-hidden rounded-ae-md px-3 py-2.5"
    >
      {/* 적 피해 숫자 — 치명타는 금빛에 별표(✦)를 단다(전투 연출 계약이 이 글자를 읽는다). */}
      {amount && (
        <span
          key={amount.key}
          data-crit={isCritHit ? 'true' : undefined}
          data-testid="enemy-damage-number"
          className={`ae-enemy-damage pointer-events-none absolute right-3 top-1 z-10 font-fira font-bold tabular-nums ${
            isCritHit ? 'text-xl text-ae-gold-hi' : 'text-base text-ae-ink'
          }`}
          style={{ animation: 'floatUp 0.9s cubic-bezier(.2,.8,.2,1) forwards' }}
        >
          {isCritHit ? '✦ ' : ''}-{amount.value}
        </span>
      )}
      {/* 처치 도장(게임 필 GF-02) — 카드 전체를 어둡게 덮고 가운데에 찍는다(초상 크기 · 배치와 무관하다).
          마지막 일격 숫자(z-10)는 도장 위에 남는다. 초상이 빛을 잃는 모습은 index.css가 `data-defeated`로 그린다. */}
      {defeated && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-ae-void/50">
          <span
            data-testid="enemy-defeated-stamp"
            className="aether-defeated-stamp rounded-ae-xs border-2 border-ae-gold/70 bg-ae-void/80 px-3 py-1 font-display text-[16px] font-bold leading-none text-ae-gold-hi"
          >
            {MSG.COMBAT_DEFEATED_STAMP}
          </span>
        </div>
      )}
      {/* 2026-10 감사 VD-02: 초상은 80px 그림(160px 원본의 정수 배율) — 생명 막대는 이름 아래로 옮겨 높이를 아낀다. */}
      <div className="flex items-center gap-3">
        <EnemyPortrait enemy={enemy} rank={rank} />
        <div className="min-w-0 flex-1">
          <h2 id={ENEMY_STATUS_HEADING_ID} data-testid="enemy-status-label" className="ae-eyebrow font-readable">
            {MSG.SHELL_ENEMY_HEADING}
          </h2>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="min-w-0 font-display text-[15px] font-bold leading-snug text-ae-ink">{enemy.name}</span>
            {enemy.isBoss && <SignalBadge tone="danger" size="sm">{MSG.SHELL_BOSS}</SignalBadge>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="aether-enemy-health-track ae-gauge ae-gauge-life ae-gauge-lg ae-sunk min-w-0 flex-1">
              {/* 잔상은 지금 값과 같은 폭이고 늦게 줄어든다(.ae-gauge-trail의 지연 전환) — 방금 깎인 양이 잠깐 보인다. */}
              <div className="ae-gauge-trail" aria-hidden="true" style={{ width: `${percentage}%` }} />
              <div
                data-testid="enemy-health-fill"
                className="aether-enemy-health-fill ae-gauge-fill"
                style={{ width: `${percentage}%` }}
              />
              <div className="ae-gauge-ticks" aria-hidden="true" />
            </div>
            <div className="shrink-0 whitespace-nowrap text-right leading-tight">
              <span data-testid="enemy-health-label" className="font-readable text-[11px] text-ae-ink-3">{MSG.SHELL_LIFE}</span>{' '}
              <span data-testid="enemy-health-value" className="font-fira text-[12px] font-semibold tabular-nums text-ae-ink">{safeValue}/{safeMax}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// cycle 495: 외부 보조 클래스 prop 인터페이스 제거 — GameRoot 1 callsite 전달
//   0건이라 보간 결과 ''만 추가되는 unreachable. cycle 463/465/466/493 lens 회귀.
interface StatusBarProps {
  player?: Player | null;
  stats?: FullStats | null;
  enemy?: Monster | null;
  enemyHitCrit?: boolean;
  /** `enemy`가 처치 순간의 쓰러진 적이다(게임 필 GF-02 — 전투는 이미 끝났다). */
  enemyDefeated?: boolean;
  onCrystalClick?: (() => void) | null;
  onOpenEquipment?: (() => void) | null;
  /**
   * 2026-10 데스크톱 배치(VD-04 · UX-12): `column`이면 왼쪽 캐릭터 열의 카드로 그린다 — 화면 위에 붙지 않고, 초상이 크고,
   * 지표는 세로로 쌓인다(전투 중에는 그 아래에 상대 카드). 없으면 모바일 상단 표시줄(지금 모양)이다.
   */
  placement?: 'bar' | 'column';
}

const StatusBar = ({
  player,
  stats,
  enemy,
  enemyHitCrit,
  enemyDefeated = false,
  onCrystalClick,
  onOpenEquipment,
  placement,
}: StatusBarProps) => {
  if (!player?.name) return null;
  const isColumn = placement === 'column';
  const hasPremiumCurrency = (player.premiumCurrency || 0) > 0;
  // 2026-09 G10: 원정 진행 신호(보스 접근 게이지 · 심연 데일리 다이브)를 상시 HUD로.
  //   계산은 utils/expeditionHud.ts 순수 함수 — 여기서는 렌더링만 한다.
  const expeditionChips = getExpeditionHudChips(player);
  // 모바일은 화면 위에 붙는 표시줄, 데스크톱 열은 흐름 안의 카드다.
  const shellPlacementClass = isColumn ? 'ae-status-column' : 'pointer-events-none sticky top-0 z-50';

  if (enemy) {
    return (
      <section
        data-testid="persistent-status-bar"
        data-status-mode="combat"
        data-status-placement={isColumn ? 'column' : 'bar'}
        className={`aether-status-shell ae-status-shell ${shellPlacementClass} w-full overflow-hidden rounded-ae-lg px-2.5 py-2`}
      >
        <div role="region" aria-labelledby={PLAYER_STATUS_HEADING_ID} className={`aether-combat-player-status flex min-h-[44px] items-center gap-2.5 ${isColumn ? 'flex-col text-center' : ''}`}>
          <h2 id={PLAYER_STATUS_HEADING_ID} className="sr-only">{MSG.A11Y_PLAYER_STATUS_HEADING}</h2>
          {/* 감사 VD-02: 전투 중에도 내 캐릭터가 보인다 — 모바일은 44px 초상(높이 불변), 데스크톱 열은 큰 초상. */}
          <PixelCharacterAvatar
            player={player}
            size={isColumn ? 'lg' : 'sm'}
            dataTestId="status-combat-avatar"
            label={MSG.A11Y_PLAYER_STATUS_HEADING}
            className={isColumn ? 'shrink-0' : 'ae-status-combat-avatar shrink-0'}
          />
          <div className="min-w-0 flex-1">
            <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${isColumn ? 'justify-center' : ''}`}>
              <span className="min-w-0 font-display text-[14px] font-bold text-ae-ink">{player.name}</span>
              {!enemyDefeated && <SignalBadge tone="danger" size="sm">{MSG.SHELL_IN_COMBAT}</SignalBadge>}
              <SignalBadge tone="resonance" size="sm">{MSG.SHELL_LEVEL(player.level ?? 1)}</SignalBadge>
            </div>
            {/* 전투 중에는 조작판의 생명 · 기력 막대(CombatVitalsStrip — 막대마다 이름과 값을 읽는 meter)가 같은 값을 그리고
                화면 낭독기에도 알린다 — 여기서는 그리지 않는다(소유자 결정 D9 2026-10-26: 화면 낭독기 전용 사본이 같은 값을
                두 번 읽혔다). 처치 순간(조작판이 내려간 뒤)에만 다시 보인다. */}
            {enemyDefeated && (
              <div
                data-testid="status-combat-vitals"
                data-vitals-visible="true"
                className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-readable text-[11px] ${isColumn ? 'justify-center' : ''}`}
              >
                <span className="text-ae-ink"><span className="font-semibold text-ae-life">{MSG.SHELL_LIFE}</span> <span className="font-fira tabular-nums">{Math.max(0, player.hp || 0)}/{Math.max(1, stats?.maxHp || player.maxHp || 1)}</span></span>
                <span className="text-ae-ink"><span className="font-semibold text-ae-will">{MSG.SHELL_WILL}</span> <span className="font-fira tabular-nums">{Math.max(0, player.mp || 0)}/{Math.max(1, stats?.maxMp || player.maxMp || 1)}</span></span>
              </div>
            )}
          </div>
        </div>
        <EnemyStatus enemy={enemy} enemyHitCrit={enemyHitCrit} defeated={enemyDefeated} />
      </section>
    );
  }

  return (
    <section
      data-testid="persistent-status-bar"
      data-status-placement={isColumn ? 'column' : 'bar'}
      className={`aether-status-shell ae-status-shell ${shellPlacementClass} w-full overflow-hidden rounded-ae-lg ${isColumn ? 'px-4 py-4' : 'px-2.5 py-2'}`}
    >
      <div className={`flex gap-2.5 ${isColumn ? 'flex-col items-center text-center' : 'items-start'}`}>
        <PixelCharacterAvatar
          player={player}
          size={isColumn ? 'lg' : 'sm'}
          interactive={Boolean(onOpenEquipment)}
          onClick={onOpenEquipment}
          dataTestId="status-character-chip"
          label={MSG.STATUS_AVATAR_ARCHIVE_ARIA}
          className="shrink-0"
        />
        <div className={`min-w-0 flex-1 ${isColumn ? 'w-full' : ''}`}>
          <div className={`flex gap-2 ${isColumn ? 'flex-col items-center' : 'items-center justify-between'}`}>
            <div data-testid="status-player-summary" className={`flex min-w-0 flex-1 items-baseline gap-1 font-readable ${isColumn ? 'flex-wrap justify-center' : ''}`}>
              {/* 2026-10 제품 통합 수용: 이름은 상한(6.5rem)까지 줄지 않는다(375px에서 두 글자 이름이 "용…"이 됐다).
                  Wave 133: 위치는 둘째 줄로 옮겼다 — 첫 줄에서 줄어드는 칸이던 동안 여섯 글자 이름이면 375 · 390px에서
                  지역 이름이 거의 다 잘렸고 긴 직업과 함께면 0px로 사라졌다. 이제 이 줄에서는 직업이 먼저 줄어든다.
                  2026-10-26: 이름이 전혀 줄지 않던 동안 골드가 일곱 자리면(375px) 레벨이 골드 밑으로 밀려 겹쳤다 — 직업이 다 줄고도
                  모자라면 그때 이름이 줄어든다(레벨 · 골드는 줄지 않는다). */}
              <span className={`${isColumn ? 'text-[17px]' : 'min-w-0 max-w-[6.5rem] truncate text-[15px]'} font-display font-bold leading-tight text-ae-ink`}>{player.name}</span>
              <span className={`min-w-0 text-[11px] text-ae-ink-2 ${isColumn ? '' : 'shrink-[100] truncate'}`}>{player.job}</span>
              <span className="shrink-0 font-fira text-[11px] tabular-nums text-ae-exp">{MSG.SHELL_LEVEL(player.level ?? 1)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex items-center gap-2 text-right">
                <span className="whitespace-nowrap">
                  <span className="font-fira text-[13px] font-semibold tabular-nums text-ae-gold-text">{player.gold}</span>
                  <span className="ml-0.5 font-readable text-[11px] text-ae-ink-2">{MSG.SHELL_GOLD_UNIT}</span>
                </span>
                {/* 2026-10 통합 감사(town-nav A11Y-05): 크리스탈은 에테르 교환소를 여는 단추다 — 이름 · 키보드 · 44px 누름 칸.
                    음수 여백으로 누름 칸만 넓히고 줄 높이는 그대로다(상태 표시줄 높이 불변). 보석은 선 아이콘이다(VD-13). */}
                {hasPremiumCurrency && (onCrystalClick ? (
                  <button
                    type="button"
                    data-testid="status-crystal"
                    aria-label={MSG.STATUS_CRYSTAL_ARIA(player.premiumCurrency || 0)}
                    onClick={onCrystalClick}
                    className="ae-status-crystal pointer-events-auto -my-[15.5px] flex min-h-11 min-w-11 items-center justify-end gap-1 font-fira text-[11px] font-bold leading-none tabular-nums text-ae-ether-hi"
                  >
                    <Gem size={13} aria-hidden="true" />
                    <span aria-hidden="true">{player.premiumCurrency}</span>
                  </button>
                ) : (
                  <span data-testid="status-crystal-passive" className="inline-flex items-center gap-1 font-fira text-[11px] font-bold leading-none tabular-nums text-ae-ether-hi">
                    <Gem size={13} aria-hidden="true" />
                    {player.premiumCurrency}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* Wave 133(소유자 결정 "위치를 둘째 줄로"): 위치는 상황 칩 줄의 맨 앞이고, 이 줄은 늘 그린다 — 줄이지 않는다.
              칩이 셋(보스 접근 · 연속 처치 · 상태이상)이면 좁은 폭에서 칩이 다음 줄로 넘어간다 — 칩 여백은 좁게 둔다(글자는 11px 그대로).
              위치 표시 핀은 줄 바깥 장식이다(줄의 맨 앞은 언제나 위치 글자). */}
          <div className={`mt-1 flex min-w-0 items-start gap-1 ${isColumn ? 'justify-center' : ''}`}>
            <MapPin size={12} aria-hidden="true" className="mt-[2px] shrink-0" style={{ color: 'var(--region-accent)' }} />
            <div data-testid="status-context-line" className={`flex min-h-[18px] min-w-0 flex-wrap items-center gap-x-1 gap-y-1 ${isColumn ? 'justify-center' : ''}`}>
                <span data-testid="status-location" className="min-w-0 font-readable text-[11px] font-semibold leading-tight" style={{ color: 'var(--region-accent)' }}>
                  {getVisibleLocationName(player, player.loc)}
                </span>
                {expeditionChips.map((chip) => (
                  <span
                    key={chip.id}
                    data-testid={`status-${chip.id}-chip`}
                    className={`ae-chip ${chip.tone === 'warning' ? 'ae-chip-gold' : 'ae-chip-ether'} ae-status-chip shrink-0 font-fira tabular-nums`}
                  >
                    {chip.label}
                  </span>
                ))}
                {(player.killStreak || 0) >= 3 && (
                  <span className="ae-chip ae-chip-gold ae-status-chip shrink-0 font-fira tabular-nums">{MSG.SHELL_KILL_STREAK(player.killStreak || 0)}</span>
                )}
                {/* cycle 111: 활성 디버프 chip — 전투 로그에만 나오고 스크롤되어 사라지던 상태이상을 상시 표시.
                    위험 톤 하나로 통합(모든 상태이상이 플레이어에게 부정적이다). */}
                {Array.isArray(player.status) && player.status.length > 0 && (() => {
                  // 2026-09 Wave 6 X2: 인라인 DEBUFF_LABELS 제거 — MSG.STATUS_LABELS(공유 테이블) 재사용.
                  const DEBUFF_LABELS = MSG.STATUS_LABELS as Record<string, string>;
                  const debuffs = player.status.filter((s) => DEBUFF_LABELS[s]);
                  if (debuffs.length === 0) return null;
                  const headLabel = DEBUFF_LABELS[debuffs[0] as string] || debuffs[0];
                  const showCount = debuffs.length > 1;
                  return (
                    <span
                      data-testid="status-debuff-chip"
                      data-debuff-count={debuffs.length}
                      className="ae-chip ae-chip-threat ae-status-chip shrink-0 font-fira tabular-nums"
                      aria-label={MSG.STATUS_AILMENT_ARIA(debuffs.length, debuffs.map((d) => DEBUFF_LABELS[d] || d).join(', '))}
                    >
                      {headLabel}{showCount ? ` +${debuffs.length - 1}` : ''}
                    </span>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>
      <div data-testid="status-metrics" className={`mt-2 grid gap-1.5 ${isColumn ? 'grid-cols-1' : 'grid-cols-3'}`}>
        <StatusMetric label="생명" value={player.hp} max={stats?.maxHp} variant="hp" />
        <StatusMetric label="기력" value={player.mp} max={stats?.maxMp} variant="mp" />
        <StatusMetric label="경험" value={player.exp} max={player.nextExp} variant="exp" />
      </div>
    </section>
  );
};

export default StatusBar;
