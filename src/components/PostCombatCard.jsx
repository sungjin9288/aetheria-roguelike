import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sword, Package, X, Radar } from 'lucide-react';
import { getPostCombatAnalysis } from '../utils/outcomeAnalysis';
import SignalBadge from './SignalBadge';

const METRIC_CARD_CLASS = {
    exp: 'border-[#7dd4d8]/20 bg-[#7dd4d8]/10 text-[#dff7f5]',
    gold: 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]',
};

const toneClassForSignal = (tone) => {
    if (tone === 'amber') return 'text-[#f6e7c8] border-[#d5b180]/20 bg-[#d5b180]/10';
    if (tone === 'success') return 'text-emerald-100 border-emerald-300/20 bg-emerald-300/10';
    if (tone === 'purple') return 'text-[#e3dcff] border-[#9a8ac0]/24 bg-[#9a8ac0]/10';
    return 'text-slate-200 border-white/8 bg-white/[0.04]';
};

const PostCombatCard = ({ result, onClose, onRest, onSell }) => {
    const [isClosing, setIsClosing] = useState(false);

    if (!result) return null;

    const droppedItems = Array.isArray(result.items)
        ? result.items
        : Array.isArray(result.loot)
            ? result.loot
            : [];
    const hasLevelUp = Boolean(result.leveledUp);
    const hpLow = typeof result.hpLow === 'boolean'
        ? result.hpLow
        : typeof result.playerHp === 'number' && typeof result.playerMaxHp === 'number'
            ? result.playerHp / Math.max(1, result.playerMaxHp) <= 0.35
            : false;
    const mpLow = typeof result.mpLow === 'boolean'
        ? result.mpLow
        : typeof result.playerMp === 'number' && typeof result.playerMaxMp === 'number'
            ? result.playerMp / Math.max(1, result.playerMaxMp) <= 0.3
            : false;
    const invFull = typeof result.invFull === 'boolean'
        ? result.invFull
        : typeof result.playerInvCount === 'number'
            ? result.playerInvCount >= 20
            : false;
    const analysis = getPostCombatAnalysis(result);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose?.();
        }, 280);
    };

    const compactNote = analysis.notes[0] || `${result.enemy || '적'} 전투를 정리했습니다.`;
    const compactAction = analysis.actions[0] || '다음 탐험 전 장비와 체력을 점검하세요.';
    const upgradeHint = result.upgradeHint || null;
    const traitHint = result.traitHint || null;
    const bossRewardHint = result.bossRewardHint || null;
    const bossClearBonus = result.bossClearBonus || 0;
    const rewardSignals = [
        bossRewardHint ? { title: '보스 보상', name: bossClearBonus > 0 ? `초회 토벌 +${bossClearBonus}G` : '보스 전리품', summary: bossRewardHint, tone: 'success' } : null,
        upgradeHint ? { title: '장비 갱신', name: upgradeHint.name, summary: upgradeHint.summary, tone: 'amber' } : null,
        traitHint ? { title: '성향 공명', name: traitHint.name, summary: traitHint.summary, tone: 'purple' } : null,
    ].filter(Boolean);
    const primarySignal = rewardSignals[0] || null;
    const lootSummary = droppedItems.length > 0
        ? `${droppedItems.slice(0, 2).join(' · ')}${droppedItems.length > 2 ? ` 외 ${droppedItems.length - 2}` : ''}`
        : null;
    const summaryBadges = analysis.rewardHighlights.slice(0, 2);

    const shellClass = 'inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.8rem)] rounded-[1.55rem]';

    const renderMobilePrimaryPanel = () => (
        <div className="space-y-2.5 rounded-[1.15rem] border border-white/8 bg-black/18 px-3 py-3">
            {(lootSummary || primarySignal) && (
                <div className="space-y-1.5">
                    {lootSummary && (
                        <div className="flex items-start gap-2 text-xs font-fira text-slate-200/86">
                            <Package size={13} className="mt-0.5 text-[#d5b180]" />
                            <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Loot</div>
                                <div className="mt-0.5 leading-relaxed">{lootSummary}</div>
                            </div>
                        </div>
                    )}
                    {primarySignal && (
                        <div className={`rounded-[0.95rem] border px-2.5 py-2 text-xs font-fira ${toneClassForSignal(primarySignal.tone)}`}>
                            <div className="uppercase tracking-[0.16em] opacity-72">{primarySignal.title}</div>
                            <div className="mt-1 font-bold">{primarySignal.name}</div>
                            {primarySignal.summary && (
                                <div className="mt-1 leading-relaxed opacity-86">{primarySignal.summary}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-fira uppercase tracking-[0.16em] text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <Radar size={11} />
                        Field Readout
                    </span>
                    <span className="text-[#f6e7c8]">{analysis.grade}</span>
                </div>
                <div className="mt-2 text-xs font-fira leading-relaxed text-slate-200/86">{compactNote}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {summaryBadges.map((entry) => (
                        <SignalBadge key={entry} tone="neutral" size="sm">{entry}</SignalBadge>
                    ))}
                    {compactAction && <SignalBadge tone="recommended" size="sm">{compactAction}</SignalBadge>}
                </div>
            </div>
        </div>
    );

    return (
        <AnimatePresence>
            {!isClosing && (
                <Motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`panel-noise aether-surface-strong fixed z-40 overflow-hidden border-white/12 backdrop-blur-2xl ${shellClass}`}
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-60"
                        style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 24%), radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 28%)' }}
                    />

                    <div className="px-3.5 py-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs font-fira uppercase tracking-[0.18em] text-slate-500">
                                    <span className="inline-flex items-center gap-1.5 text-[#dff7f5]">
                                        <Sword size={13} />
                                        Field Report
                                    </span>
                                    {hasLevelUp && <SignalBadge tone="upgrade" size="sm">Level Up</SignalBadge>}
                                </div>
                                <div className="mt-1 text-[1.05rem] font-rajdhani font-bold tracking-[0.08em] text-[#f6e7c8]">
                                    {result.enemy || '적'} 전투 정리
                                </div>
                                <div className="mt-1 text-xs font-fira text-slate-300/72">
                                    {analysis.rewardMood}
                                </div>
                            </div>
                            <button
                                data-testid="post-combat-close"
                                onClick={handleClose}
                                className="rounded-full border border-white/8 bg-black/18 p-2 text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className={`rounded-[1rem] border px-3 py-2.5 ${METRIC_CARD_CLASS.exp}`}>
                                <div className="text-xs font-fira uppercase tracking-[0.16em] opacity-70">EXP</div>
                                <div className="mt-1 text-xl font-rajdhani font-bold">+{result.exp}</div>
                            </div>
                            <div className={`rounded-[1rem] border px-3 py-2.5 ${METRIC_CARD_CLASS.gold}`}>
                                <div className="text-xs font-fira uppercase tracking-[0.16em] opacity-70">Gold</div>
                                <div className="mt-1 text-xl font-rajdhani font-bold">+{result.gold}</div>
                            </div>
                        </div>

                        {renderMobilePrimaryPanel()}

                        <div className="grid grid-cols-2 gap-2">
                            {hpLow ? (
                                <Motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onRest?.(); handleClose(); }}
                                    className="min-h-[42px] rounded-[1rem] border border-rose-300/24 bg-rose-400/10 px-3 py-2 text-xs font-rajdhani font-bold text-rose-100"
                                >
                                    휴식 우선
                                </Motion.button>
                            ) : (
                                <div className="flex min-h-[42px] items-center rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2 text-xs font-fira text-slate-300/72">
                                    {mpLow ? 'MP 회복 점검' : '다음 행동 준비 완료'}
                                </div>
                            )}

                            {invFull ? (
                                <Motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onSell?.(); handleClose(); }}
                                    className="min-h-[42px] rounded-[1rem] border border-[#7dd4d8]/24 bg-[#7dd4d8]/10 px-3 py-2 text-xs font-rajdhani font-bold text-[#dff7f5]"
                                >
                                    인벤 정리
                                </Motion.button>
                            ) : upgradeHint ? (
                                <Motion.button
                                    data-testid="post-combat-review-loot"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onSell?.(); handleClose(); }}
                                    className="min-h-[42px] rounded-[1rem] border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-2 text-xs font-rajdhani font-bold text-[#f6e7c8]"
                                >
                                    장비 확인
                                </Motion.button>
                            ) : traitHint ? (
                                <Motion.button
                                    data-testid="post-combat-review-loot"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onSell?.(); handleClose(); }}
                                    className="min-h-[42px] rounded-[1rem] border border-[#9a8ac0]/24 bg-[#9a8ac0]/10 px-3 py-2 text-xs font-rajdhani font-bold text-[#e3dcff]"
                                >
                                    공명 확인
                                </Motion.button>
                            ) : (
                                <div className="flex min-h-[42px] items-center rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2 text-xs font-fira text-slate-300/72">
                                    로그에서 전투 세부 내용을 확인하세요
                                </div>
                            )}
                        </div>

                        <Motion.button
                            data-testid="post-combat-continue"
                            whileTap={{ scale: 0.97 }}
                            onClick={handleClose}
                            className="w-full min-h-[42px] rounded-[1rem] border border-white/8 bg-black/22 px-3 py-2 text-xs font-rajdhani font-bold tracking-[0.16em] text-slate-100 transition-colors hover:bg-white/[0.05]"
                        >
                            계속 진행
                        </Motion.button>
                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PostCombatCard;
