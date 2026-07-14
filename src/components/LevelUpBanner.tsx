import { motion as Motion, AnimatePresence } from 'framer-motion';

/** 레벨 상승 순간을 짧고 분명하게 보여준다. */
interface LevelUpBannerProps {
    level: number | null;
}

const LevelUpBanner = ({ level }: LevelUpBannerProps) => (
    <AnimatePresence>
        {level != null && (
            <Motion.div
                key={level}
                data-testid="level-up-banner"
                initial={{ opacity: 0, scale: 0.7, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.12, y: -12 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
                className="pointer-events-none fixed inset-x-0 top-[30%] z-[60] flex justify-center px-6"
            >
                <div className="animate-levelup rounded-[var(--aether-r-panel)] border border-[#f6e7a2]/45 bg-[linear-gradient(180deg,rgba(246,231,162,0.2)_0%,rgba(20,16,8,0.6)_100%)] px-7 py-3.5 text-center backdrop-blur-md">
                    <div className="font-readable text-[11px] font-bold text-[#f6e7a2]/92">
                        레벨 상승
                    </div>
                    <div className="mt-1 font-readable text-[1.7rem] font-black leading-none text-white drop-shadow-[0_0_14px_rgba(246,231,162,0.65)]">
                        레벨 {level}
                    </div>
                </div>
            </Motion.div>
        )}
    </AnimatePresence>
);

export default LevelUpBanner;
