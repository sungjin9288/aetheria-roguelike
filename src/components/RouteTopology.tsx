import { LockKeyhole, MapPin, Route, ScrollText, ShieldAlert, Sparkles } from 'lucide-react';
import { getRegionVisual } from '../utils/monsterVisuals';

export interface RouteTopologyEntry {
    name: string;
    levelLabel?: string;
    badge?: string;
    isRecommended?: boolean;
    isMissionRoute?: boolean;
    isBoss?: boolean;
    isLocked?: boolean;
    undiscoveredSignatureCount?: number;
}

interface RouteTopologyProps {
    currentName: string;
    routes: RouteTopologyEntry[];
    selectedName?: string | null;
    blindMap?: boolean;
    compact?: boolean;
    disableLockedRoutes?: boolean;
    onSelect?: (route: RouteTopologyEntry) => void;
    testId?: string;
    currentTestId?: string;
    connectorTestId?: string;
    routeTestId?: (route: RouteTopologyEntry, index: number) => string | undefined;
}

const getRouteMarker = (route: RouteTopologyEntry) => {
    if (route.isLocked) return { Icon: LockKeyhole, label: '잠김' };
    if (route.isMissionRoute) return { Icon: ScrollText, label: '임무 경로' };
    if (route.isBoss) return { Icon: ShieldAlert, label: '보스' };
    if (route.isRecommended) return { Icon: Route, label: '추천' };
    return null;
};

const RouteTopology = ({
    currentName,
    routes,
    selectedName,
    blindMap = false,
    compact = false,
    disableLockedRoutes = false,
    onSelect,
    testId,
    currentTestId,
    connectorTestId,
    routeTestId,
}: RouteTopologyProps) => {
    const currentVisual = blindMap ? null : getRegionVisual(currentName);

    return (
        <div
            data-testid={testId}
            data-route-count={routes.length}
            className={`aether-route-topology ${compact ? 'is-compact' : ''}`}
        >
            <div className="flex justify-center">
                <div
                    data-testid={currentTestId}
                    data-region-family={currentVisual?.key}
                    className="aether-route-topology-current"
                    aria-label={`현재 위치 ${blindMap ? '미확인' : currentName}`}
                >
                    {currentVisual ? (
                        <img
                            src={currentVisual.src}
                            alt=""
                            draggable={false}
                            className="aether-route-region-art"
                        />
                    ) : (
                        <MapPin size={compact ? 13 : 15} aria-hidden="true" />
                    )}
                    <span className="min-w-0 truncate">{blindMap ? '현재 위치' : currentName}</span>
                </div>
            </div>

            <div data-testid={connectorTestId} className="aether-route-topology-connector" aria-hidden="true">
                <span />
            </div>

            <div className="aether-route-topology-branches" aria-label="연결된 이동 경로">
                {routes.map((route, index) => {
                    const marker = getRouteMarker(route);
                    const regionVisual = blindMap ? null : getRegionVisual(route.name);
                    const displayName = blindMap ? `미확인 경로 ${index + 1}` : route.name;
                    const disabled = Boolean(route.isLocked && disableLockedRoutes);

                    return (
                        <div key={route.name} className="aether-route-topology-branch">
                            <button
                                type="button"
                                data-testid={routeTestId?.(route, index)}
                                data-route-index={index}
                                data-region-family={regionVisual?.key}
                                aria-pressed={selectedName === route.name}
                                aria-label={`${displayName}${marker ? `, ${marker.label}` : ''}`}
                                disabled={disabled}
                                onClick={() => onSelect?.(route)}
                                className={`aether-route-topology-node ${selectedName === route.name ? 'is-selected' : ''} ${route.isRecommended ? 'is-recommended' : ''} ${route.isMissionRoute ? 'is-mission' : ''} ${route.isBoss ? 'is-boss' : ''} ${route.isLocked ? 'is-locked' : ''}`}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    {regionVisual && (
                                        <img
                                            src={regionVisual.src}
                                            alt=""
                                            draggable={false}
                                            className="aether-route-region-art is-branch"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="flex min-w-0 items-center justify-between gap-1.5">
                                            <strong className="min-w-0 truncate font-readable text-[11px] font-semibold text-white/92">
                                                {displayName}
                                            </strong>
                                            {marker && (
                                                <span className="inline-flex shrink-0 items-center gap-1 font-readable text-[8px] font-semibold text-slate-300/80">
                                                    <marker.Icon size={10} aria-hidden="true" />
                                                    {marker.label}
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-1 flex min-w-0 items-center justify-between gap-1.5 font-readable text-[9px] text-slate-400/82">
                                            <span className="truncate">
                                                {blindMap ? '정보 없음' : [route.levelLabel, route.badge].filter(Boolean).join(' · ')}
                                            </span>
                                            {!blindMap && (route.undiscoveredSignatureCount || 0) > 0 && (
                                                <span
                                                    data-testid={`move-recommendation-signature-${index}`}
                                                    data-signature-count={route.undiscoveredSignatureCount}
                                                    className="inline-flex shrink-0 items-center gap-0.5 text-[#f6e7a2]"
                                                    aria-label={`미발견 전설 각인 ${route.undiscoveredSignatureCount}종`}
                                                >
                                                    <Sparkles size={9} aria-hidden="true" />
                                                    {route.undiscoveredSignatureCount}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RouteTopology;
