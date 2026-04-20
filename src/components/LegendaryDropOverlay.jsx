import React, { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ItemIcon from './icons/ItemIcon.jsx';
import { getSignatureMetadata } from '../data/signatureItems.js';

/**
 * LegendaryDropOverlay — dedicated signature 아이템을 획득한 순간
 * 풀스크린 오버레이로 "와" 모먼트를 연출한다.
 *
 * - framer-motion + SIGNATURE_TONE 글로우로 tone별 색 연출
 * - 3초 auto-dismiss
 * - 탭/클릭 시 즉시 dismiss
 * - 아이콘은 실제 signature sprite (gold ring + badge 포함)을 그대로 사용
 */

const TONE_GLOW = Object.freeze({
    holy: { ring: 'rgba(246,231,162,0.6)', radial: 'rgba(246,231,162,0.35)', particle: '#f6e7a2' },
    fire: { ring: 'rgba(255,180,138,0.6)', radial: 'rgba(255,180,138,0.35)', particle: '#ffb48a' },
    frost: { ring: 'rgba(204,232,245,0.55)', radial: 'rgba(204,232,245,0.3)', particle: '#cce8f5' },
    shadow: { ring: 'rgba(199,164,240,0.6)', radial: 'rgba(199,164,240,0.3)', particle: '#c7a4f0' },
    arcane: { ring: 'rgba(192,176,232,0.6)', radial: 'rgba(192,176,232,0.3)', particle: '#c0b0e8' },
    nature: { ring: 'rgba(168,208,160,0.55)', radial: 'rgba(168,208,160,0.28)', particle: '#a8d0a0' },
    earth: { ring: 'rgba(216,184,120,0.5)', radial: 'rgba(216,184,120,0.26)', particle: '#d8b878' },
    steel: { ring: 'rgba(230,236,244,0.5)', radial: 'rgba(230,236,244,0.24)', particle: '#e6ecf4' },
    rust: { ring: 'rgba(217,165,108,0.5)', radial: 'rgba(217,165,108,0.26)', particle: '#d9a56c' },
});

const DEFAULT_GLOW = TONE_GLOW.holy;

const DROP_DURATION_MS = 3000;

const LegendaryDropOverlay = ({ item, onDismiss }) => {
    useEffect(() => {
        if (!item) return undefined;
        const timer = setTimeout(() => onDismiss?.(), DROP_DURATION_MS);
        return () => clearTimeout(timer);
    }, [item, onDismiss]);

    const meta = item ? getSignatureMetadata(item) : null;
    const glow = TONE_GLOW[meta?.tone] || DEFAULT_GLOW;

    return (
        <AnimatePresence>
            {item && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto bg-black/20 backdrop-blur-[1px]"
                    onClick={onDismiss}
                    data-legendary-drop={item.name}
                    role="alertdialog"
                    aria-label={`전설 획득: ${item.name}`}
                >
                    {/* 배경 라디얼 글로우 */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: [0, 0.65, 0.35, 0], scale: [0.7, 1.2, 1.4, 1.6] }}
                        transition={{ duration: 2.4, ease: 'easeOut' }}
                        className="absolute w-80 h-80 rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${glow.radial}, transparent 72%)` }}
                    />

                    {/* 12방향 파티클 스파클 */}
                    {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i / 12) * Math.PI * 2;
                        const dx = Math.cos(angle) * 110;
                        const dy = Math.sin(angle) * 110;
                        return (
                            <Motion.div
                                key={i}
                                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    x: [0, dx],
                                    y: [0, dy],
                                    scale: [0, 1.4, 0],
                                }}
                                transition={{ duration: 1.4, delay: 0.18 + i * 0.04, ease: 'easeOut' }}
                                className="absolute h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: glow.particle, boxShadow: `0 0 8px ${glow.ring}` }}
                            />
                        );
                    })}

                    {/* 콘텐츠 */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.6, y: 20 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.96], y: [20, 0, 0, -8] }}
                        transition={{ duration: DROP_DURATION_MS / 1000, times: [0, 0.15, 0.82, 1] }}
                        className="relative flex flex-col items-center gap-3"
                    >
                        <Motion.div
                            animate={{ rotate: [0, 8, -8, 0] }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                        >
                            <Sparkles size={24} style={{ color: glow.particle, filter: `drop-shadow(0 0 10px ${glow.ring})` }} />
                        </Motion.div>

                        <div className="text-[10px] font-fira uppercase tracking-[0.3em]" style={{ color: glow.particle }}>
                            Legendary
                        </div>

                        <Motion.div
                            initial={{ scale: 0.4, rotate: -8 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.1 }}
                        >
                            <ItemIcon item={item} size={96} showBorder />
                        </Motion.div>

                        <div
                            className="text-xl font-rajdhani font-bold text-white tracking-wide"
                            style={{ textShadow: `0 0 14px ${glow.ring}` }}
                        >
                            {item.name}
                        </div>
                        {meta?.artNote && (
                            <div className="max-w-xs text-center text-[11px] font-fira text-slate-300/90">
                                {meta.artNote}
                            </div>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default LegendaryDropOverlay;
