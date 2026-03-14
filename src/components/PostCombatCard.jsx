import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sword, Star, Package, Heart, Zap, ChevronRight, X, Radar } from 'lucide-react';
import { getPostCombatAnalysis } from '../utils/outcomeAnalysis';

/**
 * PostCombatCard — 전투 종료 후 결과 요약 카드
 * props:
 *   result: { exp, gold, items: [], leveledUp, hpLow, mpLow, invFull }
 *   onClose: () => void
 *   onRest: () => void
 *   onSell: () => void
 */
const PostCombatCard = ({ result, onClose, onRest, onSell, mobile = false }) => {
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
    const rewardSignals = [
        upgradeHint ? { title: '장비 갱신', name: upgradeHint.name, summary: upgradeHint.summary, tone: 'amber' } : null,
        traitHint ? { title: '성향 공명', name: traitHint.name, summary: traitHint.summary, tone: 'purple' } : null,
    ].filter(Boolean);

    return (
        <AnimatePresence>
            {!isClosing && (
                <Motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className={`fixed z-50 bg-cyber-black/95 border border-cyber-green/40 backdrop-blur-xl overflow-hidden ${
                        mobile
                            ? 'inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] rounded-[1.4rem] shadow-[0_22px_60px_rgba(0,255,157,0.12)]'
                            : 'bottom-24 left-1/2 -translate-x-1/2 w-[clamp(17rem,90vw,26rem)] rounded-xl shadow-[0_0_30px_rgba(0,255,157,0.2)]'
                    }`}
                >
                    {mobile ? (
                        <div className="px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-cyber-green font-rajdhani font-bold tracking-[0.18em] text-sm uppercase">
                                        <Sword size={15} /> 전투 결과
                                    </div>
                                    <div className="mt-1 text-[11px] font-fira text-cyber-blue/60 truncate">
                                        {result.enemy || '적'} 처치 완료
                                    </div>
                                </div>
                                <button
                                    data-testid="post-combat-close"
                                    onClick={handleClose}
                                    className="text-cyber-blue/50 hover:text-cyber-blue transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {hasLevelUp && (
                                <div className="flex items-center gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-yellow-300 text-sm font-rajdhani font-bold">
                                    <Star size={14} /> LEVEL UP
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                                <span className="rounded-full border border-cyber-green/25 bg-cyber-green/10 px-2.5 py-1 text-[11px] font-rajdhani font-bold text-cyber-green">
                                    {analysis.rewardMood}
                                </span>
                                {analysis.rewardHighlights.length > 0 && (
                                    <div className="flex flex-wrap justify-end gap-1">
                                        {analysis.rewardHighlights.map((entry) => (
                                            <span key={entry} className="rounded-full border border-cyber-blue/15 bg-cyber-black/70 px-2 py-1 text-[10px] font-fira text-cyber-blue/80">
                                                {entry}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-cyan-400/15 bg-slate-950/70 px-3 py-2">
                                    <div className="text-[10px] text-cyan-100/45 font-fira">EXP</div>
                                    <div className="text-lg font-rajdhani font-bold text-cyan-300">+{result.exp}</div>
                                </div>
                                <div className="rounded-xl border border-yellow-500/15 bg-slate-950/70 px-3 py-2">
                                    <div className="text-[10px] text-yellow-200/45 font-fira">GOLD</div>
                                    <div className="text-lg font-rajdhani font-bold text-yellow-300">+{result.gold}</div>
                                </div>
                            </div>

                            {droppedItems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {droppedItems.slice(0, 3).map((item, i) => (
                                        <span key={i} className="rounded-full border border-cyber-purple/25 bg-cyber-purple/10 px-2.5 py-1 text-[11px] font-fira text-cyber-purple">
                                            {item}
                                        </span>
                                    ))}
                                    {droppedItems.length > 3 && (
                                        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-fira text-slate-300">
                                            +{droppedItems.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}

                            {rewardSignals.length > 0 && (
                                <div className="rounded-xl border border-cyber-blue/15 bg-cyber-dark/35 px-3 py-2.5 space-y-2">
                                    <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-blue/55">
                                        획득 포인트
                                    </div>
                                    <div className="space-y-2">
                                        {rewardSignals.map((signal) => (
                                            <div
                                                key={`${signal.title}_${signal.name}`}
                                                className={`rounded-lg border px-2.5 py-2 ${
                                                    signal.tone === 'amber'
                                                        ? 'border-amber-400/20 bg-amber-500/10'
                                                        : 'border-cyber-purple/20 bg-cyber-purple/10'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[10px] font-fira uppercase tracking-[0.16em] ${
                                                        signal.tone === 'amber' ? 'text-amber-200/65' : 'text-cyber-purple/70'
                                                    }`}>
                                                        {signal.title}
                                                    </span>
                                                    <span className={`text-[10px] font-fira ${
                                                        signal.tone === 'amber' ? 'text-amber-200/75' : 'text-cyber-purple/75'
                                                    }`}>
                                                        {signal.tone === 'amber' ? '전투 효율' : '빌드 방향'}
                                                    </span>
                                                </div>
                                                <div className={`mt-1 text-[12px] font-fira ${
                                                    signal.tone === 'amber' ? 'text-amber-100' : 'text-cyber-purple'
                                                }`}>
                                                    {signal.name}
                                                </div>
                                                <div className={`mt-1 text-[11px] font-fira leading-snug ${
                                                    signal.tone === 'amber' ? 'text-amber-200/80' : 'text-cyber-purple/85'
                                                }`}>
                                                    {signal.summary}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-cyber-blue/15 bg-cyber-dark/40 px-3 py-2.5 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.18em]">
                                    <span className="flex items-center gap-1 text-cyber-blue/60">
                                        <Radar size={11} /> Readout
                                    </span>
                                    <span className="text-cyber-green font-bold">{analysis.grade}</span>
                                </div>
                                <div className="text-[12px] font-fira text-slate-200">{compactNote}</div>
                                <div className="text-[11px] font-fira text-cyber-blue/70">→ {compactAction}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {hpLow ? (
                                    <Motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => { onRest?.(); handleClose(); }}
                                        className="min-h-[42px] rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-[11px] font-rajdhani font-bold text-red-300"
                                    >
                                        휴식 우선
                                    </Motion.button>
                                ) : (
                                    <div className="min-h-[42px] rounded-xl border border-cyber-blue/10 bg-cyber-dark/30 px-3 py-2 text-[11px] font-fira text-cyber-blue/55 flex items-center">
                                        {mpLow ? 'MP 회복 점검' : '다음 행동 준비 완료'}
                                    </div>
                                )}
                                {invFull ? (
                                    <Motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => onSell?.()}
                                        className="min-h-[42px] rounded-xl border border-cyber-blue/25 bg-cyber-blue/10 px-3 py-2 text-[11px] font-rajdhani font-bold text-cyber-blue"
                                    >
                                        인벤 정리
                                    </Motion.button>
                                ) : upgradeHint ? (
                                    <Motion.button
                                        data-testid="post-combat-review-loot"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => onSell?.()}
                                        className="min-h-[42px] rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] font-rajdhani font-bold text-amber-200"
                                    >
                                        장비 보기
                                    </Motion.button>
                                ) : traitHint ? (
                                    <Motion.button
                                        data-testid="post-combat-review-loot"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => onSell?.()}
                                        className="min-h-[42px] rounded-xl border border-cyber-purple/25 bg-cyber-purple/10 px-3 py-2 text-[11px] font-rajdhani font-bold text-cyber-purple"
                                    >
                                        공명 장비 보기
                                    </Motion.button>
                                ) : (
                                    <div className="min-h-[42px] rounded-xl border border-cyber-green/20 bg-cyber-green/5 px-3 py-2 text-[11px] font-fira text-cyber-green/70 flex items-center">
                                        전리품 확인 완료
                                    </div>
                                )}
                            </div>
                            <Motion.button
                                data-testid="post-combat-continue"
                                whileTap={{ scale: 0.97 }}
                                onClick={handleClose}
                                className="w-full min-h-[42px] rounded-xl border border-cyber-green/30 bg-cyber-green/10 px-3 py-2 text-[11px] font-rajdhani font-bold text-cyber-green"
                            >
                                계속
                            </Motion.button>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between bg-cyber-green/10 border-b border-cyber-green/20 px-4 py-3">
                                <div className="flex items-center gap-2 text-cyber-green font-rajdhani font-bold tracking-widest text-sm">
                                    <Sword size={16} /> COMBAT RESULT
                                </div>
                                <button
                                    data-testid="post-combat-close"
                                    onClick={handleClose}
                                    className="text-cyber-blue/50 hover:text-cyber-blue transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="px-4 py-3 space-y-2">
                                {hasLevelUp && (
                                    <div className="flex items-center gap-2 text-yellow-400 font-rajdhani font-bold text-sm animate-pulse">
                                        <Star size={16} className="text-yellow-300" />
                                        LEVEL UP!
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-cyber-blue/10">
                                        <div className="text-cyber-blue/50 text-xs font-fira">EXP</div>
                                        <div className="text-cyber-blue font-bold font-rajdhani">+{result.exp}</div>
                                    </div>
                                    <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-yellow-500/20">
                                        <div className="text-yellow-500/50 text-xs font-fira">GOLD</div>
                                        <div className="text-yellow-400 font-bold font-rajdhani">+{result.gold}G</div>
                                    </div>
                                </div>

                                {droppedItems.length > 0 && (
                                    <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-cyber-purple/20">
                                        <div className="text-cyber-purple/60 text-xs font-fira mb-1 flex items-center gap-1">
                                            <Package size={12} /> LOOT
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {droppedItems.map((item, i) => (
                                                <span key={i} className="text-xs bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple px-2 py-0.5 rounded font-fira">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {traitHint && (
                                    <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-cyber-purple/20">
                                        <div className="text-cyber-purple/60 text-xs font-fira mb-1 flex items-center gap-1">
                                            <Star size={12} /> TRAIT RESONANCE
                                        </div>
                                        <div className="text-[11px] font-fira text-cyber-purple">
                                            {traitHint.name}
                                        </div>
                                        <div className="mt-1 text-[11px] font-fira text-cyber-purple/75">
                                            {traitHint.summary}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-cyber-blue/15 space-y-2">
                                    <div className="flex items-center justify-between gap-2 text-xs font-fira">
                                        <div className="text-cyber-blue/60 flex items-center gap-1">
                                            <Radar size={12} /> TACTICAL READOUT
                                        </div>
                                        <div className="text-cyber-green font-bold">{analysis.grade}</div>
                                    </div>
                                    <div className="space-y-1 text-[11px] font-fira text-slate-300">
                                        {analysis.notes.map((note) => (
                                            <div key={note}>• {note}</div>
                                        ))}
                                    </div>
                                    <div className="pt-1 border-t border-cyber-blue/10 space-y-1 text-[11px] font-fira text-cyber-blue/75">
                                        {analysis.actions.map((action) => (
                                            <div key={action}>→ {action}</div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                    {hpLow && (
                                        <Motion.button
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => { onRest?.(); handleClose(); }}
                                            className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-red-950/30 border border-red-500/30 rounded text-red-400 hover:bg-red-900/40 transition-all font-rajdhani font-bold text-xs tracking-wider"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Heart size={14} className="animate-pulse" />
                                                HP가 낮습니다 — 휴식 또는 회복 아이템 사용 추천
                                            </div>
                                            <ChevronRight size={14} />
                                        </Motion.button>
                                    )}
                                    {!invFull && (upgradeHint || traitHint) && (
                                        <Motion.button
                                            data-testid="post-combat-review-loot"
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => { onSell?.(); handleClose(); }}
                                            className={`w-full flex items-center justify-between min-h-[44px] px-3 py-2 rounded text-xs font-rajdhani font-bold tracking-wider transition-all ${
                                                upgradeHint
                                                    ? 'bg-amber-950/25 border border-amber-400/30 text-amber-200 hover:bg-amber-900/35'
                                                    : 'bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple hover:bg-cyber-purple/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Package size={14} />
                                                {upgradeHint ? '장비 갱신 후보 확인' : '성향 공명 전리품 확인'}
                                            </div>
                                            <ChevronRight size={14} />
                                        </Motion.button>
                                    )}
                                    {mpLow && !hpLow && (
                                        <div className="flex items-center gap-2 text-blue-400/70 text-xs font-fira px-1">
                                            <Zap size={12} /> MP가 낮습니다. 다음 전투 전 회복 아이템을 사용하세요.
                                        </div>
                                    )}
                                    {invFull && (
                                        <Motion.button
                                            data-testid="post-combat-review-loot"
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => { onSell?.(); handleClose(); }}
                                            className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-cyber-dark/50 border border-cyber-blue/20 rounded text-cyber-blue/70 hover:bg-cyber-blue/10 transition-all font-rajdhani font-bold text-xs tracking-wider"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Package size={14} />
                                                인벤토리 과밀 — 저가 재료 일괄 정리
                                            </div>
                                            <ChevronRight size={14} />
                                        </Motion.button>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-cyber-blue/10 px-4 py-2">
                                <Motion.button
                                    data-testid="post-combat-continue"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleClose}
                                    className="w-full min-h-[40px] text-cyber-blue/60 hover:text-cyber-blue text-xs font-rajdhani tracking-widest transition-colors"
                                >
                                    계속하기 [ CONTINUE ]
                                </Motion.button>
                            </div>
                        </>
                    )}
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PostCombatCard;
