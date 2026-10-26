// cycle 321: unused MSG import 제거 — CodexDiscoveryOverlay 어디에서도 MSG 참조 0건.
import { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * 도감 신규 항목 발견 알림 1건 — 소비 지점(name/category 렌더)만 좁힌다.
 * 생산자는 아직 없다(Codex.tsx의 discoveryEntry는 항상 null — 향후 발견 알림 연동용).
 */
export interface CodexDiscoveryEntry {
    name?: string;
    category?: string;
}

/**
 * CodexDiscoveryOverlay — 도감 신규 항목 발견 시 glow 애니메이션 오버레이
 * 2초 후 자동 해제
 */
interface CodexDiscoveryOverlayProps { entry?: CodexDiscoveryEntry | null; onDismiss?: () => void }

const CodexDiscoveryOverlay = ({ entry, onDismiss }: CodexDiscoveryOverlayProps) => {
    useEffect(() => {
        if (!entry) return;
        const timer = setTimeout(() => onDismiss?.(), 2200);
        return () => clearTimeout(timer);
    }, [entry, onDismiss]);

    // 감사 A11Y-03: 2.2초 뒤 사라지는 알림이라 늘 있는 상태 알림 칸 안에 그린다.
    return (
        <div role="status" className="pointer-events-none absolute">
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
                        className="absolute size-64 rounded-full bg-gradient-to-br from-ae-ether/40 to-ae-exp/30 blur-3xl"
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
                                className="absolute size-1.5 rounded-full bg-ae-ether"
                            />
                        ))}

                        <Motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                        >
                            <Sparkles size={28} className="text-ae-ether drop-shadow-[0_0_8px_rgb(var(--aether-ether-rgb)/0.8)]" />
                        </Motion.div>

                        <div className="aether-type-label font-semibold text-ae-ether-hi">
                            새 기록 발견
                        </div>
                        <div className="aether-type-heading font-display font-bold text-ae-ink drop-shadow-[0_0_12px_rgb(var(--aether-ether-rgb)/0.5)]">
                            {entry.name}
                        </div>
                        {entry.category && (
                            <div className="aether-type-label text-ae-ink-3">
                                {entry.category}
                            </div>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
        </div>
    );
};

export default CodexDiscoveryOverlay;
