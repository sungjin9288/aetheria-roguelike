import type { ReactNode } from 'react';
import { Binoculars, Compass, Map as MapIcon } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import { MSG } from '../../data/messages';
import type { getScoutAvailability } from '../../utils/scoutEvents';
import type { ControlButton } from './types';

type ScoutAvailability = ReturnType<typeof getScoutAvailability>;

interface FieldDockProps {
  explore: ControlButton;
  move: ControlButton;
  bag: ControlButton;
  /** 탐험 단추의 두 번째 줄 — 지금 지역 이름(길 잃은 여행이면 자리표시, `getVisibleLocationName`). */
  exploreSublabel: string;
  /** 기록의 지도 탭 열기 — 기록 창이 없으면 단추는 그려지되 눌리지 않는다. */
  onOpenMap?: () => void;
  scoutAvailability: ScoutAvailability;
  onScout?: () => void;
  /** 안내가 고른 행동(`ACTION_KIND_TO_BUTTON`) — 유리 단추에 에테르 림 하나를 더한다. */
  recommendedKey: string | null;
  /** 묘비 회수처럼 그 자리에서만 생기는 행동. */
  auxiliary?: ReactNode;
}

const getScoutSublabel = (scout: ScoutAvailability) => {
  if (!scout.available) return MSG.SCOUT_ACTION_COST_LABEL(scout.cost);
  return scout.isFree ? MSG.SCOUT_ACTION_FREE_LABEL(scout.remainingFree) : MSG.SCOUT_ACTION_COST_LABEL(scout.cost);
};

/**
 * 원정 도크(2026-10 에테르 유리, 시안 mock-expedition) — 탐험 하나가 금빛 주 행동(폭 전체, 둘째 줄 = 지역 이름)이고
 *   이동 · 지도 · 정찰 · 가방은 그 아래 한 줄의 유리 단추다. 넓은 칸(데스크톱 가운데 열)에서는 한 줄 도크가 된다(CSS 컨테이너 질의).
 *   정찰의 둘째 줄은 비용이다 — 판정은 `getScoutAvailability` 하나이고, 막힌 사유는 도크 아래 한 줄로 그대로 보인다.
 */
const FieldDock = ({
  explore,
  move,
  bag,
  exploreSublabel,
  onOpenMap,
  scoutAvailability,
  onScout,
  recommendedKey,
  auxiliary,
}: FieldDockProps) => {
  const MoveIcon = move.icon;
  const BagIcon = bag.icon;
  const glassClass = (key: string) => `ae-dock-btn${recommendedKey === key ? ' is-recommended' : ''}`;
  const scoutReason = scoutAvailability.available ? null : scoutAvailability.reason;

  return (
    <div className="ae-field-dock-wrap">
      <div data-testid="control-field-actions" aria-label={MSG.FIELD_DOCK_LABEL} role="group" className="ae-field-dock">
        <ActionButton
          variant="primary"
          size="lg"
          data-testid={explore.testId}
          title={explore.label}
          icon={<Compass size={20} />}
          // 이름은 행동(탐험)이다 — 보조 줄의 지역 이름은 보이는 설명일 뿐 단추 이름에 섞지 않는다(e2e explore: 이름 '탐험').
          aria-label={explore.label}
          label={explore.label}
          sublabel={exploreSublabel}
          disabled={explore.disabled}
          onClick={explore.onClick}
          className="ae-dock-primary w-full"
        />
        <ActionButton
          data-testid={move.testId}
          title={move.label}
          icon={<MoveIcon size={18} />}
          label={<span>{move.label}</span>}
          disabled={move.disabled}
          onClick={move.onClick}
          className={glassClass(move.key)}
        />
        <ActionButton
          data-testid="control-map-open"
          // 소유자 결정 2026-10-26 D12: 지도 단추는 늘 보이고, 쓸 수 없을 때는 꺼진 채 이유를 이름 · 툴팁으로 말한다.
          title={onOpenMap ? MSG.FIELD_ACTION_MAP : MSG.FIELD_ACTION_MAP_UNAVAILABLE}
          aria-label={onOpenMap ? MSG.FIELD_ACTION_MAP : MSG.FIELD_ACTION_MAP_UNAVAILABLE}
          icon={<MapIcon size={18} />}
          label={<span>{MSG.FIELD_ACTION_MAP}</span>}
          disabled={!onOpenMap}
          onClick={onOpenMap}
          className={glassClass('map')}
        />
        <ActionButton
          data-testid="control-scout"
          disabled={!scoutAvailability.available || !onScout}
          title={scoutAvailability.reason || MSG.SCOUT_ACTION_HINT}
          icon={<Binoculars size={18} />}
          label={MSG.SCOUT_ACTION_LABEL}
          sublabel={(
            <span data-testid="control-scout-cost" className="font-fira tabular-nums">
              {getScoutSublabel(scoutAvailability)}
            </span>
          )}
          onClick={onScout}
          className={glassClass('scout')}
        />
        <ActionButton
          data-testid={bag.testId}
          title={bag.label}
          icon={<BagIcon size={18} />}
          label={<span>{bag.label}</span>}
          disabled={bag.disabled}
          onClick={bag.onClick}
          className={glassClass(bag.key)}
        />
      </div>
      {scoutReason && (
        <p data-testid="control-scout-reason" className="mt-1.5 px-1 aether-type-meta text-ae-ink-3">
          {scoutReason}
        </p>
      )}
      {auxiliary}
    </div>
  );
};

export default FieldDock;
