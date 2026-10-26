import { MSG } from '../../data/messages.js';
import Gauge, { type GaugeKind } from '../ui/Gauge';

type VitalTone = 'hp' | 'mp';

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
      <span className={`aether-type-label shrink-0 font-bold ${theme.label}`}>{label}</span>
      <Gauge
        kind={theme.kind}
        value={safeValue}
        max={safeMax}
        label={label}
        valueText={`${safeValue}/${safeMax}`}
        className="ae-combat-vital-gauge min-w-0 flex-1"
        data-testid={`combat-player-${tone}-fill`}
      />
      <span data-testid={`combat-player-${tone}-value`} className="aether-type-label shrink-0 whitespace-nowrap font-fira font-semibold tabular-nums text-ae-ink">
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
}

/**
 * 전투 조작판의 내 생명 · 기력 막대(2026-10 감사 VD-02 · GF-05, 에테르 유리 게이지).
 *
 * 행동 단추 바로 위 — 적의 반격이 내 쪽에 떨어지는 자리다. 맞으면 우물 칸이 생명색으로 번쩍이고 1 ~ 2px 흔들린다
 * (모션 감소 설정이면 번쩍임만 — index.css `w3:combat`). 수치 · 판정은 바뀌지 않는다.
 */
const CombatVitalsStrip = ({ hp, maxHp, mp, maxMp, damageFlash = false, healFlash = false }: CombatVitalsStripProps) => {
  const flashState = damageFlash ? 'damage' : healFlash ? 'heal' : undefined;
  return (
    <div
      data-testid="combat-player-vitals"
      data-vitals-flash={flashState}
      role="group"
      aria-label={MSG.COMBAT_VITALS_ARIA}
      className="ae-well ae-combat-vitals grid grid-cols-2 gap-3 rounded-ae-sm px-3 py-2"
    >
      <VitalMeter tone="hp" label={MSG.COMBAT_VITALS_HP} value={hp} max={maxHp} />
      <VitalMeter tone="mp" label={MSG.COMBAT_VITALS_MP} value={mp} max={maxMp} />
    </div>
  );
};

export default CombatVitalsStrip;
