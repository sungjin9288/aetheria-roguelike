import { useState } from 'react';
import {
    Check,
    Compass,
    RefreshCw,
    Route,
    ShieldCheck,
    Sparkles,
    X,
    type LucideIcon,
} from 'lucide-react';
import { getMirrorNode } from '../data/mirror';
import type { Player } from '../types/index.js';
import {
    getMirrorCompletion,
    getMirrorInvestmentPreview,
    MIRROR_PATHS,
    type MirrorPathId,
} from '../utils/mirrorJourney';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';

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
};

const EssenceMark = () => <Sparkles size={14} aria-hidden="true" />;

const MirrorPanel = ({ player, onClose, onPurchase }: MirrorPanelProps) => {
    usePlatformBackHandler(Boolean(onClose), () => onClose?.(), 200);
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
        : preview.maxed
            ? '이 성장은 완료되었습니다'
            : preview.canAfford
                ? `${preview.node.name} ${preview.nextLevel}단계 투자`
                : `계승 정수 ${preview.shortage} 부족`;

    return (
        <div className="fixed inset-0 z-[200] flex justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <section
                data-testid="mirror-panel"
                aria-label="에테르 거울 영구 성장"
                className="panel-noise aether-surface relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-x border-[#9a8ac0]/18 bg-[#0b111a] pt-[var(--aether-safe-area-top)]"
                style={{ backgroundColor: '#0b111a' }}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-fira text-[#b7aad8]">영구 성장</p>
                        <h2 className="mt-0.5 text-[20px] font-rajdhani font-bold text-white">에테르 거울</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <div data-testid="mirror-essence" className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#9a8ac0]/24 bg-[#9a8ac0]/10 px-3 text-[#e3dcff]">
                            <EssenceMark />
                            <span className="text-[15px] font-rajdhani font-bold">{essence}</span>
                            <span className="text-[11px] font-fira text-slate-300">계승 정수</span>
                        </div>
                        <button
                            type="button"
                            data-testid="mirror-panel-close"
                            aria-label="에테르 거울 닫기"
                            onClick={onClose}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition-colors hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div data-testid="mirror-scroll-region" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <h3 className="text-[16px] font-rajdhani font-bold text-white">새 여정에도 남는 성장</h3>
                            <p className="mt-1 text-[12px] font-fira leading-5 text-slate-400">
                                투자 전후 효과를 확인한 뒤 계승 정수를 사용합니다.
                            </p>
                        </div>
                        <span data-testid="mirror-completion" className="shrink-0 text-[12px] font-fira text-[#cfc4eb]">
                            {completion.completed}/{completion.total} 단계
                        </span>
                    </div>

                    <nav className="mt-4 grid grid-cols-4 gap-1.5" aria-label="성장 경로">
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
                                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg border px-1 text-[11px] font-fira transition-colors ${
                                        active
                                            ? 'border-[#b3a0dd]/45 bg-[#9a8ac0]/16 text-white'
                                            : 'border-white/8 bg-black/16 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Icon size={15} />
                                    {path.label}
                                </button>
                            );
                        })}
                    </nav>

                    <section className="mt-4" aria-labelledby="mirror-path-heading">
                        <div className="border-b border-white/8 pb-3">
                            <h3 id="mirror-path-heading" className="text-[15px] font-rajdhani font-bold text-white">{activePath.label}</h3>
                            <p className="mt-1 text-[12px] font-fira leading-5 text-slate-400">{activePath.summary}</p>
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
                                        className={`w-full min-h-[76px] rounded-lg border p-3 text-left transition-colors ${
                                            selected
                                                ? 'border-[#b3a0dd]/48 bg-[#9a8ac0]/12'
                                                : 'border-white/8 bg-black/14 hover:border-white/16'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                                nodePreview.maxed
                                                    ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                                                    : 'border-[#9a8ac0]/24 bg-black/20 text-[#e3dcff]'
                                            }`}>
                                                {nodePreview.maxed ? <Check size={16} /> : <Sparkles size={16} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-3">
                                                    <strong className="text-[14px] font-rajdhani text-white">{node.name}</strong>
                                                    <span className="shrink-0 text-[11px] font-fira text-[#cfc4eb]">
                                                        {nodePreview.currentLevel}/{node.maxLevel} 단계
                                                    </span>
                                                </span>
                                                <span className="mt-1 block text-[12px] font-fira leading-5 text-slate-400">{node.desc}</span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {preview && (
                        <section data-testid="mirror-investment-preview" className="mt-5 border-t border-white/10 pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[15px] font-rajdhani font-bold text-white">{preview.node.name}</h3>
                                <span className="text-[11px] font-fira text-slate-400">
                                    {preview.maxed ? '성장 완료' : `${preview.currentLevel} → ${preview.nextLevel} 단계`}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="min-h-[72px] rounded-lg border border-white/8 bg-black/16 p-3">
                                    <p className="text-[11px] font-fira text-slate-500">현재</p>
                                    <p data-testid="mirror-current-effect" className="mt-2 text-[12px] font-fira leading-5 text-slate-200">
                                        {preview.currentEffect}
                                    </p>
                                </div>
                                <span className="text-[15px] text-[#b7aad8]" aria-hidden="true">→</span>
                                <div className="min-h-[72px] rounded-lg border border-[#9a8ac0]/22 bg-[#9a8ac0]/8 p-3">
                                    <p className="text-[11px] font-fira text-[#b7aad8]">투자 후</p>
                                    <p data-testid="mirror-next-effect" className="mt-2 text-[12px] font-fira leading-5 text-white">
                                        {preview.nextEffect || preview.currentEffect}
                                    </p>
                                </div>
                            </div>
                            {!preview.maxed && (
                                <p className="mt-3 text-[12px] font-fira text-slate-400">
                                    필요 {preview.nextCost} · 투자 후 {preview.remainingEssence} 남음
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <footer data-testid="mirror-action-footer" className="shrink-0 border-t border-white/10 bg-[#0b111a]/96 px-4 pb-[max(12px,var(--aether-safe-area-bottom))] pt-3">
                    <div className="grid grid-cols-[104px_1fr] gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-[50px] rounded-lg border border-white/12 bg-black/20 text-[13px] font-fira text-slate-300"
                        >
                            돌아가기
                        </button>
                        <button
                            type="button"
                            data-testid="mirror-confirm"
                            disabled={!preview?.canAfford}
                            onClick={() => preview?.canAfford && onPurchase?.(preview.node.id)}
                            className="flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-[#b3a0dd]/42 bg-[#9a8ac0]/16 px-3 text-[13px] font-rajdhani font-bold text-white transition-colors enabled:hover:bg-[#9a8ac0]/24 disabled:border-white/8 disabled:bg-black/16 disabled:text-slate-600"
                        >
                            {preview?.canAfford && <EssenceMark />}
                            {confirmLabel}
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default MirrorPanel;
