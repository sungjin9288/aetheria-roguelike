import {
    Coins,
    MapPinned,
    Navigation,
    PackageOpen,
    ShieldCheck,
} from 'lucide-react';
import { getGraveRecoveryGroups } from '../utils/graveUtils';
import type { GameActions } from '../hooks/actionDeps';
import type { GameState } from '../reducers/gameReducer';
import type { Item, Player } from '../types/index.js';
import { getVisibleLocationName } from '../utils/challengeRules';

/**
 * GravePanel이 실제로 호출하는 액션만 좁혀 받는다 (이곳 유해 회수).
 * 2026-10 Wave 70: 다른 모험가의 공개 묘비를 목록에서 골라 침공하던 화면(꺼져 있었다)은 없앴다 — 다른 플레이어의 묘비는
 * 이제 탐험 중 "다른 차원의 묘비" 이벤트로 만난다(`utils/dimensionGrave.ts`). 이 패널은 내 유해 회수만 보인다.
 */
type GravePanelActions = Pick<GameActions, 'lootGrave'>;

interface GravePanelProps {
    player: Player;
    grave?: GameState['grave'];
    actions?: GravePanelActions;
    onOpenMap?: () => void;
}

const GravePanel = ({
    player,
    grave,
    actions,
    onOpenMap,
}: GravePanelProps) => {

    // 2026-10 Wave 62 (원장 §61.4 C16): 회수 골드는 실제로 받는 금액이다('빈손의 시작'이면 절반) — 묶음이 회수와 같은 규칙으로 계산한다.
    //   총계는 지역마다 받는 금액의 합이다(회수는 지역마다 한 번).
    const recoveryGroups = getGraveRecoveryGroups(grave, player?.loc, player);
    const recoveryGold = recoveryGroups.reduce((sum, group) => sum + group.gold, 0);
    const recoveryItems = recoveryGroups.reduce((sum, group) => sum + group.items.length, 0);
    const tierColor = (item: Item | null | undefined) => {
        if ((item?.tier || 1) >= 5) return 'text-yellow-200 border-yellow-200/24';
        if ((item?.tier || 1) >= 4) return 'text-fuchsia-200 border-fuchsia-200/22';
        if ((item?.tier || 1) >= 3) return 'text-sky-200 border-sky-200/22';
        return 'text-slate-300 border-white/10';
    };

    return (
        <div data-testid="grave-recovery-panel" className="space-y-3 pb-2">
            <div
                role="tablist"
                aria-label="무덤 기록"
                className="grid grid-cols-1 gap-1 rounded-lg border border-white/8 bg-black/20 p-1"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected
                    data-testid="grave-view-mine"
                    className="min-h-[44px] rounded-md bg-[#d5b180]/14 px-3 text-[12px] font-readable font-bold text-[#f4e6c8] transition-colors"
                >
                    내 유해 {recoveryGroups.length > 0 ? recoveryGroups.length : ''}
                </button>
            </div>

            <section data-testid="grave-mine-view" className="space-y-3">
                {recoveryGroups.length === 0 ? (
                    <div className="flex min-h-[148px] flex-col items-center justify-center border-y border-white/8 px-5 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200/16 bg-emerald-300/[0.05] text-emerald-100/80">
                            <ShieldCheck size={20} />
                        </span>
                        <h3 className="mt-3 text-[14px] font-readable font-bold text-white/90">잃어버린 유해가 없습니다</h3>
                        <p className="mt-1 text-[12px] font-readable text-slate-400">다음 원정을 준비할 수 있습니다.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-3">
                            <div className="px-2 text-center">
                                <div className="text-[11px] font-readable text-slate-400">회수 지역</div>
                                <strong className="mt-1 block text-[16px] font-readable text-white/92">{recoveryGroups.length}</strong>
                            </div>
                            <div className="px-2 text-center">
                                <div className="text-[11px] font-readable text-slate-400">골드</div>
                                <strong className="mt-1 block text-[16px] font-readable text-[#f0d69b]">{recoveryGold.toLocaleString('ko-KR')}</strong>
                            </div>
                            <div className="px-2 text-center">
                                <div className="text-[11px] font-readable text-slate-400">장비·물품</div>
                                <strong className="mt-1 block text-[16px] font-readable text-[#bcebea]">{recoveryItems}</strong>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {recoveryGroups.map((group) => (
                                <article
                                    key={group.loc}
                                    data-testid={`grave-recovery-${group.loc}`}
                                    data-current-location={group.atCurrentLocation ? 'true' : 'false'}
                                    className={`rounded-lg border p-3 ${group.atCurrentLocation
                                        ? 'border-[#d5b180]/28 bg-[#d5b180]/[0.06]'
                                        : 'border-white/9 bg-black/16'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 text-[11px] font-readable text-slate-400">
                                                <MapPinned size={13} />
                                                <span>{group.atCurrentLocation ? '현재 위치' : '회수 목적지'}</span>
                                                {group.count > 1 && <span>· 유해 {group.count}구</span>}
                                            </div>
                                            <h3 className="mt-1 truncate text-[15px] font-readable font-bold text-white/92">{getVisibleLocationName(player, group.loc)}</h3>
                                        </div>
                                        {group.atCurrentLocation && (
                                            <span className="shrink-0 rounded-md border border-[#d5b180]/24 bg-[#d5b180]/10 px-2 py-1 text-[11px] font-readable text-[#f4e6c8]">
                                                회수 가능
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-readable">
                                        <span className="inline-flex items-center gap-1.5 text-[#f0d69b]">
                                            <Coins size={13} /> {group.gold.toLocaleString('ko-KR')} 골드
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-[#bcebea]">
                                            <PackageOpen size={13} /> {group.items.length}개
                                        </span>
                                    </div>

                                    {group.items.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {group.items.slice(0, 3).map((item, index) => (
                                                <span
                                                    key={`${item.id || item.name}-${index}`}
                                                    className={`rounded-md border bg-black/18 px-2 py-1 text-[11px] font-readable ${tierColor(item)}`}
                                                >
                                                    {item.name || '이름 없는 물품'}
                                                </span>
                                            ))}
                                            {group.items.length > 3 && (
                                                <span className="rounded-md border border-white/8 bg-black/18 px-2 py-1 text-[11px] font-readable text-slate-400">
                                                    +{group.items.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        data-testid={group.atCurrentLocation ? 'grave-recover-here' : `grave-open-map-${group.loc}`}
                                        onClick={group.atCurrentLocation ? actions?.lootGrave : onOpenMap}
                                        className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border px-3 text-[12px] font-readable font-bold transition-colors ${group.atCurrentLocation
                                            ? 'border-[#d5b180]/32 bg-[#d5b180]/12 text-[#f4e6c8] hover:bg-[#d5b180]/18'
                                            : 'border-[#7dd4d8]/24 bg-[#7dd4d8]/[0.06] text-[#dff7f5] hover:bg-[#7dd4d8]/12'
                                        }`}
                                    >
                                        {group.atCurrentLocation ? <PackageOpen size={15} /> : <Navigation size={15} />}
                                        {group.atCurrentLocation ? '이곳 유해 회수' : '지도에서 경로 확인'}
                                    </button>
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default GravePanel;
