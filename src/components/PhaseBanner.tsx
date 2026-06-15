import { motion as Motion, AnimatePresence } from 'framer-motion';

/**
 * PhaseBanner — 보스 페이즈 전환 순간의 극적 연출 (slice 33).
 *
 * 로그라이크의 클라이맥스인 보스전에서 페이즈 전환(HP 50%/25%)은 enemy 이름만
 * 바뀌고 로그 한 줄이 전부였다. 성장(레벨업 배너)·크리(펄스)에 이어 보스
 * 페이즈도 "지금 무언가 달라졌다"는 한 방을 준다.
 *
 * GameRoot가 enemy.phase2Triggered/phase3Triggered 플립을 감지해 {n, name}을
 * 내려보내고 ~2s 후 해제. phase3은 더 강한 톤(자주/💀).
 */
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
                            className="font-rajdhani text-[11px] font-bold uppercase tracking-[0.32em]"
                            style={{ color: accent }}
                        >
                            {isFinal ? '💀 Final Phase' : `⚡ Phase ${phase.n}`}
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
