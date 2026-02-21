import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sword, Star, Package, Heart, Zap, ChevronRight, X } from 'lucide-react';

/**
 * PostCombatCard — 전투 종료 후 결과 요약 카드
 * props:
 *   result: { exp, gold, items: [], leveledUp, hpLow, mpLow, invFull }
 *   onClose: () => void
 *   onRest: () => void
 *   onSell: () => void
 */
const PostCombatCard = ({ result, onClose, onRest, onSell }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (result) {
            const t = setTimeout(() => setVisible(true), 200);
            return () => clearTimeout(t);
        }
        setVisible(false);
    }, [result]);

    if (!result) return null;

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300);
    };

    return (
        <AnimatePresence>
            {visible && (
                <Motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[clamp(17rem,90vw,26rem)] bg-cyber-black/95 border border-cyber-green/40 rounded-xl shadow-[0_0_30px_rgba(0,255,157,0.2)] backdrop-blur-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between bg-cyber-green/10 border-b border-cyber-green/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-cyber-green font-rajdhani font-bold tracking-widest text-sm">
                            <Sword size={16} /> COMBAT RESULT
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-cyber-blue/50 hover:text-cyber-blue transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Rewards */}
                    <div className="px-4 py-3 space-y-2">
                        {result.leveledUp && (
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

                        {result.items?.length > 0 && (
                            <div className="bg-cyber-dark/40 rounded px-3 py-2 border border-cyber-purple/20">
                                <div className="text-cyber-purple/60 text-xs font-fira mb-1 flex items-center gap-1">
                                    <Package size={12} /> LOOT
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {result.items.map((item, i) => (
                                        <span key={i} className="text-xs bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple px-2 py-0.5 rounded font-fira">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Smart Suggestions */}
                        <div className="space-y-1.5 pt-1">
                            {result.hpLow && (
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onRest?.(); handleClose(); }}
                                    className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-red-950/30 border border-red-500/30 rounded text-red-400 hover:bg-red-900/40 transition-all font-rajdhani font-bold text-xs tracking-wider"
                                >
                                    <div className="flex items-center gap-2">
                                        <Heart size={14} className="animate-pulse" />
                                        HP가 낮습니다 — 휴식 또는 회복 아이템 사용 추천
                                    </div>
                                    <ChevronRight size={14} />
                                </motion.button>
                            )}
                            {result.mpLow && !result.hpLow && (
                                <div className="flex items-center gap-2 text-blue-400/70 text-xs font-fira px-1">
                                    <Zap size={12} /> MP가 낮습니다. 다음 전투 전 회복 아이템을 사용하세요.
                                </div>
                            )}
                            {result.invFull && (
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { onSell?.(); handleClose(); }}
                                    className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-cyber-dark/50 border border-cyber-blue/20 rounded text-cyber-blue/70 hover:bg-cyber-blue/10 transition-all font-rajdhani font-bold text-xs tracking-wider"
                                >
                                    <div className="flex items-center gap-2">
                                        <Package size={14} />
                                        인벤토리 과밀 — 저가 재료 일괄 정리
                                    </div>
                                    <ChevronRight size={14} />
                                </motion.button>
                            )}
                        </div>
                    </div>

                    {/* Close CTA */}
                    <div className="border-t border-cyber-blue/10 px-4 py-2">
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleClose}
                            className="w-full min-h-[40px] text-cyber-blue/60 hover:text-cyber-blue text-xs font-rajdhani tracking-widest transition-colors"
                        >
                            계속하기 [ CONTINUE ]
                        </motion.button>
                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PostCombatCard;
