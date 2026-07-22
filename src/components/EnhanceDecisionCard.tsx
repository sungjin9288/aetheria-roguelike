import { motion as Motion } from 'framer-motion';
import { ArrowRight, Coins, Gem, ShieldAlert, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { EnhancePreview } from '../utils/enhancementUtils.js';
import ItemIcon from './icons/ItemIcon';

interface EnhanceDecisionCardProps {
    preview: EnhancePreview;
    onCancel: () => void;
    onConfirm: () => void;
}

const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;

const EnhanceDecisionCard = ({ preview, onCancel, onConfirm }: EnhanceDecisionCardProps) => {
    const requirement = preview.requirement;
    const canConfirm = preview.canEnhance && preview.affordable && Boolean(requirement);

    return createPortal(
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            data-testid="enhance-decision-overlay"
            className="fixed inset-0 z-[76] flex items-center justify-center px-3 py-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        >
            <button type="button" aria-label="강화 확인 닫기" onClick={onCancel} className="aether-overlay" />
            <Motion.section
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                data-testid="enhance-decision-card"
                aria-label={`${preview.item.name} 강화 확인`}
                className="panel-noise aether-surface-strong relative z-10 w-full max-w-[24rem] overflow-hidden rounded-[1.25rem] shadow-[0_32px_90px_rgba(1,6,14,0.7)]"
            >
                <button
                    type="button"
                    data-testid="enhance-decision-close"
                    onClick={onCancel}
                    aria-label="닫기"
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
                >
                    <X size={17} />
                </button>

                <div className="px-5 pb-4 pt-5">
                    <div className="flex items-start gap-3 pr-9">
                        <ItemIcon item={preview.item} size={48} showBorder className="shrink-0" />
                        <div className="min-w-0">
                            <div className="aether-type-label font-readable font-semibold text-[#b9f1ec]">강화 전 확인</div>
                            <h2 className="aether-type-title mt-0.5 break-words font-readable font-bold text-white">{preview.item.name}</h2>
                            <div className="aether-type-body mt-1 font-readable text-[#f6e7c8]">
                                +{preview.currentLevel} <ArrowRight size={13} className="mx-1 inline" /> +{preview.nextLevel}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
                        <div className="flex items-center justify-between gap-4 py-3">
                            <span className="aether-type-body flex items-center gap-2 font-readable text-slate-300/82">
                                <Sparkles size={14} className="text-[#f6e7c8]" />
                                {preview.statLabel}
                            </span>
                            <span data-testid="enhance-stat-change" className="aether-type-body text-right font-readable font-bold text-white">
                                {preview.currentStat} → {preview.nextStat}
                                <span className="ml-1.5 text-emerald-200">+{preview.statDelta}</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3">
                            <span className="aether-type-body flex items-center gap-2 font-readable text-slate-300/82">
                                <ShieldAlert size={14} className="text-[#d5b180]" />
                                성공률
                            </span>
                            <span data-testid="enhance-success-rate" className="aether-type-body font-readable font-bold text-[#f6e7c8]">
                                {formatRate(preview.successRate)}
                            </span>
                        </div>
                        {requirement && (
                            <>
                                <div className="flex items-center justify-between gap-4 py-3">
                                    <span className="aether-type-body flex items-center gap-2 font-readable text-slate-300/82">
                                        <Coins size={14} className="text-amber-200" />
                                        골드
                                    </span>
                                    <span className={`aether-type-body font-readable font-bold ${preview.missing === 'gold' ? 'text-rose-200' : 'text-white'}`}>
                                        {requirement.gold.toLocaleString('ko-KR')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 py-3">
                                    <span className="aether-type-body flex items-center gap-2 font-readable text-slate-300/82">
                                        <Gem size={14} className="text-cyan-200" />
                                        {requirement.materialName}
                                    </span>
                                    <span className={`aether-type-body font-readable font-bold ${preview.missing === 'material' ? 'text-rose-200' : 'text-white'}`}>
                                        {preview.materialCount}/{requirement.materials}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <p data-testid="enhance-failure-consequence" className="aether-type-body mt-4 font-readable leading-relaxed text-slate-300/78">
                        {preview.failureText}
                    </p>
                    {!canConfirm && (
                        <p className="aether-type-body mt-2 font-readable font-semibold text-amber-200/88">{preview.hint}</p>
                    )}
                </div>

                <div className="grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-white/8 p-3">
                    <button
                        type="button"
                        data-testid="enhance-decision-cancel"
                        onClick={onCancel}
                        className="aether-type-body min-h-[48px] rounded-lg border border-white/10 bg-black/16 px-3 font-readable font-bold text-slate-300"
                    >
                        취소
                    </button>
                    <Motion.button
                        type="button"
                        data-testid="enhance-decision-confirm"
                        whileTap={canConfirm ? { scale: 0.98 } : undefined}
                        disabled={!canConfirm}
                        onClick={onConfirm}
                        className="aether-cta-primary aether-type-body min-h-[48px] rounded-lg px-3 font-readable font-bold text-[#dff7f5] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        강화 시도
                    </Motion.button>
                </div>
            </Motion.section>
        </Motion.div>,
        document.body,
    );
};

export default EnhanceDecisionCard;
