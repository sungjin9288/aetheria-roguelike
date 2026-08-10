import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Backpack, Package, Sparkles, Sword, X } from 'lucide-react';
import {
    getPostCombatAnalysis,
    getPostCombatDecisionStrip,
    getPostCombatRecommendation,
} from '../utils/outcomeAnalysis';
import { isSignatureItem } from '../data/signatureItems.js';
import SignalBadge from './SignalBadge';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';

const toneClassForSignal = (tone: any) => {
    if (tone === 'amber') return 'text-[#f6e7c8] border-[#d5b180]/20 bg-[#d5b180]/10';
    if (tone === 'success') return 'text-emerald-100 border-emerald-300/20 bg-emerald-300/10';
    if (tone === 'purple') return 'text-[#e3dcff] border-[#9a8ac0]/24 bg-[#9a8ac0]/10';
    return 'text-slate-200 border-white/8 bg-white/[0.04]';
};

interface PostCombatCardProps {
    result?: any;
    onClose?: () => void;
    onOpenInventory?: () => void;
}

const PostCombatCard = ({ result, onClose, onOpenInventory }: PostCombatCardProps) => {
    const [isClosing, setIsClosing] = useState(false);
    usePlatformBackHandler(Boolean(result && onClose), () => onClose?.(), 40);

    if (!result) return null;

    const droppedItems = Array.isArray(result.items)
        ? result.items
        : Array.isArray(result.loot)
            ? result.loot
            : [];
    const signatureLoot = droppedItems.filter((name: any) => (
        typeof name === 'string' && isSignatureItem({ name })
    ));
    const nonSignatureLoot = droppedItems.filter((name: any) => !(
        typeof name === 'string' && isSignatureItem({ name })
    ));
    const hasLevelUp = Boolean(result.leveledUp);
    const analysis = getPostCombatAnalysis(result);
    const compactNote = analysis.notes[0] || `${result.enemy || '적'} 전투를 정리했습니다.`;
    const upgradeHint = result.upgradeHint || null;
    const traitHint = result.traitHint || null;
    const bossRewardHint = result.bossRewardHint || null;
    const bossClearBonus = result.bossClearBonus || 0;
    const rewardSignals: any[] = [
        bossRewardHint
            ? {
                title: '보스 보상',
                name: bossClearBonus > 0 ? `첫 토벌 골드 +${bossClearBonus}` : '보스 전리품',
                summary: bossRewardHint,
                tone: 'success',
            }
            : null,
        upgradeHint
            ? { title: '장비 갱신', name: upgradeHint.name, summary: upgradeHint.summary, tone: 'amber' }
            : null,
        traitHint
            ? { title: '성향 공명', name: traitHint.name, summary: traitHint.summary, tone: 'purple' }
            : null,
    ].filter(Boolean);
    const primarySignal = rewardSignals[0] || null;
    const lootSummary = nonSignatureLoot.length > 0
        ? `${nonSignatureLoot.slice(0, 2).join(' · ')}${nonSignatureLoot.length > 2 ? ` 외 ${nonSignatureLoot.length - 2}` : ''}`
        : null;
    const decisionContext = {
        signatureLootCount: signatureLoot.length,
        nonSignatureLootCount: nonSignatureLoot.length,
    };
    const decisionStrip = getPostCombatDecisionStrip(result, decisionContext);
    const recommendation = getPostCombatRecommendation(result, decisionContext);
    const decisionState = decisionStrip.cells[0]?.value || '진행 가능';

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => onClose?.(), 280);
    };

    const handlePrimaryAction = () => {
        if (recommendation.target === 'inventory') onOpenInventory?.();
        handleClose();
    };

    const actionClass = decisionStrip.tone === 'pressure'
        ? 'border-rose-300/24 bg-rose-400/10 text-rose-100'
        : 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]';

    return (
        <AnimatePresence>
            {!isClosing && (
                <Motion.div
                    data-testid="post-combat-card"
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="panel-noise aether-surface-strong fixed inset-x-3 bottom-[calc(var(--aether-safe-area-bottom)+0.8rem)] z-40 max-h-[calc(100dvh-var(--aether-safe-area-top)-1.6rem)] overflow-y-auto overscroll-contain rounded-[1.55rem] border-white/12 backdrop-blur-2xl"
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-60"
                        style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 24%), radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 28%)' }}
                    />

                    <div className="relative space-y-2.5 px-3.5 py-3">
                        <header className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 font-readable text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1.5 text-[#dff7f5]">
                                        <Sword size={13} />
                                        전투 결과
                                    </span>
                                    <span>{analysis.rewardMood}</span>
                                    {hasLevelUp && <SignalBadge tone="upgrade" size="sm">레벨 상승</SignalBadge>}
                                </div>
                                <h2 className="mt-1 truncate font-readable text-[1.05rem] font-bold text-[#f6e7c8]">
                                    {result.enemy || '적'} 전투 정리
                                </h2>
                            </div>
                            <button
                                data-testid="post-combat-close"
                                aria-label="전투 결과 닫기"
                                onClick={handleClose}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/8 bg-black/18 p-2 text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </header>

                        <section
                            data-testid="post-combat-decision-strip"
                            data-result-tone={decisionStrip.tone}
                            aria-label="전투 결과 판단 요약"
                            className="aether-result-strip grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2 rounded-lg px-3 py-2"
                        >
                            <div className="min-w-0">
                                <div className="font-readable text-[8px] font-bold text-slate-400/78">상태</div>
                                <div className="mt-0.5 truncate font-readable text-[11px] font-semibold text-slate-100/90">
                                    {decisionState}
                                </div>
                            </div>
                            <div className="min-w-0 border-l border-white/8 pl-2">
                                <div className="font-readable text-[8px] font-bold text-slate-400/78">추천</div>
                                <div className="mt-0.5 truncate font-readable text-[11px] font-semibold text-slate-100/90">
                                    {recommendation.label}
                                </div>
                            </div>
                        </section>

                        <section
                            data-testid="post-combat-reward-summary"
                            aria-label="전투 보상"
                            className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 border-y border-white/8 px-1 py-1.5 font-readable text-xs"
                        >
                            <span className="text-[#dff7f5]">경험 +{result.exp}</span>
                            <span className="text-[#f6e7c8]">골드 +{result.gold}</span>
                            {droppedItems.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-slate-200/86">
                                    <Package size={12} className="text-[#d5b180]" />
                                    전리품 {droppedItems.length}개
                                </span>
                            )}
                        </section>

                        {(signatureLoot.length > 0 || lootSummary || primarySignal) && (
                            <section className="space-y-2 rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2.5">
                                {signatureLoot.length > 0 && (
                                    <div
                                        data-testid="post-combat-legendary"
                                        className="rounded-lg border border-[#f6e7a2]/40 px-2.5 py-2 shadow-[0_2px_10px_rgba(246,231,162,0.16)]"
                                        style={{ background: 'linear-gradient(180deg, rgba(246,231,162,0.14) 0%, rgba(64,48,12,0.4) 100%)' }}
                                    >
                                        <div className="flex items-center gap-1.5 text-[9px] font-fira uppercase text-[#f6e7a2]">
                                            <Sparkles size={11} />
                                            Legendary
                                        </div>
                                        <div className="mt-1 text-sm font-rajdhani font-bold leading-tight text-[#fef3c7]">
                                            {signatureLoot.join(' · ')}
                                        </div>
                                        <div className="mt-0.5 text-[10px] font-fira text-[#f6e7a2]/80">
                                            도감에 기록된 전설 각인
                                        </div>
                                    </div>
                                )}

                                {lootSummary && (
                                    <div className="flex items-center gap-2 text-xs font-fira text-slate-200/86">
                                        <Package size={13} className="shrink-0 text-[#d5b180]" />
                                        <span className="truncate">{lootSummary}</span>
                                    </div>
                                )}

                                {primarySignal && (
                                    <div className={`rounded-lg border px-2.5 py-2 text-xs font-fira ${toneClassForSignal(primarySignal.tone)}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="opacity-72">{primarySignal.title}</span>
                                            <strong className="truncate">{primarySignal.name}</strong>
                                        </div>
                                        {primarySignal.summary && (
                                            <div className="mt-1 line-clamp-2 leading-relaxed opacity-86">
                                                {primarySignal.summary}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="flex items-center gap-2 px-1 font-fira text-[11px] text-slate-300/78">
                            <span className="shrink-0 font-readable font-bold text-[#f6e7c8]">{analysis.grade}</span>
                            <span className="truncate">{compactNote}</span>
                        </div>

                        <div className={recommendation.target === 'inventory' ? 'grid grid-cols-[1.25fr_0.75fr] gap-2' : ''}>
                            <Motion.button
                                data-testid="post-combat-primary-action"
                                whileTap={{ scale: 0.97 }}
                                onClick={handlePrimaryAction}
                                className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[1rem] border px-3 py-2 text-xs font-rajdhani font-bold ${actionClass}`}
                            >
                                {recommendation.target === 'inventory' ? <Backpack size={15} /> : <ArrowRight size={15} />}
                                {recommendation.label}
                            </Motion.button>

                            {recommendation.target === 'inventory' && (
                                <Motion.button
                                    data-testid="post-combat-continue"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleClose}
                                    className="min-h-[44px] rounded-[1rem] border border-white/8 bg-black/22 px-3 py-2 text-xs font-rajdhani font-bold text-slate-100 transition-colors hover:bg-white/[0.05]"
                                >
                                    계속 탐험
                                </Motion.button>
                            )}
                        </div>

                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PostCombatCard;
