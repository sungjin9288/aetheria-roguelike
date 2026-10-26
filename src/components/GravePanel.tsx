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
import { MSG } from '../data/messages';
import ActionButton from './ui/ActionButton';
import Chip from './ui/Chip';

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
        // 등급(tier) 사다리 — 색은 토큰만 쓴다(에테르 유리).
        if ((item?.tier || 1) >= 5) return 'text-ae-gold-text';
        if ((item?.tier || 1) >= 4) return 'text-ae-exp';
        if ((item?.tier || 1) >= 3) return 'text-ae-ether-hi';
        return 'text-ae-ink-2';
    };

    return (
        <div data-testid="grave-recovery-panel" className="space-y-3 pb-2">
            {/* 2026-10 감사 UX-14: Wave 70이 공개 묘비 탭을 지운 뒤 누를 것 없는 탭 하나('내 유해')만 남아 화면 낭독기가 "탭 1/1"로 읽었다 —
                탭이 하나면 탭 목록이 아니라 제목이다. 회수 지역 수는 바로 아래 칸이 말한다. */}
            <h3 data-testid="grave-mine-heading" className="ae-eyebrow px-1">
                {MSG.GRAVE_MINE_HEADING}
            </h3>

            <section data-testid="grave-mine-view" aria-label={MSG.GRAVE_MINE_HEADING} className="space-y-3">
                {recoveryGroups.length === 0 ? (
                    <div className="ae-card is-quiet flex min-h-[148px] flex-col items-center justify-center px-5 text-center">
                        <span className="ae-well flex h-11 w-11 items-center justify-center text-ae-good">
                            <ShieldCheck size={20} aria-hidden="true" />
                        </span>
                        <h4 className="mt-3 text-[15px] font-readable font-bold text-ae-ink">잃어버린 유해가 없습니다</h4>
                        <p className="mt-1 text-[12px] font-readable text-ae-ink-3">다음 원정을 준비할 수 있습니다.</p>
                    </div>
                ) : (
                    <>
                        <div data-testid="grave-recovery-summary" className="ae-card is-quiet ae-cols grid grid-cols-3 py-3">
                            <div className="px-2 text-center">
                                <div className="ae-eyebrow">회수 지역</div>
                                <strong className="mt-1 block font-fira text-[17px] tabular-nums text-ae-ink">{recoveryGroups.length}</strong>
                            </div>
                            <div className="px-2 text-center">
                                <div className="ae-eyebrow">골드</div>
                                <strong className="mt-1 block font-fira text-[17px] tabular-nums text-ae-gold-text">{recoveryGold.toLocaleString('ko-KR')}</strong>
                            </div>
                            <div className="px-2 text-center">
                                <div className="ae-eyebrow">{MSG.GRAVE_RECOVERY_ITEMS_LABEL}</div>
                                <strong className="mt-1 block font-fira text-[17px] tabular-nums text-ae-ether-hi">{recoveryItems}</strong>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {recoveryGroups.map((group) => (
                                <article
                                    key={group.loc}
                                    data-testid={`grave-recovery-${group.loc}`}
                                    data-current-location={group.atCurrentLocation ? 'true' : 'false'}
                                    className={`ae-card p-3.5 ${group.atCurrentLocation ? 'ae-grave-here' : 'is-quiet'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-readable text-ae-ink-3">
                                                <MapPinned size={13} aria-hidden="true" />
                                                <span>{group.atCurrentLocation ? '현재 위치' : '회수 목적지'}</span>
                                                {group.count > 1 && <span>· 유해 {group.count}구</span>}
                                            </div>
                                            <h4 className="mt-1 text-[15px] font-readable font-bold text-ae-ink">{getVisibleLocationName(player, group.loc)}</h4>
                                        </div>
                                        {group.atCurrentLocation && (
                                            <Chip tone="gold" className="shrink-0">
                                                회수 가능
                                            </Chip>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-readable">
                                        <span className="inline-flex items-center gap-1.5 text-ae-gold-text">
                                            <Coins size={13} aria-hidden="true" /> <span className="font-fira tabular-nums">{group.gold.toLocaleString('ko-KR')}</span> 골드
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-ae-ether-hi">
                                            <PackageOpen size={13} aria-hidden="true" /> <span className="font-fira tabular-nums">{group.items.length}</span>개
                                        </span>
                                    </div>

                                    {group.items.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {group.items.slice(0, 3).map((item, index) => (
                                                <span
                                                    key={`${item.id || item.name}-${index}`}
                                                    className={`ae-chip ${tierColor(item)}`}
                                                >
                                                    {item.name || MSG.GRAVE_UNNAMED_ITEM}
                                                </span>
                                            ))}
                                            {group.items.length > 3 && (
                                                <span className="ae-chip font-fira tabular-nums text-ae-ink-3">
                                                    +{group.items.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* 금빛 주 행동은 지금 서 있는 곳의 회수 하나뿐이다 — 다른 지역은 지도로 가는 보조 행동. */}
                                    <ActionButton
                                        variant={group.atCurrentLocation ? 'primary' : 'glass'}
                                        data-testid={group.atCurrentLocation ? 'grave-recover-here' : `grave-open-map-${group.loc}`}
                                        onClick={group.atCurrentLocation ? actions?.lootGrave : onOpenMap}
                                        className="mt-3 w-full"
                                        icon={group.atCurrentLocation ? <PackageOpen size={16} /> : <Navigation size={16} />}
                                        label={group.atCurrentLocation ? '이곳 유해 회수' : '지도에서 경로 확인'}
                                    />
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
