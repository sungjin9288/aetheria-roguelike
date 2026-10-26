import { LockKeyhole, MapPin, Route, ScrollText, ShieldAlert, Sparkles } from 'lucide-react';
import { getLocationVisual } from '../utils/locationVisuals';

export interface RouteTopologyEntry {
    name: string;
    levelLabel?: string;
    badge?: string;
    isRecommended?: boolean;
    isMissionRoute?: boolean;
    isBoss?: boolean;
    isLocked?: boolean;
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
    const currentVisual = blindMap ? null : getLocationVisual(currentName);

    return (
        <div
            data-testid={testId}
            data-route-count={routes.length}
            className={`aether-route-topology ${compact ? 'is-compact' : ''}`}
        >
            <div className="flex justify-center">
                <div
                    data-testid={currentTestId}
                    data-location-visual={currentVisual?.key}
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
                    <span className="min-w-0 break-words">{blindMap ? '현재 위치' : currentName}</span>
                </div>
            </div>

            <div data-testid={connectorTestId} className="aether-route-topology-connector" aria-hidden="true">
                <span />
            </div>

            <div className="aether-route-topology-branches" aria-label="연결된 이동 경로">
                {routes.map((route, index) => {
                    const marker = getRouteMarker(route);
                    const locationVisual = blindMap ? null : getLocationVisual(route.name);
                    const displayName = blindMap ? `미확인 경로 ${index + 1}` : route.name;
                    const disabled = Boolean(route.isLocked && disableLockedRoutes);

                    return (
                        <div key={route.name} className="aether-route-topology-branch">
                            <button
                                type="button"
                                data-testid={routeTestId?.(route, index)}
                                data-route-index={index}
                                data-location-visual={locationVisual?.key}
                                aria-pressed={selectedName === route.name}
                                aria-label={`${displayName}${marker ? `, ${marker.label}` : ''}`}
                                disabled={disabled}
                                onClick={() => onSelect?.(route)}
                                className={`aether-route-topology-node ${selectedName === route.name ? 'is-selected' : ''} ${route.isRecommended ? 'is-recommended' : ''} ${route.isMissionRoute ? 'is-mission' : ''} ${route.isBoss ? 'is-boss' : ''} ${route.isLocked ? 'is-locked' : ''}`}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    {locationVisual && (
                                        <img
                                            src={locationVisual.src}
                                            alt=""
                                            draggable={false}
                                            className="aether-route-region-art is-branch"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        {/* 2026-10 통합 감사(UX-02): 좁은 칸에서 칩과 지역 이름이 한 줄을 나눠 쓰며 이름이 한 글자씩 세로로 꺾였다
                                            ("고요한 숲"이 폭 23px · 3줄 — 첫 임무의 목적지다). MapSignalStrip과 같은 규칙: 칩은 줄지 않고,
                                            한 줄에 안 들어가면 칩이 다음 줄로 내려간다. 이름은 최소 폭을 지킨다. */}
                                        <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5">
                                            <strong className="aether-route-topology-name aether-type-body min-w-[min(4.5rem,100%)] break-words font-readable font-semibold text-ae-ink">
                                                {displayName}
                                            </strong>
                                            {marker && (
                                                <span className="aether-type-label inline-flex shrink-0 items-center gap-1 font-readable font-semibold text-ae-ink-2">
                                                    <marker.Icon size={12} aria-hidden="true" />
                                                    {marker.label}
                                                </span>
                                            )}
                                        </span>
                                        <span className="aether-type-meta mt-1 flex min-w-0 items-center justify-between gap-1.5 font-readable text-ae-ink-3">
                                            <span className="break-words">
                                                {blindMap ? '정보 없음' : [route.levelLabel, route.badge].filter(Boolean).join(' · ')}
                                            </span>
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
