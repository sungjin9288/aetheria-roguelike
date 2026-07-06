import { X, Sparkles, Check } from 'lucide-react';
import { MIRROR_NODES } from '../data/mirror';
import type { Player } from '../types/index.js';

interface MirrorPanelProps {
    player?: Player | null;
    onClose?: () => void;
    onPurchase?: (nodeId: string) => void;
}

const EssenceIcon = () => (
    <span className="text-[#e3dcff]" aria-hidden="true">✦</span>
);

/**
 * MirrorPanel — 에테르 거울 (에센스 소비 영구 업그레이드 트리) UI.
 * 2026-07 감사 — 장르 갭 (a): 에센스(meta.essence)의 유일한 소비처. 렌더링만 담당 —
 * 구매 가능 판정(레벨 캡/비용)은 mirrorUpgrades.ts 순수 함수가 이미 계산해 넘긴
 * player.meta를 그대로 읽어 표시한다(구매 가능 여부 판정 로직 자체는 이 컴포넌트에
 * 두지 않음 — onPurchase 콜백이 hook에서 재검증).
 */
const MirrorPanel = ({ player, onClose, onPurchase }: MirrorPanelProps) => {
    const meta: Record<string, any> = player?.meta || {};
    const essence = meta.essence || 0;
    const mirror: Record<string, number> = meta.mirror || {};

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center pb-[env(safe-area-inset-bottom)]" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                data-testid="mirror-panel"
                className="relative w-full max-w-sm panel-noise aether-surface rounded-t-[2rem] px-4 py-5 space-y-4 max-h-[85dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-fira uppercase tracking-[0.2em] text-slate-500">에테르 거울</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <EssenceIcon />
                            <span className="text-[18px] font-rajdhani font-bold text-[#e3dcff]">{essence}</span>
                            <span className="text-[10px] font-fira text-slate-500">에센스 보유</span>
                        </div>
                    </div>
                    <button
                        data-testid="mirror-panel-close"
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-black/20 p-1.5 text-slate-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="rounded-[0.95rem] border border-[#9a8ac0]/18 bg-[#9a8ac0]/8 px-3 py-2.5 text-[10px] font-fira text-slate-300/80 leading-relaxed">
                    영구 업그레이드는 사망·환생 후에도 유지됩니다. 에센스는 승천/일일 프로토콜/전투 승리로 획득합니다.
                </div>

                {/* Node list */}
                <div className="space-y-2">
                    {MIRROR_NODES.map((node) => {
                        const level = Math.min(node.maxLevel, Math.max(0, mirror[node.id] || 0));
                        const maxed = level >= node.maxLevel;
                        const nextCost = maxed ? null : node.costs[level];
                        const canAfford = !maxed && essence >= (nextCost || 0);

                        return (
                            <div
                                key={node.id}
                                data-testid={`mirror-node-${node.id}`}
                                className="flex items-center gap-3 rounded-[1.1rem] border border-white/8 bg-black/18 px-3 py-2.5"
                            >
                                <div className="shrink-0 rounded-[0.7rem] border border-[#9a8ac0]/22 bg-[#9a8ac0]/8 p-2 text-[#e3dcff]">
                                    <Sparkles size={14} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-rajdhani font-bold text-white/90">{node.name}</span>
                                        <span className="text-[9px] font-fira text-slate-500">
                                            Lv.{level}/{node.maxLevel}
                                        </span>
                                    </div>
                                    <div className="text-[9px] font-fira text-slate-500">{node.desc}</div>
                                </div>
                                {maxed ? (
                                    <div className="shrink-0 flex items-center gap-1 rounded-[0.8rem] border border-emerald-300/24 bg-emerald-300/10 px-2.5 py-1.5 text-[9px] font-fira text-emerald-100 min-h-[44px]">
                                        <Check size={12} /> 완료
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        data-testid={`mirror-buy-${node.id}`}
                                        onClick={() => canAfford && onPurchase?.(node.id)}
                                        className={`shrink-0 flex items-center gap-1 rounded-[0.8rem] border px-2.5 py-1.5 text-[9px] font-fira transition-all min-h-[44px] min-w-[44px] justify-center ${
                                            canAfford
                                                ? 'border-[#9a8ac0]/40 bg-[#9a8ac0]/12 text-[#e3dcff] hover:bg-[#9a8ac0]/22'
                                                : 'border-white/8 bg-black/12 text-slate-600 cursor-not-allowed'
                                        }`}
                                    >
                                        <EssenceIcon />{nextCost}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MirrorPanel;
