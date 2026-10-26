import { useState } from 'react';
import {
    Check,
    Compass,
    Infinity as InfinityIcon,
    RefreshCw,
    Route,
    ShieldCheck,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import { getMirrorNode } from '../data/mirror';
import { MSG } from '../data/messages';
import OverlayCloseButton from './OverlayCloseButton';
import ActionButton from './ui/ActionButton';
import type { Player } from '../types/index.js';
import {
    getMirrorCompletion,
    getMirrorInvestmentPreview,
    MIRROR_PATHS,
    type MirrorPathId,
} from '../utils/mirrorJourney';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';

interface MirrorPanelProps {
    player?: Player | null;
    onClose?: () => void;
    onPurchase?: (nodeId: string) => void;
}

const PATH_ICONS: Record<MirrorPathId, LucideIcon> = {
    departure: Route,
    exploration: Compass,
    survival: ShieldCheck,
    legacy: RefreshCw,
    endless: InfinityIcon,
};

const EssenceMark = () => <Sparkles size={14} aria-hidden="true" />;

const MirrorPanel = ({ player, onClose, onPurchase }: MirrorPanelProps) => {
    usePlatformBackHandler(Boolean(onClose), () => onClose?.(), 200);
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_MIRROR, onEscape: onClose });
    const meta = player?.meta || {};
    const essence = Math.max(0, Number(meta.essence) || 0);
    const mirror = meta.mirror || {};
    const [pathId, setPathId] = useState<MirrorPathId>('departure');
    const [selectedNodeId, setSelectedNodeId] = useState('start_gold');

    const activePath = MIRROR_PATHS.find((path) => path.id === pathId) || MIRROR_PATHS[0];
    const pathNodes = activePath.nodeIds.map((nodeId) => getMirrorNode(nodeId)).filter(Boolean);
    const activeNodeId = pathNodes.some((node) => node?.id === selectedNodeId)
        ? selectedNodeId
        : pathNodes[0]?.id || '';
    const preview = getMirrorInvestmentPreview(activeNodeId, mirror, essence);
    const completion = getMirrorCompletion(mirror);

    const changePath = (nextPathId: MirrorPathId) => {
        const nextPath = MIRROR_PATHS.find((path) => path.id === nextPathId);
        setPathId(nextPathId);
        if (nextPath?.nodeIds[0]) setSelectedNodeId(nextPath.nodeIds[0]);
    };

    const confirmLabel = !preview
        ? '투자할 성장을 선택하세요'
        : preview.locked
            ? MSG.MIRROR_ENDLESS_LOCKED
        : preview.maxed
            ? '이 성장은 완료되었습니다'
            : preview.canAfford
                ? `${preview.node.name} ${preview.nextLevel}단계 투자`
                : `계승 정수 ${preview.shortage} 부족`;

    return (
        <div {...dialog} className="ae-scrim ae-town-overlay fixed inset-0 z-[200] flex justify-center" onClick={onClose}>
            <section
                data-testid="mirror-panel"
                aria-label="에테르 거울 영구 성장"
                className="ae-sheet ae-town-sheet relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden pt-[var(--aether-safe-area-top)] lg:max-w-[600px]"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="ae-town-head flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                        <p className="ae-eyebrow font-readable">영구 성장</p>
                        <h2 className="mt-0.5 text-[20px] font-display font-extrabold text-ae-ink">에테르 거울</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <div data-testid="mirror-essence" className="flex min-h-[44px] items-center gap-2 rounded-full bg-ae-ether/10 px-3 text-ae-ether-hi shadow-[inset_0_0_0_1px_var(--aether-rim-ether)]">
                            <EssenceMark />
                            <span className="font-fira text-[15px] font-bold tabular-nums">{essence}</span>
                            <span className="font-readable text-[11px] text-ae-ink-2">계승 정수</span>
                        </div>
                        <OverlayCloseButton data-testid="mirror-panel-close" aria-label="에테르 거울 닫기" onClick={onClose} />
                    </div>
                </header>

                <div data-testid="mirror-scroll-region" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <h3 className="text-[16px] font-display font-bold text-ae-ink">새 여정에도 남는 성장</h3>
                            <p className="mt-1 font-readable text-[12px] leading-5 text-ae-ink-2">
                                투자 전후 효과를 확인한 뒤 계승 정수를 사용합니다.
                            </p>
                        </div>
                        <span data-testid="mirror-completion" className="shrink-0 font-fira text-[12px] tabular-nums text-ae-ether-hi">
                            {completion.completed}/{completion.total} 단계
                        </span>
                    </div>

                    <nav className="ae-town-seg is-stacked mt-4" aria-label="성장 경로">
                        {MIRROR_PATHS.map((path) => {
                            const Icon = PATH_ICONS[path.id];
                            const active = path.id === pathId;
                            return (
                                <button
                                    key={path.id}
                                    type="button"
                                    data-testid={`mirror-path-${path.id}`}
                                    aria-pressed={active}
                                    onClick={() => changePath(path.id)}
                                    className="ae-town-seg-btn font-readable"
                                >
                                    <Icon size={16} aria-hidden="true" />
                                    {path.label}
                                </button>
                            );
                        })}
                    </nav>

                    <section className="mt-4" aria-labelledby="mirror-path-heading">
                        <div className="pb-1">
                            <h3 id="mirror-path-heading" className="text-[15px] font-display font-bold text-ae-ink">{activePath.label}</h3>
                            <p className="mt-1 font-readable text-[12px] leading-5 text-ae-ink-2">{activePath.summary}</p>
                        </div>

                        <div className="mt-3 space-y-2">
                            {pathNodes.map((node) => {
                                if (!node) return null;
                                const nodePreview = getMirrorInvestmentPreview(node.id, mirror, essence);
                                if (!nodePreview) return null;
                                const selected = node.id === activeNodeId;

                                return (
                                    <button
                                        key={node.id}
                                        type="button"
                                        data-testid={`mirror-node-select-${node.id}`}
                                        aria-pressed={selected}
                                        onClick={() => setSelectedNodeId(node.id)}
                                        className="ae-town-pick min-h-[76px] p-3"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`ae-town-tile mt-0.5 h-9 w-9 ${nodePreview.maxed ? 'is-good' : selected ? 'is-ether' : ''}`.trim()} aria-hidden="true">
                                                {nodePreview.maxed ? <Check size={16} /> : <Sparkles size={16} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-3">
                                                    <strong className="text-[14px] font-display font-bold text-ae-ink">{node.name}</strong>
                                                    <span className="shrink-0 font-fira text-[12px] tabular-nums text-ae-ether-hi">
                                                        {nodePreview.endless
                                                            ? MSG.MIRROR_ENDLESS_LEVEL(nodePreview.currentLevel, node.maxLevel)
                                                            : <>{nodePreview.currentLevel}/{node.maxLevel} 단계</>}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block font-readable text-[12px] leading-5 text-ae-ink-2">{node.desc}</span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {preview && (
                        <section data-testid="mirror-investment-preview" className="mt-5 pt-4 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[15px] font-display font-bold text-ae-ink">{preview.node.name}</h3>
                                <span className="font-fira text-[12px] tabular-nums text-ae-ink-2">
                                    {preview.maxed ? '성장 완료' : `${preview.currentLevel} → ${preview.nextLevel} 단계`}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="ae-sunk min-h-[72px] rounded-ae-sm p-3">
                                    <p className="ae-eyebrow font-readable">현재</p>
                                    <p data-testid="mirror-current-effect" className="mt-2 font-readable text-[12px] leading-5 text-ae-ink-2">
                                        {preview.currentEffect}
                                    </p>
                                </div>
                                <span className="text-[15px] text-ae-ether" aria-hidden="true">→</span>
                                <div className="min-h-[72px] rounded-ae-sm bg-ae-ether/10 p-3 shadow-[inset_0_0_0_1px_var(--aether-rim-ether)]">
                                    <p className="font-readable text-[11px] font-bold text-ae-ether-hi">투자 후</p>
                                    <p data-testid="mirror-next-effect" className="mt-2 font-readable text-[12px] leading-5 text-ae-ink">
                                        {preview.nextEffect || preview.currentEffect}
                                    </p>
                                </div>
                            </div>
                            {!preview.maxed && (
                                <p className="mt-3 font-fira text-[12px] tabular-nums text-ae-ink-2">
                                    필요 {preview.nextCost} · 투자 후 {preview.remainingEssence} 남음
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <footer data-testid="mirror-action-footer" className="ae-town-sheet-foot shrink-0 px-4 pb-[max(12px,var(--aether-safe-area-bottom))] pt-3">
                    <div className="grid grid-cols-1 gap-2">
                        <ActionButton
                            variant="primary"
                            data-testid="mirror-confirm"
                            disabled={!preview?.canAfford}
                            onClick={() => preview?.canAfford && onPurchase?.(preview.node.id)}
                            icon={preview?.canAfford ? <EssenceMark /> : undefined}
                            label={confirmLabel}
                            className="w-full font-display"
                        />
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default MirrorPanel;
