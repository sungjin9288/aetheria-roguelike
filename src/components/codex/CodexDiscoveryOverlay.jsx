import React, { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { MSG } from '../../data/messages';

/**
 * CodexDiscoveryOverlay — 도감 신규 항목 발견 시 glow 애니메이션 오버레이
 * 2초 후 자동 해제
 */
const CodexDiscoveryOverlay = ({ entry, onDismiss }) => {
    useEffect(() => {
        if (!entry) return;
        const timer = setTimeout(() => onDismiss?.(), 2200);
        return () => clearTimeout(timer);
    }, [entry, onDismiss]);

    return (
        <AnimatePresence>
            {entry && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    onClick={onDismiss}
                >
                    {/* 배경 글로우 */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: [0, 0.4, 0.2, 0], scale: [0.8, 1.2, 1.4, 1.6] }}
                        transition={{ duration: 2, ease: 'easeOut' }}
                        className="absolute w-64 h-64 rounded-full bg-gradient-to-br from-cyber-blue/40 to-cyber-purple/30 blur-3xl"
                    />

                    {/* 콘텐츠 */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.95], y: [20, 0, 0, -10] }}
                        transition={{ duration: 2.2, times: [0, 0.2, 0.75, 1] }}
                        className="relative flex flex-col items-center gap-2"
                    >
                        {/* 스파클 파티클 */}
                        {[...Array(4)].map((_, i) => (
                            <Motion.div
                                key={i}
                                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    x: [0, (i % 2 ? 1 : -1) * (30 + i * 15)],
                                    y: [0, -(20 + i * 12)],
                                    scale: [0, 1.2, 0],
                                }}
                                transition={{ duration: 1.2, delay: 0.2 + i * 0.12 }}
                                className="absolute w-1.5 h-1.5 rounded-full bg-cyber-blue"
                            />
                        ))}

                        <Motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                        >
                            <Sparkles size={28} className="text-cyber-blue drop-shadow-[0_0_8px_rgba(0,204,255,0.8)]" />
                        </Motion.div>

                        <div className="text-[9px] font-fira uppercase tracking-[0.2em] text-cyber-blue/80">
                            New Discovery
                        </div>
                        <div className="text-lg font-rajdhani font-bold text-white drop-shadow-[0_0_12px_rgba(0,204,255,0.5)]">
                            {entry.name}
                        </div>
                        {entry.category && (
                            <div className="text-[10px] font-fira text-slate-400/80">
                                {entry.category}
                            </div>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default CodexDiscoveryOverlay;
