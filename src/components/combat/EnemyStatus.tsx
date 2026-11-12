import { Ban, Flame, Hourglass, Shield, ShieldOff, Sword, Swords, TriangleAlert, Zap, type LucideIcon } from 'lucide-react';
import SignalBadge from '../SignalBadge';
import Chip, { type ChipTone } from '../ui/Chip';
import EnemyPortrait from './EnemyPortrait';
import { useHitFlash } from '../../hooks/useHitFlash';
import { getEnemyRank } from '../../utils/enemyRank';
import { MSG } from '../../data/messages.js';
import type { EnemyIntent, EnemyIntentKind } from '../../utils/enemyIntent';
import type { Monster } from '../../types/index.js';

// 감사 A11Y-06: 전투 화면의 적 정보는 제목이 있는 영역이다(화면 낭독기 영역 · 제목 이동).
const ENEMY_STATUS_HEADING_ID = 'combat-enemy-status-heading';

/**
 * 적 카드의 배치 — `card`는 상태 카드 안의 한 줄(데스크톱 왼쪽 열), `stage`는 전투 화면 가운데의 무대(휴대폰, 2026-11 디자인 고도화 A1).
 * 무대는 남는 높이를 채우고, 초상 크기 · 배치는 무대 높이가 정한다(index.css `w3:stage`의 컨테이너 쿼리 — 160px 세로 · 80px 세로 · 80px 가로 줄, 원본의 정수 배율).
 */
export type EnemyStatusLayout = 'card' | 'stage';

interface EnemyStatusProps {
  enemy?: Monster | null;
  enemyHitCrit?: boolean;
  /** 처치 순간(게임 필 GF-02) — 쓰러진 적을 막대 0 · 마지막 피해 숫자 · '처치' 도장으로 그린다. */
  defeated?: boolean;
  layout?: EnemyStatusLayout;
  /** 무대 뒤에 흐리게 까는 지역 그림(길 잃은 여행이면 없다 — `getVisibleLocationVisual`). */
  backdropSrc?: string | null;
  /** 다음 행동 의도(A4 — `getEnemyIntent`). 처치 순간에는 그리지 않는다. */
  intent?: EnemyIntent | null;
}

const INTENT_PRESENTATION: Record<EnemyIntentKind, { icon: LucideIcon; tone: ChipTone }> = {
  attack: { icon: Sword, tone: 'neutral' },
  heavy: { icon: Swords, tone: 'threat' },
  guard: { icon: Shield, tone: 'ether' },
  stunned: { icon: Ban, tone: 'good' },
  breath: { icon: Flame, tone: 'threat' },
  phase: { icon: TriangleAlert, tone: 'threat' },
  charge: { icon: Zap, tone: 'threat' },
  charging: { icon: Hourglass, tone: 'neutral' },
  broken: { icon: ShieldOff, tone: 'good' },
};

/**
 * 적의 다음 행동(2026-11 디자인 고도화 A4) — 아이콘 · 예고 문구 · 그 행동 한 번의 예상 피해 · 맞으면 걸릴 상태.
 * 정보만이다 — 권장 대응은 없앴다(소유자 결정 Q2, Wave 88 "반응은 플레이어 몫").
 */
const EnemyIntentChip = ({ intent, centered }: { intent: EnemyIntent; centered: boolean }) => {
  const presentation = INTENT_PRESENTATION[intent.kind];
  const Icon = presentation.icon;
  return (
    <div className={`ae-enemy-intent mt-1 flex min-w-0 ${centered ? 'justify-center' : ''}`}>
      <Chip
        data-testid="enemy-intent"
        data-intent-kind={intent.kind}
        tone={presentation.tone}
        icon={<Icon size={13} strokeWidth={2.2} />}
        className="ae-enemy-intent-chip max-w-full flex-wrap gap-y-0.5 whitespace-normal rounded-ae-sm"
      >
        <span className="sr-only">{MSG.ENEMY_INTENT_SR_PREFIX}</span>
        <span data-testid="enemy-intent-label">{intent.label}</span>
        {intent.hit !== null && (
          <span data-testid="enemy-intent-hit" className="whitespace-nowrap font-fira font-bold tabular-nums text-ae-ink">{MSG.ENEMY_INTENT_HIT(intent.hit)}</span>
        )}
        {intent.status && <span data-testid="enemy-intent-status" className="whitespace-nowrap text-ae-ink-2">{intent.status}</span>}
      </Chip>
    </div>
  );
};

interface EnemyHealthProps {
  safeValue: number;
  safeMax: number;
  percentage: number;
}

const EnemyHealth = ({ safeValue, safeMax, percentage }: EnemyHealthProps) => (
  <div className="flex items-center gap-2">
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
);

interface EnemyTitleProps {
  enemy: Monster;
  centered: boolean;
}

const EnemyTitle = ({ enemy, centered }: EnemyTitleProps) => (
  <>
    <h2 id={ENEMY_STATUS_HEADING_ID} data-testid="enemy-status-label" className={`ae-eyebrow font-readable ${centered ? 'text-center' : ''}`}>
      {MSG.SHELL_ENEMY_HEADING}
    </h2>
    <div className={`mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 ${centered ? 'justify-center' : ''}`}>
      <span className={`min-w-0 font-display font-bold leading-snug text-ae-ink ${centered ? 'text-[16px]' : 'text-[15px]'}`}>{enemy.name}</span>
      {typeof enemy.level === 'number' && (
        <SignalBadge tone="neutral" size="sm" data-testid="enemy-level-badge">
          {MSG.SHELL_ENEMY_LEVEL(enemy.level, enemy.levelBonus ?? 0)}
        </SignalBadge>
      )}
      {enemy.isBoss && <SignalBadge tone="danger" size="sm">{MSG.SHELL_BOSS}</SignalBadge>}
    </div>
  </>
);

