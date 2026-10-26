import { Route } from 'lucide-react';
import Chip from '../ui/Chip';
import type { MoveRecommendation } from '../../utils/adventureGuide';
import type { Player } from '../../types/index.js';
import { MSG } from '../../data/messages';

interface MapSignalStripProps {
  player: Player;
  routes: MoveRecommendation[];
}

/**
 * 추천 경로 줄(2026-10 에테르 유리) — 지금 지역의 이름 · 종류 · 그림은 기록 창 머리(장면 카드)가 그리고,
 *   이 줄은 다음으로 걸을 길 하나만 말한다. 지도는 도크의 '지도' 단추가 연다(UX-03: 같은 동작의 단추 둘을 두지 않는다).
 *   좁은 폭에서 칩은 줄지 않고, 한 줄에 안 들어가면 지역 이름이 다음 줄로 내려간다(2026-10 제품 통합 수용).
 */
const MapSignalStrip = ({ player, routes }: MapSignalStripProps) => {
  const recommendedRoute = routes?.[0] || null;
  const blindMap = player?.challengeModifiers?.includes('blindMap');
  const routeName = blindMap ? MSG.BLIND_MAP_ROUTE_NAME : (recommendedRoute?.name || MSG.FIELD_ROUTE_NONE);
  const routeBadge = recommendedRoute?.isRecommended
    ? MSG.FIELD_ROUTE_RECOMMENDED
    : (recommendedRoute?.badge || MSG.FIELD_ROUTE_IDLE);

  return (
    <section
      data-testid="control-map-signal"
      aria-label={MSG.FIELD_ROUTE_SIGNAL_LABEL}
      className="ae-route-signal flex min-h-[44px] items-center gap-2.5 px-3 py-2 font-readable"
    >
      <span className="ae-route-signal-icon" aria-hidden="true"><Route size={16} /></span>
      <span className="sr-only">{MSG.FIELD_ROUTE_SIGNAL_SR}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="shrink-0 whitespace-nowrap">
          <Chip tone="ether">{routeBadge}</Chip>
        </span>
        <span className="min-w-0 aether-type-title font-semibold text-ae-ink">{routeName}</span>
      </div>
    </section>
  );
};

export default MapSignalStrip;
