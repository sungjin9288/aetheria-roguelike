import { motion as Motion, AnimatePresence } from 'framer-motion';

/**
 * LevelUpBanner — 레벨업 순간의 시각 보상 (slice 29).
 *
 * slice 23이 초반 레벨업을 느리게/의미있게 만들었지만, 레벨업은 사운드+로그만
 * 있고 화면 연출이 0이었다(levelUpGlow 키프레임은 정의돼 있으나 미사용 dead).
 * 레퍼런스(Hades/Balatro): 성장 순간에 짧고 확실한 "한 방" 피드백.
 *
 * GameRoot가 player.level 증가를 감지해 level을 내려보내고 ~1.8s 후 null로
 * 해제한다. 표시는 순수 presentational.
 */
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
                    <div className="font-rajdhani text-[11px] font-bold uppercase tracking-[0.34em] text-[#f6e7a2]/92">
                        Level Up
                    </div>
                    <div className="mt-0.5 font-rajdhani text-[2rem] font-black leading-none text-white drop-shadow-[0_0_14px_rgba(246,231,162,0.65)]">
                        Lv.{level}
                    </div>
                </div>
            </Motion.div>
        )}
    </AnimatePresence>
);

export default LevelUpBanner;