/**
 * 교전 대상 — 적이 피해를 받으면 초상이 번쩍이고(치명타는 잠깐 멈췄다 흔들린다) 피해 숫자가 맞은 자리에서 떠오른다.
 * 연출은 적 생명의 변화(`useHitFlash`)와 그 차례의 치명타 사실만 읽는다 — 판정 · 난수 · 기록 줄은 바꾸지 않는다.
 */
const EnemyStatus = ({ enemy, enemyHitCrit, defeated = false, layout = 'card', backdropSrc = null, intent = null }: EnemyStatusProps) => {
  const { flash, amount } = useHitFlash(enemy?.hp, enemy?.name, { crit: !!enemyHitCrit });
  if (!enemy) return null;

  const safeMax = Math.max(1, enemy.maxHp || 1);
  const safeValue = Math.max(0, enemy.hp || 0);
  const percentage = Math.min(100, (safeValue / safeMax) * 100);
  const isCritHit = Boolean(amount?.meta?.crit);
  // 2026-10 감사 VD-02: 적의 무게(보스 · 우두머리 · 정예 · 일반)가 카드 · 초상 테두리 · 생명 막대 색을 정한다(index.css).
  const rank = getEnemyRank(enemy);
  const isStage = layout === 'stage';
  const hitState = flash && !defeated ? (isCritHit ? 'crit' : 'hit') : undefined;
  const intentChip = intent && !defeated ? <EnemyIntentChip intent={intent} centered={isStage} /> : null;

  // 적 피해 숫자 — 치명타는 금빛에 별표(✦)를 단다(전투 연출 계약이 이 글자를 읽는다). 무대에서는 초상 위, 카드에서는 오른쪽 위다.
  const damageNumber = amount && (
    <span
      key={amount.key}
      data-crit={isCritHit ? 'true' : undefined}
      data-testid="enemy-damage-number"
      className={isStage
        ? `ae-enemy-damage ae-stage-damage pointer-events-none absolute left-1/2 top-[14%] z-10 font-fira font-bold tabular-nums ${isCritHit ? 'is-crit text-ae-gold-hi' : 'text-ae-ink'}`
        : `ae-enemy-damage pointer-events-none absolute right-3 top-1 z-10 font-fira font-bold tabular-nums ${isCritHit ? 'text-xl text-ae-gold-hi' : 'text-base text-ae-ink'}`}
      style={isStage ? undefined : { animation: 'floatUp 0.9s cubic-bezier(.2,.8,.2,1) forwards' }}
    >
      {isCritHit ? '✦ ' : ''}-{amount.value}
    </span>
  );

  // 처치 도장(게임 필 GF-02) — 카드 전체를 어둡게 덮고 가운데에 찍는다. 마지막 일격 숫자(z-10)는 도장 위에 남는다.
  const defeatedStamp = defeated && (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-ae-void/50">
      <span
        data-testid="enemy-defeated-stamp"
        className="aether-defeated-stamp rounded-ae-xs border-2 border-ae-gold/70 bg-ae-void/80 px-3 py-1 font-display text-[16px] font-bold leading-none text-ae-gold-hi"
      >
        {MSG.COMBAT_DEFEATED_STAMP}
      </span>
    </div>
  );

  const sharedProps = {
    'data-defeated': defeated ? 'true' : undefined,
    'data-testid': 'enemy-status',
    'data-enemy-layout': layout,
    role: 'region',
    'aria-labelledby': ENEMY_STATUS_HEADING_ID,
    'data-hit-flash': flash ? 'true' : undefined,
    'data-hit-state': hitState,
    'data-enemy-rank': rank,
  };

  if (isStage) {
    return (
      <div
        {...sharedProps}
        className="aether-encounter-stage ae-encounter-stage ae-combat-stage relative h-full min-h-0 w-full overflow-hidden rounded-ae-lg px-3 pb-2.5 pt-2"
      >
        {backdropSrc && (
          <img data-testid="combat-stage-backdrop" src={backdropSrc} alt="" aria-hidden="true" className="ae-combat-stage-backdrop" />
        )}
        <div className="ae-stage-title relative z-[2] min-w-0">
          <EnemyTitle enemy={enemy} centered />
          {intentChip}
        </div>
        <div data-testid="combat-stage-arena" className="ae-combat-stage-arena relative z-[2] min-h-0">
          <EnemyPortrait enemy={enemy} rank={rank} size="stage" />
          {damageNumber}
        </div>
        <div className="ae-stage-health relative z-[2] min-w-0">
          <EnemyHealth safeValue={safeValue} safeMax={safeMax} percentage={percentage} />
        </div>
        {defeatedStamp}
      </div>
    );
  }

  return (
    <div
      {...sharedProps}
      className="aether-encounter-stage ae-encounter-stage relative mt-1.5 overflow-hidden rounded-ae-md px-3 py-2.5"
    >
      {damageNumber}
      {defeatedStamp}
      {/* 2026-10 감사 VD-02: 초상은 80px 그림(160px 원본의 정수 배율) — 생명 막대는 이름 아래로 옮겨 높이를 아낀다. */}
      <div className="flex items-center gap-3">
        <EnemyPortrait enemy={enemy} rank={rank} />
        <div className="min-w-0 flex-1">
          <EnemyTitle enemy={enemy} centered={false} />
          {intentChip}
          <div className="mt-2">
            <EnemyHealth safeValue={safeValue} safeMax={safeMax} percentage={percentage} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnemyStatus;
