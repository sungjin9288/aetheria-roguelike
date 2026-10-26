import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Skull, Zap } from 'lucide-react';
import { MSG } from '../data/messages.js';

/**
 * 보스의 전투 단계가 바뀌는 순간을 짧게 알린다(2026-10 에테르 유리).
 * 2단계는 생명색(맞서는 긴장), 최종 단계는 경험색(보라) — 색은 `data-phase-tone`을 읽는 index.css `w3:combat`가 토큰으로 정한다.
 * 그림 문자 대신 선 아이콘이다(감사 VD-13).
 */
interface PhaseBannerProps {
    phase: { n: number; name: string } | null;
}

const PhaseBanner = ({ phase }: PhaseBannerProps) => {
    const isFinal = (phase?.n || 0) >= 3;
    const Icon = isFinal ? Skull : Zap;
    return (
        <div role="status" className="pointer-events-none absolute">
        <AnimatePresence>
            {phase && (
                <Motion.div
                    key={`${phase.n}_${phase.name}`}
                    data-testid="phase-banner"
                    data-phase={phase.n}
                    data-phase-tone={isFinal ? 'final' : 'rise'}
                    initial={{ opacity: 0, scale: 0.92, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.04, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                    className="pointer-events-none fixed inset-x-0 top-[32%] z-[60] flex justify-center px-6"
                >
                    <div className="ae-phase-banner rounded-ae-lg px-7 py-3.5 text-center">
                        <div className="ae-phase-banner-label aether-type-label inline-flex items-center justify-center gap-1 font-readable font-bold">
                            <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
                            {isFinal ? MSG.PHASE_BANNER_FINAL : MSG.PHASE_BANNER_ENTER(phase.n)}
                        </div>
                        <div className="mt-1 font-display text-[1.55rem] font-black leading-none text-ae-ink">
                            {phase.name}
                        </div>
                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
        </div>
    );
};

export default PhaseBanner;
