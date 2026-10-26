import { ChevronLeft } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import RouteTopology, { type RouteTopologyEntry } from '../RouteTopology';
import type { MoveRecommendation } from '../../utils/adventureGuide';
import { MSG } from '../../data/messages';

interface RouteBoardProps {
  currentName: string;
  routes: RouteTopologyEntry[];
  recommendation: MoveRecommendation | null;
  blindMap: boolean;
  onSelect: (route: RouteTopologyEntry) => void;
  onCancel: () => void;
}

/**
 * 이동 경로 보드(2026-10 에테르 유리) — 카드 하나 안에 지금 위치 → 갈림길(RouteTopology)과 추천 한 줄, 아래에 뒤로 단추.
 *   추천 줄의 이유 · 귀환은 안내 문구 계약(guidance-rendered-text-contract)이 그려지기를 요구하는 칸이다.
 */
const RouteBoard = ({ currentName, routes, recommendation, blindMap, onSelect, onCancel }: RouteBoardProps) => (
  <div className="space-y-2">
    <div data-testid="control-route-board" className="ae-card is-quiet px-3 py-3 font-readable">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="ae-eyebrow">이동 경로</div>
        <div className="aether-type-meta text-ae-ink-3">지역을 눌러 이동</div>
      </div>
      <RouteTopology
        compact
        disableLockedRoutes
        testId="control-route-topology"
        currentTestId="control-route-current"
        connectorTestId="control-route-connector"
        currentName={currentName}
        routes={routes}
        blindMap={blindMap}
        onSelect={onSelect}
        routeTestId={(route) => `control-route-option-${route.name}`}
      />
      {recommendation && (
        <div data-testid="control-route-guide" className="ae-route-guide mt-2.5 px-0.5 pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 aether-type-meta">
            <span className="font-semibold text-ae-ether-hi">추천 · {recommendation.name}</span>
            <span className="text-ae-ink-2">귀환 · {recommendation.routePlan.returnLabel}</span>
          </div>
          <p className="mt-1 aether-type-meta text-ae-ink-2">
            {recommendation.reason}
          </p>
        </div>
      )}
    </div>
    <ActionButton
      variant="ghost"
      data-testid="control-move-cancel"
      onClick={onCancel}
      icon={<ChevronLeft size={16} />}
      label={MSG.UI_BACK}
      className="w-full"
    />
  </div>
);

export default RouteBoard;
