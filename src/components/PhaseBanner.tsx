import { motion as Motion, AnimatePresence } from 'framer-motion';

/** 보스의 전투 단계가 바뀌는 순간을 짧게 알린다. */
interface PhaseBannerProps {
    phase: { n: number; name: string } | null;
}

const PhaseBanner = ({ phase }: PhaseBannerProps) => {
    const isFinal = (phase?.n || 0) >= 3;
    const accent = isFinal ? '#c7a4f0' : '#f47ab0';
    const glow = isFinal ? 'rgba(199,164,240,0.5)' : 'rgba(244,122,176,0.5)';
    return (
        <AnimatePresence>
            {phase && (
                <Motion.div
                    key={`${phase.n}_${phase.name}`}
                    data-testid="phase-banner"
                    data-phase={phase.n}
                    initial={{ opacity: 0, scale: 0.78, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1, y: -14 }}
                    transition={{ duration: 0.34, ease: 'easeOut' }}
                    className="pointer-events-none fixed inset-x-0 top-[32%] z-[60] flex justify-center px-6"
                >
                    <div
                        className="rounded-[var(--aether-r-panel)] border px-7 py-3.5 text-center backdrop-blur-md"
                        style={{
                            borderColor: accent,
                            background: `linear-gradient(180deg, ${isFinal ? 'rgba(40,24,56,0.62)' : 'rgba(48,18,30,0.62)'} 0%, rgba(10,8,14,0.7) 100%)`,
                            boxShadow: `0 0 28px ${glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
                        }}
                    >
                        <div
                            className="font-readable text-[11px] font-bold"
                            style={{ color: accent }}
                        >
                            {isFinal ? '💀 최종 단계' : `⚡ ${phase.n}단계 진입`}
                        </div>
                        <div
                            className="mt-0.5 font-rajdhani text-[1.55rem] font-black leading-none text-white"
                            style={{ textShadow: `0 0 14px ${glow}` }}
                        >
                            {phase.name}
                        </div>
                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PhaseBanner;
