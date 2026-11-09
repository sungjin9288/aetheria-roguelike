import { MSG } from '../../data/messages.js';
import Gauge, { type GaugeKind } from '../ui/Gauge';

type VitalTone = 'hp' | 'mp';

/** App의 `useDamageFlash` 숫자(내 생명의 변화량) — type 모양만 받아 훅 모듈을 불러오지 않는다. */
export type VitalsFloatAmount = { value: number; isHeal: boolean } | null;

/** 생명 = life, 기력 = will — 막대 색 · 이름 글자색은 디자인 토큰 하나에서 온다. */
const VITAL_TONE: Record<VitalTone, { kind: GaugeKind; label: string }> = {
  hp: { kind: 'life', label: 'text-ae-life' },
  mp: { kind: 'will', label: 'text-ae-will' },
};

interface VitalMeterProps {
  tone: VitalTone;
  label: string;
  value: number;
  max: number;
}

const VitalMeter = ({ tone, label, value, max }: VitalMeterProps) => {
  const theme = VITAL_TONE[tone];
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, value);
  return (
    <div data-testid={`combat-player-${tone}`} className="flex min-w-0 items-center gap-2 font-readable">
      {/* 소유자 결정 D9(2026-10-26): 화면 낭독기는 막대(meter — 이름 · 값) 한 번만 읽는다. 보이는 이름 · 값 글자는 같은 사실이라 숨긴다. */}
      <span aria-hidden="true" className={`aether-type-label shrink-0 font-bold ${theme.label}`}>{label}</span>
      <Gauge
        kind={theme.kind}
        value={safeValue}
        max={safeMax}
        label={label}
        valueText={`${safeValue}/${safeMax}`}
        // 2026-11 A1: 생명 막대는 두 층 — 앞 층은 곧바로 줄고 잔상이 늦게 따라 준다(맞은 만큼이 잠깐 보인다).
        lagTrail={tone === 'hp'}
        className="ae-combat-vital-gauge min-w-0 flex-1"
        data-testid={`combat-player-${tone}-fill`}
      />
      <span aria-hidden="true" data-testid={`combat-player-${tone}-value`} className="aether-type-label shrink-0 whitespace-nowrap font-fira font-semibold tabular-nums text-ae-ink">
        {safeValue}/{safeMax}
      </span>
    </div>
  );
};

interface CombatVitalsStripProps {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  /** App의 `useDamageFlash` 상태 그대로 — 생명이 줄어든 순간. */
  damageFlash?: boolean;
  /** 같은 상태의 회복 쪽 — 생명이 늘어난 순간. */
  healFlash?: boolean;
  /** 내 생명의 변화량(2026-11 A1) — 맞은 자리(내 생명 막대 위)에서 떠오른다. 화면 가운데에는 적 무대가 있다. */
  damageAmount?: VitalsFloatAmount;
}

/**
 * 전투 조작판의 내 생명 · 기력 막대(2026-10 감사 VD-02 · GF-05, 에테르 유리 게이지).
 *
 * 행동 단추 바로 위 — 적의 반격이 내 쪽에 떨어지는 자리다. 맞으면 우물 칸이 생명색으로 번쩍이고 1 ~ 2px 흔들린다
 * (모션 감소 설정이면 번쩍임만 — index.css `w3:combat`). 수치 · 판정은 바뀌지 않는다.
 */
const CombatVitalsStrip = ({ hp, maxHp, mp, maxMp, damageFlash = false, healFlash = false, damageAmount = null }: CombatVitalsStripProps) => {
  const flashState = damageFlash ? 'damage' : healFlash ? 'heal' : undefined;
  return (
    <div
      data-testid="combat-player-vitals"
      data-vitals-flash={flashState}
      role="group"
      aria-label={MSG.COMBAT_VITALS_ARIA}
      className="ae-well ae-combat-vitals relative grid grid-cols-2 gap-3 rounded-ae-sm px-3 py-2"
    >
      {/* 숫자는 막대 위 장식이다 — 화면 낭독기는 막대(meter)의 값만 읽는다. key가 바뀌면 같은 수치의 연속 피해도 다시 떠오른다. */}
      {damageAmount && (
        <span
          key={`${damageAmount.isHeal ? 'heal' : 'hit'}-${damageAmount.value}-${hp}`}
          aria-hidden="true"
          data-testid="damage-number"
          data-heal={damageAmount.isHeal ? 'true' : undefined}
          className={`ae-vitals-float pointer-events-none absolute left-[25%] top-0 z-10 font-fira text-[18px] font-bold tabular-nums ${
            damageAmount.isHeal ? 'text-ae-good' : 'text-ae-life'
          }`}
        >
          {damageAmount.isHeal ? '+' : '-'}{damageAmount.value}
        </span>
      )}
      <VitalMeter tone="hp" label={MSG.COMBAT_VITALS_HP} value={hp} max={maxHp} />
      <VitalMeter tone="mp" label={MSG.COMBAT_VITALS_MP} value={mp} max={maxMp} />
    </div>
  );
};

export default CombatVitalsStrip;
